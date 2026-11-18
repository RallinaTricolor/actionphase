package core

import (
	"encoding/json"
	"errors"
	"time"
)

// The GM results board stores its working state one item per row: a card, a
// scene, a stance, and so on, each a JSON doc the client owns the shape of.
// Two GMs (or two tabs) only collide when they change the same item. There are
// two stores with the same rules: board items per action phase, and settings
// items per game (codex, names, reward template).
//
// Saving: a client sends a batch of changes, each naming the version it was
// based on. The batch is applied in one transaction, or not at all: if any
// item's version is stale, nothing is written and the caller gets the current
// copy of every conflicting item (GmBoardConflictError).
//
// Seeing others' edits: every write draws a new seq from one sequence, and a
// client polls for items with seq above the cursor it last saw. Deletes are
// tombstones, so pollers learn about them.

// GM board item kinds. A new kind is added here and to the request enum.
var (
	GmBoardItemKinds    = []string{"card", "scene", "chunk", "cluster", "stance", "progress", "flag", "notes", "reward", "rewards"}
	GmSettingsItemKinds = []string{"codex", "names", "template", "groups", "scales", "prefs", "reward", "notes"}
)

// Size caps. MaxGmBoardItemBytes bounds one item's doc; the largest item is a
// scene with all its moments. The count caps bound live items on one board, or
// in one game's settings; a busy phase (8 players) runs to a few hundred.
const (
	MaxGmBoardItemBytes     = 64 * 1024
	MaxGmBoardItemsPerPhase = 5000
	MaxGmSettingsItems      = 2000
	MaxGmBoardChangesPerReq = 500
)

// GmBoardItem is one stored item. A tombstone (Deleted) has no Doc.
type GmBoardItem struct {
	Kind      string
	Key       string
	Doc       json.RawMessage
	Version   int32
	Seq       int64
	Deleted   bool
	UpdatedAt time.Time
	UpdatedBy *int32
}

// GmBoardChange is one write in a batch. BaseVersion is the version the client
// last saw; 0 means it believes the item does not exist (never created, or
// deleted), which also lets an item with a fixed key, such as a stance, be
// created again after a delete.
type GmBoardChange struct {
	Kind        string
	Key         string
	BaseVersion int32
	Doc         json.RawMessage
	Deleted     bool
}

// GmBoardItems is a list of items and the cursor to poll from next: the
// highest seq on the board when the list was read.
type GmBoardItems struct {
	Items  []GmBoardItem
	Cursor int64
}

// GmBoardConflictError is returned when a batch names a stale version. Current
// holds the server's copy of each conflicting item; an item that does not
// exist is reported as a tombstone at version 0. Nothing in the batch was
// written.
type GmBoardConflictError struct {
	Current []GmBoardItem
}

func (e *GmBoardConflictError) Error() string {
	return "another editor changed an item in this batch"
}

var (
	// ErrGmBoardNotActionPhase: results boards exist only for action phases.
	ErrGmBoardNotActionPhase = errors.New("only action phases have a results board")
	// ErrGmBoardItemTooLarge wraps the item that is over MaxGmBoardItemBytes.
	ErrGmBoardItemTooLarge = errors.New("item is too large")
	// ErrGmBoardTooManyItems: the batch would take the board past its item cap.
	ErrGmBoardTooManyItems = errors.New("the board has too many items")
	// ErrGmBoardDuplicateChange wraps an item named twice in one batch.
	ErrGmBoardDuplicateChange = errors.New("an item appears more than once in this batch")
	// ErrGmBoardMissingDoc wraps a non-delete change with no doc.
	ErrGmBoardMissingDoc = errors.New("a change that isn't a delete needs a doc")
)
