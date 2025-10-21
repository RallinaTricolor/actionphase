package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"fmt"
	"net/http"

	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

type Request struct {
	*core.User
}

func (r *Request) Bind(req *http.Request) error {
	if r.User == nil {
		return fmt.Errorf("missing required User fields")
	}
	return nil
}

type Handler struct {
	App *core.App
}

type Response struct {
	*core.User
	Token string
}

func (rd *Response) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// V1Me returns the current user's information
// This endpoint provides the user_id and other details from the database
// rather than relying on potentially stale JWT token data
func (h *Handler) V1Me(w http.ResponseWriter, r *http.Request) {
	// Get username from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		h.App.Logger.Error("Failed to get token from context", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		h.App.Logger.Error("Username not found in token")
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up current user from database
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to find user", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	// Return user information (without token)
	response := &Response{
		User:  user,
		Token: "", // Don't include token in response
	}

	render.Render(w, r, response)
}

// PreferencesRequest represents a request to update user preferences
type PreferencesRequest struct {
	Preferences *db.PreferencesData `json:"preferences"`
}

func (r *PreferencesRequest) Bind(req *http.Request) error {
	if r.Preferences == nil {
		return fmt.Errorf("missing required preferences field")
	}
	return nil
}

// PreferencesResponse represents the preferences response
type PreferencesResponse struct {
	Preferences *db.PreferencesData `json:"preferences"`
}

func (rd *PreferencesResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// V1GetPreferences returns the current user's preferences
func (h *Handler) V1GetPreferences(w http.ResponseWriter, r *http.Request) {
	// Get username from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		h.App.Logger.Error("Failed to get token from context", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		h.App.Logger.Error("Username not found in token")
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up current user
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to find user", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	// Get preferences
	prefsService := db.NewUserPreferencesService(h.App.Pool)
	prefs, err := prefsService.GetUserPreferences(r.Context(), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to get user preferences", "error", err, "user_id", user.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := &PreferencesResponse{
		Preferences: prefs,
	}

	render.Render(w, r, response)
}

// V1UpdatePreferences updates the current user's preferences
func (h *Handler) V1UpdatePreferences(w http.ResponseWriter, r *http.Request) {
	// Get username from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		h.App.Logger.Error("Failed to get token from context", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		h.App.Logger.Error("Username not found in token")
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up current user
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to find user", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	// Parse request
	data := &PreferencesRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.Logger.Warn("Invalid request body", "error", err)
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Update preferences
	prefsService := db.NewUserPreferencesService(h.App.Pool)
	prefs, err := prefsService.UpdateUserPreferences(r.Context(), int32(user.ID), *data.Preferences)
	if err != nil {
		h.App.Logger.Error("Failed to update user preferences", "error", err, "user_id", user.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("User preferences updated", "user_id", user.ID, "theme", prefs.Theme)

	response := &PreferencesResponse{
		Preferences: prefs,
	}

	render.Render(w, r, response)
}
