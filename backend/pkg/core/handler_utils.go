package core

import (
	"context"
	"fmt"

	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

// GetUserIDFromJWT extracts the user ID from the JWT token in the context.
// Returns the user ID and nil on success, or 0 and an error response on failure.
//
// Example Usage:
//
//	userID, errResp := GetUserIDFromJWT(ctx, app.UserService)
//	if errResp != nil {
//	    render.Render(w, r, errResp)
//	    return
//	}
func GetUserIDFromJWT(ctx context.Context, userService UserServiceInterface) (int32, render.Renderer) {
	token, _, err := jwtauth.FromContext(ctx)
	if err != nil {
		return 0, ErrUnauthorized("no valid token found")
	}

	// Extract user_id from "sub" claim (immutable ID)
	userIDStr, ok := token.Get("sub")
	if !ok {
		return 0, ErrUnauthorized("user id not found in token")
	}

	// Parse user ID string to int
	var userID int
	fmt.Sscanf(userIDStr.(string), "%d", &userID)

	return int32(userID), nil
}

// GetUsernameFromJWT extracts the username for the user identified by the JWT token.
// Returns the username and nil on success, or empty string and an error response on failure.
// Note: This function requires a database lookup since username is no longer stored in the token.
//
// Example Usage:
//
//	username, errResp := GetUsernameFromJWT(ctx, app.UserService)
//	if errResp != nil {
//	    render.Render(w, r, errResp)
//	    return
//	}
func GetUsernameFromJWT(ctx context.Context, userService UserServiceInterface) (string, render.Renderer) {
	token, _, err := jwtauth.FromContext(ctx)
	if err != nil {
		return "", ErrUnauthorized("no valid token found")
	}

	// Extract user_id from "sub" claim
	userIDStr, ok := token.Get("sub")
	if !ok {
		return "", ErrUnauthorized("user id not found in token")
	}

	// Parse user ID
	var userID int
	fmt.Sscanf(userIDStr.(string), "%d", &userID)

	// Look up user to get username
	user, err := userService.User(userID)
	if err != nil {
		return "", ErrUnauthorized("user not found")
	}

	return user.Username, nil
}

// ValidateRequired checks if a required field is empty and returns an error if so.
// Returns nil if the field is valid, or an error response if it's empty.
//
// Example Usage:
//
//	if errResp := ValidateRequired(data.Title, "title"); errResp != nil {
//	    render.Render(w, r, errResp)
//	    return
//	}
func ValidateRequired(value string, fieldName string) render.Renderer {
	if value == "" {
		return ErrInvalidRequest(fmt.Errorf("%s is required", fieldName))
	}
	return nil
}

// ValidateStringLength checks if a string field meets length requirements.
// Returns nil if valid, or an error response if invalid.
//
// Example Usage:
//
//	if errResp := ValidateStringLength(title, "title", 3, 255); errResp != nil {
//	    render.Render(w, r, errResp)
//	    return
//	}
func ValidateStringLength(value, fieldName string, min, max int) render.Renderer {
	length := len(value)
	if length < min {
		return ErrValidationFailed(fmt.Sprintf("%s must be at least %d characters", fieldName, min))
	}
	if length > max {
		return ErrValidationFailed(fmt.Sprintf("%s must be at most %d characters", fieldName, max))
	}
	return nil
}
