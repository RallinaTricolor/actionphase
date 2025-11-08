package characters

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

// setupCharacterTestRouter creates a test router with auth middleware
func setupCharacterTestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	router := chi.NewRouter()

	router.Route("/api/v1", func(r chi.Router) {
		r.Route("/games/{gameId}", func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(core.RequireAuthenticationMiddleware(userService))

			handler := &Handler{App: app}
			r.Post("/characters", handler.CreateCharacter)
		})
	})

	return router
}

// createTestAuthToken creates a JWT token for testing
func createTestAuthToken(app *core.App, user *core.User) (string, error) {
	return core.CreateTestJWTTokenForUser(app, user)
}

// TestCharacterAPI_GMCanCreatePlayerCharacters tests that GMs can create player characters for players
func TestCharacterAPI_GMCanCreatePlayerCharacters(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "characters", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create additional player user
	playerUser := testDB.CreateTestUser(t, "testplayer", "testplayer@example.com")

	// Add player to game
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err := gameService.AddGameParticipant(context.Background(), fixtures.TestGame.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Adding player to game should succeed")

	// Create GM token
	gmToken, err := createTestAuthToken(app, fixtures.TestUser)
	core.AssertNoError(t, err, "GM token creation should succeed")

	testCases := []struct {
		name           string
		payload        CreateCharacterRequest
		expectedStatus int
		description    string
		validateFn     func(t *testing.T, response *CharacterResponse)
	}{
		{
			name: "gm_creates_player_character_for_player",
			payload: func() CreateCharacterRequest {
				playerUserID := int32(playerUser.ID)
				return CreateCharacterRequest{
					Name:          "Test Character for Player",
					CharacterType: "player_character",
					UserID:        &playerUserID,
				}
			}(),
			expectedStatus: 201,
			description:    "GM should be able to create player character for another player",
			validateFn: func(t *testing.T, response *CharacterResponse) {
				core.AssertEqual(t, "Test Character for Player", response.Name, "Character name should match")
				core.AssertEqual(t, "player_character", response.CharacterType, "Character type should be player_character")
				if response.UserID == nil {
					t.Errorf("UserID should be set")
				} else {
					core.AssertEqual(t, int32(playerUser.ID), *response.UserID, "Character should be assigned to correct player")
				}
			},
		},
		{
			name: "gm_creates_player_character_without_user_id",
			payload: CreateCharacterRequest{
				Name:          "Test Character No User",
				CharacterType: "player_character",
				UserID:        nil, // Missing required user_id
			},
			expectedStatus: 400,
			description:    "GM must provide user_id when creating player character",
		},
		{
			name: "gm_creates_npc",
			payload: CreateCharacterRequest{
				Name:          "Test NPC",
				CharacterType: "npc",
				UserID:        nil, // NPCs don't need user_id
			},
			expectedStatus: 201,
			description:    "GM should be able to create NPC without user_id",
			validateFn: func(t *testing.T, response *CharacterResponse) {
				core.AssertEqual(t, "Test NPC", response.Name, "NPC name should match")
				core.AssertEqual(t, "npc", response.CharacterType, "Character type should be npc")
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest("POST", "/api/v1/games/"+strconv.Itoa(int(fixtures.TestGame.ID))+"/characters", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+gmToken)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			if tc.expectedStatus == 201 && tc.validateFn != nil {
				var response CharacterResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Response should be valid JSON")
				tc.validateFn(t, &response)
			}
		})
	}
}

// TestCharacterAPI_PlayerCanOnlyCreateOwnCharacter tests that regular players can only create characters for themselves
func TestCharacterAPI_PlayerCanOnlyCreateOwnCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "characters", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create two player users
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	// Add both players to game
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err := gameService.AddGameParticipant(context.Background(), fixtures.TestGame.ID, int32(player1.ID), "player")
	core.AssertNoError(t, err, "Adding player1 to game should succeed")
	_, err = gameService.AddGameParticipant(context.Background(), fixtures.TestGame.ID, int32(player2.ID), "player")
	core.AssertNoError(t, err, "Adding player2 to game should succeed")

	// Create token for player1
	player1Token, err := createTestAuthToken(app, player1)
	core.AssertNoError(t, err, "Player1 token creation should succeed")

	testCases := []struct {
		name           string
		payload        CreateCharacterRequest
		expectedStatus int
		description    string
		validateFn     func(t *testing.T, response *CharacterResponse)
	}{
		{
			name: "player_creates_own_character",
			payload: CreateCharacterRequest{
				Name:          "My Character",
				CharacterType: "player_character",
				// UserID intentionally omitted - should auto-assign to authenticated user
			},
			expectedStatus: 201,
			description:    "Player should be able to create character for themselves",
			validateFn: func(t *testing.T, response *CharacterResponse) {
				core.AssertEqual(t, "My Character", response.Name, "Character name should match")
				core.AssertEqual(t, "player_character", response.CharacterType, "Character type should be player_character")
				if response.UserID == nil {
					t.Errorf("UserID should be set")
				} else {
					core.AssertEqual(t, int32(player1.ID), *response.UserID, "Character should be assigned to authenticated player")
				}
			},
		},
		{
			name: "player_tries_to_create_character_for_another_player",
			payload: func() CreateCharacterRequest {
				player2UserID := int32(player2.ID)
				return CreateCharacterRequest{
					Name:          "Someone Else's Character",
					CharacterType: "player_character",
					UserID:        &player2UserID, // Trying to assign to different player
				}
			}(),
			expectedStatus: 201,
			description:    "Player-provided UserID should be ignored; character auto-assigned to authenticated player",
			validateFn: func(t *testing.T, response *CharacterResponse) {
				// Even if player provides UserID, it should be ignored and assigned to themselves
				if response.UserID == nil {
					t.Errorf("UserID should be set")
				} else {
					core.AssertEqual(t, int32(player1.ID), *response.UserID, "Character should be assigned to authenticated player, not requested player")
				}
			},
		},
		{
			name: "player_tries_to_create_npc",
			payload: CreateCharacterRequest{
				Name:          "Player's NPC",
				CharacterType: "npc",
			},
			expectedStatus: 403,
			description:    "Regular player should not be able to create NPCs",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest("POST", "/api/v1/games/"+strconv.Itoa(int(fixtures.TestGame.ID))+"/characters", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+player1Token)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			if tc.expectedStatus == 201 && tc.validateFn != nil {
				var response CharacterResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Response should be valid JSON")
				tc.validateFn(t, &response)
			}
		})
	}
}
