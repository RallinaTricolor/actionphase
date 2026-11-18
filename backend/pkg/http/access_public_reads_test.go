package http

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// TestPublicGameReads_ThroughFullRouter covers the reads whose handlers used to
// carry their own participant check on top of the level. The access matrix
// only proves the gate admits an outsider; this proves the whole request does,
// so a stray handler-level 403 cannot quietly undo a Public level.
func TestPublicGameReads_ThroughFullRouter(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping integration test - SKIP_DB_TESTS=true")
	}
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	h := &Handler{App: app}
	router, _ := h.Router()
	ctx := context.Background()
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "public_reads_gm", "public_reads_gm@example.com")
	outsider := testDB.CreateTestUser(t, "public_reads_outsider", "public_reads_outsider@example.com")
	running := testDB.CreateTestGame(t, int32(gm.ID), "Running Game")
	testDB.SetGameStateDirectly(t, running.ID, core.GameStateInProgress)
	completed := testDB.CreateTestGame(t, int32(gm.ID), "Completed Game")
	testDB.SetGameStateDirectly(t, completed.ID, core.GameStateCompleted)
	recruiting := testDB.CreateTestGame(t, int32(gm.ID), "Recruiting Game")
	testDB.SetGameStateDirectly(t, recruiting.ID, core.GameStateRecruitment)

	tok, err := core.CreateTestJWTTokenForUser(app, outsider)
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	if _, err := queries.CreateSession(ctx, models.CreateSessionParams{
		UserID: int32(outsider.ID), Data: tok,
		Expires: pgtype.Timestamptz{Time: time.Now().Add(time.Hour), Valid: true},
	}); err != nil {
		t.Fatalf("session: %v", err)
	}

	get := func(url, token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, url, nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	for _, url := range []string{
		fmt.Sprintf("/api/v1/games/%d/community-documents", running.ID),
		fmt.Sprintf("/api/v1/games/%d/characters/data", running.ID),
		fmt.Sprintf("/api/v1/games/%d/stats", completed.ID),
		fmt.Sprintf("/api/v1/games/%d/applicants", recruiting.ID),
	} {
		t.Run("outsider reads "+url, func(t *testing.T) {
			if rec := get(url, tok); rec.Code != http.StatusOK {
				t.Errorf("got %d %s, want 200 for a logged-in outsider", rec.Code, rec.Body.String())
			}
		})
	}

	t.Run("applicants require login", func(t *testing.T) {
		rec := get(fmt.Sprintf("/api/v1/games/%d/applicants", recruiting.ID), "")
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("got %d %s, want 401 for an anonymous caller", rec.Code, rec.Body.String())
		}
	})
}
