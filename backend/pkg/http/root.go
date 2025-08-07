package http

import (
	"actionphase/pkg/auth"
	"actionphase/pkg/characters"
	"actionphase/pkg/core"
	"actionphase/pkg/games"
	"actionphase/pkg/phases"
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

	// Debug endpoint - should be removed in production
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

	// Games API - All routes require authentication
	gamesRouter := chi.NewRouter()
	gamesRouter.Route("/", func(r chi.Router) {
		gameHandler := games.Handler{App: h.App}

		// All routes require authentication
		r.Group(func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))

			// Game listing and viewing
			r.Get("/public", gameHandler.GetAllGames)
			r.Get("/recruiting", gameHandler.GetRecruitingGames)
			r.Get("/{id}", gameHandler.GetGame)
			r.Get("/{id}/details", gameHandler.GetGameWithDetails)
			r.Get("/{id}/participants", gameHandler.GetGameParticipants)

			// Game management
			r.Post("/", gameHandler.CreateGame)
			r.Put("/{id}", gameHandler.UpdateGame)
			r.Delete("/{id}", gameHandler.DeleteGame)
			r.Put("/{id}/state", gameHandler.UpdateGameState)

			// Participant management
			r.Delete("/{id}/leave", gameHandler.LeaveGame)

			// Game application management
			r.Post("/{id}/apply", gameHandler.ApplyToGame)
			r.Get("/{id}/applications", gameHandler.GetGameApplications)
			r.Put("/{id}/applications/{applicationId}/review", gameHandler.ReviewGameApplication)
			r.Delete("/{id}/application", gameHandler.WithdrawGameApplication)

			// Character management within games
			characterHandler := characters.Handler{App: h.App}
			r.Post("/{gameId}/characters", characterHandler.CreateCharacter)
			r.Get("/{gameId}/characters", characterHandler.GetGameCharacters)

			// Phase management within games
			phaseHandler := phases.Handler{App: h.App}
			r.Post("/{gameId}/phases", phaseHandler.CreatePhase)
			r.Get("/{gameId}/current-phase", phaseHandler.GetCurrentPhase)
			r.Get("/{gameId}/phases", phaseHandler.GetGamePhases)
			r.Post("/{gameId}/actions", phaseHandler.SubmitAction)
			r.Get("/{gameId}/actions", phaseHandler.GetGameActions)
			r.Get("/{gameId}/actions/mine", phaseHandler.GetUserActions)
		})
	})
	apiV1Router.Mount("/games", gamesRouter)

	// Characters API (for character-specific operations)
	charactersRouter := chi.NewRouter()
	charactersRouter.Route("/", func(r chi.Router) {
		characterHandler := characters.Handler{App: h.App}

		// All character routes require authentication
		r.Group(func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))

			// Character management
			r.Get("/{id}", characterHandler.GetCharacter)
			r.Post("/{id}/approve", characterHandler.ApproveCharacter)
			r.Post("/{id}/assign", characterHandler.AssignNPC)
			r.Post("/{id}/data", characterHandler.SetCharacterData)
			r.Get("/{id}/data", characterHandler.GetCharacterData)
		})
	})
	apiV1Router.Mount("/characters", charactersRouter)

	// Phases API (for phase-specific operations)
	phasesRouter := chi.NewRouter()
	phasesRouter.Route("/", func(r chi.Router) {
		phaseHandler := phases.Handler{App: h.App}

		// All phase routes require authentication
		r.Group(func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))

			// Phase management
			r.Post("/{id}/activate", phaseHandler.ActivatePhase)
			r.Put("/{id}/deadline", phaseHandler.UpdatePhaseDeadline)
		})
	})
	apiV1Router.Mount("/phases", phasesRouter)

	r.Mount("/api/v1", apiV1Router)

	http.ListenAndServe(":3000", r)
}
