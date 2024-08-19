package http

import (
	"actionphase/pkg/auth"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/render"
)

func Start() {
	ctx := context.Background()
	connectionString := "postgres://postgres:example@localhost:5432/database?sslmode=disable"
	pool, err := pgxpool.New(ctx, connectionString)
	if err != nil {
		panic(err)
	}

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

	authHandler := auth.Handler{DB: pool}
	r.Post("/api/v1/auth/register", authHandler.V1Register)

	http.ListenAndServe(":3000", r)
}
