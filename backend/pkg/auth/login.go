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
		h.App.Logger.Error("Error getting user", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if !user.CheckPasswordHash(data.User.Password) {
		h.App.Logger.Error("Invalid password", "username", user.Username)
		render.Render(w, r, core.ErrInvalidRequest(LoginError{"invalid username or password"}))
		return
	}
	h.App.Logger.Info("Creating token for user", "username", user.Username)
	jwt := JWTHandler{App: h.App}
	token, err := jwt.CreateToken(user)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
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
