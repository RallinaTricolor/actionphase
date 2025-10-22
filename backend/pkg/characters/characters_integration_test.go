package characters

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"actionphase/pkg/core"
	services "actionphase/pkg/db/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

func TestCharacterAPI_CompleteCharacterLifecycle(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "game_participants", "games", "sessions", "users")

	// Setup application
	app := core.NewTestApp(testDB.Pool)

	// Create test users
	gmUser := testDB.CreateTestUser(t, "gm", "gm@example.com")
	playerUser := testDB.CreateTestUser(t, "player", "player@example.com")

	// Create test game
	gameService := &services.GameService{DB: testDB.Pool}
	game, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "Character Test Game",
		Description: "Testing character functionality",
		GMUserID:    int32(gmUser.ID),
		IsPublic:    true,
	})
	core.AssertNoError(t, err, "Failed to create test game")

	// Add player as participant
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Failed to add player participant")

	// Create tokens for authentication
	gmToken, err := createTestAuthToken(gmUser.Username)
	core.AssertNoError(t, err, "Failed to create GM token")
	playerToken, err := createTestAuthToken(playerUser.Username)
	core.AssertNoError(t, err, "Failed to create player token")

	// Setup router with character routes and JWT middleware
	tokenAuth := core.CreateTestTokenAuth()
	r := chi.NewRouter()
	handler := Handler{App: app}

	// Character routes
	r.Route("/api/v1/games/{gameId}/characters", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth), jwtauth.Authenticator(tokenAuth))
		r.Post("/", handler.CreateCharacter)
		r.Get("/", handler.GetGameCharacters)
	})
	r.Route("/api/v1/characters/{id}", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth), jwtauth.Authenticator(tokenAuth))
		r.Get("/", handler.GetCharacter)
		r.Post("/approve", handler.ApproveCharacter)
		r.Post("/assign", handler.AssignNPC)
		r.Post("/data", handler.SetCharacterData)
		r.Get("/data", handler.GetCharacterData)
	})

	var createdCharacterID int32

	t.Run("create player character", func(t *testing.T) {
		requestBody := CreateCharacterRequest{
			Name:          "Aragorn",
			CharacterType: "player_character",
		}

		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/characters", game.ID), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+playerToken)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusCreated, w.Code, "Expected 201 Created")

		var response CharacterResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Failed to unmarshal response")

		core.AssertEqual(t, "Aragorn", response.Name, "Character name mismatch")
		core.AssertEqual(t, "player_character", response.CharacterType, "Character type mismatch")
		core.AssertEqual(t, "pending", response.Status, "Character should start as pending")

		createdCharacterID = response.ID
		t.Logf("Created character with ID: %d", createdCharacterID)
	})

	t.Run("get character", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/characters/%d", createdCharacterID), nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusOK, w.Code, "Expected 200 OK")

		var response CharacterResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Failed to unmarshal response")

		core.AssertEqual(t, createdCharacterID, response.ID, "Character ID mismatch")
		core.AssertEqual(t, "Aragorn", response.Name, "Character name mismatch")
	})

	t.Run("get game characters", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/characters", game.ID), nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusOK, w.Code, "Expected 200 OK")

		var response []map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Failed to unmarshal response")

		core.AssertEqual(t, 1, len(response), "Expected 1 character")

		// Type assert the ID field
		idField, ok := response[0]["id"].(float64)
		if !ok {
			t.Fatalf("Expected ID to be float64, got %T", response[0]["id"])
		}
		core.AssertEqual(t, float64(createdCharacterID), idField, "Character ID mismatch")
	})

	t.Run("approve character as GM", func(t *testing.T) {
		requestBody := ApproveCharacterRequest{
			Status: "approved",
		}

		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/characters/%d/approve", createdCharacterID), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusOK, w.Code, "Expected 200 OK")

		var response CharacterResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Failed to unmarshal response")

		core.AssertEqual(t, "approved", response.Status, "Character should be approved")
	})

	t.Run("set character data", func(t *testing.T) {
		requestBody := CharacterDataRequest{
			ModuleType: "bio",
			FieldName:  "background",
			FieldValue: "A ranger from the north, heir to the throne of Gondor",
			FieldType:  "text",
			IsPublic:   true,
		}

		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/characters/%d/data", createdCharacterID), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+playerToken)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusNoContent, w.Code, "Expected 204 No Content")
	})

	t.Run("get character data", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/characters/%d/data", createdCharacterID), nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusOK, w.Code, "Expected 200 OK")

		var response []map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Failed to unmarshal response")

		core.AssertEqual(t, 1, len(response), "Expected 1 data entry")
		core.AssertEqual(t, "bio", response[0]["module_type"], "Module type mismatch")
		core.AssertEqual(t, "background", response[0]["field_name"], "Field name mismatch")
	})
}

func TestCharacterAPI_NPCManagement(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "game_participants", "games", "sessions", "users")

	// Setup application
	app := core.NewTestApp(testDB.Pool)

	// Create test users
	gmUser := testDB.CreateTestUser(t, "gm", "gm@example.com")
	audienceUser := testDB.CreateTestUser(t, "audience", "audience@example.com")

	// Create test game
	gameService := &services.GameService{DB: testDB.Pool}
	game, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "NPC Test Game",
		Description: "Testing NPC functionality",
		GMUserID:    int32(gmUser.ID),
		IsPublic:    true,
	})
	core.AssertNoError(t, err, "Failed to create test game")

	// Add audience member as participant
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(audienceUser.ID), "audience")
	core.AssertNoError(t, err, "Failed to add audience participant")

	// Create tokens
	gmToken, err := createTestAuthToken(gmUser.Username)
	core.AssertNoError(t, err, "Failed to create GM token")

	// Setup router with JWT middleware
	tokenAuth := core.CreateTestTokenAuth()
	r := chi.NewRouter()
	handler := Handler{App: app}

	r.Route("/api/v1/games/{gameId}/characters", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth), jwtauth.Authenticator(tokenAuth))
		r.Post("/", handler.CreateCharacter)
		r.Get("/", handler.GetGameCharacters)
	})
	r.Route("/api/v1/characters/{id}", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth), jwtauth.Authenticator(tokenAuth))
		r.Get("/", handler.GetCharacter)
		r.Post("/assign", handler.AssignNPC)
	})

	var npcCharacterID int32

	t.Run("create NPC as GM", func(t *testing.T) {
		requestBody := CreateCharacterRequest{
			Name:          "Gandalf",
			CharacterType: "npc",
		}

		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/games/%d/characters", game.ID), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusCreated, w.Code, "Expected 201 Created")

		var response CharacterResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Failed to unmarshal response")

		core.AssertEqual(t, "Gandalf", response.Name, "NPC name mismatch")
		core.AssertEqual(t, "npc", response.CharacterType, "NPC type mismatch")

		npcCharacterID = response.ID
	})

	t.Run("assign NPC to audience member", func(t *testing.T) {
		requestBody := AssignNPCRequest{
			AssignedUserID: int32(audienceUser.ID),
		}

		body, _ := json.Marshal(requestBody)
		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/characters/%d/assign", npcCharacterID), bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusNoContent, w.Code, "Expected 204 No Content")
	})

	t.Run("verify game characters shows assigned NPC", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/games/%d/characters", game.ID), nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)

		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusOK, w.Code, "Expected 200 OK")

		var response []map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Failed to unmarshal response")

		core.AssertEqual(t, 1, len(response), "Expected 1 character")
		core.AssertEqual(t, "Gandalf", response[0]["name"], "NPC name mismatch")
	})
}

func TestCharacterAPI_Authorization(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "game_participants", "games", "sessions", "users")

	// Setup application
	app := core.NewTestApp(testDB.Pool)

	// Create test users
	gmUser := testDB.CreateTestUser(t, "gm", "gm@example.com")
	playerUser := testDB.CreateTestUser(t, "player", "player@example.com")
	otherUser := testDB.CreateTestUser(t, "other", "other@example.com")

	// Create test game
	gameService := &services.GameService{DB: testDB.Pool}
	game, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "Authorization Test Game",
		Description: "Testing character authorization",
		GMUserID:    int32(gmUser.ID),
		IsPublic:    true,
	})
	core.AssertNoError(t, err, "Failed to create test game")

	// Add player as participant
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Failed to add player participant")

	// Create character
	characterService := &services.CharacterService{DB: testDB.Pool}
	character, err := characterService.CreateCharacter(context.Background(), services.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        core.Int32Ptr(int32(playerUser.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Failed to create test character")

	// Create tokens
	gmToken, err := createTestAuthToken(gmUser.Username)
	core.AssertNoError(t, err, "Failed to create GM token")
	playerToken, err := createTestAuthToken(playerUser.Username)
	core.AssertNoError(t, err, "Failed to create player token")
	otherToken, err := createTestAuthToken(otherUser.Username)
	core.AssertNoError(t, err, "Failed to create other token")

	// Setup router with JWT middleware
	tokenAuth := core.CreateTestTokenAuth()
	r := chi.NewRouter()
	handler := Handler{App: app}

	r.Route("/api/v1/games/{gameId}/characters", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth), jwtauth.Authenticator(tokenAuth))
		r.Post("/", handler.CreateCharacter)
	})
	r.Route("/api/v1/characters/{id}", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth), jwtauth.Authenticator(tokenAuth))
		r.Post("/approve", handler.ApproveCharacter)
		r.Post("/data", handler.SetCharacterData)
	})

	testCases := []struct {
		name           string
		endpoint       string
		method         string
		token          string
		expectedStatus int
		body           interface{}
		reason         string
	}{
		{
			name:           "non-participant cannot create character",
			endpoint:       fmt.Sprintf("/api/v1/games/%d/characters", game.ID),
			method:         "POST",
			token:          otherToken,
			expectedStatus: http.StatusForbidden,
			body: CreateCharacterRequest{
				Name:          "Unauthorized Character",
				CharacterType: "player_character",
			},
			reason: "non-participants should not create characters",
		},
		{
			name:           "only GM can approve characters",
			endpoint:       fmt.Sprintf("/api/v1/characters/%d/approve", character.ID),
			method:         "POST",
			token:          playerToken,
			expectedStatus: http.StatusForbidden,
			body: ApproveCharacterRequest{
				Status: "approved",
			},
			reason: "only GM should approve characters",
		},
		{
			name:           "GM can approve characters",
			endpoint:       fmt.Sprintf("/api/v1/characters/%d/approve", character.ID),
			method:         "POST",
			token:          gmToken,
			expectedStatus: http.StatusOK,
			body: ApproveCharacterRequest{
				Status: "approved",
			},
			reason: "GM should be able to approve characters",
		},
		{
			name:           "character owner can edit data",
			endpoint:       fmt.Sprintf("/api/v1/characters/%d/data", character.ID),
			method:         "POST",
			token:          playerToken,
			expectedStatus: http.StatusNoContent,
			body: CharacterDataRequest{
				ModuleType: "bio",
				FieldName:  "background",
				FieldValue: "A noble hero",
				FieldType:  "text",
				IsPublic:   true,
			},
			reason: "character owner should edit their character data",
		},
		{
			name:           "other users cannot edit character data",
			endpoint:       fmt.Sprintf("/api/v1/characters/%d/data", character.ID),
			method:         "POST",
			token:          otherToken,
			expectedStatus: http.StatusForbidden,
			body: CharacterDataRequest{
				ModuleType: "bio",
				FieldName:  "background",
				FieldValue: "Unauthorized edit",
				FieldType:  "text",
				IsPublic:   true,
			},
			reason: "other users should not edit character data",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(tc.method, tc.endpoint, bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+tc.token)

			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tc.expectedStatus {
				t.Errorf("%s: expected %d, got %d. Response: %s", tc.reason, tc.expectedStatus, w.Code, w.Body.String())
			}
		})
	}
}

func TestCharacterAPI_ErrorHandling(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "game_participants", "games", "sessions", "users")

	// Setup application
	app := core.NewTestApp(testDB.Pool)

	// Create test user and game
	gmUser := testDB.CreateTestUser(t, "gm", "gm@example.com")
	playerUser := testDB.CreateTestUser(t, "player", "player@example.com")

	gameService := &services.GameService{DB: testDB.Pool}
	game, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "Error Test Game",
		Description: "Testing error handling",
		GMUserID:    int32(gmUser.ID),
		IsPublic:    true,
	})
	core.AssertNoError(t, err, "Failed to create test game")

	// Add player as participant for character creation tests
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Failed to add player participant")

	gmToken, err := createTestAuthToken(gmUser.Username)
	core.AssertNoError(t, err, "Failed to create GM token")

	playerToken, err := createTestAuthToken(playerUser.Username)
	core.AssertNoError(t, err, "Failed to create player token")

	// Setup router with JWT middleware
	tokenAuth := core.CreateTestTokenAuth()
	r := chi.NewRouter()
	handler := Handler{App: app}

	r.Route("/api/v1/games/{gameId}/characters", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth), jwtauth.Authenticator(tokenAuth))
		r.Post("/", handler.CreateCharacter)
	})
	r.Route("/api/v1/characters/{id}", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth), jwtauth.Authenticator(tokenAuth))
		r.Get("/", handler.GetCharacter)
		r.Post("/approve", handler.ApproveCharacter)
	})

	testCases := []struct {
		name           string
		endpoint       string
		method         string
		body           interface{}
		token          string
		expectedStatus int
		reason         string
	}{
		{
			name:     "create character with missing name",
			endpoint: fmt.Sprintf("/api/v1/games/%d/characters", game.ID),
			method:   "POST",
			token:    playerToken,
			body: CreateCharacterRequest{
				Name:          "",
				CharacterType: "player_character",
			},
			expectedStatus: http.StatusBadRequest,
			reason:         "should reject empty character name",
		},
		{
			name:     "create character with invalid type",
			endpoint: fmt.Sprintf("/api/v1/games/%d/characters", game.ID),
			method:   "POST",
			token:    playerToken,
			body: CreateCharacterRequest{
				Name:          "Invalid Character",
				CharacterType: "invalid_type",
			},
			expectedStatus: http.StatusBadRequest,
			reason:         "should reject invalid character type",
		},
		{
			name:           "get nonexistent character",
			endpoint:       "/api/v1/characters/99999",
			method:         "GET",
			token:          gmToken,
			body:           nil,
			expectedStatus: http.StatusInternalServerError,
			reason:         "should handle nonexistent character",
		},
		{
			name:     "approve nonexistent character",
			endpoint: "/api/v1/characters/99999/approve",
			method:   "POST",
			token:    gmToken,
			body: ApproveCharacterRequest{
				Status: "approved",
			},
			expectedStatus: http.StatusInternalServerError,
			reason:         "should handle nonexistent character for approval",
		},
		{
			name:     "invalid character ID format",
			endpoint: "/api/v1/characters/invalid/approve",
			method:   "POST",
			token:    gmToken,
			body: ApproveCharacterRequest{
				Status: "approved",
			},
			expectedStatus: http.StatusBadRequest,
			reason:         "should reject invalid character ID format",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var req *http.Request
			if tc.body != nil {
				body, _ := json.Marshal(tc.body)
				req = httptest.NewRequest(tc.method, tc.endpoint, bytes.NewBuffer(body))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(tc.method, tc.endpoint, nil)
			}
			req.Header.Set("Authorization", "Bearer "+tc.token)

			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			if w.Code != tc.expectedStatus {
				t.Errorf("%s: expected %d, got %d. Response: %s", tc.reason, tc.expectedStatus, w.Code, w.Body.String())
			}
		})
	}
}

func TestCharacterAPI_UnauthenticatedAccess(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "games", "sessions", "users")

	// Setup application
	app := core.NewTestApp(testDB.Pool)

	// Create test user (game not needed for this test)
	gmUser := testDB.CreateTestUser(t, "gm", "gm@example.com")
	_ = gmUser // Suppress unused variable warning

	// Setup router with JWT middleware
	r := chi.NewRouter()
	tokenAuth := core.CreateTestTokenAuth()

	handler := Handler{App: app}
	r.Route("/api/v1/characters/{id}", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth), jwtauth.Authenticator(tokenAuth))
		r.Get("/", handler.GetCharacter)
		r.Post("/data", handler.SetCharacterData)
	})

	testCases := []struct {
		name     string
		endpoint string
		method   string
	}{
		{
			name:     "get character without auth",
			endpoint: "/api/v1/characters/1",
			method:   "GET",
		},
		{
			name:     "set character data without auth",
			endpoint: "/api/v1/characters/1/data",
			method:   "POST",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.endpoint, nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			core.AssertEqual(t, http.StatusUnauthorized, w.Code, "Should require authentication")
		})
	}
}

// createTestAuthToken creates a JWT token for testing purposes
func createTestAuthToken(username string) (string, error) {
	tokenAuth := core.CreateTestTokenAuth()

	claims := map[string]interface{}{
		"username": username,
		"exp":      time.Now().Add(time.Hour).Unix(),
	}

	_, tokenString, err := tokenAuth.Encode(claims)
	return tokenString, err
}
