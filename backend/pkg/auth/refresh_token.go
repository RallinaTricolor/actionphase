package auth

import (
	"actionphase/pkg/core"
	"github.com/go-chi/render"
	"net/http"
)

func (h *Handler) V1Refresh(w http.ResponseWriter, r *http.Request) {
	tokenString := r.Header.Get("Authorization")[len("Bearer "):]
	jwt := JWTHandler{App: h.App}
	if err := jwt.VerifyToken(tokenString); err != nil {
		h.App.Logger.Error("Error verifying token", "error", err)
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}
	tokenClaims, err := jwt.DecodeToken(tokenString)
	if err != nil {
		h.App.Logger.Error("Error decoding token", "error", err)
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}
	h.App.Logger.Info("Creating refreshed token for user", "username", tokenClaims["username"].(string))
	token, err := jwt.CreateToken(tokenClaims["username"].(string))
	if err != nil {
		h.App.Logger.Error("Error creating token", "error", err)
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
