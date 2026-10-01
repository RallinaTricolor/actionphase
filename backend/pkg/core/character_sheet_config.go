package core

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// MaxCharacterSheetLabelLength bounds a GM-supplied tab label. These render as
// tab labels in a horizontal strip that already has to fit on a phone, so the
// limit is a layout constraint rather than a storage one.
const MaxCharacterSheetLabelLength = 24

// Layout limits for GM-composed tabs. Like the label limit, these exist to keep
// the sheet usable (a tab strip that fits a phone, a card that stays scannable),
// not to protect storage.
const (
	MaxSheetTabs              = 8
	MaxSheetFieldsPerTab      = 12
	MaxSheetFieldLabelLength  = 40
	MaxSheetSelectOptions     = 20
	MaxSheetSelectOptionRunes = 40
)

// Field types a GM can give a tab's field. The frontend owns how each one is
// entered and rendered; the backend only checks the type is one it knows.
const (
	SheetFieldText     = "text"
	SheetFieldNumber   = "number"
	SheetFieldMarkdown = "markdown"
	SheetFieldSelect   = "select"
	SheetFieldCheckbox = "checkbox"
	SheetFieldTrack    = "track"
)

var sheetFieldTypes = map[string]bool{
	SheetFieldText: true, SheetFieldNumber: true, SheetFieldMarkdown: true,
	SheetFieldSelect: true, SheetFieldCheckbox: true, SheetFieldTrack: true,
}

var (
	// Custom tab keys are generated client-side and never change, so a label
	// rename cannot orphan a tab's character_data rows. Mirrored by the
	// check_module_type constraint on action_result_character_updates.
	customSheetTabKeyPattern = regexp.MustCompile(`^t_[a-z0-9]{6}$`)
	sheetFieldKeyPattern     = regexp.MustCompile(`^[a-z][a-z0-9_]{0,31}$`)
)

// reservedSheetFieldKeys can never be a field. `id` and `name` are every
// entry's fixed attributes; the rest are legacy keys still sitting in stored
// entries, which a new field of the same name would silently pick up.
var reservedSheetFieldKeys = map[string]bool{
	"id": true, "name": true,
	"level": true, "type": true, "max": true, "display": true, "equipped": true, "metadata": true,
}

// DefaultSheetTabKeys are the configurable tabs a game has when its config
// names none: the stat tabs every game had before tab composition. Only the
// keys live here. Default labels and field schemas are frontend-only, so the
// backend never has to agree with them.
var DefaultSheetTabKeys = []string{"skills", "inventory", "numbers"}

// defaultSheetTabLabels name the built-in tabs in text the server writes
// itself: the game log and archive exports. Everything the app renders takes
// its defaults from DEFAULT_SHEET_LAYOUT in the frontend's useSheetLayout.ts;
// keep these the same.
var defaultSheetTabLabels = map[string]string{
	"skills":    "Skills",
	"inventory": "Inventory",
	"numbers":   "Numbers",
}

// SheetTabLabel returns the name a game's sheet shows for a configurable tab:
// the GM's label, else a legacy label override, else the built-in default.
// Empty for a tab the config doesn't name and that has no default (a removed
// custom tab), so the caller picks a fallback that suits its text.
func SheetTabLabel(config CharacterSheetConfig, tabKey string) string {
	if config.Tabs != nil {
		for _, tab := range config.Tabs {
			if tab.Key == tabKey && tab.Label != "" {
				return tab.Label
			}
		}
	} else if config.Labels != nil {
		legacy := map[string]string{
			"skills":    config.Labels.Skills,
			"inventory": config.Labels.Inventory,
			"numbers":   config.Labels.Numbers,
		}
		if label := legacy[tabKey]; label != "" {
			return label
		}
	}
	return defaultSheetTabLabels[tabKey]
}

// SheetStorageFieldName returns the character_data field_name a configurable
// tab's entries are stored under. Every tab stores under its own key except
// inventory, which predates that invariant and stores under "items".
// Mirrors storageFieldName in the frontend's types/characters.ts.
func SheetStorageFieldName(tabKey string) string {
	if tabKey == "inventory" {
		return "items"
	}
	return tabKey
}

// SheetWriteAccess says who may write a character_data (module_type,
// field_name) pair.
type SheetWriteAccess int

const (
	// SheetWriteRejected: the pair is not part of the sheet. Nobody may write
	// it, including the GM.
	SheetWriteRejected SheetWriteAccess = iota
	// SheetWriteEditor: anyone who can edit the character.
	SheetWriteEditor
	// SheetWriteGMOnly: the game's GM or a co-GM.
	SheetWriteGMOnly
)

// ClassifySheetWrite decides who may write a (module_type, field_name) pair,
// given the game's configurable tab keys.
//
// An allowlist, not a denylist of stat fields: the denylist it replaced let
// any editor write any pair it did not name, so a player could park arbitrary
// data on their own sheet, including under a key a future custom tab would
// later claim and render as GM-set.
//
// The profile fields are the player's own description of their character.
// Every configurable tab is game balance and belongs to the GM, even on a
// character the player otherwise owns.
func ClassifySheetWrite(moduleType, fieldName string, tabKeys []string) SheetWriteAccess {
	if (moduleType == "bio" && fieldName == "background") ||
		(moduleType == "notes" && fieldName == "private_notes") {
		return SheetWriteEditor
	}
	for _, key := range tabKeys {
		if moduleType == key && fieldName == SheetStorageFieldName(key) {
			return SheetWriteGMOnly
		}
	}
	return SheetWriteRejected
}

// CharacterSheetConfig is a game's per-game character sheet configuration,
// stored as JSONB on games.character_sheet.
//
// It is deliberately SPARSE: a field is present only when the GM has actually
// overridden it. An absent field means "use the default", and the defaults live
// in the frontend so exactly one place knows them. Persisting a default here
// would fork that knowledge and freeze today's wording into the stored row.
//
// Unknown keys are rejected at every level (see UnmarshalCharacterSheetConfig),
// which is what keeps this blob from accumulating junk.
type CharacterSheetConfig struct {
	// Pointer, not a value: encoding/json's omitempty has no effect on a struct
	// field, so a value here would serialize an all-defaults game as
	// {"labels":{}} instead of {}. Nil means "no overrides at all".
	//
	// Legacy: honoured only while Tabs is absent. Validation drops it once Tabs
	// is set, so a stored document never has two sources for a tab's name.
	Labels *CharacterSheetLabels `json:"labels,omitempty" doc:"Legacy tab label overrides, used only when tabs is absent"`

	// omitzero, not omitempty: nil means "the default layout", while an empty
	// list is a GM who removed every configurable tab. omitempty would store
	// both as an absent key and quietly bring the default tabs back.
	Tabs []CharacterSheetTab `json:"tabs,omitzero" required:"false" doc:"Configurable tabs in display order. Absent means the default layout. Public Profile and Private Notes are always shown first and never listed."`
}

// CharacterSheetTab is one configurable tab: a list of entries whose fields the
// GM defines.
type CharacterSheetTab struct {
	Key string `json:"key" doc:"Stable identifier: skills, inventory, numbers, or t_ plus six lower-case letters or digits for a custom tab"`
	// Optional on a built-in tab (absent means its default label), required on
	// a custom one, which has no default.
	Label string `json:"label,omitempty" required:"false" doc:"Display name. Absent on a built-in tab means its default label."`
	// omitzero for the same reason as Tabs: nil is "the built-in default
	// schema", an empty list is a tab whose entries carry only a name.
	Fields []CharacterSheetField `json:"fields,omitzero" required:"false" doc:"Entry fields in display order. Absent on a built-in tab means its default fields. Required on a custom tab."`
}

// CharacterSheetField is one attribute of a tab's entries. Its value is stored
// at the top level of each entry under Key.
type CharacterSheetField struct {
	Key     string   `json:"key" doc:"Stable identifier; the entry JSON key the value is stored under"`
	Label   string   `json:"label" doc:"Display name"`
	Type    string   `json:"type" enum:"text,number,markdown,select,checkbox,track" doc:"Cannot change after creation"`
	Options []string `json:"options,omitempty" required:"false" doc:"Choices for a select field; only allowed on select"`
}

// CharacterSheetLabels holds GM overrides for the stat tab names. The keys match
// the storage module_type of each tab, which is also the React symbol and the
// default label — see the character sheet refactor plan's naming invariant.
type CharacterSheetLabels struct {
	Skills    string `json:"skills,omitempty"`
	Inventory string `json:"inventory,omitempty"`
	Numbers   string `json:"numbers,omitempty"`
}

// IsZero reports whether no override is set, so the config can be stored as a
// bare `{}` rather than `{"labels":{}}`.
func (l CharacterSheetLabels) IsZero() bool {
	return l.Skills == "" && l.Inventory == "" && l.Numbers == ""
}

// ValidateCharacterSheetConfig normalizes and validates a config supplied by a
// client, returning the cleaned value to store.
//
// Normalization is part of validation here on purpose: a label that is only
// whitespace is not an error, it is an unset label, and must be stored as an
// absent key rather than as "" so that "no override" has exactly one
// representation on the wire and in the database.
func ValidateCharacterSheetConfig(config CharacterSheetConfig) (CharacterSheetConfig, error) {
	if config.Tabs != nil {
		tabs, err := validateSheetTabs(config.Tabs)
		if err != nil {
			return config, err
		}
		config.Tabs = tabs
		config.Labels = nil
		return config, nil
	}

	if config.Labels == nil {
		return config, nil
	}

	// Copied so normalization never writes through to the caller's struct.
	labelsCopy := *config.Labels
	config.Labels = &labelsCopy

	labels := []struct {
		name  string
		value *string
	}{
		{"skills", &config.Labels.Skills},
		{"inventory", &config.Labels.Inventory},
		{"numbers", &config.Labels.Numbers},
	}

	for _, label := range labels {
		normalized, err := normalizeSheetLabel(*label.value, MaxCharacterSheetLabelLength)
		if err != nil {
			return config, fmt.Errorf("character sheet label %q %w", label.name, err)
		}
		*label.value = normalized
	}

	// Every override trimmed away to nothing: collapse to the same shape an
	// untouched game has, so "no overrides" is one value rather than two.
	if config.Labels.IsZero() {
		config.Labels = nil
	}

	return config, nil
}

// normalizeSheetLabel trims a GM-supplied label and checks it will render.
// Whitespace-only comes back as "" rather than an error: for an optional label
// that means "unset". The error completes a sentence naming the label.
func normalizeSheetLabel(value string, maxRunes int) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "", nil
	}

	// U+FFFD rather than utf8.ValidString: encoding/json replaces invalid
	// bytes with the replacement character during decode, so by the time a
	// label reaches here it is always valid UTF-8 and a ValidString check
	// can never fire. Its presence means the client sent bytes that were not
	// valid UTF-8, which is worth rejecting rather than storing as mojibake.
	if strings.ContainsRune(trimmed, utf8.RuneError) {
		return "", fmt.Errorf("is not valid UTF-8")
	}

	// Counted in runes, not bytes: the limit exists to keep the label
	// readable in a tab strip, and a byte limit would silently allow fewer
	// characters for non-Latin scripts.
	if utf8.RuneCountInString(trimmed) > maxRunes {
		return "", fmt.Errorf("must be %d characters or fewer", maxRunes)
	}

	// Control characters and newlines would break the tab strip's layout and
	// are never meaningful in a label.
	for _, r := range trimmed {
		if r == '\n' || r == '\r' || unicode.IsControl(r) {
			return "", fmt.Errorf("must not contain control characters or newlines")
		}
	}

	return trimmed, nil
}

// isBuiltInSheetTab reports whether key is one of the tabs every game had
// before tab composition.
func isBuiltInSheetTab(key string) bool {
	for _, builtIn := range DefaultSheetTabKeys {
		if key == builtIn {
			return true
		}
	}
	return false
}

// IsSheetTabKey reports whether key can name a configurable tab in any game:
// a built-in key or a well-formed custom one. It says nothing about whether a
// particular game has that tab; ResolveSheetTabKeys answers that.
func IsSheetTabKey(key string) bool {
	return isBuiltInSheetTab(key) || customSheetTabKeyPattern.MatchString(key)
}

// validateSheetTabs normalizes and validates a tab list into a fresh slice, so
// the caller's request struct is never modified.
func validateSheetTabs(tabs []CharacterSheetTab) ([]CharacterSheetTab, error) {
	if len(tabs) > MaxSheetTabs {
		return nil, fmt.Errorf("a character sheet can have at most %d configurable tabs", MaxSheetTabs)
	}

	out := make([]CharacterSheetTab, 0, len(tabs))
	seen := make(map[string]bool, len(tabs))

	for _, tab := range tabs {
		if tab.Key == "bio" || tab.Key == "notes" {
			return nil, fmt.Errorf("tab %q is always shown and cannot be configured", tab.Key)
		}
		builtIn := isBuiltInSheetTab(tab.Key)
		if !builtIn && !customSheetTabKeyPattern.MatchString(tab.Key) {
			return nil, fmt.Errorf("tab key %q must be skills, inventory, numbers, or t_ followed by six lower-case letters or digits", tab.Key)
		}
		if seen[tab.Key] {
			return nil, fmt.Errorf("tab %q is listed more than once", tab.Key)
		}
		seen[tab.Key] = true

		label, err := normalizeSheetLabel(tab.Label, MaxCharacterSheetLabelLength)
		if err != nil {
			return nil, fmt.Errorf("tab %q label %w", tab.Key, err)
		}

		if !builtIn {
			// A custom tab has no default label or schema to fall back on.
			if label == "" {
				return nil, fmt.Errorf("tab %q needs a label", tab.Key)
			}
			if tab.Fields == nil {
				return nil, fmt.Errorf("tab %q needs a fields list", tab.Key)
			}
		}

		var fields []CharacterSheetField
		if tab.Fields != nil {
			fields, err = validateSheetFields(tab.Key, tab.Fields)
			if err != nil {
				return nil, err
			}
		}

		out = append(out, CharacterSheetTab{Key: tab.Key, Label: label, Fields: fields})
	}

	return out, nil
}

// validateSheetFields normalizes and validates one tab's field list. The result
// is never nil, so an emptied list stays distinct from "default schema".
func validateSheetFields(tabKey string, fields []CharacterSheetField) ([]CharacterSheetField, error) {
	if len(fields) > MaxSheetFieldsPerTab {
		return nil, fmt.Errorf("tab %q can have at most %d fields", tabKey, MaxSheetFieldsPerTab)
	}

	out := make([]CharacterSheetField, 0, len(fields))
	seen := make(map[string]bool, len(fields))

	for _, field := range fields {
		if !sheetFieldKeyPattern.MatchString(field.Key) {
			return nil, fmt.Errorf("tab %q field key %q must start with a lower-case letter and use only lower-case letters, digits and underscores, up to 32 characters", tabKey, field.Key)
		}
		// Numbers' track has always been stored under `amount`; anywhere else
		// the key would pick up that legacy value.
		if reservedSheetFieldKeys[field.Key] || (field.Key == "amount" && tabKey != "numbers") {
			return nil, fmt.Errorf("tab %q field key %q is reserved", tabKey, field.Key)
		}
		if seen[field.Key] {
			return nil, fmt.Errorf("tab %q field %q is listed more than once", tabKey, field.Key)
		}
		seen[field.Key] = true

		label, err := normalizeSheetLabel(field.Label, MaxSheetFieldLabelLength)
		if err != nil {
			return nil, fmt.Errorf("tab %q field %q label %w", tabKey, field.Key, err)
		}
		if label == "" {
			return nil, fmt.Errorf("tab %q field %q needs a label", tabKey, field.Key)
		}

		if !sheetFieldTypes[field.Type] {
			return nil, fmt.Errorf("tab %q field %q has unknown type %q", tabKey, field.Key, field.Type)
		}

		options, err := validateSheetFieldOptions(tabKey, field)
		if err != nil {
			return nil, err
		}

		out = append(out, CharacterSheetField{Key: field.Key, Label: label, Type: field.Type, Options: options})
	}

	return out, nil
}

func validateSheetFieldOptions(tabKey string, field CharacterSheetField) ([]string, error) {
	if field.Type != SheetFieldSelect {
		if len(field.Options) > 0 {
			return nil, fmt.Errorf("tab %q field %q: only select fields take options", tabKey, field.Key)
		}
		return nil, nil
	}

	if len(field.Options) == 0 {
		return nil, fmt.Errorf("tab %q field %q: a select needs at least one option", tabKey, field.Key)
	}
	if len(field.Options) > MaxSheetSelectOptions {
		return nil, fmt.Errorf("tab %q field %q can have at most %d options", tabKey, field.Key, MaxSheetSelectOptions)
	}

	out := make([]string, 0, len(field.Options))
	seen := make(map[string]bool, len(field.Options))
	for _, option := range field.Options {
		normalized, err := normalizeSheetLabel(option, MaxSheetSelectOptionRunes)
		if err != nil {
			return nil, fmt.Errorf("tab %q field %q option %q %w", tabKey, field.Key, option, err)
		}
		if normalized == "" {
			return nil, fmt.Errorf("tab %q field %q has a blank option", tabKey, field.Key)
		}
		if seen[normalized] {
			return nil, fmt.Errorf("tab %q field %q lists option %q more than once", tabKey, field.Key, normalized)
		}
		seen[normalized] = true
		out = append(out, normalized)
	}
	return out, nil
}

// SheetTabKeysForStored resolves the configurable tab keys straight from a
// stored games.character_sheet column.
//
// Goes through CharacterSheetConfigForResponse on purpose, so a malformed row
// falls back to the default layout here exactly as it does in every response.
// Write permissions must match the tabs the frontend actually shows.
func SheetTabKeysForStored(stored []byte) []string {
	config := CharacterSheetConfigForResponse(stored)
	if config == nil {
		return ResolveSheetTabKeys(CharacterSheetConfig{})
	}
	return ResolveSheetTabKeys(*config)
}

// ResolveSheetTabKeys returns a game's configurable tab keys in display order.
// Only the keys: labels and schemas resolve in the frontend, and the backend
// never needs them.
func ResolveSheetTabKeys(config CharacterSheetConfig) []string {
	if config.Tabs == nil {
		// A copy, so a caller appending to the result cannot grow the default.
		return append([]string(nil), DefaultSheetTabKeys...)
	}
	keys := make([]string, len(config.Tabs))
	for i, tab := range config.Tabs {
		keys[i] = tab.Key
	}
	return keys
}

// UnmarshalCharacterSheetConfig parses a stored or client-supplied config,
// rejecting unknown keys at every level.
//
// Strictness is the point. Without it a typo'd or speculative key is accepted
// silently, persists forever, and is indistinguishable from a real setting by
// the time a later version of this document wants that key for something else.
// A nil or empty input is a valid empty config, not an error — that is what
// every pre-existing game's column holds.
func UnmarshalCharacterSheetConfig(data []byte) (CharacterSheetConfig, error) {
	var config CharacterSheetConfig

	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || string(trimmed) == "null" {
		return config, nil
	}

	decoder := json.NewDecoder(bytes.NewReader(trimmed))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&config); err != nil {
		return config, fmt.Errorf("invalid character sheet config: %w", err)
	}

	return config, nil
}

// MarshalCharacterSheetConfig renders a config for storage.
//
// Round-trips through the typed struct rather than storing client bytes, so
// whatever lands in the column is exactly what the type can express — the
// guarantee that makes DisallowUnknownFields worth anything on read.
func MarshalCharacterSheetConfig(config CharacterSheetConfig) ([]byte, error) {
	data, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal character sheet config: %w", err)
	}
	return data, nil
}

// CharacterSheetConfigForResponse decodes a stored games.character_sheet column
// for a response body.
//
// Returns nil for an empty or all-defaults config so the key is omitted
// entirely rather than sent as {}, keeping "no overrides" a single shape on the
// wire. A malformed stored value is treated as no config rather than failing the
// request: the column is server-written and validated on the way in, so a parse
// failure here means a bug or a hand-edited row, and failing a whole response
// is worse than falling back to the default layout.
//
// Lives here rather than in an HTTP package because two of them need it — the
// game endpoints and the cross-game character payload the utility drawer reads —
// and the drawer's copy has to agree with the game's copy exactly, or the same
// game would render different tab labels depending on which surface opened it.
func CharacterSheetConfigForResponse(stored []byte) *CharacterSheetConfig {
	config, err := UnmarshalCharacterSheetConfig(stored)
	if err != nil {
		return nil
	}
	// Tabs is checked against nil, not length: an empty list is a real layout
	// (no configurable tabs), and dropping it would render the default one.
	if config.Labels == nil && config.Tabs == nil {
		return nil
	}
	return &config
}
