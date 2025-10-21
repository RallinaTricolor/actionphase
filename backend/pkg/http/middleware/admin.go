package middleware

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"net/http"

	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

// RequireAdmin is a middleware that checks if the authenticated user has admin privileges
// This middleware must be used AFTER jwtauth.Verifier and jwtauth.Authenticator
func RequireAdmin(app *core.App) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get token from context (already verified by jwtauth.Verifier)
			token, _, err := jwtauth.FromContext(r.Context())
			if err != nil || token == nil {
				app.Logger.Warn("Admin middleware: no token in context")
				render.Render(w, r, core.ErrUnauthorized("authentication required"))
				return
			}

			// Extract username from token
			username, ok := token.Get("username")
			if !ok {
				app.Logger.Warn("Admin middleware: username not found in token")
				render.Render(w, r, core.ErrUnauthorized("invalid token"))
				return
			}

			// Look up user from database
			userService := &db.UserService{DB: app.Pool}
			user, err := userService.UserByUsername(username.(string))
			if err != nil {
				app.Logger.Error("Admin middleware: failed to find user",
					"error", err,
					"username", username)
				render.Render(w, r, core.ErrUnauthorized("user not found"))
				return
			}

			// Check if user is admin
			if !user.IsAdmin {
				app.Logger.Warn("Admin middleware: user is not admin",
					"user_id", user.ID,
					"username", user.Username)
				render.Render(w, r, core.ErrForbidden("admin privileges required"))
				return
			}

			// User is admin, allow request to proceed
			app.Logger.Debug("Admin middleware: access granted",
				"user_id", user.ID,
				"username", user.Username)
			next.ServeHTTP(w, r)
		})
	}
}
