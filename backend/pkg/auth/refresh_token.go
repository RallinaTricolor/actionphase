package auth

import (
	"actionphase/pkg/core"
	"github.com/go-chi/render"
	"net/http"
)

func (h *Handler) V1Refresh(w http.ResponseWriter, r *http.Request) {
	tokenClaims, err := decodeToken(r.Header.Get("Bearer"))
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}
	token, err := createToken(tokenClaims["username"].(string))
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	render.Status(r, http.StatusOK)
	render.Render(w, r, NewRefreshResponse(token))
}

func NewRefreshResponse(token string) *Response {
	resp := &Response{Token: token}
	return resp
}
