package actions

import (
	"context"
	"sync"
	"testing"

	core "actionphase/pkg/core"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func firstDraftEnv(t *testing.T) (*stagedTestEnv, int32, core.CreateActionResultRequest) {
	t.Helper()
	env := setupStagedTest(t)
	app := core.NewTestApp(env.testDB.Pool)
	characters := &db.CharacterService{DB: env.testDB.Pool, Logger: app.ObsLogger}
	userID := env.playerID
	character, err := characters.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID: env.gameID, UserID: &userID, Name: "Mara", CharacterType: "player_character",
	})
	require.NoError(t, err)
	id := character.ID
	return env, id, core.CreateActionResultRequest{
		GameID: env.gameID, PhaseID: env.phaseID, UserID: env.playerID, CharacterID: &id, Content: "Mine", FirstDraft: true,
	}
}

func TestFirstDraft_ReturnsTheDraftAlreadyThere(t *testing.T) {
	env, _, req := firstDraftEnv(t)
	ctx := context.Background()

	first, err := env.actionService.CreateActionResult(ctx, req)
	require.NoError(t, err)

	req.Content = "Someone else's"
	second, err := env.actionService.CreateActionResult(ctx, req)
	require.NoError(t, err)
	assert.Equal(t, first.ID, second.ID)
	assert.Equal(t, "Mine", second.Content, "the existing draft is returned unchanged")
}

func TestFirstDraft_StartsANewOneWhenTheirResultsArePublished(t *testing.T) {
	env, _, req := firstDraftEnv(t)
	ctx := context.Background()

	first, err := env.actionService.CreateActionResult(ctx, req)
	require.NoError(t, err)
	require.NoError(t, env.actionService.PublishActionResult(ctx, first.ID, env.gmID))

	second, err := env.actionService.CreateActionResult(ctx, req)
	require.NoError(t, err)
	assert.NotEqual(t, first.ID, second.ID)
}

// A second result on purpose (+ Result) doesn't ask for the first draft.
func TestFirstDraft_WithoutTheFlagAnotherResultIsMade(t *testing.T) {
	env, _, req := firstDraftEnv(t)
	ctx := context.Background()

	first, err := env.actionService.CreateActionResult(ctx, req)
	require.NoError(t, err)
	req.FirstDraft = false
	second, err := env.actionService.CreateActionResult(ctx, req)
	require.NoError(t, err)
	assert.NotEqual(t, first.ID, second.ID)
}

func TestFirstDraft_SimultaneousRequestsMakeOneDraft(t *testing.T) {
	env, _, req := firstDraftEnv(t)
	ctx := context.Background()

	const callers = 8
	ids := make([]int32, callers)
	errs := make([]error, callers)
	var wg sync.WaitGroup
	for i := 0; i < callers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			result, err := env.actionService.CreateActionResult(ctx, req)
			errs[i] = err
			if err == nil {
				ids[i] = result.ID
			}
		}(i)
	}
	wg.Wait()
	for i := 0; i < callers; i++ {
		require.NoError(t, errs[i])
		assert.Equal(t, ids[0], ids[i])
	}
}
