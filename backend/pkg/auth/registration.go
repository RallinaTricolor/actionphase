package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"github.com/go-chi/render"
	"net/http"
)

func (h *Handler) V1Register(w http.ResponseWriter, r *http.Request) {
	data := &Request{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	if err := data.User.Validate(); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	UserService := db.UserService{DB: h.DB}
	returnUser, err := UserService.CreateUser(data.User)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	render.Status(r, http.StatusCreated)
	render.Render(w, r, NewRegistrationResponse(&returnUser))
}

func NewRegistrationResponse(user *core.User) *Response {
	resp := &Response{User: user}
	return resp
}
