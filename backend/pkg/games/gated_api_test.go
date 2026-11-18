package games

import (
	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"

	"actionphase/pkg/access"
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"actionphase/pkg/humaconfig"
)

// newGatedGameAPI is the game-scoped API as root.go builds it: with the
// access middleware enforcing each route's declared level. Several routes
// (the audience reads among them) have no other gate, so a test router
// without it would admit callers production refuses.
func newGatedGameAPI(r chi.Router, app *core.App) huma.API {
	api := humaconfig.New(r, "ActionPhase API", "1.0.0")
	api.UseMiddleware(access.Middleware(api, app, &db.GameService{DB: app.Pool, Logger: app.ObsLogger}))
	return api
}
