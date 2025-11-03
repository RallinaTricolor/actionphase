package middleware

import (
	"actionphase/pkg/core"
	"net/http"

	"github.com/go-chi/render"
)

// RequireAdmin is a middleware that checks if the authenticated user has admin privileges
// This middleware must be used AFTER RequireAuthenticationMiddleware
func RequireAdmin(app *core.App) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get authenticated user from context (set by RequireAuthenticationMiddleware)
			authUser := core.GetAuthenticatedUser(r.Context())
			if authUser == nil {
				app.Logger.Warn("Admin middleware: no authenticated user in context")
				render.Render(w, r, core.ErrUnauthorized("authentication required"))
				return
			}

			// Check if user is admin (no database lookup needed!)
			if !authUser.IsAdmin {
				app.Logger.Warn("Admin middleware: user is not admin",
					"user_id", authUser.ID,
					"username", authUser.Username)
				render.Render(w, r, core.ErrForbidden("admin privileges required"))
				return
			}

			// User is admin, allow request to proceed
			app.Logger.Debug("Admin middleware: access granted",
				"user_id", authUser.ID,
				"username", authUser.Username)
			next.ServeHTTP(w, r)
		})
	}
}
