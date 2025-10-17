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

func TestGameService_GetGamesByUser(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "sessions", "users")

	gameService := &GameService{DB: testDB.Pool}

	// Create users
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")

	// Create games for GM - GM must be added as participant to show up in GetGamesByUser
	game1 := testDB.CreateTestGame(t, int32(gm.ID), "GM Game 1")
	_, err := gameService.AddGameParticipant(context.Background(), game1.ID, int32(gm.ID), "player")
	core.AssertNoError(t, err, "Failed to add GM as participant")

	game2 := testDB.CreateTestGame(t, int32(gm.ID), "GM Game 2")
	_, err = gameService.AddGameParticipant(context.Background(), game2.ID, int32(gm.ID), "player")
	core.AssertNoError(t, err, "Failed to add GM as participant")

	// Create game where player is participant
	game3 := testDB.CreateTestGame(t, int32(gm.ID), "Player Game")
	_, err = gameService.AddGameParticipant(context.Background(), game3.ID, int32(gm.ID), "player")
	core.AssertNoError(t, err, "Failed to add GM as participant")
	_, err = gameService.AddGameParticipant(context.Background(), game3.ID, int32(player.ID), "player")
	core.AssertNoError(t, err, "Failed to add player as participant")

	t.Run("returns all games for GM", func(t *testing.T) {
		games, err := gameService.GetGamesByUser(context.Background(), int32(gm.ID))

		core.AssertNoError(t, err, "Failed to get games by user")
		core.AssertTrue(t, len(games) >= 3, "GM should have at least 3 games")

		// Verify our created games are in the list
		gameIDs := make(map[int32]bool)
		for _, g := range games {
			gameIDs[g.ID] = true
		}
		core.AssertTrue(t, gameIDs[game1.ID], "Game1 should be in GM's games")
		core.AssertTrue(t, gameIDs[game2.ID], "Game2 should be in GM's games")
		core.AssertTrue(t, gameIDs[game3.ID], "Game3 should be in GM's games")
	})

	t.Run("returns games where user is participant", func(t *testing.T) {
		games, err := gameService.GetGamesByUser(context.Background(), int32(player.ID))

		core.AssertNoError(t, err, "Failed to get games by user")
		core.AssertTrue(t, len(games) >= 1, "Player should have at least 1 game")

		// Verify player's game is in the list
		foundPlayerGame := false
		for _, g := range games {
			if g.ID == game3.ID {
				foundPlayerGame = true
				break
			}
		}
		core.AssertTrue(t, foundPlayerGame, "Player's game should be in the list")
	})

	t.Run("returns empty list for user with no games", func(t *testing.T) {
		noGameUser := testDB.CreateTestUser(t, "nogames", "nogames@example.com")
		games, err := gameService.GetGamesByUser(context.Background(), int32(noGameUser.ID))

		core.AssertNoError(t, err, "Failed to get games by user")
		core.AssertEqual(t, 0, len(games), "User with no games should have empty list")
	})

	// Verify game1 and game2 are in GM's games
	_ = game1
	_ = game2
}

func TestGameService_GetAllGames(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	gameService := &GameService{DB: testDB.Pool}

	// Create test users
	gm1 := testDB.CreateTestUser(t, "gm1", "gm1@example.com")
	gm2 := testDB.CreateTestUser(t, "gm2", "gm2@example.com")

	// Create several games
	game1 := testDB.CreateTestGame(t, int32(gm1.ID), "Public Game 1")
	game2 := testDB.CreateTestGame(t, int32(gm1.ID), "Public Game 2")
	game3 := testDB.CreateTestGame(t, int32(gm2.ID), "Public Game 3")

	t.Run("returns all games in the system", func(t *testing.T) {
		games, err := gameService.GetAllGames(context.Background())

		core.AssertNoError(t, err, "Failed to get all games")
		core.AssertTrue(t, len(games) >= 3, "Should have at least 3 games")

		// Verify our games are in the list
		gameIDs := make(map[int32]bool)
		for _, g := range games {
			gameIDs[g.ID] = true
		}

		core.AssertTrue(t, gameIDs[game1.ID], "Game 1 should be in the list")
		core.AssertTrue(t, gameIDs[game2.ID], "Game 2 should be in the list")
		core.AssertTrue(t, gameIDs[game3.ID], "Game 3 should be in the list")
	})
}

func TestGameService_GetRecruitingGames(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	gameService := &GameService{DB: testDB.Pool}

	// Create test user
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")

	// Create games in different states
	setupGame := testDB.CreateTestGame(t, int32(gm.ID), "Setup Game")
	recruitingGame := testDB.CreateTestGame(t, int32(gm.ID), "Recruiting Game")
	inProgressGame := testDB.CreateTestGame(t, int32(gm.ID), "In Progress Game")

	// Update states
	_, err := gameService.UpdateGameState(context.Background(), recruitingGame.ID, "recruitment")
	core.AssertNoError(t, err, "Failed to set game to recruitment")

	_, err = gameService.UpdateGameState(context.Background(), inProgressGame.ID, "recruitment")
	core.AssertNoError(t, err, "Failed to set game to recruitment")
	_, err = gameService.UpdateGameState(context.Background(), inProgressGame.ID, "in_progress")
	core.AssertNoError(t, err, "Failed to set game to in_progress")

	t.Run("returns only games in recruitment state", func(t *testing.T) {
		games, err := gameService.GetRecruitingGames(context.Background())

		core.AssertNoError(t, err, "Failed to get recruiting games")

		// Verify recruiting game is in the list
		foundRecruiting := false
		foundSetup := false
		foundInProgress := false

		for _, g := range games {
			if g.ID == recruitingGame.ID {
				foundRecruiting = true
			}
			if g.ID == setupGame.ID {
				foundSetup = true
			}
			if g.ID == inProgressGame.ID {
				foundInProgress = true
			}
		}

		core.AssertTrue(t, foundRecruiting, "Recruiting game should be in the list")
		core.AssertEqual(t, false, foundSetup, "Setup game should NOT be in the list")
		core.AssertEqual(t, false, foundInProgress, "In-progress game should NOT be in the list")
	})
}

func TestGameService_GetGameWithDetails(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "sessions", "users")

	gameService := &GameService{DB: testDB.Pool}

	// Create users
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	// Create game
	game := testDB.CreateTestGame(t, int32(gm.ID), "Detailed Game")

	// Add participants
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	core.AssertNoError(t, err, "Failed to add player1")
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	core.AssertNoError(t, err, "Failed to add player2")

	t.Run("returns game with GM username and participant count", func(t *testing.T) {
		details, err := gameService.GetGameWithDetails(context.Background(), game.ID)

		core.AssertNoError(t, err, "Failed to get game with details")
		core.AssertEqual(t, game.ID, details.ID, "Game ID should match")
		core.AssertEqual(t, gm.Username, details.GmUsername.String, "GM username should match")
		core.AssertEqual(t, int64(2), details.CurrentPlayers, "Should have 2 participants")
	})

	t.Run("returns error for non-existent game", func(t *testing.T) {
		_, err := gameService.GetGameWithDetails(context.Background(), 99999)

		core.AssertError(t, err, "Should return error for non-existent game")
	})
}

func TestGameService_CanUserJoinGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "sessions", "users")

	gameService := &GameService{DB: testDB.Pool}

	// Create users
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")

	// Create game in recruitment state
	game := testDB.CreateTestGame(t, int32(gm.ID), "Join Test Game")
	_, err := gameService.UpdateGameState(context.Background(), game.ID, "recruitment")
	core.AssertNoError(t, err, "Failed to set game to recruitment")

	t.Run("allows user to join game in recruitment", func(t *testing.T) {
		result, err := gameService.CanUserJoinGame(context.Background(), game.ID, int32(player.ID))

		core.AssertNoError(t, err, "Failed to check if user can join")
		core.AssertEqual(t, "can_join", result, "User should be able to join recruiting game")
	})

	t.Run("prevents user from joining game they're already in", func(t *testing.T) {
		// Add player to game
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
		core.AssertNoError(t, err, "Failed to add player")

		result, err := gameService.CanUserJoinGame(context.Background(), game.ID, int32(player.ID))

		core.AssertNoError(t, err, "Failed to check if user can join")
		core.AssertEqual(t, "already_joined", result, "User should not be able to join game they're in")
	})
}

func TestGameService_RemoveGameParticipant(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "sessions", "users")

	gameService := &GameService{DB: testDB.Pool}

	// Create users
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")

	// Create game
	game := testDB.CreateTestGame(t, int32(gm.ID), "Remove Test Game")

	// Add participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	core.AssertNoError(t, err, "Failed to add participant")

	t.Run("removes participant from game", func(t *testing.T) {
		// Verify player is in game
		inGame, err := gameService.IsUserInGame(context.Background(), game.ID, int32(player.ID))
		core.AssertNoError(t, err, "Failed to check if user is in game")
		core.AssertTrue(t, inGame, "Player should be in game before removal")

		// Remove participant
		err = gameService.RemoveGameParticipant(context.Background(), game.ID, int32(player.ID))
		core.AssertNoError(t, err, "Failed to remove participant")

		// Verify player is no longer in game
		inGame, err = gameService.IsUserInGame(context.Background(), game.ID, int32(player.ID))
		core.AssertNoError(t, err, "Failed to check if user is in game")
		core.AssertEqual(t, false, inGame, "Player should not be in game after removal")
	})

	t.Run("handles removing non-existent participant gracefully", func(t *testing.T) {
		// Try to remove player again (already removed)
		err := gameService.RemoveGameParticipant(context.Background(), game.ID, int32(player.ID))

		// Should not error (idempotent operation)
		core.AssertNoError(t, err, "Removing non-existent participant should not error")
	})
}

// Helper function for time pointers
func timePtr(t time.Time) *time.Time {
	return &t
}
