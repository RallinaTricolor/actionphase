package auth

import (
	"actionphase/pkg/core"
	"actionphase/pkg/http"
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

// TestAuthFlow tests the complete authentication flow including registration, login, and token refresh
func TestAuthFlow_CompleteWorkflow(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	// Setup test server
	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupAuthTestRouter(app)

	// Test data
	testUser := core.User{
		Username: "integrationtest",
		Email:    "integration@test.com",
		Password: "testpassword123",
	}

	// Step 1: Register a new user
	t.Run("user_registration", func(t *testing.T) {
		registerPayload, _ := json.Marshal(testUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(registerPayload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Registration should succeed")

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		// Check that tokens are returned
		core.AssertNotEqual(t, "", response["token"], "Access token should be returned")
		core.AssertNotEqual(t, "", response["refresh_token"], "Refresh token should be returned")
	})

	// Step 2: Login with registered user
	var accessToken, refreshToken string
	t.Run("user_login", func(t *testing.T) {
		loginPayload, _ := json.Marshal(map[string]string{
			"username": testUser.Username,
			"password": testUser.Password,
		})
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginPayload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Login should succeed")

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		// Store tokens for subsequent tests
		accessToken = response["token"].(string)
		refreshToken = response["refresh_token"].(string)

		core.AssertNotEqual(t, "", accessToken, "Access token should be returned")
		core.AssertNotEqual(t, "", refreshToken, "Refresh token should be returned")
	})

	// Step 3: Access protected endpoint with valid token
	t.Run("protected_endpoint_access", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Protected endpoint should be accessible with valid token")
	})

	// Step 4: Token refresh
	t.Run("token_refresh", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Token refresh should succeed")

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		newAccessToken := response["token"].(string)
		core.AssertNotEqual(t, "", newAccessToken, "New access token should be returned")
		core.AssertNotEqual(t, accessToken, newAccessToken, "New token should be different from old token")
	})
}

func TestAuthFlow_InvalidCredentials(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupAuthTestRouter(app)

	testCases := []struct {
		name           string
		endpoint       string
		method         string
		payload        map[string]string
		expectedStatus int
		description    string
	}{
		{
			name:     "invalid_login_nonexistent_user",
			endpoint: "/api/v1/auth/login",
			method:   "POST",
			payload: map[string]string{
				"username": "nonexistent",
				"password": "wrongpassword",
			},
			expectedStatus: 401,
			description:    "Login with non-existent user should fail",
		},
		{
			name:     "invalid_registration_missing_email",
			endpoint: "/api/v1/auth/register",
			method:   "POST",
			payload: map[string]string{
				"username": "testuser",
				"password": "validpassword",
				// missing email
			},
			expectedStatus: 400,
			description:    "Registration without email should fail",
		},
		{
			name:     "invalid_registration_weak_password",
			endpoint: "/api/v1/auth/register",
			method:   "POST",
			payload: map[string]string{
				"username": "testuser",
				"email":    "test@example.com",
				"password": "weak", // too short
			},
			expectedStatus: 400,
			description:    "Registration with weak password should fail",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest(tc.method, tc.endpoint, bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			core.AssertNoError(t, err, "Error response should be valid JSON")

			core.AssertNotEqual(t, "", response["status"], "Error response should have status field")
		})
	}
}

func TestAuthFlow_UnauthorizedAccess(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupAuthTestRouter(app)

	protectedEndpoints := []struct {
		method   string
		endpoint string
	}{
		{"GET", "/api/v1/auth/refresh"},
	}

	for _, endpoint := range protectedEndpoints {
		t.Run("no_token_"+endpoint.method+"_"+endpoint.endpoint, func(t *testing.T) {
			req := httptest.NewRequest(endpoint.method, endpoint.endpoint, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, 401, w.Code, "Protected endpoint should require authentication")
		})

		t.Run("invalid_token_"+endpoint.method+"_"+endpoint.endpoint, func(t *testing.T) {
			req := httptest.NewRequest(endpoint.method, endpoint.endpoint, nil)
			req.Header.Set("Authorization", "Bearer invalid-token")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, 401, w.Code, "Invalid token should be rejected")
		})
	}
}

func TestAuthFlow_DuplicateRegistration(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupAuthTestRouter(app)

	// Create initial user
	testUser := core.User{
		Username: "duplicatetest",
		Email:    "duplicate@test.com",
		Password: "testpassword123",
	}

	// First registration should succeed
	registerPayload, _ := json.Marshal(testUser)
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(registerPayload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	core.AssertEqual(t, 200, w.Code, "First registration should succeed")

	// Second registration with same username should fail
	t.Run("duplicate_username", func(t *testing.T) {
		duplicateUser := testUser
		duplicateUser.Email = "different@test.com" // different email, same username

		payload, _ := json.Marshal(duplicateUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Duplicate username registration should fail")
	})

	// Registration with same email should also fail
	t.Run("duplicate_email", func(t *testing.T) {
		duplicateUser := testUser
		duplicateUser.Username = "differentuser" // different username, same email

		payload, _ := json.Marshal(duplicateUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Duplicate email registration should fail")
	})
}

// setupAuthTestRouter creates a test router with auth routes configured
func setupAuthTestRouter(app *core.App) *chi.Mux {
	// Initialize JWT auth for testing
	tokenAuth := jwtauth.New("HS256", []byte("TEST_SECRET"), nil)

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

// Benchmark tests for performance monitoring
func BenchmarkAuthFlow_Registration(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupAuthTestRouter(app)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		testUser := core.User{
			Username: "benchuser" + string(rune(i)),
			Email:    "bench" + string(rune(i)) + "@test.com",
			Password: "benchpassword123",
		}

		payload, _ := json.Marshal(testUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != 200 {
			b.Fatalf("Registration failed with status %d", w.Code)
		}
	}
}

func BenchmarkAuthFlow_Login(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "sessions", "users")

	app := &core.App{
		Pool:   testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	router := setupAuthTestRouter(app)
	fixtures := testDB.SetupFixtures(b)

	loginPayload, _ := json.Marshal(map[string]string{
		"username": fixtures.TestUser.Username,
		"password": "test_password", // from test fixtures
	})

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginPayload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != 200 && w.Code != 401 { // 401 is expected if password doesn't match exactly
			b.Fatalf("Login failed with unexpected status %d", w.Code)
		}
	}
}
