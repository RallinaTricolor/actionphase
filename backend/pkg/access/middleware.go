package access

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// Middleware enforces each operation's declared level. Install it on every huma
// API whose router runs GameMiddleware, immediately after creating the API:
// huma composes middleware into each operation when it is registered, so an
// operation registered before this is installed is never gated.
//
// An operation that declares no level is refused with a 500. Failing closed is
// the point: a new route must choose a level before it can serve anything.
func Middleware(api huma.API, app *core.App, checker Checker) func(huma.Context, func(huma.Context)) {
	return func(hctx huma.Context, next func(huma.Context)) {
		level, ok := declaredLevel(api, app, hctx)
		if !ok {
			return
		}
		if level == Public || level == Handler {
			next(hctx)
			return
		}

		ctx := hctx.Context()
		user := core.GetAuthenticatedUser(ctx)
		if user == nil {
			_ = huma.WriteErr(api, hctx, http.StatusUnauthorized, "authentication required")
			return
		}
		game, _ := ctx.Value("game").(*models.Game)
		if game == nil {
			app.ObsLogger.Error(ctx, "Access middleware ran without a game in context", "operation_id", hctx.Operation().OperationID)
			_ = huma.WriteErr(api, hctx, http.StatusInternalServerError, "game not resolved")
			return
		}
		isGM, _ := ctx.Value("is_gm").(bool)

		enforce(api, app, checker, hctx, next, level, game, user, isGM)
	}
}

// declaredLevel reads the operation's level, answering a 500 itself when there
// is none.
func declaredLevel(api huma.API, app *core.App, hctx huma.Context) (Level, bool) {
	op := hctx.Operation()
	level, declared := LevelOf(op)
	if declared {
		return level, true
	}
	opID := ""
	if op != nil {
		opID = op.OperationID
	}
	app.ObsLogger.Error(hctx.Context(), "Game-scoped operation declares no access level; refusing", "operation_id", opID)
	_ = huma.WriteErr(api, hctx, http.StatusInternalServerError, "this route has no declared access level")
	return "", false
}

// enforce runs Allows for a resolved game and either calls next or answers
// the refusal. Shared by both middlewares so a level means the same thing
// whether the game came from the path or from the row the path names.
func enforce(api huma.API, app *core.App, checker Checker, hctx huma.Context, next func(huma.Context),
	level Level, game *models.Game, user *core.AuthenticatedUser, isGM bool) {
	ctx := hctx.Context()
	opID := hctx.Operation().OperationID

	allowed, err := Allows(ctx, checker, level, game, user, isGM)
	if err != nil {
		app.ObsLogger.Error(ctx, "Access check failed", "error", err,
			"operation_id", opID, "game_id", game.ID, "user_id", user.ID)
		_ = huma.WriteErr(api, hctx, http.StatusInternalServerError, "failed to check access")
		return
	}
	if !allowed {
		// A participant refused by an audience or GM route is the signal
		// worth alerting on: it is what probing for other players'
		// secrets looks like.
		app.ObsLogger.Warn(ctx, "Access denied by declared level",
			"operation_id", opID, "access_level", string(level),
			"game_id", game.ID, "user_id", user.ID)
		_ = huma.WriteErr(api, hctx, http.StatusForbidden, ForbiddenMessage(level))
		return
	}

	next(hctx)
}

// ForbiddenMessage is the detail of a 403 the middleware writes. Exported so
// tests can tell a refusal by the declared level from one a handler raised.
func ForbiddenMessage(level Level) string {
	switch level {
	case GM:
		return "only the GM can do this"
	case Audience:
		return "only the GM, co-GMs and the audience can view this while the game is running"
	case Member:
		return "only participants in this game can do this"
	default:
		return "you do not have permission to view this game's content"
	}
}

// NotInGameMessage is the detail of the 404 ChildScope writes when a path
// names a row of another game, or no row at all. The two answer alike so a
// caller cannot probe which IDs exist elsewhere.
func NotInGameMessage(kind string) string { return kind + " not found in this game" }
