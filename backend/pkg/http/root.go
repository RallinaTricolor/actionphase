package http

import (
	"actionphase/pkg/auth"
	"actionphase/pkg/core"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
)

type Handler struct {
	App *core.App
}

func (h *Handler) Start() {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.RequestID)
	r.Use(middleware.Recoverer)
	r.Use(middleware.URLFormat)
	r.Use(render.SetContentType(render.ContentTypeJSON))

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("root."))
	})

	r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ponger"))
	})

	r.Get("/panic", func(w http.ResponseWriter, r *http.Request) {
		panic("test")
	})

	authHandler := auth.Handler{App: h.App}
	r.Post("/api/v1/auth/register", authHandler.V1Register)
	r.Post("/api/v1/auth/login", authHandler.V1Login)
	r.Get("/api/v1/auth/refresh", authHandler.V1Refresh)

	http.ListenAndServe(":3000", r)
}
