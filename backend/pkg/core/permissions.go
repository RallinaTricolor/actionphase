package core

import (
	models "actionphase/pkg/db/models"
	"context"
	"net/http"
)

// IsUserGameMaster checks if a user has Game Master permissions for a game.
// This function considers both normal GM ownership and admin mode.
//
// A user is considered a Game Master if:
// 1. They are the actual GM of the game (game.GmUserID == userID), OR
// 2. They are an admin with admin mode enabled
//
// Admin mode is determined by the "X-Admin-Mode" request header.
// This header should be set to "true" by the frontend when admin mode is active.
//
// Usage Example:
//
//	// In a handler
//	user := GetAuthenticatedUser(r.Context())
//	if !IsUserGameMaster(r, user.ID, user.IsAdmin, game) {
//		render.Render(w, r, core.ErrForbidden("only the GM can perform this action"))
//		return
//	}
func IsUserGameMaster(r *http.Request, userID int32, isAdmin bool, game models.Game) bool {
	// Check if user is the actual GM
	if game.GmUserID == userID {
		return true
	}

	// Check if user is admin with admin mode enabled
	if isAdmin && r.Header.Get("X-Admin-Mode") == "true" {
		return true
	}

	return false
}

// contextKey is a custom type for context keys to avoid collisions
type contextKey string

const (
	// adminModeContextKey is the context key for storing admin mode state
	adminModeContextKey contextKey = "admin_mode"
)

// WithAdminMode adds admin mode state to the context.
// This is typically called by middleware that reads the X-Admin-Mode header.
func WithAdminMode(ctx context.Context, adminMode bool) context.Context {
	return context.WithValue(ctx, adminModeContextKey, adminMode)
}

// GetAdminMode retrieves admin mode state from the context.
// Returns false if admin mode is not set in the context.
func GetAdminMode(ctx context.Context) bool {
	adminMode, ok := ctx.Value(adminModeContextKey).(bool)
	if !ok {
		return false
	}
	return adminMode
}

// IsUserGameMasterCtx is a context-based version of IsUserGameMaster.
// It uses admin mode state from the context instead of reading headers directly.
// This is useful when the admin mode state has already been extracted by middleware.
//
// Usage Example:
//
//	// After middleware has set admin mode in context
//	user := GetAuthenticatedUser(r.Context())
//	if !IsUserGameMasterCtx(r.Context(), user.ID, user.IsAdmin, game) {
//		render.Render(w, r, core.ErrForbidden("only the GM can perform this action"))
//		return
//	}
func IsUserGameMasterCtx(ctx context.Context, userID int32, isAdmin bool, game models.Game) bool {
	// Check if user is the actual GM
	if game.GmUserID == userID {
		return true
	}

	// Check if user is admin with admin mode enabled
	if isAdmin && GetAdminMode(ctx) {
		return true
	}

	return false
}
