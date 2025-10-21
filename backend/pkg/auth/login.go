package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"github.com/go-chi/render"
	"net/http"
)

func (h *Handler) V1Login(w http.ResponseWriter, r *http.Request) {
	data := &Request{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}
	UserService := db.UserService{DB: h.App.Pool}
	user, err := UserService.UserByUsername(data.User.Username)
	if err != nil {
		h.App.Logger.Info("Login attempt for non-existent user", "username", data.User.Username)
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
