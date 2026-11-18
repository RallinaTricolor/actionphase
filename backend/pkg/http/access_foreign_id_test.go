package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"actionphase/pkg/access"
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// TestChildIDsMustBelongToTheGame is the foreign-ID half of pkg/access.
// It also calls every nested route (/posts/{postId}/comments/{commentId})
// with a child from a sibling parent in the same game, which only the
// parent link refuses.
// The
// level gate admits a GM to every route of their own game; this checks that
// they cannot then name another game's row inside it, e.g. edit someone
// else's handout via /games/{theirGame}/handouts/{otherGamesHandout}.
//
// Every child-ID route is called as the home game's GM, with {gameID} = home
// and every child ID taken from a second game. Each must be refused with the
// child-scope 404 -- on every method, since a refused request never reaches
// the handler. A control pass with the home game's own IDs proves the check
// is not simply refusing everything.
func TestChildIDsMustBelongToTheGame(t *testing.T) {
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

	homeGM := testDB.CreateTestUser(t, "foreign_home_gm", "foreign_home_gm@example.com")
	otherGM := testDB.CreateTestUser(t, "foreign_other_gm", "foreign_other_gm@example.com")
	home := testDB.CreateTestGame(t, int32(homeGM.ID), "Home Game")
	other := testDB.CreateTestGame(t, int32(otherGM.ID), "Other Game")
	homeRows := seedChildRows(t, testDB, queries, home, homeGM, "home")
	otherRows := seedChildRows(t, testDB, queries, other, otherGM, "other")
	// A second set in the home game: the same game, different parents.
	siblingRows := seedChildRows(t, testDB, queries, home, homeGM, "sibling")

	tok, err := core.CreateTestJWTTokenForUser(app, homeGM)
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	if _, err := queries.CreateSession(ctx, models.CreateSessionParams{
		UserID: int32(homeGM.ID), Data: tok,
		Expires: pgtype.Timestamptz{Time: time.Now().Add(time.Hour), Valid: true},
	}); err != nil {
		t.Fatalf("session: %v", err)
	}

	call := func(method, url string) (int, string) {
		body := []byte("{}")
		if method == http.MethodGet || method == http.MethodDelete {
			body = nil
		}
		req := httptest.NewRequest(method, url, bytes.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+tok)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		var problem struct {
			Detail string `json:"detail"`
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &problem)
		return rec.Code, problem.Detail
	}

	// Each lookup must name the right table: a home row resolves to home, and
	// a nested row to its parent.
	ownerOf := h.childOwnerOf()
	for shape, child := range childParams {
		if child.Kind == "" {
			continue
		}
		want := home.ID
		if child.InParent {
			params := access.ChildParams(shape)
			want = homeRows[childParams[params[len(params)-2].Shape].Kind]
		}
		got, err := ownerOf[child.Kind](ctx, homeRows[child.Kind])
		if err != nil || got != want {
			t.Errorf("%s %d resolved to %d (%v), want %d", child.Kind, homeRows[child.Kind], got, err, want)
		}
	}

	checked := 0
	for _, op := range specOperations(t) {
		if !isGameScoped(op.path) {
			continue
		}
		kinds := childKinds(t, op.path)
		if len(kinds) == 0 {
			continue
		}
		// url fills each child ID from rowsAt(its index in the path).
		urlFrom := func(game int32, rowsAt func(i int) map[string]int32) string {
			rel := op.path[strings.Index(op.path, "{gameID}"):]
			i := 0
			out := pathParam.ReplaceAllStringFunc(rel, func(p string) string {
				if p == "{gameID}" {
					return fmt.Sprint(game)
				}
				kind := kinds[i]
				rows := rowsAt(i)
				i++
				if kind == "" {
					return "999999"
				}
				return fmt.Sprint(rows[kind])
			})
			return "/api/v1/games/" + out
		}
		url := func(game int32, rows map[string]int32) string {
			return urlFrom(game, func(int) map[string]int32 { return rows })
		}
		// The check refuses on the first foreign ID in path order, so that
		// kind names the refusal. A route whose only ID is a user has none.
		first := ""
		for _, k := range kinds {
			if k != "" {
				first = k
				break
			}
		}
		if first == "" {
			continue
		}
		checked++

		t.Run(fmt.Sprintf("foreign %s %s", op.method, op.path), func(t *testing.T) {
			code, detail := call(op.method, url(home.ID, otherRows))
			if code != http.StatusNotFound || !strings.EqualFold(detail, access.NotInGameMessage(first)) {
				t.Errorf("%s with another game's IDs: got %d %q, want 404 %q from the child-scope check",
					op.id, code, detail, access.NotInGameMessage(first))
			}
		})
		// A nested ID from a sibling parent in the same game: the parent is
		// the home game's own, so only the parent link can refuse it.
		if last := access.ChildParams(op.path); len(last) > 0 && childParams[last[len(last)-1].Shape].InParent {
			nested := kinds[len(kinds)-1]
			t.Run(fmt.Sprintf("sibling-parent %s %s", op.method, op.path), func(t *testing.T) {
				code, detail := call(op.method, urlFrom(home.ID, func(i int) map[string]int32 {
					if i == len(kinds)-1 {
						return siblingRows
					}
					return homeRows
				}))
				if code != http.StatusNotFound || !strings.EqualFold(detail, access.NotInGameMessage(nested)) {
					t.Errorf("%s with a %s from another parent: got %d %q, want 404 %q from the child-scope check",
						op.id, nested, code, detail, access.NotInGameMessage(nested))
				}
			})
		}
		if op.method == http.MethodGet {
			t.Run(fmt.Sprintf("own %s %s", op.method, op.path), func(t *testing.T) {
				code, detail := call(op.method, url(home.ID, homeRows))
				if code == http.StatusNotFound && strings.HasSuffix(strings.ToLower(detail), "not found in this game") {
					t.Errorf("%s with the game's own IDs was refused: %d %q", op.id, code, detail)
				}
			})
		}
	}
	if checked == 0 {
		t.Fatal("no child-ID routes found; the check covered nothing")
	}
}

// childKinds returns the kind of row each non-gameID path parameter names, in
// path order, failing the test on a shape childParams does not know.
func childKinds(t *testing.T, path string) []string {
	t.Helper()
	var kinds []string
	for _, child := range access.ChildParams(path) {
		c, ok := childParams[child.Shape]
		if !ok {
			t.Errorf("%s: no childParams entry for %q", path, child.Shape)
		}
		kinds = append(kinds, c.Kind)
	}
	return kinds
}

// seedChildRows creates one row of every kind in childParams in game.
func seedChildRows(t *testing.T, testDB *core.TestDatabase, q *models.Queries, game *models.Game, gm *core.User, tag string) map[string]int32 {
	t.Helper()
	ctx := context.Background()
	must := func(err error, what string) {
		if err != nil {
			t.Fatalf("%s: create %s: %v", tag, what, err)
		}
	}
	applicant := testDB.CreateTestUser(t, tag+"_applicant", tag+"_applicant@example.com")
	app, err := q.CreateGameApplication(ctx, models.CreateGameApplicationParams{GameID: game.ID, UserID: int32(applicant.ID), Role: "player"})
	must(err, "application")
	testDB.SetGameStateDirectly(t, game.ID, core.GameStateInProgress)

	character, err := q.CreateCharacter(ctx, models.CreateCharacterParams{
		GameID: game.ID, UserID: pgtype.Int4{Int32: int32(gm.ID), Valid: true},
		Name: tag + " NPC", CharacterType: "npc", Status: "approved",
	})
	must(err, "character")
	phase := testDB.CreateTestPhase(t, game.ID, "common_room", tag+" phase")
	post := testDB.CreateTestPost(t, game.ID, int32(gm.ID), character.ID, tag+" post")
	comment, err := q.CreateComment(ctx, models.CreateCommentParams{
		GameID: game.ID, AuthorID: int32(gm.ID), CharacterID: character.ID, Content: tag + " comment",
		ParentID: pgtype.Int4{Int32: post.ID, Valid: true}, Visibility: models.MessageVisibilityGame,
		MentionedCharacterIds: []int32{},
	})
	must(err, "comment")
	handout, err := q.CreateHandout(ctx, models.CreateHandoutParams{GameID: game.ID, Title: tag, Content: tag, Status: "published"})
	must(err, "handout")
	handoutComment, err := q.CreateHandoutComment(ctx, models.CreateHandoutCommentParams{HandoutID: handout.ID, UserID: int32(gm.ID), Content: tag})
	must(err, "handout comment")
	conversation, err := q.CreateConversation(ctx, models.CreateConversationParams{GameID: game.ID, ConversationType: "direct", CreatedByUserID: int32(gm.ID)})
	must(err, "conversation")
	privateMessage, err := q.SendPrivateMessage(ctx, models.SendPrivateMessageParams{ConversationID: conversation.ID, SenderUserID: int32(gm.ID), Content: tag})
	must(err, "private message")
	result, err := q.CreateActionResult(ctx, models.CreateActionResultParams{
		GameID: game.ID, UserID: int32(gm.ID), PhaseID: phase.ID, GmUserID: int32(gm.ID), Content: tag,
		IsPublished: pgtype.Bool{Valid: true},
	})
	must(err, "action result")
	update, err := q.CreateDraftCharacterUpdate(ctx, models.CreateDraftCharacterUpdateParams{
		ActionResultID: result.ID, CharacterID: character.ID, ModuleType: "skills", FieldName: "Stealth",
		FieldValue: pgtype.Text{String: tag, Valid: true}, FieldType: "text", Operation: "upsert",
	})
	must(err, "character update")
	table, err := q.CreateLootTable(ctx, models.CreateLootTableParams{GameID: game.ID, Name: tag + " loot", TargetTab: "inventory"})
	must(err, "loot table")

	return map[string]int32{
		"application": app.ID, "loot table": table.ID, "character": character.ID,
		"handout": handout.ID, "handout comment": handoutComment.ID,
		"post": post.ID, "comment": comment.ID, "message": post.ID,
		"conversation": conversation.ID, "private message": privateMessage.ID,
		"phase": phase.ID, "action result": result.ID, "character update": update.ID,
	}
}
