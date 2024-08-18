package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"fmt"
	"github.com/go-chi/render"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"
)

type RegistrationRequest struct {
	*core.User
}

func (r *RegistrationRequest) Bind(req *http.Request) error {
	if r.User == nil {
		return fmt.Errorf("missing required User fields")
	}
	return nil
}

type RegistrationHandler struct {
	DB *pgxpool.Pool
}

func (h *RegistrationHandler) V1CreateUser(w http.ResponseWriter, r *http.Request) {
	data := &RegistrationRequest{}
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

type RegistrationResponse struct {
	*core.User
}

func NewRegistrationResponse(user *core.User) *RegistrationResponse {
	resp := &RegistrationResponse{User: user}
	return resp
}

func (rd *RegistrationResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}
