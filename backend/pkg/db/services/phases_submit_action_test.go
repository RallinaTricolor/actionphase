package db

import (
	"context"
	"testing"
	"time"

	core "actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Tests for the legacy PhaseService.SubmitAction method (line 211) - currently at 0% coverage
func TestPhaseService_SubmitAction_LegacyMethod(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	phaseService := &PhaseService{DB: testDB.Pool}
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Create test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Add player as participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	// Create and activate an action phase
	transitionReq := core.TransitionPhaseRequest{
		PhaseType: "action",
		Title:     "Action Phase",
		Deadline:  core.TimePtr(time.Now().Add(72 * time.Hour)),
	}
	phase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), transitionReq)
	require.NoError(t, err)

	t.Run("submits action successfully", func(t *testing.T) {
		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(player.ID),
			Content: "I search the ancient ruins for artifacts.",
			IsDraft: false,
		}

		action, err := phaseService.SubmitAction(context.Background(), req)
		require.NoError(t, err)
		assert.NotNil(t, action)
		assert.Equal(t, req.GameID, action.GameID)
		assert.Equal(t, req.PhaseID, action.PhaseID)
		assert.Equal(t, req.UserID, action.UserID)
		assert.Contains(t, action.Content, "ancient ruins")
		assert.False(t, action.IsDraft.Bool)
	})

	t.Run("returns error for non-existent phase", func(t *testing.T) {
		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: 99999, // Non-existent phase
			UserID:  int32(player.ID),
			Content: "Test action",
			IsDraft: false,
		}

		_, err := phaseService.SubmitAction(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "phase not found")
	})

	t.Run("returns error when phase is not active", func(t *testing.T) {
		// Create an inactive phase
		inactiveReq := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Inactive Phase",
		}
		inactivePhase, err := phaseService.CreatePhase(context.Background(), inactiveReq)
		require.NoError(t, err)

		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: inactivePhase.ID,
			UserID:  int32(player.ID),
			Content: "Test action",
			IsDraft: false,
		}

		_, err = phaseService.SubmitAction(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "phase is not active")
	})

	t.Run("returns error for non-action phase type", func(t *testing.T) {
		// Create and activate a common_room phase
		commonRoomReq := core.TransitionPhaseRequest{
			PhaseType: "common_room",
			Title:     "Common Room",
		}
		commonPhase, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), commonRoomReq)
		require.NoError(t, err)

		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: commonPhase.ID,
			UserID:  int32(player.ID),
			Content: "Test action",
			IsDraft: false,
		}

		_, err = phaseService.SubmitAction(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "actions can only be submitted during action phases")
	})

	t.Run("returns error when deadline has passed", func(t *testing.T) {
		// Create phase with past deadline
		pastDeadline := time.Now().Add(-24 * time.Hour)
		expiredReq := core.CreatePhaseRequest{
			GameID:    game.ID,
			PhaseType: "action",
			Title:     "Expired Phase",
			Deadline:  &pastDeadline,
		}
		expiredPhase, err := phaseService.CreatePhase(context.Background(), expiredReq)
		require.NoError(t, err)

		// Activate the expired phase
		_, err = phaseService.activatePhaseInternal(context.Background(), expiredPhase.ID)
		require.NoError(t, err)

		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: expiredPhase.ID,
			UserID:  int32(player.ID),
			Content: "Late action",
			IsDraft: false,
		}

		_, err = phaseService.SubmitAction(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "deadline has passed")
	})

	t.Run("submits action with character", func(t *testing.T) {
		// Create a character for the player
		charReq := CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        core.Int32Ptr(int32(player.ID)),
			Name:          "Adventurer",
			CharacterType: "player_character",
		}
		character, err := charService.CreateCharacter(context.Background(), charReq)
		require.NoError(t, err)

		// Reactivate original action phase
		_, err = phaseService.activatePhaseInternal(context.Background(), phase.ID)
		require.NoError(t, err)

		req := core.SubmitActionRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			CharacterID: &character.ID,
			Content:     "My character investigates the scene.",
			IsDraft:     false,
		}

		action, err := phaseService.SubmitAction(context.Background(), req)
		require.NoError(t, err)
		assert.NotNil(t, action)
		assert.True(t, action.CharacterID.Valid)
		assert.Equal(t, character.ID, action.CharacterID.Int32)
	})

	t.Run("returns error when character does not exist", func(t *testing.T) {
		nonExistentCharID := int32(99999)
		req := core.SubmitActionRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			CharacterID: &nonExistentCharID,
			Content:     "Test action",
			IsDraft:     false,
		}

		_, err := phaseService.SubmitAction(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "character not found")
	})

	t.Run("returns error when character does not belong to user", func(t *testing.T) {
		// Create character for a different user
		otherPlayer := testDB.CreateTestUser(t, "otherplayer", "other@example.com")
		charReq := CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        core.Int32Ptr(int32(otherPlayer.ID)),
			Name:          "Other Character",
			CharacterType: "player_character",
		}
		otherChar, err := charService.CreateCharacter(context.Background(), charReq)
		require.NoError(t, err)

		// Try to submit action with other player's character
		req := core.SubmitActionRequest{
			GameID:      game.ID,
			PhaseID:     phase.ID,
			UserID:      int32(player.ID), // Different user
			CharacterID: &otherChar.ID,
			Content:     "Test action",
			IsDraft:     false,
		}

		_, err = phaseService.SubmitAction(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "you can only submit actions for characters you own")
	})

	t.Run("returns error when character belongs to different game", func(t *testing.T) {
		// Create a different game
		otherGame := testDB.CreateTestGame(t, int32(gm.ID), "Other Game")

		// Create character in the other game
		charReq := CreateCharacterRequest{
			GameID:        otherGame.ID,
			UserID:        core.Int32Ptr(int32(player.ID)),
			Name:          "Wrong Game Character",
			CharacterType: "player_character",
		}
		wrongGameChar, err := charService.CreateCharacter(context.Background(), charReq)
		require.NoError(t, err)

		// Try to submit action with character from different game
		req := core.SubmitActionRequest{
			GameID:      game.ID, // Original game
			PhaseID:     phase.ID,
			UserID:      int32(player.ID),
			CharacterID: &wrongGameChar.ID, // Character from other game
			Content:     "Test action",
			IsDraft:     false,
		}

		_, err = phaseService.SubmitAction(context.Background(), req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "character does not belong to this game")
	})

	t.Run("handles different content types", func(t *testing.T) {
		testCases := []struct {
			name    string
			content interface{}
		}{
			{"string content", "This is a string action"},
			{"byte slice content", []byte("This is a byte slice action")},
			{"other type content", 12345},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				req := core.SubmitActionRequest{
					GameID:  game.ID,
					PhaseID: phase.ID,
					UserID:  int32(player.ID),
					Content: tc.content,
					IsDraft: true,
				}

				action, err := phaseService.SubmitAction(context.Background(), req)
				require.NoError(t, err)
				assert.NotNil(t, action)
				assert.NotEmpty(t, action.Content)
			})
		}
	})

	t.Run("submits draft action", func(t *testing.T) {
		req := core.SubmitActionRequest{
			GameID:  game.ID,
			PhaseID: phase.ID,
			UserID:  int32(player.ID),
			Content: "Draft action content",
			IsDraft: true,
		}

		action, err := phaseService.SubmitAction(context.Background(), req)
		require.NoError(t, err)
		assert.True(t, action.IsDraft.Bool)
	})
}
