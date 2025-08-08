package core

import (
	"testing"
	"time"
)

// TestDataFactories demonstrates how to use the test data factories for clean, readable tests
func TestDataFactories_BasicUsage(t *testing.T) {
	// Note: Removing t.Parallel() to avoid database conflicts during cleanup

	t.Run("create_simple_user", func(t *testing.T) {

		// Each subtest gets its own independent setup
		testDB := NewTestDatabase(t)
		defer testDB.Close()
		defer testDB.CleanupTables(t)

		factory := NewTestDataFactory(testDB, t)

		// Simple user creation with defaults
		user := factory.NewUser().Create()

		AssertNotEqual(t, 0, user.ID, "User should have valid ID")
		AssertNotEqual(t, "", user.Username, "User should have username")
		AssertNotEqual(t, "", user.Email, "User should have email")
	})

	t.Run("create_custom_user", func(t *testing.T) {

		// Each subtest gets its own independent setup
		testDB := NewTestDatabase(t)
		defer testDB.Close()
		defer testDB.CleanupTables(t)

		factory := NewTestDataFactory(testDB, t)

		// Custom user creation with fluent builder
		user := factory.NewUser().
			WithUsername("customuser").
			WithEmail("custom@example.com").
			WithPassword("custompassword").
			AsAdmin().
			Create()

		AssertEqual(t, "customuser", user.Username, "Should have custom username")
		AssertEqual(t, "custom@example.com", user.Email, "Should have custom email")
	})

	t.Run("create_game_with_participants", func(t *testing.T) {

		// Each subtest gets its own independent setup
		testDB := NewTestDatabase(t)
		defer testDB.Close()
		defer testDB.CleanupTables(t)

		factory := NewTestDataFactory(testDB, t)

		// Create a complex game scenario
		game, users, participants := factory.CreateGameWithParticipants(3)

		AssertNotEqual(t, 0, game.ID, "Game should have valid ID")
		AssertEqual(t, 3, len(users), "Should have 3 participant users")
		AssertEqual(t, 3, len(participants), "Should have 3 participants")

		// Verify all participants are linked to the game
		for _, participant := range participants {
			AssertEqual(t, game.ID, participant.GameID, "Participant should be linked to game")
			AssertEqual(t, "player", participant.Role, "Participant should be a player")
		}
	})

	t.Run("create_authenticated_user", func(t *testing.T) {

		// Each subtest gets its own independent setup
		testDB := NewTestDatabase(t)
		defer testDB.Close()
		defer testDB.CleanupTables(t)

		factory := NewTestDataFactory(testDB, t)

		// Create user with authentication session
		user, session := factory.CreateAuthenticatedUser()

		AssertNotEqual(t, 0, user.ID, "User should have valid ID")
		AssertEqual(t, user.ID, session.UserID, "Session should belong to user")
		AssertNotEqual(t, "", session.Data, "Session should have token")
	})
}

func TestDataFactories_ComplexScenarios(t *testing.T) {
	testDB := NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t)

	factory := NewTestDataFactory(testDB, t)

	t.Run("game_recruitment_scenario", func(t *testing.T) {
		// Create a recruiting game scenario
		gm := factory.NewUser().WithUsername("gamemaster").Create()

		recruitmentDeadline := time.Now().Add(7 * 24 * time.Hour) // 7 days from now

		game := factory.NewGame().
			WithTitle("Epic Adventure").
			WithDescription("Join us for an epic fantasy adventure!").
			WithGM(gm.ID).
			WithGenre("Fantasy").
			WithState("recruitment").
			WithMaxPlayers(6).
			WithRecruitmentDeadline(recruitmentDeadline).
			Create()

		AssertEqual(t, "Epic Adventure", game.Title, "Should have custom title")
		AssertEqual(t, "recruitment", game.State.String, "Should be in recruitment state")
		AssertEqual(t, gm.ID, game.GmUserID, "Should have correct GM")

		// Add some interested players
		for i := 1; i <= 3; i++ {
			player := factory.NewUser().Create()
			participant := factory.NewGameParticipant().
				ForGame(game.ID).
				WithUser(player.ID).
				AsPlayer().
				Create()

			AssertEqual(t, game.ID, participant.GameID, "Participant should be in correct game")
			AssertEqual(t, "player", participant.Role, "Should be a player")
		}
	})

	t.Run("session_expiry_scenario", func(t *testing.T) {
		// Test session expiry scenarios
		user := factory.NewUser().Create()

		// Active session
		activeSession := factory.NewSession().
			WithUserID(user.ID).
			WithData("active_token").
			ExpiringIn(24 * time.Hour).
			Create()

		// Expired session
		expiredSession := factory.NewSession().
			WithUserID(user.ID).
			WithData("expired_token").
			ExpiringIn(-1 * time.Hour). // Expired 1 hour ago
			Create()

		AssertEqual(t, user.ID, activeSession.UserID, "Active session should belong to user")
		AssertEqual(t, user.ID, expiredSession.UserID, "Expired session should belong to user")
		AssertNotEqual(t, activeSession.Data, expiredSession.Data, "Sessions should have different tokens")
	})

	t.Run("private_game_scenario", func(t *testing.T) {
		// Create a private game with invitation-only access
		gm := factory.NewUser().WithUsername("privateGM").Create()

		game := factory.NewGame().
			WithTitle("Private Campaign").
			WithGM(gm.ID).
			AsPrivate().
			WithMaxPlayers(4).
			Create()

		AssertEqual(t, "Private Campaign", game.Title, "Should have private game title")
		AssertEqual(t, gm.ID, game.GmUserID, "Should have correct GM")

		// Only invited players can join
		invitedPlayer := factory.NewUser().WithUsername("invitedplayer").Create()
		participant := factory.NewGameParticipant().
			ForGame(game.ID).
			WithUser(invitedPlayer.ID).
			AsPlayer().
			Create()

		AssertEqual(t, "player", participant.Role, "Invited player should be a player")
	})
}

func TestDataFactories_Performance(t *testing.T) {
	testDB := NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t)

	factory := NewTestDataFactory(testDB, t)

	t.Run("batch_user_creation", func(t *testing.T) {
		// Create many users for performance testing
		users := factory.CreateUsersInBatch(100)

		AssertEqual(t, 100, len(users), "Should create 100 users")

		// Verify each user has unique data
		usernames := make(map[string]bool)
		for _, user := range users {
			AssertNotEqual(t, 0, user.ID, "Each user should have valid ID")
			AssertEqual(t, false, usernames[user.Username], "Username should be unique")
			usernames[user.Username] = true
		}
	})

	t.Run("batch_game_creation", func(t *testing.T) {
		// Create a GM user first
		gm := factory.NewUser().WithUsername("batchGM").Create()

		// Create many games
		games := factory.CreateGamesInBatch(50, gm.ID)

		AssertEqual(t, 50, len(games), "Should create 50 games")

		// Verify each game belongs to the GM
		for _, game := range games {
			AssertNotEqual(t, 0, game.ID, "Each game should have valid ID")
			AssertEqual(t, gm.ID, game.GmUserID, "Each game should belong to GM")
		}
	})
}

func TestDataFactories_EdgeCases(t *testing.T) {
	testDB := NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t)

	factory := NewTestDataFactory(testDB, t)

	t.Run("user_without_database_persistence", func(t *testing.T) {
		// Build user without creating in database
		user := factory.NewUser().
			WithUsername("buildonly").
			WithEmail("buildonly@test.com").
			Build() // Note: Build() not Create()

		AssertEqual(t, "buildonly", user.Username, "Built user should have correct username")
		AssertEqual(t, "buildonly@test.com", user.Email, "Built user should have correct email")
		// This user is not in the database, so it won't have an ID
	})

	t.Run("sequence_reset", func(t *testing.T) {
		// Reset sequence for predictable test data
		factory.ResetSequence()

		user1 := factory.NewUser().Create()
		user2 := factory.NewUser().Create()

		// After reset, should start from 1 again
		AssertEqual(t, "testuser1", user1.Username, "First user should have sequence 1")
		AssertEqual(t, "testuser2", user2.Username, "Second user should have sequence 2")
	})

	t.Run("game_with_all_optional_fields", func(t *testing.T) {
		gm := factory.NewUser().Create()
		startDate := time.Now().Add(7 * 24 * time.Hour)
		endDate := time.Now().Add(30 * 24 * time.Hour)
		recruitmentDeadline := time.Now().Add(3 * 24 * time.Hour)

		game := factory.NewGame().
			WithTitle("Comprehensive Game").
			WithDescription("A game with all fields set").
			WithGM(gm.ID).
			WithGenre("Sci-Fi").
			WithState("recruitment").
			WithMaxPlayers(8).
			AsPrivate().
			WithStartDate(startDate).
			WithEndDate(endDate).
			WithRecruitmentDeadline(recruitmentDeadline).
			Create()

		AssertEqual(t, "Comprehensive Game", game.Title, "Should have correct title")
		AssertEqual(t, "recruitment", game.State.String, "Should be in recruitment state")
	})
}
