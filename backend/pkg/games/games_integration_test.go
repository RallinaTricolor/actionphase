package games

import (
	"actionphase/pkg/auth"
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

// TestGameAPI_CompleteGameLifecycle tests the complete game management workflow
func TestGameAPI_CompleteGameLifecycle(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_applications", "game_participants", "games", "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupGameTestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := createTestAuthToken(fixtures.TestUser.Username)
	core.AssertNoError(t, err, "Test token creation should succeed")

	var createdGameID int32

	// Step 1: Create a game
	t.Run("create_game", func(t *testing.T) {
		gameData := CreateGameRequest{
			Title:       "Test RPG Campaign",
			Description: "A comprehensive test campaign for integration testing purposes",
			Genre:       "Fantasy RPG",
			MaxPlayers:  6,
		}

		payload, _ := json.Marshal(gameData)
		req := httptest.NewRequest("POST", "/api/v1/games", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 201, w.Code, "Game creation should succeed")

		var response GameResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		// Store game ID for subsequent tests
		createdGameID = response.ID

		core.AssertEqual(t, gameData.Title, response.Title, "Title should match")
		core.AssertEqual(t, gameData.Description, response.Description, "Description should match")
		core.AssertEqual(t, gameData.Genre, response.Genre, "Genre should match")
		core.AssertEqual(t, gameData.MaxPlayers, response.MaxPlayers, "Max players should match")
		core.AssertEqual(t, "setup", response.State, "New game should be in setup state")
	})

	// Step 2: Get the created game
	t.Run("get_game", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(createdGameID)), nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Get game should succeed")

		var response GameResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		core.AssertEqual(t, createdGameID, response.ID, "Game ID should match")
		core.AssertEqual(t, "Test RPG Campaign", response.Title, "Title should match")
	})

	// Step 3: Get game with details
	t.Run("get_game_with_details", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(createdGameID))+"/details", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Get game with details should succeed")

		var response GameWithDetailsResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		core.AssertEqual(t, createdGameID, response.ID, "Game ID should match")
		core.AssertEqual(t, int64(0), response.CurrentPlayers, "New game should have 0 players")
		core.AssertNotEqual(t, "", response.GMUsername, "GM username should be populated")
	})

	// Step 4: Update game details
	t.Run("update_game", func(t *testing.T) {
		updateData := UpdateGameRequest{
			Title:       "Updated RPG Campaign",
			Description: "An updated comprehensive test campaign",
			Genre:       "Sci-Fi RPG",
			MaxPlayers:  8,
			IsPublic:    true,
		}

		payload, _ := json.Marshal(updateData)
		req := httptest.NewRequest("PUT", "/api/v1/games/"+strconv.Itoa(int(createdGameID)), bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Game update should succeed")

		var response GameResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		core.AssertEqual(t, updateData.Title, response.Title, "Updated title should match")
		core.AssertEqual(t, updateData.Description, response.Description, "Updated description should match")
		core.AssertEqual(t, updateData.Genre, response.Genre, "Updated genre should match")
		core.AssertEqual(t, updateData.MaxPlayers, response.MaxPlayers, "Updated max players should match")
	})

	// Step 5: Update game state
	t.Run("update_game_state", func(t *testing.T) {
		stateData := UpdateGameStateRequest{
			State: "in_progress",
		}

		payload, _ := json.Marshal(stateData)
		req := httptest.NewRequest("PUT", "/api/v1/games/"+strconv.Itoa(int(createdGameID))+"/state", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Game state update should succeed")

		var response GameResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		core.AssertEqual(t, "in_progress", response.State, "Game state should be updated to in_progress")
	})

	// Step 6: Delete game
	t.Run("delete_game", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(createdGameID)), nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 204, w.Code, "Game deletion should succeed")

		// Verify game is deleted by trying to get it
		getReq := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(createdGameID)), nil)
		getReq.Header.Set("Authorization", "Bearer "+accessToken)
		getW := httptest.NewRecorder()

		router.ServeHTTP(getW, getReq)
		core.AssertEqual(t, 500, getW.Code, "Getting deleted game should fail")
	})
}

// TestGameAPI_PublicEndpoints tests game listing endpoints that require authentication
func TestGameAPI_PublicEndpoints(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_applications", "game_participants", "games", "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupGameTestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := createTestAuthToken(fixtures.TestUser.Username)
	core.AssertNoError(t, err, "Test token creation should succeed")

	// Create a test game directly via service
	gameService := &db.GameService{DB: testDB.Pool}
	createdGame, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "Public Test Game",
		Description: "A game for testing public endpoints",
		GMUserID:    int32(fixtures.TestUser.ID),
		Genre:       "Action",
		MaxPlayers:  4,
		IsPublic:    true,
	})
	core.AssertNoError(t, err, "Test game creation should succeed")

	// Update game to recruiting state for recruiting games test
	_, err = gameService.UpdateGameState(context.Background(), createdGame.ID, "recruitment")
	core.AssertNoError(t, err, "Game state update should succeed")

	// Test get all games (authenticated)
	t.Run("get_all_games", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/public", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Get all games should succeed")

		var response []map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		core.AssertTrue(t, len(response) >= 1, "Should return at least one game")

		// Find our test game in the response
		found := false
		for _, game := range response {
			if int32(game["id"].(float64)) == createdGame.ID {
				core.AssertEqual(t, "Public Test Game", game["title"].(string), "Game title should match")
				found = true
				break
			}
		}
		core.AssertTrue(t, found, "Created game should be in the response")
	})

	// Test get recruiting games (authenticated)
	t.Run("get_recruiting_games", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/recruiting", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Get recruiting games should succeed")

		var response []map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		// New games should be in recruiting state by default
		found := false
		for _, game := range response {
			if int32(game["id"].(float64)) == createdGame.ID {
				core.AssertEqual(t, "recruitment", game["state"].(string), "Game should be recruiting")
				found = true
				break
			}
		}
		core.AssertTrue(t, found, "Recruiting game should be in the response")
	})

	// Test get single game (authenticated)
	t.Run("get_single_game", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(createdGame.ID)), nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Get single game should succeed")

		var response GameResponse
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		core.AssertEqual(t, createdGame.ID, response.ID, "Game ID should match")
		core.AssertEqual(t, "Public Test Game", response.Title, "Game title should match")
	})

	// Test get game participants (authenticated)
	t.Run("get_game_participants", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(createdGame.ID))+"/participants", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Get game participants should succeed")

		var response []map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		core.AssertEqual(t, 0, len(response), "New game should have no participants")
	})
}

// TestGameAPI_ParticipantManagement tests game participation features
func TestGameAPI_ParticipantManagement(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_applications", "game_participants", "games", "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupGameTestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, _ := createTestAuthToken(fixtures.TestUser.Username)

	// Create a game for testing participation
	gameService := &db.GameService{DB: testDB.Pool}
	testGame, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "Participant Test Game",
		Description: "A game for testing participant management",
		GMUserID:    int32(fixtures.TestUser.ID),
		MaxPlayers:  3,
		IsPublic:    true,
	})
	core.AssertNoError(t, err, "Test game creation should succeed")

	// Update game to recruitment state to allow joining
	_, err = gameService.UpdateGameState(context.Background(), testGame.ID, "recruitment")
	core.AssertNoError(t, err, "Game state update should succeed")

	// Create a second test user for joining the game
	userService := &db.UserService{DB: testDB.Pool}
	secondUser := &core.User{
		Username: "participant_user_" + strconv.Itoa(int(time.Now().UnixNano())),
		Email:    "participant_" + strconv.Itoa(int(time.Now().UnixNano())) + "@test.com",
		Password: "testpassword123",
	}
	_ = secondUser.HashPassword()
	createdSecondUser, err := userService.CreateUser(secondUser)
	core.AssertNoError(t, err, "Second user creation should succeed")

	secondUserToken, _ := createTestAuthToken(createdSecondUser.Username)

	// NOTE: Direct joining tests removed because direct joining is no longer supported.
	// All game participation now goes through the application system.
	// See game_applications_integration_test.go for tests of the new application-based joining process.

	// For this test, manually add participant to test leave functionality
	_, err = gameService.AddGameParticipant(context.Background(), testGame.ID, int32(createdSecondUser.ID), "player")
	core.AssertNoError(t, err, "Failed to add test participant")

	// Test getting game participants
	t.Run("get_participants", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(testGame.ID))+"/participants", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Get participants should succeed")

		var response []map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		core.AssertEqual(t, 1, len(response), "Should have one participant")
		core.AssertEqual(t, createdSecondUser.Username, response[0]["username"].(string), "Username should match")
		core.AssertEqual(t, "player", response[0]["role"].(string), "Role should match")
	})

	// NOTE: Duplicate join test removed because direct joining is no longer supported.

	// Test leaving a game
	t.Run("leave_game", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(testGame.ID))+"/leave", nil)
		req.Header.Set("Authorization", "Bearer "+secondUserToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 204, w.Code, "Leaving game should succeed")

		// Verify participant was removed
		getReq := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(testGame.ID))+"/participants", nil)
		getReq.Header.Set("Authorization", "Bearer "+accessToken)
		getW := httptest.NewRecorder()

		router.ServeHTTP(getW, getReq)

		var response []map[string]interface{}
		err := json.Unmarshal(getW.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		core.AssertEqual(t, 0, len(response), "Should have no participants after leaving")
	})
}

// TestGameAPI_Authorization tests authorization rules for game management
func TestGameAPI_Authorization(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_applications", "game_participants", "games", "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupGameTestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	// Create a game owned by the test user
	gameService := &db.GameService{DB: testDB.Pool}
	testGame, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
		Title:       "Authorization Test Game",
		Description: "A game for testing authorization",
		GMUserID:    int32(fixtures.TestUser.ID),
		IsPublic:    true,
	})
	core.AssertNoError(t, err, "Test game creation should succeed")

	// Create a second user who doesn't own the game
	userService := &db.UserService{DB: testDB.Pool}
	nonOwner := &core.User{
		Username: "nonowner_" + strconv.Itoa(int(time.Now().UnixNano())),
		Email:    "nonowner_" + strconv.Itoa(int(time.Now().UnixNano())) + "@test.com",
		Password: "testpassword123",
	}
	_ = nonOwner.HashPassword()
	createdNonOwner, err := userService.CreateUser(nonOwner)
	core.AssertNoError(t, err, "Non-owner user creation should succeed")

	ownerToken, _ := createTestAuthToken(fixtures.TestUser.Username)
	nonOwnerToken, _ := createTestAuthToken(createdNonOwner.Username)

	// Test that non-owner cannot update game
	t.Run("non_owner_cannot_update_game", func(t *testing.T) {
		updateData := UpdateGameRequest{
			Title:       "Unauthorized Update",
			Description: "This should not work",
			IsPublic:    false,
		}

		payload, _ := json.Marshal(updateData)
		req := httptest.NewRequest("PUT", "/api/v1/games/"+strconv.Itoa(int(testGame.ID)), bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+nonOwnerToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 403, w.Code, "Non-owner should not be able to update game")
	})

	// Test that non-owner cannot update game state
	t.Run("non_owner_cannot_update_state", func(t *testing.T) {
		stateData := UpdateGameStateRequest{
			State: "active",
		}

		payload, _ := json.Marshal(stateData)
		req := httptest.NewRequest("PUT", "/api/v1/games/"+strconv.Itoa(int(testGame.ID))+"/state", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+nonOwnerToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 403, w.Code, "Non-owner should not be able to update game state")
	})

	// Test that non-owner cannot delete game
	t.Run("non_owner_cannot_delete_game", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/games/"+strconv.Itoa(int(testGame.ID)), nil)
		req.Header.Set("Authorization", "Bearer "+nonOwnerToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 403, w.Code, "Non-owner should not be able to delete game")
	})

	// Test that owner can perform all operations
	t.Run("owner_can_update_game", func(t *testing.T) {
		updateData := UpdateGameRequest{
			Title:       "Owner Update",
			Description: "This should work",
			IsPublic:    true,
		}

		payload, _ := json.Marshal(updateData)
		req := httptest.NewRequest("PUT", "/api/v1/games/"+strconv.Itoa(int(testGame.ID)), bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+ownerToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Owner should be able to update game")
	})
}

// TestGameAPI_ErrorHandling tests various error conditions
func TestGameAPI_ErrorHandling(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_applications", "game_participants", "games", "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupGameTestRouter(app)
	fixtures := testDB.SetupFixtures(t)
	token, _ := createTestAuthToken(fixtures.TestUser.Username)

	testCases := []struct {
		name           string
		method         string
		endpoint       string
		payload        interface{}
		requiresAuth   bool
		expectedStatus int
		description    string
	}{
		{
			name:     "create_game_missing_title",
			method:   "POST",
			endpoint: "/api/v1/games",
			payload: CreateGameRequest{
				Description: "Game without title",
			},
			requiresAuth:   true,
			expectedStatus: 400,
			description:    "Creating game without title should fail",
		},
		{
			name:     "create_game_no_auth",
			method:   "POST",
			endpoint: "/api/v1/games",
			payload: CreateGameRequest{
				Title:       "Unauthorized Game",
				Description: "This should fail",
			},
			requiresAuth:   false,
			expectedStatus: 401,
			description:    "Creating game without auth should fail",
		},
		{
			name:           "get_nonexistent_game",
			method:         "GET",
			endpoint:       "/api/v1/games/99999",
			payload:        nil,
			requiresAuth:   true,
			expectedStatus: 500, // sqlc returns error for non-existent records
			description:    "Getting non-existent game should fail",
		},
		{
			name:           "invalid_game_id",
			method:         "GET",
			endpoint:       "/api/v1/games/invalid",
			payload:        nil,
			requiresAuth:   true,
			expectedStatus: 400,
			description:    "Invalid game ID should return 400",
		},
		// NOTE: join_nonexistent_game test removed because direct joining is no longer supported
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var req *http.Request
			if tc.payload != nil {
				payload, _ := json.Marshal(tc.payload)
				req = httptest.NewRequest(tc.method, tc.endpoint, bytes.NewBuffer(payload))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(tc.method, tc.endpoint, nil)
			}

			if tc.requiresAuth {
				req.Header.Set("Authorization", "Bearer "+token)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			// Verify error response has proper structure
			if w.Code >= 400 {
				// Some unauthorized responses might not be JSON (e.g., from middleware)
				if w.Header().Get("Content-Type") == "application/json" ||
					w.Code != 401 { // Allow non-JSON responses for 401 (authentication middleware)
					var response map[string]interface{}
					err := json.Unmarshal(w.Body.Bytes(), &response)
					if err != nil {
						t.Logf("Response body: %s", w.Body.String())
						t.Logf("Content-Type: %s", w.Header().Get("Content-Type"))
					}
					core.AssertNoError(t, err, "Error response should be valid JSON")
					core.AssertNotEqual(t, "", response["status"], "Error response should have status field")
				}
			}
		})
	}
}

// setupGameTestRouter creates a test router with game routes configured
func setupGameTestRouter(app *core.App) *chi.Mux {
	tokenAuth := core.CreateTestTokenAuth()

	r := chi.NewRouter()

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Games API
		r.Route("/games", func(r chi.Router) {
			gameHandler := Handler{App: app}

			// All routes require authentication
			r.Group(func(r chi.Router) {
				r.Use(jwtauth.Verifier(tokenAuth))
				r.Use(jwtauth.Authenticator(tokenAuth))

				// Game listing and viewing
				r.Get("/public", gameHandler.GetAllGames)
				r.Get("/recruiting", gameHandler.GetRecruitingGames)
				r.Get("/{id}", gameHandler.GetGame)
				r.Get("/{id}/details", gameHandler.GetGameWithDetails)
				r.Get("/{id}/participants", gameHandler.GetGameParticipants)

				// Game management
				r.Post("/", gameHandler.CreateGame)
				r.Put("/{id}", gameHandler.UpdateGame)
				r.Delete("/{id}", gameHandler.DeleteGame)
				r.Put("/{id}/state", gameHandler.UpdateGameState)

				// Participant management
				// NOTE: join endpoint removed - use application system instead
				r.Delete("/{id}/leave", gameHandler.LeaveGame)

				// Game application management
				r.Post("/{id}/apply", gameHandler.ApplyToGame)
				r.Get("/{id}/applications", gameHandler.GetGameApplications)
				r.Put("/{id}/applications/{applicationId}/review", gameHandler.ReviewGameApplication)
				r.Delete("/{id}/application", gameHandler.WithdrawGameApplication)
			})
		})
	})

	return r
}

// setupAuthTestRouter creates a test router with auth routes for token creation
func setupAuthTestRouter(app *core.App) *chi.Mux {
	tokenAuth := core.CreateTestTokenAuth()

	r := chi.NewRouter()

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			authHandler := auth.Handler{App: app}
			r.Post("/register", authHandler.V1Register)
			r.Post("/login", authHandler.V1Login)
			r.Group(func(r chi.Router) {
				r.Use(jwtauth.Verifier(tokenAuth))
				r.Use(jwtauth.Authenticator(tokenAuth))
				r.Get("/refresh", authHandler.V1Refresh)
			})
		})
	})

	return r
}

// createTestAuthToken creates a JWT token for testing purposes
func createTestAuthToken(username string) (string, error) {
	return core.CreateTestJWTToken(username)
}

// Benchmark tests for performance monitoring
func BenchmarkGameAPI_CreateGame(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "game_applications", "game_participants", "games", "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupGameTestRouter(app)
	fixtures := testDB.SetupFixtures(b)
	token, _ := createTestAuthToken(fixtures.TestUser.Username)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		gameData := CreateGameRequest{
			Title:       "Benchmark Game " + strconv.Itoa(i),
			Description: "A game created during benchmark testing",
			Genre:       "Test",
			MaxPlayers:  4,
		}

		payload, _ := json.Marshal(gameData)
		req := httptest.NewRequest("POST", "/api/v1/games", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != 201 {
			b.Fatalf("Game creation failed with status %d", w.Code)
		}
	}
}

func BenchmarkGameAPI_GetAllGames(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "game_applications", "game_participants", "games", "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupGameTestRouter(app)
	fixtures := testDB.SetupFixtures(b)

	// Create auth token for test user
	accessToken, err := createTestAuthToken(fixtures.TestUser.Username)
	if err != nil {
		b.Fatalf("Test token creation should succeed: %v", err)
	}

	// Create some test games
	gameService := &db.GameService{DB: testDB.Pool}
	for i := 0; i < 10; i++ {
		_, _ = gameService.CreateGame(context.Background(), core.CreateGameRequest{
			Title:       "Benchmark Game " + strconv.Itoa(i),
			Description: "A game for benchmark testing",
			GMUserID:    int32(fixtures.TestUser.ID),
			IsPublic:    true,
		})
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/api/v1/games/public", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != 200 {
			b.Fatalf("Get all games failed with status %d", w.Code)
		}
	}
}
