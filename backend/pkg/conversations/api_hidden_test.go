package conversations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	phasesvc "actionphase/pkg/db/services/phases"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A player cannot start a conversation with a hidden NPC, because to them that
// character does not exist. The GM can, which is what keeps a hidden NPC able
// to open a conversation TOWARD a player -- the direction the feature exists
// for. Both halves are asserted; the gate is wrong if either fails.
func TestConversationAPI_HiddenNPCParticipant(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "conversations", "characters", "game_participants", "games", "communities", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupConversationAPITestRouter(app, testDB)
	ctx := context.Background()

	gm := testDB.CreateTestUser(t, "hidden_conv_gm", "hidden_conv_gm@example.com")
	player := testDB.CreateTestUser(t, "hidden_conv_player", "hidden_conv_player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Hidden Conversation Game")

	gmToken, err := core.CreateTestJWTTokenForUser(app, gm)
	core.AssertNoError(t, err, "Should create GM token")
	playerToken, err := core.CreateTestJWTTokenForUser(app, player)
	core.AssertNoError(t, err, "Should create player token")

	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	phaseService := &phasesvc.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	_, err = gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	core.AssertNoError(t, err, "Should add player as participant")

	// Conversations require an active phase that permits them.
	phase, err := phaseService.CreatePhase(ctx, core.CreatePhaseRequest{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Common Room 1",
		Description: "Test common room phase",
	})
	core.AssertNoError(t, err, "Should create common room phase")
	err = phaseService.ActivatePhase(ctx, phase.ID, int32(gm.ID))
	core.AssertNoError(t, err, "Should activate common room phase")

	playerChar, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Player Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player character")

	gmChar, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(gm.ID)),
		Name:          "GM Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create GM character")

	hiddenNPC, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "Masked Informant",
		CharacterType: "npc",
	})
	core.AssertNoError(t, err, "Should create hidden NPC")
	_, err = characterService.SetCharacterHidden(ctx, hiddenNPC.ID, true)
	core.AssertNoError(t, err, "Should hide NPC")

	visibleNPC, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "Town Crier",
		CharacterType: "npc",
	})
	core.AssertNoError(t, err, "Should create visible NPC")

	create := func(t *testing.T, title string, ids []int32, token string) *httptest.ResponseRecorder {
		t.Helper()
		body, _ := json.Marshal(CreateConversationRequest{Title: title, CharacterIDs: ids})
		req := httptest.NewRequest("POST",
			fmt.Sprintf("/api/v1/games/%d/conversations", game.ID), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	t.Run("player cannot start a conversation with a hidden NPC", func(t *testing.T) {
		rec := create(t, "Quiet word", []int32{playerChar.ID, hiddenNPC.ID}, playerToken)
		assert.Equal(t, http.StatusForbidden, rec.Code,
			"Naming a hidden NPC must be refused")
		// The error must not name the character: that would confirm it exists.
		assert.NotContains(t, rec.Body.String(), "Masked Informant",
			"The refusal must not disclose the hidden NPC's name")
	})

	t.Run("player can still start one with a visible NPC", func(t *testing.T) {
		rec := create(t, "Market gossip", []int32{playerChar.ID, visibleNPC.ID}, playerToken)
		assert.Equal(t, http.StatusCreated, rec.Code,
			"The gate must be scoped to hidden NPCs, not NPC conversations generally")
	})

	t.Run("gm can start a conversation with their hidden NPC", func(t *testing.T) {
		rec := create(t, "Instructions", []int32{gmChar.ID, hiddenNPC.ID}, gmToken)
		require.Equal(t, http.StatusCreated, rec.Code,
			"Hiding must not stop the GM opening a conversation as the hidden NPC")
	})
}
