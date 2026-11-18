package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"actionphase/pkg/access"
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
)

var pathParam = regexp.MustCompile(`\{(\w+)\}`)

// TestDeclaredAccessLevelsAreEnforced drives every access-gated route through
// the REAL router -- JWT, session check, GameMiddleware or the resource
// lookup, the access middleware -- as each role, and checks the result against the route's
// declared level. Routes enrol themselves by declaring a level, so nobody has
// to remember to write the "a player is refused" case for a new endpoint.
//
// Refusals are asserted on every method: a refused request never reaches the
// handler, so it cannot mutate anything. Admissions are asserted on GETs only,
// so the GM's pass doesn't delete the game halfway through.
//
// A refusal must carry access.ForbiddenMessage, proving the middleware -- not
// whatever inline check the handler happens to have -- answered it.
func TestDeclaredAccessLevelsAreEnforced(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping integration test - SKIP_DB_TESTS=true")
	}
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	router, _ := (&Handler{App: app}).Router()
	ctx := context.Background()
	queries := models.New(testDB.Pool)

	gm := testDB.CreateTestUser(t, "matrix_gm", "matrix_gm@example.com")
	player := testDB.CreateTestUser(t, "matrix_player", "matrix_player@example.com")
	audience := testDB.CreateTestUser(t, "matrix_audience", "matrix_audience@example.com")
	outsider := testDB.CreateTestUser(t, "matrix_outsider", "matrix_outsider@example.com")
	// Was a player, then removed. Still owns a character and still appears in
	// conversation_participants, so only the member level keeps them out.
	removed := testDB.CreateTestUser(t, "matrix_removed", "matrix_removed@example.com")
	// A site admin with admin mode on, and no participant row: is_gm says
	// they moderate this game, so every level admits them.
	admin := testDB.CreateTestUser(t, "matrix_admin", "matrix_admin@example.com")
	if _, err := testDB.Pool.Exec(ctx, "UPDATE users SET is_admin = true WHERE id = $1", admin.ID); err != nil {
		t.Fatalf("make admin: %v", err)
	}

	game := testDB.CreateTestGame(t, int32(gm.ID), "Access Matrix Game")
	testDB.SetGameStateDirectly(t, game.ID, core.GameStateInProgress)
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	for user, role := range map[*core.User]string{player: "player", audience: "audience", removed: "player"} {
		if _, err := gameService.AddGameParticipant(ctx, game.ID, int32(user.ID), role); err != nil {
			t.Fatalf("add %s: %v", role, err)
		}
	}
	if err := gameService.RemovePlayer(ctx, game.ID, int32(removed.ID), int32(gm.ID)); err != nil {
		t.Fatalf("remove player: %v", err)
	}

	// One real row per resource mount. Those routes find their game from the
	// row the path names, so a placeholder ID would 404 before the gate
	// decided anything.
	must := func(err error, what string) {
		if err != nil {
			t.Fatalf("create %s: %v", what, err)
		}
	}
	future := pgtype.Timestamptz{Time: time.Now().Add(48 * time.Hour), Valid: true}
	character, err := queries.CreateCharacter(ctx, models.CreateCharacterParams{
		GameID: game.ID, UserID: pgtype.Int4{Int32: int32(player.ID), Valid: true},
		Name: "Matrix Hero", CharacterType: "player_character", Status: "approved",
	})
	must(err, "character")
	phase := testDB.CreateTestPhase(t, game.ID, "common_room", "Matrix Phase")
	deadline, err := queries.CreateDeadline(ctx, models.CreateDeadlineParams{
		GameID: game.ID, Title: "Matrix deadline", Deadline: future, CreatedByUserID: int32(gm.ID),
	})
	must(err, "deadline")
	poll, err := queries.CreatePoll(ctx, models.CreatePollParams{
		GameID: game.ID, CreatedByUserID: int32(gm.ID), Question: "Matrix?", Deadline: future,
		ShowIndividualVotes: pgtype.Bool{Valid: true}, AllowOtherOption: pgtype.Bool{Valid: true},
	})
	must(err, "poll")
	export, err := queries.CreateGameExport(ctx, models.CreateGameExportParams{
		GameID: game.ID, RequestedByUserID: pgtype.Int4{Int32: int32(gm.ID), Valid: true},
	})
	must(err, "export")
	// Keyed by mount and parameter, since /characters and /phases both say {id}.
	resourceIDs := map[string]int32{
		"/characters/{id}":        character.ID,
		"/phases/{id}":            phase.ID,
		"/deadlines/{deadlineId}": deadline.ID,
		"/polls/{pollId}":         poll.ID,
		"/exports/{exportID}":     export.ID,
	}

	// The full router validates a server-side session for every token.
	token := func(u *core.User) string {
		tok, err := core.CreateTestJWTTokenForUser(app, u)
		if err != nil {
			t.Fatalf("token: %v", err)
		}
		if _, err := queries.CreateSession(ctx, models.CreateSessionParams{
			UserID:  int32(u.ID),
			Data:    tok,
			Expires: pgtype.Timestamptz{Time: time.Now().Add(time.Hour), Valid: true},
		}); err != nil {
			t.Fatalf("session: %v", err)
		}
		return tok
	}
	tokens := map[string]string{
		"gm": token(gm), "player": token(player), "audience": token(audience),
		"outsider": token(outsider), "removed": token(removed), "admin": token(admin),
	}

	call := func(method, url, role string) (int, string) {
		var body *bytes.Reader
		if method == http.MethodGet || method == http.MethodDelete {
			body = bytes.NewReader(nil)
		} else {
			body = bytes.NewReader([]byte("{}"))
		}
		req := httptest.NewRequest(method, url, body)
		req.Header.Set("Authorization", "Bearer "+tokens[role])
		req.Header.Set("Content-Type", "application/json")
		if role == "admin" {
			req.Header.Set("X-Admin-Mode", "true")
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		var problem struct {
			Detail string `json:"detail"`
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &problem)
		return rec.Code, problem.Detail
	}

	// Which roles each level refuses, and which it admits, in an active game.
	type expectation struct{ refused, admitted []string }
	expect := map[access.Level]expectation{
		access.GM:       {refused: []string{"player", "audience", "outsider", "removed"}, admitted: []string{"gm", "admin"}},
		access.Audience: {refused: []string{"player", "outsider", "removed"}, admitted: []string{"gm", "audience", "admin"}},
		access.Member:   {refused: []string{"outsider", "removed"}, admitted: []string{"gm", "player", "audience", "admin"}},
		access.Public:   {admitted: []string{"gm", "player", "audience", "outsider", "removed", "admin"}},
	}

	checked := map[access.Level]int{}
	for _, op := range specOperations(t) {
		if !isAccessGated(op.path) {
			continue
		}
		level, _ := op.fields[access.ExtensionKey].(string)
		want, ok := expect[access.Level(level)]
		if !ok {
			continue
		}
		checked[access.Level(level)]++

		// {gameID} is the fixture game, and a resource mount's own ID is its
		// fixture row. Any other ID names nothing, which is fine: the gate
		// runs before the handler looks it up.
		mount := "/" + strings.SplitN(strings.TrimPrefix(op.path, "/"), "/", 2)[0]
		url := "/api/v1" + pathParam.ReplaceAllStringFunc(op.path, func(p string) string {
			if p == "{gameID}" {
				return fmt.Sprint(game.ID)
			}
			if id, ok := resourceIDs[mount+"/"+p]; ok {
				return fmt.Sprint(id)
			}
			return "999999"
		})

		for _, role := range want.refused {
			t.Run(fmt.Sprintf("%s refused %s %s", role, op.method, op.path), func(t *testing.T) {
				code, detail := call(op.method, url, role)
				// EqualFold: the problem formatter capitalizes every detail.
				if code != http.StatusForbidden || !strings.EqualFold(detail, access.ForbiddenMessage(access.Level(level))) {
					t.Errorf("%s (%s, level %s): got %d %q, want 403 from the access middleware",
						op.id, role, level, code, detail)
				}
			})
		}
		if op.method != http.MethodGet {
			continue
		}
		for _, role := range want.admitted {
			t.Run(fmt.Sprintf("%s admitted %s %s", role, op.method, op.path), func(t *testing.T) {
				// Only the gate's own refusal counts: a handler may still 403 or
				// 404 the placeholder IDs, which says nothing about the gate.
				code, detail := call(op.method, url, role)
				refusedByGate := code == http.StatusForbidden && strings.EqualFold(detail, access.ForbiddenMessage(access.Level(level)))
				if refusedByGate || code == http.StatusUnauthorized {
					t.Errorf("%s (%s, level %s): got %d %q, want the gate to admit", op.id, role, level, code, detail)
				}
			})
		}
	}
	for level := range expect {
		if checked[level] == 0 {
			t.Errorf("no %s routes found in the spec; the matrix checked nothing for that level", level)
		}
	}
}
