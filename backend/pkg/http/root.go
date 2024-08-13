package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
)

type application struct {
	// Add DB connection
	// Add logger
}

func Start() {
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

	http.ListenAndServe(":3000", r)
}
