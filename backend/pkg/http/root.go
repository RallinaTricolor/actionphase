package http

import (
	"actionphase/pkg/auth"
	"actionphase/pkg/characters"
	"actionphase/pkg/core"
	"actionphase/pkg/docs"
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

// getTokenAuth creates JWT auth using the app configuration
func (h *Handler) getTokenAuth() *jwtauth.JWTAuth {
	return jwtauth.New(h.App.Config.JWT.Algorithm, []byte(h.App.Config.JWT.Secret), nil)
}

func (h *Handler) Start() {
	r := chi.NewRouter()

	// Add observability middleware stack first
	observabilityMiddleware := h.App.Observability.MiddlewareStack()
	for _, mw := range observabilityMiddleware {
		r.Use(mw)
	}

	// Keep existing middleware for compatibility
	r.Use(middleware.RequestID)
	r.Use(middleware.URLFormat)
	r.Use(render.SetContentType(render.ContentTypeJSON))

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("root."))
	})

	r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("ponger"))
	})

	// Observability endpoints
	r.Get("/health", h.App.Observability.HealthHandler())
	r.Get("/metrics", h.App.Observability.MetricsHandler())

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
			tokenAuth := h.getTokenAuth()
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
			tokenAuth := h.getTokenAuth()
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
			tokenAuth := h.getTokenAuth()
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
			tokenAuth := h.getTokenAuth()
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))

			// Phase management
			r.Post("/{id}/activate", phaseHandler.ActivatePhase)
			r.Put("/{id}/deadline", phaseHandler.UpdatePhaseDeadline)
		})
	})
	apiV1Router.Mount("/phases", phasesRouter)

	// API Documentation routes (public)
	docsHandler := &docs.Handler{}
	docsHandler.RegisterRoutes(apiV1Router)

	r.Mount("/api/v1", apiV1Router)

	// Create HTTP server with configuration
	server := &http.Server{
		Addr:         h.App.Config.GetServerAddress(),
		Handler:      r,
		ReadTimeout:  h.App.Config.Server.ReadTimeout,
		WriteTimeout: h.App.Config.Server.WriteTimeout,
		IdleTimeout:  h.App.Config.Server.IdleTimeout,
	}

	h.App.Logger.Info("HTTP server starting",
		"address", server.Addr,
		"read_timeout", server.ReadTimeout,
		"write_timeout", server.WriteTimeout)

	if err := server.ListenAndServe(); err != nil {
		h.App.Logger.Error("HTTP server failed", "error", err)
	}
}
