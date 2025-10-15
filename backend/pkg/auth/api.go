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
