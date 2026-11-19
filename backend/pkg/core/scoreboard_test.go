package core

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func scoreboardPC(id int32, name string) ScoreboardCharacter {
	return ScoreboardCharacter{ID: id, Name: name, CharacterType: "player_character", Status: "approved", IsActive: true}
}

// numbersTab stores one track entry per name, the shape the sheet editor writes.
func numbersTab(values map[string]float64) map[string]string {
	entries := []map[string]any{}
	for name, value := range values {
		entries = append(entries, map[string]any{"id": "e_" + name, "name": name, "amount": map[string]any{"value": value}})
	}
	data, _ := json.Marshal(entries)
	return map[string]string{"numbers": string(data)}
}

func rowNames(result *ScoreboardResult) []string {
	names := []string{}
	for _, row := range result.Rows {
		names = append(names, row.CharacterName)
	}
	return names
}

func columnIDs(result *ScoreboardResult) []string {
	ids := []string{}
	for _, column := range result.Columns {
		ids = append(ids, column.ID)
	}
	return ids
}

// boardB is the plan's semi-public example: a hidden Score, sorted by it.
func boardB(view ScoreboardView) ScoreboardInput {
	hidden := scoreColumn()
	hidden.Hidden = true
	return ScoreboardInput{
		GameState: GameStateInProgress,
		Config: ScoreboardConfig{
			Visibility: ScoreboardVisibilityPublic,
			Columns:    []ScoreboardColumn{hidden},
			Sort:       []ScoreboardSort{{"c_score1", ScoreboardSortDesc}, {ScoreboardSortName, ScoreboardSortAsc}},
		},
		Characters: []ScoreboardCharacter{
			scoreboardPC(1, "Ash"), scoreboardPC(2, "Bea"), scoreboardPC(3, "Cy"), scoreboardPC(4, "Dee"),
		},
		TabData: map[int32]map[string]string{
			1: numbersTab(map[string]float64{"Score": 5}),
			2: numbersTab(map[string]float64{"Score": 9}),
			3: numbersTab(map[string]float64{"Score": 5}),
			// Dee has no Score entry.
		},
		View: view,
	}
}

func TestScoreboardViewFor(t *testing.T) {
	const (
		none   = ScoreboardNone
		player = ScoreboardPlayer
		full   = ScoreboardFull
	)
	running := []string{GameStateInProgress, GameStatePaused, GameStateCancelled}
	archived := []string{GameStateEpilogue, GameStateCompleted}

	type viewer struct {
		name        string
		role        string
		isGM, admin bool
	}
	gmLike := []viewer{
		{"gm", "gm", true, false},
		{"co-gm by role", "co_gm", false, false},
		{"admin mode", "player", false, true},
		{"audience", "audience", false, false},
	}
	players := []viewer{{"player", "player", false, false}, {"outsider", "", false, false}}

	check := func(states []string, viewers []viewer, enabled bool, visibility string, want ScoreboardView) {
		t.Helper()
		for _, state := range states {
			for _, v := range viewers {
				name := fmt.Sprintf("%s/%s/enabled=%v/%s", state, v.name, enabled, visibility)
				t.Run(name, func(t *testing.T) {
					assert.Equal(t, want, ScoreboardViewFor(state, enabled, visibility, v.role, v.isGM, v.admin))
				})
			}
		}
	}

	everyone := append(append([]viewer{}, gmLike...), players...)
	allStates := append(append([]string{}, running...), archived...)
	for _, visibility := range []string{ScoreboardVisibilityStaff, ScoreboardVisibilityPublic} {
		check(allStates, everyone, false, visibility, none)
		check(running, gmLike, true, visibility, full)
		check(archived, everyone, true, visibility, full)
	}
	check(running, players, true, ScoreboardVisibilityStaff, none)
	check(running, players, true, ScoreboardVisibilityPublic, player)
}

func TestBuildScoreboard_NoneReturnsNothing(t *testing.T) {
	assert.Nil(t, BuildScoreboard(boardB(ScoreboardNone)))
}

func TestBuildScoreboard_ReadsValueShapes(t *testing.T) {
	sheet := CharacterSheetConfig{Tabs: []CharacterSheetTab{
		{Key: "numbers"},
		{Key: "t_abc123", Label: "Resources", Fields: []CharacterSheetField{
			{Key: "gold", Label: "Gold", Type: SheetFieldNumber},
			{Key: "stress", Label: "Stress", Type: SheetFieldTrack},
		}},
	}}
	numbers := ScoreboardColumn{ID: "c_cell01", Label: "X", TabKey: "numbers", Entry: "Score", FieldKey: "amount", Display: ScoreboardDisplayValueMax}
	gold := ScoreboardColumn{ID: "c_cell01", Label: "X", TabKey: "t_abc123", Entry: "Score", FieldKey: "gold"}
	stress := ScoreboardColumn{ID: "c_cell01", Label: "X", TabKey: "t_abc123", Entry: "Score", FieldKey: "stress", Display: ScoreboardDisplayValueMax}

	tests := []struct {
		name    string
		column  ScoreboardColumn
		stored  string
		want    *float64
		wantMax *float64
	}{
		{"number field", gold, `[{"name":"Score","gold":7}]`, floatPtr(7), nil},
		{"zero is a value", gold, `[{"name":"Score","gold":0}]`, floatPtr(0), nil},
		{"negative number", gold, `[{"name":"Score","gold":-2.5}]`, floatPtr(-2.5), nil},
		{"number stored as text by a loot roll", gold, `[{"name":"Score","gold":" 3 "}]`, floatPtr(3), nil},
		{"non-numeric text", gold, `[{"name":"Score","gold":"lots"}]`, nil, nil},
		{"infinite text is blank", gold, `[{"name":"Score","gold":"Infinity"}]`, nil, nil},
		{"null", gold, `[{"name":"Score","gold":null}]`, nil, nil},
		{"object in a number field", gold, `[{"name":"Score","gold":{"value":1}}]`, nil, nil},
		{"track with max", stress, `[{"name":"Score","stress":{"value":4,"max":9}}]`, floatPtr(4), floatPtr(9)},
		{"track without max", stress, `[{"name":"Score","stress":{"value":4}}]`, floatPtr(4), nil},
		{"track with only a max counts as zero", stress, `[{"name":"Score","stress":{"max":9}}]`, floatPtr(0), floatPtr(9)},
		{"track max of zero is no max", stress, `[{"name":"Score","stress":{"value":4,"max":0}}]`, floatPtr(4), nil},
		{"empty track", stress, `[{"name":"Score","stress":{}}]`, nil, nil},
		{"bare number in a custom track", stress, `[{"name":"Score","stress":4}]`, nil, nil},
		{"current Numbers track", numbers, `[{"name":"Score","amount":{"value":7,"max":12}}]`, floatPtr(7), floatPtr(12)},
		{"legacy bare amount", numbers, `[{"name":"Score","amount":7}]`, floatPtr(7), nil},
		{"legacy amount with flat max", numbers, `[{"name":"Score","amount":7,"max":12}]`, floatPtr(7), floatPtr(12)},
		{"legacy flat max alone", numbers, `[{"name":"Score","max":12}]`, floatPtr(0), floatPtr(12)},
		{"legacy name in type", numbers, `[{"type":"Score","amount":7}]`, floatPtr(7), nil},
		{"name matched trimmed and case-insensitively", gold, `[{"name":"  sCoRe ","gold":1}]`, floatPtr(1), nil},
		{"first entry of a name wins", gold, `[{"name":"Score","gold":1},{"name":"score","gold":2}]`, floatPtr(1), nil},
		{"unusable first match stays blank", gold, `[{"name":"Score","gold":"x"},{"name":"Score","gold":2}]`, nil, nil},
		{"no such entry", gold, `[{"name":"Other","gold":1}]`, nil, nil},
		{"malformed entry is skipped", gold, `[7,{"name":"Score","gold":1}]`, floatPtr(1), nil},
		{"malformed row", gold, `not json`, nil, nil},
		{"no row", gold, ``, nil, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := BuildScoreboard(ScoreboardInput{
				Config:     ScoreboardConfig{Columns: []ScoreboardColumn{tt.column}},
				Sheet:      sheet,
				Characters: []ScoreboardCharacter{scoreboardPC(1, "Ash")},
				TabData:    map[int32]map[string]string{1: {tt.column.TabKey: tt.stored}},
				View:       ScoreboardFull,
			})
			cell, ok := result.Rows[0].Values["c_cell01"]
			if tt.want == nil {
				assert.False(t, ok, "expected a blank cell, got %+v", cell)
				return
			}
			require.True(t, ok)
			assert.Equal(t, tt.want, cell.Value)
			assert.Equal(t, tt.wantMax, cell.Max)
		})
	}
}

func TestBuildScoreboard_Rows(t *testing.T) {
	in := boardB(ScoreboardFull)
	pending := scoreboardPC(5, "Pending")
	pending.Status = "pending"
	inactive := scoreboardPC(6, "Inactive")
	inactive.IsActive = false
	npc := scoreboardPC(7, "Npc")
	npc.CharacterType = "npc"
	in.Characters = append(in.Characters, pending, inactive, npc)

	assert.Equal(t, []string{"Bea", "Ash", "Cy", "Dee"}, rowNames(BuildScoreboard(in)))
}

func TestBuildScoreboard_Sorting(t *testing.T) {
	second := scoreColumn()
	second.ID, second.Label, second.Entry = "c_hp0001", "HP", "HP"

	build := func(sort []ScoreboardSort, characters []ScoreboardCharacter, tabs map[int32]map[string]string) []string {
		return rowNames(BuildScoreboard(ScoreboardInput{
			Config:     ScoreboardConfig{Columns: []ScoreboardColumn{scoreColumn(), second}, Sort: sort},
			Characters: characters,
			TabData:    tabs,
			View:       ScoreboardFull,
		}))
	}
	cast := []ScoreboardCharacter{scoreboardPC(1, "cy"), scoreboardPC(2, "Ash"), scoreboardPC(3, "Bea")}
	tabs := map[int32]map[string]string{
		1: numbersTab(map[string]float64{"Score": 5, "HP": 1}),
		2: numbersTab(map[string]float64{"Score": 5, "HP": 2}),
		// Bea has neither entry.
	}

	t.Run("no sort means name, ignoring case", func(t *testing.T) {
		assert.Equal(t, []string{"Ash", "Bea", "cy"}, build(nil, cast, tabs))
	})
	t.Run("name descending", func(t *testing.T) {
		assert.Equal(t, []string{"cy", "Bea", "Ash"}, build([]ScoreboardSort{{"name", "desc"}}, cast, tabs))
	})
	t.Run("blanks go last ascending", func(t *testing.T) {
		assert.Equal(t, []string{"cy", "Ash", "Bea"}, build([]ScoreboardSort{{"c_hp0001", "asc"}}, cast, tabs))
	})
	t.Run("blanks go last descending", func(t *testing.T) {
		assert.Equal(t, []string{"Ash", "cy", "Bea"}, build([]ScoreboardSort{{"c_hp0001", "desc"}}, cast, tabs))
	})
	t.Run("secondary key breaks a tie", func(t *testing.T) {
		assert.Equal(t, []string{"Ash", "cy", "Bea"},
			build([]ScoreboardSort{{"c_score1", "desc"}, {"c_hp0001", "desc"}}, cast, tabs))
	})
	t.Run("name breaks a remaining tie", func(t *testing.T) {
		assert.Equal(t, []string{"Ash", "cy", "Bea"}, build([]ScoreboardSort{{"c_score1", "desc"}}, cast, tabs))
	})
	t.Run("ID breaks a tie on name", func(t *testing.T) {
		twins := []ScoreboardCharacter{scoreboardPC(9, "Twin"), scoreboardPC(3, "twin")}
		result := BuildScoreboard(ScoreboardInput{Characters: twins, View: ScoreboardFull})
		assert.Equal(t, int32(3), result.Rows[0].CharacterID)
	})
	t.Run("a broken sort column falls through to name", func(t *testing.T) {
		broken := scoreColumn()
		broken.TabKey = "t_gone00"
		result := BuildScoreboard(ScoreboardInput{
			Config:     ScoreboardConfig{Columns: []ScoreboardColumn{broken}, Sort: []ScoreboardSort{{"c_score1", "desc"}}},
			Characters: cast,
			View:       ScoreboardFull,
		})
		assert.Equal(t, []string{"Ash", "Bea", "cy"}, rowNames(result))
	})
}

func TestBuildScoreboard_PlayerViewOfHiddenColumn(t *testing.T) {
	full := BuildScoreboard(boardB(ScoreboardFull))
	player := BuildScoreboard(boardB(ScoreboardPlayer))

	assert.Equal(t, []string{"Bea", "Ash", "Cy", "Dee"}, rowNames(full))
	assert.Equal(t, rowNames(full), rowNames(player), "players get the real order")

	assert.True(t, full.FullView)
	assert.True(t, full.Columns[0].Hidden)
	assert.NotEmpty(t, full.Rows[0].Values)
	assert.Len(t, full.SortDescription, 2)

	assert.False(t, player.FullView)
	assert.Empty(t, player.Columns)
	assert.Empty(t, player.SortDescription, "naming only the tiebreak would claim the board is sorted by name")
	for _, row := range player.Rows {
		assert.Empty(t, row.Values)
	}

	// Absence on the wire, which is the actual guarantee.
	data, err := json.Marshal(player)
	require.NoError(t, err)
	for _, secret := range []string{"c_score1", "Score", `"value"`, "hidden"} {
		assert.NotContains(t, string(data), secret)
	}
}

func TestBuildScoreboard_TopCount(t *testing.T) {
	// Board B in score order: Bea 9, Ash 5, Cy 5, Dee blank.
	withTop := func(view ScoreboardView, count int) *ScoreboardResult {
		in := boardB(view)
		in.Config.TopCount = count
		return BuildScoreboard(in)
	}

	t.Run("players get exactly the top rows, even when the cut splits a tie", func(t *testing.T) {
		player := withTop(ScoreboardPlayer, 2)
		// Ash and Cy tie on the hidden Score; name puts Ash above the cut.
		// Widening the cut to keep Cy would tell players they were tied.
		assert.Equal(t, []string{"Bea", "Ash"}, rowNames(player))
		assert.Equal(t, 2, player.TopCount)

		data, err := json.Marshal(player)
		require.NoError(t, err)
		for _, cut := range []string{"Cy", "Dee"} {
			assert.NotContains(t, string(data), cut, "rows below the cut never leave the server")
		}
	})

	t.Run("the GM, co-GMs and audience see every row", func(t *testing.T) {
		full := withTop(ScoreboardFull, 2)
		assert.Equal(t, []string{"Bea", "Ash", "Cy", "Dee"}, rowNames(full))
		assert.Zero(t, full.TopCount)
	})

	t.Run("a cut that removes nothing isn't reported", func(t *testing.T) {
		for _, count := range []int{4, 10} {
			player := withTop(ScoreboardPlayer, count)
			assert.Len(t, player.Rows, 4)
			assert.Zero(t, player.TopCount, "a whole board shouldn't say it's the top %d", count)
		}
	})

	t.Run("an archive shows every row", func(t *testing.T) {
		in := boardB(ScoreboardViewFor(GameStateEpilogue, true, ScoreboardVisibilityPublic, "player", false, false))
		in.GameState = GameStateEpilogue
		in.Config.TopCount = 1
		archived := BuildScoreboard(in)
		assert.Len(t, archived.Rows, 4)
		assert.Zero(t, archived.TopCount)
	})
}

func TestBuildScoreboard_SortDescription(t *testing.T) {
	hidden := scoreColumn()
	hidden.ID, hidden.Label, hidden.Hidden = "c_hide01", "Secret", true
	config := func(sort ...ScoreboardSort) ScoreboardConfig {
		return ScoreboardConfig{Columns: []ScoreboardColumn{scoreColumn(), hidden}, Sort: sort}
	}
	describe := func(view ScoreboardView, config ScoreboardConfig) []ScoreboardSortDescription {
		return BuildScoreboard(ScoreboardInput{Config: config, View: view}).SortDescription
	}

	assert.Equal(t, []ScoreboardSortDescription{{"Name", "asc"}}, describe(ScoreboardPlayer, config()),
		"the default sort is not a secret")
	assert.Equal(t, []ScoreboardSortDescription{{"Score", "desc"}},
		describe(ScoreboardPlayer, config(ScoreboardSort{"c_score1", "desc"}, ScoreboardSort{"c_hide01", "asc"})))
	assert.Empty(t, describe(ScoreboardPlayer, config(ScoreboardSort{"c_hide01", "asc"}, ScoreboardSort{"c_score1", "desc"})))
	assert.Equal(t, []ScoreboardSortDescription{{"Secret", "asc"}, {"Score", "desc"}},
		describe(ScoreboardFull, config(ScoreboardSort{"c_hide01", "asc"}, ScoreboardSort{"c_score1", "desc"})))
}

func TestBuildScoreboard_ArchiveShowsHiddenColumns(t *testing.T) {
	in := boardB(ScoreboardViewFor(GameStateCompleted, true, ScoreboardVisibilityStaff, "player", false, false))
	in.GameState = GameStateCompleted

	result := BuildScoreboard(in)
	assert.True(t, result.FullView)
	assert.Equal(t, []string{"c_score1"}, columnIDs(result))
	assert.False(t, result.Columns[0].Hidden, "nothing is hidden from players any more")
	assert.Equal(t, floatPtr(9), result.Rows[0].Values["c_score1"].Value)
}

func TestBuildScoreboard_BrokenColumns(t *testing.T) {
	broken := scoreColumn()
	broken.TabKey = "t_gone00"
	in := ScoreboardInput{
		Config:     ScoreboardConfig{Columns: []ScoreboardColumn{broken}},
		Characters: []ScoreboardCharacter{scoreboardPC(1, "Ash")},
		TabData:    map[int32]map[string]string{1: {"t_gone00": `[{"name":"Score","amount":{"value":3}}]`}},
		View:       ScoreboardFull,
	}

	full := BuildScoreboard(in)
	assert.Equal(t, []string{"c_score1"}, full.BrokenColumnIDs)
	assert.Empty(t, full.Rows[0].Values, "data left behind by a removed tab stays hidden")

	in.View = ScoreboardPlayer
	player := BuildScoreboard(in)
	assert.Empty(t, player.BrokenColumnIDs)
	assert.Equal(t, []string{"c_score1"}, columnIDs(player))
}

func TestBuildScoreboard_ValueDisplays(t *testing.T) {
	stored := `[{"name":"Score","amount":{"value":7,"max":12}}]`
	build := func(display string, view ScoreboardView) ScoreboardCell {
		column := scoreColumn()
		column.Display = display
		result := BuildScoreboard(ScoreboardInput{
			Config:     ScoreboardConfig{Columns: []ScoreboardColumn{column}},
			Characters: []ScoreboardCharacter{scoreboardPC(1, "Ash")},
			TabData:    map[int32]map[string]string{1: {"numbers": stored}},
			View:       view,
		})
		assert.NotEmpty(t, result.Columns[0].Display)
		return result.Rows[0].Values["c_score1"]
	}

	for _, view := range []ScoreboardView{ScoreboardPlayer, ScoreboardFull} {
		assert.Equal(t, ScoreboardCell{Value: floatPtr(7)}, build("", view), "value alone never sends the max")
		assert.Equal(t, ScoreboardCell{Value: floatPtr(7), Max: floatPtr(12)}, build(ScoreboardDisplayValueMax, view))
	}
}

func hpBands() []ScoreboardBand {
	return []ScoreboardBand{
		{Label: "Healthy", Min: floatPtr(10)},
		{Label: "Bloodied", Min: floatPtr(5), MinStrict: true, Max: floatPtr(10), MaxStrict: true},
		{Label: "Critical", Min: floatPtr(0), MinStrict: true, Max: floatPtr(5)},
		{Label: "Down", Max: floatPtr(0)},
	}
}

func TestBuildScoreboard_Bands(t *testing.T) {
	label := func(column ScoreboardColumn, stored string) (ScoreboardCell, bool) {
		result := BuildScoreboard(ScoreboardInput{
			Config:     ScoreboardConfig{Columns: []ScoreboardColumn{column}},
			Characters: []ScoreboardCharacter{scoreboardPC(1, "Ash")},
			TabData:    map[int32]map[string]string{1: {"numbers": stored}},
			View:       ScoreboardPlayer,
		})
		cell, ok := result.Rows[0].Values[column.ID]
		return cell, ok
	}
	track := func(value, max float64) string {
		return fmt.Sprintf(`[{"name":"HP","amount":{"value":%v,"max":%v}}]`, value, max)
	}

	t.Run("boundaries", func(t *testing.T) {
		column := bandedColumn(hpBands()...)
		for value, want := range map[float64]string{
			11: "Healthy", 10: "Healthy", 9.5: "Bloodied", 5.5: "Bloodied",
			5: "Critical", 0.5: "Critical", 0: "Down", -3: "Down",
		} {
			cell, ok := label(column, track(value, 20))
			require.True(t, ok, "value %v", value)
			assert.Equal(t, want, cell.Label, "value %v", value)
		}
	})

	t.Run("a player's cell has the label and no numbers", func(t *testing.T) {
		cell, _ := label(bandedColumn(hpBands()...), track(7, 12))
		assert.Equal(t, ScoreboardCell{Label: "Bloodied"}, cell)
		data, err := json.Marshal(cell)
		require.NoError(t, err)
		assert.JSONEq(t, `{"label":"Bloodied"}`, string(data))
	})

	t.Run("the GM's cell has label and numbers", func(t *testing.T) {
		column := bandedColumn(hpBands()...)
		result := BuildScoreboard(ScoreboardInput{
			Config:     ScoreboardConfig{Columns: []ScoreboardColumn{column}},
			Characters: []ScoreboardCharacter{scoreboardPC(1, "Ash")},
			TabData:    map[int32]map[string]string{1: {"numbers": track(7, 12)}},
			View:       ScoreboardFull,
		})
		assert.Equal(t, ScoreboardCell{Value: floatPtr(7), Max: floatPtr(12), Label: "Bloodied"}, result.Rows[0].Values[column.ID])
	})

	t.Run("first match wins on overlap", func(t *testing.T) {
		column := bandedColumn(
			ScoreboardBand{Label: "First", Min: floatPtr(0)},
			ScoreboardBand{Label: "Second", Min: floatPtr(5)},
		)
		cell, _ := label(column, track(7, 12))
		assert.Equal(t, "First", cell.Label)
	})

	t.Run("no match uses the fallback", func(t *testing.T) {
		column := bandedColumn(ScoreboardBand{Label: "High", Min: floatPtr(100)})
		column.FallbackLabel = "Unknown"
		cell, _ := label(column, track(7, 12))
		assert.Equal(t, ScoreboardCell{Label: "Unknown"}, cell)
	})

	t.Run("no match without a fallback is blank, never the number", func(t *testing.T) {
		_, ok := label(bandedColumn(ScoreboardBand{Label: "High", Min: floatPtr(100)}), track(7, 12))
		assert.False(t, ok)
	})

	t.Run("a missing entry is blank, not a band", func(t *testing.T) {
		column := bandedColumn(ScoreboardBand{Label: "Any", Min: floatPtr(-1000)})
		column.FallbackLabel = "Unknown"
		_, ok := label(column, `[{"name":"Other","amount":{"value":1}}]`)
		assert.False(t, ok)
	})

	t.Run("percent of the character's own max", func(t *testing.T) {
		column := bandedColumn(
			ScoreboardBand{Label: "Bloodied", Max: floatPtr(50), MaxStrict: true},
			ScoreboardBand{Label: "Fine", Min: floatPtr(50)},
		)
		column.BandBasis = ScoreboardBandBasisPercent
		column.FallbackLabel = "Unknown"

		cell, _ := label(column, track(4, 10))
		assert.Equal(t, "Bloodied", cell.Label)
		cell, _ = label(column, track(4, 8))
		assert.Equal(t, "Fine", cell.Label, "exactly half is not below half")

		cell, _ = label(column, `[{"name":"HP","amount":{"value":4}}]`)
		assert.Equal(t, "Unknown", cell.Label, "no max means no percentage")
	})

	t.Run("sorting by a banded column uses the raw value", func(t *testing.T) {
		column := bandedColumn(ScoreboardBand{Label: "Same", Min: floatPtr(0)})
		result := BuildScoreboard(ScoreboardInput{
			Config:     ScoreboardConfig{Columns: []ScoreboardColumn{column}, Sort: []ScoreboardSort{{column.ID, "desc"}}},
			Characters: []ScoreboardCharacter{scoreboardPC(1, "Ash"), scoreboardPC(2, "Bea")},
			TabData: map[int32]map[string]string{
				1: {"numbers": track(3, 12)},
				2: {"numbers": track(8, 12)},
			},
			View: ScoreboardPlayer,
		})
		assert.Equal(t, []string{"Bea", "Ash"}, rowNames(result))
	})
}

func TestBuildScoreboard_EmptyBoardEncodesAsLists(t *testing.T) {
	data, err := json.Marshal(BuildScoreboard(ScoreboardInput{View: ScoreboardPlayer}))
	require.NoError(t, err)
	assert.JSONEq(t, `{"columns":[],"sort_description":[{"label":"Name","direction":"asc"}],"full_view":false,"rows":[]}`, string(data))
}

func TestScoreboardEntryNames(t *testing.T) {
	sheet := CharacterSheetConfig{Tabs: []CharacterSheetTab{
		{Key: "skills"},
		{Key: "numbers"},
		{Key: "t_abc123", Label: "Notes", Fields: []CharacterSheetField{{Key: "note", Label: "Note", Type: SheetFieldText}}},
	}}
	npc := scoreboardPC(3, "Npc")
	npc.CharacterType = "npc"

	got := ScoreboardEntryNames(sheet, []ScoreboardCharacter{scoreboardPC(1, "Ash"), scoreboardPC(2, "Bea"), npc}, map[int32]map[string]string{
		1: {"numbers": `[{"name":" Score "},{"name":"HP"},{"type":"Legacy"}]`, "skills": `[{"name":"Stealth"}]`},
		2: {"numbers": `[{"name":"score"},{"name":"  "}]`},
		3: {"numbers": `[{"name":"Npc Only"}]`},
	})

	assert.Equal(t, []ScoreboardTabEntryNames{
		{TabKey: "numbers", EntryNames: []string{"HP", "Legacy", "Score"}},
	}, got, "only tabs with a numeric field, only player characters, one spelling per name")
}
