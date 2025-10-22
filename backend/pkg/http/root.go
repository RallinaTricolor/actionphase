package http

import (
	"actionphase/pkg/admin"
	"actionphase/pkg/auth"
	"actionphase/pkg/avatars"
	"actionphase/pkg/characters"
	"actionphase/pkg/conversations"
	"actionphase/pkg/core"
	"actionphase/pkg/dashboard"
	db "actionphase/pkg/db/services"
	"actionphase/pkg/docs"
	"actionphase/pkg/games"
	httpmiddleware "actionphase/pkg/http/middleware"
	"actionphase/pkg/messages"
	"actionphase/pkg/notifications"
	"actionphase/pkg/phases"
	"net/http"
	"os"
	"path/filepath"
	"strings"

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
			r.Get("/me", authHandler.V1Me)                         // Get current user info
			r.Get("/preferences", authHandler.V1GetPreferences)    // Get user preferences
			r.Put("/preferences", authHandler.V1UpdatePreferences) // Update user preferences
			r.Get("/users/search", authHandler.V1SearchUsers)      // Search for users
		})
	})
	apiV1Router.Mount("/auth", authRouter)

	// Games API - All routes require authentication
	gamesRouter := chi.NewRouter()
	gamesRouter.Route("/", func(r chi.Router) {
		gameHandler := games.Handler{App: h.App}
		userService := &db.UserService{DB: h.App.Pool}

		// Public routes (authentication optional - will enrich if present)
		tokenAuth := h.getTokenAuth()
		r.Group(func(r chi.Router) {
			// Use verifier to extract token if present, but don't require authentication
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Get("/", gameHandler.GetFilteredGames) // Main game listing endpoint with filters
		})

		// All routes below require authentication
		r.Group(func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(core.RequireAuthenticationMiddleware(userService))

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
			r.Delete("/{id}/participants/{userId}", gameHandler.RemovePlayer)      // GM removes player
			r.Post("/{id}/participants/direct-add", gameHandler.AddPlayerDirectly) // GM adds player directly

			// Game application management
			r.Post("/{id}/apply", gameHandler.ApplyToGame)
			r.Get("/{id}/applications", gameHandler.GetGameApplications)
			r.Get("/{id}/application/mine", gameHandler.GetMyGameApplication)
			r.Put("/{id}/applications/{applicationId}/review", gameHandler.ReviewGameApplication)
			r.Delete("/{id}/application", gameHandler.WithdrawGameApplication)

			// Audience participation
			r.Post("/{id}/apply/audience", gameHandler.ApplyAsAudience)
			r.Get("/{id}/audience", gameHandler.ListAudienceMembers)
			r.Get("/{id}/characters/audience-npcs", gameHandler.ListAudienceNPCs)
			r.Put("/{id}/settings/auto-accept-audience", gameHandler.UpdateAutoAcceptAudience)
			r.Get("/{id}/private-messages/all", gameHandler.ListAllPrivateConversations)
			r.Get("/{id}/private-messages/conversations/{conversationId}", gameHandler.GetAudienceConversationMessages)
			r.Get("/{id}/action-submissions/all", gameHandler.ListAllActionSubmissions)

			// Character management within games
			characterHandler := characters.Handler{App: h.App}
			r.Post("/{gameId}/characters", characterHandler.CreateCharacter)
			r.Get("/{gameId}/characters", characterHandler.GetGameCharacters)
			r.Get("/{gameId}/characters/controllable", characterHandler.GetUserControllableCharacters)
			r.Get("/{gameId}/characters/inactive", characterHandler.ListInactiveCharacters) // GM views inactive characters

			// Phase management within games
			phaseHandler := phases.Handler{App: h.App}
			r.Post("/{gameId}/phases", phaseHandler.CreatePhase)
			r.Get("/{gameId}/current-phase", phaseHandler.GetCurrentPhase)
			r.Get("/{gameId}/phases", phaseHandler.GetGamePhases)
			r.Post("/{gameId}/actions", phaseHandler.SubmitAction)
			r.Get("/{gameId}/actions", phaseHandler.GetGameActions)
			r.Get("/{gameId}/actions/mine", phaseHandler.GetUserActions)

			// Action results management
			r.Post("/{gameId}/results", phaseHandler.CreateActionResult)
			r.Get("/{gameId}/results", phaseHandler.GetGameActionResults)
			r.Get("/{gameId}/results/mine", phaseHandler.GetUserActionResults)
			r.Put("/{gameId}/results/{resultId}", phaseHandler.UpdateActionResult)
			r.Post("/{gameId}/phases/{phaseId}/results/publish", phaseHandler.PublishAllPhaseResults)
			r.Get("/{gameId}/phases/{phaseId}/results/unpublished-count", phaseHandler.GetUnpublishedResultsCount)

			// Common Room messages (posts and comments)
			messageHandler := messages.Handler{App: h.App}
			r.Post("/{gameId}/posts", messageHandler.CreatePost)
			r.Get("/{gameId}/posts", messageHandler.GetGamePosts)
			r.Post("/{gameId}/posts/{postId}/comments", messageHandler.CreateComment)
			r.Get("/{gameId}/posts/{postId}/comments", messageHandler.GetPostComments)
			r.Patch("/{gameId}/posts/{postId}/comments/{commentId}", messageHandler.UpdateComment)  // Edit comment
			r.Delete("/{gameId}/posts/{postId}/comments/{commentId}", messageHandler.DeleteComment) // Delete comment
			r.Get("/{gameId}/messages/{messageId}", messageHandler.GetMessage)                      // For deep linking to nested comments

			// Read tracking for common room
			r.Post("/{gameId}/posts/{postId}/mark-read", messageHandler.MarkPostRead)
			r.Get("/{gameId}/read-markers", messageHandler.GetGameReadMarkers)
			r.Get("/{gameId}/posts-unread-info", messageHandler.GetPostsUnreadInfo)
			r.Get("/{gameId}/unread-comment-ids", messageHandler.GetUnreadCommentIDs)

			// Private messages (conversations)
			conversationHandler := &conversations.Handler{App: h.App}
			conversationHandler.RegisterRoutes(r)
		})
	})
	apiV1Router.Mount("/games", gamesRouter)

	// Characters API (for character-specific operations)
	charactersRouter := chi.NewRouter()
	charactersRouter.Route("/", func(r chi.Router) {
		characterHandler := characters.Handler{App: h.App}
		avatarHandler := avatars.Handler{App: h.App}
		userService := &db.UserService{DB: h.App.Pool}

		// All character routes require authentication
		r.Group(func(r chi.Router) {
			tokenAuth := h.getTokenAuth()
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(core.RequireAuthenticationMiddleware(userService))

			// Character management
			r.Get("/{id}", characterHandler.GetCharacter)
			r.Post("/{id}/approve", characterHandler.ApproveCharacter)
			r.Post("/{id}/assign", characterHandler.AssignNPC)
			r.Put("/{id}/reassign", characterHandler.ReassignCharacter) // GM reassigns inactive character
			r.Post("/{id}/data", characterHandler.SetCharacterData)
			r.Get("/{id}/data", characterHandler.GetCharacterData)

			// Avatar management
			r.Post("/{id}/avatar", avatarHandler.UploadCharacterAvatar)
			r.Delete("/{id}/avatar", avatarHandler.DeleteCharacterAvatar)
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
			r.Put("/{id}", phaseHandler.UpdatePhase)
		})
	})
	apiV1Router.Mount("/phases", phasesRouter)

	// Notifications API
	notificationsRouter := chi.NewRouter()
	notificationsRouter.Route("/", func(r chi.Router) {
		notificationHandler := notifications.Handler{App: h.App}

		// All notification routes require authentication
		r.Group(func(r chi.Router) {
			tokenAuth := h.getTokenAuth()
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))

			// Notification management
			r.Get("/", notificationHandler.GetNotifications)
			r.Get("/unread-count", notificationHandler.GetUnreadCount)
			r.Put("/mark-all-read", notificationHandler.MarkAllAsRead)
			r.Get("/{id}", notificationHandler.GetNotification)
			r.Put("/{id}/mark-read", notificationHandler.MarkNotificationAsRead)
			r.Delete("/{id}", notificationHandler.DeleteNotification)
		})
	})
	apiV1Router.Mount("/notifications", notificationsRouter)

	// Dashboard API
	dashboardRouter := chi.NewRouter()
	dashboardRouter.Route("/", func(r chi.Router) {
		dashboardHandler := dashboard.Handler{App: h.App}

		// Dashboard route requires authentication
		r.Group(func(r chi.Router) {
			tokenAuth := h.getTokenAuth()
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))

			// Get user's dashboard
			r.Get("/", dashboardHandler.GetUserDashboard)
		})
	})
	apiV1Router.Mount("/dashboard", dashboardRouter)

	// Admin API - All routes require authentication AND admin privileges
	adminRouter := chi.NewRouter()
	adminRouter.Route("/", func(r chi.Router) {
		adminHandler := admin.Handler{App: h.App}

		// All admin routes require authentication and admin privileges
		r.Group(func(r chi.Router) {
			tokenAuth := h.getTokenAuth()
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(httpmiddleware.RequireAdmin(h.App))

			// Admin management
			r.Get("/admins", adminHandler.ListAdmins)

			// User admin status management
			r.Put("/users/{id}/admin", adminHandler.GrantAdminStatus)
			r.Delete("/users/{id}/admin", adminHandler.RevokeAdminStatus)

			// User banning
			r.Post("/users/{id}/ban", adminHandler.BanUser)
			r.Delete("/users/{id}/ban", adminHandler.UnbanUser)
			r.Get("/users/banned", adminHandler.ListBannedUsers)

			// User lookup
			r.Get("/users/lookup/{username}", adminHandler.GetUserByUsername)

			// Content moderation
			r.Delete("/messages/{messageId}", adminHandler.DeleteMessage)
		})
	})
	apiV1Router.Mount("/admin", adminRouter)

	// API Documentation routes (public)
	docsHandler := &docs.Handler{}
	docsHandler.RegisterRoutes(apiV1Router)

	r.Mount("/api/v1", apiV1Router)

	// Serve static files for local storage (only when using LocalStorage backend)
	// S3 storage serves files directly from S3, so we only need this for local development
	if h.App.Config.Storage.Backend == "local" {
		workDir, _ := os.Getwd()
		filesDir := http.Dir(filepath.Join(workDir, h.App.Config.Storage.LocalPath))
		h.App.Logger.Info("Serving static files",
			"path", "/uploads",
			"directory", filesDir)

		// Use FileServer to serve files from the uploads directory
		fileServer := http.FileServer(filesDir)
		r.Get("/uploads/*", func(w http.ResponseWriter, r *http.Request) {
			// Strip /uploads prefix and serve the file
			r.URL.Path = strings.TrimPrefix(r.URL.Path, "/uploads")
			fileServer.ServeHTTP(w, r)
		})
	}

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
