package core

import (
	"bytes"
	"cmp"
	"encoding/json"
	"math"
	"slices"
	"strconv"
	"strings"
)

// ScoreboardCharacter is what the board needs to know about one character.
type ScoreboardCharacter struct {
	ID            int32
	Name          string
	AvatarURL     *string
	CharacterType string
	Status        string
	IsActive      bool
}

// ScoreboardInput is everything BuildScoreboard reads.
type ScoreboardInput struct {
	GameState  string
	Config     ScoreboardConfig
	Sheet      CharacterSheetConfig
	Characters []ScoreboardCharacter
	// TabData is each character's stored entries: character ID, then tab key,
	// then the raw JSON array from character_data.
	TabData map[int32]map[string]string
	View    ScoreboardView
}

// ScoreboardResult is the board as one viewer may see it.
type ScoreboardResult struct {
	Columns []ScoreboardResultColumn `json:"columns" doc:"Columns this viewer may see, in display order"`
	// Empty means the order rests on something this viewer can't see.
	SortDescription []ScoreboardSortDescription `json:"sort_description" doc:"The sort, as far as this viewer may know it. Empty means the GM's order uses a hidden column."`
	FullView        bool                        `json:"full_view" doc:"The viewer sees every column"`
	Rows            []ScoreboardRow             `json:"rows" doc:"Characters in board order"`
	BrokenColumnIDs []string                    `json:"broken_column_ids,omitempty" required:"false" doc:"Columns whose sheet tab or field no longer exists. Full view only."`
	// Set only when rows were actually left out, so a board shorter than the
	// cut doesn't claim to be one.
	TopCount int `json:"top_count,omitempty" required:"false" doc:"This viewer gets only the top rows of the board, and this is how many. Absent means every row."`
}

// ScoreboardResultColumn describes one column of the result.
type ScoreboardResultColumn struct {
	ID      string `json:"id" doc:"Column ID, the key into each row's values"`
	Label   string `json:"label" doc:"Column heading"`
	Display string `json:"display" enum:"value,value_max,bands" doc:"How the column's cells read"`
	Hidden  bool   `json:"hidden,omitempty" required:"false" doc:"Hidden from players. Sent only in full view while the game runs."`
}

// ScoreboardSortDescription is one sort key in words.
type ScoreboardSortDescription struct {
	Label     string `json:"label" doc:"Column heading, or Name"`
	Direction string `json:"direction" enum:"asc,desc" doc:"Sort direction"`
}

// ScoreboardRow is one character's line. Positions are not sent: the client
// numbers rows by their order, so nothing can reveal a tie on a hidden column.
type ScoreboardRow struct {
	CharacterID   int32                     `json:"character_id" doc:"Character ID"`
	CharacterName string                    `json:"character_name" doc:"Character name"`
	AvatarURL     *string                   `json:"avatar_url,omitempty" required:"false" doc:"Character avatar"`
	Values        map[string]ScoreboardCell `json:"values" doc:"Cells by column ID. A blank cell has no key."`
}

// ScoreboardCell is one value. A player's view of a banded column carries only
// Label.
type ScoreboardCell struct {
	Value *float64 `json:"value,omitempty" required:"false" doc:"The number. Absent when the viewer sees only a range label."`
	Max   *float64 `json:"max,omitempty" required:"false" doc:"The track's maximum, when the column shows one"`
	Label string   `json:"label,omitempty" required:"false" doc:"The matching range's label"`
}

// ScoreboardTabEntryNames is the editor's list of entries for one tab.
type ScoreboardTabEntryNames struct {
	TabKey     string   `json:"tab_key" doc:"Character sheet tab"`
	EntryNames []string `json:"entry_names" doc:"Entry names used by the game's player characters, sorted, one spelling each"`
}

// scoreboardReading is a value as stored on a sheet, before any filtering.
type scoreboardReading struct {
	value float64
	max   *float64
}

type scoreboardEntry struct {
	name        string // normalized, for matching
	displayName string // trimmed, as the GM wrote it
	fields      map[string]json.RawMessage
}

// BuildScoreboard computes the board for one viewer. It is the only place
// hidden values and rows below a top-N cut are removed, and it sorts first, so
// a player gets the real order and none of the values behind it. Returns nil
// for ScoreboardNone.
func BuildScoreboard(in ScoreboardInput) *ScoreboardResult {
	if in.View == ScoreboardNone {
		return nil
	}
	fullView := in.View == ScoreboardFull

	result := &ScoreboardResult{
		Columns:         []ScoreboardResultColumn{},
		SortDescription: []ScoreboardSortDescription{},
		FullView:        fullView,
		Rows:            []ScoreboardRow{},
	}

	// A hidden flag means nothing in an archive: everyone sees the column.
	archived := IsPublicArchive(in.GameState)
	fieldTypes := make(map[string]string, len(in.Config.Columns))
	for _, column := range in.Config.Columns {
		fields, _ := ScoreboardNumericFields(in.Sheet, column.TabKey)
		if fieldType, ok := fields[column.FieldKey]; ok {
			fieldTypes[column.ID] = fieldType
		} else if fullView {
			result.BrokenColumnIDs = append(result.BrokenColumnIDs, column.ID)
		}
		if column.Hidden && !fullView {
			continue
		}
		result.Columns = append(result.Columns, ScoreboardResultColumn{
			ID:      column.ID,
			Label:   column.Label,
			Display: scoreboardDisplay(column),
			Hidden:  column.Hidden && !archived,
		})
	}
	result.SortDescription = describeScoreboardSort(in.Config, fullView)

	characters := make([]ScoreboardCharacter, 0, len(in.Characters))
	readings := make(map[int32]map[string]scoreboardReading, len(in.Characters))
	for _, character := range in.Characters {
		if !onScoreboard(character) {
			continue
		}
		characters = append(characters, character)
		readings[character.ID] = readScoreboardCharacter(in.Config.Columns, fieldTypes, in.TabData[character.ID])
	}

	sortScoreboardCharacters(characters, readings, in.Config)

	// The cut comes after sorting, so it keeps the real leaders, and is exactly
	// TopCount rows: widening it for a tie at the cut would reveal the tie.
	if !fullView && in.Config.TopCount > 0 && len(characters) > in.Config.TopCount {
		characters = characters[:in.Config.TopCount]
		result.TopCount = in.Config.TopCount
	}

	for _, character := range characters {
		row := ScoreboardRow{
			CharacterID:   character.ID,
			CharacterName: character.Name,
			AvatarURL:     character.AvatarURL,
			Values:        map[string]ScoreboardCell{},
		}
		for _, column := range in.Config.Columns {
			if column.Hidden && !fullView {
				continue
			}
			reading, ok := readings[character.ID][column.ID]
			if !ok {
				continue
			}
			if cell, ok := scoreboardCell(column, reading, fullView); ok {
				row.Values[column.ID] = cell
			}
		}
		result.Rows = append(result.Rows, row)
	}
	return result
}

// ScoreboardEntryNames lists the entry names the board's characters use on each
// tab with a number or track field, in layout order. Names differing only in
// case or surrounding spaces match the same column, so they appear once.
func ScoreboardEntryNames(sheet CharacterSheetConfig, characters []ScoreboardCharacter, tabData map[int32]map[string]string) []ScoreboardTabEntryNames {
	result := []ScoreboardTabEntryNames{}
	for _, tabKey := range ResolveSheetTabKeys(sheet) {
		if fields, _ := ScoreboardNumericFields(sheet, tabKey); len(fields) == 0 {
			continue
		}
		spellings := map[string]string{}
		for _, character := range characters {
			if !onScoreboard(character) {
				continue
			}
			for _, entry := range parseScoreboardEntries(tabKey, tabData[character.ID][tabKey]) {
				if _, seen := spellings[entry.name]; !seen && entry.name != "" {
					spellings[entry.name] = entry.displayName
				}
			}
		}
		names := make([]string, 0, len(spellings))
		for _, name := range spellings {
			names = append(names, name)
		}
		slices.SortFunc(names, func(a, b string) int {
			return cmp.Or(cmp.Compare(strings.ToLower(a), strings.ToLower(b)), cmp.Compare(a, b))
		})
		result = append(result, ScoreboardTabEntryNames{TabKey: tabKey, EntryNames: names})
	}
	return result
}

// onScoreboard says whether a character gets a row: approved, active player
// characters only.
func onScoreboard(character ScoreboardCharacter) bool {
	return character.CharacterType == "player_character" && character.Status == "approved" && character.IsActive
}

func scoreboardDisplay(column ScoreboardColumn) string {
	if column.Display == "" {
		return ScoreboardDisplayValue
	}
	return column.Display
}

// describeScoreboardSort puts the sort into words. A player's description stops
// at the first key on a hidden column: later keys only break its ties, so
// naming one would claim an order the board doesn't have.
func describeScoreboardSort(config ScoreboardConfig, fullView bool) []ScoreboardSortDescription {
	if len(config.Sort) == 0 {
		return []ScoreboardSortDescription{{Label: "Name", Direction: ScoreboardSortAsc}}
	}
	description := []ScoreboardSortDescription{}
	for _, key := range config.Sort {
		if key.Key == ScoreboardSortName {
			description = append(description, ScoreboardSortDescription{Label: "Name", Direction: key.Direction})
			continue
		}
		index := slices.IndexFunc(config.Columns, func(c ScoreboardColumn) bool { return c.ID == key.Key })
		if index < 0 {
			continue
		}
		column := config.Columns[index]
		if column.Hidden && !fullView {
			break
		}
		description = append(description, ScoreboardSortDescription{Label: column.Label, Direction: key.Direction})
	}
	return description
}

func readScoreboardCharacter(columns []ScoreboardColumn, fieldTypes map[string]string, tabs map[string]string) map[string]scoreboardReading {
	readings := make(map[string]scoreboardReading, len(columns))
	parsed := map[string][]scoreboardEntry{}
	for _, column := range columns {
		fieldType, ok := fieldTypes[column.ID]
		if !ok {
			continue
		}
		entries, ok := parsed[column.TabKey]
		if !ok {
			entries = parseScoreboardEntries(column.TabKey, tabs[column.TabKey])
			parsed[column.TabKey] = entries
		}
		want := scoreboardEntryKey(column.Entry)
		// The first entry of that name decides, even if its value is unusable.
		index := slices.IndexFunc(entries, func(e scoreboardEntry) bool { return e.name == want })
		if index < 0 {
			continue
		}
		if reading, ok := readScoreboardField(column.TabKey, column.FieldKey, fieldType, entries[index].fields); ok {
			readings[column.ID] = reading
		}
	}
	return readings
}

func scoreboardEntryKey(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

// parseScoreboardEntries reads a tab's stored array. Anything unreadable is
// skipped: one bad entry or row blanks a cell, never the board.
func parseScoreboardEntries(tabKey, stored string) []scoreboardEntry {
	if stored == "" {
		return nil
	}
	var rawEntries []json.RawMessage
	if err := json.Unmarshal([]byte(stored), &rawEntries); err != nil {
		return nil
	}
	entries := make([]scoreboardEntry, 0, len(rawEntries))
	for _, raw := range rawEntries {
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil || fields == nil {
			continue
		}
		name := scoreboardString(fields["name"])
		// Legacy Numbers rows name the entry in `type` (see normalizeEntry in
		// the frontend's lib/sheetEntries.ts).
		if name == "" && tabKey == "numbers" {
			name = scoreboardString(fields["type"])
		}
		entries = append(entries, scoreboardEntry{
			name:        scoreboardEntryKey(name),
			displayName: strings.TrimSpace(name),
			fields:      fields,
		})
	}
	return entries
}

func scoreboardString(raw json.RawMessage) string {
	var value string
	if len(raw) == 0 || raw[0] != '"' || json.Unmarshal(raw, &value) != nil {
		return ""
	}
	return value
}

// readScoreboardField reads a value the way the sheet editor does (normalizeEntry
// and the codecs in lib/sheetFieldValues.ts), so a cell agrees with the sheet.
func readScoreboardField(tabKey, fieldKey, fieldType string, fields map[string]json.RawMessage) (scoreboardReading, bool) {
	raw, present := fields[fieldKey]

	if tabKey == "numbers" && fieldKey == "amount" {
		// Legacy Numbers rows: a bare amount with a flat max beside it, or a
		// max alone, which counts as zero.
		amount, isBare := scoreboardJSONNumber(raw)
		flatMax, hasFlatMax := scoreboardJSONNumber(fields["max"])
		if isBare || (!present && hasFlatMax) {
			reading := scoreboardReading{value: amount}
			if hasFlatMax && flatMax > 0 {
				reading.max = &flatMax
			}
			return reading, true
		}
	}

	if !present {
		return scoreboardReading{}, false
	}
	if fieldType == SheetFieldNumber {
		value, ok := scoreboardNumber(raw)
		return scoreboardReading{value: value}, ok
	}

	var track map[string]json.RawMessage
	if err := json.Unmarshal(raw, &track); err != nil || track == nil {
		return scoreboardReading{}, false
	}
	value, hasValue := scoreboardNumber(track["value"])
	limit, hasMax := scoreboardNumber(track["max"])
	bounded := hasMax && limit > 0
	if !hasValue && !bounded {
		return scoreboardReading{}, false
	}
	reading := scoreboardReading{value: value}
	if bounded {
		reading.max = &limit
	}
	return reading, true
}

// scoreboardNumber accepts a JSON number or a numeric string: rolled loot is
// stored verbatim, and imported loot arrives as strings.
func scoreboardNumber(raw json.RawMessage) (float64, bool) {
	if value, ok := scoreboardJSONNumber(raw); ok {
		return value, true
	}
	text := strings.TrimSpace(scoreboardString(bytes.TrimSpace(raw)))
	if text == "" {
		return 0, false
	}
	value, err := strconv.ParseFloat(text, 64)
	// Infinity and NaN parse, but can't be sent as JSON.
	if err != nil || math.IsInf(value, 0) || math.IsNaN(value) {
		return 0, false
	}
	return value, true
}

func scoreboardJSONNumber(raw json.RawMessage) (float64, bool) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || (trimmed[0] != '-' && (trimmed[0] < '0' || trimmed[0] > '9')) {
		return 0, false
	}
	var value float64
	if err := json.Unmarshal(trimmed, &value); err != nil {
		return 0, false
	}
	return value, true
}

// sortScoreboardCharacters applies the GM's keys, then name, then ID, so the
// order is always deterministic. It reads raw values whatever the column
// displays, and blanks go last in both directions.
func sortScoreboardCharacters(characters []ScoreboardCharacter, readings map[int32]map[string]scoreboardReading, config ScoreboardConfig) {
	byName := func(a, b ScoreboardCharacter) int {
		return cmp.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name))
	}
	slices.SortStableFunc(characters, func(a, b ScoreboardCharacter) int {
		for _, key := range config.Sort {
			var order int
			if key.Key == ScoreboardSortName {
				order = byName(a, b)
				if key.Direction == ScoreboardSortDesc {
					order = -order
				}
			} else {
				order = compareScoreboardReadings(readings[a.ID], readings[b.ID], key)
			}
			if order != 0 {
				return order
			}
		}
		if order := byName(a, b); order != 0 {
			return order
		}
		return cmp.Compare(a.ID, b.ID)
	})
}

func compareScoreboardReadings(a, b map[string]scoreboardReading, key ScoreboardSort) int {
	left, hasLeft := a[key.Key]
	right, hasRight := b[key.Key]
	switch {
	case !hasLeft && !hasRight:
		return 0
	case !hasLeft:
		return 1
	case !hasRight:
		return -1
	}
	order := cmp.Compare(left.value, right.value)
	if key.Direction == ScoreboardSortDesc {
		return -order
	}
	return order
}

// scoreboardCell renders one reading for the viewer. False means a blank cell.
func scoreboardCell(column ScoreboardColumn, reading scoreboardReading, fullView bool) (ScoreboardCell, bool) {
	value := reading.value
	switch column.Display {
	case ScoreboardDisplayValueMax:
		return ScoreboardCell{Value: &value, Max: reading.max}, true
	case ScoreboardDisplayBands:
		label := scoreboardBandLabel(column, reading)
		if fullView {
			return ScoreboardCell{Value: &value, Max: reading.max, Label: label}, true
		}
		// Never the number: hiding it is what the bands are for.
		return ScoreboardCell{Label: label}, label != ""
	default:
		return ScoreboardCell{Value: &value}, true
	}
}

// scoreboardBandLabel returns the first matching band's label, else the
// fallback. Percent bands measure against the character's own max, so a track
// without one matches nothing.
func scoreboardBandLabel(column ScoreboardColumn, reading scoreboardReading) string {
	measure := reading.value
	if column.BandBasis == ScoreboardBandBasisPercent {
		if reading.max == nil || *reading.max <= 0 {
			return column.FallbackLabel
		}
		measure = reading.value * 100 / *reading.max
	}
	for _, band := range column.Bands {
		if scoreboardBandMatches(band, measure) {
			return band.Label
		}
	}
	return column.FallbackLabel
}

func scoreboardBandMatches(band ScoreboardBand, measure float64) bool {
	if band.Min != nil {
		if measure < *band.Min || (band.MinStrict && measure == *band.Min) {
			return false
		}
	}
	if band.Max != nil {
		if measure > *band.Max || (band.MaxStrict && measure == *band.Max) {
			return false
		}
	}
	return true
}
