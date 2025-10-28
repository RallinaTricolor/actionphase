package games

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

// TestGetFilteredGames_PaginationDefaults tests that pagination defaults are applied correctly
func TestGetFilteredGames_PaginationDefaults(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "games", "sessions", "users")
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Test token creation should succeed")

	// Make request without pagination parameters
	req := httptest.NewRequest(http.MethodGet, "/api/v1/games/", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")

	var response GameListingResponse
	err = json.NewDecoder(w.Body).Decode(&response)
	core.AssertNoError(t, err, "Should decode response")

	// Verify default pagination values
	core.AssertEqual(t, 1, response.Metadata.Page, "Default page should be 1")
	core.AssertEqual(t, 20, response.Metadata.PageSize, "Default page size should be 20")
	core.AssertEqual(t, false, response.Metadata.HasPreviousPage, "First page should not have previous")
}

// TestGetFilteredGames_PaginationCustomValues tests custom pagination parameters
func TestGetFilteredGames_PaginationCustomValues(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "games", "sessions", "users")
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)

	// Create test user and games to test pagination
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Test token creation should succeed")

	gameService := &db.GameService{DB: testDB.Pool}

	// Create multiple games for pagination testing
	for i := 1; i <= 25; i++ {
		_, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
			Title:       "Test Game " + string(rune(i)),
			Description: "Testing pagination",
			GMUserID:    int32(fixtures.TestUser.ID),
			IsPublic:    true,
		})
		core.AssertNoError(t, err, "Game creation should succeed")
	}

	tests := []struct {
		name             string
		page             string
		pageSize         string
		expectedPage     int
		expectedPageSize int
		expectedCount    int
	}{
		{
			name:             "Page 2 with size 10",
			page:             "2",
			pageSize:         "10",
			expectedPage:     2,
			expectedPageSize: 10,
			expectedCount:    10,
		},
		{
			name:             "Page 3 with size 5",
			page:             "3",
			pageSize:         "5",
			expectedPage:     3,
			expectedPageSize: 5,
			expectedCount:    5,
		},
		{
			name:             "Large page size",
			page:             "1",
			pageSize:         "50",
			expectedPage:     1,
			expectedPageSize: 50,
			expectedCount:    26, // SetupFixtures creates 1 game + we created 25 = 26 total
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/games/?page="+tt.page+"&page_size="+tt.pageSize, nil)
			req.Header.Set("Authorization", "Bearer "+accessToken)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")

			var response GameListingResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			core.AssertNoError(t, err, "Should decode response")

			core.AssertEqual(t, tt.expectedPage, response.Metadata.Page, "Page number should match")
			core.AssertEqual(t, tt.expectedPageSize, response.Metadata.PageSize, "Page size should match")
			core.AssertEqual(t, tt.expectedCount, len(response.Games), "Game count should match")
		})
	}
}

// TestGetFilteredGames_PaginationInvalidValues tests handling of invalid pagination parameters
func TestGetFilteredGames_PaginationInvalidValues(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "games", "sessions", "users")
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Test token creation should succeed")

	tests := []struct {
		name             string
		page             string
		pageSize         string
		expectedPage     int
		expectedPageSize int
		description      string
	}{
		{
			name:             "Negative page falls back to default",
			page:             "-1",
			pageSize:         "20",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Negative page should default to 1",
		},
		{
			name:             "Zero page falls back to default",
			page:             "0",
			pageSize:         "20",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Zero page should default to 1",
		},
		{
			name:             "Invalid page string falls back to default",
			page:             "invalid",
			pageSize:         "20",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Invalid page should default to 1",
		},
		{
			name:             "Negative page size falls back to default",
			page:             "1",
			pageSize:         "-10",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Negative page size should default to 20",
		},
		{
			name:             "Zero page size falls back to default",
			page:             "1",
			pageSize:         "0",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Zero page size should default to 20",
		},
		{
			name:             "Page size exceeding max (100) is capped",
			page:             "1",
			pageSize:         "150",
			expectedPage:     1,
			expectedPageSize: 20,
			description:      "Page size > 100 should default to 20",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/games/?page="+tt.page+"&page_size="+tt.pageSize, nil)
			req.Header.Set("Authorization", "Bearer "+accessToken)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")

			var response GameListingResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			core.AssertNoError(t, err, "Should decode response")

			core.AssertEqual(t, tt.expectedPage, response.Metadata.Page, tt.description)
			core.AssertEqual(t, tt.expectedPageSize, response.Metadata.PageSize, tt.description)
		})
	}
}

// TestGetFilteredGames_PaginationMetadata tests pagination metadata calculations
func TestGetFilteredGames_PaginationMetadata(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "games", "sessions", "users")
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGameTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	accessToken, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Test token creation should succeed")

	// Create exactly 23 games for precise metadata testing
	// Note: SetupFixtures already creates 1 game, so total will be 24
	gameService := &db.GameService{DB: testDB.Pool}
	for i := 1; i <= 23; i++ {
		_, err := gameService.CreateGame(context.Background(), core.CreateGameRequest{
			Title:       "Pagination Test Game " + string(rune(i)),
			Description: "Testing metadata",
			GMUserID:    int32(fixtures.TestUser.ID),
			IsPublic:    true,
		})
		core.AssertNoError(t, err, "Game creation should succeed")
	}

	tests := []struct {
		name                string
		page                int
		pageSize            int
		expectedTotalPages  int
		expectedHasNext     bool
		expectedHasPrevious bool
	}{
		{
			name:                "First page of 3 (page_size=10, total=24)",
			page:                1,
			pageSize:            10,
			expectedTotalPages:  3,
			expectedHasNext:     true,
			expectedHasPrevious: false,
		},
		{
			name:                "Middle page of 3",
			page:                2,
			pageSize:            10,
			expectedTotalPages:  3,
			expectedHasNext:     true,
			expectedHasPrevious: true,
		},
		{
			name:                "Last page of 3",
			page:                3,
			pageSize:            10,
			expectedTotalPages:  3,
			expectedHasNext:     false,
			expectedHasPrevious: true,
		},
		{
			name:                "Single page when page_size > total",
			page:                1,
			pageSize:            50,
			expectedTotalPages:  1,
			expectedHasNext:     false,
			expectedHasPrevious: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/api/v1/games/?page="+strconv.Itoa(tt.page)+"&page_size="+strconv.Itoa(tt.pageSize), nil)
			req.Header.Set("Authorization", "Bearer "+accessToken)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")

			var response GameListingResponse
			err := json.NewDecoder(w.Body).Decode(&response)
			core.AssertNoError(t, err, "Should decode response")

			core.AssertEqual(t, tt.expectedTotalPages, response.Metadata.TotalPages, "Total pages should match")
			core.AssertEqual(t, tt.expectedHasNext, response.Metadata.HasNextPage, "Has next page should match")
			core.AssertEqual(t, tt.expectedHasPrevious, response.Metadata.HasPreviousPage, "Has previous page should match")
			core.AssertEqual(t, 24, response.Metadata.TotalCount, "Total count should be 24")
			core.AssertEqual(t, 24, response.Metadata.FilteredCount, "Filtered count should be 24")
		})
	}
}
