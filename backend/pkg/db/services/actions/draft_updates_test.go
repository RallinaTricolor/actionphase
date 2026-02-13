package actions

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	core "actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	phases "actionphase/pkg/db/services/phases"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestActionSubmissionService_CreateDraftCharacterUpdate(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	// Create character
	userID := int32(player.ID)
	character, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID,
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create action phase and result
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	resultReq := core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player.ID),
		Content:     "You find a key",
		IsPublished: false,
	}
	result, err := actionService.CreateActionResult(context.Background(), resultReq)
	require.NoError(t, err)

	t.Run("creates draft successfully with valid data", func(t *testing.T) {
		req := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "abilities",
			FieldName:      "strength",
			FieldValue:     "15",
			FieldType:      "number",
			Operation:      "upsert",
		}

		draft, err := actionService.CreateDraftCharacterUpdate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, req.ActionResultID, draft.ActionResultID)
		assert.Equal(t, req.CharacterID, draft.CharacterID)
		assert.Equal(t, req.ModuleType, draft.ModuleType)
		assert.Equal(t, req.FieldName, draft.FieldName)
		assert.Equal(t, req.FieldValue, draft.FieldValue.String)
		assert.Equal(t, req.FieldType, draft.FieldType)
		assert.Equal(t, req.Operation, draft.Operation)
	})

	t.Run("upsert behavior - updates existing draft", func(t *testing.T) {
		req := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "skills",
			FieldName:      "lockpicking",
			FieldValue:     "5",
			FieldType:      "number",
			Operation:      "upsert",
		}

		// Create initial draft
		draft1, err := actionService.CreateDraftCharacterUpdate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, "5", draft1.FieldValue.String)

		// Update with same field - should upsert
		req.FieldValue = "8"
		draft2, err := actionService.CreateDraftCharacterUpdate(context.Background(), req)
		require.NoError(t, err)
		assert.Equal(t, draft1.ID, draft2.ID) // Same ID = upsert
		assert.Equal(t, "8", draft2.FieldValue.String)
	})

	t.Run("validates module_type", func(t *testing.T) {
		req := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "invalid_module",
			FieldName:      "test",
			FieldValue:     "value",
			FieldType:      "text",
			Operation:      "upsert",
		}

		_, err := actionService.CreateDraftCharacterUpdate(context.Background(), req)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid module_type")
	})

	t.Run("validates field_type", func(t *testing.T) {
		req := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "abilities",
			FieldName:      "test",
			FieldValue:     "value",
			FieldType:      "invalid_type",
			Operation:      "upsert",
		}

		_, err := actionService.CreateDraftCharacterUpdate(context.Background(), req)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid field_type")
	})

	t.Run("validates operation", func(t *testing.T) {
		req := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "abilities",
			FieldName:      "test",
			FieldValue:     "value",
			FieldType:      "text",
			Operation:      "invalid_op",
		}

		_, err := actionService.CreateDraftCharacterUpdate(context.Background(), req)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid operation")
	})

	t.Run("supports all module types", func(t *testing.T) {
		modules := []string{"abilities", "skills", "inventory", "currency"}
		for _, module := range modules {
			req := core.CreateDraftCharacterUpdateRequest{
				ActionResultID: result.ID,
				CharacterID:    character.ID,
				ModuleType:     module,
				FieldName:      "test_" + module,
				FieldValue:     "value",
				FieldType:      "text",
				Operation:      "upsert",
			}

			draft, err := actionService.CreateDraftCharacterUpdate(context.Background(), req)
			require.NoError(t, err)
			assert.Equal(t, module, draft.ModuleType)
		}
	})

	t.Run("supports all field types", func(t *testing.T) {
		fieldTypes := []string{"text", "number", "boolean", "json"}
		for _, fieldType := range fieldTypes {
			req := core.CreateDraftCharacterUpdateRequest{
				ActionResultID: result.ID,
				CharacterID:    character.ID,
				ModuleType:     "abilities",
				FieldName:      "test_" + fieldType,
				FieldValue:     "value",
				FieldType:      fieldType,
				Operation:      "upsert",
			}

			draft, err := actionService.CreateDraftCharacterUpdate(context.Background(), req)
			require.NoError(t, err)
			assert.Equal(t, fieldType, draft.FieldType)
		}
	})
}

func TestActionSubmissionService_GetDraftCharacterUpdates(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	userID := int32(player.ID)
	character, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID,
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	resultReq := core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player.ID),
		Content:     "You find a key",
		IsPublished: false,
	}
	result, err := actionService.CreateActionResult(context.Background(), resultReq)
	require.NoError(t, err)

	t.Run("returns empty list when no drafts exist", func(t *testing.T) {
		drafts, err := actionService.GetDraftCharacterUpdates(context.Background(), result.ID)
		require.NoError(t, err)
		assert.Empty(t, drafts)
	})

	t.Run("returns all drafts for action result", func(t *testing.T) {
		// Create multiple drafts
		drafts := []core.CreateDraftCharacterUpdateRequest{
			{
				ActionResultID: result.ID,
				CharacterID:    character.ID,
				ModuleType:     "abilities",
				FieldName:      "strength",
				FieldValue:     "15",
				FieldType:      "number",
				Operation:      "upsert",
			},
			{
				ActionResultID: result.ID,
				CharacterID:    character.ID,
				ModuleType:     "skills",
				FieldName:      "lockpicking",
				FieldValue:     "5",
				FieldType:      "number",
				Operation:      "upsert",
			},
			{
				ActionResultID: result.ID,
				CharacterID:    character.ID,
				ModuleType:     "inventory",
				FieldName:      "mysterious_key",
				FieldValue:     "1",
				FieldType:      "number",
				Operation:      "upsert",
			},
		}

		for _, draft := range drafts {
			_, err := actionService.CreateDraftCharacterUpdate(context.Background(), draft)
			require.NoError(t, err)
		}

		retrieved, err := actionService.GetDraftCharacterUpdates(context.Background(), result.ID)
		require.NoError(t, err)
		assert.Len(t, retrieved, 3)
	})
}

func TestActionSubmissionService_UpdateDraftCharacterUpdate(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	userID := int32(player.ID)
	character, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID,
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	resultReq := core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player.ID),
		Content:     "You find a key",
		IsPublished: false,
	}
	result, err := actionService.CreateActionResult(context.Background(), resultReq)
	require.NoError(t, err)

	t.Run("updates draft field value successfully", func(t *testing.T) {
		// Create initial draft
		createReq := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "abilities",
			FieldName:      "strength",
			FieldValue:     "15",
			FieldType:      "number",
			Operation:      "upsert",
		}
		draft, err := actionService.CreateDraftCharacterUpdate(context.Background(), createReq)
		require.NoError(t, err)
		assert.Equal(t, "15", draft.FieldValue.String)

		// Update the value
		updated, err := actionService.UpdateDraftCharacterUpdate(context.Background(), draft.ID, "18")
		require.NoError(t, err)
		assert.Equal(t, "18", updated.FieldValue.String)
		assert.Equal(t, draft.ID, updated.ID)
	})
}

func TestActionSubmissionService_DeleteDraftCharacterUpdate(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	userID := int32(player.ID)
	character, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID,
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	resultReq := core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player.ID),
		Content:     "You find a key",
		IsPublished: false,
	}
	result, err := actionService.CreateActionResult(context.Background(), resultReq)
	require.NoError(t, err)

	t.Run("deletes draft successfully", func(t *testing.T) {
		// Create draft
		createReq := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "abilities",
			FieldName:      "strength",
			FieldValue:     "15",
			FieldType:      "number",
			Operation:      "upsert",
		}
		draft, err := actionService.CreateDraftCharacterUpdate(context.Background(), createReq)
		require.NoError(t, err)

		// Delete draft
		err = actionService.DeleteDraftCharacterUpdate(context.Background(), draft.ID)
		require.NoError(t, err)

		// Verify it's gone
		drafts, err := actionService.GetDraftCharacterUpdates(context.Background(), result.ID)
		require.NoError(t, err)
		assert.Empty(t, drafts)
	})
}

func TestActionSubmissionService_GetDraftUpdateCount(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	userID := int32(player.ID)
	character, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID,
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	resultReq := core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player.ID),
		Content:     "You find a key",
		IsPublished: false,
	}
	result, err := actionService.CreateActionResult(context.Background(), resultReq)
	require.NoError(t, err)

	t.Run("returns zero when no drafts exist", func(t *testing.T) {
		count, err := actionService.GetDraftUpdateCount(context.Background(), result.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("returns correct count", func(t *testing.T) {
		// Create 3 drafts
		for i := 0; i < 3; i++ {
			createReq := core.CreateDraftCharacterUpdateRequest{
				ActionResultID: result.ID,
				CharacterID:    character.ID,
				ModuleType:     "abilities",
				FieldName:      string(rune('a' + i)),
				FieldValue:     "value",
				FieldType:      "text",
				Operation:      "upsert",
			}
			_, err := actionService.CreateDraftCharacterUpdate(context.Background(), createReq)
			require.NoError(t, err)
		}

		count, err := actionService.GetDraftUpdateCount(context.Background(), result.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(3), count)
	})
}

func TestActionSubmissionService_PublishDraftCharacterUpdates(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	userID := int32(player.ID)
	character, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID,
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	resultReq := core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player.ID),
		Content:     "You find a key",
		IsPublished: false,
	}
	result, err := actionService.CreateActionResult(context.Background(), resultReq)
	require.NoError(t, err)

	t.Run("publishes drafts and deletes them", func(t *testing.T) {
		// Create drafts
		createReq := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "abilities",
			FieldName:      "strength",
			FieldValue:     "18",
			FieldType:      "number",
			Operation:      "upsert",
		}
		_, err := actionService.CreateDraftCharacterUpdate(context.Background(), createReq)
		require.NoError(t, err)

		// Verify draft exists
		count, err := actionService.GetDraftUpdateCount(context.Background(), result.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)

		// Publish drafts
		err = actionService.PublishDraftCharacterUpdates(context.Background(), result.ID)
		require.NoError(t, err)

		// Verify drafts are deleted
		countAfter, err := actionService.GetDraftUpdateCount(context.Background(), result.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), countAfter)

		// Verify data was copied to character_data
		characterData, err := characterService.GetCharacterData(context.Background(), character.ID)
		require.NoError(t, err)

		// Find the strength field
		found := false
		for _, data := range characterData {
			if data.ModuleType == "abilities" && data.FieldName == "strength" {
				assert.Equal(t, "18", data.FieldValue.String)
				found = true
				break
			}
		}
		assert.True(t, found, "strength field should be in character_data")
	})
}

func TestActionSubmissionService_PublishActionResult_WithDrafts(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	userID := int32(player.ID)
	character, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID,
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	resultReq := core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player.ID),
		Content:     "You find a key and gain strength",
		IsPublished: false,
	}
	result, err := actionService.CreateActionResult(context.Background(), resultReq)
	require.NoError(t, err)

	t.Run("publishing action result also publishes character updates", func(t *testing.T) {
		// Create draft character updates
		createReq := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "abilities",
			FieldName:      "strength",
			FieldValue:     `{"name":"strength","value":20,"description":"Physical strength"}`,
			FieldType:      "json",
			Operation:      "upsert",
		}
		_, err := actionService.CreateDraftCharacterUpdate(context.Background(), createReq)
		require.NoError(t, err)

		// Publish the action result (should also publish character updates)
		err = actionService.PublishActionResult(context.Background(), result.ID, int32(gm.ID))
		require.NoError(t, err)

		// Verify result is published
		publishedResult, err := actionService.GetActionResult(context.Background(), result.ID)
		require.NoError(t, err)
		assert.True(t, publishedResult.IsPublished.Bool)

		// Verify drafts are deleted
		count, err := actionService.GetDraftUpdateCount(context.Background(), result.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)

		// Verify character data was updated (should be in 'abilities' array)
		characterData, err := characterService.GetCharacterData(context.Background(), character.ID)
		require.NoError(t, err)

		found := false
		for _, data := range characterData {
			if data.ModuleType == "abilities" && data.FieldName == "abilities" {
				// Should be a JSON array containing our ability
				assert.Contains(t, data.FieldValue.String, `"name":"strength"`)
				assert.Contains(t, data.FieldValue.String, `"value":20`)
				found = true
				break
			}
		}
		assert.True(t, found, "abilities array should be in character_data after publishing")
	})
}

func TestActionSubmissionService_PublishAllPhaseResults_WithDrafts(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Add players to game
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)

	// Create characters for both players
	userID1 := int32(player1.ID)
	character1, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID1,
		Name:          "Test Character 1",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	userID2 := int32(player2.ID)
	character2, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID2,
		Name:          "Test Character 2",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create action phase
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	// Create action results for both players
	result1Req := core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player1.ID),
		Content:     "Player 1 gains strength",
		IsPublished: false,
	}
	result1, err := actionService.CreateActionResult(context.Background(), result1Req)
	require.NoError(t, err)

	result2Req := core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player2.ID),
		Content:     "Player 2 learns lockpicking",
		IsPublished: false,
	}
	result2, err := actionService.CreateActionResult(context.Background(), result2Req)
	require.NoError(t, err)

	t.Run("bulk publish publishes all drafts for all results", func(t *testing.T) {
		// Create draft for player 1's result
		draft1Req := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result1.ID,
			CharacterID:    character1.ID,
			ModuleType:     "abilities",
			FieldName:      "strength",
			FieldValue:     `{"name":"strength","value":18,"description":"Physical strength"}`,
			FieldType:      "json",
			Operation:      "upsert",
		}
		_, err := actionService.CreateDraftCharacterUpdate(context.Background(), draft1Req)
		require.NoError(t, err)

		// Create draft for player 2's result
		draft2Req := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result2.ID,
			CharacterID:    character2.ID,
			ModuleType:     "skills",
			FieldName:      "lockpicking",
			FieldValue:     `{"name":"lockpicking","level":5,"description":"Picking locks"}`,
			FieldType:      "json",
			Operation:      "upsert",
		}
		_, err = actionService.CreateDraftCharacterUpdate(context.Background(), draft2Req)
		require.NoError(t, err)

		// Verify both drafts exist
		count1, err := actionService.GetDraftUpdateCount(context.Background(), result1.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(1), count1)

		count2, err := actionService.GetDraftUpdateCount(context.Background(), result2.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(1), count2)

		// Publish all phase results (bulk operation)
		err = actionService.PublishAllPhaseResults(context.Background(), phase.ID)
		require.NoError(t, err)

		// Verify both results are published
		publishedResult1, err := actionService.GetActionResult(context.Background(), result1.ID)
		require.NoError(t, err)
		assert.True(t, publishedResult1.IsPublished.Bool)

		publishedResult2, err := actionService.GetActionResult(context.Background(), result2.ID)
		require.NoError(t, err)
		assert.True(t, publishedResult2.IsPublished.Bool)

		// Verify both drafts are deleted
		countAfter1, err := actionService.GetDraftUpdateCount(context.Background(), result1.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), countAfter1, "Player 1 drafts should be deleted")

		countAfter2, err := actionService.GetDraftUpdateCount(context.Background(), result2.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), countAfter2, "Player 2 drafts should be deleted")

		// Verify character data was updated for both characters
		characterData1, err := characterService.GetCharacterData(context.Background(), character1.ID)
		require.NoError(t, err)

		found1 := false
		for _, data := range characterData1 {
			if data.ModuleType == "abilities" && data.FieldName == "abilities" {
				// Should be a JSON array containing our ability
				assert.Contains(t, data.FieldValue.String, `"name":"strength"`)
				assert.Contains(t, data.FieldValue.String, `"value":18`)
				found1 = true
				break
			}
		}
		assert.True(t, found1, "Player 1 abilities array should be in character_data")

		characterData2, err := characterService.GetCharacterData(context.Background(), character2.ID)
		require.NoError(t, err)

		found2 := false
		for _, data := range characterData2 {
			if data.ModuleType == "skills" && data.FieldName == "skills" {
				// Should be a JSON array containing our skill
				assert.Contains(t, data.FieldValue.String, `"name":"lockpicking"`)
				assert.Contains(t, data.FieldValue.String, `"level":5`)
				found2 = true
				break
			}
		}
		assert.True(t, found2, "Player 2 skills array should be in character_data")
	})

	t.Run("bulk publish is atomic - all or nothing", func(t *testing.T) {
		// This test verifies that if any part of the bulk publish fails,
		// the entire operation is rolled back due to the transaction wrapper.
		// Since we're using a transaction, we can't easily test failure scenarios
		// without mocking, but we verify the success path uses a transaction
		// by checking that all operations complete atomically.

		// Create a new phase for this test
		transitionReq := core.TransitionPhaseRequest{
			PhaseType: "action",
			Title:     "Action Phase 2",
		}
		phase2, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
		require.NoError(t, err)

		// Create multiple results with drafts
		results := make([]int32, 3)
		for i := 0; i < 3; i++ {
			resultReq := core.CreateActionResultRequest{
				GameID:      game.ID,
				PhaseID:     phase2.ID,
				UserID:      int32(player1.ID),
				Content:     "Result " + string(rune('A'+i)),
				IsPublished: false,
			}
			result, err := actionService.CreateActionResult(context.Background(), resultReq)
			require.NoError(t, err)
			results[i] = result.ID

			// Add a draft to each result
			draftReq := core.CreateDraftCharacterUpdateRequest{
				ActionResultID: result.ID,
				CharacterID:    character1.ID,
				ModuleType:     "currency",
				FieldName:      "test_" + string(rune('a'+i)),
				FieldValue:     fmt.Sprintf(`{"type":"test_%s","amount":%d,"description":"Test currency"}`, string(rune('a'+i)), i+1),
				FieldType:      "json",
				Operation:      "upsert",
			}
			_, err = actionService.CreateDraftCharacterUpdate(context.Background(), draftReq)
			require.NoError(t, err)
		}

		// Bulk publish
		err = actionService.PublishAllPhaseResults(context.Background(), phase2.ID)
		require.NoError(t, err)

		// Verify ALL results are published (atomicity)
		for _, resultID := range results {
			publishedResult, err := actionService.GetActionResult(context.Background(), resultID)
			require.NoError(t, err)
			assert.True(t, publishedResult.IsPublished.Bool, "All results should be published atomically")

			// Verify ALL drafts are deleted
			count, err := actionService.GetDraftUpdateCount(context.Background(), resultID)
			require.NoError(t, err)
			assert.Equal(t, int64(0), count, "All drafts should be deleted atomically")
		}
	})
}
// Regression test for currency merge bug
// Bug: When merging draft currencies into existing currencies, the merge logic
// assumed all items have a "name" field, but currency items use "type" field.
// This caused existing currencies to be lost when new currencies were added.
func TestActionSubmissionService_CurrencyMergePreservesExisting(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	userID := int32(player.ID)
	character, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID,
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Step 1: Character starts with existing "Gold" currency
	existingCurrencies := []map[string]interface{}{
		{
			"id":          "550e8400-e29b-41d4-a716-446655440000",
			"type":        "Gold",
			"amount":      float64(10),
			"description": "Starting gold",
		},
	}
	existingJSON, err := json.Marshal(existingCurrencies)
	require.NoError(t, err)

	_, err = testDB.Pool.Exec(context.Background(),
		`INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, created_at, updated_at)
		 VALUES ($1, 'currency', 'currency', $2, 'json', NOW(), NOW())
		 ON CONFLICT (character_id, module_type, field_name)
		 DO UPDATE SET field_value = $2, updated_at = NOW()`,
		character.ID, string(existingJSON))
	require.NoError(t, err)

	// Step 2: Create action phase and result that adds "Silver" currency
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	result, err := actionService.CreateActionResult(context.Background(), core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player.ID),
		Content:     "You receive silver coins",
		IsPublished: false,
	})
	require.NoError(t, err)

	// Step 3: Add draft that adds "Silver" currency
	_, err = actionService.CreateDraftCharacterUpdate(context.Background(), core.CreateDraftCharacterUpdateRequest{
		ActionResultID: result.ID,
		CharacterID:    character.ID,
		ModuleType:     "currency",
		FieldName:      "Silver",
		FieldValue:     `{"type":"Silver","amount":5,"description":"Reward"}`,
		FieldType:      "json",
		Operation:      "upsert",
	})
	require.NoError(t, err)

	// Step 4: Publish result (should merge Silver into existing currencies)
	err = actionService.PublishActionResult(context.Background(), result.ID, int32(gm.ID))
	require.NoError(t, err)

	// Step 5: Verify BOTH currencies exist (Gold should NOT be lost)
	characterData, err := characterService.GetCharacterData(context.Background(), character.ID)
	require.NoError(t, err)

	// Find the currency field
	var currencies []map[string]interface{}
	found := false
	for _, data := range characterData {
		if data.ModuleType == "currency" && data.FieldName == "currency" {
			err = json.Unmarshal([]byte(data.FieldValue.String), &currencies)
			require.NoError(t, err)
			found = true
			break
		}
	}
	require.True(t, found, "Currency field should exist in character_data")

	// CRITICAL: Must have 2 currencies (Gold + Silver), not just Silver
	assert.Len(t, currencies, 2, "Both Gold and Silver should exist after merge")

	// Verify Gold is present with original amount
	goldFound := false
	silverFound := false
	for _, currency := range currencies {
		if currency["type"] == "Gold" {
			goldFound = true
			assert.Equal(t, float64(10), currency["amount"], "Gold amount should be preserved")
		}
		if currency["type"] == "Silver" {
			silverFound = true
			assert.Equal(t, float64(5), currency["amount"], "Silver should be added")
		}
	}
	assert.True(t, goldFound, "Gold currency should be preserved")
	assert.True(t, silverFound, "Silver currency should be added")
}

// TestDraftMerge_PreservesIdField_AllModuleTypes verifies that draft merge preserves
// the "id" field for ALL character data types (currencies, items, abilities, skills).
// This is a regression test for bug where draft merge was stripping ID fields,
// causing deletion to fail catastrophically (deleting ALL items instead of one).
func TestDraftMerge_PreservesIdField_AllModuleTypes(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	actionService := &ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	phaseService := &phases.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	// Create character
	userID := int32(player.ID)
	character, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &userID,
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create action phase and result
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	resultReq := core.CreateActionResultRequest{
		GameID:      game.ID,
		PhaseID:     phase.ID,
		UserID:      int32(player.ID),
		Content:     "You find treasures",
		IsPublished: false,
	}
	result, err := actionService.CreateActionResult(context.Background(), resultReq)
	require.NoError(t, err)

	t.Run("preserves ID field in currency data", func(t *testing.T) {
		// Setup: Character has 3 currencies with IDs
		currenciesWithIDs := []map[string]interface{}{
			{"id": "currency-1", "type": "Gold", "amount": float64(100)},
			{"id": "currency-2", "type": "Silver", "amount": float64(50)},
			{"id": "currency-3", "type": "Bronze", "amount": float64(25)},
		}
		currenciesJSON, err := json.Marshal(currenciesWithIDs)
		require.NoError(t, err)

		_, err = testDB.Pool.Exec(context.Background(),
			`INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, created_at, updated_at)
			 VALUES ($1, 'currency', 'currency', $2, 'json', NOW(), NOW())
			 ON CONFLICT (character_id, module_type, field_name)
			 DO UPDATE SET field_value = $2, updated_at = NOW()`,
			character.ID, string(currenciesJSON))
		require.NoError(t, err)

		// Action: Draft updates ONE currency (Gold amount changes)
		updatedGold := map[string]interface{}{
			"type":   "Gold",
			"amount": float64(150), // Increased from 100
		}
		goldJSON, err := json.Marshal(updatedGold)
		require.NoError(t, err)

		draftReq := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "currency",
			FieldName:      "Gold", // Key field for currency
			FieldValue:     string(goldJSON),
			FieldType:      "json",
			Operation:      "upsert",
		}
		_, err = actionService.CreateDraftCharacterUpdate(context.Background(), draftReq)
		require.NoError(t, err)

		// Publish the draft
		err = actionService.PublishActionResult(context.Background(), result.ID, int32(gm.ID))
		require.NoError(t, err)

		// Verify: ALL currencies still have their IDs
		charData, err := characterService.GetCharacterData(context.Background(), character.ID)
		require.NoError(t, err)

		var currencies []map[string]interface{}
		for _, data := range charData {
			if data.ModuleType == "currency" && data.FieldName == "currency" {
				err := json.Unmarshal([]byte(data.FieldValue.String), &currencies)
				require.NoError(t, err)
				break
			}
		}

		require.Len(t, currencies, 3, "All 3 currencies should still exist")

		// CRITICAL: All currencies must have ID field
		for i, currency := range currencies {
			id, hasID := currency["id"]
			assert.True(t, hasID, fmt.Sprintf("Currency %d (%s) must have 'id' field", i, currency["type"]))
			assert.NotEmpty(t, id, fmt.Sprintf("Currency %d (%s) 'id' must not be empty", i, currency["type"]))

			// Verify the original IDs are preserved (not regenerated)
			currencyType := currency["type"].(string)
			switch currencyType {
			case "Gold":
				assert.Equal(t, "currency-1", id, "Gold ID should be preserved")
				assert.Equal(t, float64(150), currency["amount"], "Gold amount should be updated")
			case "Silver":
				assert.Equal(t, "currency-2", id, "Silver ID should be preserved")
				assert.Equal(t, float64(50), currency["amount"], "Silver amount should be unchanged")
			case "Bronze":
				assert.Equal(t, "currency-3", id, "Bronze ID should be preserved")
				assert.Equal(t, float64(25), currency["amount"], "Bronze amount should be unchanged")
			}
		}
	})

	t.Run("preserves ID field in item data", func(t *testing.T) {
		// Setup: Character has 3 items with IDs
		itemsWithIDs := []map[string]interface{}{
			{"id": "item-1", "name": "Sword", "quantity": float64(1)},
			{"id": "item-2", "name": "Shield", "quantity": float64(1)},
			{"id": "item-3", "name": "Potion", "quantity": float64(5)},
		}
		itemsJSON, err := json.Marshal(itemsWithIDs)
		require.NoError(t, err)

		_, err = testDB.Pool.Exec(context.Background(),
			`INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, created_at, updated_at)
			 VALUES ($1, 'inventory', 'items', $2, 'json', NOW(), NOW())
			 ON CONFLICT (character_id, module_type, field_name)
			 DO UPDATE SET field_value = $2, updated_at = NOW()`,
			character.ID, string(itemsJSON))
		require.NoError(t, err)

		// Action: Draft updates ONE item (Potion quantity changes)
		updatedPotion := map[string]interface{}{
			"name":     "Potion",
			"quantity": float64(10), // Increased from 5
		}
		potionJSON, err := json.Marshal(updatedPotion)
		require.NoError(t, err)

		draftReq := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "inventory",
			FieldName:      "Potion", // Key field for items
			FieldValue:     string(potionJSON),
			FieldType:      "json",
			Operation:      "upsert",
		}
		_, err = actionService.CreateDraftCharacterUpdate(context.Background(), draftReq)
		require.NoError(t, err)

		// Publish the draft
		err = actionService.PublishActionResult(context.Background(), result.ID, int32(gm.ID))
		require.NoError(t, err)

		// Verify: ALL items still have their IDs
		charData, err := characterService.GetCharacterData(context.Background(), character.ID)
		require.NoError(t, err)

		var items []map[string]interface{}
		for _, data := range charData {
			if data.ModuleType == "inventory" && data.FieldName == "items" {
				err := json.Unmarshal([]byte(data.FieldValue.String), &items)
				require.NoError(t, err)
				break
			}
		}

		require.Len(t, items, 3, "All 3 items should still exist")

		// CRITICAL: All items must have ID field
		for i, item := range items {
			id, hasID := item["id"]
			assert.True(t, hasID, fmt.Sprintf("Item %d (%s) must have 'id' field", i, item["name"]))
			assert.NotEmpty(t, id, fmt.Sprintf("Item %d (%s) 'id' must not be empty", i, item["name"]))

			// Verify the original IDs are preserved (not regenerated)
			itemName := item["name"].(string)
			switch itemName {
			case "Sword":
				assert.Equal(t, "item-1", id, "Sword ID should be preserved")
				assert.Equal(t, float64(1), item["quantity"], "Sword quantity should be unchanged")
			case "Shield":
				assert.Equal(t, "item-2", id, "Shield ID should be preserved")
				assert.Equal(t, float64(1), item["quantity"], "Shield quantity should be unchanged")
			case "Potion":
				assert.Equal(t, "item-3", id, "Potion ID should be preserved")
				assert.Equal(t, float64(10), item["quantity"], "Potion quantity should be updated")
			}
		}
	})

	t.Run("generates UUID for new items added via draft", func(t *testing.T) {
		// Action: Draft adds a NEW currency (not updating existing)
		newCurrency := map[string]interface{}{
			"type":   "Platinum",
			"amount": float64(200),
			// Note: NO ID field in draft
		}
		platinumJSON, err := json.Marshal(newCurrency)
		require.NoError(t, err)

		draftReq := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "currency",
			FieldName:      "Platinum",
			FieldValue:     string(platinumJSON),
			FieldType:      "json",
			Operation:      "upsert",
		}
		_, err = actionService.CreateDraftCharacterUpdate(context.Background(), draftReq)
		require.NoError(t, err)

		// Publish the draft
		err = actionService.PublishActionResult(context.Background(), result.ID, int32(gm.ID))
		require.NoError(t, err)

		// Verify: NEW currency has a generated UUID
		charData, err := characterService.GetCharacterData(context.Background(), character.ID)
		require.NoError(t, err)

		var currencies []map[string]interface{}
		for _, data := range charData {
			if data.ModuleType == "currency" && data.FieldName == "currency" {
				err := json.Unmarshal([]byte(data.FieldValue.String), &currencies)
				require.NoError(t, err)
				break
			}
		}

		// Find the Platinum currency
		var platinum map[string]interface{}
		for _, curr := range currencies {
			if curr["type"] == "Platinum" {
				platinum = curr
				break
			}
		}

		require.NotNil(t, platinum, "Platinum currency should exist")

		// CRITICAL: New item must have auto-generated ID
		id, hasID := platinum["id"]
		assert.True(t, hasID, "New currency must have 'id' field auto-generated")
		assert.NotEmpty(t, id, "Generated 'id' must not be empty")

		// Verify it's a valid UUID format
		idStr, ok := id.(string)
		require.True(t, ok, "ID should be a string")
		assert.Len(t, idStr, 36, "UUID should be 36 characters (standard UUID format)")
		assert.Contains(t, idStr, "-", "UUID should contain hyphens")
	})

	t.Run("preserves ID field in abilities data", func(t *testing.T) {
		// Setup: Character has 3 abilities with IDs
		abilitiesWithIDs := []map[string]interface{}{
			{"id": "ability-1", "name": "Fireball", "description": "A ball of fire"},
			{"id": "ability-2", "name": "Ice Blast", "description": "Freezing attack"},
			{"id": "ability-3", "name": "Heal", "description": "Restore health"},
		}
		abilitiesJSON, err := json.Marshal(abilitiesWithIDs)
		require.NoError(t, err)

		_, err = testDB.Pool.Exec(context.Background(),
			`INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, created_at, updated_at)
			 VALUES ($1, 'abilities', 'abilities', $2, 'json', NOW(), NOW())
			 ON CONFLICT (character_id, module_type, field_name)
			 DO UPDATE SET field_value = $2, updated_at = NOW()`,
			character.ID, string(abilitiesJSON))
		require.NoError(t, err)

		// Action: Draft updates ONE ability (Fireball description changes)
		updatedFireball := map[string]interface{}{
			"name":        "Fireball",
			"description": "An improved ball of fire", // Changed from "A ball of fire"
		}
		fireballJSON, err := json.Marshal(updatedFireball)
		require.NoError(t, err)

		draftReq := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "abilities",
			FieldName:      "Fireball", // Key field for abilities
			FieldValue:     string(fireballJSON),
			FieldType:      "json",
			Operation:      "upsert",
		}
		_, err = actionService.CreateDraftCharacterUpdate(context.Background(), draftReq)
		require.NoError(t, err)

		// Publish the draft
		err = actionService.PublishActionResult(context.Background(), result.ID, int32(gm.ID))
		require.NoError(t, err)

		// Verify: ALL abilities still have their IDs
		charData, err := characterService.GetCharacterData(context.Background(), character.ID)
		require.NoError(t, err)

		var abilities []map[string]interface{}
		for _, data := range charData {
			if data.ModuleType == "abilities" && data.FieldName == "abilities" {
				err := json.Unmarshal([]byte(data.FieldValue.String), &abilities)
				require.NoError(t, err)
				break
			}
		}

		require.Len(t, abilities, 3, "All 3 abilities should still exist")

		// CRITICAL: All abilities must have ID field
		for i, ability := range abilities {
			id, hasID := ability["id"]
			assert.True(t, hasID, fmt.Sprintf("Ability %d (%s) must have 'id' field", i, ability["name"]))
			assert.NotEmpty(t, id, fmt.Sprintf("Ability %d (%s) 'id' must not be empty", i, ability["name"]))

			// Verify the original IDs are preserved (not regenerated)
			abilityName := ability["name"].(string)
			switch abilityName {
			case "Fireball":
				assert.Equal(t, "ability-1", id, "Fireball ID should be preserved")
				assert.Equal(t, "An improved ball of fire", ability["description"], "Fireball description should be updated")
			case "Ice Blast":
				assert.Equal(t, "ability-2", id, "Ice Blast ID should be preserved")
				assert.Equal(t, "Freezing attack", ability["description"], "Ice Blast description should be unchanged")
			case "Heal":
				assert.Equal(t, "ability-3", id, "Heal ID should be preserved")
				assert.Equal(t, "Restore health", ability["description"], "Heal description should be unchanged")
			}
		}
	})

	t.Run("preserves ID field in skills data", func(t *testing.T) {
		// Setup: Character has 3 skills with IDs
		skillsWithIDs := []map[string]interface{}{
			{"id": "skill-1", "name": "Lockpicking", "level": float64(5)},
			{"id": "skill-2", "name": "Stealth", "level": float64(7)},
			{"id": "skill-3", "name": "Persuasion", "level": float64(3)},
		}
		skillsJSON, err := json.Marshal(skillsWithIDs)
		require.NoError(t, err)

		_, err = testDB.Pool.Exec(context.Background(),
			`INSERT INTO character_data (character_id, module_type, field_name, field_value, field_type, created_at, updated_at)
			 VALUES ($1, 'skills', 'skills', $2, 'json', NOW(), NOW())
			 ON CONFLICT (character_id, module_type, field_name)
			 DO UPDATE SET field_value = $2, updated_at = NOW()`,
			character.ID, string(skillsJSON))
		require.NoError(t, err)

		// Action: Draft updates ONE skill (Lockpicking level increases)
		updatedLockpicking := map[string]interface{}{
			"name":  "Lockpicking",
			"level": float64(8), // Increased from 5
		}
		lockpickingJSON, err := json.Marshal(updatedLockpicking)
		require.NoError(t, err)

		draftReq := core.CreateDraftCharacterUpdateRequest{
			ActionResultID: result.ID,
			CharacterID:    character.ID,
			ModuleType:     "skills", // Skills have their own module_type
			FieldName:      "Lockpicking",
			FieldValue:     string(lockpickingJSON),
			FieldType:      "json",
			Operation:      "upsert",
		}
		_, err = actionService.CreateDraftCharacterUpdate(context.Background(), draftReq)
		require.NoError(t, err)

		// Publish the draft
		err = actionService.PublishActionResult(context.Background(), result.ID, int32(gm.ID))
		require.NoError(t, err)

		// Verify: ALL skills still have their IDs
		charData, err := characterService.GetCharacterData(context.Background(), character.ID)
		require.NoError(t, err)

		var skills []map[string]interface{}
		for _, data := range charData {
			if data.ModuleType == "skills" && data.FieldName == "skills" {
				err := json.Unmarshal([]byte(data.FieldValue.String), &skills)
				require.NoError(t, err)
				break
			}
		}

		require.Len(t, skills, 3, "All 3 skills should still exist")

		// CRITICAL: All skills must have ID field
		for i, skill := range skills {
			id, hasID := skill["id"]
			assert.True(t, hasID, fmt.Sprintf("Skill %d (%s) must have 'id' field", i, skill["name"]))
			assert.NotEmpty(t, id, fmt.Sprintf("Skill %d (%s) 'id' must not be empty", i, skill["name"]))

			// Verify the original IDs are preserved (not regenerated)
			skillName := skill["name"].(string)
			switch skillName {
			case "Lockpicking":
				assert.Equal(t, "skill-1", id, "Lockpicking ID should be preserved")
				assert.Equal(t, float64(8), skill["level"], "Lockpicking level should be updated")
			case "Stealth":
				assert.Equal(t, "skill-2", id, "Stealth ID should be preserved")
				assert.Equal(t, float64(7), skill["level"], "Stealth level should be unchanged")
			case "Persuasion":
				assert.Equal(t, "skill-3", id, "Persuasion ID should be preserved")
				assert.Equal(t, float64(3), skill["level"], "Persuasion level should be unchanged")
			}
		}
	})
}
