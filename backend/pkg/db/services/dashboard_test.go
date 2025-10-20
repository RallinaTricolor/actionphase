package db

import (
	"context"
	"testing"
	"time"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	"github.com/jackc/pgx/v5/pgtype"
)

func TestDashboardService_GetUserDashboard_NoGames(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "users")

	factory := core.NewTestDataFactory(testDB, t)
	service := &DashboardService{DB: testDB.Pool}

	// Create a user with no games
	user := factory.NewUser().Create()

	// Get dashboard
	dashboard, err := service.GetUserDashboard(context.Background(), user.ID)
	core.AssertNoError(t, err, "Failed to get dashboard")

	// Verify user has no games
	core.AssertEqual(t, false, dashboard.HasGames, "User should have no games")
	core.AssertEqual(t, 0, len(dashboard.PlayerGames), "Should have 0 player games")
	core.AssertEqual(t, 0, len(dashboard.GMGames), "Should have 0 GM games")
	core.AssertEqual(t, 0, len(dashboard.MixedRoleGames), "Should have 0 mixed role games")
	core.AssertEqual(t, 0, len(dashboard.RecentMessages), "Should have 0 recent messages")
	core.AssertEqual(t, 0, len(dashboard.UpcomingDeadlines), "Should have 0 deadlines")
}

func TestDashboardService_GetUserDashboard_AsPlayer(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_participants", "games", "users")

	factory := core.NewTestDataFactory(testDB, t)
	service := &DashboardService{DB: testDB.Pool}

	// Create users
	gm := factory.NewUser().WithUsername("gamemaster").Create()
	player := factory.NewUser().WithUsername("player").Create()

	// Create game as GM
	game := factory.NewGame().
		WithTitle("Player Test Game").
		WithGM(gm.ID).
		WithState("in_progress").
		Create()

	// Add player as participant
	factory.NewGameParticipant().
		ForGame(game.ID).
		WithUser(player.ID).
		WithRole("player").
		Create()

	// Get dashboard for player
	dashboard, err := service.GetUserDashboard(context.Background(), player.ID)
	core.AssertNoError(t, err, "Failed to get dashboard")

	// Verify dashboard data
	core.AssertEqual(t, true, dashboard.HasGames, "Player should have games")
	core.AssertEqual(t, 1, len(dashboard.PlayerGames), "Should have 1 player game")
	core.AssertEqual(t, 0, len(dashboard.GMGames), "Should have 0 GM games")

	// Verify game details
	playerGame := dashboard.PlayerGames[0]
	core.AssertEqual(t, game.ID, playerGame.GameID, "Game ID should match")
	core.AssertEqual(t, "Player Test Game", playerGame.Title, "Game title should match")
	core.AssertEqual(t, "player", playerGame.UserRole, "User role should be player")
}

func TestDashboardService_GetUserDashboard_AsGM(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_applications", "game_participants", "games", "users")

	factory := core.NewTestDataFactory(testDB, t)
	service := &DashboardService{DB: testDB.Pool}

	// Create GM user
	gm := factory.NewUser().WithUsername("gamemaster").Create()

	// Create game as GM
	game := factory.NewGame().
		WithTitle("GM Test Game").
		WithGM(gm.ID).
		WithState("recruitment").
		Create()

	// Add GM as game participant with "co_gm" role (GMs need participant record for dashboard queries)
	factory.NewGameParticipant().
		ForGame(game.ID).
		WithUser(gm.ID).
		WithRole("co_gm").
		Create()

	// Create pending application
	applicant := factory.NewUser().WithUsername("applicant").Create()
	q := db.New(testDB.Pool)
	_, err := q.CreateGameApplication(context.Background(), db.CreateGameApplicationParams{
		GameID:  game.ID,
		UserID:  applicant.ID,
		Role:    "player",
		Message: pgtype.Text{String: "I'd like to join!", Valid: true},
	})
	core.AssertNoError(t, err, "Failed to create game application")

	// Get dashboard for GM
	dashboard, err := service.GetUserDashboard(context.Background(), gm.ID)
	core.AssertNoError(t, err, "Failed to get dashboard")

	// Verify dashboard data
	core.AssertEqual(t, true, dashboard.HasGames, "GM should have games")
	core.AssertEqual(t, 0, len(dashboard.PlayerGames), "Should have 0 player games")
	core.AssertEqual(t, 1, len(dashboard.GMGames), "Should have 1 GM game")

	// Verify GM game details
	gmGame := dashboard.GMGames[0]
	core.AssertEqual(t, game.ID, gmGame.GameID, "Game ID should match")
	core.AssertEqual(t, "gm", gmGame.UserRole, "User role should be GM")
	core.AssertEqual(t, 1, gmGame.PendingApplications, "Should have 1 pending application")
}

func TestDashboardService_GetUserDashboard_UrgentGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "action_submissions", "game_phases", "game_participants", "games", "users")

	factory := core.NewTestDataFactory(testDB, t)
	service := &DashboardService{DB: testDB.Pool}

	// Create users
	gm := factory.NewUser().WithUsername("gamemaster").Create()
	player := factory.NewUser().WithUsername("player").Create()

	// Create game
	game := factory.NewGame().
		WithGM(gm.ID).
		WithState("in_progress").
		Create()

	// Add player as participant
	factory.NewGameParticipant().
		ForGame(game.ID).
		WithUser(player.ID).
		WithRole("player").
		Create()

	// Create action phase with near deadline (5 hours from now)
	deadlineNear := time.Now().Add(5 * time.Hour)
	phase := factory.NewPhase().
		InGame(game).
		ActionPhase().
		Active().
		WithDeadline(deadlineNear).
		Create()

	// Player has not submitted action yet (creates draft)
	factory.NewActionSubmission().
		InGame(game).
		ByUser(player).
		InPhase(phase).
		Draft().
		Create()

	// Get dashboard
	dashboard, err := service.GetUserDashboard(context.Background(), player.ID)
	core.AssertNoError(t, err, "Failed to get dashboard")

	// Verify urgent game
	core.AssertEqual(t, 1, len(dashboard.PlayerGames), "Should have 1 player game")
	urgentGame := dashboard.PlayerGames[0]

	core.AssertEqual(t, true, urgentGame.IsUrgent, "Game should be urgent (<24h with pending action)")
	core.AssertEqual(t, "critical", urgentGame.DeadlineStatus, "Deadline status should be critical (<6h)")
	core.AssertEqual(t, true, urgentGame.HasPendingAction, "Should have pending action")
	core.AssertTrue(t, urgentGame.CurrentPhaseDeadline != nil, "Should have deadline")
}

func TestDashboardService_GetUserDashboard_WarningDeadline(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "action_submissions", "game_phases", "game_participants", "games", "users")

	factory := core.NewTestDataFactory(testDB, t)
	service := &DashboardService{DB: testDB.Pool}

	// Create users
	gm := factory.NewUser().Create()
	player := factory.NewUser().Create()

	// Create game
	game := factory.NewGame().WithGM(gm.ID).WithState("in_progress").Create()
	factory.NewGameParticipant().
		ForGame(game.ID).
		WithUser(player.ID).
		WithRole("player").
		Create()

	// Create phase with warning deadline (10 hours from now)
	deadlineWarning := time.Now().Add(10 * time.Hour)
	phase := factory.NewPhase().
		InGame(game).
		ActionPhase().
		Active().
		WithDeadline(deadlineWarning).
		Create()

	// Player has pending action
	factory.NewActionSubmission().
		InGame(game).
		ByUser(player).
		InPhase(phase).
		Draft().
		Create()

	// Get dashboard
	dashboard, err := service.GetUserDashboard(context.Background(), player.ID)
	core.AssertNoError(t, err, "Failed to get dashboard")

	// Verify warning status
	game1 := dashboard.PlayerGames[0]
	core.AssertEqual(t, "warning", game1.DeadlineStatus, "Deadline status should be warning (6-24h)")
	core.AssertEqual(t, true, game1.IsUrgent, "Game should be urgent (pending action <24h)")
}

func TestDashboardService_GetUserDashboard_NormalDeadline(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "game_phases", "game_participants", "games", "users")

	factory := core.NewTestDataFactory(testDB, t)
	service := &DashboardService{DB: testDB.Pool}

	// Create users
	gm := factory.NewUser().Create()
	player := factory.NewUser().Create()

	// Create game
	game := factory.NewGame().WithGM(gm.ID).WithState("in_progress").Create()
	factory.NewGameParticipant().
		ForGame(game.ID).
		WithUser(player.ID).
		WithRole("player").
		Create()

	// Create phase with normal deadline (3 days from now)
	deadlineNormal := time.Now().Add(72 * time.Hour)
	factory.NewPhase().
		InGame(game).
		ActionPhase().
		Active().
		WithDeadline(deadlineNormal).
		Create()

	// Get dashboard (no action submission, so no pending action)
	dashboard, err := service.GetUserDashboard(context.Background(), player.ID)
	core.AssertNoError(t, err, "Failed to get dashboard")

	// Verify normal status
	game1 := dashboard.PlayerGames[0]
	core.AssertEqual(t, "normal", game1.DeadlineStatus, "Deadline status should be normal (>24h)")
	core.AssertEqual(t, false, game1.IsUrgent, "Game should not be urgent (no pending action)")
}

func TestDashboardService_GetUserDashboard_RecentMessages(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "messages", "characters", "game_phases", "game_participants", "games", "users")

	factory := core.NewTestDataFactory(testDB, t)
	service := &DashboardService{DB: testDB.Pool}

	// Create users
	gm := factory.NewUser().Create()
	player := factory.NewUser().Create()
	otherPlayer := factory.NewUser().Create()

	// Create game
	game := factory.NewGame().WithGM(gm.ID).WithState("in_progress").Create()
	factory.NewGameParticipant().
		ForGame(game.ID).
		WithUser(player.ID).
		WithRole("player").
		Create()
	factory.NewGameParticipant().
		ForGame(game.ID).
		WithUser(otherPlayer.ID).
		WithRole("player").
		Create()

	// Create phase for messages
	phase := factory.NewPhase().InGame(game).CommonRoom().Active().Create()

	// Create character for the other player
	character := factory.NewCharacter().
		InGame(game).
		OwnedBy(otherPlayer).
		WithName("Test Character").
		Create()

	// Other player creates a message
	message := factory.NewPost().
		InGame(game).
		InPhase(phase).
		ByAuthor(otherPlayer).
		ByCharacter(character).
		WithContent("This is a test message that should appear on the dashboard").
		Create()

	// Get dashboard for player
	dashboard, err := service.GetUserDashboard(context.Background(), player.ID)
	core.AssertNoError(t, err, "Failed to get dashboard")

	// Verify recent messages
	core.AssertTrue(t, len(dashboard.RecentMessages) > 0, "Should have recent messages")

	recentMsg := dashboard.RecentMessages[0]
	core.AssertEqual(t, message.ID, recentMsg.MessageID, "Message ID should match")
	core.AssertEqual(t, game.ID, recentMsg.GameID, "Game ID should match")
	core.AssertNotEqual(t, "", recentMsg.Content, "Message content should not be empty")
	core.AssertTrue(t, len(recentMsg.Content) <= 103, "Content should be truncated (100 chars + '...')")
}

func TestDashboardService_GetUserDashboard_UpcomingDeadlines(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "action_submissions", "game_phases", "game_participants", "games", "users")

	factory := core.NewTestDataFactory(testDB, t)
	service := &DashboardService{DB: testDB.Pool}

	// Create users
	gm := factory.NewUser().Create()
	player := factory.NewUser().Create()

	// Create game
	game := factory.NewGame().WithGM(gm.ID).WithState("in_progress").Create()
	factory.NewGameParticipant().
		ForGame(game.ID).
		WithUser(player.ID).
		WithRole("player").
		Create()

	// Create game 2 for second deadline (only one active phase per game)
	game2 := factory.NewGame().WithGM(gm.ID).WithState("in_progress").Create()
	factory.NewGameParticipant().
		ForGame(game2.ID).
		WithUser(player.ID).
		WithRole("player").
		Create()

	// Create multiple phases with different deadlines across different games
	deadline1 := time.Now().Add(2 * time.Hour)
	deadline2 := time.Now().Add(5 * time.Hour)
	deadline3 := time.Now().Add(24 * time.Hour)

	phase1 := factory.NewPhase().InGame(game).ActionPhase().Active().WithDeadline(deadline1).Create()
	factory.NewPhase().InGame(game).ActionPhase().WithDeadline(deadline2).Create() // Not active
	factory.NewPhase().InGame(game2).ActionPhase().Active().WithDeadline(deadline3).Create()

	// Create action submission for phase1
	factory.NewActionSubmission().
		InGame(game).
		ByUser(player).
		InPhase(phase1).
		Draft().
		Create()

	// Get dashboard
	dashboard, err := service.GetUserDashboard(context.Background(), player.ID)
	core.AssertNoError(t, err, "Failed to get dashboard")

	// Verify upcoming deadlines (only active phases should appear)
	core.AssertTrue(t, len(dashboard.UpcomingDeadlines) >= 2, "Should have at least 2 upcoming deadlines from active phases")

	// First deadline should be soonest
	firstDeadline := dashboard.UpcomingDeadlines[0]
	core.AssertEqual(t, phase1.ID, firstDeadline.PhaseID, "First deadline should be from phase1")
	core.AssertEqual(t, true, firstDeadline.HasPendingSubmission, "Should have pending submission")
	core.AssertTrue(t, firstDeadline.HoursRemaining < 3, "Should be less than 3 hours remaining")
}

func TestDashboardService_GetUserDashboard_SortingOrder(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "action_submissions", "game_phases", "game_participants", "games", "users")

	factory := core.NewTestDataFactory(testDB, t)
	service := &DashboardService{DB: testDB.Pool}

	// Create users
	gm := factory.NewUser().Create()
	player := factory.NewUser().Create()

	// Create 3 games with different urgency levels
	game1 := factory.NewGame().WithTitle("Normal Game").WithGM(gm.ID).WithState("in_progress").Create()
	game2 := factory.NewGame().WithTitle("Urgent Game").WithGM(gm.ID).WithState("in_progress").Create()
	game3 := factory.NewGame().WithTitle("No Deadline Game").WithGM(gm.ID).WithState("in_progress").Create()

	factory.NewGameParticipant().ForGame(game1.ID).WithUser(player.ID).WithRole("player").Create()
	factory.NewGameParticipant().ForGame(game2.ID).WithUser(player.ID).WithRole("player").Create()
	factory.NewGameParticipant().ForGame(game3.ID).WithUser(player.ID).WithRole("player").Create()

	// Game 1: Normal deadline (48 hours)
	factory.NewPhase().InGame(game1).ActionPhase().Active().
		WithDeadline(time.Now().Add(48 * time.Hour)).Create()

	// Game 2: Urgent deadline (3 hours) with pending action
	phase2 := factory.NewPhase().InGame(game2).ActionPhase().Active().
		WithDeadline(time.Now().Add(3 * time.Hour)).Create()
	factory.NewActionSubmission().
		InGame(game2).
		ByUser(player).
		InPhase(phase2).
		Draft().
		Create()

	// Game 3: No active phase/deadline

	// Get dashboard
	dashboard, err := service.GetUserDashboard(context.Background(), player.ID)
	core.AssertNoError(t, err, "Failed to get dashboard")

	// Verify sorting: Urgent game should be first
	core.AssertEqual(t, 3, len(dashboard.PlayerGames), "Should have 3 player games")
	core.AssertEqual(t, "Urgent Game", dashboard.PlayerGames[0].Title, "Urgent game should be first")
	core.AssertEqual(t, true, dashboard.PlayerGames[0].IsUrgent, "First game should be urgent")
}
