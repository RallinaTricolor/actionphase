package dashboard

import (
	"actionphase/pkg/core"
	services "actionphase/pkg/db/services"
	"actionphase/pkg/observability"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

func TestDashboardAPI_GetUserDashboard_Integration(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	// Clean up before and after to ensure isolation
	testDB.CleanupTables(t, "action_submissions", "game_phases", "game_participants", "games", "sessions", "users")
	defer testDB.CleanupTables(t, "action_submissions", "game_phases", "game_participants", "games", "sessions", "users")

	factory := core.NewTestDataFactory(testDB, t)

	// Create test app
	obsLogger := observability.NewLogger("test", "info")
	app := &core.App{
		Pool:      testDB.Pool,
		ObsLogger: obsLogger,
		Config: &core.Config{
			JWT: core.JWTConfig{
				Algorithm: "HS256",
				Secret:    "test-secret-key-for-testing-only",
			},
		},
	}

	// Create authenticated user
	user, _ := factory.CreateAuthenticatedUser()

	// Create JWT token with username (not session_id)
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	_, tokenString, _ := tokenAuth.Encode(map[string]interface{}{
		"username": user.Username,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	})

	// Setup router with dashboard handler and authentication middleware
	userService := &services.UserService{DB: testDB.Pool}
	r := chi.NewRouter()
	r.Use(jwtauth.Verifier(tokenAuth))
	r.Use(core.RequireAuthenticationMiddleware(userService))

	handler := &Handler{App: app}
	r.Get("/", handler.GetUserDashboard)

	t.Run("empty_dashboard_for_new_user", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")
		body := w.Body.String()
		core.AssertTrue(t, strings.Contains(body, `"has_games":false`), "Should have has_games=false")
		core.AssertTrue(t, strings.Contains(body, `"player_games":[]`), "Should have empty player_games")
	})

	t.Run("dashboard_with_player_game", func(t *testing.T) {
		// Create game and add user as participant
		gm := factory.NewUser().WithUsername("gm").Create()
		game := factory.NewGame().
			WithTitle("Test Game").
			WithGM(gm.ID).
			WithState("in_progress").
			Create()
		factory.NewGameParticipant().
			ForGame(game.ID).
			WithUser(user.ID).
			WithRole("player").
			Create()

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")
		body := w.Body.String()
		core.AssertTrue(t, strings.Contains(body, `"has_games":true`), "Should have has_games=true")
		core.AssertTrue(t, strings.Contains(body, `"Test Game"`), "Should contain game title")
		core.AssertTrue(t, strings.Contains(body, `"player_games":[`), "Should have player_games array")
	})

	t.Run("unauthorized_without_token", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		core.AssertEqual(t, http.StatusUnauthorized, w.Code, "Should return 401 Unauthorized")
	})

	t.Run("invalid_session_id", func(t *testing.T) {
		// Create token with invalid session
		_, badTokenString, _ := tokenAuth.Encode(map[string]interface{}{
			"session_id": "invalid-session-id",
			"exp":        time.Now().Add(24 * time.Hour).Unix(),
		})

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("Authorization", "Bearer "+badTokenString)
		w := httptest.NewRecorder()

		r.ServeHTTP(w, req)

		// Should fail to authenticate with invalid session
		core.AssertTrue(t, w.Code == http.StatusUnauthorized || w.Code == http.StatusInternalServerError,
			"Should return 401 or 500 for invalid session")
	})
}

func TestDashboardAPI_GetUserDashboard_WithUrgentGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	// Clean up before and after to ensure isolation
	testDB.CleanupTables(t, "action_submissions", "game_phases", "game_participants", "games", "sessions", "users")
	defer testDB.CleanupTables(t, "action_submissions", "game_phases", "game_participants", "games", "sessions", "users")

	factory := core.NewTestDataFactory(testDB, t)

	// Create test app
	obsLogger := observability.NewLogger("test", "info")
	app := &core.App{
		Pool:      testDB.Pool,
		ObsLogger: obsLogger,
		Config: &core.Config{
			JWT: core.JWTConfig{
				Algorithm: "HS256",
				Secret:    "test-secret-key-for-testing-only",
			},
		},
	}

	// Create authenticated user
	user, _ := factory.CreateAuthenticatedUser()

	// Create JWT token with username
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	_, tokenString, _ := tokenAuth.Encode(map[string]interface{}{
		"username": user.Username,
		"exp":      time.Now().Add(24 * time.Hour).Unix(),
	})

	// Setup router with authentication middleware
	userService := &services.UserService{DB: testDB.Pool}
	r := chi.NewRouter()
	r.Use(jwtauth.Verifier(tokenAuth))
	r.Use(core.RequireAuthenticationMiddleware(userService))

	handler := &Handler{App: app}
	r.Get("/", handler.GetUserDashboard)

	// Create game with urgent deadline
	gm := factory.NewUser().WithUsername("gm").Create()
	game := factory.NewGame().
		WithTitle("Urgent Game").
		WithGM(gm.ID).
		WithState("in_progress").
		Create()
	factory.NewGameParticipant().
		ForGame(game.ID).
		WithUser(user.ID).
		WithRole("player").
		Create()

	// Create active phase with near deadline
	phase := factory.NewPhase().
		InGame(game).
		ActionPhase().
		Active().
		WithDeadline(time.Now().Add(3 * time.Hour)).
		Create()

	// Create pending action
	factory.NewActionSubmission().
		InGame(game).
		ByUser(user).
		InPhase(phase).
		Draft().
		Create()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tokenString)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	core.AssertEqual(t, http.StatusOK, w.Code, "Should return 200 OK")
	body := w.Body.String()
	core.AssertTrue(t, strings.Contains(body, `"is_urgent":true`), "Game should be marked as urgent")
	core.AssertTrue(t, strings.Contains(body, `"deadline_status":"critical"`), "Should have critical deadline status")
	core.AssertTrue(t, strings.Contains(body, `"has_pending_action":true`), "Should have pending action")
}
