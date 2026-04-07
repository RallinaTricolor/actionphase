package db

import (
	"context"
	"testing"
	"time"

	"actionphase/pkg/core"
)

// =============================================================================
// DEADLINE CRUD TESTS
// =============================================================================

func TestDeadlineService_CreateDeadline(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("deadlines").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("deadline_test_gm_create").WithEmail("deadline_gm_create@test.com").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	deadlineService := suite.DeadlineService()

	futureTime := time.Now().Add(48 * time.Hour)

	testCases := []struct {
		name        string
		gameID      int32
		title       string
		description string
		deadline    time.Time
		createdBy   int32
		expectError bool
	}{
		{
			name:        "create deadline with description",
			gameID:      game.ID,
			title:       "Action Submission Deadline",
			description: "Submit all actions by this time",
			deadline:    futureTime,
			createdBy:   gm.ID,
			expectError: false,
		},
		{
			name:        "create deadline without description",
			gameID:      game.ID,
			title:       "Character Creation Deadline",
			description: "",
			deadline:    futureTime,
			createdBy:   gm.ID,
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := core.CreateDeadlineRequest{
				GameID:      tc.gameID,
				Title:       tc.title,
				Description: tc.description,
				Deadline:    tc.deadline,
				CreatedBy:   tc.createdBy,
			}

			deadline, err := deadlineService.CreateDeadline(context.Background(), req)

			if tc.expectError {
				core.AssertError(t, err, "Expected error for invalid deadline creation")
				return
			}

			core.AssertNoError(t, err, "Failed to create deadline")
			core.AssertEqual(t, tc.title, deadline.Title, "Title mismatch")
			core.AssertEqual(t, tc.gameID, deadline.GameID, "Game ID mismatch")
			core.AssertEqual(t, tc.createdBy, deadline.CreatedByUserID, "Created by user ID mismatch")

			// Verify deadline is set correctly (allow 1 second difference)
			if deadline.Deadline.Valid {
				diff := deadline.Deadline.Time.Sub(tc.deadline).Abs()
				if diff > time.Second {
					t.Errorf("Deadline time mismatch: expected %v, got %v (diff: %v)", tc.deadline, deadline.Deadline.Time, diff)
				}
			}
		})
	}
}

func TestDeadlineService_GetDeadline(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("deadlines").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("deadline_test_gm_get").WithEmail("deadline_gm_get@test.com").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	deadlineService := suite.DeadlineService()

	// Create a deadline
	futureTime := time.Now().Add(24 * time.Hour)
	req := core.CreateDeadlineRequest{
		GameID:      game.ID,
		Title:       "Test Deadline",
		Description: "Test Description",
		Deadline:    futureTime,
		CreatedBy:   gm.ID,
	}
	created, err := deadlineService.CreateDeadline(context.Background(), req)
	core.AssertNoError(t, err, "Failed to create deadline for test")

	testCases := []struct {
		name        string
		deadlineID  int32
		expectError bool
	}{
		{
			name:        "get existing deadline",
			deadlineID:  created.ID,
			expectError: false,
		},
		{
			name:        "get non-existent deadline",
			deadlineID:  99999,
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			deadline, err := deadlineService.GetDeadline(context.Background(), tc.deadlineID)

			if tc.expectError {
				core.AssertError(t, err, "Expected error for non-existent deadline")
				return
			}

			core.AssertNoError(t, err, "Failed to get deadline")
			core.AssertEqual(t, tc.deadlineID, deadline.ID, "Deadline ID mismatch")
			core.AssertEqual(t, created.Title, deadline.Title, "Title mismatch")
		})
	}
}

func TestDeadlineService_GetGameDeadlines(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("deadlines").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("deadline_test_gm_list").WithEmail("deadline_gm_list@test.com").Create()
	game1 := suite.Factory().NewGame().WithGM(gm.ID).Create()
	game2 := suite.Factory().NewGame().WithGM(gm.ID).Create()
	deadlineService := suite.DeadlineService()

	// Create deadlines for game1
	futureTime := time.Now().Add(48 * time.Hour)
	pastTime := time.Now().Add(-48 * time.Hour)

	// Future deadline
	req1 := core.CreateDeadlineRequest{
		GameID:      game1.ID,
		Title:       "Future Deadline",
		Description: "This is in the future",
		Deadline:    futureTime,
		CreatedBy:   gm.ID,
	}
	_, err := deadlineService.CreateDeadline(context.Background(), req1)
	core.AssertNoError(t, err, "Failed to create future deadline")

	// Past deadline
	req2 := core.CreateDeadlineRequest{
		GameID:      game1.ID,
		Title:       "Past Deadline",
		Description: "This is in the past",
		Deadline:    pastTime,
		CreatedBy:   gm.ID,
	}
	_, err = deadlineService.CreateDeadline(context.Background(), req2)
	core.AssertNoError(t, err, "Failed to create past deadline")

	// Deadline for game2
	req3 := core.CreateDeadlineRequest{
		GameID:      game2.ID,
		Title:       "Game 2 Deadline",
		Description: "Different game",
		Deadline:    futureTime,
		CreatedBy:   gm.ID,
	}
	_, err = deadlineService.CreateDeadline(context.Background(), req3)
	core.AssertNoError(t, err, "Failed to create game2 deadline")

	testCases := []struct {
		name           string
		gameID         int32
		includeExpired bool
		expectedCount  int
	}{
		{
			name:           "get active deadlines only",
			gameID:         game1.ID,
			includeExpired: false,
			expectedCount:  1, // Only future deadline
		},
		{
			name:           "get all deadlines including expired",
			gameID:         game1.ID,
			includeExpired: true,
			expectedCount:  2, // Both future and past
		},
		{
			name:           "get deadlines for different game",
			gameID:         game2.ID,
			includeExpired: false,
			expectedCount:  1,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			deadlines, err := deadlineService.GetGameDeadlines(context.Background(), tc.gameID, tc.includeExpired)
			core.AssertNoError(t, err, "Failed to get game deadlines")
			core.AssertEqual(t, tc.expectedCount, len(deadlines), "Deadline count mismatch")

			// Verify the correct game's deadlines were returned
			if len(deadlines) > 0 {
				core.AssertEqual(t, tc.gameID, deadlines[0].GameID, "Returned deadline belongs to wrong game")
			}
		})
	}
}

func TestDeadlineService_UpdateDeadline(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("deadlines").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("deadline_test_gm_update").WithEmail("deadline_gm_update@test.com").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	deadlineService := suite.DeadlineService()

	// Create a deadline
	originalTime := time.Now().Add(24 * time.Hour)
	req := core.CreateDeadlineRequest{
		GameID:      game.ID,
		Title:       "Original Title",
		Description: "Original Description",
		Deadline:    originalTime,
		CreatedBy:   gm.ID,
	}
	created, err := deadlineService.CreateDeadline(context.Background(), req)
	core.AssertNoError(t, err, "Failed to create deadline for test")

	// Update the deadline
	newTime := time.Now().Add(72 * time.Hour)
	updateReq := core.UpdateDeadlineRequest{
		Title:       "Updated Title",
		Description: "Updated Description",
		Deadline:    newTime,
	}

	updated, err := deadlineService.UpdateDeadline(context.Background(), created.ID, updateReq)
	core.AssertNoError(t, err, "Failed to update deadline")

	core.AssertEqual(t, created.ID, updated.ID, "Deadline ID should not change")
	core.AssertEqual(t, "Updated Title", updated.Title, "Title not updated")

	// Verify description
	if updated.Description.Valid {
		core.AssertEqual(t, "Updated Description", updated.Description.String, "Description not updated")
	}

	// Test updating non-existent deadline
	_, err = deadlineService.UpdateDeadline(context.Background(), 99999, updateReq)
	core.AssertError(t, err, "Expected error when updating non-existent deadline")
}

func TestDeadlineService_DeleteDeadline(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("deadlines").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("deadline_test_gm_delete").WithEmail("deadline_gm_delete@test.com").Create()
	player := suite.Factory().NewUser().WithUsername("deadline_test_player_delete").WithEmail("deadline_player_delete@test.com").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	deadlineService := suite.DeadlineService()

	// Create a deadline
	futureTime := time.Now().Add(24 * time.Hour)
	req := core.CreateDeadlineRequest{
		GameID:      game.ID,
		Title:       "Test Deadline",
		Description: "To be deleted",
		Deadline:    futureTime,
		CreatedBy:   gm.ID,
	}
	created, err := deadlineService.CreateDeadline(context.Background(), req)
	core.AssertNoError(t, err, "Failed to create deadline for test")

	testCases := []struct {
		name        string
		deadlineID  int32
		userID      int32
		expectError bool
		errorMsg    string
	}{
		{
			name:        "GM can delete deadline",
			deadlineID:  created.ID,
			userID:      gm.ID,
			expectError: false,
		},
		{
			name:        "non-GM cannot delete deadline",
			deadlineID:  created.ID,
			userID:      player.ID,
			expectError: true,
			errorMsg:    "unauthorized",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := deadlineService.DeleteDeadline(context.Background(), tc.deadlineID, tc.userID)

			if tc.expectError {
				core.AssertError(t, err, "Expected error for unauthorized deletion")
				return
			}

			core.AssertNoError(t, err, "Failed to delete deadline")

			// Verify deadline is soft-deleted (GetDeadline should fail)
			_, err = deadlineService.GetDeadline(context.Background(), tc.deadlineID)
			core.AssertError(t, err, "Deadline should not be retrievable after deletion")
		})
	}

	// Test deleting non-existent deadline
	err = deadlineService.DeleteDeadline(context.Background(), 99999, gm.ID)
	core.AssertError(t, err, "Expected error when deleting non-existent deadline")
}

func TestDeadlineService_GetAllGameDeadlines_InactivePhaseExcluded(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("deadlines").
		Setup()
	defer suite.Cleanup()

	gm := suite.Factory().NewUser().WithUsername("deadline_phase_gm").WithEmail("deadline_phase_gm@test.com").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	deadlineService := suite.DeadlineService()

	futureDeadline := time.Now().Add(48 * time.Hour)

	// Create an inactive phase with a future deadline
	suite.Factory().NewPhase().InGame(game).WithDeadlineIn(48 * time.Hour).Create()

	// Create an active phase with a future deadline
	suite.Factory().NewPhase().InGame(game).WithDeadlineIn(48 * time.Hour).Active().Create()

	// Create an arbitrary deadline for baseline
	_, err := deadlineService.CreateDeadline(context.Background(), core.CreateDeadlineRequest{
		GameID:    game.ID,
		Title:     "Custom Deadline",
		Deadline:  futureDeadline,
		CreatedBy: gm.ID,
	})
	core.AssertNoError(t, err, "Failed to create custom deadline")

	unified, err := deadlineService.GetAllGameDeadlines(context.Background(), game.ID, false)
	core.AssertNoError(t, err, "Failed to get all game deadlines")

	// Should have: 1 custom deadline + 1 active phase = 2 total
	// The inactive phase must NOT appear
	core.AssertEqual(t, 2, len(unified), "Expected 2 deadlines (custom + active phase only)")

	for _, d := range unified {
		if d.DeadlineType == "phase" && d.PhaseID != nil {
			// Verify only the active phase is present — we can't easily check is_active here
			// but verifying count=2 (not 3) proves the inactive phase is excluded
		}
	}
}

func TestDeadlineService_GetUpcomingDeadlines(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("deadlines").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("deadline_test_gm_upcoming").WithEmail("deadline_gm_upcoming@test.com").Create()
	player := suite.Factory().NewUser().WithUsername("deadline_test_player_upcoming").WithEmail("deadline_player_upcoming@test.com").Create()

	// Create games
	game1 := suite.Factory().NewGame().WithGM(gm.ID).WithTitle("GM Game").Create()
	game2 := suite.Factory().NewGame().WithGM(gm.ID).WithTitle("Player Game").Create()

	// Add player to game2
	gameService := suite.GameService()
	_, err := gameService.AddGameParticipant(context.Background(), game2.ID, player.ID, "player")
	core.AssertNoError(t, err, "Failed to add participant")

	deadlineService := suite.DeadlineService()

	// Create deadlines
	futureTime1 := time.Now().Add(24 * time.Hour)
	futureTime2 := time.Now().Add(48 * time.Hour)
	futureTime3 := time.Now().Add(72 * time.Hour)

	// Deadline for game1 (GM game)
	req1 := core.CreateDeadlineRequest{
		GameID:      game1.ID,
		Title:       "GM Game Deadline 1",
		Description: "First deadline",
		Deadline:    futureTime1,
		CreatedBy:   gm.ID,
	}
	_, err = deadlineService.CreateDeadline(context.Background(), req1)
	core.AssertNoError(t, err, "Failed to create deadline 1")

	// Another deadline for game1
	req2 := core.CreateDeadlineRequest{
		GameID:      game1.ID,
		Title:       "GM Game Deadline 2",
		Description: "Second deadline",
		Deadline:    futureTime2,
		CreatedBy:   gm.ID,
	}
	_, err = deadlineService.CreateDeadline(context.Background(), req2)
	core.AssertNoError(t, err, "Failed to create deadline 2")

	// Deadline for game2 (player game)
	req3 := core.CreateDeadlineRequest{
		GameID:      game2.ID,
		Title:       "Player Game Deadline",
		Description: "Player can see this",
		Deadline:    futureTime3,
		CreatedBy:   gm.ID,
	}
	_, err = deadlineService.CreateDeadline(context.Background(), req3)
	core.AssertNoError(t, err, "Failed to create deadline 3")

	testCases := []struct {
		name          string
		userID        int32
		limit         int32
		expectedCount int
		checkTitle    string
	}{
		{
			name:          "GM sees all deadlines from their games",
			userID:        gm.ID,
			limit:         10,
			expectedCount: 3, // All 3 deadlines
		},
		{
			name:          "Player sees only their game deadlines",
			userID:        player.ID,
			limit:         10,
			expectedCount: 1, // Only game2 deadline
			checkTitle:    "Player Game Deadline",
		},
		{
			name:          "Limit results to 2",
			userID:        gm.ID,
			limit:         2,
			expectedCount: 2, // Limited to 2
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			deadlines, err := deadlineService.GetUpcomingDeadlines(context.Background(), tc.userID, tc.limit)
			core.AssertNoError(t, err, "Failed to get upcoming deadlines")
			core.AssertEqual(t, tc.expectedCount, len(deadlines), "Deadline count mismatch")

			if tc.checkTitle != "" && len(deadlines) > 0 {
				core.AssertEqual(t, tc.checkTitle, deadlines[0].Title, "Deadline title mismatch")
			}

			// Verify each deadline has game context
			for _, d := range deadlines {
				if d.GameTitle == "" {
					t.Error("Expected GameTitle to be populated")
				}
			}
		})
	}
}
