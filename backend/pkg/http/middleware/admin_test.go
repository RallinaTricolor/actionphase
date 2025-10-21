package middleware

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRequireAdmin tests the admin middleware
func TestRequireAdmin(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	userService := &db.UserService{DB: testDB.Pool}

	// Create test users
	adminUser := &core.User{
		Username: "admin",
		Password: "adminpass123",
		Email:    "admin@example.com",
	}
	createdAdmin, err := userService.CreateUser(adminUser)
	require.NoError(t, err)

	// Make them admin via direct SQL update
	ctx := context.Background()
	_, err = testDB.Pool.Exec(ctx, "UPDATE users SET is_admin = TRUE WHERE id = $1", createdAdmin.ID)
	require.NoError(t, err)

	regularUser := &core.User{
		Username: "regular",
		Password: "regularpass123",
		Email:    "regular@example.com",
	}
	createdRegular, err := userService.CreateUser(regularUser)
	require.NoError(t, err)

	// Create JWT tokens for both users
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	jwtHandler := &JWTHandler{App: app}

	adminToken, err := jwtHandler.CreateToken(createdAdmin)
	require.NoError(t, err)

	regularToken, err := jwtHandler.CreateToken(createdRegular)
	require.NoError(t, err)

	tests := []struct {
		name           string
		token          string
		expectedStatus int
		description    string
	}{
		{
			name:           "admin_user_passes",
			token:          adminToken,
			expectedStatus: http.StatusOK,
			description:    "Admin user should be allowed access",
		},
		{
			name:           "regular_user_blocked",
			token:          regularToken,
			expectedStatus: http.StatusForbidden,
			description:    "Regular user should be denied access",
		},
		{
			name:           "no_token_blocked",
			token:          "",
			expectedStatus: http.StatusUnauthorized,
			description:    "Request without token should be denied",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create test handler that would be protected by admin middleware
			testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("admin access granted"))
			})

			// Setup router with middleware
			r := chi.NewRouter()
			r.Group(func(r chi.Router) {
				r.Use(jwtauth.Verifier(tokenAuth))
				if tc.token != "" {
					// If we're testing with a token, require authentication
					r.Use(jwtauth.Authenticator(tokenAuth))
				}
				r.Use(RequireAdmin(app))
				r.Get("/admin/test", testHandler)
			})

			// Create request
			req := httptest.NewRequest("GET", "/admin/test", nil)
			if tc.token != "" {
				req.Header.Set("Authorization", "Bearer "+tc.token)
			}

			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			assert.Equal(t, tc.expectedStatus, w.Code, tc.description)

			// Verify response body for success
			if tc.expectedStatus == http.StatusOK {
				assert.Contains(t, w.Body.String(), "admin access granted")
			}
		})
	}
}

// TestRequireAdmin_UserNotFound tests middleware behavior when user doesn't exist in DB
func TestRequireAdmin_UserNotFound(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)

	// Create a JWT token with a username that doesn't exist in DB
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	_, tokenString, _ := tokenAuth.Encode(map[string]interface{}{
		"username": "nonexistent",
	})

	// Create test handler
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Setup router with middleware
	r := chi.NewRouter()
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth))
		r.Use(jwtauth.Authenticator(tokenAuth))
		r.Use(RequireAdmin(app))
		r.Get("/admin/test", testHandler)
	})

	// Create request
	req := httptest.NewRequest("GET", "/admin/test", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code, "Non-existent user should be denied")
}

// JWTHandler is a minimal version for testing
type JWTHandler struct {
	App *core.App
}

func (j *JWTHandler) CreateToken(user *core.User) (string, error) {
	tokenAuth := jwtauth.New("HS256", []byte(j.App.Config.JWT.Secret), nil)
	_, tokenString, err := tokenAuth.Encode(map[string]interface{}{
		"username": user.Username,
	})
	return tokenString, err
}
