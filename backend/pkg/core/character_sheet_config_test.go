package core

import (
	"fmt"
	"strings"
	"testing"
)

func TestUnmarshalCharacterSheetConfig(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		wantErr   bool
		errSubstr string
		check     func(t *testing.T, got CharacterSheetConfig)
	}{
		{
			// Every game that predates the feature holds exactly this.
			name:  "empty object is a valid empty config",
			input: `{}`,
			check: func(t *testing.T, got CharacterSheetConfig) {
				if got.Labels != nil {
					t.Errorf("expected nil Labels, got %+v", got.Labels)
				}
			},
		},
		{
			name:  "empty input is a valid empty config",
			input: ``,
			check: func(t *testing.T, got CharacterSheetConfig) {
				if got.Labels != nil {
					t.Errorf("expected nil Labels, got %+v", got.Labels)
				}
			},
		},
		{
			name:  "null is a valid empty config",
			input: `null`,
			check: func(t *testing.T, got CharacterSheetConfig) {
				if got.Labels != nil {
					t.Errorf("expected nil Labels, got %+v", got.Labels)
				}
			},
		},
		{
			name:  "labels parse",
			input: `{"labels":{"skills":"Approaches","numbers":"Resources"}}`,
			check: func(t *testing.T, got CharacterSheetConfig) {
				if got.Labels == nil {
					t.Fatal("expected Labels to be set")
				}
				if got.Labels.Skills != "Approaches" {
					t.Errorf("skills = %q, want %q", got.Labels.Skills, "Approaches")
				}
				if got.Labels.Numbers != "Resources" {
					t.Errorf("numbers = %q, want %q", got.Labels.Numbers, "Resources")
				}
				// Unset override stays empty rather than picking up a default —
				// defaults are the frontend's job.
				if got.Labels.Inventory != "" {
					t.Errorf("inventory = %q, want empty", got.Labels.Inventory)
				}
			},
		},
		{
			// The case that matters: this is what stops the blob accumulating
			// junk before the tab-composition feature defines a real schema.
			name:      "unknown top-level key is rejected",
			input:     `{"labels":{},"tabs":["skills"]}`,
			wantErr:   true,
			errSubstr: "tabs",
		},
		{
			name:      "unknown nested key is rejected",
			input:     `{"labels":{"abilities":"Powers"}}`,
			wantErr:   true,
			errSubstr: "abilities",
		},
		{
			name:    "malformed json is rejected",
			input:   `{"labels":`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := UnmarshalCharacterSheetConfig([]byte(tt.input))
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected an error, got config %+v", got)
				}
				if tt.errSubstr != "" && !strings.Contains(err.Error(), tt.errSubstr) {
					t.Errorf("error %q does not mention %q", err, tt.errSubstr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.check != nil {
				tt.check(t, got)
			}
		})
	}
}

func TestValidateCharacterSheetConfig(t *testing.T) {
	labels := func(skills, inventory, numbers string) CharacterSheetConfig {
		return CharacterSheetConfig{Labels: &CharacterSheetLabels{
			Skills: skills, Inventory: inventory, Numbers: numbers,
		}}
	}

	t.Run("trims surrounding whitespace", func(t *testing.T) {
		got, err := ValidateCharacterSheetConfig(labels("  Approaches  ", "", ""))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Labels.Skills != "Approaches" {
			t.Errorf("skills = %q, want %q", got.Labels.Skills, "Approaches")
		}
	})

	t.Run("whitespace-only label is dropped, not stored as empty string", func(t *testing.T) {
		got, err := ValidateCharacterSheetConfig(labels("   ", "", ""))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// Collapses all the way to nil Labels so "no override" has exactly one
		// representation; a stored "" would be a second one.
		if got.Labels != nil {
			t.Fatalf("expected Labels to collapse to nil, got %+v", got.Labels)
		}
		encoded, err := MarshalCharacterSheetConfig(got)
		if err != nil {
			t.Fatalf("unexpected marshal error: %v", err)
		}
		if string(encoded) != "{}" {
			t.Errorf("encoded = %s, want {}", encoded)
		}
	})

	t.Run("accepts a label at exactly the limit", func(t *testing.T) {
		atLimit := strings.Repeat("a", MaxCharacterSheetLabelLength)
		got, err := ValidateCharacterSheetConfig(labels(atLimit, "", ""))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Labels.Skills != atLimit {
			t.Errorf("label at the limit was altered")
		}
	})

	t.Run("rejects an over-long label", func(t *testing.T) {
		tooLong := strings.Repeat("a", MaxCharacterSheetLabelLength+1)
		if _, err := ValidateCharacterSheetConfig(labels(tooLong, "", "")); err == nil {
			t.Fatal("expected an error for an over-long label")
		}
	})

	t.Run("counts length in runes, not bytes", func(t *testing.T) {
		// 24 multi-byte characters is 24 tab-strip characters, and well over 24
		// bytes. A byte limit would reject this and quietly give non-Latin
		// scripts a shorter allowance.
		multibyte := strings.Repeat("あ", MaxCharacterSheetLabelLength)
		if _, err := ValidateCharacterSheetConfig(labels(multibyte, "", "")); err != nil {
			t.Fatalf("unexpected error for a rune-length-valid label: %v", err)
		}
	})

	t.Run("rejects control characters and newlines", func(t *testing.T) {
		for _, bad := range []string{"Ap\nproaches", "Ap\tproaches", "Ap\x00proaches", "Ap\rproaches"} {
			if _, err := ValidateCharacterSheetConfig(labels(bad, "", "")); err == nil {
				t.Errorf("expected an error for label %q", bad)
			}
		}
	})

	t.Run("rejects mojibake from invalid UTF-8 input", func(t *testing.T) {
		// Goes through Unmarshal rather than building the struct directly,
		// because that is the only way this can actually happen: encoding/json
		// silently rewrites invalid bytes to U+FFFD, so a caller cannot hand the
		// validator a genuinely invalid string. Checking utf8.ValidString here
		// instead would be unreachable code that always passes.
		parsed, err := UnmarshalCharacterSheetConfig([]byte("{\"labels\":{\"skills\":\"a\xffb\"}}"))
		if err != nil {
			t.Fatalf("unexpected unmarshal error: %v", err)
		}
		if _, err := ValidateCharacterSheetConfig(parsed); err == nil {
			t.Error("expected an error for a label containing the replacement character")
		}
	})

	t.Run("names the offending label in the error", func(t *testing.T) {
		_, err := ValidateCharacterSheetConfig(labels("", "", strings.Repeat("a", 99)))
		if err == nil {
			t.Fatal("expected an error")
		}
		if !strings.Contains(err.Error(), "numbers") {
			t.Errorf("error %q does not name the offending label", err)
		}
	})

	t.Run("nil labels validate as a no-op", func(t *testing.T) {
		got, err := ValidateCharacterSheetConfig(CharacterSheetConfig{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Labels != nil {
			t.Errorf("expected nil Labels, got %+v", got.Labels)
		}
	})
}

func TestCharacterSheetConfigRoundTrip(t *testing.T) {
	t.Run("empty config stores as an empty object", func(t *testing.T) {
		encoded, err := MarshalCharacterSheetConfig(CharacterSheetConfig{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if string(encoded) != "{}" {
			t.Fatalf("encoded = %s, want {} (a value-typed Labels field would give {\"labels\":{}})", encoded)
		}
	})

	t.Run("only genuine overrides persist", func(t *testing.T) {
		config := CharacterSheetConfig{Labels: &CharacterSheetLabels{Skills: "Approaches"}}
		encoded, err := MarshalCharacterSheetConfig(config)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if string(encoded) != `{"labels":{"skills":"Approaches"}}` {
			t.Errorf("encoded = %s, want only the skills override", encoded)
		}
	})

	t.Run("stored bytes parse back to the same config", func(t *testing.T) {
		original := CharacterSheetConfig{Labels: &CharacterSheetLabels{
			Skills: "Approaches", Inventory: "Gear", Numbers: "Resources",
		}}
		encoded, err := MarshalCharacterSheetConfig(original)
		if err != nil {
			t.Fatalf("unexpected marshal error: %v", err)
		}
		decoded, err := UnmarshalCharacterSheetConfig(encoded)
		if err != nil {
			t.Fatalf("unexpected unmarshal error: %v", err)
		}
		if decoded.Labels == nil || *decoded.Labels != *original.Labels {
			t.Errorf("round trip changed the config: %+v", decoded.Labels)
		}
	})
}

func TestClassifySheetWrite(t *testing.T) {
	tests := []struct {
		name       string
		moduleType string
		fieldName  string
		want       SheetWriteAccess
	}{
		// The two profile fields are the player's own description of their
		// character, so anyone who can edit the character may write them.
		{"public profile", "bio", "background", SheetWriteEditor},
		{"private notes", "notes", "private_notes", SheetWriteEditor},

		// Stat tabs are game balance: GM only.
		{"skills tab", "skills", "skills", SheetWriteGMOnly},
		{"inventory tab stores under items", "inventory", "items", SheetWriteGMOnly},
		{"numbers tab", "numbers", "numbers", SheetWriteGMOnly},

		// Everything else is rejected outright. Each of these was accepted from
		// any editor before the allowlist, which is the gap it closes.
		{"unknown field on a stat tab", "skills", "foo", SheetWriteRejected},
		{"inventory under its own key", "inventory", "inventory", SheetWriteRejected},
		{"unknown field on bio", "bio", "private_notes", SheetWriteRejected},
		{"unknown module", "custom", "x", SheetWriteRejected},
		{"custom tab not in the layout", "t_abc123", "t_abc123", SheetWriteRejected},
		{"retired abilities tab", "abilities", "abilities", SheetWriteRejected},
		{"renamed currency tab", "currency", "currency", SheetWriteRejected},
		{"old test-only biography module", "biography", "backstory", SheetWriteRejected},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ClassifySheetWrite(tt.moduleType, tt.fieldName, DefaultSheetTabKeys)
			if got != tt.want {
				t.Errorf("ClassifySheetWrite(%q, %q) = %d, want %d", tt.moduleType, tt.fieldName, got, tt.want)
			}
		})
	}

	t.Run("a tab absent from the layout is rejected even if built in", func(t *testing.T) {
		// Phase 3 lets a GM remove a built-in tab; its data must then stop
		// being writable until the tab is restored.
		got := ClassifySheetWrite("inventory", "items", []string{"skills", "numbers"})
		if got != SheetWriteRejected {
			t.Errorf("got %d, want SheetWriteRejected", got)
		}
	})

	t.Run("a custom tab in the layout stores under its own key", func(t *testing.T) {
		layout := []string{"skills", "t_abc123"}
		if got := ClassifySheetWrite("t_abc123", "t_abc123", layout); got != SheetWriteGMOnly {
			t.Errorf("got %d, want SheetWriteGMOnly", got)
		}
		if got := ClassifySheetWrite("t_abc123", "items", layout); got != SheetWriteRejected {
			t.Errorf("wrong field name: got %d, want SheetWriteRejected", got)
		}
	})
}

// validTab builds a custom tab with a single description field, which is what
// the editor creates for "Add tab".
func validTab(key, label string) CharacterSheetTab {
	return CharacterSheetTab{
		Key:   key,
		Label: label,
		Fields: []CharacterSheetField{
			{Key: "description", Label: "Description", Type: SheetFieldMarkdown},
		},
	}
}

func TestValidateCharacterSheetConfig_Tabs(t *testing.T) {
	withTabs := func(tabs ...CharacterSheetTab) CharacterSheetConfig {
		return CharacterSheetConfig{Tabs: tabs}
	}
	withFields := func(fields ...CharacterSheetField) CharacterSheetConfig {
		return withTabs(CharacterSheetTab{Key: "t_abc123", Label: "Contacts", Fields: fields})
	}

	rejects := []struct {
		name      string
		config    CharacterSheetConfig
		errSubstr string
	}{
		{"bio cannot be configured", withTabs(CharacterSheetTab{Key: "bio"}), "bio"},
		{"notes cannot be configured", withTabs(CharacterSheetTab{Key: "notes"}), "notes"},
		{"unknown built-in key", withTabs(CharacterSheetTab{Key: "abilities"}), "abilities"},
		{"custom key with the wrong shape", withTabs(validTab("t_ABC123", "Contacts")), "t_ABC123"},
		{"custom key too long", withTabs(validTab("t_abc1234", "Contacts")), "t_abc1234"},
		{"duplicate tab key", withTabs(CharacterSheetTab{Key: "skills"}, CharacterSheetTab{Key: "skills"}), "skills"},
		{"custom tab without fields", withTabs(CharacterSheetTab{Key: "t_abc123", Label: "Contacts"}), "fields"},
		{"custom tab without a label", withTabs(validTab("t_abc123", "   ")), "label"},
		{"over-long tab label", withTabs(CharacterSheetTab{Key: "skills", Label: strings.Repeat("a", MaxCharacterSheetLabelLength+1)}), "skills"},
		{"tab label with a newline", withTabs(CharacterSheetTab{Key: "skills", Label: "Ta\nlents"}), "skills"},
		{"too many tabs", withTabs(
			CharacterSheetTab{Key: "skills"}, CharacterSheetTab{Key: "inventory"}, CharacterSheetTab{Key: "numbers"},
			validTab("t_aaaaa1", "A"), validTab("t_aaaaa2", "B"), validTab("t_aaaaa3", "C"),
			validTab("t_aaaaa4", "D"), validTab("t_aaaaa5", "E"), validTab("t_aaaaa6", "F"),
		), "tabs"},

		{"field key with an upper-case letter", withFields(CharacterSheetField{Key: "Trust", Label: "Trust", Type: SheetFieldNumber}), "Trust"},
		{"field key starting with a digit", withFields(CharacterSheetField{Key: "1st", Label: "First", Type: SheetFieldText}), "1st"},
		{"field key too long", withFields(CharacterSheetField{Key: "a" + strings.Repeat("b", 32), Label: "Long", Type: SheetFieldText}), "key"},
		{"field key id is reserved", withFields(CharacterSheetField{Key: "id", Label: "Id", Type: SheetFieldText}), "reserved"},
		{"field key name is reserved", withFields(CharacterSheetField{Key: "name", Label: "Name", Type: SheetFieldText}), "reserved"},
		{"legacy skills key level is reserved", withFields(CharacterSheetField{Key: "level", Label: "Level", Type: SheetFieldNumber}), "reserved"},
		{"legacy numbers key max is reserved", withFields(CharacterSheetField{Key: "max", Label: "Max", Type: SheetFieldNumber}), "reserved"},
		{"amount is reserved outside numbers", withFields(CharacterSheetField{Key: "amount", Label: "Amount", Type: SheetFieldNumber}), "reserved"},
		{"duplicate field key", withFields(
			CharacterSheetField{Key: "f_aaaaaa", Label: "A", Type: SheetFieldText},
			CharacterSheetField{Key: "f_aaaaaa", Label: "B", Type: SheetFieldText},
		), "f_aaaaaa"},
		{"field without a label", withFields(CharacterSheetField{Key: "f_aaaaaa", Label: "  ", Type: SheetFieldText}), "label"},
		{"over-long field label", withFields(CharacterSheetField{Key: "f_aaaaaa", Label: strings.Repeat("a", MaxSheetFieldLabelLength+1), Type: SheetFieldText}), "f_aaaaaa"},
		{"unknown field type", withFields(CharacterSheetField{Key: "f_aaaaaa", Label: "A", Type: "dice"}), "dice"},
		{"select without options", withFields(CharacterSheetField{Key: "f_aaaaaa", Label: "A", Type: SheetFieldSelect}), "option"},
		{"options on a non-select", withFields(CharacterSheetField{Key: "f_aaaaaa", Label: "A", Type: SheetFieldText, Options: []string{"x"}}), "option"},
		{"blank select option", withFields(CharacterSheetField{Key: "f_aaaaaa", Label: "A", Type: SheetFieldSelect, Options: []string{"Ally", " "}}), "option"},
		{"duplicate select option", withFields(CharacterSheetField{Key: "f_aaaaaa", Label: "A", Type: SheetFieldSelect, Options: []string{"Ally", " Ally "}}), "Ally"},
	}

	for _, tt := range rejects {
		t.Run("rejects "+tt.name, func(t *testing.T) {
			_, err := ValidateCharacterSheetConfig(tt.config)
			if err == nil {
				t.Fatal("expected an error")
			}
			if !strings.Contains(err.Error(), tt.errSubstr) {
				t.Errorf("error %q does not mention %q", err, tt.errSubstr)
			}
		})
	}

	t.Run("rejects too many fields", func(t *testing.T) {
		fields := make([]CharacterSheetField, MaxSheetFieldsPerTab+1)
		for i := range fields {
			fields[i] = CharacterSheetField{Key: fmt.Sprintf("f_%06d", i), Label: "F", Type: SheetFieldText}
		}
		if _, err := ValidateCharacterSheetConfig(withFields(fields...)); err == nil {
			t.Fatal("expected an error")
		}
	})

	t.Run("rejects too many select options", func(t *testing.T) {
		options := make([]string, MaxSheetSelectOptions+1)
		for i := range options {
			options[i] = fmt.Sprintf("Option %d", i)
		}
		_, err := ValidateCharacterSheetConfig(withFields(
			CharacterSheetField{Key: "f_aaaaaa", Label: "A", Type: SheetFieldSelect, Options: options}))
		if err == nil {
			t.Fatal("expected an error")
		}
	})

	t.Run("accepts the plan's example layout and normalizes it", func(t *testing.T) {
		got, err := ValidateCharacterSheetConfig(CharacterSheetConfig{
			Labels: &CharacterSheetLabels{Inventory: "Gear"},
			Tabs: []CharacterSheetTab{
				{Key: "skills", Label: "  Talents  "},
				{Key: "inventory", Fields: []CharacterSheetField{
					{Key: "quantity", Label: "Quantity", Type: SheetFieldNumber},
					{Key: "f_k2m9qa", Label: " Durability ", Type: SheetFieldNumber},
					{Key: "description", Label: "Description", Type: SheetFieldMarkdown},
				}},
				{Key: "numbers", Label: "   ", Fields: []CharacterSheetField{
					{Key: "amount", Label: "Amount", Type: SheetFieldTrack},
				}},
				{Key: "t_8fjw2c", Label: "Contacts", Fields: []CharacterSheetField{
					{Key: "f_a81x0p", Label: "Relationship", Type: SheetFieldSelect, Options: []string{" Ally ", "Rival"}},
					{Key: "f_c3n1bb", Label: "Trust", Type: SheetFieldTrack},
					{Key: "f_p0z7rr", Label: "Met", Type: SheetFieldCheckbox},
					{Key: "f_q1q1q1", Label: "Location", Type: SheetFieldText},
				}},
			},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// With tabs present, legacy labels are dead weight: drop them so the
		// stored document has one place a tab's name can come from.
		if got.Labels != nil {
			t.Errorf("expected legacy labels to be dropped, got %+v", got.Labels)
		}
		if got.Tabs[0].Label != "Talents" {
			t.Errorf("tab label = %q, want trimmed", got.Tabs[0].Label)
		}
		if got.Tabs[2].Label != "" {
			t.Errorf("whitespace-only built-in label = %q, want absent", got.Tabs[2].Label)
		}
		if got.Tabs[1].Fields[1].Label != "Durability" {
			t.Errorf("field label = %q, want trimmed", got.Tabs[1].Fields[1].Label)
		}
		if got.Tabs[3].Fields[0].Options[0] != "Ally" {
			t.Errorf("option = %q, want trimmed", got.Tabs[3].Fields[0].Options[0])
		}
	})

	t.Run("does not modify the caller's slices", func(t *testing.T) {
		tabs := []CharacterSheetTab{{Key: "skills", Label: "  Talents  "}}
		if _, err := ValidateCharacterSheetConfig(CharacterSheetConfig{Tabs: tabs}); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if tabs[0].Label != "  Talents  " {
			t.Errorf("caller's tab was normalized in place: %q", tabs[0].Label)
		}
	})

	t.Run("a built-in tab may have its fields emptied", func(t *testing.T) {
		got, err := ValidateCharacterSheetConfig(withTabs(CharacterSheetTab{Key: "inventory", Fields: []CharacterSheetField{}}))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Tabs[0].Fields == nil {
			t.Error("empty fields collapsed to nil, which would mean 'default schema'")
		}
	})

	t.Run("an empty tab list is kept, not collapsed to the default layout", func(t *testing.T) {
		got, err := ValidateCharacterSheetConfig(CharacterSheetConfig{Tabs: []CharacterSheetTab{}})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got.Tabs == nil {
			t.Error("empty tabs collapsed to nil, which would restore the default tabs")
		}
	})
}

func TestCharacterSheetConfigRoundTrip_Tabs(t *testing.T) {
	// omitzero, not omitempty, is what makes these distinct: absent means
	// "default", while an empty list is a GM's deliberate choice.
	cases := []struct {
		name string
		json string
	}{
		{"no tabs key is the default layout", `{}`},
		{"empty tab list survives", `{"tabs":[]}`},
		{"built-in tab without fields uses the default schema", `{"tabs":[{"key":"skills"}]}`},
		{"built-in tab with emptied fields survives", `{"tabs":[{"key":"inventory","fields":[]}]}`},
		{"full custom tab", `{"tabs":[{"key":"t_8fjw2c","label":"Contacts","fields":[{"key":"f_a81x0p","label":"Relationship","type":"select","options":["Ally","Rival"]}]}]}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			parsed, err := UnmarshalCharacterSheetConfig([]byte(tc.json))
			if err != nil {
				t.Fatalf("unexpected unmarshal error: %v", err)
			}
			encoded, err := MarshalCharacterSheetConfig(parsed)
			if err != nil {
				t.Fatalf("unexpected marshal error: %v", err)
			}
			if string(encoded) != tc.json {
				t.Errorf("round trip = %s, want %s", encoded, tc.json)
			}
		})
	}

	t.Run("unknown keys inside a tab are rejected", func(t *testing.T) {
		if _, err := UnmarshalCharacterSheetConfig([]byte(`{"tabs":[{"key":"skills","public":true}]}`)); err == nil {
			t.Error("expected an error for an unknown tab key")
		}
	})
}

func TestResolveSheetTabKeys(t *testing.T) {
	t.Run("no tabs resolves to the default layout", func(t *testing.T) {
		got := ResolveSheetTabKeys(CharacterSheetConfig{Labels: &CharacterSheetLabels{Skills: "Talents"}})
		if strings.Join(got, ",") != "skills,inventory,numbers" {
			t.Errorf("got %v", got)
		}
		// A caller appending to the result must not grow the shared default.
		_ = append(got, "t_abc123")
		if len(DefaultSheetTabKeys) != 3 {
			t.Errorf("DefaultSheetTabKeys was mutated: %v", DefaultSheetTabKeys)
		}
	})

	t.Run("tabs resolve in order", func(t *testing.T) {
		got := ResolveSheetTabKeys(CharacterSheetConfig{Tabs: []CharacterSheetTab{
			{Key: "t_abc123"}, {Key: "skills"},
		}})
		if strings.Join(got, ",") != "t_abc123,skills" {
			t.Errorf("got %v", got)
		}
	})

	t.Run("an empty tab list resolves to no tabs", func(t *testing.T) {
		if got := ResolveSheetTabKeys(CharacterSheetConfig{Tabs: []CharacterSheetTab{}}); len(got) != 0 {
			t.Errorf("got %v", got)
		}
	})
}

func TestCharacterSheetConfigForResponse(t *testing.T) {
	t.Run("a tabs-only config is returned, not dropped", func(t *testing.T) {
		got := CharacterSheetConfigForResponse([]byte(`{"tabs":[{"key":"skills"}]}`))
		if got == nil || len(got.Tabs) != 1 {
			t.Fatalf("got %+v, want the tabs config", got)
		}
	})

	t.Run("an empty tab list is returned, not dropped", func(t *testing.T) {
		// Dropping it would tell the frontend "default layout" for a game whose
		// GM removed every configurable tab.
		got := CharacterSheetConfigForResponse([]byte(`{"tabs":[]}`))
		if got == nil || got.Tabs == nil {
			t.Fatalf("got %+v, want an empty tabs list", got)
		}
	})

	t.Run("an empty config is omitted", func(t *testing.T) {
		if got := CharacterSheetConfigForResponse([]byte(`{}`)); got != nil {
			t.Errorf("got %+v, want nil", got)
		}
	})
}

func TestIsSheetTabKey(t *testing.T) {
	for key, want := range map[string]bool{
		"skills": true, "inventory": true, "numbers": true, "t_abc123": true,
		"bio": false, "notes": false, "abilities": false, "t_abc12": false, "t_ABC123": false, "": false,
	} {
		if got := IsSheetTabKey(key); got != want {
			t.Errorf("IsSheetTabKey(%q) = %v, want %v", key, got, want)
		}
	}
}

func TestSheetTabLabel(t *testing.T) {
	composed := CharacterSheetConfig{Tabs: []CharacterSheetTab{
		{Key: "t_abc123", Label: "Contacts"},
		{Key: "inventory", Label: "Gear"},
		{Key: "skills"},
	}}
	legacy := CharacterSheetConfig{Labels: &CharacterSheetLabels{Numbers: "Resources"}}

	tests := []struct {
		name   string
		config CharacterSheetConfig
		key    string
		want   string
	}{
		{"custom tab takes its label", composed, "t_abc123", "Contacts"},
		{"renamed built-in takes its label", composed, "inventory", "Gear"},
		{"unrenamed built-in takes its default", composed, "skills", "Skills"},
		{"legacy label override applies without tabs", legacy, "numbers", "Resources"},
		{"legacy config falls back to the default", legacy, "inventory", "Inventory"},
		{"legacy labels are ignored once tabs are set", CharacterSheetConfig{
			Labels: &CharacterSheetLabels{Skills: "Talents"}, Tabs: []CharacterSheetTab{{Key: "skills"}},
		}, "skills", "Skills"},
		{"a custom tab the layout dropped has no label", composed, "t_zzz999", ""},
		{"empty config uses the default", CharacterSheetConfig{}, "numbers", "Numbers"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := SheetTabLabel(tt.config, tt.key); got != tt.want {
				t.Errorf("SheetTabLabel(%q) = %q, want %q", tt.key, got, tt.want)
			}
		})
	}
}
