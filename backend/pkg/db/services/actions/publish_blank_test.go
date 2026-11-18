package actions

import (
	"context"
	"testing"

	core "actionphase/pkg/core"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPublish_RefusesResultsWithNoText(t *testing.T) {
	env := setupStagedTest(t)
	ctx := context.Background()
	app := core.NewTestApp(env.testDB.Pool)
	characters := &db.CharacterService{DB: env.testDB.Pool, Logger: app.ObsLogger}
	userID := env.playerID
	character, err := characters.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID: env.gameID, UserID: &userID, Name: "Rook", CharacterType: "player_character",
	})
	require.NoError(t, err)
	characterID := character.ID

	draft := func(content string) int32 {
		t.Helper()
		result, err := env.actionService.CreateActionResult(ctx, core.CreateActionResultRequest{
			GameID: env.gameID, PhaseID: env.phaseID, UserID: env.playerID, CharacterID: &characterID, Content: content,
		})
		require.NoError(t, err)
		return result.ID
	}

	written := draft("Something happened.")
	blank := draft("   ")

	t.Run("publishing a blank result is refused", func(t *testing.T) {
		assert.ErrorIs(t, env.actionService.PublishActionResult(ctx, blank, env.gmID), core.ErrEmptyResult)
	})

	t.Run("a chain with text in only some parts is refused", func(t *testing.T) {
		head := draft("")
		_, err := env.actionService.AppendStagedPart(ctx, head, core.StagedResultPart{Content: "Later.", DelayMinutes: 5})
		require.NoError(t, err)
		assert.ErrorIs(t, env.actionService.PublishActionResult(ctx, head, env.gmID), core.ErrEmptyResult)
		require.NoError(t, env.actionService.DeleteActionResult(ctx, head))
	})

	t.Run("publish all names who is blank and publishes nothing", func(t *testing.T) {
		err := env.actionService.PublishAllPhaseResults(ctx, env.phaseID)
		require.ErrorIs(t, err, core.ErrEmptyResult)
		assert.Contains(t, err.Error(), "Rook")
		current, err := env.actionService.GetActionResult(ctx, written)
		require.NoError(t, err)
		assert.False(t, current.IsPublished.Bool)
	})

	t.Run("once the blank draft is gone, everything publishes", func(t *testing.T) {
		require.NoError(t, env.actionService.DeleteActionResult(ctx, blank))
		require.NoError(t, env.actionService.PublishAllPhaseResults(ctx, env.phaseID))
		current, err := env.actionService.GetActionResult(ctx, written)
		require.NoError(t, err)
		assert.True(t, current.IsPublished.Bool)
	})
}
