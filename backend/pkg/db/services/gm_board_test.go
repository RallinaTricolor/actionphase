package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// gmBoardFixture is a GM, their in-progress game and one action phase.
type gmBoardFixture struct {
	db     *core.TestDatabase
	svc    *GmBoardService
	gm     *core.User
	game   *models.Game
	phase  *models.GamePhase
	nextID int
}

func newGmBoardFixture(t *testing.T, name string) *gmBoardFixture {
	t.Helper()
	testDB := core.NewTestDatabase(t)
	t.Cleanup(testDB.Close)
	gm := testDB.CreateTestUser(t, "gmb_"+name, "gmb_"+name+"@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Board "+name)
	testDB.SetGameStateDirectly(t, game.ID, core.GameStateInProgress)
	phase := testDB.CreateTestPhase(t, game.ID, core.PhaseTypeAction, "Day 1")
	return &gmBoardFixture{db: testDB, svc: &GmBoardService{DB: testDB.Pool}, gm: gm, game: game, phase: phase}
}

func doc(s string) json.RawMessage { return json.RawMessage(s) }

func put(kind, key string, base int32, body string) core.GmBoardChange {
	return core.GmBoardChange{Kind: kind, Key: key, BaseVersion: base, Doc: doc(body)}
}

func del(kind, key string, base int32) core.GmBoardChange {
	return core.GmBoardChange{Kind: kind, Key: key, BaseVersion: base, Deleted: true}
}

func (f *gmBoardFixture) apply(t *testing.T, changes ...core.GmBoardChange) []core.GmBoardItem {
	t.Helper()
	items, err := f.svc.ApplyBoardChanges(context.Background(), f.phase.ID, int32(f.gm.ID), changes)
	require.NoError(t, err)
	return items
}

func (f *gmBoardFixture) list(t *testing.T, since *int64) *core.GmBoardItems {
	t.Helper()
	out, err := f.svc.ListBoardItems(context.Background(), f.phase.ID, since)
	require.NoError(t, err)
	return out
}

func keysOf(items []core.GmBoardItem) []string {
	out := make([]string, len(items))
	for i, it := range items {
		out[i] = it.Kind + "/" + it.Key
	}
	return out
}

func TestGmBoard_WritesBumpVersionsAndDeletesAreTombstones(t *testing.T) {
	f := newGmBoardFixture(t, "lifecycle")

	created := f.apply(t, put("card", "c1", 0, `{"summary":"plant the sword"}`), put("notes", "notes", 0, `{"text":"hi"}`))
	require.Len(t, created, 2)
	assert.Equal(t, int32(1), created[0].Version)
	assert.Equal(t, int32(f.gm.ID), *created[0].UpdatedBy)

	updated := f.apply(t, put("card", "c1", 1, `{"summary":"launch"}`))
	assert.Equal(t, int32(2), updated[0].Version)
	assert.Greater(t, updated[0].Seq, created[1].Seq, "every write draws a new seq")
	assert.JSONEq(t, `{"summary":"launch"}`, string(updated[0].Doc))

	cursorBeforeDelete := f.list(t, nil).Cursor
	deleted := f.apply(t, del("card", "c1", 2))
	assert.True(t, deleted[0].Deleted)
	assert.Equal(t, int32(3), deleted[0].Version)
	assert.Nil(t, deleted[0].Doc, "a tombstone keeps no doc")

	full := f.list(t, nil)
	assert.Equal(t, []string{"notes/notes"}, keysOf(full.Items), "a full load leaves tombstones out")
	assert.Equal(t, deleted[0].Seq, full.Cursor, "the cursor counts the tombstone")

	changed := f.list(t, &cursorBeforeDelete)
	require.Len(t, changed.Items, 1, "a since poll reports the delete")
	assert.True(t, changed.Items[0].Deleted)

	none := f.list(t, &full.Cursor)
	assert.Empty(t, none.Items)
	assert.Equal(t, full.Cursor, none.Cursor)
}

func TestGmBoard_StaleVersionRefusesTheWholeBatch(t *testing.T) {
	f := newGmBoardFixture(t, "stale")
	f.apply(t, put("card", "c1", 0, `{"v":1}`))
	f.apply(t, put("card", "c1", 1, `{"v":2}`)) // another tab's save

	_, err := f.svc.ApplyBoardChanges(context.Background(), f.phase.ID, int32(f.gm.ID), []core.GmBoardChange{
		put("card", "c2", 0, `{"new":true}`),
		put("card", "c1", 1, `{"v":"mine"}`),
		put("card", "ghost", 4, `{}`), // the client thinks it exists; it doesn't
	})
	var conflict *core.GmBoardConflictError
	require.ErrorAs(t, err, &conflict)
	require.Len(t, conflict.Current, 2)
	assert.Equal(t, "c1", conflict.Current[0].Key)
	assert.Equal(t, int32(2), conflict.Current[0].Version)
	assert.JSONEq(t, `{"v":2}`, string(conflict.Current[0].Doc), "the conflict carries the server copy")
	assert.Equal(t, "ghost", conflict.Current[1].Key)
	assert.True(t, conflict.Current[1].Deleted)
	assert.Equal(t, int32(0), conflict.Current[1].Version)

	assert.Equal(t, []string{"card/c1"}, keysOf(f.list(t, nil).Items), "nothing in the refused batch was written, c2 included")
}

func TestGmBoard_BatchesOnDifferentItemsBothLand(t *testing.T) {
	f := newGmBoardFixture(t, "disjoint")
	f.apply(t, put("card", "a", 0, `{}`), put("card", "b", 0, `{}`))

	// Two tabs, each based on version 1, each editing a different item.
	f.apply(t, put("card", "a", 1, `{"by":"tab1"}`))
	f.apply(t, put("card", "b", 1, `{"by":"tab2"}`))

	items := f.list(t, nil).Items
	require.Len(t, items, 2)
	for _, it := range items {
		assert.Equal(t, int32(2), it.Version, it.Key)
	}
}

func TestGmBoard_FixedKeyCanBeCreatedAgainAfterDelete(t *testing.T) {
	f := newGmBoardFixture(t, "recreate")
	f.apply(t, put("stance", "1|2", 0, `{"value":"ally"}`))
	f.apply(t, del("stance", "1|2", 1))

	again := f.apply(t, put("stance", "1|2", 0, `{"value":"wary"}`))
	assert.Equal(t, int32(3), again[0].Version, "the version continues from the tombstone")
	assert.False(t, again[0].Deleted)

	// A client still holding the version from before the delete is stale.
	_, err := f.svc.ApplyBoardChanges(context.Background(), f.phase.ID, int32(f.gm.ID),
		[]core.GmBoardChange{put("stance", "1|2", 1, `{"value":"target"}`)})
	var conflict *core.GmBoardConflictError
	require.ErrorAs(t, err, &conflict)
}

func TestGmBoard_DeletingWhatIsAlreadyGoneWritesNothing(t *testing.T) {
	f := newGmBoardFixture(t, "deletegone")
	before := f.list(t, nil).Cursor

	items := f.apply(t, del("card", "never", 0))
	require.Len(t, items, 1)
	assert.True(t, items[0].Deleted)
	assert.Equal(t, before, f.list(t, nil).Cursor, "no row, no seq drawn")
}

func TestGmBoard_OnlyActionPhasesHaveABoard(t *testing.T) {
	f := newGmBoardFixture(t, "phasetype")
	commonRoom := f.db.CreateTestPhase(t, f.game.ID, core.PhaseTypeCommonRoom, "Discussion")

	_, err := f.svc.ListBoardItems(context.Background(), commonRoom.ID, nil)
	assert.ErrorIs(t, err, core.ErrGmBoardNotActionPhase)
	_, err = f.svc.ApplyBoardChanges(context.Background(), commonRoom.ID, int32(f.gm.ID), []core.GmBoardChange{put("notes", "notes", 0, `{}`)})
	assert.ErrorIs(t, err, core.ErrGmBoardNotActionPhase)
}

func TestGmBoard_ArchivedGameRefusesWritesButNotSharing(t *testing.T) {
	f := newGmBoardFixture(t, "archived")
	f.apply(t, put("notes", "notes", 0, `{"text":"kept"}`))
	f.db.SetGameStateDirectly(t, f.game.ID, core.GameStateCompleted)
	ctx := context.Background()

	_, err := f.svc.ApplyBoardChanges(ctx, f.phase.ID, int32(f.gm.ID), []core.GmBoardChange{put("notes", "notes", 1, `{}`)})
	assert.ErrorIs(t, err, core.ErrGameReadOnly)
	_, err = f.svc.ApplySettingsChanges(ctx, f.game.ID, int32(f.gm.ID), []core.GmBoardChange{put("codex", "x", 0, `{}`)})
	assert.ErrorIs(t, err, core.ErrGameReadOnly)

	assert.Len(t, f.list(t, nil).Items, 1, "an archived board still reads")

	shared, err := f.svc.SetShareGmBoard(ctx, f.game.ID, true)
	require.NoError(t, err)
	assert.True(t, shared, "sharing a finished game's boards is allowed")
}

func TestGmBoard_EpilogueStaysWritable(t *testing.T) {
	f := newGmBoardFixture(t, "epilogue")
	f.db.SetGameStateDirectly(t, f.game.ID, core.GameStateEpilogue)
	f.apply(t, put("notes", "notes", 0, `{}`))
}

func TestGmBoard_BatchValidation(t *testing.T) {
	f := newGmBoardFixture(t, "validation")
	ctx := context.Background()
	apply := func(changes ...core.GmBoardChange) error {
		_, err := f.svc.ApplyBoardChanges(ctx, f.phase.ID, int32(f.gm.ID), changes)
		return err
	}

	assert.ErrorIs(t, apply(put("card", "a", 0, `{}`), put("card", "a", 0, `{}`)), core.ErrGmBoardDuplicateChange)
	assert.NoError(t, apply(put("card", "a", 0, `{}`), put("scene", "a", 0, `{}`)), "the same key under two kinds is two items")
	assert.ErrorIs(t, apply(core.GmBoardChange{Kind: "card", Key: "b"}), core.ErrGmBoardMissingDoc)
	assert.ErrorIs(t, apply(put("card", "b", 0, `null`)), core.ErrGmBoardMissingDoc)

	big := fmt.Sprintf(`{"text":%q}`, strings.Repeat("x", core.MaxGmBoardItemBytes))
	err := apply(put("scene", "big", 0, big))
	assert.ErrorIs(t, err, core.ErrGmBoardItemTooLarge)
	assert.Contains(t, err.Error(), `scene "big"`, "the error names the item")
}

func TestGmBoard_ItemCap(t *testing.T) {
	f := newGmBoardFixture(t, "cap")
	ctx := context.Background()
	_, err := f.db.Pool.Exec(ctx, `
		INSERT INTO gm_board_items (phase_id, kind, item_key, game_id, doc, version)
		SELECT $1, 'card', 'seed' || g, $2, '{}', 1 FROM generate_series(1, $3::int) g`,
		f.phase.ID, f.game.ID, core.MaxGmBoardItemsPerPhase)
	require.NoError(t, err)

	_, err = f.svc.ApplyBoardChanges(ctx, f.phase.ID, int32(f.gm.ID), []core.GmBoardChange{put("card", "one-more", 0, `{}`)})
	assert.ErrorIs(t, err, core.ErrGmBoardTooManyItems)

	// At the cap, a delete plus a create in one batch still fits.
	f.apply(t, del("card", "seed1", 1), put("card", "one-more", 0, `{}`))
}

// Writers draw seq before they commit, so without the board lock a writer
// that drew a lower seq could commit after a poller had already moved past
// it, and the poller would never see that write. Many concurrent writers and
// a poller: the poller must end up with every write.
func TestGmBoard_PollerNeverSkipsAConcurrentWrite(t *testing.T) {
	f := newGmBoardFixture(t, "poller")
	ctx := context.Background()
	const writers, writesEach = 8, 15

	seen := map[string]int32{}
	var cursor int64
	poll := func() {
		out, err := f.svc.ListBoardItems(ctx, f.phase.ID, &cursor)
		require.NoError(t, err)
		for _, it := range out.Items {
			seen[it.Key] = it.Version
		}
		cursor = out.Cursor
	}

	var wg sync.WaitGroup
	done := make(chan struct{})
	for w := 0; w < writers; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			key := fmt.Sprintf("card-%d", w)
			for v := int32(0); v < writesEach; v++ {
				_, err := f.svc.ApplyBoardChanges(ctx, f.phase.ID, int32(f.gm.ID), []core.GmBoardChange{put("card", key, v, `{}`)})
				if !assert.NoError(t, err) {
					return
				}
			}
		}(w)
	}
	go func() { wg.Wait(); close(done) }()
	for polling := true; polling; {
		select {
		case <-done:
			polling = false
		default:
			poll()
		}
	}
	poll()

	require.Len(t, seen, writers)
	for key, v := range seen {
		assert.Equal(t, int32(writesEach), v, "%s: the poller missed its last write", key)
	}
}

func TestGmSettings_ScopedToTheGame(t *testing.T) {
	f := newGmBoardFixture(t, "settings")
	other := f.db.CreateTestGame(t, int32(f.gm.ID), "Other game")
	ctx := context.Background()

	_, err := f.svc.ApplySettingsChanges(ctx, f.game.ID, int32(f.gm.ID), []core.GmBoardChange{put("codex", "loc1", 0, `{"name":"Hangar"}`)})
	require.NoError(t, err)

	mine, err := f.svc.ListSettingsItems(ctx, f.game.ID, nil)
	require.NoError(t, err)
	assert.Equal(t, []string{"codex/loc1"}, keysOf(mine.Items))

	theirs, err := f.svc.ListSettingsItems(ctx, other.ID, nil)
	require.NoError(t, err)
	assert.Empty(t, theirs.Items)

	// Settings exist before any phase does: the other game has none.
	_, err = f.svc.ApplySettingsChanges(ctx, other.ID, int32(f.gm.ID), []core.GmBoardChange{put("template", "template", 0, `{"text":""}`)})
	require.NoError(t, err)

	_, err = f.svc.ApplySettingsChanges(ctx, f.game.ID, int32(f.gm.ID), []core.GmBoardChange{put("codex", "loc1", 0, `{}`)})
	var conflict *core.GmBoardConflictError
	assert.True(t, errors.As(err, &conflict), "settings get the same version check")
}
