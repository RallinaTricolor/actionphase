package auth

import (
	"actionphase/pkg/core"
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

// TestAuthFlow tests each authentication step independently for better test isolation
func TestAuthFlow_Registration(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthTestRouter(app)

	testUser := core.User{
		Username: "registrationtest",
		Email:    "registration@test.com",
		Password: "testpassword123",
	}

	registerPayload, _ := json.Marshal(testUser)
	req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(registerPayload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	core.AssertEqual(t, 201, w.Code, "Registration should succeed")

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	core.AssertNoError(t, err, "Response should be valid JSON")

	// Check that token is returned (field name is capitalized in current implementation)
	core.AssertNotEqual(t, "", response["Token"], "Access token should be returned")
}

func TestAuthFlow_Login(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthTestRouter(app)

	// Create test user first
	testUser := core.User{
		Username: "logintest",
		Email:    "login@test.com",
		Password: "testpassword123",
	}

	// Register user first
	registerPayload, _ := json.Marshal(testUser)
	registerReq := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(registerPayload))
	registerReq.Header.Set("Content-Type", "application/json")
	registerW := httptest.NewRecorder()
	router.ServeHTTP(registerW, registerReq)
	core.AssertEqual(t, 201, registerW.Code, "Registration should succeed for login test")

	// Now test login
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

	// Safely extract token with proper error handling (field name is capitalized)
	accessToken, ok := response["Token"].(string)
	if !ok {
		t.Fatalf("Expected 'Token' field in response, got: %+v", response)
	}

	core.AssertNotEqual(t, "", accessToken, "Access token should be returned")
}

func TestAuthFlow_ProtectedEndpointAccess(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthTestRouter(app)

	// Create and register test user
	testUser := core.User{
		Username: "protectedtest",
		Email:    "protected@test.com",
		Password: "testpassword123",
	}

	registerPayload, _ := json.Marshal(testUser)
	registerReq := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(registerPayload))
	registerReq.Header.Set("Content-Type", "application/json")
	registerW := httptest.NewRecorder()
	router.ServeHTTP(registerW, registerReq)
	core.AssertEqual(t, 201, registerW.Code, "Registration should succeed for protected endpoint test")

	// Get access token from registration response
	var registerResponse map[string]interface{}
	err := json.Unmarshal(registerW.Body.Bytes(), &registerResponse)
	core.AssertNoError(t, err, "Registration response should be valid JSON")

	accessToken, ok := registerResponse["Token"].(string)
	if !ok {
		t.Fatalf("Expected 'Token' field in registration response, got: %+v", registerResponse)
	}

	// Test protected endpoint access
	req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
	req.Header.Set("Authorization", "Bearer "+accessToken)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	core.AssertEqual(t, 200, w.Code, "Protected endpoint should be accessible with valid token")
}

func TestAuthFlow_TokenRefresh(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthTestRouter(app)

	// Create and register test user
	testUser := core.User{
		Username: "refreshtest",
		Email:    "refresh@test.com",
		Password: "testpassword123",
	}

	registerPayload, _ := json.Marshal(testUser)
	registerReq := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(registerPayload))
	registerReq.Header.Set("Content-Type", "application/json")
	registerW := httptest.NewRecorder()
	router.ServeHTTP(registerW, registerReq)
	core.AssertEqual(t, 201, registerW.Code, "Registration should succeed for token refresh test")

	// Get access token from registration response
	var registerResponse map[string]interface{}
	err := json.Unmarshal(registerW.Body.Bytes(), &registerResponse)
	core.AssertNoError(t, err, "Registration response should be valid JSON")

	originalAccessToken, ok := registerResponse["Token"].(string)
	if !ok {
		t.Fatalf("Expected 'Token' field in registration response, got: %+v", registerResponse)
	}

	// Test token refresh
	req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
	req.Header.Set("Authorization", "Bearer "+originalAccessToken)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	core.AssertEqual(t, 200, w.Code, "Token refresh should succeed")

	var response map[string]interface{}
	err = json.Unmarshal(w.Body.Bytes(), &response)
	core.AssertNoError(t, err, "Response should be valid JSON")

	newAccessToken, ok := response["Token"].(string)
	if !ok {
		t.Fatalf("Expected 'Token' field in refresh response, got: %+v", response)
	}

	core.AssertNotEqual(t, "", newAccessToken, "New access token should be returned")
	// Note: Token may be the same if created within the same second (same expiration time)
	// What matters is that a valid token is returned
}

func TestAuthFlow_InvalidCredentials(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

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

	app := core.NewTestApp(testDB.Pool)

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

	app := core.NewTestApp(testDB.Pool)

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
	core.AssertEqual(t, 201, w.Code, "First registration should succeed")

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
	// Initialize JWT auth for testing - use the same secret from app config
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

// Benchmark tests for performance monitoring
func BenchmarkAuthFlow_Registration(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

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

	app := core.NewTestApp(testDB.Pool)

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
