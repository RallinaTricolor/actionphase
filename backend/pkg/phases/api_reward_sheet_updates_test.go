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
	dbsvc2 "actionphase/pkg/db/services"
	actionsvc2 "actionphase/pkg/db/services/actions"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The results board's sheet sync: PUT …/phases/{phaseId}/characters/{characterId}/reward-sheet-updates
// and the phase-wide list it reads back.
func TestPhaseAPI_RewardSheetUpdates(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	router := setupFullPhaseAPITestRouter(app, testDB)
	gm, player, gmToken, playerToken, game, phase, _, character := setupDraftUpdatesTestState(t, testDB, app)

	actionService := &actionsvc2.ActionSubmissionService{DB: testDB.Pool, Logger: app.ObsLogger, NotificationService: &dbsvc2.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}}
	newDraft := func(t *testing.T) int32 {
		t.Helper()
		cid := character.ID
		r, err := actionService.CreateActionResult(context.Background(), core.CreateActionResultRequest{
			GameID: game.ID, PhaseID: phase.ID, UserID: int32(player.ID), CharacterID: &cid, GMUserID: int32(gm.ID), Content: "Draft",
		})
		require.NoError(t, err)
		return r.ID
	}

	do := func(t *testing.T, method, path, token string, body any) *httptest.ResponseRecorder {
		t.Helper()
		var buf bytes.Buffer
		if body != nil {
			require.NoError(t, json.NewEncoder(&buf).Encode(body))
		}
		req := httptest.NewRequest(method, path, &buf)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	syncPath := fmt.Sprintf("/api/v1/games/%d/phases/%d/characters/%d/reward-sheet-updates", game.ID, phase.ID, character.ID)
	listPath := fmt.Sprintf("/api/v1/games/%d/phases/%d/draft-character-updates", game.ID, phase.ID)
	numbers := map[string]any{"module_type": "numbers", "field_name": "numbers", "field_value": `[{"id":"n1","name":"Rating","amount":{"value":2}}]`}

	t.Run("writes generated drafts and lists them with from_rewards", func(t *testing.T) {
		rid := newDraft(t)
		rec := do(t, http.MethodPut, syncPath, gmToken, map[string]any{"result_id": rid, "updates": []any{numbers}})
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

		rec = do(t, http.MethodGet, listPath, gmToken, nil)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var drafts []map[string]any
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &drafts))
		require.Len(t, drafts, 1)
		assert.Equal(t, float64(rid), drafts[0]["action_result_id"])
		assert.Equal(t, true, drafts[0]["from_rewards"])
	})

	t.Run("hand-made drafts are a 409 with a sentence, until replace_hand_made", func(t *testing.T) {
		rid := newDraft(t)
		rec := do(t, http.MethodPost, fmt.Sprintf("/api/v1/games/%d/results/%d/character-updates", game.ID, rid), gmToken, map[string]any{
			"character_id": character.ID, "module_type": "inventory", "field_name": "items", "field_value": "[]", "field_type": "json", "operation": "upsert",
		})
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		var made map[string]any
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &made))
		assert.Equal(t, false, made["from_rewards"], "the results list's drafts are hand-made")

		rec = do(t, http.MethodPut, syncPath, gmToken, map[string]any{"result_id": rid, "updates": []any{numbers}})
		require.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
		assert.Contains(t, rec.Body.String(), "This character has 1 sheet update(s) made by hand in the results list")

		rec = do(t, http.MethodPut, syncPath, gmToken, map[string]any{"result_id": rid, "updates": []any{numbers}, "replace_hand_made": true})
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	})

	t.Run("a carrier with a later part is a 409", func(t *testing.T) {
		rid := newDraft(t)
		_, err := actionService.AppendStagedPart(context.Background(), rid, core.StagedResultPart{Content: "Later", DelayMinutes: 5})
		require.NoError(t, err)
		rec := do(t, http.MethodPut, syncPath, gmToken, map[string]any{"result_id": rid, "updates": []any{numbers}})
		assert.Equal(t, http.StatusConflict, rec.Code, rec.Body.String())
		assert.Contains(t, rec.Body.String(), "last part")
	})

	t.Run("rejects a tab the game doesn't have, a repeated tab, and a value that isn't a list", func(t *testing.T) {
		rid := newDraft(t)
		for name, updates := range map[string][]any{
			"unknown tab":  {map[string]any{"module_type": "t_abc123", "field_name": "t_abc123", "field_value": "[]"}},
			"wrong field":  {map[string]any{"module_type": "inventory", "field_name": "inventory", "field_value": "[]"}},
			"repeated tab": {numbers, numbers},
			"not a list":   {map[string]any{"module_type": "numbers", "field_name": "numbers", "field_value": `{"a":1}`}},
		} {
			rec := do(t, http.MethodPut, syncPath, gmToken, map[string]any{"result_id": rid, "updates": updates})
			assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, name+": "+rec.Body.String())
		}
	})

	t.Run("players can't sync or list", func(t *testing.T) {
		rid := newDraft(t)
		assert.Equal(t, http.StatusForbidden, do(t, http.MethodPut, syncPath, playerToken, map[string]any{"result_id": rid, "updates": []any{}}).Code)
		assert.Equal(t, http.StatusForbidden, do(t, http.MethodGet, listPath, playerToken, nil).Code)
	})
}
