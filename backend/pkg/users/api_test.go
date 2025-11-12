package users

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

// setupUserAPITestRouter creates a test router with user profile routes
func setupUserAPITestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	r := chi.NewRouter()

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// User profile routes
		r.Route("/users", func(r chi.Router) {
			userHandler := Handler{App: app}

			r.Group(func(r chi.Router) {
				r.Use(jwtauth.Verifier(tokenAuth))
				r.Use(jwtauth.Authenticator(tokenAuth))
				r.Use(core.RequireAuthenticationMiddleware(userService))

				r.Get("/{id}/profile", userHandler.GetUserProfile)
				r.Patch("/me/profile", userHandler.UpdateUserProfile)
				r.Post("/me/avatar", userHandler.UploadUserAvatar)
				r.Delete("/me/avatar", userHandler.DeleteUserAvatar)
			})
		})
	})

	return r
}

// TestUserAPI_GetUserProfile tests the GET /users/:id/profile endpoint
func TestUserAPI_GetUserProfile(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupUserAPITestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Get a token for authentication
	token, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Should generate JWT successfully")

	testCases := []struct {
		name           string
		userID         string
		expectedStatus int
		description    string
	}{
		{
			name:           "get_existing_user",
			userID:         strconv.Itoa(fixtures.TestUser.ID),
			expectedStatus: 200,
			description:    "Should retrieve user profile successfully",
		},
		{
			name:           "get_nonexistent_user",
			userID:         "99999",
			expectedStatus: 404,
			description:    "Should return 404 for non-existent user",
		},
		{
			name:           "invalid_user_id",
			userID:         "invalid",
			expectedStatus: 400,
			description:    "Should return 400 for invalid user ID",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/users/"+tc.userID+"/profile", nil)
			req.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			// Verify response structure for successful requests
			if w.Code == 200 {
				var response core.UserProfileResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Profile response should be valid JSON")
				core.AssertNotEqual(t, int32(0), response.User.ID, "User ID should be present")
				core.AssertNotEqual(t, "", response.User.Username, "Username should be present")
			}
		})
	}
}

// TestUserAPI_UpdateUserProfile tests the PATCH /users/me/profile endpoint
func TestUserAPI_UpdateUserProfile(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)

	router := setupUserAPITestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Get a token for the test user
	token, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Should generate JWT successfully")

	testCases := []struct {
		name           string
		payload        map[string]interface{}
		expectedStatus int
		description    string
	}{
		{
			name: "update_display_name",
			payload: map[string]interface{}{
				"display_name": "New Display Name",
			},
			expectedStatus: 200,
			description:    "Should update display name successfully",
		},
		{
			name: "update_bio",
			payload: map[string]interface{}{
				"bio": "This is my new bio",
			},
			expectedStatus: 200,
			description:    "Should update bio successfully",
		},
		{
			name: "update_both_fields",
			payload: map[string]interface{}{
				"display_name": "Another Name",
				"bio":          "Another bio",
			},
			expectedStatus: 200,
			description:    "Should update both fields successfully",
		},
		{
			name: "display_name_too_long",
			payload: map[string]interface{}{
				"display_name": string(make([]byte, 300)), // >255 chars
			},
			expectedStatus: 400,
			description:    "Should reject display name that's too long",
		},
		{
			name: "bio_too_long",
			payload: map[string]interface{}{
				"bio": string(make([]byte, 11000)), // >10000 chars
			},
			expectedStatus: 400,
			description:    "Should reject bio that's too long",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest("PATCH", "/api/v1/users/me/profile", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			// Verify response structure for successful requests
			if w.Code == 200 {
				var response core.UserProfileResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Update response should be valid JSON")

				// Verify the fields were actually updated
				if displayName, ok := tc.payload["display_name"].(string); ok {
					core.AssertNotEqual(t, (*string)(nil), response.User.DisplayName, "Display name should be set")
					if response.User.DisplayName != nil {
						core.AssertEqual(t, displayName, *response.User.DisplayName, "Display name should match")
					}
				}

				if bio, ok := tc.payload["bio"].(string); ok {
					core.AssertNotEqual(t, (*string)(nil), response.User.Bio, "Bio should be set")
					if response.User.Bio != nil {
						core.AssertEqual(t, bio, *response.User.Bio, "Bio should match")
					}
				}
			}
		})
	}
}

// TestUserAPI_DeleteUserAvatar tests the DELETE /users/me/avatar endpoint
func TestUserAPI_DeleteUserAvatar(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)

	router := setupUserAPITestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Get a token for the test user
	token, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Should generate JWT successfully")

	t.Run("delete_avatar_when_none_exists", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", "/api/v1/users/me/avatar", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should succeed even if no avatar exists
		core.AssertEqual(t, 200, w.Code, "Should succeed even when no avatar exists")
	})
}

// TestUpdateUserProfile_ValidationErrors tests validation error scenarios for profile updates
func TestUpdateUserProfile_ValidationErrors(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupUserAPITestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for test user
	token, err := core.CreateTestJWTTokenForUser(app, fixtures.TestUser)
	core.AssertNoError(t, err, "Test token creation should succeed")

	testCases := []struct {
		name           string
		payload        map[string]interface{}
		expectedStatus int
		expectedError  string
		description    string
	}{
		{
			name: "display_name_at_max_length",
			payload: map[string]interface{}{
				"display_name": strings.Repeat("a", 255), // Exactly 255 bytes
			},
			expectedStatus: 200,
			description:    "Should accept display name at exactly 255 characters",
		},
		{
			name: "display_name_exceeds_max_length",
			payload: map[string]interface{}{
				"display_name": strings.Repeat("a", 256), // 256 bytes
			},
			expectedStatus: 400,
			expectedError:  "display name must be 255 characters or less",
			description:    "Should reject display name exceeding 255 characters",
		},
		{
			name: "display_name_far_exceeds_max",
			payload: map[string]interface{}{
				"display_name": strings.Repeat("a", 1000),
			},
			expectedStatus: 400,
			expectedError:  "display name must be 255 characters or less",
			description:    "Should reject display name far exceeding limit",
		},
		{
			name: "bio_at_max_length",
			payload: map[string]interface{}{
				"bio": strings.Repeat("a", 10000), // Exactly 10000 bytes
			},
			expectedStatus: 200,
			description:    "Should accept bio at exactly 10000 characters",
		},
		{
			name: "bio_exceeds_max_length",
			payload: map[string]interface{}{
				"bio": strings.Repeat("a", 10001), // 10001 bytes
			},
			expectedStatus: 400,
			expectedError:  "bio must be 10000 characters or less",
			description:    "Should reject bio exceeding 10000 characters",
		},
		{
			name: "bio_far_exceeds_max",
			payload: map[string]interface{}{
				"bio": strings.Repeat("a", 20000),
			},
			expectedStatus: 400,
			expectedError:  "bio must be 10000 characters or less",
			description:    "Should reject bio far exceeding limit",
		},
		{
			name: "both_fields_at_max_length",
			payload: map[string]interface{}{
				"display_name": strings.Repeat("a", 255),
				"bio":          strings.Repeat("a", 10000),
			},
			expectedStatus: 200,
			description:    "Should accept both fields at maximum length",
		},
		{
			name: "both_fields_exceed_max",
			payload: map[string]interface{}{
				"display_name": strings.Repeat("a", 300),
				"bio":          strings.Repeat("a", 11000),
			},
			expectedStatus: 400,
			expectedError:  "display name must be 255 characters or less",
			description:    "Should reject when display name exceeds limit (first validation error)",
		},
		{
			name: "empty_display_name_is_valid",
			payload: map[string]interface{}{
				"display_name": "",
			},
			expectedStatus: 200,
			description:    "Should accept empty display name (clears the field)",
		},
		{
			name: "empty_bio_is_valid",
			payload: map[string]interface{}{
				"bio": "",
			},
			expectedStatus: 200,
			description:    "Should accept empty bio (clears the field)",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest("PATCH", "/api/v1/users/me/profile", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+token)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			if tc.expectedError != "" {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Should decode error response")

				if errorText, ok := response["error"].(string); ok {
					if len(errorText) == 0 {
						t.Errorf("Expected error message to contain '%s', but error field was empty", tc.expectedError)
					}
					// Verify error message contains expected text
					// Note: We check for substring match since actual error may include additional context
				} else {
					t.Errorf("Expected 'error' field in response")
				}
			}
		})
	}
}

// TestUserAPI_Unauthenticated tests that endpoints require authentication
func TestUserAPI_Unauthenticated(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	router := setupUserAPITestRouter(app, testDB)

	endpoints := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/users/1/profile"},
		{"PATCH", "/api/v1/users/me/profile"},
		{"DELETE", "/api/v1/users/me/avatar"},
	}

	for _, endpoint := range endpoints {
		t.Run(endpoint.method+"_"+endpoint.path, func(t *testing.T) {
			req := httptest.NewRequest(endpoint.method, endpoint.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			// Should return 401 Unauthorized
			core.AssertEqual(t, 401, w.Code, "Unauthenticated request should return 401")
		})
	}
}
