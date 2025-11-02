package core

import (
	"context"
	"net/http"

	db "actionphase/pkg/db/models"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
	"github.com/jackc/pgx/v5/pgxpool"
)

// RequireEmailVerificationMiddleware is middleware that requires the user to have a verified email
// This should be used on routes that require email verification (e.g., creating games, posting content)
//
// Recommended routes to protect (apply this middleware to):
// - POST /api/v1/games - Create game
// - POST /api/v1/games/{gameId}/posts - Create common room post
// - POST /api/v1/games/{gameId}/posts/{postId}/comments - Create comment
// - POST /api/v1/games/{gameId}/characters - Create character
// - POST /api/v1/games/{gameId}/apply - Apply to game
//
// Example usage in router:
//
//	r.Group(func(r chi.Router) {
//	    r.Use(jwtauth.Verifier(tokenAuth))
//	    r.Use(jwtauth.Authenticator(tokenAuth))
//	    r.Use(core.RequireAuthenticationMiddleware(userService))
//	    r.Use(core.RequireEmailVerificationMiddleware(pool))  // Add email verification requirement
//	    r.Post("/", gameHandler.CreateGame)
//	})
func RequireEmailVerificationMiddleware(pool *pgxpool.Pool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get user ID from JWT token
			token, _, err := jwtauth.FromContext(r.Context())
			if err != nil {
				render.Render(w, r, ErrUnauthorized("invalid token"))
				return
			}

			userIDFloat, ok := token.Get("user_id")
			if !ok {
				render.Render(w, r, ErrUnauthorized("user_id not found in token"))
				return
			}

			userID := int32(userIDFloat.(float64))

			// Get user from database to check email verification status
			queries := db.New(pool)
			user, err := queries.GetUser(r.Context(), userID)
			if err != nil {
				render.Render(w, r, ErrInternalError(err))
				return
			}

			// Check if email is verified
			if !user.EmailVerified {
				render.Render(w, r, ErrForbidden("Please verify your email address to perform this action. Check your email for a verification link or request a new one."))
				return
			}

			// Email is verified, continue to next handler
			next.ServeHTTP(w, r)
		})
	}
}

// GetUserEmailVerificationStatus retrieves a user's email verification status
// This is a helper function that can be used by handlers to check verification status
func GetUserEmailVerificationStatus(ctx context.Context, pool *pgxpool.Pool, userID int32) (bool, error) {
	queries := db.New(pool)
	user, err := queries.GetUser(ctx, userID)
	if err != nil {
		return false, err
	}
	return user.EmailVerified, nil
}
