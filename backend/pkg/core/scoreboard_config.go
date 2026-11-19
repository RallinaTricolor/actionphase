package core

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

// Scoreboard limits. Like the character sheet's, they keep the board usable (a
// table that fits a phone) rather than protect storage.
const (
	MaxScoreboardColumns     = 10
	MaxScoreboardBands       = 10
	MaxScoreboardSortKeys    = 2
	MaxScoreboardLabelLength = 24
	// MaxScoreboardBandLabelSourceLength bounds a range label as written,
	// formatting included. Its visible text still has MaxScoreboardLabelLength.
	MaxScoreboardBandLabelSourceLength = 120
	MaxScoreboardEntryLength           = 40
	// MaxScoreboardTopCount bounds the "players see only the top N" cut. Beyond
	// it a cut hides nothing in a game of any realistic size.
	MaxScoreboardTopCount = 50
)

const (
	// ScoreboardVisibilityStaff shows the board to the GM, co-GMs and audience.
	// It is what an absent visibility means, so a newly enabled board shows
	// players nothing until the GM opens it up.
	ScoreboardVisibilityStaff = "staff"
	// ScoreboardVisibilityPublic shows the board to any logged-in user, like
	// the Common Room.
	ScoreboardVisibilityPublic = "public"

	ScoreboardDisplayValue    = "value"
	ScoreboardDisplayValueMax = "value_max"
	ScoreboardDisplayBands    = "bands"

	ScoreboardBandBasisValue   = "value"
	ScoreboardBandBasisPercent = "percent"

	// ScoreboardSortName is the sort key for the character's name. Every other
	// key is a column ID.
	ScoreboardSortName = "name"
	ScoreboardSortAsc  = "asc"
	ScoreboardSortDesc = "desc"
)

// ErrInvalidScoreboardConfig is wrapped with the reason a config was refused.
// Handlers answer 422 with UserMessage.
var ErrInvalidScoreboardConfig = errors.New("invalid scoreboard config")

// Column IDs are generated client-side and never change, so sort keys survive
// a column rename, the same reasoning as custom sheet tab keys.
var scoreboardColumnIDPattern = regexp.MustCompile(`^c_[a-z0-9]{6}$`)

// defaultSheetNumericFields are the number and track fields of the built-in
// tabs when the GM has not replaced their schema. Everything else about the
// default schemas lives in DEFAULT_SHEET_LAYOUT in the frontend's
// useSheetLayout.ts; keep these the same.
var defaultSheetNumericFields = map[string]map[string]string{
	"skills":    {},
	"inventory": {"quantity": SheetFieldNumber, "value": SheetFieldNumber, "weight": SheetFieldNumber},
	"numbers":   {"amount": SheetFieldTrack},
}

// ScoreboardConfig is a game's scoreboard setup, stored as JSONB on
// games.scoreboard. Whether the board exists at all is the separate
// games.scoreboard_enabled setting, so turning that off keeps this.
//
// Sparse like CharacterSheetConfig: a default is stored as an absent key, so
// it has one representation.
type ScoreboardConfig struct {
	Visibility string             `json:"visibility,omitempty" required:"false" enum:"staff,public" doc:"Who sees the board while the game runs. Absent means staff: the GM, co-GMs and audience."`
	Columns    []ScoreboardColumn `json:"columns,omitzero" required:"false" doc:"Columns in display order"`
	Sort       []ScoreboardSort   `json:"sort,omitzero" required:"false" doc:"Up to two sort keys. Absent means by name."`
	// TopCount cuts the player view to the first rows of the board's order, so a
	// GM can put a target on the leaders without showing where everyone else
	// stands. The GM, co-GMs and audience always get every row, as does everyone
	// once the game is a public archive.
	TopCount int `json:"top_count,omitempty" required:"false" doc:"Players see only this many rows, from the top of the board's order. Absent means every row. The GM, co-GMs and audience always see every row, as does everyone once the game reaches its epilogue."`
}

// ScoreboardColumn is one value read from every character's sheet. Entry IDs
// are per character, so the entry is matched by name.
type ScoreboardColumn struct {
	ID       string `json:"id" doc:"Stable identifier: c_ plus six lower-case letters or digits"`
	Label    string `json:"label" doc:"Column heading"`
	TabKey   string `json:"tab_key" doc:"Character sheet tab the value comes from"`
	Entry    string `json:"entry" doc:"Entry name on that tab, matched ignoring case and surrounding spaces"`
	FieldKey string `json:"field_key" doc:"Number or track field of the entry"`
	Hidden   bool   `json:"hidden,omitempty" required:"false" doc:"Hidden from players while the game runs"`

	Display       string           `json:"display,omitempty" required:"false" enum:"value,value_max,bands" doc:"How a cell reads. Absent means value."`
	Bands         []ScoreboardBand `json:"bands,omitzero" required:"false" doc:"Labelled ranges, checked in order. Only with display=bands."`
	BandBasis     string           `json:"band_basis,omitempty" required:"false" enum:"value,percent" doc:"What band bounds measure. Absent means the value itself; percent means percent of the character's own max."`
	FallbackLabel string           `json:"fallback_label,omitempty" required:"false" doc:"Shown when no band matches. Formatted like a band label."`
}

// ScoreboardBand turns a range of values into a label, e.g. 5 < HP < 10 reads
// "Bloodied". At least one bound is required.
type ScoreboardBand struct {
	Label     string   `json:"label" doc:"Text shown for values in this range. May use inline formatting: bold, italic, strikethrough, code and [color:name]...[/color]. Up to 24 visible characters; formatting doesn't count."`
	Min       *float64 `json:"min,omitempty" required:"false" doc:"Lower bound"`
	MinStrict bool     `json:"min_strict,omitempty" required:"false" doc:"The value must be above min, not equal to it"`
	Max       *float64 `json:"max,omitempty" required:"false" doc:"Upper bound"`
	MaxStrict bool     `json:"max_strict,omitempty" required:"false" doc:"The value must be below max, not equal to it"`
}

// ScoreboardSort is one sort key.
type ScoreboardSort struct {
	Key       string `json:"key" doc:"A column ID, or name"`
	Direction string `json:"direction" enum:"asc,desc" doc:"Sort direction"`
}

// ResolvedVisibility is the config's visibility with the default applied.
// Anything but an explicit public reads as staff, so a bad value hides the
// board rather than exposing it.
func (c ScoreboardConfig) ResolvedVisibility() string {
	if c.Visibility == ScoreboardVisibilityPublic {
		return ScoreboardVisibilityPublic
	}
	return ScoreboardVisibilityStaff
}

func invalidScoreboard(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidScoreboardConfig, fmt.Sprintf(format, args...))
}

// ValidateScoreboardConfig normalizes and validates a config on its own terms,
// returning the value to store. Whether its columns exist on the game's sheet
// is ValidateScoreboardSources, which needs the game.
func ValidateScoreboardConfig(config ScoreboardConfig) (ScoreboardConfig, error) {
	out := ScoreboardConfig{}

	switch config.Visibility {
	case "", ScoreboardVisibilityStaff:
	case ScoreboardVisibilityPublic:
		out.Visibility = ScoreboardVisibilityPublic
	default:
		return config, invalidScoreboard("visibility must be staff or public")
	}

	if len(config.Columns) > MaxScoreboardColumns {
		return config, invalidScoreboard("a scoreboard can have at most %d columns", MaxScoreboardColumns)
	}
	columnIDs := make(map[string]bool, len(config.Columns))
	for i, column := range config.Columns {
		normalized, err := normalizeScoreboardColumn(i, column)
		if err != nil {
			return config, err
		}
		if columnIDs[normalized.ID] {
			return config, invalidScoreboard("column %q is listed more than once", normalized.ID)
		}
		columnIDs[normalized.ID] = true
		out.Columns = append(out.Columns, normalized)
	}

	if len(config.Sort) > MaxScoreboardSortKeys {
		return config, invalidScoreboard("a scoreboard can sort by at most %d keys", MaxScoreboardSortKeys)
	}
	sortKeys := make(map[string]bool, len(config.Sort))
	for _, sort := range config.Sort {
		if sort.Key != ScoreboardSortName && !columnIDs[sort.Key] {
			return config, invalidScoreboard("sort key %q is not one of the columns", sort.Key)
		}
		if sortKeys[sort.Key] {
			return config, invalidScoreboard("sort key %q is used twice", sort.Key)
		}
		sortKeys[sort.Key] = true
		if sort.Direction != ScoreboardSortAsc && sort.Direction != ScoreboardSortDesc {
			return config, invalidScoreboard("sort direction must be asc or desc")
		}
		out.Sort = append(out.Sort, sort)
	}

	if config.TopCount < 0 || config.TopCount > MaxScoreboardTopCount {
		return config, invalidScoreboard("the number of rows players see must be between 1 and %d", MaxScoreboardTopCount)
	}
	out.TopCount = config.TopCount

	return out, nil
}

func normalizeScoreboardColumn(index int, column ScoreboardColumn) (ScoreboardColumn, error) {
	position := index + 1
	if !scoreboardColumnIDPattern.MatchString(column.ID) {
		return column, invalidScoreboard("column %d has a malformed ID", position)
	}

	label, err := normalizeSheetLabel(column.Label, MaxScoreboardLabelLength)
	if err != nil {
		return column, invalidScoreboard("column %d label %s", position, err)
	}
	if label == "" {
		return column, invalidScoreboard("column %d needs a label", position)
	}

	if !IsSheetTabKey(column.TabKey) {
		return column, invalidScoreboard("column %q has an unknown character sheet tab", label)
	}
	entry, err := normalizeSheetLabel(column.Entry, MaxScoreboardEntryLength)
	if err != nil {
		return column, invalidScoreboard("column %q entry name %s", label, err)
	}
	if entry == "" {
		return column, invalidScoreboard("column %q needs an entry name", label)
	}
	if !sheetFieldKeyPattern.MatchString(column.FieldKey) {
		return column, invalidScoreboard("column %q has a malformed field key", label)
	}

	out := ScoreboardColumn{
		ID:       column.ID,
		Label:    label,
		TabKey:   column.TabKey,
		Entry:    entry,
		FieldKey: column.FieldKey,
		Hidden:   column.Hidden,
	}

	switch column.Display {
	case "", ScoreboardDisplayValue:
	case ScoreboardDisplayValueMax, ScoreboardDisplayBands:
		out.Display = column.Display
	default:
		return column, invalidScoreboard("column %q has an unknown display", label)
	}

	if out.Display != ScoreboardDisplayBands {
		if len(column.Bands) > 0 || column.BandBasis != "" || strings.TrimSpace(column.FallbackLabel) != "" {
			return column, invalidScoreboard("column %q: ranges need the ranges display", label)
		}
		return out, nil
	}

	switch column.BandBasis {
	case "", ScoreboardBandBasisValue:
	case ScoreboardBandBasisPercent:
		out.BandBasis = ScoreboardBandBasisPercent
	default:
		return column, invalidScoreboard("column %q has an unknown range basis", label)
	}

	fallback, err := normalizeScoreboardBandLabel(column.FallbackLabel)
	if err != nil {
		return column, invalidScoreboard("column %q label for no match %s", label, err)
	}
	if fallback != "" && strings.TrimSpace(ScoreboardLabelText(fallback)) == "" {
		return column, invalidScoreboard("column %q label for no match has no text", label)
	}
	out.FallbackLabel = fallback

	if len(column.Bands) == 0 {
		return column, invalidScoreboard("column %q needs at least one range", label)
	}
	if len(column.Bands) > MaxScoreboardBands {
		return column, invalidScoreboard("column %q can have at most %d ranges", label, MaxScoreboardBands)
	}
	for i, band := range column.Bands {
		normalized, err := normalizeScoreboardBand(label, i, band)
		if err != nil {
			return column, err
		}
		out.Bands = append(out.Bands, normalized)
	}
	return out, nil
}

// The formatting a range label may carry: a colour wrapper, matched the way the
// renderer's applyColorMarkup matches it (one pass, a named colour, a closing
// tag), and the characters of inline markdown. Mirrored by scoreboardLabelText
// in frontend/src/lib/scoreboardEditing.ts; the two must agree, or the editor
// accepts a label the server refuses.
var (
	scoreboardColorMarkup  = regexp.MustCompile(`\[color:([a-z]+)\]((?s:.*?))\[/color\]`)
	scoreboardInlineMarkup = regexp.MustCompile("[*_~`]")
)

// ScoreboardLabelText is a range label without its formatting: roughly what a
// viewer reads. It is what the length limit counts, so markup is free while the
// cell stays narrow enough for a phone. A tag the renderer shows as text, such
// as an unknown colour, counts as text.
func ScoreboardLabelText(label string) string {
	unwrapped := scoreboardColorMarkup.ReplaceAllStringFunc(label, func(match string) string {
		parts := scoreboardColorMarkup.FindStringSubmatch(match)
		if !IsTextColor(parts[1]) {
			return match
		}
		return parts[2]
	})
	return scoreboardInlineMarkup.ReplaceAllString(unwrapped, "")
}

// normalizeScoreboardBandLabel trims a range label and checks both of its
// limits: the source as written, and the text a viewer sees.
func normalizeScoreboardBandLabel(value string) (string, error) {
	label, err := normalizeSheetLabel(value, MaxScoreboardBandLabelSourceLength)
	if err != nil {
		return "", err
	}
	if utf8.RuneCountInString(ScoreboardLabelText(label)) > MaxScoreboardLabelLength {
		return "", fmt.Errorf("must be %d characters or fewer, not counting formatting", MaxScoreboardLabelLength)
	}
	return label, nil
}

func normalizeScoreboardBand(columnLabel string, index int, band ScoreboardBand) (ScoreboardBand, error) {
	position := index + 1
	label, err := normalizeScoreboardBandLabel(band.Label)
	if err != nil {
		return band, invalidScoreboard("column %q range %d label %s", columnLabel, position, err)
	}
	if strings.TrimSpace(ScoreboardLabelText(label)) == "" {
		return band, invalidScoreboard("column %q range %d needs a label", columnLabel, position)
	}
	if band.Min == nil && band.Max == nil {
		return band, invalidScoreboard("column %q range %q needs a lower or upper bound", columnLabel, label)
	}
	if band.Min != nil && band.Max != nil {
		low, high := *band.Min, *band.Max
		if low > high || (low == high && (band.MinStrict || band.MaxStrict)) {
			return band, invalidScoreboard("column %q range %q can never match", columnLabel, label)
		}
	}

	out := ScoreboardBand{Label: label}
	// A strict flag means nothing without its bound, so it isn't kept.
	if band.Min != nil {
		low := *band.Min
		out.Min, out.MinStrict = &low, band.MinStrict
	}
	if band.Max != nil {
		high := *band.Max
		out.Max, out.MaxStrict = &high, band.MaxStrict
	}
	return out, nil
}

// ScoreboardNumericFields returns the number and track fields of a tab in the
// game's layout, keyed by field key, and whether the layout has the tab at all.
func ScoreboardNumericFields(sheet CharacterSheetConfig, tabKey string) (map[string]string, bool) {
	if sheet.Tabs == nil {
		fields, ok := defaultSheetNumericFields[tabKey]
		return fields, ok
	}
	for _, tab := range sheet.Tabs {
		if tab.Key != tabKey {
			continue
		}
		if tab.Fields == nil {
			return defaultSheetNumericFields[tabKey], true
		}
		fields := make(map[string]string, len(tab.Fields))
		for _, field := range tab.Fields {
			if field.Type == SheetFieldNumber || field.Type == SheetFieldTrack {
				fields[field.Key] = field.Type
			}
		}
		return fields, true
	}
	return nil, false
}

// ValidateScoreboardSources checks a validated config against the game's
// current sheet layout. It runs only on save: a tab removed later leaves a
// blank, flagged column rather than blocking the sheet edit.
func ValidateScoreboardSources(config ScoreboardConfig, sheet CharacterSheetConfig) error {
	for _, column := range config.Columns {
		fields, ok := ScoreboardNumericFields(sheet, column.TabKey)
		if !ok {
			return invalidScoreboard("column %q uses a tab this game's character sheet doesn't have", column.Label)
		}
		fieldType, ok := fields[column.FieldKey]
		if !ok {
			return invalidScoreboard("column %q must use a number or track field", column.Label)
		}
		if fieldType == SheetFieldTrack {
			continue
		}
		if column.Display == ScoreboardDisplayValueMax {
			return invalidScoreboard("column %q can't show a maximum: only track fields have one", column.Label)
		}
		if column.BandBasis == ScoreboardBandBasisPercent {
			return invalidScoreboard("column %q can't use percent ranges: only track fields have a maximum", column.Label)
		}
	}
	return nil
}

// UnmarshalScoreboardConfig parses a stored config, rejecting unknown keys for
// the same reason UnmarshalCharacterSheetConfig does. Empty input is a valid
// empty config: that is what every game's column starts as.
func UnmarshalScoreboardConfig(data []byte) (ScoreboardConfig, error) {
	var config ScoreboardConfig

	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || string(trimmed) == "null" {
		return config, nil
	}

	decoder := json.NewDecoder(bytes.NewReader(trimmed))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&config); err != nil {
		return ScoreboardConfig{}, fmt.Errorf("invalid stored scoreboard config: %w", err)
	}
	return config, nil
}

// MarshalScoreboardConfig renders a config for storage, through the typed
// struct so the column only ever holds what the type can express.
func MarshalScoreboardConfig(config ScoreboardConfig) ([]byte, error) {
	data, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal scoreboard config: %w", err)
	}
	return data, nil
}

// ScoreboardConfigForStored reads a stored games.scoreboard column. A malformed
// value reads as the empty config, which is staff-only with no columns: a bad
// row must hide the board, never open it.
func ScoreboardConfigForStored(stored []byte) ScoreboardConfig {
	config, err := UnmarshalScoreboardConfig(stored)
	if err != nil {
		return ScoreboardConfig{}
	}
	return config
}
