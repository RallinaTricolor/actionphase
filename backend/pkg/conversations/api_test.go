package conversations

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	phasesvc "actionphase/pkg/db/services/phases"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper function for creating int32 pointers
func int32Ptr(i int32) *int32 {
	return &i
}

// setupConversationAPITestRouter creates a test router with conversation routes
func setupConversationAPITestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	r := chi.NewRouter()

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/games", func(r chi.Router) {
			conversationHandler := Handler{App: app}

			r.Group(func(r chi.Router) {
				r.Use(jwtauth.Verifier(tokenAuth))
				r.Use(jwtauth.Authenticator(tokenAuth))
				r.Use(core.RequireAuthenticationMiddleware(userService))

				// Conversation routes
				conversationHandler.RegisterRoutes(r)
			})
		})
	})

	return r
}

// TestConversationAPI_CreateConversation tests POST /games/{gameId}/conversations
func TestConversationAPI_CreateConversation(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "conversations", "characters", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupConversationAPITestRouter(app, testDB)

	// Create test users
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")

	// Generate JWT tokens for test users
	player1Token, err := core.CreateTestJWTTokenForUser(app, player1)
	core.AssertNoError(t, err, "Should create player1 token")
	_ = player2 // player2 not needed for auth in this test

	// Create test game
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Setup services
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	phaseService := &phasesvc.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Add players as participants
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	core.AssertNoError(t, err, "Should add player1 as participant")
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	core.AssertNoError(t, err, "Should add player2 as participant")

	// Create common room phase for messaging
	phase, err := phaseService.CreatePhase(context.Background(), core.CreatePhaseRequest{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Common Room 1",
		Description: "Test common room phase",
	})
	core.AssertNoError(t, err, "Should create common room phase")

	// Activate common room phase
	err = phaseService.ActivatePhase(context.Background(), phase.ID, int32(gm.ID))
	core.AssertNoError(t, err, "Should activate common room phase")

	// Create characters for players
	playerChar1, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Player 1 Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player1 character")

	playerChar2, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Player 2 Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player2 character")

	t.Run("successfully creates conversation with valid participants", func(t *testing.T) {
		reqBody := CreateConversationRequest{
			Title:        "Test Conversation",
			CharacterIDs: []int32{playerChar1.ID, playerChar2.ID},
		}
		reqJSON, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/conversations", game.ID), bytes.NewBuffer(reqJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+player1Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusCreated, rec.Code)

		var response map[string]interface{}
		err := json.Unmarshal(rec.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.NotNil(t, response["id"])
		assert.Equal(t, float64(game.ID), response["game_id"])
	})

	t.Run("rejects conversation with less than 2 participants", func(t *testing.T) {
		reqBody := CreateConversationRequest{
			Title:        "Invalid Conversation",
			CharacterIDs: []int32{playerChar1.ID}, // Only 1 character
		}
		reqJSON, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/conversations", game.ID), bytes.NewBuffer(reqJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+player1Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Contains(t, rec.Body.String(), "at least 2 characters")
	})

	t.Run("rejects conversation without title", func(t *testing.T) {
		reqBody := CreateConversationRequest{
			Title:        "", // Empty title
			CharacterIDs: []int32{playerChar1.ID, playerChar2.ID},
		}
		reqJSON, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/conversations", game.ID), bytes.NewBuffer(reqJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+player1Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Contains(t, rec.Body.String(), "title is required")
	})

	t.Run("rejects unauthenticated requests", func(t *testing.T) {
		reqBody := CreateConversationRequest{
			Title:        "Test Conversation",
			CharacterIDs: []int32{playerChar1.ID, playerChar2.ID},
		}
		reqJSON, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/conversations", game.ID), bytes.NewBuffer(reqJSON))
		req.Header.Set("Content-Type", "application/json")
		// No authenticated user in context

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})
}

// TestConversationAPI_SendMessage tests POST /games/{gameId}/conversations/{conversationId}/messages
func TestConversationAPI_SendMessage(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "conversations", "characters", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupConversationAPITestRouter(app, testDB)

	// Create test users
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	player3 := testDB.CreateTestUser(t, "player3", "player3@example.com") // Non-participant
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")

	// Generate JWT tokens for test users
	player1Token, err := core.CreateTestJWTTokenForUser(app, player1)
	core.AssertNoError(t, err, "Should create player1 token")
	player2Token, err := core.CreateTestJWTTokenForUser(app, player2)
	core.AssertNoError(t, err, "Should create player2 token")
	player3Token, err := core.CreateTestJWTTokenForUser(app, player3)
	core.AssertNoError(t, err, "Should create player3 token")
	_ = player2Token // player2Token not needed in this test

	// Create test game
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Setup services
	conversationService := db.NewConversationService(testDB.Pool)
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	phaseService := &phasesvc.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Add players as participants
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	core.AssertNoError(t, err, "Should add player1")
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	core.AssertNoError(t, err, "Should add player2")
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player3.ID), "player")
	core.AssertNoError(t, err, "Should add player3")

	// Create common room phase
	phase2, err := phaseService.CreatePhase(context.Background(), core.CreatePhaseRequest{
		GameID:      game.ID,
		PhaseType:   "common_room",
		PhaseNumber: 1,
		Title:       "Common Room 1",
		Description: "Test common room phase",
	})
	core.AssertNoError(t, err, "Should create common room phase")

	// Activate common room phase
	err = phaseService.ActivatePhase(context.Background(), phase2.ID, int32(gm.ID))
	core.AssertNoError(t, err, "Should activate common room phase")

	// Create characters
	playerChar1, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Player 1 Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player1 character")

	playerChar2, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Player 2 Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player2 character")

	playerChar3, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player3.ID)),
		Name:          "Player 3 Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player3 character")

	// Create conversation between player1 and player2
	conversation, err := conversationService.CreateConversation(context.Background(), db.CreateConversationRequest{
		GameID:          game.ID,
		Title:           "Test Conversation",
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{playerChar1.ID, playerChar2.ID},
	})
	core.AssertNoError(t, err, "Should create conversation")

	t.Run("successfully sends message as participant", func(t *testing.T) {
		reqBody := SendMessageRequest{
			CharacterID: playerChar1.ID,
			Content:     "Hello from player 1",
		}
		reqJSON, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages", game.ID, conversation.ID), bytes.NewBuffer(reqJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+player1Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusCreated, rec.Code)

		var response map[string]interface{}
		err := json.Unmarshal(rec.Body.Bytes(), &response)
		require.NoError(t, err)
		assert.Equal(t, "Hello from player 1", response["content"])
	})

	t.Run("rejects message from non-participant character", func(t *testing.T) {
		reqBody := SendMessageRequest{
			CharacterID: playerChar3.ID, // Player 3's character not in conversation
			Content:     "Unauthorized message",
		}
		reqJSON, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages", game.ID, conversation.ID), bytes.NewBuffer(reqJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+player3Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
		assert.Contains(t, rec.Body.String(), "not a participant")
	})

	t.Run("rejects message using another player's character", func(t *testing.T) {
		reqBody := SendMessageRequest{
			CharacterID: playerChar2.ID, // Player 2's character
			Content:     "Trying to impersonate",
		}
		reqJSON, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages", game.ID, conversation.ID), bytes.NewBuffer(reqJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+player1Token) // Player 1 trying to use Player 2's character

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
		assert.Contains(t, rec.Body.String(), "cannot send messages as this character")
	})

	t.Run("rejects empty message content", func(t *testing.T) {
		reqBody := SendMessageRequest{
			CharacterID: playerChar1.ID,
			Content:     "", // Empty content
		}
		reqJSON, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages", game.ID, conversation.ID), bytes.NewBuffer(reqJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+player1Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Contains(t, rec.Body.String(), "content is required")
	})

	t.Run("rejects message outside common room phase", func(t *testing.T) {
		// Create and activate action phase
		actionPhase, err := phaseService.CreatePhase(context.Background(), core.CreatePhaseRequest{
			GameID:      game.ID,
			PhaseType:   "action",
			PhaseNumber: 2,
			Title:       "Action Phase 1",
			Description: "Test action phase",
		})
		core.AssertNoError(t, err, "Should create action phase")

		err = phaseService.ActivatePhase(context.Background(), actionPhase.ID, int32(gm.ID))
		core.AssertNoError(t, err, "Should activate action phase")

		reqBody := SendMessageRequest{
			CharacterID: playerChar1.ID,
			Content:     "Trying to message during action phase",
		}
		reqJSON, _ := json.Marshal(reqBody)

		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages", game.ID, conversation.ID), bytes.NewBuffer(reqJSON))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+player1Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
		assert.Contains(t, rec.Body.String(), "common room")

		// Restore common room phase for other tests (reactivate the phase2 created earlier)
		err = phaseService.ActivatePhase(context.Background(), phase2.ID, int32(gm.ID))
		core.AssertNoError(t, err, "Should reactivate common room phase")
	})
}

// TestConversationAPI_GetConversationMessages tests GET /games/{gameId}/conversations/{conversationId}/messages
func TestConversationAPI_GetConversationMessages(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "conversations", "characters", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupConversationAPITestRouter(app, testDB)

	// Create test users
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	player3 := testDB.CreateTestUser(t, "player3", "player3@example.com") // Non-participant
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")

	// Generate JWT tokens for test users
	player1Token, err := core.CreateTestJWTTokenForUser(app, player1)
	core.AssertNoError(t, err, "Should create player1 token")
	player3Token, err := core.CreateTestJWTTokenForUser(app, player3)
	core.AssertNoError(t, err, "Should create player3 token")
	_ = player2 // player2 not needed for auth in this test

	// Create test game
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Setup services
	conversationService := db.NewConversationService(testDB.Pool)
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Add players as participants
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	core.AssertNoError(t, err, "Should add player1")
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	core.AssertNoError(t, err, "Should add player2")
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player3.ID), "player")
	core.AssertNoError(t, err, "Should add player3")

	// Create characters
	playerChar1, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Player 1 Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player1 character")

	playerChar2, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Player 2 Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player2 character")

	// Create conversation
	conversation, err := conversationService.CreateConversation(context.Background(), db.CreateConversationRequest{
		GameID:          game.ID,
		Title:           "Test Conversation",
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{playerChar1.ID, playerChar2.ID},
	})
	core.AssertNoError(t, err, "Should create conversation")

	// Send some messages
	_, err = conversationService.SendMessage(context.Background(), db.SendMessageRequest{
		ConversationID:    conversation.ID,
		SenderUserID:      int32(player1.ID),
		SenderCharacterID: playerChar1.ID,
		Content:           "Message 1",
	})
	core.AssertNoError(t, err, "Should send message 1")

	_, err = conversationService.SendMessage(context.Background(), db.SendMessageRequest{
		ConversationID:    conversation.ID,
		SenderUserID:      int32(player2.ID),
		SenderCharacterID: playerChar2.ID,
		Content:           "Message 2",
	})
	core.AssertNoError(t, err, "Should send message 2")

	t.Run("successfully retrieves messages as participant", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages", game.ID, conversation.ID), nil)
		req.Header.Set("Authorization", "Bearer "+player1Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var response map[string]interface{}
		err := json.Unmarshal(rec.Body.Bytes(), &response)
		require.NoError(t, err)

		messages := response["messages"].([]interface{})
		assert.Len(t, messages, 2)
	})

	t.Run("rejects non-participant from viewing messages", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages", game.ID, conversation.ID), nil)
		req.Header.Set("Authorization", "Bearer "+player3Token) // Player 3 not in conversation

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
		assert.Contains(t, rec.Body.String(), "don't have access")
	})

	t.Run("returns empty array when no messages", func(t *testing.T) {
		// Create empty conversation
		emptyConv, err := conversationService.CreateConversation(context.Background(), db.CreateConversationRequest{
			GameID:          game.ID,
			Title:           "Empty Conversation",
			CreatedByUserID: int32(player1.ID),
			ParticipantIDs:  []int32{playerChar1.ID, playerChar2.ID},
		})
		core.AssertNoError(t, err, "Should create empty conversation")

		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages", game.ID, emptyConv.ID), nil)
		req.Header.Set("Authorization", "Bearer "+player1Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var response map[string]interface{}
		err = json.Unmarshal(rec.Body.Bytes(), &response)
		require.NoError(t, err)

		messages := response["messages"].([]interface{})
		assert.Len(t, messages, 0)
	})
}

// TestConversationAPI_DeleteMessage tests DELETE /games/{gameId}/conversations/{conversationId}/messages/{messageId}
func TestConversationAPI_DeleteMessage(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "conversations", "characters", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupConversationAPITestRouter(app, testDB)

	// Create test users
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")

	// Generate JWT tokens for test users
	player1Token, err := core.CreateTestJWTTokenForUser(app, player1)
	core.AssertNoError(t, err, "Should create player1 token")
	_ = player2 // player2 not needed for auth in this test

	// Create test game
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Setup services
	conversationService := db.NewConversationService(testDB.Pool)
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Add players as participants
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	core.AssertNoError(t, err, "Should add player1")
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	core.AssertNoError(t, err, "Should add player2")

	// Create characters
	playerChar1, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Player 1 Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player1 character")

	playerChar2, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Player 2 Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player2 character")

	// Create conversation
	conversation, err := conversationService.CreateConversation(context.Background(), db.CreateConversationRequest{
		GameID:          game.ID,
		Title:           "Test Conversation",
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{playerChar1.ID, playerChar2.ID},
	})
	core.AssertNoError(t, err, "Should create conversation")

	// Send messages
	msg1, err := conversationService.SendMessage(context.Background(), db.SendMessageRequest{
		ConversationID:    conversation.ID,
		SenderUserID:      int32(player1.ID),
		SenderCharacterID: playerChar1.ID,
		Content:           "Message from Player 1",
	})
	core.AssertNoError(t, err, "Should send message 1")

	msg2, err := conversationService.SendMessage(context.Background(), db.SendMessageRequest{
		ConversationID:    conversation.ID,
		SenderUserID:      int32(player2.ID),
		SenderCharacterID: playerChar2.ID,
		Content:           "Message from Player 2",
	})
	core.AssertNoError(t, err, "Should send message 2")

	t.Run("successfully deletes own message", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages/%d", game.ID, conversation.ID, msg1.ID), nil)
		req.Header.Set("Authorization", "Bearer "+player1Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "deleted successfully")
	})

	t.Run("rejects deleting another player's message", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages/%d", game.ID, conversation.ID, msg2.ID), nil)
		req.Header.Set("Authorization", "Bearer "+player1Token) // Player 1 trying to delete Player 2's message

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
		assert.Contains(t, rec.Body.String(), "your own messages")
	})

	t.Run("returns 404 for non-existent message", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/games/%d/conversations/%d/messages/99999", game.ID, conversation.ID), nil)
		req.Header.Set("Authorization", "Bearer "+player1Token)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}
