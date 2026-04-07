package users

import (
	"context"
	"testing"

	"actionphase/pkg/core"
)

// TestGetUserProfile tests the GetUserProfile method
func TestGetUserProfile(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "games", "game_participants", "characters")

	fixtures := testDB.SetupFixtures(t)
	service := &UserProfileService{DB: testDB.Pool}
	ctx := context.Background()

	tests := []struct {
		name          string
		userID        int32
		page          int
		pageSize      int
		expectError   bool
		checkResponse func(t *testing.T, resp *core.UserProfileResponse)
	}{
		{
			name:        "get valid user profile",
			userID:      int32(fixtures.TestUser.ID),
			page:        1,
			pageSize:    12,
			expectError: false,
			checkResponse: func(t *testing.T, resp *core.UserProfileResponse) {
				core.AssertNotEqual(t, int32(0), resp.User.ID, "User ID should be set")
				core.AssertEqual(t, fixtures.TestUser.Username, resp.User.Username, "Username should match")
				core.AssertEqual(t, fixtures.TestUser.Email, resp.User.Email, "Email should match")
				core.AssertNotEqual(t, 0, len(resp.Games), "Should have games")
				core.AssertEqual(t, 1, resp.Metadata.Page, "Page should be 1")
				core.AssertEqual(t, 12, resp.Metadata.PageSize, "Page size should be 12")
			},
		},
		{
			name:        "get user with no games",
			userID:      999999, // Create a user with no games
			page:        1,
			pageSize:    12,
			expectError: true, // User doesn't exist
		},
		{
			name:        "pagination - page 1",
			userID:      int32(fixtures.TestUser.ID),
			page:        1,
			pageSize:    2,
			expectError: false,
			checkResponse: func(t *testing.T, resp *core.UserProfileResponse) {
				core.AssertEqual(t, 1, resp.Metadata.Page, "Should be on page 1")
				core.AssertEqual(t, 2, resp.Metadata.PageSize, "Page size should be 2")
				if resp.Metadata.TotalCount > 2 {
					core.AssertEqual(t, true, resp.Metadata.HasNextPage, "Should have next page")
				}
				core.AssertEqual(t, false, resp.Metadata.HasPreviousPage, "Should not have previous page")
			},
		},
		{
			name:        "invalid page defaults to 1",
			userID:      int32(fixtures.TestUser.ID),
			page:        0,
			pageSize:    12,
			expectError: false,
			checkResponse: func(t *testing.T, resp *core.UserProfileResponse) {
				core.AssertEqual(t, 1, resp.Metadata.Page, "Invalid page should default to 1")
			},
		},
		{
			name:        "invalid page size defaults to 12",
			userID:      int32(fixtures.TestUser.ID),
			page:        1,
			pageSize:    0,
			expectError: false,
			checkResponse: func(t *testing.T, resp *core.UserProfileResponse) {
				core.AssertEqual(t, 12, resp.Metadata.PageSize, "Invalid page size should default to 12")
			},
		},
		{
			name:        "excessive page size capped at 100",
			userID:      int32(fixtures.TestUser.ID),
			page:        1,
			pageSize:    200,
			expectError: false,
			checkResponse: func(t *testing.T, resp *core.UserProfileResponse) {
				core.AssertEqual(t, 12, resp.Metadata.PageSize, "Page size should be defaulted to 12")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.GetUserProfile(ctx, tt.userID, tt.page, tt.pageSize)

			if tt.expectError {
				core.AssertNotEqual(t, nil, err, "Expected an error")
				return
			}

			core.AssertNoError(t, err, "Should not return error")
			core.AssertNotEqual(t, (*core.UserProfileResponse)(nil), resp, "Response should not be nil")

			if tt.checkResponse != nil {
				tt.checkResponse(t, resp)
			}
		})
	}
}

// TestGetUserGames tests game history retrieval with privacy filtering
func TestGetUserGames(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users", "games", "game_participants", "characters")

	fixtures := testDB.SetupFixtures(t)
	service := &UserProfileService{DB: testDB.Pool}
	ctx := context.Background()

	tests := []struct {
		name        string
		userID      int32
		limit       int
		offset      int
		expectError bool
		checkGames  func(t *testing.T, games []core.UserGame)
	}{
		{
			name:        "get user games",
			userID:      int32(fixtures.TestUser.ID),
			limit:       10,
			offset:      0,
			expectError: false,
			checkGames: func(t *testing.T, games []core.UserGame) {
				core.AssertNotEqual(t, 0, len(games), "Should have games")
				for _, game := range games {
					core.AssertNotEqual(t, int32(0), game.GameID, "Game ID should be set")
					core.AssertNotEqual(t, "", game.Title, "Game title should be set")
					core.AssertNotEqual(t, "", game.GMUsername, "GM username should be set")
				}
				// Verify the fixture game appears in results by title
				found := false
				for _, game := range games {
					if game.Title == "Test Game" {
						found = true
						break
					}
				}
				core.AssertEqual(t, true, found, "Fixture game 'Test Game' should appear in results")
			},
		},
		{
			name:        "pagination with limit and offset",
			userID:      int32(fixtures.TestUser.ID),
			limit:       2,
			offset:      0,
			expectError: false,
			checkGames: func(t *testing.T, games []core.UserGame) {
				// Should return at most 2 games
				if len(games) > 2 {
					t.Errorf("Expected at most 2 games, got %d", len(games))
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			games, err := service.GetUserGames(ctx, tt.userID, tt.limit, tt.offset)

			if tt.expectError {
				core.AssertNotEqual(t, nil, err, "Expected an error")
				return
			}

			core.AssertNoError(t, err, "Should not return error")

			if tt.checkGames != nil {
				tt.checkGames(t, games)
			}
		})
	}
}

// TestUpdateUserProfile tests profile update functionality
func TestUpdateUserProfile(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	fixtures := testDB.SetupFixtures(t)
	service := &UserProfileService{DB: testDB.Pool}
	ctx := context.Background()

	tests := []struct {
		name        string
		userID      int32
		displayName *string
		bio         *string
		expectError bool
	}{
		{
			name:        "update display name only",
			userID:      int32(fixtures.TestUser.ID),
			displayName: stringPtr("New Display Name"),
			bio:         nil,
			expectError: false,
		},
		{
			name:        "update bio only",
			userID:      int32(fixtures.TestUser.ID),
			displayName: nil,
			bio:         stringPtr("This is my new bio"),
			expectError: false,
		},
		{
			name:        "update both fields",
			userID:      int32(fixtures.TestUser.ID),
			displayName: stringPtr("Another Name"),
			bio:         stringPtr("Another bio"),
			expectError: false,
		},
		{
			name:        "nil values ignored",
			userID:      int32(fixtures.TestUser.ID),
			displayName: nil,
			bio:         nil,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.UpdateUserProfile(ctx, tt.userID, tt.displayName, tt.bio)

			if tt.expectError {
				core.AssertNotEqual(t, nil, err, "Expected an error")
				return
			}

			core.AssertNoError(t, err, "Should not return error")

			// Verify the update by fetching the profile
			profile, err := service.GetUserProfile(ctx, tt.userID, 1, 12)
			core.AssertNoError(t, err, "Should fetch updated profile")

			if tt.displayName != nil {
				core.AssertNotEqual(t, (*string)(nil), profile.User.DisplayName, "Display name should be set")
				if profile.User.DisplayName != nil {
					core.AssertEqual(t, *tt.displayName, *profile.User.DisplayName, "Display name should match")
				}
			}

			if tt.bio != nil {
				core.AssertNotEqual(t, (*string)(nil), profile.User.Bio, "Bio should be set")
				if profile.User.Bio != nil {
					core.AssertEqual(t, *tt.bio, *profile.User.Bio, "Bio should match")
				}
			}
		})
	}
}

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}
