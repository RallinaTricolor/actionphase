package auth

import (
	"actionphase/pkg/core"
	"actionphase/pkg/email"
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	db "actionphase/pkg/db/models"
	"github.com/go-chi/jwtauth/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// RevokeSessionRequest represents a request to revoke a session
type RevokeSessionRequest struct {
	SessionID int32 `json:"session_id"`
}

func TestV1VerifyEmail(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	pool := setupTestDB(t)
	defer pool.Close()

	app := &core.App{
		Pool:   pool,
		Logger: *slog.Default(),
	}

	handler := Handler{App: app}
	queries := db.New(pool)
	ctx := context.Background()

	tests := []struct {
		name           string
		setupUser      func() int32
		setupToken     func(userID int32) string
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful email verification",
			setupUser: func() int32 {
				return createTestUser(t, pool, "verify1@test.com", "verifyuser1", "TestPass123!")
			},
			setupToken: func(userID int32) string {
				token, _ := GenerateSecureToken(64)
				expiresAt := time.Now().Add(24 * time.Hour)
				verifyToken, _ := queries.CreateEmailVerificationToken(ctx, db.CreateEmailVerificationTokenParams{
					UserID:    userID,
					Email:     "verify1@test.com",
					Token:     token,
					ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
				})
				return verifyToken.Token
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "invalid token",
			setupUser: func() int32 {
				return createTestUser(t, pool, "verify2@test.com", "verifyuser2", "TestPass123!")
			},
			setupToken: func(userID int32) string {
				return "invalid-token-12345"
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid or expired verification token",
		},
		{
			name: "expired token",
			setupUser: func() int32 {
				return createTestUser(t, pool, "verify3@test.com", "verifyuser3", "TestPass123!")
			},
			setupToken: func(userID int32) string {
				token, _ := GenerateSecureToken(64)
				expiresAt := time.Now().Add(-1 * time.Hour) // Expired
				verifyToken, _ := queries.CreateEmailVerificationToken(ctx, db.CreateEmailVerificationTokenParams{
					UserID:    userID,
					Email:     "verify3@test.com",
					Token:     token,
					ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
				})
				return verifyToken.Token
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid or expired verification token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userID := tt.setupUser()
			token := tt.setupToken(userID)

			requestBody := VerifyEmailRequest{
				Token: token,
			}

			bodyBytes, err := json.Marshal(requestBody)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/auth/verify-email", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")

			w := httptest.NewRecorder()
			handler.V1VerifyEmail(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				assert.Contains(t, response["error"], tt.expectedError)
			}

			// Cleanup
			if userID > 0 {
				_ = queries.DeleteUser(ctx, userID)
			}
		})
	}
}

func TestV1ChangeUsername(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	pool := setupTestDB(t)
	defer pool.Close()

	app := &core.App{
		Pool:   pool,
		Logger: *slog.Default(),
	}

	handler := Handler{App: app}
	queries := db.New(pool)
	ctx := context.Background()

	tests := []struct {
		name           string
		setupUser      func() int32
		newUsername    string
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful username change",
			setupUser: func() int32 {
				return createTestUser(t, pool, "username1@test.com", "oldusername1", "TestPass123!")
			},
			newUsername:    "newusername1",
			expectedStatus: http.StatusOK,
		},
		{
			name: "username too short",
			setupUser: func() int32 {
				return createTestUser(t, pool, "username2@test.com", "oldusername2", "TestPass123!")
			},
			newUsername:    "ab",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "username must be at least 3 characters long",
		},
		{
			name: "username already taken",
			setupUser: func() int32 {
				// Create two users
				_ = createTestUser(t, pool, "existing@test.com", "existinguser", "TestPass123!")
				return createTestUser(t, pool, "username3@test.com", "oldusername3", "TestPass123!")
			},
			newUsername:    "existinguser",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "username is already taken",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userID := tt.setupUser()
			token := generateTestJWT(t, int(userID))

			requestBody := ChangeUsernameRequest{
				NewUsername: tt.newUsername,
			}

			bodyBytes, err := json.Marshal(requestBody)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/auth/change-username", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")

			// Add JWT token to context
			tokenAuth := jwtauth.New("HS256", []byte("test-secret"), nil)
			jwtToken, err := jwtauth.VerifyToken(tokenAuth, token)
			require.NoError(t, err)

			reqCtx := jwtauth.NewContext(req.Context(), jwtToken, nil)
			req = req.WithContext(reqCtx)

			w := httptest.NewRecorder()
			handler.V1ChangeUsername(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				assert.Contains(t, response["error"], tt.expectedError)
			}

			// Cleanup - delete all test users
			_ = queries.DeleteUser(ctx, userID)
			// Clean up the existing user if created
			if tt.name == "username already taken" {
				rows, _ := pool.Query(ctx, "SELECT id FROM users WHERE username = 'existinguser'")
				if rows.Next() {
					var existingUserID int32
					rows.Scan(&existingUserID)
					_ = queries.DeleteUser(ctx, existingUserID)
				}
				rows.Close()
			}
		})
	}
}

func TestV1RequestEmailChange(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	pool := setupTestDB(t)
	defer pool.Close()

	app := &core.App{
		Pool:   pool,
		Logger: *slog.Default(),
	}

	handler := Handler{App: app}
	queries := db.New(pool)
	ctx := context.Background()

	tests := []struct {
		name           string
		setupUser      func() int32
		newEmail       string
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful email change request",
			setupUser: func() int32 {
				return createTestUser(t, pool, "oldemail1@test.com", "emailuser1", "TestPass123!")
			},
			newEmail:       "newemail1@test.com",
			expectedStatus: http.StatusOK,
		},
		{
			name: "invalid email format",
			setupUser: func() int32 {
				return createTestUser(t, pool, "oldemail2@test.com", "emailuser2", "TestPass123!")
			},
			newEmail:       "not-an-email",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "invalid email format",
		},
		{
			name: "email already in use",
			setupUser: func() int32 {
				// Create two users
				_ = createTestUser(t, pool, "existing@test.com", "existinguser", "TestPass123!")
				return createTestUser(t, pool, "oldemail3@test.com", "emailuser3", "TestPass123!")
			},
			newEmail:       "existing@test.com",
			expectedStatus: http.StatusBadRequest,
			expectedError:  "email is already in use",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userID := tt.setupUser()
			token := generateTestJWT(t, int(userID))

			requestBody := ChangeEmailRequest{
				NewEmail: tt.newEmail,
			}

			bodyBytes, err := json.Marshal(requestBody)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/auth/request-email-change", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")

			// Add JWT token to context
			tokenAuth := jwtauth.New("HS256", []byte("test-secret"), nil)
			jwtToken, err := jwtauth.VerifyToken(tokenAuth, token)
			require.NoError(t, err)

			reqCtx := jwtauth.NewContext(req.Context(), jwtToken, nil)
			req = req.WithContext(reqCtx)

			w := httptest.NewRecorder()
			handler.V1RequestEmailChange(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				assert.Contains(t, response["error"], tt.expectedError)
			}

			// Cleanup
			_ = queries.DeleteUser(ctx, userID)
			// Clean up the existing user if created
			if tt.name == "email already in use" {
				rows, _ := pool.Query(ctx, "SELECT id FROM users WHERE email = 'existing@test.com'")
				if rows.Next() {
					var existingUserID int32
					rows.Scan(&existingUserID)
					_ = queries.DeleteUser(ctx, existingUserID)
				}
				rows.Close()
			}
		})
	}
}

func TestAccountService_CleanupExpiredVerificationTokens(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	pool := setupTestDB(t)
	defer pool.Close()

	queries := db.New(pool)
	ctx := context.Background()

	// Create test user
	userID := createTestUser(t, pool, "cleanup@test.com", "cleanupuser", "TestPass123!")
	defer queries.DeleteUser(ctx, userID)

	// Create expired token
	expiredToken, _ := GenerateSecureToken(64)
	expiresAt := time.Now().Add(-2 * time.Hour) // 2 hours ago
	_, err := queries.CreateEmailVerificationToken(ctx, db.CreateEmailVerificationTokenParams{
		UserID:    userID,
		Email:     "cleanup@test.com",
		Token:     expiredToken,
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
	require.NoError(t, err)

	// Create valid token
	validToken, _ := GenerateSecureToken(64)
	validExpiresAt := time.Now().Add(24 * time.Hour)
	_, err = queries.CreateEmailVerificationToken(ctx, db.CreateEmailVerificationTokenParams{
		UserID:    userID,
		Email:     "cleanup@test.com",
		Token:     validToken,
		ExpiresAt: pgtype.Timestamptz{Time: validExpiresAt, Valid: true},
	})
	require.NoError(t, err)

	// Create account service
	emailService, _ := email.NewEmailServiceFromEnv()
	accountService := &AccountService{
		DB:           pool,
		EmailService: emailService,
	}

	// Cleanup expired tokens
	err = accountService.CleanupExpiredVerificationTokens(ctx)
	require.NoError(t, err)

	// Verify expired token was deleted
	_, err = queries.GetEmailVerificationToken(ctx, expiredToken)
	assert.Error(t, err, "Expired token should be deleted")

	// Verify valid token still exists
	validVerifyToken, err := queries.GetEmailVerificationToken(ctx, validToken)
	require.NoError(t, err)
	assert.Equal(t, validToken, validVerifyToken.Token)
}

func TestV1DeleteAccount(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	pool := setupTestDB(t)
	defer pool.Close()

	app := &core.App{
		Pool:   pool,
		Logger: *slog.Default(),
	}

	handler := Handler{App: app}
	queries := db.New(pool)
	ctx := context.Background()

	tests := []struct {
		name           string
		setupUser      func() int32
		expectedStatus int
	}{
		{
			name: "successful account deletion",
			setupUser: func() int32 {
				return createTestUser(t, pool, "delete1@test.com", "deleteuser1", "TestPass123!")
			},
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userID := tt.setupUser()
			token := generateTestJWT(t, int(userID))

			req := httptest.NewRequest(http.MethodDelete, "/auth/account", nil)
			req.Header.Set("Content-Type", "application/json")

			// Add JWT token to context
			tokenAuth := jwtauth.New("HS256", []byte("test-secret"), nil)
			jwtToken, err := jwtauth.VerifyToken(tokenAuth, token)
			require.NoError(t, err)

			reqCtx := jwtauth.NewContext(req.Context(), jwtToken, nil)
			req = req.WithContext(reqCtx)

			w := httptest.NewRecorder()
			handler.V1DeleteAccount(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedStatus == http.StatusOK {
				// Verify user is marked as deleted
				user, err := queries.GetUser(ctx, userID)
				require.NoError(t, err)
				assert.True(t, user.DeletedAt.Valid, "User should be marked as deleted")
			}

			// Cleanup
			if userID > 0 {
				_ = queries.DeleteUser(ctx, userID)
			}
		})
	}
}

func TestV1ListSessions(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	pool := setupTestDB(t)
	defer pool.Close()

	app := &core.App{
		Pool:   pool,
		Logger: *slog.Default(),
	}

	handler := Handler{App: app}
	queries := db.New(pool)
	ctx := context.Background()

	// Create test user
	userID := createTestUser(t, pool, "sessions@test.com", "sessionuser", "TestPass123!")
	defer queries.DeleteUser(ctx, userID)

	// Create a session for the user
	expiresAt := time.Now().Add(24 * time.Hour)
	session, err := queries.CreateSession(ctx, db.CreateSessionParams{
		UserID:  userID,
		Data:    "test-session-token",
		Expires: pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
	require.NoError(t, err)
	defer queries.DeleteSession(ctx, session.ID)

	token := generateTestJWT(t, int(userID))

	req := httptest.NewRequest(http.MethodGet, "/auth/sessions", nil)

	// Add JWT token to context
	tokenAuth := jwtauth.New("HS256", []byte("test-secret"), nil)
	jwtToken, err := jwtauth.VerifyToken(tokenAuth, token)
	require.NoError(t, err)

	reqCtx := jwtauth.NewContext(req.Context(), jwtToken, nil)
	req = req.WithContext(reqCtx)

	w := httptest.NewRecorder()
	handler.V1ListSessions(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Decode response
	var sessions []db.Session
	err = json.Unmarshal(w.Body.Bytes(), &sessions)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(sessions), 1, "Should have at least one session")
}

func TestV1RevokeSession(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	pool := setupTestDB(t)
	defer pool.Close()

	app := &core.App{
		Pool:   pool,
		Logger: *slog.Default(),
	}

	handler := Handler{App: app}
	queries := db.New(pool)
	ctx := context.Background()

	tests := []struct {
		name           string
		setupUser      func() (int32, int32)
		sessionID      func(userID int32, sessionID int32) int32
		expectedStatus int
		expectedError  string
	}{
		{
			name: "successful session revocation",
			setupUser: func() (int32, int32) {
				userID := createTestUser(t, pool, "revoke1@test.com", "revokeuser1", "TestPass123!")
				expiresAt := time.Now().Add(24 * time.Hour)
				session, _ := queries.CreateSession(ctx, db.CreateSessionParams{
					UserID:  userID,
					Data:    "revoke-session-token",
					Expires: pgtype.Timestamptz{Time: expiresAt, Valid: true},
				})
				return userID, session.ID
			},
			sessionID: func(userID int32, sessionID int32) int32 {
				return sessionID
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "revoke non-existent session",
			setupUser: func() (int32, int32) {
				userID := createTestUser(t, pool, "revoke2@test.com", "revokeuser2", "TestPass123!")
				return userID, 99999
			},
			sessionID: func(userID int32, sessionID int32) int32 {
				return sessionID
			},
			expectedStatus: http.StatusBadRequest,
			expectedError:  "session not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userID, sessionID := tt.setupUser()
			token := generateTestJWT(t, int(userID))

			requestBody := RevokeSessionRequest{
				SessionID: tt.sessionID(userID, sessionID),
			}

			bodyBytes, err := json.Marshal(requestBody)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/auth/sessions/revoke", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")

			// Add JWT token to context
			tokenAuth := jwtauth.New("HS256", []byte("test-secret"), nil)
			jwtToken, err := jwtauth.VerifyToken(tokenAuth, token)
			require.NoError(t, err)

			reqCtx := jwtauth.NewContext(req.Context(), jwtToken, nil)
			req = req.WithContext(reqCtx)

			w := httptest.NewRecorder()
			handler.V1RevokeSession(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)

			if tt.expectedError != "" {
				var response map[string]interface{}
				err := json.Unmarshal(w.Body.Bytes(), &response)
				require.NoError(t, err)
				assert.Contains(t, response["error"], tt.expectedError)
			}

			// Cleanup
			if userID > 0 {
				_ = queries.DeleteUser(ctx, userID)
			}
		})
	}
}
