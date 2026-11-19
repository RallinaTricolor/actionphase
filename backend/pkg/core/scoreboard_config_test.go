package core

import (
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func floatPtr(v float64) *float64 { return &v }

func scoreColumn() ScoreboardColumn {
	return ScoreboardColumn{ID: "c_score1", Label: "Score", TabKey: "numbers", Entry: "Score", FieldKey: "amount"}
}

func bandedColumn(bands ...ScoreboardBand) ScoreboardColumn {
	column := scoreColumn()
	column.ID = "c_hp0001"
	column.Label = "HP"
	column.Entry = "HP"
	column.Display = ScoreboardDisplayBands
	column.Bands = bands
	return column
}

func TestValidateScoreboardConfig_Rejections(t *testing.T) {
	withColumn := func(edit func(*ScoreboardColumn)) ScoreboardConfig {
		column := scoreColumn()
		edit(&column)
		return ScoreboardConfig{Columns: []ScoreboardColumn{column}}
	}
	withBand := func(band ScoreboardBand) ScoreboardConfig {
		return ScoreboardConfig{Columns: []ScoreboardColumn{bandedColumn(band)}}
	}
	manyColumns := make([]ScoreboardColumn, MaxScoreboardColumns+1)
	for i := range manyColumns {
		manyColumns[i] = scoreColumn()
		manyColumns[i].ID = "c_00000" + string(rune('a'+i))
	}
	manyBands := make([]ScoreboardBand, MaxScoreboardBands+1)
	for i := range manyBands {
		manyBands[i] = ScoreboardBand{Label: "Band", Min: floatPtr(float64(i))}
	}

	tests := []struct {
		name    string
		config  ScoreboardConfig
		wantErr string
	}{
		{"unknown visibility", ScoreboardConfig{Visibility: "friends"}, "visibility"},
		{"too many columns", ScoreboardConfig{Columns: manyColumns}, "at most 10 columns"},
		{"malformed column ID", withColumn(func(c *ScoreboardColumn) { c.ID = "score" }), "malformed ID"},
		{"blank label", withColumn(func(c *ScoreboardColumn) { c.Label = "  " }), "needs a label"},
		{"long label", withColumn(func(c *ScoreboardColumn) { c.Label = strings.Repeat("x", 25) }), "24 characters"},
		{"bad tab key", withColumn(func(c *ScoreboardColumn) { c.TabKey = "bio" }), "unknown character sheet tab"},
		{"blank entry", withColumn(func(c *ScoreboardColumn) { c.Entry = " " }), "needs an entry name"},
		{"long entry", withColumn(func(c *ScoreboardColumn) { c.Entry = strings.Repeat("x", 41) }), "40 characters"},
		{"bad field key", withColumn(func(c *ScoreboardColumn) { c.FieldKey = "Not Valid" }), "malformed field key"},
		{"unknown display", withColumn(func(c *ScoreboardColumn) { c.Display = "bar" }), "unknown display"},
		{"bands without band display", withColumn(func(c *ScoreboardColumn) {
			c.Bands = []ScoreboardBand{{Label: "Low", Max: floatPtr(1)}}
		}), "ranges display"},
		{"fallback without band display", withColumn(func(c *ScoreboardColumn) { c.FallbackLabel = "?" }), "ranges display"},
		{"basis without band display", withColumn(func(c *ScoreboardColumn) { c.BandBasis = ScoreboardBandBasisPercent }), "ranges display"},
		{"band display without bands", ScoreboardConfig{Columns: []ScoreboardColumn{bandedColumn()}}, "at least one range"},
		{"too many bands", ScoreboardConfig{Columns: []ScoreboardColumn{bandedColumn(manyBands...)}}, "at most 10 ranges"},
		{"band without label", withBand(ScoreboardBand{Min: floatPtr(1)}), "needs a label"},
		{"band without bounds", withBand(ScoreboardBand{Label: "Any"}), "lower or upper bound"},
		{"band label with only formatting", withBand(ScoreboardBand{Label: "[color:red]**[/color]", Min: floatPtr(1)}), "needs a label"},
		{"band label with only formatting and a space", withBand(ScoreboardBand{Label: "** **", Min: floatPtr(1)}), "needs a label"},
		{"band label text too long", withBand(ScoreboardBand{
			Label: "[color:red]" + strings.Repeat("x", 25) + "[/color]", Min: floatPtr(1),
		}), "24 characters or fewer, not counting formatting"},
		{"band label source too long", withBand(ScoreboardBand{
			Label: strings.Repeat("**x**", 25), Min: floatPtr(1),
		}), "120 characters"},
		{"fallback with only formatting", ScoreboardConfig{Columns: []ScoreboardColumn{func() ScoreboardColumn {
			c := bandedColumn(ScoreboardBand{Label: "Low", Max: floatPtr(1)})
			c.FallbackLabel = "[color:gray][/color]"
			return c
		}()}}, "no text"},
		{"fallback text too long", ScoreboardConfig{Columns: []ScoreboardColumn{func() ScoreboardColumn {
			c := bandedColumn(ScoreboardBand{Label: "Low", Max: floatPtr(1)})
			c.FallbackLabel = "*" + strings.Repeat("x", 25) + "*"
			return c
		}()}}, "24 characters or fewer, not counting formatting"},
		{"band min above max", withBand(ScoreboardBand{Label: "X", Min: floatPtr(5), Max: floatPtr(1)}), "never match"},
		{"band empty strict point", withBand(ScoreboardBand{Label: "X", Min: floatPtr(5), Max: floatPtr(5), MaxStrict: true}), "never match"},
		{"too many sort keys", ScoreboardConfig{
			Columns: []ScoreboardColumn{scoreColumn()},
			Sort:    []ScoreboardSort{{"name", "asc"}, {"c_score1", "asc"}, {"name", "desc"}},
		}, "at most 2 keys"},
		{"sort key for a removed column", ScoreboardConfig{Sort: []ScoreboardSort{{"c_gone00", "asc"}}}, "not one of the columns"},
		{"duplicate sort key", ScoreboardConfig{Sort: []ScoreboardSort{{"name", "asc"}, {"name", "desc"}}}, "used twice"},
		{"bad direction", ScoreboardConfig{Sort: []ScoreboardSort{{"name", "up"}}}, "asc or desc"},
		{"negative top count", ScoreboardConfig{TopCount: -1}, "between 1 and 50"},
		{"top count over the limit", ScoreboardConfig{TopCount: MaxScoreboardTopCount + 1}, "between 1 and 50"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidateScoreboardConfig(tt.config)
			require.Error(t, err)
			assert.True(t, errors.Is(err, ErrInvalidScoreboardConfig))
			assert.Contains(t, err.Error(), tt.wantErr)
		})
	}

	t.Run("duplicate column ID", func(t *testing.T) {
		_, err := ValidateScoreboardConfig(ScoreboardConfig{Columns: []ScoreboardColumn{scoreColumn(), scoreColumn()}})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "more than once")
	})
}

func TestValidateScoreboardConfig_Normalizes(t *testing.T) {
	column := bandedColumn(ScoreboardBand{Label: " Low ", Max: floatPtr(5), MaxStrict: true, MinStrict: true})
	column.Label = "  HP "
	column.Entry = " Hit Points "
	column.BandBasis = ScoreboardBandBasisValue
	column.FallbackLabel = "   "
	plain := scoreColumn()
	plain.Display = ScoreboardDisplayValue

	got, err := ValidateScoreboardConfig(ScoreboardConfig{
		Visibility: ScoreboardVisibilityStaff,
		Columns:    []ScoreboardColumn{column, plain},
		Sort:       []ScoreboardSort{{"c_hp0001", "desc"}, {"name", "asc"}},
	})
	require.NoError(t, err)

	// Defaults are stored as absent keys, so each has one representation.
	assert.Empty(t, got.Visibility)
	assert.Empty(t, got.Columns[1].Display)
	assert.Empty(t, got.Columns[0].BandBasis)
	assert.Empty(t, got.Columns[0].FallbackLabel)

	assert.Equal(t, "HP", got.Columns[0].Label)
	assert.Equal(t, "Hit Points", got.Columns[0].Entry)
	assert.Equal(t, "Low", got.Columns[0].Bands[0].Label)
	assert.False(t, got.Columns[0].Bands[0].MinStrict, "a strict flag without its bound is dropped")
	assert.True(t, got.Columns[0].Bands[0].MaxStrict)
}

func TestValidateScoreboardConfig_TopCount(t *testing.T) {
	for _, count := range []int{1, 3, MaxScoreboardTopCount} {
		got, err := ValidateScoreboardConfig(ScoreboardConfig{TopCount: count})
		require.NoError(t, err)
		assert.Equal(t, count, got.TopCount)
	}

	// Zero is "every row", stored as an absent key.
	got, err := ValidateScoreboardConfig(ScoreboardConfig{})
	require.NoError(t, err)
	data, err := MarshalScoreboardConfig(got)
	require.NoError(t, err)
	assert.NotContains(t, string(data), "top_count")

	stored, err := UnmarshalScoreboardConfig([]byte(`{"top_count": 3}`))
	require.NoError(t, err)
	assert.Equal(t, 3, stored.TopCount)
}

func TestValidateScoreboardConfig_FormattedBandLabels(t *testing.T) {
	// 24 visible characters in each, well past 24 once the markup is counted.
	full := strings.Repeat("x", MaxScoreboardLabelLength)
	labels := []string{
		"[color:orange]**" + full + "**[/color]",
		"~~" + full + "~~",
		"_" + full + "_",
		"`" + full + "`",
	}
	for _, label := range labels {
		column := bandedColumn(ScoreboardBand{Label: label, Min: floatPtr(1)})
		column.FallbackLabel = "[color:gray]" + full + "[/color]"
		got, err := ValidateScoreboardConfig(ScoreboardConfig{Columns: []ScoreboardColumn{column}})
		require.NoError(t, err, label)
		assert.Equal(t, label, got.Columns[0].Bands[0].Label, "the markup is stored as written")
		assert.Equal(t, column.FallbackLabel, got.Columns[0].FallbackLabel)
	}

	// A column heading is plain text, so its markup counts.
	heading := scoreColumn()
	heading.Label = "**" + strings.Repeat("x", MaxScoreboardLabelLength-1) + "**"
	_, err := ValidateScoreboardConfig(ScoreboardConfig{Columns: []ScoreboardColumn{heading}})
	assert.ErrorContains(t, err, "24 characters")
}

func TestScoreboardLabelText(t *testing.T) {
	tests := map[string]string{
		"Healthy":                   "Healthy",
		"[color:red]Bloody[/color]": "Bloody",
		"**Down** _soon_":           "Down soon",
		"~~Gone~~ `x`":              "Gone x",
		"[color:red]A[/color] [color:blue]B[/color]": "A B",
		// What the renderer leaves as literal text counts as text: an unclosed
		// tag, a stray closing tag, and a colour it doesn't know.
		"[color:red]Bloody[/color":                      "[color:red]Bloody[/color",
		"Bloody[/color]":                                "Bloody[/color]",
		"[color:mauve]Odd[/color]":                      "[color:mauve]Odd[/color]",
		"[colour:red]Typo":                              "[colour:red]Typo",
		"[color:red]A\nB[/color]":                       "A\nB",
		"[color:crimson]A[/color] [color:red]B[/color]": "[color:crimson]A[/color] B",
	}
	for label, want := range tests {
		assert.Equal(t, want, ScoreboardLabelText(label), label)
	}
}

func TestValidateScoreboardConfig_UnknownColourCountsAsText(t *testing.T) {
	// 8 visible characters with a known colour; the renderer shows all 31 of an
	// unknown one, which is too wide for the cell.
	ok := bandedColumn(ScoreboardBand{Label: "[color:red]Bloodied[/color]", Min: floatPtr(1)})
	_, err := ValidateScoreboardConfig(ScoreboardConfig{Columns: []ScoreboardColumn{ok}})
	require.NoError(t, err)

	unknown := bandedColumn(ScoreboardBand{Label: "[color:crimson]Bloodied[/color]", Min: floatPtr(1)})
	_, err = ValidateScoreboardConfig(ScoreboardConfig{Columns: []ScoreboardColumn{unknown}})
	assert.ErrorIs(t, err, ErrInvalidScoreboardConfig)
	assert.ErrorContains(t, err, "24 characters or fewer, not counting formatting")
}

func TestValidateScoreboardConfig_AllowsTwoColumnsFromOneSource(t *testing.T) {
	visible := bandedColumn(ScoreboardBand{Label: "Low", Max: floatPtr(5)})
	raw := visible
	raw.ID, raw.Label, raw.Hidden, raw.Display, raw.Bands = "c_hpraw1", "Raw HP", true, "", nil

	_, err := ValidateScoreboardConfig(ScoreboardConfig{Columns: []ScoreboardColumn{visible, raw}})
	assert.NoError(t, err)
}

func TestValidateScoreboardConfig_PointBandAllowed(t *testing.T) {
	_, err := ValidateScoreboardConfig(ScoreboardConfig{Columns: []ScoreboardColumn{
		bandedColumn(ScoreboardBand{Label: "Exactly five", Min: floatPtr(5), Max: floatPtr(5)}),
	}})
	assert.NoError(t, err)
}

func TestScoreboardNumericFields(t *testing.T) {
	t.Run("default layout includes every built-in numeric field", func(t *testing.T) {
		fields, ok := ScoreboardNumericFields(CharacterSheetConfig{}, "numbers")
		require.True(t, ok)
		assert.Equal(t, map[string]string{"amount": SheetFieldTrack}, fields)

		fields, ok = ScoreboardNumericFields(CharacterSheetConfig{}, "inventory")
		require.True(t, ok)
		assert.Equal(t, map[string]string{"quantity": SheetFieldNumber, "value": SheetFieldNumber, "weight": SheetFieldNumber}, fields)

		fields, ok = ScoreboardNumericFields(CharacterSheetConfig{}, "skills")
		require.True(t, ok)
		assert.Empty(t, fields)
	})

	t.Run("custom tabs in the default layout don't exist", func(t *testing.T) {
		_, ok := ScoreboardNumericFields(CharacterSheetConfig{}, "t_abc123")
		assert.False(t, ok)
	})

	t.Run("explicit layout", func(t *testing.T) {
		sheet := CharacterSheetConfig{Tabs: []CharacterSheetTab{
			{Key: "numbers"},
			{Key: "t_abc123", Label: "Resources", Fields: []CharacterSheetField{
				{Key: "gold", Label: "Gold", Type: SheetFieldNumber},
				{Key: "stress", Label: "Stress", Type: SheetFieldTrack},
				{Key: "note", Label: "Note", Type: SheetFieldText},
			}},
		}}

		fields, ok := ScoreboardNumericFields(sheet, "t_abc123")
		require.True(t, ok)
		assert.Equal(t, map[string]string{"gold": SheetFieldNumber, "stress": SheetFieldTrack}, fields)

		fields, ok = ScoreboardNumericFields(sheet, "numbers")
		require.True(t, ok, "a built-in tab without fields keeps its default schema")
		assert.Contains(t, fields, "amount")

		_, ok = ScoreboardNumericFields(sheet, "inventory")
		assert.False(t, ok, "a default tab the GM removed is gone")
	})
}

func TestValidateScoreboardSources(t *testing.T) {
	sheet := CharacterSheetConfig{Tabs: []CharacterSheetTab{
		{Key: "numbers"},
		{Key: "t_abc123", Label: "Resources", Fields: []CharacterSheetField{
			{Key: "gold", Label: "Gold", Type: SheetFieldNumber},
			{Key: "note", Label: "Note", Type: SheetFieldText},
		}},
	}}
	gold := ScoreboardColumn{ID: "c_gold01", Label: "Gold", TabKey: "t_abc123", Entry: "Purse", FieldKey: "gold"}

	tests := []struct {
		name    string
		edit    func(*ScoreboardColumn)
		wantErr string
	}{
		{"number field", func(*ScoreboardColumn) {}, ""},
		{"track field with max", func(c *ScoreboardColumn) {
			c.TabKey, c.FieldKey, c.Display = "numbers", "amount", ScoreboardDisplayValueMax
		}, ""},
		{"track field with percent bands", func(c *ScoreboardColumn) {
			c.TabKey, c.FieldKey, c.Display, c.BandBasis = "numbers", "amount", ScoreboardDisplayBands, ScoreboardBandBasisPercent
		}, ""},
		{"tab not in layout", func(c *ScoreboardColumn) { c.TabKey = "inventory" }, "doesn't have"},
		{"text field", func(c *ScoreboardColumn) { c.FieldKey = "note" }, "number or track"},
		{"unknown field", func(c *ScoreboardColumn) { c.FieldKey = "nope" }, "number or track"},
		{"max on a number", func(c *ScoreboardColumn) { c.Display = ScoreboardDisplayValueMax }, "only track fields"},
		{"percent on a number", func(c *ScoreboardColumn) {
			c.Display, c.BandBasis = ScoreboardDisplayBands, ScoreboardBandBasisPercent
		}, "only track fields"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			column := gold
			tt.edit(&column)
			err := ValidateScoreboardSources(ScoreboardConfig{Columns: []ScoreboardColumn{column}}, sheet)
			if tt.wantErr == "" {
				assert.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.True(t, errors.Is(err, ErrInvalidScoreboardConfig))
			assert.Contains(t, err.Error(), tt.wantErr)
			assert.Contains(t, UserMessage(err, ErrInvalidScoreboardConfig), `Column "Gold"`)
		})
	}
}

func TestScoreboardConfigStorage(t *testing.T) {
	t.Run("round trips", func(t *testing.T) {
		config, err := ValidateScoreboardConfig(ScoreboardConfig{
			Visibility: ScoreboardVisibilityPublic,
			Columns:    []ScoreboardColumn{bandedColumn(ScoreboardBand{Label: "Down", Max: floatPtr(0)})},
			Sort:       []ScoreboardSort{{"c_hp0001", "desc"}},
		})
		require.NoError(t, err)
		data, err := MarshalScoreboardConfig(config)
		require.NoError(t, err)
		got, err := UnmarshalScoreboardConfig(data)
		require.NoError(t, err)
		assert.Equal(t, config, got)
	})

	t.Run("an empty config stores as an empty object", func(t *testing.T) {
		config, err := ValidateScoreboardConfig(ScoreboardConfig{Visibility: ScoreboardVisibilityStaff})
		require.NoError(t, err)
		data, err := MarshalScoreboardConfig(config)
		require.NoError(t, err)
		assert.JSONEq(t, `{}`, string(data))
	})

	t.Run("unknown keys are rejected at every level", func(t *testing.T) {
		for _, stored := range []string{
			`{"nope":1}`,
			`{"columns":[{"id":"c_score1","nope":1}]}`,
			`{"columns":[{"bands":[{"nope":1}]}]}`,
		} {
			_, err := UnmarshalScoreboardConfig([]byte(stored))
			assert.Error(t, err, stored)
		}
	})

	t.Run("a malformed stored value fails closed", func(t *testing.T) {
		config := ScoreboardConfigForStored([]byte(`{"visibility":"public","nope":1}`))
		assert.Equal(t, ScoreboardVisibilityStaff, config.ResolvedVisibility())
		assert.Empty(t, config.Columns)
	})

	t.Run("resolved visibility", func(t *testing.T) {
		assert.Equal(t, ScoreboardVisibilityStaff, ScoreboardConfig{}.ResolvedVisibility())
		assert.Equal(t, ScoreboardVisibilityPublic, ScoreboardConfig{Visibility: "public"}.ResolvedVisibility())
	})
}
