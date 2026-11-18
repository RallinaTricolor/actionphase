package scoreboard

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"actionphase/pkg/access"
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
	"actionphase/pkg/games"
	"actionphase/pkg/humaconfig"
)

const scoreColumnJSON = `{"id":"c_score1","label":"Score","tab_key":"numbers","entry":"Score","field_key":"amount"`

// scoreboardFixture is a running game with a GM, co-GM, audience member, two
// players and an outsider. Ash has 5 and Bea has 9.
type scoreboardFixture struct {
	t      *testing.T
	testDB *core.TestDatabase
	router *chi.Mux
	game   *models.Game
	tokens map[string]string
}

func newScoreboardFixture(t *testing.T) *scoreboardFixture {
	t.Helper()
	testDB := core.NewTestDatabase(t)
	t.Cleanup(func() {
		testDB.CleanupTables(t, "character_data", "characters", "game_participants", "games", "sessions", "users")
		testDB.Close()
	})
	app := core.NewTestApp(testDB.Pool)

	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameHandler := games.Handler{App: app, UserService: userService, GameService: gameService}

	router := chi.NewRouter()
	router.Route("/api/v1/games/{gameID}", func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth))
		r.Use(jwtauth.Authenticator(tokenAuth))
		r.Use(core.RequireAuthenticationMiddleware(userService))
		r.Use(core.AdminModeMiddleware)
		r.Use(gameHandler.GameMiddleware())

		api := humaconfig.New(r, "ActionPhase API", "1.0.0")
		api.UseMiddleware(access.Middleware(api, app, gameService))
		games.RegisterHumaGameScoped(api, &gameHandler)
		RegisterHumaGameScoreboard(api, &Handler{
			App:               app,
			ScoreboardService: &db.ScoreboardService{DB: testDB.Pool, Logger: app.ObsLogger},
		})
	})

	users := map[string]*core.User{}
	for _, name := range []string{"gm", "cogm", "audience", "ash", "bea", "outsider"} {
		users[name] = testDB.CreateTestUser(t, "sb_"+name, "sb_"+name+"@example.com")
	}
	game := testDB.CreateTestGameWithState(t, int32(users["gm"].ID), "Scoreboard Game", core.GameStateInProgress)
	testDB.AddTestGameParticipant(t, game.ID, int32(users["cogm"].ID), "co_gm")
	testDB.AddTestGameParticipant(t, game.ID, int32(users["audience"].ID), "audience")
	testDB.AddTestGameParticipant(t, game.ID, int32(users["ash"].ID), "player")
	testDB.AddTestGameParticipant(t, game.ID, int32(users["bea"].ID), "player")

	f := &scoreboardFixture{t: t, testDB: testDB, router: router, game: game, tokens: map[string]string{}}
	for name, user := range users {
		token, err := core.CreateTestJWTTokenForUser(app, user)
		require.NoError(t, err)
		f.tokens[name] = token
	}
	f.addCharacter(users["ash"], "Ash", `[{"id":"e1","name":"Score","amount":{"value":5,"max":10}}]`)
	f.addCharacter(users["bea"], "Bea", `[{"id":"e2","name":"Score","amount":{"value":9,"max":10}}]`)
	return f
}

func (f *scoreboardFixture) addCharacter(user *core.User, name, numbers string) {
	f.t.Helper()
	ctx := context.Background()
	queries := models.New(f.testDB.Pool)
	character, err := queries.CreateCharacter(ctx, models.CreateCharacterParams{
		GameID:        f.game.ID,
		UserID:        pgtype.Int4{Int32: int32(user.ID), Valid: true},
		Name:          name,
		CharacterType: "player_character",
		Status:        "approved",
	})
	require.NoError(f.t, err)
	_, err = queries.CreateCharacterData(ctx, models.CreateCharacterDataParams{
		CharacterID: character.ID,
		ModuleType:  "numbers",
		FieldName:   "numbers",
		FieldValue:  pgtype.Text{String: numbers, Valid: true},
		FieldType:   "json",
		IsPublic:    pgtype.Bool{Bool: false, Valid: true},
	})
	require.NoError(f.t, err)
}

func (f *scoreboardFixture) setBoard(enabled bool, config string) {
	f.t.Helper()
	_, err := f.testDB.Pool.Exec(context.Background(),
		`UPDATE games SET scoreboard_enabled = $2, scoreboard = $3::jsonb WHERE id = $1`, f.game.ID, enabled, config)
	require.NoError(f.t, err)
}

func (f *scoreboardFixture) request(method, path, viewer, body string) *httptest.ResponseRecorder {
	f.t.Helper()
	url := "/api/v1/games/" + itoa(f.game.ID) + path
	req := httptest.NewRequest(method, url, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if viewer != "" {
		req.Header.Set("Authorization", "Bearer "+f.tokens[viewer])
	}
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

func itoa(v int32) string {
	data, _ := json.Marshal(v)
	return string(data)
}

func (f *scoreboardFixture) board(viewer string) *core.ScoreboardResult {
	f.t.Helper()
	rec := f.request(http.MethodGet, "/scoreboard", viewer, "")
	require.Equal(f.t, http.StatusOK, rec.Code, rec.Body.String())
	var board core.ScoreboardResult
	require.NoError(f.t, json.Unmarshal(rec.Body.Bytes(), &board))
	return &board
}

func names(board *core.ScoreboardResult) []string {
	out := []string{}
	for _, row := range board.Rows {
		out = append(out, row.CharacterName)
	}
	return out
}

func TestScoreboard_PublicBoard(t *testing.T) {
	f := newScoreboardFixture(t)
	f.setBoard(true, `{"visibility":"public","columns":[`+scoreColumnJSON+`}],"sort":[{"key":"c_score1","direction":"desc"}]}`)

	for _, viewer := range []string{"ash", "outsider"} {
		board := f.board(viewer)
		assert.False(t, board.FullView, viewer)
		assert.Equal(t, []string{"Bea", "Ash"}, names(board), viewer)
		assert.Equal(t, 9.0, *board.Rows[0].Values["c_score1"].Value, viewer)
	}
}

func TestScoreboard_SemiPublicBoardSendsNoHiddenValues(t *testing.T) {
	f := newScoreboardFixture(t)
	f.setBoard(true, `{"visibility":"public","columns":[`+scoreColumnJSON+`,"hidden":true}],
		"sort":[{"key":"c_score1","direction":"desc"},{"key":"name","direction":"asc"}]}`)

	rec := f.request(http.MethodGet, "/scoreboard", "ash", "")
	require.Equal(t, http.StatusOK, rec.Code)
	for _, secret := range []string{"c_score1", "Score", `"value"`, `"max"`} {
		assert.NotContains(t, rec.Body.String(), secret)
	}
	assert.Equal(t, []string{"Bea", "Ash"}, names(f.board("ash")), "players still get the score order")

	for _, viewer := range []string{"gm", "cogm", "audience"} {
		board := f.board(viewer)
		assert.True(t, board.FullView, viewer)
		assert.True(t, board.Columns[0].Hidden, viewer)
		assert.Equal(t, 9.0, *board.Rows[0].Values["c_score1"].Value, viewer)
	}
}

func TestScoreboard_PrivateBoard(t *testing.T) {
	f := newScoreboardFixture(t)
	f.setBoard(true, `{"columns":[`+scoreColumnJSON+`}]}`)

	for _, viewer := range []string{"ash", "outsider"} {
		assert.Equal(t, http.StatusNotFound, f.request(http.MethodGet, "/scoreboard", viewer, "").Code, viewer)
	}
	assert.Equal(t, []string{"Ash", "Bea"}, names(f.board("audience")), "no sort means by name")

	f.testDB.SetGameStateDirectly(t, f.game.ID, core.GameStateEpilogue)
	for _, viewer := range []string{"ash", "outsider"} {
		board := f.board(viewer)
		assert.True(t, board.FullView, viewer)
		assert.Equal(t, 5.0, *board.Rows[0].Values["c_score1"].Value, viewer)
	}
}

func TestScoreboard_BandsHideTheNumberFromPlayers(t *testing.T) {
	f := newScoreboardFixture(t)
	f.setBoard(true, `{"visibility":"public","columns":[`+scoreColumnJSON+`,"display":"bands",
		"bands":[{"label":"High","min":8},{"label":"Low","max":8,"max_strict":true}]}]}`)

	rec := f.request(http.MethodGet, "/scoreboard", "ash", "")
	require.Equal(t, http.StatusOK, rec.Code)
	assert.NotContains(t, rec.Body.String(), `"value"`)
	assert.NotContains(t, rec.Body.String(), `"max"`)
	assert.Equal(t, core.ScoreboardCell{Label: "Low"}, f.board("ash").Rows[0].Values["c_score1"])

	cell := f.board("gm").Rows[0].Values["c_score1"]
	assert.Equal(t, "Low", cell.Label)
	assert.Equal(t, 5.0, *cell.Value)
}

func TestScoreboard_DisabledBoardIsAbsentForEveryone(t *testing.T) {
	f := newScoreboardFixture(t)
	f.setBoard(false, `{"visibility":"public","columns":[`+scoreColumnJSON+`}]}`)
	f.testDB.SetGameStateDirectly(t, f.game.ID, core.GameStateCompleted)

	for _, viewer := range []string{"gm", "audience", "ash"} {
		assert.Equal(t, http.StatusNotFound, f.request(http.MethodGet, "/scoreboard", viewer, "").Code, viewer)
	}
}

func TestScoreboard_RequiresLogin(t *testing.T) {
	f := newScoreboardFixture(t)
	f.setBoard(true, `{"visibility":"public"}`)
	assert.Equal(t, http.StatusUnauthorized, f.request(http.MethodGet, "/scoreboard", "", "").Code)
}

func TestScoreboardConfig_GMOnly(t *testing.T) {
	f := newScoreboardFixture(t)
	f.setBoard(true, `{"visibility":"public","columns":[`+scoreColumnJSON+`,"hidden":true}]}`)

	for _, viewer := range []string{"ash", "audience", "outsider"} {
		for _, path := range []string{"/scoreboard/config", "/scoreboard/entry-names"} {
			rec := f.request(http.MethodGet, path, viewer, "")
			assert.Equal(t, http.StatusForbidden, rec.Code, "%s %s", viewer, path)
			assert.NotContains(t, rec.Body.String(), "Score")
		}
		assert.Equal(t, http.StatusForbidden, f.request(http.MethodPut, "/scoreboard/config", viewer, `{}`).Code, viewer)
	}

	rec := f.request(http.MethodGet, "/scoreboard/config", "cogm", "")
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"hidden":true`)

	rec = f.request(http.MethodGet, "/scoreboard/entry-names", "gm", "")
	require.Equal(t, http.StatusOK, rec.Code)
	assert.JSONEq(t, `{"tabs":[{"tab_key":"inventory","entry_names":[]},{"tab_key":"numbers","entry_names":["Score"]}]}`,
		stripSchema(t, rec.Body.Bytes()))
}

func stripSchema(t *testing.T, body []byte) string {
	t.Helper()
	var decoded map[string]any
	require.NoError(t, json.Unmarshal(body, &decoded))
	delete(decoded, "$schema")
	out, err := json.Marshal(decoded)
	require.NoError(t, err)
	return string(out)
}

func TestScoreboardConfig_Update(t *testing.T) {
	f := newScoreboardFixture(t)
	stored := func() string {
		var value string
		require.NoError(t, f.testDB.Pool.QueryRow(context.Background(),
			`SELECT scoreboard::text FROM games WHERE id = $1`, f.game.ID).Scan(&value))
		return value
	}

	t.Run("stores the normalized config", func(t *testing.T) {
		rec := f.request(http.MethodPut, "/scoreboard/config", "gm", `{"visibility":"staff","columns":[
			{"id":"c_score1","label":" Score ","tab_key":"numbers","entry":"Score","field_key":"amount","display":"value"}],
			"sort":[{"key":"c_score1","direction":"desc"}]}`)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		assert.JSONEq(t, `{"columns":[{"id":"c_score1","label":"Score","tab_key":"numbers","entry":"Score","field_key":"amount"}],
			"sort":[{"key":"c_score1","direction":"desc"}]}`, stored())
	})

	before := stored()
	rejected := []struct {
		name, body, want string
	}{
		{"text field", `{"columns":[{"id":"c_score1","label":"Notes","tab_key":"numbers","entry":"Score","field_key":"description"}]}`,
			`Column \"Notes\" must use a number or track field`},
		{"tab the game doesn't have", `{"columns":[{"id":"c_score1","label":"Gold","tab_key":"t_abc123","entry":"Gold","field_key":"gold"}]}`,
			`doesn't have`},
		{"sort key without a column", `{"sort":[{"key":"c_gone00","direction":"asc"}]}`, `Sort key \"c_gone00\" is not one of the columns`},
		{"unknown key", `{"nope":1}`, ``},
	}
	for _, tt := range rejected {
		t.Run("rejects "+tt.name, func(t *testing.T) {
			rec := f.request(http.MethodPut, "/scoreboard/config", "gm", tt.body)
			assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
			assert.Contains(t, rec.Body.String(), tt.want)
			assert.NotContains(t, rec.Body.String(), "invalid scoreboard config")
			assert.Equal(t, before, stored())
		})
	}

	t.Run("an epilogue game can still change it", func(t *testing.T) {
		f.testDB.SetGameStateDirectly(t, f.game.ID, core.GameStateEpilogue)
		assert.Equal(t, http.StatusOK, f.request(http.MethodPut, "/scoreboard/config", "gm", `{}`).Code)
	})

	t.Run("a completed game can't", func(t *testing.T) {
		f.testDB.SetGameStateDirectly(t, f.game.ID, core.GameStateCompleted)
		assert.Equal(t, http.StatusConflict, f.request(http.MethodPut, "/scoreboard/config", "gm", `{"visibility":"public"}`).Code)
		assert.JSONEq(t, `{}`, stored())
	})
}

func TestGameResponse_ScoreboardFields(t *testing.T) {
	f := newScoreboardFixture(t)
	secretConfig := `{"visibility":"public","columns":[{"id":"c_score1","label":"SecretLabel","tab_key":"numbers","entry":"Score","field_key":"amount","hidden":true}]}`

	read := func() map[string]any {
		rec := f.request(http.MethodGet, "", "ash", "")
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		assert.NotContains(t, rec.Body.String(), "SecretLabel", "the config must not reach players")
		var body map[string]any
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		return body
	}

	f.setBoard(false, secretConfig)
	body := read()
	assert.Equal(t, false, body["scoreboard_enabled"])
	assert.NotContains(t, body, "scoreboard_visibility")

	f.setBoard(true, secretConfig)
	body = read()
	assert.Equal(t, true, body["scoreboard_enabled"])
	assert.Equal(t, "public", body["scoreboard_visibility"])

	f.setBoard(true, `{}`)
	assert.Equal(t, "staff", read()["scoreboard_visibility"])
}

func TestGameUpdate_ScoreboardSettingKeepsConfig(t *testing.T) {
	f := newScoreboardFixture(t)
	config := `{"visibility":"public"}`
	f.setBoard(true, config)

	rec := f.request(http.MethodPut, "", "gm", `{"title":"Scoreboard Game","description":"A game with a scoreboard.","scoreboard_enabled":false}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var enabled bool
	var stored string
	require.NoError(t, f.testDB.Pool.QueryRow(context.Background(),
		`SELECT scoreboard_enabled, scoreboard::text FROM games WHERE id = $1`, f.game.ID).Scan(&enabled, &stored))
	assert.False(t, enabled)
	assert.JSONEq(t, config, stored, "turning the board off keeps its setup")

	rec = f.request(http.MethodPut, "", "gm", `{"title":"Scoreboard Game","description":"A game with a scoreboard.","scoreboard_enabled":true}`)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	assert.Equal(t, http.StatusOK, f.request(http.MethodGet, "/scoreboard", "ash", "").Code, "turning it back on restores the board")
}
