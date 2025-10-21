package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

// TestAuthAPI_RegistrationEndpoint tests the user registration API endpoint
func TestAuthAPI_RegistrationEndpoint(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

	router := setupAuthAPITestRouter(app)

	testCases := []struct {
		name           string
		payload        map[string]interface{}
		expectedStatus int
		description    string
		checkFields    []string // Fields to verify in successful responses
	}{
		{
			name: "successful_registration",
			payload: map[string]interface{}{
				"username": "newuser",
				"email":    "newuser@example.com",
				"password": "securepassword123",
			},
			expectedStatus: 201,
			description:    "Valid registration should succeed",
			checkFields:    []string{"Token"},
		},
		{
			name: "registration_missing_username",
			payload: map[string]interface{}{
				"email":    "test@example.com",
				"password": "securepassword123",
			},
			expectedStatus: 400,
			description:    "Registration without username should fail",
		},
		{
			name: "registration_missing_email",
			payload: map[string]interface{}{
				"username": "testuser",
				"password": "securepassword123",
			},
			expectedStatus: 400,
			description:    "Registration without email should fail",
		},
		{
			name: "registration_missing_password",
			payload: map[string]interface{}{
				"username": "testuser",
				"email":    "test@example.com",
			},
			expectedStatus: 400,
			description:    "Registration without password should fail",
		},
		{
			name: "registration_weak_password",
			payload: map[string]interface{}{
				"username": "testuser",
				"email":    "test@example.com",
				"password": "123", // too short
			},
			expectedStatus: 400,
			description:    "Registration with weak password should fail",
		},
		{
			name: "registration_invalid_email",
			payload: map[string]interface{}{
				"username": "testuser",
				"email":    "invalid-email",
				"password": "securepassword123",
			},
			expectedStatus: 400,
			description:    "Registration with invalid email should fail",
		},
		{
			name: "registration_duplicate_username",
			payload: map[string]interface{}{
				"username": "newuser", // same as first test
				"email":    "different@example.com",
				"password": "securepassword123",
			},
			expectedStatus: 400,
			description:    "Registration with duplicate username should fail",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			// Verify response structure for successful registrations
			if w.Code == 201 && len(tc.checkFields) > 0 {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Registration response should be valid JSON")

				for _, field := range tc.checkFields {
					core.AssertNotEqual(t, "", response[field], field+" should be present in response")
				}
			}

			// Verify error responses have proper structure
			if w.Code >= 400 {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Error response should be valid JSON")
				core.AssertNotEqual(t, "", response["status"], "Error response should have status field")
			}
		})
	}
}

// TestAuthAPI_LoginEndpoint tests the user login API endpoint
func TestAuthAPI_LoginEndpoint(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

	router := setupAuthAPITestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	// Use the test fixture user (password is "test_password")
	plainPassword := "test_password"

	testCases := []struct {
		name           string
		payload        map[string]interface{}
		expectedStatus int
		description    string
		checkFields    []string
	}{
		{
			name: "successful_login",
			payload: map[string]interface{}{
				"username": fixtures.TestUser.Username,
				"password": plainPassword,
			},
			expectedStatus: 200,
			description:    "Valid login should succeed",
			checkFields:    []string{"Token"},
		},
		{
			name: "login_wrong_password",
			payload: map[string]interface{}{
				"username": fixtures.TestUser.Username,
				"password": "wrongpassword",
			},
			expectedStatus: 400,
			description:    "Login with wrong password should fail",
		},
		{
			name: "login_nonexistent_user",
			payload: map[string]interface{}{
				"username": "nonexistent",
				"password": "anypassword",
			},
			expectedStatus: 401, // Fixed to return unauthorized instead of internal error
			description:    "Login with non-existent user should fail",
		},
		{
			name: "login_missing_username",
			payload: map[string]interface{}{
				"password": plainPassword,
			},
			expectedStatus: 401,
			description:    "Login without username should fail",
		},
		{
			name: "login_missing_password",
			payload: map[string]interface{}{
				"username": fixtures.TestUser.Username,
			},
			expectedStatus: 400,
			description:    "Login without password should fail",
		},
		{
			name: "login_empty_credentials",
			payload: map[string]interface{}{
				"username": "",
				"password": "",
			},
			expectedStatus: 401,
			description:    "Login with empty credentials should fail",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tc.expectedStatus {
				t.Logf("Login test %s failed. Expected %d, got %d. Response: %s",
					tc.name, tc.expectedStatus, w.Code, w.Body.String())
			}
			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			// Verify response structure for successful logins
			if w.Code == 200 && len(tc.checkFields) > 0 {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Login response should be valid JSON")

				for _, field := range tc.checkFields {
					core.AssertNotEqual(t, "", response[field], field+" should be present in response")
				}
			}

			// Verify error responses
			if w.Code >= 400 {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Error response should be valid JSON")
				core.AssertNotEqual(t, "", response["status"], "Error response should have status field")
			}
		})
	}
}

// TestAuthAPI_RefreshEndpoint tests the token refresh API endpoint
func TestAuthAPI_RefreshEndpoint(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

	router := setupAuthAPITestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	// Create a valid JWT token for the test user
	validToken, err := createTestAuthToken(fixtures.TestUser.Username)
	core.AssertNoError(t, err, "Test token creation should succeed")

	// Create an expired token
	expiredToken, err := createExpiredTestAuthToken(fixtures.TestUser.Username)
	core.AssertNoError(t, err, "Expired token creation should succeed")

	testCases := []struct {
		name           string
		token          string
		expectedStatus int
		description    string
		checkFields    []string
	}{
		{
			name:           "successful_refresh",
			token:          validToken,
			expectedStatus: 200,
			description:    "Valid token refresh should succeed",
			checkFields:    []string{"token"},
		},
		{
			name:           "refresh_no_token",
			token:          "",
			expectedStatus: 401,
			description:    "Refresh without token should fail",
		},
		{
			name:           "refresh_invalid_token",
			token:          "invalid.jwt.token",
			expectedStatus: 401,
			description:    "Refresh with invalid token should fail",
		},
		{
			name:           "refresh_expired_token",
			token:          expiredToken,
			expectedStatus: 401,
			description:    "Refresh with expired token should fail",
		},
		{
			name:           "refresh_malformed_token",
			token:          "not-a-jwt-token",
			expectedStatus: 401,
			description:    "Refresh with malformed token should fail",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
			if tc.token != "" {
				req.Header.Set("Authorization", "Bearer "+tc.token)
			}
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			// Verify response structure for successful refresh
			if w.Code == 200 && len(tc.checkFields) > 0 {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Refresh response should be valid JSON")

				for _, field := range tc.checkFields {
					core.AssertNotEqual(t, "", response[field], field+" should be present in response")
				}
			}
		})
	}
}

// TestAuthAPI_ContentTypeHandling tests proper content-type handling
func TestAuthAPI_ContentTypeHandling(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

	router := setupAuthAPITestRouter(app)

	testCases := []struct {
		name           string
		endpoint       string
		method         string
		contentType    string
		payload        string
		expectedStatus int
		description    string
	}{
		{
			name:           "register_valid_json",
			endpoint:       "/api/v1/auth/register",
			method:         "POST",
			contentType:    "application/json",
			payload:        `{"username":"testuser","email":"test@example.com","password":"testpassword123"}`,
			expectedStatus: 201,
			description:    "Registration with valid JSON should succeed",
		},
		{
			name:           "register_invalid_json",
			endpoint:       "/api/v1/auth/register",
			method:         "POST",
			contentType:    "application/json",
			payload:        `{"username":"testuser","email":"test@example.com"`, // missing closing brace
			expectedStatus: 400,
			description:    "Registration with invalid JSON should fail",
		},
		{
			name:           "register_wrong_content_type",
			endpoint:       "/api/v1/auth/register",
			method:         "POST",
			contentType:    "text/plain",
			payload:        `{"username":"testuser","email":"test@example.com","password":"testpassword123"}`,
			expectedStatus: 400,
			description:    "Registration with wrong content type should fail",
		},
		{
			name:           "register_no_content_type",
			endpoint:       "/api/v1/auth/register",
			method:         "POST",
			contentType:    "",
			payload:        `{"username":"testuser","email":"test@example.com","password":"testpassword123"}`,
			expectedStatus: 400,
			description:    "Registration without content type should fail",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.endpoint, bytes.NewBufferString(tc.payload))
			if tc.contentType != "" {
				req.Header.Set("Content-Type", tc.contentType)
			}
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)
		})
	}
}

// TestAuthAPI_RateLimiting tests request rate limiting behavior (if implemented)
func TestAuthAPI_RateLimiting(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

	router := setupAuthAPITestRouter(app)

	// Test rapid successive login attempts
	t.Run("rapid_login_attempts", func(t *testing.T) {
		loginPayload := `{"username":"nonexistent","password":"wrongpassword"}`

		successCount := 0
		for i := 0; i < 10; i++ {
			req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBufferString(loginPayload))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			// Count how many requests succeeded (got processed, even if they failed authentication)
			if w.Code == 401 || w.Code == 400 { // These are "processed" responses
				successCount++
			}
		}

		// All requests should be processed since rate limiting isn't implemented yet
		// This test serves as a placeholder for when rate limiting is added
		core.AssertEqual(t, 10, successCount, "All requests should be processed (no rate limiting implemented)")
	})
}

// setupAuthAPITestRouter creates a test router with auth routes configured for API testing
func setupAuthAPITestRouter(app *core.App) *chi.Mux {
	// Use the same secret from app config for consistency
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)

	r := chi.NewRouter()

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Auth routes
		r.Route("/auth", func(r chi.Router) {
			authHandler := Handler{App: app}
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

// TestAuthAPI_BannedUserLogin tests that banned users cannot log in
func TestAuthAPI_BannedUserLogin(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthAPITestRouter(app)

	// Create a user
	userService := &db.UserService{DB: testDB.Pool}
	user := &core.User{
		Username: "testuser",
		Password: "testpassword123",
		Email:    "testuser@example.com",
	}
	createdUser, err := userService.CreateUser(user)
	core.AssertNoError(t, err, "Should create user successfully")

	// Verify user can log in before being banned
	loginPayload := map[string]interface{}{
		"username": "testuser",
		"password": "testpassword123",
	}
	payload, _ := json.Marshal(loginPayload)
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	core.AssertEqual(t, 200, w.Code, "User should be able to log in before ban")

	// Ban the user via direct SQL update (simulating admin action)
	ctx := context.Background()
	_, err = testDB.Pool.Exec(ctx, "UPDATE users SET is_banned = TRUE WHERE id = $1", createdUser.ID)
	core.AssertNoError(t, err, "Should ban user successfully")

	// Attempt to log in again
	req = httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(payload))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should be forbidden
	core.AssertEqual(t, 403, w.Code, "Banned user should not be able to log in")

	// Verify error message
	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	core.AssertNoError(t, err, "Response should be valid JSON")
	core.AssertNotEqual(t, "", response["error"], "Response should contain error message")
}

// createTestAuthToken creates a JWT token for testing purposes
func createTestAuthToken(username string) (string, error) {
	return core.CreateTestJWTToken(username)
}

// createExpiredTestAuthToken creates an expired JWT token for testing purposes
func createExpiredTestAuthToken(username string) (string, error) {
	config := core.LoadTestConfig()
	tokenAuth := jwtauth.New("HS256", []byte(config.JWTSecret), nil)

	claims := map[string]interface{}{
		"username": username,
		"exp":      time.Now().Add(-time.Hour).Unix(), // expired 1 hour ago
	}

	_, tokenString, err := tokenAuth.Encode(claims)
	return tokenString, err
}

// Benchmark tests for performance monitoring
func BenchmarkAuthAPI_Registration(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

	router := setupAuthAPITestRouter(app)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		payload := `{"username":"benchuser` + string(rune(i)) + `","email":"bench` + string(rune(i)) + `@example.com","password":"benchpassword123"}`
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBufferString(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != 201 && w.Code != 400 { // 400 might be duplicate key error
			b.Fatalf("Registration failed with unexpected status %d", w.Code)
		}
	}
}

func BenchmarkAuthAPI_Login(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

	router := setupAuthAPITestRouter(app)

	// Create a test user for login benchmarks
	userService := &db.UserService{DB: testDB.Pool}
	plainPassword := "benchpassword123"
	testUser := &core.User{
		Username: "benchuser",
		Email:    "bench@example.com",
		Password: plainPassword,
	}
	_ = testUser.HashPassword()
	_, _ = userService.CreateUser(testUser)

	loginPayload := `{"username":"benchuser","password":"` + plainPassword + `"}`

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBufferString(loginPayload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != 200 && w.Code != 400 && w.Code != 500 {
			b.Fatalf("Login failed with unexpected status %d", w.Code)
		}
	}
}

func BenchmarkAuthAPI_TokenRefresh(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

	router := setupAuthAPITestRouter(app)
	fixtures := testDB.SetupFixtures(b)

	// Create a valid token
	validToken, _ := createTestAuthToken(fixtures.TestUser.Username)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
		req.Header.Set("Authorization", "Bearer "+validToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != 200 && w.Code != 401 {
			b.Fatalf("Token refresh failed with unexpected status %d", w.Code)
		}
	}
}
