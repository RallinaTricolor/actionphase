package access

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

var pathParam = regexp.MustCompile(`\{(\w+)\}`)

// ChildParam is one ID a game-scoped route names besides {gameID}.
type ChildParam struct {
	// Shape is the path up to and including the ID, relative to {gameID}:
	// "/handouts/{handoutId}/comments/{commentId}".
	Shape string
	// Name is the path parameter: "commentId".
	Name string
}

// ChildParams lists the IDs a path names after {gameID}, in path order. It
// accepts the path as a route registers it (relative to the /{gameID} mount)
// or as the spec prints it (/games/{gameID}/...).
func ChildParams(path string) []ChildParam {
	rel := path
	if i := strings.Index(path, "{gameID}"); i >= 0 {
		rel = path[i+len("{gameID}"):]
	}
	var out []ChildParam
	for _, m := range pathParam.FindAllStringSubmatchIndex(rel, -1) {
		out = append(out, ChildParam{Shape: rel[:m[1]], Name: rel[m[2]:m[3]]})
	}
	return out
}

// Child says what one child ID in a game-scoped path names.
type Child struct {
	// Kind is the kind of row, used in the 404 and to pick its resolver. ""
	// is an ID that names no game row (a user), so there is nothing to check.
	Kind string
	// InParent: the row belongs to the row named by the ID before it in the
	// path (a comment to its post, a message to its conversation), not merely
	// to the game. Its resolver returns that parent's ID rather than a game
	// ID. The parent is checked against {gameID} first, so matching the
	// parent also puts the child in the game.
	InParent bool
}

// ChildScope refuses a game-scoped request unless every child ID in its path
// names a row of {gameID}, and every nested ID names a row of the ID before
// it. Without it, the level gate admits a GM to their own game and the
// handler then acts on whatever row the ID names -- another game's handout,
// or a message from a different conversation than the one it checked.
//
// children maps each path shape to what it names. ownerOf resolves each kind
// to its game, or to its parent for an InParent kind, returning an error
// wrapping pgx.ErrNoRows when there is no such row. A shape or kind missing
// from either map is refused with a 500: a new child route must say what its
// ID is before it serves anything.
//
// Install it after Middleware, so a caller refused by the level never learns
// whether an ID exists. Every level is checked, Public included: a public
// route names rows too.
func ChildScope(api huma.API, app *core.App, children map[string]Child,
	ownerOf map[string]func(context.Context, int32) (int32, error)) func(huma.Context, func(huma.Context)) {
	return func(hctx huma.Context, next func(huma.Context)) {
		op := hctx.Operation()
		params := ChildParams(op.Path)
		if len(params) == 0 {
			next(hctx)
			return
		}

		ctx := hctx.Context()
		game, _ := ctx.Value("game").(*models.Game)
		if game == nil {
			app.ObsLogger.Error(ctx, "Child scope ran without a game in context", "operation_id", op.OperationID)
			_ = huma.WriteErr(api, hctx, http.StatusInternalServerError, "game not resolved")
			return
		}
		unscoped := func(p ChildParam) {
			app.ObsLogger.Error(ctx, "Child ID has no scope check; refusing",
				"operation_id", op.OperationID, "shape", p.Shape)
			_ = huma.WriteErr(api, hctx, http.StatusInternalServerError, "this route's "+p.Name+" has no access check")
		}

		// The previous ID in the path, which an InParent child must belong to.
		var parentID int32
		hasParent := false
		for _, p := range params {
			child, known := children[p.Shape]
			if known && child.Kind == "" {
				hasParent = false
				continue
			}
			resolve := ownerOf[child.Kind]
			if !known || resolve == nil || (child.InParent && !hasParent) {
				unscoped(p)
				return
			}

			parsed, err := strconv.ParseInt(hctx.Param(p.Name), 10, 32)
			if err != nil {
				_ = huma.WriteErr(api, hctx, http.StatusUnprocessableEntity, "invalid "+child.Kind+" ID")
				return
			}
			id := int32(parsed)
			want := game.ID
			if child.InParent {
				want = parentID
			}

			owner, err := resolve(ctx, id)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				app.ObsLogger.Error(ctx, "Failed to resolve the owner of a child ID",
					"error", err, "operation_id", op.OperationID, "kind", child.Kind, "id", id)
				_ = huma.WriteErr(api, hctx, http.StatusInternalServerError, "failed to check access")
				return
			}
			if err != nil || owner != want {
				if err == nil {
					// Naming another game's row, or a row under a different
					// parent, is what probing looks like.
					app.ObsLogger.Warn(ctx, "Child ID belongs to another game or parent",
						"operation_id", op.OperationID, "kind", child.Kind, "id", id,
						"game_id", game.ID, "expected_owner", want, "owner", owner)
				}
				_ = huma.WriteErr(api, hctx, http.StatusNotFound, NotInGameMessage(child.Kind))
				return
			}
			parentID, hasParent = id, true
		}

		next(hctx)
	}
}
