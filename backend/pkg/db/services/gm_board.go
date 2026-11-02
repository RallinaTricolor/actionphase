package db

import (
	"context"
	"encoding/json"
	"fmt"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// GmBoardService stores GM results board items (per action phase) and GM
// settings items (per game). See core/gm_board.go for the model.
type GmBoardService struct {
	DB *pgxpool.Pool
}

var _ core.GmBoardServiceInterface = (*GmBoardService)(nil)

// gmItemStore is what differs between the two tables. Everything else (the
// version rules, caps and all-or-nothing batches) is shared, so the rules
// can't drift apart.
type gmItemStore struct {
	lock      func(ctx context.Context, q *models.Queries) error
	byKeys    func(ctx context.Context, q *models.Queries, kinds, keys []string) ([]core.GmBoardItem, error)
	upsert    func(ctx context.Context, q *models.Queries, c core.GmBoardChange, version int32, userID int32) (core.GmBoardItem, error)
	countLive func(ctx context.Context, q *models.Queries) (int32, error)
	list      func(ctx context.Context, q *models.Queries) ([]core.GmBoardItem, error)
	since     func(ctx context.Context, q *models.Queries, seq int64) ([]core.GmBoardItem, error)
	cursor    func(ctx context.Context, q *models.Queries) (int64, error)
	maxItems  int32
}

func (s *GmBoardService) boardStore(phase models.GamePhase) gmItemStore {
	return gmItemStore{
		lock: func(ctx context.Context, q *models.Queries) error { return q.LockGmBoard(ctx, phase.ID) },
		byKeys: func(ctx context.Context, q *models.Queries, kinds, keys []string) ([]core.GmBoardItem, error) {
			rows, err := q.GetGmBoardItemsByKeys(ctx, models.GetGmBoardItemsByKeysParams{PhaseID: phase.ID, Kinds: kinds, ItemKeys: keys})
			return mapRows(rows, boardItemToCore), err
		},
		upsert: func(ctx context.Context, q *models.Queries, c core.GmBoardChange, version int32, userID int32) (core.GmBoardItem, error) {
			row, err := q.UpsertGmBoardItem(ctx, models.UpsertGmBoardItemParams{
				PhaseID: phase.ID, Kind: c.Kind, ItemKey: c.Key, GameID: phase.GameID,
				Doc: storedDoc(c), Version: version, Deleted: c.Deleted,
				UpdatedBy: pgtype.Int4{Int32: userID, Valid: true},
			})
			return boardItemToCore(row), err
		},
		countLive: func(ctx context.Context, q *models.Queries) (int32, error) {
			return q.CountLiveGmBoardItems(ctx, phase.ID)
		},
		list: func(ctx context.Context, q *models.Queries) ([]core.GmBoardItem, error) {
			rows, err := q.ListGmBoardItems(ctx, phase.ID)
			return mapRows(rows, boardItemToCore), err
		},
		since: func(ctx context.Context, q *models.Queries, seq int64) ([]core.GmBoardItem, error) {
			rows, err := q.ListGmBoardItemsSince(ctx, models.ListGmBoardItemsSinceParams{PhaseID: phase.ID, Seq: seq})
			return mapRows(rows, boardItemToCore), err
		},
		cursor:   func(ctx context.Context, q *models.Queries) (int64, error) { return q.GetGmBoardCursor(ctx, phase.ID) },
		maxItems: core.MaxGmBoardItemsPerPhase,
	}
}

func (s *GmBoardService) settingsStore(gameID int32) gmItemStore {
	return gmItemStore{
		lock: func(ctx context.Context, q *models.Queries) error { return q.LockGmSettings(ctx, gameID) },
		byKeys: func(ctx context.Context, q *models.Queries, kinds, keys []string) ([]core.GmBoardItem, error) {
			rows, err := q.GetGmSettingsItemsByKeys(ctx, models.GetGmSettingsItemsByKeysParams{GameID: gameID, Kinds: kinds, ItemKeys: keys})
			return mapRows(rows, settingsItemToCore), err
		},
		upsert: func(ctx context.Context, q *models.Queries, c core.GmBoardChange, version int32, userID int32) (core.GmBoardItem, error) {
			row, err := q.UpsertGmSettingsItem(ctx, models.UpsertGmSettingsItemParams{
				GameID: gameID, Kind: c.Kind, ItemKey: c.Key,
				Doc: storedDoc(c), Version: version, Deleted: c.Deleted,
				UpdatedBy: pgtype.Int4{Int32: userID, Valid: true},
			})
			return settingsItemToCore(row), err
		},
		countLive: func(ctx context.Context, q *models.Queries) (int32, error) {
			return q.CountLiveGmSettingsItems(ctx, gameID)
		},
		list: func(ctx context.Context, q *models.Queries) ([]core.GmBoardItem, error) {
			rows, err := q.ListGmSettingsItems(ctx, gameID)
			return mapRows(rows, settingsItemToCore), err
		},
		since: func(ctx context.Context, q *models.Queries, seq int64) ([]core.GmBoardItem, error) {
			rows, err := q.ListGmSettingsItemsSince(ctx, models.ListGmSettingsItemsSinceParams{GameID: gameID, Seq: seq})
			return mapRows(rows, settingsItemToCore), err
		},
		cursor:   func(ctx context.Context, q *models.Queries) (int64, error) { return q.GetGmSettingsCursor(ctx, gameID) },
		maxItems: core.MaxGmSettingsItems,
	}
}

// actionPhase loads the phase, refusing one that isn't an action phase.
// phase_type never changes after a phase is created, so checking it here, on
// every request, is as good as a constraint.
func (s *GmBoardService) actionPhase(ctx context.Context, phaseID int32) (models.GamePhase, error) {
	phase, err := models.New(s.DB).GetPhase(ctx, phaseID)
	if err != nil {
		return phase, err
	}
	if phase.PhaseType != core.PhaseTypeAction {
		return phase, core.ErrGmBoardNotActionPhase
	}
	return phase, nil
}

// writableGame refuses writes to a completed or cancelled game
// (core.ErrGameReadOnly). Epilogue stays writable, as everywhere else.
func (s *GmBoardService) writableGame(ctx context.Context, gameID int32) error {
	game, err := models.New(s.DB).GetGame(ctx, gameID)
	if err != nil {
		return err
	}
	return core.ValidateGameNotCompleted(ctx, &game)
}

func (s *GmBoardService) ListBoardItems(ctx context.Context, phaseID int32, since *int64) (*core.GmBoardItems, error) {
	phase, err := s.actionPhase(ctx, phaseID)
	if err != nil {
		return nil, err
	}
	return s.listItems(ctx, s.boardStore(phase), since)
}

func (s *GmBoardService) ApplyBoardChanges(ctx context.Context, phaseID, userID int32, changes []core.GmBoardChange) ([]core.GmBoardItem, error) {
	phase, err := s.actionPhase(ctx, phaseID)
	if err != nil {
		return nil, err
	}
	if err := s.writableGame(ctx, phase.GameID); err != nil {
		return nil, err
	}
	return s.applyChanges(ctx, s.boardStore(phase), userID, changes)
}

func (s *GmBoardService) ListSettingsItems(ctx context.Context, gameID int32, since *int64) (*core.GmBoardItems, error) {
	return s.listItems(ctx, s.settingsStore(gameID), since)
}

func (s *GmBoardService) ApplySettingsChanges(ctx context.Context, gameID, userID int32, changes []core.GmBoardChange) ([]core.GmBoardItem, error) {
	if err := s.writableGame(ctx, gameID); err != nil {
		return nil, err
	}
	return s.applyChanges(ctx, s.settingsStore(gameID), userID, changes)
}

// SetShareGmBoard works in any game state: sharing a finished game's boards
// is half the point of the setting, so it isn't gated on the game being
// writable.
func (s *GmBoardService) SetShareGmBoard(ctx context.Context, gameID int32, share bool) (bool, error) {
	return models.New(s.DB).SetGameShareGmBoard(ctx, models.SetGameShareGmBoardParams{ID: gameID, ShareGmBoard: share})
}

// listItems reads the items and the cursor in one snapshot, so the cursor
// never runs ahead of the items returned with it.
func (s *GmBoardService) listItems(ctx context.Context, store gmItemStore, since *int64) (*core.GmBoardItems, error) {
	out := &core.GmBoardItems{}
	err := pgx.BeginTxFunc(ctx, s.DB, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly}, func(tx pgx.Tx) error {
		q := models.New(tx)
		var err error
		if since == nil {
			out.Items, err = store.list(ctx, q)
		} else {
			out.Items, err = store.since(ctx, q, *since)
		}
		if err != nil {
			return err
		}
		out.Cursor, err = store.cursor(ctx, q)
		return err
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}

// applyChanges writes a batch in one transaction, or nothing. Under the
// store's lock it compares every change's base version with the stored row;
// any mismatch rolls back with the current copies of the mismatched items.
//
// A base version matches when it equals the stored version, or when it is 0
// and the item is absent or a tombstone. A delete of an item that is already
// absent or deleted writes nothing and reports the item as it stands.
func (s *GmBoardService) applyChanges(ctx context.Context, store gmItemStore, userID int32, changes []core.GmBoardChange) ([]core.GmBoardItem, error) {
	if err := validateChanges(changes); err != nil {
		return nil, err
	}

	var written []core.GmBoardItem
	err := pgx.BeginFunc(ctx, s.DB, func(tx pgx.Tx) error {
		q := models.New(tx)
		if err := store.lock(ctx, q); err != nil {
			return err
		}

		kinds := make([]string, len(changes))
		keys := make([]string, len(changes))
		for i, c := range changes {
			kinds[i], keys[i] = c.Kind, c.Key
		}
		rows, err := store.byKeys(ctx, q, kinds, keys)
		if err != nil {
			return err
		}
		current := make(map[[2]string]core.GmBoardItem, len(rows))
		for _, r := range rows {
			current[[2]string{r.Kind, r.Key}] = r
		}

		var conflicts []core.GmBoardItem
		for _, c := range changes {
			cur, exists := current[[2]string{c.Kind, c.Key}]
			if !exists {
				cur = core.GmBoardItem{Kind: c.Kind, Key: c.Key, Deleted: true}
			}
			matches := c.BaseVersion == cur.Version || (c.BaseVersion == 0 && cur.Deleted)
			if !matches {
				conflicts = append(conflicts, cur)
			}
		}
		if len(conflicts) > 0 {
			return &core.GmBoardConflictError{Current: conflicts}
		}

		written = make([]core.GmBoardItem, 0, len(changes))
		for _, c := range changes {
			cur, exists := current[[2]string{c.Kind, c.Key}]
			if c.Deleted && (!exists || cur.Deleted) {
				if !exists {
					cur = core.GmBoardItem{Kind: c.Kind, Key: c.Key, Deleted: true}
				}
				written = append(written, cur)
				continue
			}
			// A recreated tombstone continues its version, so a client still
			// holding the deleted copy's version can't match the new one.
			item, err := store.upsert(ctx, q, c, cur.Version+1, userID)
			if err != nil {
				return fmt.Errorf("write %s %q: %w", c.Kind, c.Key, err)
			}
			written = append(written, item)
		}

		live, err := store.countLive(ctx, q)
		if err != nil {
			return err
		}
		if live > store.maxItems {
			return fmt.Errorf("%w (at most %d)", core.ErrGmBoardTooManyItems, store.maxItems)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return written, nil
}

// validateChanges checks what doesn't need the database: no item twice, a doc
// on every non-delete, and the size cap.
func validateChanges(changes []core.GmBoardChange) error {
	seen := make(map[[2]string]bool, len(changes))
	for _, c := range changes {
		k := [2]string{c.Kind, c.Key}
		if seen[k] {
			return fmt.Errorf("%w: %s %q", core.ErrGmBoardDuplicateChange, c.Kind, c.Key)
		}
		seen[k] = true
		if c.Deleted {
			continue
		}
		if len(c.Doc) == 0 || string(c.Doc) == "null" {
			return fmt.Errorf("%w: %s %q", core.ErrGmBoardMissingDoc, c.Kind, c.Key)
		}
		if len(c.Doc) > core.MaxGmBoardItemBytes {
			return fmt.Errorf("%w: %s %q is %d KB (at most %d KB)", core.ErrGmBoardItemTooLarge,
				c.Kind, c.Key, len(c.Doc)/1024, core.MaxGmBoardItemBytes/1024)
		}
	}
	return nil
}

// storedDoc is the doc to store: none for a tombstone.
func storedDoc(c core.GmBoardChange) []byte {
	if c.Deleted {
		return nil
	}
	return c.Doc
}

func mapRows[T any](rows []T, f func(T) core.GmBoardItem) []core.GmBoardItem {
	out := make([]core.GmBoardItem, len(rows))
	for i, r := range rows {
		out[i] = f(r)
	}
	return out
}

func boardItemToCore(r models.GmBoardItem) core.GmBoardItem {
	return gmItem(r.Kind, r.ItemKey, r.Doc, r.Version, r.Seq, r.Deleted, r.UpdatedAt, r.UpdatedBy)
}

func settingsItemToCore(r models.GmSettingsItem) core.GmBoardItem {
	return gmItem(r.Kind, r.ItemKey, r.Doc, r.Version, r.Seq, r.Deleted, r.UpdatedAt, r.UpdatedBy)
}

func gmItem(kind, key string, doc []byte, version int32, seq int64, deleted bool, at pgtype.Timestamptz, by pgtype.Int4) core.GmBoardItem {
	item := core.GmBoardItem{Kind: kind, Key: key, Version: version, Seq: seq, Deleted: deleted, UpdatedAt: at.Time}
	if len(doc) > 0 {
		item.Doc = json.RawMessage(doc)
	}
	if by.Valid {
		id := by.Int32
		item.UpdatedBy = &id
	}
	return item
}
