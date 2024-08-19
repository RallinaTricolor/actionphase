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
	UserService := db.UserService{DB: h.DB}
	user, err := UserService.UserByUsername(data.User.Username)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	if !user.CheckPasswordHash(data.User.Password) {
		render.Render(w, r, core.ErrInvalidRequest(LoginError{"invalid username or password"}))
		return
	}
}

type LoginError struct {
	Message string `json:"message"`
}

func (e LoginError) Error() string {
	return e.Message
}
