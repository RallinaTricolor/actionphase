package gmboard

import "encoding/json"

// The kind enums mirror core.GmBoardItemKinds and core.GmSettingsItemKinds;
// requests_test.go keeps them in step. Keys are client-generated IDs, a
// character ID, or a pair such as "12|15" for a stance.

// BoardItemChange is one write to a phase's board.
type BoardItemChange struct {
	Kind        string          `json:"kind" enum:"card,scene,chunk,cluster,stance,progress,flag,notes,reward,rewards" doc:"Item kind"`
	Key         string          `json:"key" minLength:"1" maxLength:"128" pattern:"^[A-Za-z0-9_.:|-]+$" doc:"Item key, unique within its kind"`
	BaseVersion int32           `json:"base_version" minimum:"0" doc:"The version this change is based on; 0 when the item is new (or was deleted)"`
	Doc         json.RawMessage `json:"doc,omitempty" required:"false" doc:"The item's new content. Required unless deleted is true"`
	Deleted     bool            `json:"deleted,omitempty" required:"false" doc:"Delete the item"`
}

// SettingsItemChange is one write to a game's board settings.
type SettingsItemChange struct {
	Kind        string          `json:"kind" enum:"codex,names,template,groups,scales,prefs,reward" doc:"Item kind"`
	Key         string          `json:"key" minLength:"1" maxLength:"128" pattern:"^[A-Za-z0-9_.:|-]+$" doc:"Item key, unique within its kind"`
	BaseVersion int32           `json:"base_version" minimum:"0" doc:"The version this change is based on; 0 when the item is new (or was deleted)"`
	Doc         json.RawMessage `json:"doc,omitempty" required:"false" doc:"The item's new content. Required unless deleted is true"`
	Deleted     bool            `json:"deleted,omitempty" required:"false" doc:"Delete the item"`
}

// ApplyBoardChangesRequest is one flush of a board's dirty items.
type ApplyBoardChangesRequest struct {
	Changes []BoardItemChange `json:"changes" minItems:"1" maxItems:"500" doc:"The changes, applied all or nothing"`
}

// ApplySettingsChangesRequest is one flush of a game's dirty settings items.
type ApplySettingsChangesRequest struct {
	Changes []SettingsItemChange `json:"changes" minItems:"1" maxItems:"500" doc:"The changes, applied all or nothing"`
}

// SetSharingRequest turns read-only sharing of the game's boards on or off.
type SetSharingRequest struct {
	Share bool `json:"share" doc:"Share the results boards read-only: with the audience while the game runs, and with everyone once it is a public archive"`
}
