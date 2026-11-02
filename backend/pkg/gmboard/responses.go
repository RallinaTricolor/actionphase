package gmboard

import (
	"encoding/json"
	"net/http"
	"time"

	"actionphase/pkg/core"
)

// GmItemResponse is one stored board or settings item.
type GmItemResponse struct {
	Kind      string          `json:"kind" doc:"Item kind"`
	Key       string          `json:"key" doc:"Item key"`
	Version   int32           `json:"version" doc:"Send this as base_version on the next change. 0 for an item that does not exist"`
	Seq       int64           `json:"seq" doc:"When the item last changed, on the board's poll cursor"`
	Deleted   bool            `json:"deleted" doc:"A tombstone: the item was deleted"`
	Doc       json.RawMessage `json:"doc,omitempty" doc:"The item's content; absent on a tombstone"`
	UpdatedAt *time.Time      `json:"updated_at,omitempty" doc:"Absent for an item that does not exist"`
	UpdatedBy *int32          `json:"updated_by,omitempty" doc:"User who last changed it; absent if unknown"`
}

// The item lists are nullable:"false": huma renders a bare []T as nullable,
// and toItemResponses always builds them with make, so they are never null.

// GmItemsResponse is a full load, or a poll.
type GmItemsResponse struct {
	Items []GmItemResponse `json:"items" nullable:"false" doc:"A full load has live items only; a poll (since) includes tombstones"`
	// The highest seq when the list was read. Poll with since=cursor.
	Cursor int64 `json:"cursor" doc:"Poll with since=cursor to get what changes next"`
}

// GmSettingsResponse is a game's board settings.
type GmSettingsResponse struct {
	Items        []GmItemResponse `json:"items" nullable:"false" doc:"A full load has live items only; a poll (since) includes tombstones"`
	Cursor       int64            `json:"cursor" doc:"Poll with since=cursor to get what changes next"`
	ShareGmBoard bool             `json:"share_gm_board" doc:"Whether the GM shares the results boards read-only"`
}

// GmItemsWrittenResponse is the batch as written.
type GmItemsWrittenResponse struct {
	Items []GmItemResponse `json:"items" nullable:"false" doc:"Each change as written, with its new version. Don't advance a poll cursor from these: that could skip another editor's write"`
}

// SharingResponse is the sharing setting after a change.
type SharingResponse struct {
	ShareGmBoard bool `json:"share_gm_board" doc:"Whether the GM shares the results boards read-only"`
}

// GmBoardConflictResponse is the 409 body of a changes request. It is an RFC
// 7807 problem document like every other error, plus the server's copy of
// each item the batch named at a stale version. Nothing in the batch was
// written. A 409 without conflicts means the game is archived.
type GmBoardConflictResponse struct {
	Status    int              `json:"status" doc:"HTTP status code"`
	Title     string           `json:"title" doc:"Short summary"`
	Detail    string           `json:"detail" doc:"What happened"`
	Instance  string           `json:"instance,omitempty" doc:"Correlation ID for support"`
	Conflicts []GmItemResponse `json:"conflicts,omitempty" nullable:"false" doc:"The current copy of each conflicting item; absent when the game is archived"`
}

func (e *GmBoardConflictResponse) Error() string  { return e.Detail }
func (e *GmBoardConflictResponse) GetStatus() int { return e.Status }

// ContentType makes it a problem document on the wire, like huma's own errors.
func (e *GmBoardConflictResponse) ContentType(ct string) string {
	if ct == "application/json" {
		return "application/problem+json"
	}
	return ct
}

func newConflictResponse(err *core.GmBoardConflictError, instance string) *GmBoardConflictResponse {
	return &GmBoardConflictResponse{
		Status:    http.StatusConflict,
		Title:     http.StatusText(http.StatusConflict),
		Detail:    "Another editor changed an item you were editing. Nothing in this save was written.",
		Instance:  instance,
		Conflicts: toItemResponses(err.Current),
	}
}

func toItemResponse(it core.GmBoardItem) GmItemResponse {
	out := GmItemResponse{
		Kind: it.Kind, Key: it.Key, Version: it.Version, Seq: it.Seq,
		Deleted: it.Deleted, Doc: it.Doc, UpdatedBy: it.UpdatedBy,
	}
	if !it.UpdatedAt.IsZero() {
		at := it.UpdatedAt
		out.UpdatedAt = &at
	}
	return out
}

func toItemResponses(items []core.GmBoardItem) []GmItemResponse {
	out := make([]GmItemResponse, len(items))
	for i, it := range items {
		out[i] = toItemResponse(it)
	}
	return out
}
