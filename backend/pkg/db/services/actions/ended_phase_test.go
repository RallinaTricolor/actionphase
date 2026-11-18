package actions

import (
	"context"
	"testing"

	core "actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	phases "actionphase/pkg/db/services/phases"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEndedPhase_ItsResultsAreReadOnlyUntilItIsActivatedAgain(t *testing.T) {
	env := setupStagedTest(t)
	ctx := context.Background()
	app := core.NewTestApp(env.testDB.Pool)
	phaseService := &phases.PhaseService{DB: env.testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: env.testDB.Pool, Logger: app.ObsLogger}

	userID := env.playerID
	character, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID: env.gameID, UserID: &userID, Name: "Mara", CharacterType: "player_character",
	})
	require.NoError(t, err)
	characterID := character.ID

	head, err := env.actionService.CreateActionResult(ctx, core.CreateActionResultRequest{
		GameID: env.gameID, PhaseID: env.phaseID, UserID: env.playerID, CharacterID: &characterID, Content: "Written before the phase ended",
	})
	require.NoError(t, err)
	part, err := env.actionService.AppendStagedPart(ctx, head.ID, core.StagedResultPart{Content: "Second part", DelayMinutes: 5})
	require.NoError(t, err)
	update, err := env.actionService.CreateDraftCharacterUpdate(ctx, core.CreateDraftCharacterUpdateRequest{
		ActionResultID: part.ID, CharacterID: characterID, ModuleType: "inventory", FieldName: "items",
		FieldValue: "[]", FieldType: "json", Operation: "upsert",
	})
	require.NoError(t, err)

	_, err = phaseService.TransitionToNextPhase(ctx, env.gameID, env.gmID, core.TransitionPhaseRequest{PhaseType: "common_room", Title: "Downtime"})
	require.NoError(t, err)

	refused := map[string]func() error{
		"edit": func() error {
			_, err := env.actionService.UpdateActionResult(ctx, head.ID, "Changed", nil)
			return err
		},
		"delete":      func() error { return env.actionService.DeleteActionResult(ctx, head.ID) },
		"publish":     func() error { return env.actionService.PublishActionResult(ctx, head.ID, env.gmID) },
		"publish all": func() error { return env.actionService.PublishAllPhaseResults(ctx, env.phaseID) },
		"add a part": func() error {
			_, err := env.actionService.AppendStagedPart(ctx, head.ID, core.StagedResultPart{Content: "More", DelayMinutes: 5})
			return err
		},
		"retime a draft part": func() error {
			_, err := env.actionService.UpdateStagedPartDelay(ctx, part.ID, 10)
			return err
		},
		"cancel a draft part": func() error { return env.actionService.CancelPendingPart(ctx, part.ID) },
		"add a sheet update": func() error {
			_, err := env.actionService.CreateDraftCharacterUpdate(ctx, core.CreateDraftCharacterUpdateRequest{
				ActionResultID: part.ID, CharacterID: characterID, ModuleType: "skills", FieldName: "skills",
				FieldValue: "[]", FieldType: "json", Operation: "upsert",
			})
			return err
		},
		"edit a sheet update": func() error {
			_, err := env.actionService.UpdateDraftCharacterUpdate(ctx, update.ID, "[1]")
			return err
		},
		"delete a sheet update": func() error { return env.actionService.DeleteDraftCharacterUpdate(ctx, update.ID) },
		"sync reward sheet updates": func() error {
			_, err := env.actionService.ReplaceRewardSheetUpdates(ctx, core.ReplaceRewardSheetUpdatesRequest{
				GameID: env.gameID, PhaseID: env.phaseID, CharacterID: characterID,
			})
			return err
		},
	}
	for name, attempt := range refused {
		t.Run("refuses: "+name, func(t *testing.T) {
			assert.ErrorIs(t, attempt(), core.ErrPhaseEnded)
		})
	}

	t.Run("the drafts are left as they were", func(t *testing.T) {
		current, err := env.actionService.GetActionResult(ctx, head.ID)
		require.NoError(t, err)
		assert.Equal(t, "Written before the phase ended", current.Content)
		assert.False(t, current.IsPublished.Bool)
		updates, err := env.actionService.GetDraftCharacterUpdates(ctx, part.ID)
		require.NoError(t, err)
		assert.Len(t, updates, 1)
	})

	t.Run("activating the phase again opens it back up", func(t *testing.T) {
		require.NoError(t, phaseService.ActivatePhase(ctx, env.phaseID, env.gmID))
		updated, err := env.actionService.UpdateActionResult(ctx, head.ID, "Finished after re-activating", nil)
		require.NoError(t, err)
		assert.Equal(t, "Finished after re-activating", updated.Content)
		require.NoError(t, env.actionService.PublishActionResult(ctx, head.ID, env.gmID))
	})
}

// A part already published is out with the player, waiting on its timer. The
// phase ending doesn't take away the GM's control of that timer.
func TestEndedPhase_APublishedPendingPartCanStillBeRetimedAndCancelled(t *testing.T) {
	env := setupStagedTest(t)
	ctx := context.Background()
	app := core.NewTestApp(env.testDB.Pool)
	phaseService := &phases.PhaseService{DB: env.testDB.Pool, Logger: app.ObsLogger}

	chain, err := env.actionService.CreateStagedResultChain(ctx, core.CreateStagedResultChainRequest{
		GameID: env.gameID, PhaseID: env.phaseID, UserID: env.playerID, GMUserID: env.gmID, IsPublished: true,
		Parts: []core.StagedResultPart{{Content: "Now"}, {Content: "Later", DelayMinutes: 60}},
	})
	require.NoError(t, err)
	_, err = phaseService.TransitionToNextPhase(ctx, env.gameID, env.gmID, core.TransitionPhaseRequest{PhaseType: "common_room", Title: "Downtime"})
	require.NoError(t, err)

	_, err = env.actionService.UpdateStagedPartDelay(ctx, chain[1].ID, 120)
	require.NoError(t, err)
	require.NoError(t, env.actionService.CancelPendingPart(ctx, chain[1].ID))
}
