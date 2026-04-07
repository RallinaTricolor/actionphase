package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"actionphase/pkg/core"
	dbsvc "actionphase/pkg/db/services"
	messagesvc "actionphase/pkg/db/services/messages"
	httpmiddleware "actionphase/pkg/http/middleware"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupAdminTestRouter creates a test router with admin routes (with RequireAdmin middleware)
func setupAdminTestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &dbsvc.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	r := chi.NewRouter()
	r.Route("/api/v1/admin", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth))
		r.Use(jwtauth.Authenticator(tokenAuth))
		r.Use(core.RequireAuthenticationMiddleware(userService))
		r.Use(httpmiddleware.RequireAdmin(app))

		handler := &Handler{App: app}
		r.Get("/admins", handler.ListAdmins)
		r.Put("/users/{id}/admin", handler.GrantAdminStatus)
		r.Delete("/users/{id}/admin", handler.RevokeAdminStatus)
		r.Post("/users/{id}/ban", handler.BanUser)
		r.Delete("/users/{id}/ban", handler.UnbanUser)
		r.Get("/users/banned", handler.ListBannedUsers)
		r.Get("/users/lookup/{username}", handler.GetUserByUsername)
		r.Delete("/messages/{messageId}", handler.DeleteMessage)
	})

	return r
}

// TestAdminAPI_RequiresAdmin verifies that all admin endpoints reject non-admin users
func TestAdminAPI_RequiresAdmin(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAdminTestRouter(app, testDB)

	regularUser := testDB.CreateTestUser(t, "regular", "regular@example.com")
	token, err := core.CreateTestJWTTokenForUser(app, regularUser)
	require.NoError(t, err)

	endpoints := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/admin/admins"},
		{"PUT", fmt.Sprintf("/api/v1/admin/users/%d/admin", regularUser.ID)},
		{"DELETE", fmt.Sprintf("/api/v1/admin/users/%d/admin", regularUser.ID)},
		{"POST", fmt.Sprintf("/api/v1/admin/users/%d/ban", regularUser.ID)},
		{"DELETE", fmt.Sprintf("/api/v1/admin/users/%d/ban", regularUser.ID)},
		{"GET", "/api/v1/admin/users/banned"},
		{"GET", "/api/v1/admin/users/lookup/someuser"},
	}

	for _, e := range endpoints {
		t.Run(fmt.Sprintf("%s %s forbidden for non-admin", e.method, e.path), func(t *testing.T) {
			req := httptest.NewRequest(e.method, e.path, nil)
			req.Header.Set("Authorization", "Bearer "+token)

			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			assert.Equal(t, http.StatusForbidden, rec.Code, "non-admin should be rejected for %s %s", e.method, e.path)
		})
	}
}

// TestAdminAPI_ListAdmins tests GET /api/v1/admin/admins
func TestAdminAPI_ListAdmins(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAdminTestRouter(app, testDB)

	adminUser := testDB.CreateTestUser(t, "admin", "admin@example.com")
	// Make user admin directly in DB
	_, err := testDB.Pool.Exec(context.Background(), "UPDATE users SET is_admin = true WHERE id = $1", adminUser.ID)
	require.NoError(t, err)

	adminToken, err := core.CreateTestJWTTokenForUser(app, adminUser)
	require.NoError(t, err)

	t.Run("admin can list admins", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/admin/admins", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response []interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		require.GreaterOrEqual(t, len(response), 1, "should include the admin user")
		usernames := make([]string, 0, len(response))
		for _, item := range response {
			if u, ok := item.(map[string]interface{}); ok {
				if name, ok := u["username"].(string); ok {
					usernames = append(usernames, name)
				}
			}
		}
		assert.Contains(t, usernames, adminUser.Username, "admin user should appear in the list")
	})
}

// TestAdminAPI_GrantRevokeAdmin tests PUT/DELETE /api/v1/admin/users/{id}/admin
func TestAdminAPI_GrantRevokeAdmin(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAdminTestRouter(app, testDB)

	adminUser := testDB.CreateTestUser(t, "admin", "admin@example.com")
	targetUser := testDB.CreateTestUser(t, "target", "target@example.com")

	_, err := testDB.Pool.Exec(context.Background(), "UPDATE users SET is_admin = true WHERE id = $1", adminUser.ID)
	require.NoError(t, err)

	adminToken, err := core.CreateTestJWTTokenForUser(app, adminUser)
	require.NoError(t, err)

	t.Run("admin grants admin status to user", func(t *testing.T) {
		req := httptest.NewRequest("PUT", fmt.Sprintf("/api/v1/admin/users/%d/admin", targetUser.ID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		// Verify the user is now an admin
		var isAdmin bool
		err := testDB.Pool.QueryRow(context.Background(), "SELECT is_admin FROM users WHERE id = $1", targetUser.ID).Scan(&isAdmin)
		require.NoError(t, err)
		assert.True(t, isAdmin)
	})

	t.Run("admin revokes admin status from user", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/admin/users/%d/admin", targetUser.ID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		// Verify the user is no longer an admin
		var isAdmin bool
		err := testDB.Pool.QueryRow(context.Background(), "SELECT is_admin FROM users WHERE id = $1", targetUser.ID).Scan(&isAdmin)
		require.NoError(t, err)
		assert.False(t, isAdmin)
	})
}

// TestAdminAPI_BanUnbanUser tests POST/DELETE /api/v1/admin/users/{id}/ban
func TestAdminAPI_BanUnbanUser(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "banned_users", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAdminTestRouter(app, testDB)

	adminUser := testDB.CreateTestUser(t, "admin", "admin@example.com")
	targetUser := testDB.CreateTestUser(t, "target", "target@example.com")

	_, err := testDB.Pool.Exec(context.Background(), "UPDATE users SET is_admin = true WHERE id = $1", adminUser.ID)
	require.NoError(t, err)

	adminToken, err := core.CreateTestJWTTokenForUser(app, adminUser)
	require.NoError(t, err)

	t.Run("admin bans user successfully", func(t *testing.T) {
		req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/admin/users/%d/ban", targetUser.ID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		// Verify ban is recorded
		userService := &dbsvc.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
		isBanned, err := userService.CheckUserBanned(context.Background(), int32(targetUser.ID))
		require.NoError(t, err)
		assert.True(t, isBanned)
	})

	t.Run("admin unbans user successfully", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/admin/users/%d/ban", targetUser.ID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)

		// Verify ban is removed
		userService := &dbsvc.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
		isBanned, err := userService.CheckUserBanned(context.Background(), int32(targetUser.ID))
		require.NoError(t, err)
		assert.False(t, isBanned)
	})
}

// TestAdminAPI_ListBannedUsers tests GET /api/v1/admin/users/banned
func TestAdminAPI_ListBannedUsers(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "banned_users", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAdminTestRouter(app, testDB)

	adminUser := testDB.CreateTestUser(t, "admin", "admin@example.com")
	bannedUser := testDB.CreateTestUser(t, "banned", "banned@example.com")

	_, err := testDB.Pool.Exec(context.Background(), "UPDATE users SET is_admin = true WHERE id = $1", adminUser.ID)
	require.NoError(t, err)

	adminToken, err := core.CreateTestJWTTokenForUser(app, adminUser)
	require.NoError(t, err)

	// Ban the user directly via service
	userService := &dbsvc.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	err = userService.BanUser(context.Background(), int32(bannedUser.ID), int32(adminUser.ID))
	require.NoError(t, err)

	t.Run("admin lists banned users", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/admin/users/banned", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response []interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		require.GreaterOrEqual(t, len(response), 1)
		usernames := make([]string, 0, len(response))
		for _, item := range response {
			if u, ok := item.(map[string]interface{}); ok {
				if name, ok := u["username"].(string); ok {
					usernames = append(usernames, name)
				}
			}
		}
		assert.Contains(t, usernames, bannedUser.Username, "banned user should appear in the list")
	})
}

// TestAdminAPI_GetUserByUsername tests GET /api/v1/admin/users/lookup/{username}
func TestAdminAPI_GetUserByUsername(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAdminTestRouter(app, testDB)

	adminUser := testDB.CreateTestUser(t, "admin", "admin@example.com")
	targetUser := testDB.CreateTestUser(t, "lookup_target", "lookup@example.com")

	_, err := testDB.Pool.Exec(context.Background(), "UPDATE users SET is_admin = true WHERE id = $1", adminUser.ID)
	require.NoError(t, err)

	adminToken, err := core.CreateTestJWTTokenForUser(app, adminUser)
	require.NoError(t, err)

	t.Run("admin looks up user by username", func(t *testing.T) {
		req := httptest.NewRequest("GET", fmt.Sprintf("/api/v1/admin/users/lookup/%s", targetUser.Username), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		var response map[string]interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
		assert.Equal(t, targetUser.Username, response["username"])
	})

	t.Run("returns 404 for non-existent username", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/admin/users/lookup/nobody_exists_here", nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}

// TestAdminAPI_DeleteMessage tests DELETE /api/v1/admin/messages/{messageId}
func TestAdminAPI_DeleteMessage(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "messages", "characters", "game_participants", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAdminTestRouter(app, testDB)

	adminUser := testDB.CreateTestUser(t, "admin", "admin@example.com")
	author := testDB.CreateTestUser(t, "author", "author@example.com")

	_, err := testDB.Pool.Exec(context.Background(), "UPDATE users SET is_admin = true WHERE id = $1", adminUser.ID)
	require.NoError(t, err)

	adminToken, err := core.CreateTestJWTTokenForUser(app, adminUser)
	require.NoError(t, err)

	game := testDB.CreateTestGame(t, int32(adminUser.ID), "Test Game")

	gameService := &dbsvc.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(author.ID), "player")
	require.NoError(t, err)

	// Create a character for the author
	characterService := &dbsvc.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	authorChar, err := characterService.CreateCharacter(context.Background(), dbsvc.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        func(i int32) *int32 { return &i }(int32(author.ID)),
		Name:          "Author Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create a post first, then a comment on it (the admin delete handler works on comments)
	messageService := &messagesvc.MessageService{DB: testDB.Pool}
	post, err := messageService.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(author.ID),
		CharacterID: authorChar.ID,
		Content:     "Parent post",
		Visibility:  "game",
	})
	require.NoError(t, err)

	comment, err := messageService.CreateComment(context.Background(), core.CreateCommentRequest{
		GameID:      game.ID,
		ParentID:    post.ID,
		AuthorID:    int32(author.ID),
		CharacterID: authorChar.ID,
		Content:     "This comment will be deleted by admin",
		Visibility:  "game",
	})
	require.NoError(t, err)

	t.Run("admin can delete a comment", func(t *testing.T) {
		req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/admin/messages/%d", comment.ID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNoContent, rec.Code)
	})

	t.Run("deleting already-deleted comment returns 403", func(t *testing.T) {
		// Already deleted above — trying again should return 403
		req := httptest.NewRequest("DELETE", fmt.Sprintf("/api/v1/admin/messages/%d", comment.ID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})
}
