package http

import (
	"actionphase/pkg/auth"
	"actionphase/pkg/core"
	"actionphase/pkg/games"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

type Handler struct {
	App *core.App
}

var tokenAuth *jwtauth.JWTAuth

func init() {
	// TODO: Get this from env var
	tokenAuth = jwtauth.New("HS256", []byte("SECRET"), nil)
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

	r.Get("/debug-games", func(w http.ResponseWriter, r *http.Request) {
		gameHandler := games.Handler{App: h.App}
		gameHandler.GetAllGamesDebug(w, r)
	})

	r.Get("/panic", func(w http.ResponseWriter, r *http.Request) {
		panic("test")
	})

	apiV1Router := chi.NewRouter()

	authRouter := chi.NewRouter()
	authRouter.Route("/", func(r chi.Router) {
		authHandler := auth.Handler{App: h.App}
		r.Post("/register", authHandler.V1Register)
		r.Post("/login", authHandler.V1Login)
		r.Group(func(r chi.Router) {
			// Seek, verify and validate JWT tokens
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Get("/refresh", authHandler.V1Refresh)
		})
	})
	apiV1Router.Mount("/auth", authRouter)

	// Games API
	gamesRouter := chi.NewRouter()
	gamesRouter.Route("/", func(r chi.Router) {
		gameHandler := games.Handler{App: h.App}

		// Public routes - all games are visible to everyone
		r.Get("/public", gameHandler.GetAllGames)
		r.Get("/recruiting", gameHandler.GetRecruitingGames)
		r.Get("/{id}", gameHandler.GetGame)
		r.Get("/{id}/details", gameHandler.GetGameWithDetails)
		r.Get("/{id}/participants", gameHandler.GetGameParticipants)

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))

			// Game management
			r.Post("/", gameHandler.CreateGame)
			r.Put("/{id}", gameHandler.UpdateGame)
			r.Delete("/{id}", gameHandler.DeleteGame)
			r.Put("/{id}/state", gameHandler.UpdateGameState)

			// Participant management
			r.Post("/{id}/join", gameHandler.JoinGame)
			r.Delete("/{id}/leave", gameHandler.LeaveGame)
		})
	})
	apiV1Router.Mount("/games", gamesRouter)

	r.Mount("/api/v1", apiV1Router)

	http.ListenAndServe(":3000", r)
}
