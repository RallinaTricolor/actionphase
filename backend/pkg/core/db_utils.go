package core

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/go-chi/render"
	"github.com/jackc/pgx/v5"
)

// HandleDBError converts database errors to appropriate API error responses.
// It handles common database error cases and returns a render.Renderer.
//
// Example Usage:
//
//	game, err := gameService.GetGame(ctx, gameID)
//	if err != nil {
//	    render.Render(w, r, HandleDBError(err, "game"))
//	    return
//	}
func HandleDBError(err error, resourceName string) render.Renderer {
	if err == nil {
		return nil
	}

	// Check for "not found" errors
	if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound(fmt.Sprintf("%s not found", resourceName))
	}

	// For other database errors, return internal error
	return ErrInternalError(err)
}

// HandleDBErrorWithID is like HandleDBError but includes the resource ID in the message.
//
// Example Usage:
//
//	user, err := userService.GetUser(ctx, userID)
//	if err != nil {
//	    render.Render(w, r, HandleDBErrorWithID(err, "user", userID))
//	    return
//	}
func HandleDBErrorWithID(err error, resourceName string, id interface{}) render.Renderer {
	if err == nil {
		return nil
	}

	// Check for "not found" errors
	if errors.Is(err, sql.ErrNoRows) || errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound(fmt.Sprintf("%s with ID %v not found", resourceName, id))
	}

	// For other database errors, return internal error
	return ErrInternalError(err)
}
