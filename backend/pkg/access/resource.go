package access

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// Resource is a game-owned row that routes address by its own ID, with no
// {gameID} in the path: /characters/{id}, /polls/{pollId}. The game is read
// from the row, so the caller cannot name a different one.
type Resource struct {
	// Name is used in the 404, e.g. "character".
	Name string
	// Param is the path parameter holding the row's ID.
	Param string
	// GameOf returns the ID of the game that owns the row, or an error
	// wrapping pgx.ErrNoRows when there is no such row.
	GameOf func(ctx context.Context, id int32) (int32, error)
}

// ResourceChecker is a Checker that can also supply what GameMiddleware would
// otherwise have put in the context: the game, and the caller's GM flag in it.
type ResourceChecker interface {
	Checker
	// GetGame returns an error wrapping pgx.ErrNoRows for a missing or
	// soft-deleted game.
	GetGame(ctx context.Context, gameID int32) (*models.Game, error)
	// IsGameMaster is the is_gm rule: GM, co-GM, or a site admin with admin
	// mode on.
	IsGameMaster(ctx context.Context, game *models.Game, user *core.AuthenticatedUser) bool
}

// ResourceMiddleware enforces declared levels on an API whose routes address
// one Resource by its own ID. It resolves the row's game, then applies the
// same rule as Middleware. Install it immediately after creating the API, for
// the same reason as Middleware.
//
// Every route that names res.Param has its row and game resolved, whatever
// its level: a missing row, or a soft-deleted game, is a 404 before any
// handler runs, Public routes included. The resolved game and the caller's
// GM flag go into the context under the keys GameMiddleware uses ("game",
// "gameID", "is_gm"), so handlers read them instead of loading them again.
//
// A route without res.Param (a cross-game list on the same mount, such as
// /characters/controllable) has nothing to resolve. That is only valid for
// Public and Handler; any other level there is a wiring mistake and answers
// 500.
func ResourceMiddleware(api huma.API, app *core.App, checker ResourceChecker, res Resource) func(huma.Context, func(huma.Context)) {
	placeholder := "{" + res.Param + "}"
	return func(hctx huma.Context, next func(huma.Context)) {
		level, ok := declaredLevel(api, app, hctx)
		if !ok {
			return
		}
		ungated := level == Public || level == Handler

		ctx := hctx.Context()
		op := hctx.Operation()
		if !strings.Contains(op.Path, placeholder) {
			if ungated {
				next(hctx)
				return
			}
			app.ObsLogger.Error(ctx, "Access-gated route has no resource ID parameter",
				"operation_id", op.OperationID, "param", res.Param)
			_ = huma.WriteErr(api, hctx, http.StatusInternalServerError, "route has no "+res.Name+" ID to check access against")
			return
		}

		user := core.GetAuthenticatedUser(ctx)
		if user == nil {
			_ = huma.WriteErr(api, hctx, http.StatusUnauthorized, "authentication required")
			return
		}

		id, err := strconv.ParseInt(hctx.Param(res.Param), 10, 32)
		if err != nil {
			_ = huma.WriteErr(api, hctx, http.StatusUnprocessableEntity, "invalid "+res.Name+" ID")
			return
		}
		gameID, err := res.GameOf(ctx, int32(id))
		if err != nil {
			notFoundOr500(api, app, hctx, err, res.Name, op.OperationID)
			return
		}
		game, err := checker.GetGame(ctx, gameID)
		if err != nil {
			// A soft-deleted game hides its rows too.
			notFoundOr500(api, app, hctx, err, res.Name, op.OperationID)
			return
		}

		isGM := checker.IsGameMaster(ctx, game, user)
		hctx = huma.WithValue(hctx, "game", game)
		hctx = huma.WithValue(hctx, "gameID", game.ID)
		hctx = huma.WithValue(hctx, "is_gm", isGM)

		if ungated {
			next(hctx)
			return
		}
		enforce(api, app, checker, hctx, next, level, game, user, isGM)
	}
}

func notFoundOr500(api huma.API, app *core.App, hctx huma.Context, err error, name, opID string) {
	if errors.Is(err, pgx.ErrNoRows) {
		_ = huma.WriteErr(api, hctx, http.StatusNotFound, name+" not found")
		return
	}
	app.ObsLogger.Error(hctx.Context(), "Failed to resolve the game a resource belongs to",
		"error", err, "operation_id", opID, "resource", name)
	_ = huma.WriteErr(api, hctx, http.StatusInternalServerError, "failed to check access")
}
