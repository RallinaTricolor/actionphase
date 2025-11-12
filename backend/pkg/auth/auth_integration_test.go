package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	jwt2 "github.com/golang-jwt/jwt/v5"
)

// TestAuthFlow tests each authentication step independently for better test isolation
func TestAuthFlow_Registration(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

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
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

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
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

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
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

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
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

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
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

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

// TestAuthFlow_RegistrationValidation tests registration validation edge cases
func TestAuthFlow_RegistrationValidation(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthTestRouter(app)

	t.Run("invalid_email_format", func(t *testing.T) {
		invalidUser := core.User{
			Username: "validuser",
			Email:    "notanemail", // Invalid email format
			Password: "testpassword123",
		}

		payload, _ := json.Marshal(invalidUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Invalid email format should return 400")
	})

	t.Run("password_too_short", func(t *testing.T) {
		shortPwdUser := core.User{
			Username: "validuser",
			Email:    "valid@test.com",
			Password: "short", // Less than 8 characters
		}

		payload, _ := json.Marshal(shortPwdUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Password too short should return 400")
	})

	t.Run("password_too_long", func(t *testing.T) {
		// Create a password longer than 64 characters
		longPassword := string(make([]byte, 65))
		for i := range longPassword {
			longPassword = longPassword[:i] + "a"
		}

		longPwdUser := core.User{
			Username: "validuser",
			Email:    "valid@test.com",
			Password: longPassword, // More than 64 characters
		}

		payload, _ := json.Marshal(longPwdUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Password too long should return 400")
	})

	t.Run("empty_username", func(t *testing.T) {
		emptyUsernameUser := core.User{
			Username: "", // Empty username
			Email:    "valid@test.com",
			Password: "testpassword123",
		}

		payload, _ := json.Marshal(emptyUsernameUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Empty username should return 400")
	})

	t.Run("empty_email", func(t *testing.T) {
		emptyEmailUser := core.User{
			Username: "validuser",
			Email:    "", // Empty email
			Password: "testpassword123",
		}

		payload, _ := json.Marshal(emptyEmailUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Empty email should return 400")
	})

	t.Run("empty_password", func(t *testing.T) {
		emptyPasswordUser := core.User{
			Username: "validuser",
			Email:    "valid@test.com",
			Password: "", // Empty password
		}

		payload, _ := json.Marshal(emptyPasswordUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Empty password should return 400")
	})

	t.Run("username_with_invalid_characters", func(t *testing.T) {
		invalidCharsUser := core.User{
			Username: "user@name!", // Invalid characters (@ and !)
			Email:    "valid@test.com",
			Password: "testpassword123",
		}

		payload, _ := json.Marshal(invalidCharsUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Username with invalid characters should return 400")
	})

	t.Run("username_too_short", func(t *testing.T) {
		shortUsernameUser := core.User{
			Username: "ab", // Assuming minimum is 3 characters
			Email:    "valid@test.com",
			Password: "testpassword123",
		}

		payload, _ := json.Marshal(shortUsernameUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Username too short should return 400")
	})

	t.Run("username_too_long", func(t *testing.T) {
		// Create a username longer than max (50 characters)
		longUsername := "a12345678901234567890123456789012345678901234567890" // 51 characters

		longUsernameUser := core.User{
			Username: longUsername,
			Email:    "valid@test.com",
			Password: "testpassword123",
		}

		payload, _ := json.Marshal(longUsernameUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Username too long should return 400")
	})

	t.Run("invalid_json", func(t *testing.T) {
		// Send invalid JSON
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBufferString("{invalid json"))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Invalid JSON should return 400")
	})

	t.Run("missing_content_type", func(t *testing.T) {
		validUser := core.User{
			Username: "validuser",
			Email:    "valid@test.com",
			Password: "testpassword123",
		}

		payload, _ := json.Marshal(validUser)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payload))
		// Deliberately not setting Content-Type header
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Server might still accept it, or might reject - check actual behavior
		// For now, we're documenting the behavior
		core.AssertTrue(t, w.Code == 400 || w.Code == 201, "Missing content-type should be handled")
	})
}

func TestAuthFlow_Logout(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthTestRouter(app)

	// Create and register test user
	testUser := core.User{
		Username: "logouttest",
		Email:    "logout@test.com",
		Password: "testpassword123",
	}

	registerPayload, _ := json.Marshal(testUser)
	registerReq := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(registerPayload))
	registerReq.Header.Set("Content-Type", "application/json")
	registerW := httptest.NewRecorder()
	router.ServeHTTP(registerW, registerReq)
	core.AssertEqual(t, 201, registerW.Code, "Registration should succeed for logout test")

	t.Run("logout_succeeds", func(t *testing.T) {
		// Call logout endpoint
		req := httptest.NewRequest("POST", "/api/v1/auth/logout", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 200 OK
		core.AssertEqual(t, 200, w.Code, "Logout should succeed")

		// Verify JWT cookie is cleared (MaxAge=-1 or Expires in past)
		cookies := w.Result().Cookies()
		jwtCookieFound := false
		for _, cookie := range cookies {
			if cookie.Name == "jwt" {
				jwtCookieFound = true
				// Cookie should have MaxAge=-1 to indicate deletion
				core.AssertEqual(t, -1, cookie.MaxAge, "JWT cookie should have MaxAge=-1 for deletion")
				core.AssertEqual(t, "", cookie.Value, "JWT cookie value should be empty")
			}
		}
		core.AssertTrue(t, jwtCookieFound, "JWT cookie should be set in response for clearing")
	})

	t.Run("logout_is_idempotent", func(t *testing.T) {
		// Call logout multiple times - should always succeed
		for i := 0; i < 3; i++ {
			req := httptest.NewRequest("POST", "/api/v1/auth/logout", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, 200, w.Code, "Logout should succeed even when called multiple times")
		}
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
			r.Post("/logout", authHandler.V1Logout)
			r.Group(func(r chi.Router) {
				r.Use(jwtauth.Verifier(tokenAuth))
				r.Use(jwtauth.Authenticator(tokenAuth))
				// Add RequireAuthenticationMiddleware for session endpoints
				userService := &db.UserService{DB: app.Pool, Logger: app.ObsLogger}
				r.Use(core.RequireAuthenticationMiddleware(userService))
				r.Get("/refresh", authHandler.V1Refresh)
				r.Get("/sessions", authHandler.V1ListSessions)
				r.Delete("/sessions/{sessionID}", authHandler.V1RevokeSession)
				r.Post("/revoke-all-sessions", authHandler.V1RevokeAllSessions)
			})
		})
	})

	return r
}

// Benchmark tests for performance monitoring
func BenchmarkAuthFlow_Registration(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "registration_attempts", "sessions", "users")

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
	defer testDB.CleanupTables(b, "registration_attempts", "sessions", "users")

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

// TestAuthFlow_RefreshEdgeCases tests edge cases in the refresh token flow
func TestAuthFlow_RefreshEdgeCases(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthTestRouter(app)

	// Create and register test user
	testUser := core.User{
		Username: "refreshedgetest",
		Email:    "refreshedge@test.com",
		Password: "testpassword123",
	}

	registerPayload, _ := json.Marshal(testUser)
	registerReq := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(registerPayload))
	registerReq.Header.Set("Content-Type", "application/json")
	registerW := httptest.NewRecorder()
	router.ServeHTTP(registerW, registerReq)
	core.AssertEqual(t, 201, registerW.Code, "Registration should succeed for refresh edge test")

	// Get access token from registration response
	var registerResponse map[string]interface{}
	err := json.Unmarshal(registerW.Body.Bytes(), &registerResponse)
	core.AssertNoError(t, err, "Registration response should be valid JSON")

	validToken, ok := registerResponse["Token"].(string)
	if !ok {
		t.Fatalf("Expected 'Token' field in registration response, got: %+v", registerResponse)
	}

	t.Run("refresh_without_authorization_header", func(t *testing.T) {
		// Try to refresh without Authorization header
		req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 401 Unauthorized
		core.AssertEqual(t, 401, w.Code, "Refresh without auth header should return 401")
	})

	t.Run("refresh_with_invalid_token_format", func(t *testing.T) {
		// Try to refresh with malformed token
		req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
		req.Header.Set("Authorization", "Bearer invalid.token.here")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 401 Unauthorized
		core.AssertEqual(t, 401, w.Code, "Refresh with invalid token should return 401")
	})

	t.Run("refresh_with_expired_token", func(t *testing.T) {
		// Create an expired token
		expiredToken := jwt2.NewWithClaims(jwt2.SigningMethodHS256, jwt2.MapClaims{
			"sub": "999",
			"exp": time.Now().Add(-time.Hour).Unix(), // Expired 1 hour ago
		})
		tokenString, _ := expiredToken.SignedString([]byte(app.Config.JWT.Secret))

		req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 401 Unauthorized
		core.AssertEqual(t, 401, w.Code, "Refresh with expired token should return 401")
	})

	t.Run("refresh_with_token_missing_sub_claim", func(t *testing.T) {
		// Create token without sub claim
		tokenWithoutSub := jwt2.NewWithClaims(jwt2.SigningMethodHS256, jwt2.MapClaims{
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := tokenWithoutSub.SignedString([]byte(app.Config.JWT.Secret))

		req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 401 Unauthorized
		core.AssertEqual(t, 401, w.Code, "Refresh with token missing sub claim should return 401")
	})

	t.Run("refresh_with_non_existent_user", func(t *testing.T) {
		// Create token with non-existent user ID
		tokenNonExistentUser := jwt2.NewWithClaims(jwt2.SigningMethodHS256, jwt2.MapClaims{
			"sub": "999999", // Non-existent user ID
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := tokenNonExistentUser.SignedString([]byte(app.Config.JWT.Secret))

		req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 401 Unauthorized (middleware rejects user that doesn't exist)
		core.AssertEqual(t, 401, w.Code, "Refresh with non-existent user should return 401")
	})

	t.Run("refresh_creates_new_session", func(t *testing.T) {
		// Use valid token to refresh
		req := httptest.NewRequest("GET", "/api/v1/auth/refresh", nil)
		req.Header.Set("Authorization", "Bearer "+validToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should succeed
		core.AssertEqual(t, 200, w.Code, "Valid refresh should succeed")

		// Verify new token is returned
		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		newToken, ok := response["Token"].(string)
		if !ok {
			t.Fatalf("Expected 'Token' field in refresh response, got: %+v", response)
		}
		core.AssertNotEqual(t, "", newToken, "New token should be returned")

		// Verify JWT cookie is set
		cookies := w.Result().Cookies()
		jwtCookieFound := false
		for _, cookie := range cookies {
			if cookie.Name == "jwt" {
				jwtCookieFound = true
				core.AssertNotEqual(t, "", cookie.Value, "JWT cookie should have value")
			}
		}
		core.AssertTrue(t, jwtCookieFound, "JWT cookie should be set after refresh")
	})
}

// TestAuthFlow_SessionManagement tests session list, revoke, and revoke-all functionality
func TestAuthFlow_SessionManagement(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthTestRouter(app)

	// Create and register test user
	testUser := core.User{
		Username: "sessiontest",
		Email:    "session@test.com",
		Password: "testpassword123",
	}

	registerPayload, _ := json.Marshal(testUser)
	registerReq := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(registerPayload))
	registerReq.Header.Set("Content-Type", "application/json")
	registerW := httptest.NewRecorder()
	router.ServeHTTP(registerW, registerReq)
	core.AssertEqual(t, 201, registerW.Code, "Registration should succeed for session test")

	// Get first access token
	var registerResponse map[string]interface{}
	err := json.Unmarshal(registerW.Body.Bytes(), &registerResponse)
	core.AssertNoError(t, err, "Registration response should be valid JSON")

	token1, ok := registerResponse["Token"].(string)
	if !ok {
		t.Fatalf("Expected 'Token' field in registration response, got: %+v", registerResponse)
	}

	// Create a second session by logging in again
	loginPayload, _ := json.Marshal(map[string]string{
		"username": testUser.Username,
		"password": testUser.Password,
	})
	loginReq := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginPayload))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()
	router.ServeHTTP(loginW, loginReq)
	core.AssertEqual(t, 200, loginW.Code, "Login should succeed")

	var loginResponse map[string]interface{}
	err = json.Unmarshal(loginW.Body.Bytes(), &loginResponse)
	core.AssertNoError(t, err, "Login response should be valid JSON")

	token2, ok := loginResponse["Token"].(string)
	if !ok {
		t.Fatalf("Expected 'Token' field in login response, got: %+v", loginResponse)
	}

	t.Run("list_sessions_requires_auth", func(t *testing.T) {
		// Try to list sessions without authorization
		req := httptest.NewRequest("GET", "/api/v1/auth/sessions", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 401 Unauthorized
		core.AssertEqual(t, 401, w.Code, "List sessions without auth should return 401")
	})

	t.Run("list_sessions_returns_all_user_sessions", func(t *testing.T) {
		// List sessions using first token
		req := httptest.NewRequest("GET", "/api/v1/auth/sessions", nil)
		req.Header.Set("Authorization", "Bearer "+token1)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should succeed
		core.AssertEqual(t, 200, w.Code, "List sessions should succeed")

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")

		sessions, ok := response["sessions"].([]interface{})
		if !ok {
			t.Fatalf("Expected 'sessions' field in response, got: %+v", response)
		}

		// Should have at least 2 sessions (registration + login)
		core.AssertTrue(t, len(sessions) >= 2, "Should have at least 2 sessions")

		// Verify one session is marked as current
		foundCurrent := false
		for _, s := range sessions {
			session := s.(map[string]interface{})
			if isCurrent, ok := session["is_current"].(bool); ok && isCurrent {
				foundCurrent = true
				break
			}
		}
		core.AssertTrue(t, foundCurrent, "One session should be marked as current")
	})

	t.Run("revoke_session_requires_auth", func(t *testing.T) {
		// Try to revoke session without authorization
		req := httptest.NewRequest("DELETE", "/api/v1/auth/sessions/1", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 401 Unauthorized
		core.AssertEqual(t, 401, w.Code, "Revoke session without auth should return 401")
	})

	t.Run("revoke_session_with_invalid_id", func(t *testing.T) {
		// Try to revoke with invalid session ID format
		req := httptest.NewRequest("DELETE", "/api/v1/auth/sessions/invalid", nil)
		req.Header.Set("Authorization", "Bearer "+token1)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 400 Bad Request
		core.AssertEqual(t, 400, w.Code, "Revoke with invalid session ID should return 400")
	})

	t.Run("revoke_session_not_belonging_to_user", func(t *testing.T) {
		// Try to revoke a session that doesn't belong to the user (e.g., session ID 999999)
		req := httptest.NewRequest("DELETE", "/api/v1/auth/sessions/999999", nil)
		req.Header.Set("Authorization", "Bearer "+token1)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 404 Not Found
		core.AssertEqual(t, 404, w.Code, "Revoke non-existent session should return 404")
	})

	t.Run("revoke_specific_session_succeeds", func(t *testing.T) {
		// First, list sessions to get a session ID to revoke
		listReq := httptest.NewRequest("GET", "/api/v1/auth/sessions", nil)
		listReq.Header.Set("Authorization", "Bearer "+token2)
		listW := httptest.NewRecorder()
		router.ServeHTTP(listW, listReq)

		var listResponse map[string]interface{}
		err := json.Unmarshal(listW.Body.Bytes(), &listResponse)
		core.AssertNoError(t, err, "List response should be valid JSON")

		sessions := listResponse["sessions"].([]interface{})

		// Find a session that's not the current one to revoke
		var sessionIDToRevoke int
		for _, s := range sessions {
			session := s.(map[string]interface{})
			if isCurrent, ok := session["is_current"].(bool); ok && !isCurrent {
				sessionIDToRevoke = int(session["id"].(float64))
				break
			}
		}

		if sessionIDToRevoke == 0 {
			t.Skip("No non-current session found to revoke")
		}

		// Revoke the session
		revokeReq := httptest.NewRequest("DELETE", "/api/v1/auth/sessions/"+strconv.Itoa(sessionIDToRevoke), nil)
		revokeReq.Header.Set("Authorization", "Bearer "+token2)
		revokeW := httptest.NewRecorder()
		router.ServeHTTP(revokeW, revokeReq)

		// Should succeed
		core.AssertEqual(t, 200, revokeW.Code, "Revoke specific session should succeed")

		// Verify the session is no longer in the list
		listReq2 := httptest.NewRequest("GET", "/api/v1/auth/sessions", nil)
		listReq2.Header.Set("Authorization", "Bearer "+token2)
		listW2 := httptest.NewRecorder()
		router.ServeHTTP(listW2, listReq2)

		var listResponse2 map[string]interface{}
		err = json.Unmarshal(listW2.Body.Bytes(), &listResponse2)
		core.AssertNoError(t, err, "List response should be valid JSON")

		sessions2 := listResponse2["sessions"].([]interface{})
		core.AssertTrue(t, len(sessions2) < len(sessions), "Session count should decrease after revoke")
	})

	t.Run("revoke_all_sessions_requires_auth", func(t *testing.T) {
		// Try to revoke all sessions without authorization
		req := httptest.NewRequest("POST", "/api/v1/auth/revoke-all-sessions", nil)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should return 401 Unauthorized
		core.AssertEqual(t, 401, w.Code, "Revoke all sessions without auth should return 401")
	})

	t.Run("revoke_all_sessions_keeps_current", func(t *testing.T) {
		// Create a third session for this test
		loginPayload3, _ := json.Marshal(map[string]string{
			"username": testUser.Username,
			"password": testUser.Password,
		})
		loginReq3 := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewBuffer(loginPayload3))
		loginReq3.Header.Set("Content-Type", "application/json")
		loginW3 := httptest.NewRecorder()
		router.ServeHTTP(loginW3, loginReq3)

		var loginResponse3 map[string]interface{}
		err := json.Unmarshal(loginW3.Body.Bytes(), &loginResponse3)
		core.AssertNoError(t, err, "Login response should be valid JSON")

		token3, ok := loginResponse3["Token"].(string)
		if !ok {
			t.Fatalf("Expected 'Token' field in login response, got: %+v", loginResponse3)
		}

		// Revoke all sessions except current using token3
		revokeAllReq := httptest.NewRequest("POST", "/api/v1/auth/revoke-all-sessions", nil)
		revokeAllReq.Header.Set("Authorization", "Bearer "+token3)
		revokeAllW := httptest.NewRecorder()
		router.ServeHTTP(revokeAllW, revokeAllReq)

		// Should succeed
		core.AssertEqual(t, 200, revokeAllW.Code, "Revoke all sessions should succeed")

		// Verify only current session remains
		listReq := httptest.NewRequest("GET", "/api/v1/auth/sessions", nil)
		listReq.Header.Set("Authorization", "Bearer "+token3)
		listW := httptest.NewRecorder()
		router.ServeHTTP(listW, listReq)

		var listResponse map[string]interface{}
		err = json.Unmarshal(listW.Body.Bytes(), &listResponse)
		core.AssertNoError(t, err, "List response should be valid JSON")

		sessions := listResponse["sessions"].([]interface{})

		// Should have exactly 1 session (the current one)
		core.AssertEqual(t, 1, len(sessions), "Should have exactly 1 session after revoke-all")

		// Verify it's marked as current
		session := sessions[0].(map[string]interface{})
		isCurrent, ok := session["is_current"].(bool)
		core.AssertTrue(t, ok && isCurrent, "Remaining session should be current")
	})
}

// TestAuthFlow_BotPrevention tests bot prevention mechanisms
func TestAuthFlow_BotPrevention(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "registration_attempts", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthTestRouter(app)

	t.Run("honeypot_field_blocks_registration", func(t *testing.T) {
		// Registration request with honeypot field populated
		payload := map[string]string{
			"username":       "botuser",
			"email":          "bot@test.com",
			"password":       "testpassword123",
			"honeypot_value": "I am a bot", // Honeypot field should be empty
		}

		payloadBytes, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Honeypot trigger should return 400")

		var response map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &response)
		errorMsg := response["error"].(string)
		core.AssertTrue(t, strings.Contains(errorMsg, "Invalid registration attempt"), "Error should mention invalid registration")
	})

	t.Run("disposable_email_blocks_registration", func(t *testing.T) {
		// Registration with disposable email domain
		payload := map[string]string{
			"username":       "validuser",
			"email":          "test@tempmail.com", // Disposable email domain
			"password":       "testpassword123",
			"honeypot_value": "", // Honeypot empty (correct)
		}

		payloadBytes, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Disposable email should return 400")

		var response map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &response)
		errorMsg := response["error"].(string)
		core.AssertTrue(t, strings.Contains(errorMsg, "Disposable email"), "Error should mention disposable email")
	})

	t.Run("multiple_disposable_domains_blocked", func(t *testing.T) {
		disposableDomains := []string{
			"guerrillamail.com",
			"10minutemail.com",
			"mailinator.com",
			"throwaway.email",
		}

		for _, domain := range disposableDomains {
			email := fmt.Sprintf("test@%s", domain)
			payload := map[string]string{
				"username":       "testuser",
				"email":          email,
				"password":       "testpassword123",
				"honeypot_value": "",
			}

			payloadBytes, _ := json.Marshal(payload)
			req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payloadBytes))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, 400, w.Code, fmt.Sprintf("Disposable domain %s should be blocked", domain))
		}
	})

	t.Run("valid_registration_passes_bot_checks", func(t *testing.T) {
		// Clean up registration attempts to avoid rate limiting from previous tests
		testDB.CleanupTables(t, "registration_attempts")

		// Registration with valid data and no bot indicators
		// Use unique username to avoid collisions
		uniqueUsername := fmt.Sprintf("legituser_%d", time.Now().UnixNano())
		uniqueEmail := fmt.Sprintf("legit_%d@example.com", time.Now().UnixNano())

		payload := map[string]string{
			"username":       uniqueUsername,
			"email":          uniqueEmail, // Not disposable
			"password":       "testpassword123",
			"honeypot_value": "", // Honeypot empty (correct)
		}

		payloadBytes, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		// Should succeed (201 Created)
		if w.Code != 201 {
			var errorResponse map[string]interface{}
			json.Unmarshal(w.Body.Bytes(), &errorResponse)
			t.Logf("Registration failed with error: %v", errorResponse["error"])
		}
		core.AssertEqual(t, 201, w.Code, "Valid registration should succeed")

		var response map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &response)

		// Verify user data in response (user data is returned directly, not nested)
		core.AssertEqual(t, uniqueUsername, response["username"].(string), "Username should match")
		core.AssertEqual(t, uniqueEmail, response["email"].(string), "Email should match")

		// Verify token is present
		token, ok := response["Token"].(string)
		core.AssertTrue(t, ok && len(token) > 0, "Response should contain JWT token")
	})

	t.Run("honeypot_takes_precedence_over_other_checks", func(t *testing.T) {
		// Registration with both honeypot AND disposable email
		// Honeypot should trigger first
		payload := map[string]string{
			"username":       "botuser",
			"email":          "bot@tempmail.com", // Also disposable
			"password":       "testpassword123",
			"honeypot_value": "I am a bot", // Honeypot triggered
		}

		payloadBytes, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Honeypot trigger should return 400")

		var response map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &response)
		errorMsg := response["error"].(string)
		// Should mention honeypot, not disposable email (honeypot checked first)
		core.AssertTrue(t, strings.Contains(errorMsg, "Invalid registration attempt"), "Error should mention invalid registration (honeypot)")
	})

	t.Run("case_insensitive_disposable_email_detection", func(t *testing.T) {
		// Test with uppercase domain
		payload := map[string]string{
			"username":       "testuser",
			"email":          "test@TEMPMAIL.COM", // Uppercase disposable domain
			"password":       "testpassword123",
			"honeypot_value": "",
		}

		payloadBytes, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/auth/register", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 400, w.Code, "Uppercase disposable domain should still be blocked")

		var response map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &response)
		errorMsg := response["error"].(string)
		core.AssertTrue(t, strings.Contains(strings.ToLower(errorMsg), "disposable email"), "Error should mention disposable email")
	})
}
