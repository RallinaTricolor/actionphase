package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"net/http"
	"strings"

	"github.com/go-chi/render"
)

func (h *Handler) V1Login(w http.ResponseWriter, r *http.Request) {
	data := &Request{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}
	UserService := db.UserService{DB: h.App.Pool}

	// Support login with either username or email
	// The username field may contain either a username or an email address
	var user *core.User
	var err error

	// Check if username field contains an email (has @ symbol)
	usernameOrEmail := data.User.Username
	if data.User.Email != "" {
		usernameOrEmail = data.User.Email
	}

	if usernameOrEmail == "" {
		h.App.Logger.Info("Login attempt with no username or email provided")
		render.Render(w, r, core.ErrUnauthorized("Invalid username or password"))
		return
	}

	// If it looks like an email, try email lookup first
	if strings.Contains(usernameOrEmail, "@") {
		user, err = UserService.UserByEmail(usernameOrEmail)
	} else {
		user, err = UserService.UserByUsername(usernameOrEmail)
	}

	if err != nil {
		h.App.Logger.Info("Login attempt for non-existent user",
			"username", data.User.Username,
			"email", data.User.Email)
		render.Render(w, r, core.ErrUnauthorized("Invalid username or password"))
		return
	}

	// Check if user is banned
	if user.IsBanned {
		h.App.Logger.Warn("Login attempt by banned user",
			"username", user.Username,
			"user_id", user.ID,
			"banned_at", user.BannedAt)
		render.Render(w, r, core.ErrForbidden("Your account has been banned. Please contact support."))
		return
	}

	if !user.CheckPasswordHash(data.User.Password) {
		h.App.Logger.Error("Invalid password", "username", user.Username)
		render.Render(w, r, core.ErrInvalidRequest(LoginError{"invalid username or password"}))
		return
	}
	h.App.Logger.Info("Creating token for user", "username", user.Username)
	jwtHandler := JWTHandler{App: h.App}
	token, err := jwtHandler.CreateToken(user)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	SetJWTCookie(w, token)
	render.Status(r, http.StatusOK)
	render.Render(w, r, NewLoginResponse(token))
}

type LoginError struct {
	Message string `json:"message"`
}

func (e LoginError) Error() string {
	return e.Message
}

func NewLoginResponse(token string) *Response {
	resp := &Response{Token: token}
	return resp
}

// V1Logout handles user logout by clearing the JWT cookie
func (h *Handler) V1Logout(w http.ResponseWriter, r *http.Request) {
	// Clear the JWT cookie by setting it to expire in the past
	ClearJWTCookie(w)

	h.App.Logger.Info("User logged out successfully")

	// Return 200 OK with no body
	w.WriteHeader(http.StatusOK)
}
