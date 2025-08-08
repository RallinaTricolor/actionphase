package db

import (
	"context"
	"testing"
	"time"

	"actionphase/pkg/core"
)

func TestGameService_CreateGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	// Setup test fixtures
	fixtures := testDB.SetupFixtures(t)
	gameService := &GameService{DB: testDB.Pool}

	testCases := []struct {
		name        string
		request     core.CreateGameRequest
		expectError bool
		checkState  string
	}{
		{
			name: "valid game creation",
			request: core.CreateGameRequest{
				Title:       "Test Game",
				Description: "A test game for our new system",
				GMUserID:    int32(fixtures.TestUser.ID),
				Genre:       "Fantasy",
				StartDate:   core.TimePtr(time.Now().Add(24 * time.Hour)),
				EndDate:     core.TimePtr(time.Now().Add(7 * 24 * time.Hour)),
				MaxPlayers:  6,
				IsPublic:    true,
			},
			expectError: false,
			checkState:  "setup",
		},
		{
			name: "minimum valid game",
			request: core.CreateGameRequest{
				Title:       "Minimal Game",
				Description: "Minimal test game",
				GMUserID:    int32(fixtures.TestUser.ID),
				IsPublic:    false,
			},
			expectError: false,
			checkState:  "setup",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			game, err := gameService.CreateGame(context.Background(), tc.request)

			if tc.expectError {
				core.AssertError(t, err, "Expected error for invalid game creation")
				return
			}

			core.AssertNoError(t, err, "Failed to create game")
			core.AssertEqual(t, tc.request.Title, game.Title, "Game title mismatch")
			core.AssertEqual(t, tc.checkState, game.State.String, "Game state mismatch")
			core.AssertEqual(t, tc.request.GMUserID, game.GmUserID, "GM user ID mismatch")

			t.Logf("Successfully created game with ID: %d", game.ID)
		})
	}
}

func TestGameService_UpdateGameState(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	gameService := &GameService{DB: testDB.Pool}

	// Create a test game first
	req := core.CreateGameRequest{
		Title:       "State Test Game",
		Description: "Testing state transitions",
		GMUserID:    int32(fixtures.TestUser.ID),
		IsPublic:    false,
	}

	game, err := gameService.CreateGame(context.Background(), req)
	core.AssertNoError(t, err, "Failed to create game")

	validTransitions := []struct {
		fromState string
		toState   string
		expected  bool
	}{
		{"setup", "recruitment", true},
		{"recruitment", "character_creation", true},
		{"character_creation", "in_progress", true},
		{"in_progress", "paused", true},
		{"paused", "in_progress", true},
		{"in_progress", "completed", true},
		{"setup", "cancelled", true},
		{"setup", "invalid_state", false},
	}

	currentState := "setup"
	for _, tt := range validTransitions {
		if tt.fromState == currentState {
			t.Run("transition_to_"+tt.toState, func(t *testing.T) {
				updatedGame, err := gameService.UpdateGameState(context.Background(), game.ID, tt.toState)

				if !tt.expected {
					core.AssertError(t, err, "Expected error for invalid state transition")
					return
				}

				core.AssertNoError(t, err, "Failed to update game state")
				core.AssertEqual(t, tt.toState, updatedGame.State.String, "Game state not updated correctly")
				currentState = tt.toState

				t.Logf("Successfully updated game state to: %s", updatedGame.State.String)
			})
		}
	}
}

// NOTE: TestGameService_JoinGame has been removed because direct joining is no longer supported.
// All game participation now goes through the application system (GameApplicationService).
// See game_applications_test.go for tests of the new application-based joining process.

func TestGameService_LeaveGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_applications", "game_participants", "games", "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	gameService := &GameService{DB: testDB.Pool}

	// Create a player
	player := testDB.CreateTestUser(t, "player2", "player2@example.com")

	// Create and setup game
	req := core.CreateGameRequest{
		Title:       "Leave Test Game",
		Description: "Testing game leaving",
		GMUserID:    int32(fixtures.TestUser.ID),
		IsPublic:    true,
	}

	game, err := gameService.CreateGame(context.Background(), req)
	core.AssertNoError(t, err, "Failed to create game")

	_, err = gameService.UpdateGameState(context.Background(), game.ID, "recruitment")
	core.AssertNoError(t, err, "Failed to set game to recruitment")

	// Add player as participant directly (since we removed JoinGame method)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	core.AssertNoError(t, err, "Failed to add game participant")

	testCases := []struct {
		name        string
		gameID      int32
		userID      int32
		expectError bool
		reason      string
	}{
		{
			name:        "valid player leave",
			gameID:      game.ID,
			userID:      int32(player.ID),
			expectError: false,
			reason:      "Player should be able to leave",
		},
		{
			name:        "GM cannot leave their own game",
			gameID:      game.ID,
			userID:      int32(fixtures.TestUser.ID),
			expectError: true,
			reason:      "GM should not be able to leave their own game",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := gameService.LeaveGame(context.Background(), tc.gameID, tc.userID)

			if tc.expectError {
				core.AssertError(t, err, tc.reason)
				return
			}

			core.AssertNoError(t, err, tc.reason)

			// Verify user is no longer in game (if they were a participant, not GM)
			if tc.userID != int32(fixtures.TestUser.ID) {
				inGame, err := gameService.IsUserInGame(context.Background(), tc.gameID, tc.userID)
				core.AssertNoError(t, err, "Failed to check if user is in game")
				core.AssertEqual(t, false, inGame, "User should not be in game after leaving")
			}
		})
	}
}

func TestGameService_GetUserRole(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_applications", "game_participants", "games", "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	gameService := &GameService{DB: testDB.Pool}

	// Create a player
	player := testDB.CreateTestUser(t, "player3", "player3@example.com")

	// Create game
	game := testDB.CreateTestGame(t, int32(fixtures.TestUser.ID), "Role Test Game")

	// Move to recruitment and add player
	_, err := gameService.UpdateGameState(context.Background(), game.ID, "recruitment")
	core.AssertNoError(t, err, "Failed to set game to recruitment")

	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	core.AssertNoError(t, err, "Failed to add game participant")

	testCases := []struct {
		name         string
		gameID       int32
		userID       int32
		expectedRole string
		expectError  bool
	}{
		{
			name:         "GM role",
			gameID:       game.ID,
			userID:       int32(fixtures.TestUser.ID),
			expectedRole: "gm",
			expectError:  false,
		},
		{
			name:         "Player role",
			gameID:       game.ID,
			userID:       int32(player.ID),
			expectedRole: "player",
			expectError:  false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			role, err := gameService.GetUserRole(context.Background(), tc.gameID, tc.userID)

			if tc.expectError {
				core.AssertError(t, err, "Expected error getting user role")
				return
			}

			core.AssertNoError(t, err, "Failed to get user role")
			core.AssertEqual(t, tc.expectedRole, role, "User role mismatch")
		})
	}
}

func TestGameService_UpdateGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	gameService := &GameService{DB: testDB.Pool}

	// Create a game to update
	game := testDB.CreateTestGame(t, int32(fixtures.TestUser.ID), "Original Title")

	// Update the game
	updateReq := core.UpdateGameRequest{
		ID:          game.ID,
		Title:       "Updated Title",
		Description: "Updated description",
		Genre:       "Updated Genre",
		MaxPlayers:  8,
		IsPublic:    false,
	}

	updatedGame, err := gameService.UpdateGame(context.Background(), updateReq)
	core.AssertNoError(t, err, "Failed to update game")

	core.AssertEqual(t, updateReq.Title, updatedGame.Title, "Title not updated")
	core.AssertEqual(t, updateReq.Description, updatedGame.Description.String, "Description not updated")
	core.AssertEqual(t, updateReq.MaxPlayers, updatedGame.MaxPlayers.Int32, "MaxPlayers not updated")
	core.AssertEqual(t, updateReq.IsPublic, updatedGame.IsPublic.Bool, "IsPublic not updated")
}

func TestGameService_DeleteGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	gameService := &GameService{DB: testDB.Pool}

	// Create a game to delete
	game := testDB.CreateTestGame(t, int32(fixtures.TestUser.ID), "Game to Delete")

	// Delete the game
	err := gameService.DeleteGame(context.Background(), game.ID)
	core.AssertNoError(t, err, "Failed to delete game")

	// Verify game is deleted
	_, err = gameService.GetGame(context.Background(), game.ID)
	core.AssertError(t, err, "Game should be deleted and not findable")
}

// Benchmark tests for performance monitoring
func BenchmarkGameService_CreateGame(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "games", "users")

	fixtures := testDB.SetupFixtures(b)
	gameService := &GameService{DB: testDB.Pool}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		req := core.CreateGameRequest{
			Title:       "Benchmark Game",
			Description: "Benchmark test game",
			GMUserID:    int32(fixtures.TestUser.ID),
			IsPublic:    true,
		}

		_, err := gameService.CreateGame(context.Background(), req)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkGameService_GetGame(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "games", "users")

	fixtures := testDB.SetupFixtures(b)
	gameService := &GameService{DB: testDB.Pool}

	// Create a game for benchmarking
	game := testDB.CreateTestGame(b, int32(fixtures.TestUser.ID), "Benchmark Lookup Game")

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := gameService.GetGame(context.Background(), game.ID)
		if err != nil {
			b.Fatal(err)
		}
	}
}

// Helper function for time pointers
func timePtr(t time.Time) *time.Time {
	return &t
}
