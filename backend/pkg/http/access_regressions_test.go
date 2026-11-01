package http

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
)

// routerFixture is the real router plus a way to call it as a given user.
type routerFixture struct {
	t       *testing.T
	testDB  *core.TestDatabase
	router  http.Handler
	queries *models.Queries
	app     *core.App
}

func newRouterFixture(t *testing.T) *routerFixture {
	t.Helper()
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping integration test - SKIP_DB_TESTS=true")
	}
	testDB := core.NewTestDatabase(t)
	t.Cleanup(testDB.Close)
	app := core.NewTestApp(testDB.Pool)
	router, _ := (&Handler{App: app}).Router()
	return &routerFixture{t: t, testDB: testDB, router: router, queries: models.New(testDB.Pool), app: app}
}

// token returns a JWT with the server-side session the full router checks.
func (f *routerFixture) token(u *core.User) string {
	f.t.Helper()
	tok, err := core.CreateTestJWTTokenForUser(f.app, u)
	if err != nil {
		f.t.Fatalf("token: %v", err)
	}
	if _, err := f.queries.CreateSession(context.Background(), models.CreateSessionParams{
		UserID: int32(u.ID), Data: tok,
		Expires: pgtype.Timestamptz{Time: time.Now().Add(time.Hour), Valid: true},
	}); err != nil {
		f.t.Fatalf("session: %v", err)
	}
	return tok
}

func (f *routerFixture) call(method, url, tok, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, url, bytes.NewReader([]byte(body)))
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

// A post's author keeps the right to edit it after leaving the GM role. The
// handler's author check is the rule; the declared level must not narrow it
// to current GMs.
func TestPostAuthorEditsAfterLeavingGMRole(t *testing.T) {
	f := newRouterFixture(t)
	ctx := context.Background()

	gm := f.testDB.CreateTestUser(t, "demote_gm", "demote_gm@example.com")
	coGM := f.testDB.CreateTestUser(t, "demote_cogm", "demote_cogm@example.com")
	game := f.testDB.CreateTestGame(t, int32(gm.ID), "Demotion Game")
	f.testDB.SetGameStateDirectly(t, game.ID, core.GameStateInProgress)
	games := &db.GameService{DB: f.testDB.Pool, Logger: f.app.ObsLogger}
	if _, err := games.AddGameParticipant(ctx, game.ID, int32(coGM.ID), "co_gm"); err != nil {
		t.Fatalf("add co-GM: %v", err)
	}
	npc, err := f.queries.CreateCharacter(ctx, models.CreateCharacterParams{
		GameID: game.ID, Name: "Narrator", CharacterType: "npc", Status: "approved",
	})
	if err != nil {
		t.Fatalf("character: %v", err)
	}
	f.testDB.CreateTestPhase(t, game.ID, "common_room", "Demotion Phase")
	post := f.testDB.CreateTestPost(t, game.ID, int32(coGM.ID), npc.ID, "Original")

	if _, err := f.testDB.Pool.Exec(ctx,
		"UPDATE game_participants SET role = 'audience' WHERE game_id = $1 AND user_id = $2", game.ID, coGM.ID); err != nil {
		t.Fatalf("demote: %v", err)
	}

	rec := f.call(http.MethodPatch, fmt.Sprintf("/api/v1/games/%d/posts/%d", game.ID, post.ID), f.token(coGM), `{"content":"Edited after demotion"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("author editing own post after demotion: got %d %s, want 200", rec.Code, rec.Body.String())
	}
}

// Every route on a resource mount that names a row 404s once the row's game
// is soft-deleted, at every level. Public routes used to skip the lookup, so
// each public handler had to repeat the check itself.
func TestDeletedGameHidesEveryResourceRoute(t *testing.T) {
	f := newRouterFixture(t)
	ctx := context.Background()

	gm := f.testDB.CreateTestUser(t, "deleted_gm", "deleted_gm@example.com")
	game := f.testDB.CreateTestGame(t, int32(gm.ID), "Deleted Game")
	f.testDB.SetGameStateDirectly(t, game.ID, core.GameStateInProgress)
	future := pgtype.Timestamptz{Time: time.Now().Add(48 * time.Hour), Valid: true}
	character, err := f.queries.CreateCharacter(ctx, models.CreateCharacterParams{
		GameID: game.ID, UserID: pgtype.Int4{Int32: int32(gm.ID), Valid: true},
		Name: "Ghost", CharacterType: "npc", Status: "approved",
	})
	if err != nil {
		t.Fatalf("character: %v", err)
	}
	phase := f.testDB.CreateTestPhase(t, game.ID, "common_room", "Deleted Phase")
	deadline, err := f.queries.CreateDeadline(ctx, models.CreateDeadlineParams{
		GameID: game.ID, Title: "Deleted deadline", Deadline: future, CreatedByUserID: int32(gm.ID),
	})
	if err != nil {
		t.Fatalf("deadline: %v", err)
	}
	poll, err := f.queries.CreatePoll(ctx, models.CreatePollParams{
		GameID: game.ID, CreatedByUserID: int32(gm.ID), Question: "Gone?", Deadline: future,
		ShowIndividualVotes: pgtype.Bool{Valid: true}, AllowOtherOption: pgtype.Bool{Valid: true},
	})
	if err != nil {
		t.Fatalf("poll: %v", err)
	}
	export, err := f.queries.CreateGameExport(ctx, models.CreateGameExportParams{
		GameID: game.ID, RequestedByUserID: pgtype.Int4{Int32: int32(gm.ID), Valid: true},
	})
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	if _, err := f.testDB.Pool.Exec(ctx, "UPDATE games SET deleted_at = NOW() WHERE id = $1", game.ID); err != nil {
		t.Fatalf("soft-delete: %v", err)
	}
	resourceIDs := map[string]int32{
		"/characters/{id}":        character.ID,
		"/phases/{id}":            phase.ID,
		"/deadlines/{deadlineId}": deadline.ID,
		"/polls/{pollId}":         poll.ID,
		"/exports/{exportID}":     export.ID,
	}
	tok := f.token(gm)

	checked := 0
	for _, op := range specOperations(t) {
		if !hasPathPrefix(op.path, resourceRoutePrefixes) {
			continue
		}
		mount := "/" + strings.SplitN(strings.TrimPrefix(op.path, "/"), "/", 2)[0]
		named := false
		url := "/api/v1" + pathParam.ReplaceAllStringFunc(op.path, func(p string) string {
			if id, ok := resourceIDs[mount+"/"+p]; ok {
				named = true
				return fmt.Sprint(id)
			}
			return "999999"
		})
		if !named {
			continue // a cross-game list on the mount; it names no row
		}
		checked++
		t.Run(fmt.Sprintf("%s %s", op.method, op.path), func(t *testing.T) {
			if rec := f.call(op.method, url, tok, "{}"); rec.Code != http.StatusNotFound {
				t.Errorf("%s on a soft-deleted game's row: got %d %s, want 404", op.id, rec.Code, rec.Body.String())
			}
		})
	}
	if checked == 0 {
		t.Fatal("no resource routes found; the check covered nothing")
	}
}

// Another player's unapproved character is concealed in a running game on
// every single-character read: record, sheet, stats and post history. A 200
// from any one of them confirms an ID the others deny.
func TestUnapprovedCharacterConcealedOnEveryProfileRead(t *testing.T) {
	f := newRouterFixture(t)
	ctx := context.Background()

	gm := f.testDB.CreateTestUser(t, "pending_gm", "pending_gm@example.com")
	owner := f.testDB.CreateTestUser(t, "pending_owner", "pending_owner@example.com")
	other := f.testDB.CreateTestUser(t, "pending_other", "pending_other@example.com")
	game := f.testDB.CreateTestGame(t, int32(gm.ID), "Pending Game")
	f.testDB.SetGameStateDirectly(t, game.ID, core.GameStateInProgress)
	games := &db.GameService{DB: f.testDB.Pool, Logger: f.app.ObsLogger}
	for _, u := range []*core.User{owner, other} {
		if _, err := games.AddGameParticipant(ctx, game.ID, int32(u.ID), "player"); err != nil {
			t.Fatalf("add player: %v", err)
		}
	}
	pending, err := f.queries.CreateCharacter(ctx, models.CreateCharacterParams{
		GameID: game.ID, UserID: pgtype.Int4{Int32: int32(owner.ID), Valid: true},
		Name: "Not Yet", CharacterType: "player_character", Status: "pending",
	})
	if err != nil {
		t.Fatalf("character: %v", err)
	}

	paths := []string{"", "/data", "/stats", "/comments"}
	for role, want := range map[string]struct {
		user *core.User
		code int
	}{
		"other player": {other, http.StatusNotFound},
		"owner":        {owner, http.StatusOK},
		"GM":           {gm, http.StatusOK},
	} {
		tok := f.token(want.user)
		for _, suffix := range paths {
			url := fmt.Sprintf("/api/v1/characters/%d%s", pending.ID, suffix)
			if rec := f.call(http.MethodGet, url, tok, ""); rec.Code != want.code {
				t.Errorf("%s GET %s: got %d %s, want %d", role, url, rec.Code, rec.Body.String(), want.code)
			}
		}
	}
}
