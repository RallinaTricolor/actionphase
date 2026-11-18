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

type rewardSyncEnv struct {
	svc         *ActionSubmissionService
	testDB      *core.TestDatabase
	gameID      int32
	phaseID     int32
	gmID        int32
	playerID    int32
	characterID int32
}

func setupRewardSync(t *testing.T) *rewardSyncEnv {
	t.Helper()
	ctx := context.Background()
	testDB := core.NewTestDatabase(t)
	t.Cleanup(testDB.Close)
	app := core.NewTestApp(testDB.Pool)
	svc := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "reward_gm", "reward_gm@example.com")
	player := testDB.CreateTestUser(t, "reward_player", "reward_player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Reward Sync Game")
	_, err := gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	userID := int32(player.ID)
	character, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID: game.ID, UserID: &userID, Name: "Reward Character", CharacterType: "player_character",
	})
	require.NoError(t, err)
	phase, err := phaseService.TransitionToNextPhase(ctx, game.ID, int32(gm.ID), core.TransitionPhaseRequest{PhaseType: "action", Title: "Action Phase"})
	require.NoError(t, err)

	return &rewardSyncEnv{svc: svc, testDB: testDB, gameID: game.ID, phaseID: phase.ID, gmID: int32(gm.ID), playerID: int32(player.ID), characterID: character.ID}
}

func (e *rewardSyncEnv) draft(t *testing.T) int32 {
	t.Helper()
	cid := e.characterID
	r, err := e.svc.CreateActionResult(context.Background(), core.CreateActionResultRequest{
		GameID: e.gameID, PhaseID: e.phaseID, UserID: e.playerID, CharacterID: &cid, GMUserID: e.gmID, Content: "Draft",
	})
	require.NoError(t, err)
	return r.ID
}

func (e *rewardSyncEnv) handMade(t *testing.T, resultID int32) {
	t.Helper()
	_, err := e.svc.CreateDraftCharacterUpdate(context.Background(), core.CreateDraftCharacterUpdateRequest{
		ActionResultID: resultID, CharacterID: e.characterID, ModuleType: "inventory", FieldName: "items",
		FieldValue: `[{"id":"h","name":"Hand-made"}]`, FieldType: "json", Operation: "upsert",
	})
	require.NoError(t, err)
}

func (e *rewardSyncEnv) req(resultID *int32, updates ...core.RewardSheetUpdate) core.ReplaceRewardSheetUpdatesRequest {
	return core.ReplaceRewardSheetUpdatesRequest{GameID: e.gameID, PhaseID: e.phaseID, CharacterID: e.characterID, ResultID: resultID, Updates: updates}
}

var numbersUpdate = core.RewardSheetUpdate{ModuleType: "numbers", FieldName: "numbers", FieldValue: `[{"id":"n","name":"Rating","amount":{"value":3}}]`}

func TestReplaceRewardSheetUpdates(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping database test in short mode")
	}
	ctx := context.Background()

	t.Run("writes generated drafts on the carrier, marked from rewards", func(t *testing.T) {
		env := setupRewardSync(t)
		rid := env.draft(t)

		written, err := env.svc.ReplaceRewardSheetUpdates(ctx, env.req(&rid, numbersUpdate))
		require.NoError(t, err)
		require.Len(t, written, 1)
		assert.True(t, written[0].FromRewards)
		assert.Equal(t, "json", written[0].FieldType)

		count, err := env.svc.GetDraftUpdateCount(ctx, rid)
		require.NoError(t, err)
		assert.Equal(t, int64(1), count, "the old view's count badge sees them")
	})

	// One carrier per character: a draft is a whole-tab snapshot, so two
	// results carrying changes would overwrite each other on publish.
	t.Run("moving the carrier clears the drafts from the old one", func(t *testing.T) {
		env := setupRewardSync(t)
		first, second := env.draft(t), env.draft(t)
		_, err := env.svc.ReplaceRewardSheetUpdates(ctx, env.req(&first, numbersUpdate))
		require.NoError(t, err)

		_, err = env.svc.ReplaceRewardSheetUpdates(ctx, env.req(&second, numbersUpdate))
		require.NoError(t, err)

		onFirst, err := env.svc.GetDraftCharacterUpdates(ctx, first)
		require.NoError(t, err)
		assert.Empty(t, onFirst)
		onSecond, err := env.svc.GetDraftCharacterUpdates(ctx, second)
		require.NoError(t, err)
		assert.Len(t, onSecond, 1)
	})

	t.Run("no result and no updates clears them", func(t *testing.T) {
		env := setupRewardSync(t)
		rid := env.draft(t)
		_, err := env.svc.ReplaceRewardSheetUpdates(ctx, env.req(&rid, numbersUpdate))
		require.NoError(t, err)

		_, err = env.svc.ReplaceRewardSheetUpdates(ctx, env.req(nil))
		require.NoError(t, err)
		count, err := env.svc.GetDraftUpdateCount(ctx, rid)
		require.NoError(t, err)
		assert.Zero(t, count)
	})

	t.Run("refuses to drop hand-made drafts unless asked, then replaces them", func(t *testing.T) {
		env := setupRewardSync(t)
		rid := env.draft(t)
		env.handMade(t, rid)

		_, err := env.svc.ReplaceRewardSheetUpdates(ctx, env.req(&rid, numbersUpdate))
		require.ErrorIs(t, err, core.ErrHandMadeSheetDrafts)
		assert.Equal(t, "This character has 1 sheet update(s) made by hand in the results list", core.UserMessage(err, core.ErrHandMadeSheetDrafts))
		drafts, err := env.svc.GetDraftCharacterUpdates(ctx, rid)
		require.NoError(t, err)
		require.Len(t, drafts, 1, "nothing written or removed")
		assert.Equal(t, "inventory", drafts[0].ModuleType)

		req := env.req(&rid, numbersUpdate)
		req.ReplaceHandMade = true
		_, err = env.svc.ReplaceRewardSheetUpdates(ctx, req)
		require.NoError(t, err)
		drafts, err = env.svc.GetDraftCharacterUpdates(ctx, rid)
		require.NoError(t, err)
		require.Len(t, drafts, 1)
		assert.Equal(t, "numbers", drafts[0].ModuleType)
	})

	// Editing a generated draft in the results list makes it the GM's own.
	t.Run("a hand edit of a generated draft makes it hand-made", func(t *testing.T) {
		env := setupRewardSync(t)
		rid := env.draft(t)
		written, err := env.svc.ReplaceRewardSheetUpdates(ctx, env.req(&rid, numbersUpdate))
		require.NoError(t, err)

		edited, err := env.svc.UpdateDraftCharacterUpdate(ctx, written[0].ID, `[]`)
		require.NoError(t, err)
		assert.False(t, edited.FromRewards)

		_, err = env.svc.ReplaceRewardSheetUpdates(ctx, env.req(&rid, numbersUpdate))
		assert.ErrorIs(t, err, core.ErrHandMadeSheetDrafts)
	})

	t.Run("refuses a carrier that isn't the last part", func(t *testing.T) {
		env := setupRewardSync(t)
		rid := env.draft(t)
		_, err := env.svc.AppendStagedPart(ctx, rid, core.StagedResultPart{Content: "Later", DelayMinutes: 5})
		require.NoError(t, err)

		_, err = env.svc.ReplaceRewardSheetUpdates(ctx, env.req(&rid, numbersUpdate))
		assert.ErrorIs(t, err, core.ErrInvalidRewardCarrier)
	})

	t.Run("refuses a published carrier", func(t *testing.T) {
		env := setupRewardSync(t)
		rid := env.draft(t)
		require.NoError(t, env.svc.PublishActionResult(ctx, rid, env.gmID))

		_, err := env.svc.ReplaceRewardSheetUpdates(ctx, env.req(&rid, numbersUpdate))
		assert.ErrorIs(t, err, core.ErrInvalidRewardCarrier)
	})

	t.Run("refuses another character's result", func(t *testing.T) {
		env := setupRewardSync(t)
		rid := env.draft(t)
		req := env.req(&rid, numbersUpdate)
		req.CharacterID = env.characterID + 1000

		_, err := env.svc.ReplaceRewardSheetUpdates(ctx, req)
		assert.ErrorIs(t, err, core.ErrInvalidRewardCarrier)
	})

	t.Run("refuses updates with no result", func(t *testing.T) {
		env := setupRewardSync(t)
		_, err := env.svc.ReplaceRewardSheetUpdates(ctx, env.req(nil, numbersUpdate))
		assert.ErrorIs(t, err, core.ErrInvalidRewardCarrier)
	})

	// The whole point: the generated drafts go out through today's publish.
	t.Run("publishing the carrier applies them to the sheet", func(t *testing.T) {
		env := setupRewardSync(t)
		rid := env.draft(t)
		_, err := env.svc.ReplaceRewardSheetUpdates(ctx, env.req(&rid, numbersUpdate))
		require.NoError(t, err)
		require.NoError(t, env.svc.PublishActionResult(ctx, rid, env.gmID))

		var value string
		err = env.testDB.Pool.QueryRow(ctx,
			`SELECT field_value FROM character_data WHERE character_id = $1 AND module_type = 'numbers' AND field_name = 'numbers'`,
			env.characterID).Scan(&value)
		require.NoError(t, err)
		assert.JSONEq(t, numbersUpdate.FieldValue, value)
	})
}

func TestListPhaseDraftCharacterUpdates(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping database test in short mode")
	}
	ctx := context.Background()
	env := setupRewardSync(t)
	a, b := env.draft(t), env.draft(t)
	env.handMade(t, a)
	_, err := env.svc.ReplaceRewardSheetUpdates(ctx, core.ReplaceRewardSheetUpdatesRequest{
		GameID: env.gameID, PhaseID: env.phaseID, CharacterID: env.characterID, ResultID: &b,
		Updates: []core.RewardSheetUpdate{numbersUpdate}, ReplaceHandMade: true,
	})
	require.NoError(t, err)
	env.handMade(t, a)

	drafts, err := env.svc.ListPhaseDraftCharacterUpdates(ctx, env.phaseID)
	require.NoError(t, err)
	require.Len(t, drafts, 2)
	byResult := map[int32]bool{}
	for _, d := range drafts {
		byResult[d.ActionResultID] = d.FromRewards
	}
	assert.Equal(t, map[int32]bool{a: false, b: true}, byResult)
}
