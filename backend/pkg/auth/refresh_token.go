package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
	"github.com/lestrrat-go/jwx/v2/jwt"
	"net/http"
)

func (h *Handler) V1Refresh(w http.ResponseWriter, r *http.Request) {
	token, claims, _ := jwtauth.FromContext(r.Context())
	if token == nil || jwt.Validate(token) != nil {
		render.Render(w, r, core.ErrUnauthorized("Invalid token"))
		return
	}
	username := claims["username"].(string)
	UserService := db.UserService{DB: h.App.Pool}
	user, err := UserService.UserByUsername(username)
	if err != nil {
		h.App.Logger.Error("Error getting user", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	h.App.Logger.Info("Creating token for user", "username", user.Username)
	jwtHandler := JWTHandler{App: h.App}
	tokenString, err := jwtHandler.CreateToken(user)
	if err != nil {
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	SetJWTCookie(w, tokenString)
	render.Status(r, http.StatusOK)
	render.Render(w, r, NewRefreshResponse(tokenString))
}

func NewRefreshResponse(token string) *Response {
	resp := &Response{Token: token}
	return resp
}
