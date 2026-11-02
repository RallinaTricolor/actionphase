package gmboard

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"actionphase/pkg/access"
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
	"actionphase/pkg/games"
	"actionphase/pkg/humaconfig"
)

// setupBoardRouter mirrors root.go's /{gameID} mount: GameMiddleware, then the
// access level gate, then ChildScope for {phaseId}.
func setupBoardRouter(app *core.App) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	gameService := &db.GameService{DB: app.Pool, Logger: app.ObsLogger}
	gameHandler := games.Handler{App: app, GameService: gameService, UserService: &db.UserService{DB: app.Pool, Logger: app.ObsLogger}}
	q := models.New(app.Pool)

	r := chi.NewRouter()
	r.Route("/api/v1/games/{gameID}", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth))
		r.Use(jwtauth.Authenticator(tokenAuth))
		r.Use(core.RequireAuthenticationMiddleware(&db.UserService{DB: app.Pool, Logger: app.ObsLogger}))
		r.Use(core.AdminModeMiddleware)
		r.Use(gameHandler.GameMiddleware())

		api := humaconfig.New(r, "ActionPhase API", "1.0.0")
		api.UseMiddleware(access.Middleware(api, app, gameService))
		api.UseMiddleware(access.ChildScope(api, app,
			map[string]access.Child{"/phases/{phaseId}": {Kind: "phase"}},
			map[string]func(context.Context, int32) (int32, error){"phase": q.GameIDOfPhase}))
		RegisterHumaGmBoard(api, &Handler{App: app, BoardService: &db.GmBoardService{DB: app.Pool}})
	})
	return r
}

type boardScenario struct {
	t        *testing.T
	testDB   *core.TestDatabase
	router   *chi.Mux
	game     *models.Game
	phase    *models.GamePhase
	tokens   map[string]string
	gameURL  string
	boardURL string
}

func newBoardScenario(t *testing.T, name string) *boardScenario {
	t.Helper()
	testDB := core.NewTestDatabase(t)
	t.Cleanup(testDB.Close)
	app := core.NewTestApp(testDB.Pool)

	users := map[string]*core.User{}
	for _, role := range []string{"gm", "cogm", "player", "audience", "outsider"} {
		users[role] = testDB.CreateTestUser(t, fmt.Sprintf("%s_%s", name, role), fmt.Sprintf("%s_%s@example.com", name, role))
	}
	game := testDB.CreateTestGame(t, int32(users["gm"].ID), "Board "+name)
	testDB.SetGameStateDirectly(t, game.ID, core.GameStateInProgress)
	testDB.AddTestGameParticipant(t, game.ID, int32(users["cogm"].ID), "co_gm")
	testDB.AddTestGameParticipant(t, game.ID, int32(users["player"].ID), "player")
	testDB.AddTestGameParticipant(t, game.ID, int32(users["audience"].ID), "audience")
	phase := testDB.CreateTestPhase(t, game.ID, core.PhaseTypeAction, "Day 1")

	tokens := map[string]string{}
	for role, u := range users {
		tok, err := core.CreateTestJWTTokenForUser(app, u)
		require.NoError(t, err)
		tokens[role] = tok
	}
	gameURL := fmt.Sprintf("/api/v1/games/%d", game.ID)
	return &boardScenario{
		t: t, testDB: testDB, router: setupBoardRouter(app), game: game, phase: phase, tokens: tokens,
		gameURL: gameURL, boardURL: fmt.Sprintf("%s/phases/%d/gm-board", gameURL, phase.ID),
	}
}

func (s *boardScenario) call(method, url, role string, body any) *httptest.ResponseRecorder {
	s.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		require.NoError(s.t, json.NewEncoder(&buf).Encode(body))
	}
	req := httptest.NewRequest(method, url, &buf)
	req.Header.Set("Content-Type", "application/json")
	if role != "" {
		req.Header.Set("Authorization", "Bearer "+s.tokens[role])
	}
	rec := httptest.NewRecorder()
	s.router.ServeHTTP(rec, req)
	return rec
}

func (s *boardScenario) setShared(share bool) {
	s.t.Helper()
	_, err := s.testDB.Pool.Exec(context.Background(), "UPDATE games SET share_gm_board = $2 WHERE id = $1", s.game.ID, share)
	require.NoError(s.t, err)
}

func changes(items ...map[string]any) map[string]any { return map[string]any{"changes": items} }

func change(kind, key string, base int, doc any) map[string]any {
	return map[string]any{"kind": kind, "key": key, "base_version": base, "doc": doc}
}

func detail(rec *httptest.ResponseRecorder) string {
	var p struct {
		Detail string `json:"detail"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &p)
	return p.Detail
}

func TestBoardReads_SharingDecidesWhoBesidesTheGMMaySee(t *testing.T) {
	s := newBoardScenario(t, "gmb_reads")
	require.Equal(t, http.StatusOK, s.call("POST", s.boardURL+"/changes", "gm", changes(change("notes", "notes", 0, map[string]any{"text": "GM only"}))).Code)

	t.Run("no token is 401", func(t *testing.T) {
		assert.Equal(t, http.StatusUnauthorized, s.call("GET", s.boardURL, "", nil).Code)
	})

	t.Run("GM and co-GM read without sharing", func(t *testing.T) {
		for _, role := range []string{"gm", "cogm"} {
			rec := s.call("GET", s.boardURL, role, nil)
			require.Equal(t, http.StatusOK, rec.Code, role)
			var out GmItemsResponse
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
			require.Len(t, out.Items, 1)
			assert.JSONEq(t, `{"text":"GM only"}`, string(out.Items[0].Doc))
			assert.Equal(t, out.Items[0].Seq, out.Cursor)
		}
	})

	t.Run("a player is refused by the gate, shared or not", func(t *testing.T) {
		for _, shared := range []bool{false, true} {
			s.setShared(shared)
			rec := s.call("GET", s.boardURL, "player", nil)
			assert.Equal(t, http.StatusForbidden, rec.Code)
			assert.True(t, strings.EqualFold(detail(rec), access.ForbiddenMessage(access.Audience)))
		}
	})

	t.Run("the audience is refused with sharing off and allowed with it on", func(t *testing.T) {
		s.setShared(false)
		for _, url := range []string{s.boardURL, s.gameURL + "/gm-settings"} {
			rec := s.call("GET", url, "audience", nil)
			assert.Equal(t, http.StatusForbidden, rec.Code, url)
			assert.True(t, strings.EqualFold(detail(rec), NotSharedMessage), "refused by the sharing check: %q", detail(rec))
		}
		s.setShared(true)
		for _, url := range []string{s.boardURL, s.gameURL + "/gm-settings"} {
			assert.Equal(t, http.StatusOK, s.call("GET", url, "audience", nil).Code, url)
		}
	})

	t.Run("an outsider never reads a running game's board", func(t *testing.T) {
		s.setShared(true)
		assert.Equal(t, http.StatusForbidden, s.call("GET", s.boardURL, "outsider", nil).Code)
	})
}

func TestBoardReads_ArchiveIsOpenToAnyoneOnlyWhileShared(t *testing.T) {
	s := newBoardScenario(t, "gmb_archive")
	s.testDB.SetGameStateDirectly(t, s.game.ID, core.GameStateCompleted)

	s.setShared(false)
	for _, role := range []string{"outsider", "player"} {
		rec := s.call("GET", s.boardURL, role, nil)
		assert.Equal(t, http.StatusForbidden, rec.Code, role)
		assert.True(t, strings.EqualFold(detail(rec), NotSharedMessage), role)
	}

	s.setShared(true)
	for _, role := range []string{"outsider", "player", "audience"} {
		assert.Equal(t, http.StatusOK, s.call("GET", s.boardURL, role, nil).Code, role)
		assert.Equal(t, http.StatusOK, s.call("GET", s.gameURL+"/gm-settings", role, nil).Code, role)
	}
}

func TestBoardWrites_OnlyTheGMWrites(t *testing.T) {
	s := newBoardScenario(t, "gmb_writes")
	s.setShared(true) // sharing is read-only: it never opens writes

	for _, role := range []string{"player", "audience", "outsider"} {
		for _, req := range []struct{ method, url string }{
			{"POST", s.boardURL + "/changes"},
			{"POST", s.gameURL + "/gm-settings/changes"},
			{"PUT", s.gameURL + "/gm-settings/sharing"},
		} {
			body := any(changes(change("notes", "notes", 0, map[string]any{})))
			if req.method == "PUT" {
				body = map[string]any{"share": false}
			}
			rec := s.call(req.method, req.url, role, body)
			assert.Equal(t, http.StatusForbidden, rec.Code, "%s %s %s", role, req.method, req.url)
		}
	}
	var n int
	require.NoError(t, s.testDB.Pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM gm_board_items WHERE phase_id = $1", s.phase.ID).Scan(&n))
	assert.Zero(t, n)

	t.Run("a co-GM writes", func(t *testing.T) {
		rec := s.call("POST", s.boardURL+"/changes", "cogm", changes(change("card", "c1", 0, map[string]any{"summary": "x"})))
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var out GmItemsWrittenResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &out))
		require.Len(t, out.Items, 1)
		assert.Equal(t, int32(1), out.Items[0].Version)
	})
}

func TestBoardWrites_StaleItemIs409AndNothingInTheBatchLands(t *testing.T) {
	s := newBoardScenario(t, "gmb_conflict")
	url := s.boardURL + "/changes"
	require.Equal(t, http.StatusOK, s.call("POST", url, "gm", changes(change("card", "c1", 0, map[string]any{"v": 1}))).Code)
	require.Equal(t, http.StatusOK, s.call("POST", url, "cogm", changes(change("card", "c1", 1, map[string]any{"v": "cogm"}))).Code)

	rec := s.call("POST", url, "gm", changes(
		change("card", "c2", 0, map[string]any{"new": true}),
		change("card", "c1", 1, map[string]any{"v": "gm"}),
	))
	require.Equal(t, http.StatusConflict, rec.Code)
	assert.Equal(t, "application/problem+json", rec.Header().Get("Content-Type"))
	var body GmBoardConflictResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Len(t, body.Conflicts, 1)
	assert.Equal(t, "c1", body.Conflicts[0].Key)
	assert.Equal(t, int32(2), body.Conflicts[0].Version)
	assert.JSONEq(t, `{"v":"cogm"}`, string(body.Conflicts[0].Doc), "the 409 carries the other editor's copy")
	assert.NotEmpty(t, body.Detail)

	var keys []string
	rows, err := s.testDB.Pool.Query(context.Background(), "SELECT item_key FROM gm_board_items WHERE phase_id = $1 ORDER BY item_key", s.phase.ID)
	require.NoError(t, err)
	for rows.Next() {
		var k string
		require.NoError(t, rows.Scan(&k))
		keys = append(keys, k)
	}
	assert.Equal(t, []string{"c1"}, keys, "c2 was in the refused batch, so it isn't written")
}

func TestBoardWrites_TwoBatchesOnDifferentItemsBothLand(t *testing.T) {
	s := newBoardScenario(t, "gmb_disjoint")
	url := s.boardURL + "/changes"
	require.Equal(t, http.StatusOK, s.call("POST", url, "gm", changes(
		change("card", "a", 0, map[string]any{}), change("card", "b", 0, map[string]any{}))).Code)

	require.Equal(t, http.StatusOK, s.call("POST", url, "gm", changes(change("card", "a", 1, map[string]any{"by": "gm"}))).Code)
	require.Equal(t, http.StatusOK, s.call("POST", url, "cogm", changes(change("card", "b", 1, map[string]any{"by": "cogm"}))).Code)

	var out GmItemsResponse
	require.NoError(t, json.Unmarshal(s.call("GET", s.boardURL, "gm", nil).Body.Bytes(), &out))
	docs := map[string]string{}
	for _, it := range out.Items {
		docs[it.Key] = string(it.Doc)
	}
	assert.JSONEq(t, `{"by":"gm"}`, docs["a"])
	assert.JSONEq(t, `{"by":"cogm"}`, docs["b"])

	t.Run("a poll from the old cursor returns only what changed", func(t *testing.T) {
		before := out.Cursor
		require.Equal(t, http.StatusOK, s.call("POST", url, "cogm", changes(change("card", "a", 2, map[string]any{"by": "cogm"}))).Code)
		var polled GmItemsResponse
		require.NoError(t, json.Unmarshal(s.call("GET", fmt.Sprintf("%s?since=%d", s.boardURL, before), "gm", nil).Body.Bytes(), &polled))
		require.Len(t, polled.Items, 1)
		assert.Equal(t, "a", polled.Items[0].Key)
		assert.Greater(t, polled.Cursor, before)
	})
}

func TestBoardRequests_PhaseRules(t *testing.T) {
	s := newBoardScenario(t, "gmb_phases")

	t.Run("a common room phase has no board", func(t *testing.T) {
		cr := s.testDB.CreateTestPhase(t, s.game.ID, core.PhaseTypeCommonRoom, "Talk")
		url := fmt.Sprintf("%s/phases/%d/gm-board", s.gameURL, cr.ID)
		assert.Equal(t, http.StatusNotFound, s.call("GET", url, "gm", nil).Code)
		assert.Equal(t, http.StatusNotFound, s.call("POST", url+"/changes", "gm", changes(change("notes", "notes", 0, map[string]any{}))).Code)
	})

	t.Run("another game's phase is 404 even for its own GM", func(t *testing.T) {
		otherGame := s.testDB.CreateTestGame(t, s.game.GmUserID, "Elsewhere")
		otherPhase := s.testDB.CreateTestPhase(t, otherGame.ID, core.PhaseTypeAction, "Day 1")
		url := fmt.Sprintf("%s/phases/%d/gm-board", s.gameURL, otherPhase.ID)
		rec := s.call("POST", url+"/changes", "gm", changes(change("notes", "notes", 0, map[string]any{})))
		assert.Equal(t, http.StatusNotFound, rec.Code)
		var n int
		require.NoError(t, s.testDB.Pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM gm_board_items WHERE phase_id = $1", otherPhase.ID).Scan(&n))
		assert.Zero(t, n)
	})

	t.Run("an unknown kind is 422", func(t *testing.T) {
		rec := s.call("POST", s.boardURL+"/changes", "gm", changes(change("codex", "x", 0, map[string]any{})))
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
	})

	t.Run("a doc over the cap is 422 naming the item", func(t *testing.T) {
		rec := s.call("POST", s.boardURL+"/changes", "gm", changes(change("scene", "big", 0, map[string]any{"text": strings.Repeat("x", core.MaxGmBoardItemBytes)})))
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code)
		assert.Contains(t, detail(rec), `scene "big"`)
	})

	t.Run("an archived game refuses writes with a 409 that has no conflicts", func(t *testing.T) {
		s.testDB.SetGameStateDirectly(t, s.game.ID, core.GameStateCompleted)
		defer s.testDB.SetGameStateDirectly(t, s.game.ID, core.GameStateInProgress)
		rec := s.call("POST", s.boardURL+"/changes", "gm", changes(change("notes", "notes", 0, map[string]any{})))
		assert.Equal(t, http.StatusConflict, rec.Code)
		assert.NotContains(t, rec.Body.String(), `"conflicts"`)
	})
}

func TestSettings_SharingToggleAndGameLevelItems(t *testing.T) {
	s := newBoardScenario(t, "gmb_settings")

	rec := s.call("PUT", s.gameURL+"/gm-settings/sharing", "cogm", map[string]any{"share": true})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var shared SharingResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &shared))
	assert.True(t, shared.ShareGmBoard)
	var stored bool
	require.NoError(t, s.testDB.Pool.QueryRow(context.Background(), "SELECT share_gm_board FROM games WHERE id = $1", s.game.ID).Scan(&stored))
	assert.True(t, stored)

	require.Equal(t, http.StatusOK, s.call("POST", s.gameURL+"/gm-settings/changes", "gm",
		changes(change("codex", "loc-hangar", 0, map[string]any{"type": "Location", "name": "Hangar"}))).Code)

	var out GmSettingsResponse
	require.NoError(t, json.Unmarshal(s.call("GET", s.gameURL+"/gm-settings", "gm", nil).Body.Bytes(), &out))
	assert.True(t, out.ShareGmBoard)
	require.Len(t, out.Items, 1)
	assert.Equal(t, "codex", out.Items[0].Kind)

	t.Run("sharing can be changed once the game is completed", func(t *testing.T) {
		s.testDB.SetGameStateDirectly(t, s.game.ID, core.GameStateCompleted)
		rec := s.call("PUT", s.gameURL+"/gm-settings/sharing", "gm", map[string]any{"share": false})
		assert.Equal(t, http.StatusOK, rec.Code)
	})
}
