package phases

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"actionphase/pkg/core"
	phasesvc "actionphase/pkg/db/services/phases"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPhaseAPI_EndedPhase(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	router := setupFullPhaseAPITestRouter(app, testDB)
	gm, player, gmToken, _, game, first := setupResultsTestState(t, testDB, app)

	send := func(method, path string, body map[string]any) *httptest.ResponseRecorder {
		t.Helper()
		encoded, err := json.Marshal(body)
		require.NoError(t, err)
		req := httptest.NewRequest(method, fmt.Sprintf("/api/v1/games/%d%s", game.ID, path), bytes.NewBuffer(encoded))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+gmToken)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	created := send("POST", "/results", map[string]any{"user_id": player.ID, "phase_id": first.ID, "content": "A draft"})
	require.Equal(t, http.StatusCreated, created.Code, created.Body.String())
	var draft struct {
		ID      int32 `json:"id"`
		PhaseID int32 `json:"phase_id"`
	}
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &draft))
	assert.Equal(t, first.ID, draft.PhaseID)

	phaseService := &phasesvc.PhaseService{DB: testDB.Pool, Logger: app.ObsLogger}
	second, err := phaseService.TransitionToNextPhase(context.Background(), game.ID, int32(gm.ID), core.TransitionPhaseRequest{PhaseType: "common_room", Title: "Downtime"})
	require.NoError(t, err)

	t.Run("a new result naming the old phase is refused, not filed under the new one", func(t *testing.T) {
		rec := send("POST", "/results", map[string]any{"user_id": player.ID, "phase_id": first.ID, "content": "Too late"})
		assert.Equal(t, http.StatusLocked, rec.Code, rec.Body.String())
		assert.Contains(t, rec.Body.String(), core.PhaseNotActiveMessage)

		var count int
		require.NoError(t, testDB.Pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM action_results WHERE game_id = $1`, game.ID).Scan(&count))
		assert.Equal(t, 1, count)
	})

	t.Run("a new staged chain naming the old phase is refused", func(t *testing.T) {
		rec := send("POST", "/results/staged", map[string]any{
			"user_id": player.ID, "phase_id": first.ID,
			"parts": []map[string]any{{"content": "One"}, {"content": "Two", "delay_minutes": 5}},
		})
		assert.Equal(t, http.StatusLocked, rec.Code, rec.Body.String())
	})

	t.Run("a new result naming the active phase is accepted", func(t *testing.T) {
		rec := send("POST", "/results", map[string]any{"user_id": player.ID, "phase_id": second.ID, "content": "Current"})
		assert.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	})

	t.Run("its drafts can't be edited or published", func(t *testing.T) {
		rec := send("PUT", fmt.Sprintf("/results/%d", draft.ID), map[string]any{"content": "Changed"})
		assert.Equal(t, http.StatusLocked, rec.Code, rec.Body.String())
		assert.Contains(t, rec.Body.String(), core.PhaseEndedMessage)

		rec = send("POST", fmt.Sprintf("/results/%d/publish", draft.ID), nil)
		assert.Equal(t, http.StatusLocked, rec.Code, rec.Body.String())

		rec = send("POST", fmt.Sprintf("/phases/%d/results/publish", first.ID), nil)
		assert.Equal(t, http.StatusLocked, rec.Code, rec.Body.String())
	})

	t.Run("the phase list says which phases have ended", func(t *testing.T) {
		unstarted := testDB.CreateTestPhase(t, game.ID, core.PhaseTypeAction, "Later")
		_, err := testDB.Pool.Exec(context.Background(), `UPDATE game_phases SET phase_number = 9 WHERE id = $1`, unstarted.ID)
		require.NoError(t, err)

		rec := send("GET", "/phases", nil)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var list []struct {
			ID       int32 `json:"id"`
			HasEnded bool  `json:"has_ended"`
		}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
		ended := map[int32]bool{}
		for _, p := range list {
			ended[p.ID] = p.HasEnded
		}
		assert.True(t, ended[first.ID])
		assert.False(t, ended[second.ID], "the active phase")
		assert.False(t, ended[unstarted.ID], "a phase that hasn't started")
	})
}
