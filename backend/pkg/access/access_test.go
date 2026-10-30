package access

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humachi"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// fakeChecker answers the participant lookups from fixed values.
type fakeChecker struct {
	audience, member bool
	err              error
}

func (f fakeChecker) CheckAudienceAccess(context.Context, int32, int32) (bool, error) {
	return f.audience, f.err
}
func (f fakeChecker) IsActiveParticipant(context.Context, int32, int32) (bool, error) {
	return f.member, f.err
}

var user = &core.AuthenticatedUser{ID: 7}

func game(state string) *models.Game { return &models.Game{ID: 1, State: state} }

// TestAllows pins each level against the role that motivated it. The case that
// matters most is the first: a player of an active game is IN the game, and
// must still be refused the audience level.
func TestAllows(t *testing.T) {
	player := fakeChecker{member: true}
	audience := fakeChecker{member: true, audience: true}
	outsider := fakeChecker{}

	cases := []struct {
		name    string
		level   Level
		checker fakeChecker
		state   string
		isGM    bool
		want    bool
	}{
		{"player refused audience level in active game", Audience, player, core.GameStateInProgress, false, false},
		{"audience member allowed audience level", Audience, audience, core.GameStateInProgress, false, true},
		{"anyone allowed audience level in completed game", Audience, outsider, core.GameStateCompleted, false, true},
		{"anyone allowed audience level in epilogue", Audience, outsider, core.GameStateEpilogue, false, true},
		{"cancelled game is not an archive", Audience, player, core.GameStateCancelled, false, false},
		// is_gm is also a site admin in admin mode, who holds no participant row.
		{"GM flag allowed audience level", Audience, outsider, core.GameStateInProgress, true, true},

		{"player refused GM level", GM, player, core.GameStateInProgress, false, false},
		{"audience refused GM level", GM, audience, core.GameStateInProgress, false, false},
		{"GM flag allowed GM level", GM, outsider, core.GameStateInProgress, true, true},
		{"archive does not open GM level", GM, outsider, core.GameStateCompleted, false, false},

		{"player allowed member level", Member, player, core.GameStateInProgress, false, true},
		{"outsider refused member level", Member, outsider, core.GameStateInProgress, false, false},
		{"GM flag allowed member level", Member, outsider, core.GameStateInProgress, true, true},
		{"anyone allowed member level in archive", Member, outsider, core.GameStateCompleted, false, true},

		{"public always allowed", Public, outsider, core.GameStateInProgress, false, true},
		{"handler level always allowed here", Handler, outsider, core.GameStateInProgress, false, true},
		{"unknown level denied", Level("players"), audience, core.GameStateInProgress, true, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := Allows(context.Background(), c.checker, c.level, game(c.state), user, c.isGM)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != c.want {
				t.Errorf("Allows = %v, want %v", got, c.want)
			}
		})
	}

	t.Run("no user is denied a gated level", func(t *testing.T) {
		got, _ := Allows(context.Background(), audience, Audience, game(core.GameStateInProgress), nil, true)
		if got {
			t.Error("an unauthenticated caller must not pass")
		}
	})

	t.Run("lookup error is returned, not treated as allowed", func(t *testing.T) {
		got, err := Allows(context.Background(), fakeChecker{err: errors.New("db down")}, Audience, game(core.GameStateInProgress), user, false)
		if err == nil || got {
			t.Errorf("got (%v, %v), want (false, error)", got, err)
		}
	})
}

// TestMiddleware drives the middleware through a real huma API, checking the
// fail-closed paths that Allows alone can't show.
func TestMiddleware(t *testing.T) {
	app := core.NewTestApp(nil)

	newServer := func(checker Checker, isGM bool) http.Handler {
		r := chi.NewRouter()
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				ctx := context.WithValue(req.Context(), "game", game(core.GameStateInProgress))
				ctx = context.WithValue(ctx, "is_gm", isGM)
				ctx = context.WithValue(ctx, core.UserContextKey, user)
				next.ServeHTTP(w, req.WithContext(ctx))
			})
		})
		api := humachi.New(r, huma.DefaultConfig("test", "1"))
		api.UseMiddleware(Middleware(api, app, checker))

		type out struct{ Body struct{ OK bool } }
		ok := func(context.Context, *struct{}) (*out, error) { return &out{}, nil }
		register := func(id, path string, ext map[string]any) {
			huma.Register(api, huma.Operation{OperationID: id, Method: http.MethodGet, Path: path, Extensions: ext}, ok)
		}
		register("audienceRoute", "/audience", AudienceOnly())
		register("gmRoute", "/gm", GMOnly())
		register("memberRoute", "/member", MembersOnly())
		register("publicRoute", "/public", PublicRoute("test"))
		register("undeclaredRoute", "/undeclared", nil)
		return r
	}

	get := func(h http.Handler, path string) int {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec.Code
	}

	player := newServer(fakeChecker{member: true}, false)
	if code := get(player, "/audience"); code != http.StatusForbidden {
		t.Errorf("player on audience route: got %d, want 403", code)
	}
	if code := get(player, "/gm"); code != http.StatusForbidden {
		t.Errorf("player on GM route: got %d, want 403", code)
	}
	if code := get(player, "/member"); code != http.StatusOK {
		t.Errorf("player on member route: got %d, want 200", code)
	}
	if code := get(player, "/undeclared"); code != http.StatusInternalServerError {
		t.Errorf("undeclared route must fail closed: got %d, want 500", code)
	}

	outsider := newServer(fakeChecker{}, false)
	if code := get(outsider, "/member"); code != http.StatusForbidden {
		t.Errorf("outsider on member route: got %d, want 403", code)
	}
	if code := get(outsider, "/public"); code != http.StatusOK {
		t.Errorf("outsider on public route: got %d, want 200", code)
	}

	gm := newServer(fakeChecker{member: true, audience: true}, true)
	if code := get(gm, "/gm"); code != http.StatusOK {
		t.Errorf("GM on GM route: got %d, want 200", code)
	}
	if code := get(gm, "/audience"); code != http.StatusOK {
		t.Errorf("GM on audience route: got %d, want 200", code)
	}

	broken := newServer(fakeChecker{err: errors.New("db down")}, false)
	if code := get(broken, "/audience"); code != http.StatusInternalServerError {
		t.Errorf("lookup failure must not allow: got %d, want 500", code)
	}
}

// fakeResourceChecker adds the game lookup and GM flag ResourceMiddleware
// needs, and records which game it was asked for.
type fakeResourceChecker struct {
	fakeChecker
	isGM      bool
	gameErr   error
	askedGame *int32
}

func (f fakeResourceChecker) GetGame(_ context.Context, gameID int32) (*models.Game, error) {
	*f.askedGame = gameID
	if f.gameErr != nil {
		return nil, f.gameErr
	}
	return &models.Game{ID: gameID, State: core.GameStateInProgress}, nil
}
func (f fakeResourceChecker) IsGameMaster(context.Context, *models.Game, *core.AuthenticatedUser) bool {
	return f.isGM
}

// TestResourceMiddleware checks the lookup half: the game comes from the row
// the path names, and every way that lookup can fail refuses.
func TestResourceMiddleware(t *testing.T) {
	app := core.NewTestApp(nil)
	const rowGame = int32(42)

	type server struct {
		h         http.Handler
		lookups   *int
		askedGame *int32
	}
	newServer := func(checker fakeResourceChecker, gameOf func(context.Context, int32) (int32, error)) server {
		lookups, asked := 0, int32(0)
		checker.askedGame = &asked
		r := chi.NewRouter()
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				next.ServeHTTP(w, req.WithContext(context.WithValue(req.Context(), core.UserContextKey, user)))
			})
		})
		api := humachi.New(r, huma.DefaultConfig("test", "1"))
		api.UseMiddleware(ResourceMiddleware(api, app, checker, Resource{
			Name: "widget", Param: "id",
			GameOf: func(ctx context.Context, id int32) (int32, error) {
				lookups++
				return gameOf(ctx, id)
			},
		}))

		type out struct{ Body struct{ OK bool } }
		ok := func(context.Context, *struct{}) (*out, error) { return &out{}, nil }
		register := func(id, path string, ext map[string]any) {
			huma.Register(api, huma.Operation{OperationID: id, Method: http.MethodGet, Path: path, Extensions: ext}, ok)
		}
		register("gmWidget", "/{id}/gm", GMOnly())
		register("memberWidget", "/{id}/member", MembersOnly())
		register("publicWidget", "/{id}/public", PublicRoute("test"))
		register("publicList", "/list", PublicRoute("test"))
		register("memberList", "/member-list", MembersOnly())
		register("undeclaredWidget", "/{id}/undeclared", nil)
		return server{r, &lookups, &asked}
	}
	found := func(context.Context, int32) (int32, error) { return rowGame, nil }
	get := func(s server, path string) int {
		rec := httptest.NewRecorder()
		s.h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec.Code
	}

	player := newServer(fakeResourceChecker{fakeChecker: fakeChecker{member: true}}, found)
	if code := get(player, "/5/gm"); code != http.StatusForbidden {
		t.Errorf("player on GM route: got %d, want 403", code)
	}
	if *player.askedGame != rowGame {
		t.Errorf("checked game %d, want %d: the level must be checked against the row's own game", *player.askedGame, rowGame)
	}
	if code := get(player, "/5/member"); code != http.StatusOK {
		t.Errorf("player on member route: got %d, want 200", code)
	}
	if code := get(player, "/5/undeclared"); code != http.StatusInternalServerError {
		t.Errorf("undeclared route must fail closed: got %d, want 500", code)
	}

	gm := newServer(fakeResourceChecker{isGM: true}, found)
	if code := get(gm, "/5/gm"); code != http.StatusOK {
		t.Errorf("GM on GM route: got %d, want 200", code)
	}

	outsider := newServer(fakeResourceChecker{}, found)
	if code := get(outsider, "/5/member"); code != http.StatusForbidden {
		t.Errorf("outsider on member route: got %d, want 403", code)
	}
	if code := get(outsider, "/5/public"); code != http.StatusOK {
		t.Errorf("outsider on public route: got %d, want 200", code)
	}
	before := *outsider.lookups
	if code := get(outsider, "/list"); code != http.StatusOK {
		t.Errorf("public route with no ID: got %d, want 200", code)
	}
	if *outsider.lookups != before {
		t.Error("a route with no ID has no row to look up")
	}
	if code := get(outsider, "/member-list"); code != http.StatusInternalServerError {
		t.Errorf("gated route with no ID to resolve must fail closed: got %d, want 500", code)
	}
	if code := get(outsider, "/abc/member"); code != http.StatusUnprocessableEntity {
		t.Errorf("unparseable ID: got %d, want 422", code)
	}

	missing := newServer(fakeResourceChecker{fakeChecker: fakeChecker{member: true}},
		func(context.Context, int32) (int32, error) { return 0, pgx.ErrNoRows })
	if code := get(missing, "/5/member"); code != http.StatusNotFound {
		t.Errorf("missing row: got %d, want 404", code)
	}

	broken := newServer(fakeResourceChecker{fakeChecker: fakeChecker{member: true}},
		func(context.Context, int32) (int32, error) { return 0, errors.New("db down") })
	if code := get(broken, "/5/member"); code != http.StatusInternalServerError {
		t.Errorf("row lookup failure must not allow: got %d, want 500", code)
	}

	deletedGame := newServer(fakeResourceChecker{fakeChecker: fakeChecker{member: true}, gameErr: pgx.ErrNoRows}, found)
	if code := get(deletedGame, "/5/member"); code != http.StatusNotFound {
		t.Errorf("row in a soft-deleted game: got %d, want 404", code)
	}
	// Public routes name rows too: the deleted-game 404 must not depend on
	// each public handler remembering to repeat it.
	if code := get(deletedGame, "/5/public"); code != http.StatusNotFound {
		t.Errorf("public route on a row in a soft-deleted game: got %d, want 404", code)
	}
	if code := get(missing, "/5/public"); code != http.StatusNotFound {
		t.Errorf("public route on a missing row: got %d, want 404", code)
	}
}

// TestResourceMiddlewareContext checks the middleware hands the handler the
// game and GM flag it resolved, under GameMiddleware's keys, so handlers do
// not load them a second time.
func TestResourceMiddlewareContext(t *testing.T) {
	app := core.NewTestApp(nil)
	asked := int32(0)
	checker := fakeResourceChecker{isGM: true, askedGame: &asked}

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req.WithContext(context.WithValue(req.Context(), core.UserContextKey, user)))
		})
	})
	api := humachi.New(r, huma.DefaultConfig("test", "1"))
	api.UseMiddleware(ResourceMiddleware(api, app, checker, Resource{
		Name: "widget", Param: "id",
		GameOf: func(context.Context, int32) (int32, error) { return 42, nil },
	}))

	var gotGame *models.Game
	var gotGameID int32
	var gotGM bool
	type out struct{ Body struct{ OK bool } }
	huma.Register(api, huma.Operation{OperationID: "w", Method: http.MethodGet, Path: "/{id}", Extensions: PublicRoute("test")},
		func(ctx context.Context, _ *struct{}) (*out, error) {
			gotGame, _ = ctx.Value("game").(*models.Game)
			gotGameID, _ = ctx.Value("gameID").(int32)
			gotGM, _ = ctx.Value("is_gm").(bool)
			return &out{}, nil
		})

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/5", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d, want 200", rec.Code)
	}
	if gotGame == nil || gotGame.ID != 42 || gotGameID != 42 || !gotGM {
		t.Errorf("context: game=%v gameID=%d is_gm=%v, want game 42 and is_gm true", gotGame, gotGameID, gotGM)
	}
}

func TestChildParams(t *testing.T) {
	for _, path := range []string{"/handouts/{handoutId}/comments/{commentId}", "/games/{gameID}/handouts/{handoutId}/comments/{commentId}"} {
		got := ChildParams(path)
		want := []ChildParam{
			{Shape: "/handouts/{handoutId}", Name: "handoutId"},
			{Shape: "/handouts/{handoutId}/comments/{commentId}", Name: "commentId"},
		}
		if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
			t.Errorf("ChildParams(%q) = %+v, want %+v", path, got, want)
		}
	}
}

// TestChildScope checks the fail-closed paths of the child-ID check.
func TestChildScope(t *testing.T) {
	app := core.NewTestApp(nil)
	const home = int32(1)

	newServer := func(resolve func(context.Context, int32) (int32, error)) http.Handler {
		r := chi.NewRouter()
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				next.ServeHTTP(w, req.WithContext(context.WithValue(req.Context(), "game", game(core.GameStateInProgress))))
			})
		})
		api := humachi.New(r, huma.DefaultConfig("test", "1"))
		api.UseMiddleware(ChildScope(api, app,
			map[string]Child{
				"/widgets/{widgetId}": {Kind: "widget"},
				"/people/{userId}":    {},
				// Misconfigured: nested, but first in the path.
				"/orphans/{orphanId}": {Kind: "widget", InParent: true},
			},
			map[string]func(context.Context, int32) (int32, error){"widget": resolve}))

		type out struct{ Body struct{ OK bool } }
		ok := func(context.Context, *struct{}) (*out, error) { return &out{}, nil }
		for id, path := range map[string]string{
			"widget": "/widgets/{widgetId}", "person": "/people/{userId}",
			"gadget": "/gadgets/{gadgetId}", "plain": "/plain", "orphan": "/orphans/{orphanId}",
		} {
			huma.Register(api, huma.Operation{OperationID: id, Method: http.MethodGet, Path: path}, ok)
		}
		return r
	}
	get := func(h http.Handler, path string) int {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		return rec.Code
	}
	owned := newServer(func(context.Context, int32) (int32, error) { return home, nil })
	foreign := newServer(func(context.Context, int32) (int32, error) { return home + 1, nil })
	missing := newServer(func(context.Context, int32) (int32, error) { return 0, pgx.ErrNoRows })
	broken := newServer(func(context.Context, int32) (int32, error) { return 0, errors.New("db down") })

	cases := []struct {
		name string
		h    http.Handler
		path string
		want int
	}{
		{"own row passes", owned, "/widgets/5", http.StatusOK},
		{"another game's row is not found", foreign, "/widgets/5", http.StatusNotFound},
		{"missing row is not found", missing, "/widgets/5", http.StatusNotFound},
		{"lookup failure does not pass", broken, "/widgets/5", http.StatusInternalServerError},
		{"unparseable ID", owned, "/widgets/abc", http.StatusUnprocessableEntity},
		{"an ID that names no game row is not looked up", broken, "/people/5", http.StatusOK},
		{"unmapped shape fails closed", owned, "/gadgets/5", http.StatusInternalServerError},
		{"route with no child ID passes", broken, "/plain", http.StatusOK},
		{"nested kind with no parent in the path fails closed", owned, "/orphans/5", http.StatusInternalServerError},
	}
	for _, c := range cases {
		if got := get(c.h, c.path); got != c.want {
			t.Errorf("%s: got %d, want %d", c.name, got, c.want)
		}
	}
}

// TestChildScopeParent checks a nested ID must belong to the ID before it, not
// just to the game: a part of widget 6 is refused under widget 5 even though
// both widgets are in the game.
func TestChildScopeParent(t *testing.T) {
	app := core.NewTestApp(nil)
	const home = int32(1)
	// Part 10 is on widget 5, part 11 on widget 6; both widgets are in home.
	partOwner := map[int32]int32{10: 5, 11: 6}

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req.WithContext(context.WithValue(req.Context(), "game", game(core.GameStateInProgress))))
		})
	})
	api := humachi.New(r, huma.DefaultConfig("test", "1"))
	api.UseMiddleware(ChildScope(api, app,
		map[string]Child{
			"/widgets/{widgetId}":                {Kind: "widget"},
			"/widgets/{widgetId}/parts/{partId}": {Kind: "part", InParent: true},
		},
		map[string]func(context.Context, int32) (int32, error){
			"widget": func(context.Context, int32) (int32, error) { return home, nil },
			"part": func(_ context.Context, id int32) (int32, error) {
				if w, ok := partOwner[id]; ok {
					return w, nil
				}
				return 0, pgx.ErrNoRows
			},
		}))
	type out struct{ Body struct{ OK bool } }
	huma.Register(api, huma.Operation{OperationID: "part", Method: http.MethodGet, Path: "/widgets/{widgetId}/parts/{partId}"},
		func(context.Context, *struct{}) (*out, error) { return &out{}, nil })

	for _, c := range []struct {
		name, path string
		want       int
	}{
		{"part of the named widget passes", "/widgets/5/parts/10", http.StatusOK},
		{"part of a sibling widget in the same game is not found", "/widgets/5/parts/11", http.StatusNotFound},
		{"missing part is not found", "/widgets/5/parts/99", http.StatusNotFound},
	} {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, c.path, nil))
		if rec.Code != c.want {
			t.Errorf("%s: got %d, want %d", c.name, rec.Code, c.want)
		}
	}
}
