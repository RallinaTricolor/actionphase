package games

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

type Handler struct {
	App *core.App
}

type CreateGameRequest struct {
	Title               string     `json:"title" validate:"required,min=3,max=255"`
	Description         string     `json:"description" validate:"required,min=10"`
	Genre               string     `json:"genre,omitempty"`
	StartDate           *time.Time `json:"start_date,omitempty"`
	EndDate             *time.Time `json:"end_date,omitempty"`
	RecruitmentDeadline *time.Time `json:"recruitment_deadline,omitempty"`
	MaxPlayers          int32      `json:"max_players,omitempty"`
}

func (r *CreateGameRequest) Bind(req *http.Request) error {
	return nil
}

type GameResponse struct {
	ID                  int32      `json:"id"`
	Title               string     `json:"title"`
	Description         string     `json:"description"`
	GMUserID            int32      `json:"gm_user_id"`
	State               string     `json:"state"`
	Genre               string     `json:"genre,omitempty"`
	StartDate           *time.Time `json:"start_date,omitempty"`
	EndDate             *time.Time `json:"end_date,omitempty"`
	RecruitmentDeadline *time.Time `json:"recruitment_deadline,omitempty"`
	MaxPlayers          int32      `json:"max_players,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

func (rd *GameResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

func (h *Handler) CreateGame(w http.ResponseWriter, r *http.Request) {
	data := &CreateGameRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// TODO: Validate request using validator
	if data.Title == "" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("title is required")))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	h.App.Logger.Info("Found user for game creation", "username", username, "user_id", user.ID)
	userID := int32(user.ID)

	gameService := &db.GameService{DB: h.App.Pool}

	game, err := gameService.CreateGame(r.Context(), core.CreateGameRequest{
		Title:               data.Title,
		Description:         data.Description,
		GMUserID:            userID,
		Genre:               data.Genre,
		StartDate:           data.StartDate,
		EndDate:             data.EndDate,
		RecruitmentDeadline: data.RecruitmentDeadline,
		MaxPlayers:          data.MaxPlayers,
		IsPublic:            true, // All games are now public
	})

	if err != nil {
		h.App.Logger.Error("Failed to create game", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &GameResponse{
		ID:          game.ID,
		Title:       game.Title,
		Description: game.Description,
		GMUserID:    game.GmUserID,
		State:       game.State,
		CreatedAt:   game.CreatedAt.Time,
		UpdatedAt:   game.UpdatedAt.Time,
	}

	if game.Genre.Valid {
		response.Genre = game.Genre.String
	}
	if game.StartDate.Valid {
		response.StartDate = &game.StartDate.Time
	}
	if game.EndDate.Valid {
		response.EndDate = &game.EndDate.Time
	}
	if game.RecruitmentDeadline.Valid {
		response.RecruitmentDeadline = &game.RecruitmentDeadline.Time
	}
	if game.MaxPlayers.Valid {
		response.MaxPlayers = game.MaxPlayers.Int32
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

func (h *Handler) GetGame(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format (same as CreateGame)
	response := &GameResponse{
		ID:          game.ID,
		Title:       game.Title,
		Description: game.Description,
		GMUserID:    game.GmUserID,
		State:       game.State,
		CreatedAt:   game.CreatedAt.Time,
		UpdatedAt:   game.UpdatedAt.Time,
	}

	if game.Genre.Valid {
		response.Genre = game.Genre.String
	}
	if game.StartDate.Valid {
		response.StartDate = &game.StartDate.Time
	}
	if game.EndDate.Valid {
		response.EndDate = &game.EndDate.Time
	}
	if game.RecruitmentDeadline.Valid {
		response.RecruitmentDeadline = &game.RecruitmentDeadline.Time
	}
	if game.MaxPlayers.Valid {
		response.MaxPlayers = game.MaxPlayers.Int32
	}

	render.Render(w, r, response)
}

func (h *Handler) GetAllGames(w http.ResponseWriter, r *http.Request) {
	gameService := &db.GameService{DB: h.App.Pool}
	games, err := gameService.GetAllGames(r.Context())
	if err != nil {
		h.App.Logger.Error("Failed to get all games", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("GetAllGames returned", "count", len(games))

	// Convert to response format
	var response []map[string]interface{}
	for _, game := range games {
		gameData := map[string]interface{}{
			"id":          game.ID,
			"title":       game.Title,
			"description": game.Description,
			"gm_user_id":  game.GmUserID,
			"gm_username": game.GmUsername,
			"state":       game.State,
			"created_at":  game.CreatedAt.Time,
			"updated_at":  game.UpdatedAt.Time,
		}

		if game.Genre.Valid {
			gameData["genre"] = game.Genre.String
		}
		if game.StartDate.Valid {
			gameData["start_date"] = game.StartDate.Time
		}
		if game.EndDate.Valid {
			gameData["end_date"] = game.EndDate.Time
		}
		if game.RecruitmentDeadline.Valid {
			gameData["recruitment_deadline"] = game.RecruitmentDeadline.Time
		}
		if game.MaxPlayers.Valid {
			gameData["max_players"] = game.MaxPlayers.Int32
		}
		if game.IsPublic.Valid {
			gameData["is_public"] = game.IsPublic.Bool
		}

		response = append(response, gameData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) GetAllGamesDebug(w http.ResponseWriter, r *http.Request) {
	// Direct SQL query to bypass SQLC
	rows, err := h.App.Pool.Query(r.Context(), "SELECT id, title, is_public FROM games WHERE is_public = true ORDER BY id DESC")
	if err != nil {
		h.App.Logger.Error("Direct query failed", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}
	defer rows.Close()

	var games []map[string]interface{}
	for rows.Next() {
		var id int32
		var title string
		var isPublic bool

		if err := rows.Scan(&id, &title, &isPublic); err != nil {
			h.App.Logger.Error("Row scan failed", "error", err)
			continue
		}

		games = append(games, map[string]interface{}{
			"id":        id,
			"title":     title,
			"is_public": isPublic,
		})
	}

	h.App.Logger.Info("Direct query returned", "count", len(games))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(games)
}

type UpdateGameStateRequest struct {
	State string `json:"state" validate:"required"`
}

func (r *UpdateGameStateRequest) Bind(req *http.Request) error {
	return nil
}

type UpdateGameRequest struct {
	Title               string     `json:"title" validate:"required,min=3,max=255"`
	Description         string     `json:"description" validate:"required,min=10"`
	Genre               string     `json:"genre,omitempty"`
	StartDate           *time.Time `json:"start_date,omitempty"`
	EndDate             *time.Time `json:"end_date,omitempty"`
	RecruitmentDeadline *time.Time `json:"recruitment_deadline,omitempty"`
	MaxPlayers          int32      `json:"max_players,omitempty"`
	IsPublic            bool       `json:"is_public"`
}

func (r *UpdateGameRequest) Bind(req *http.Request) error {
	return nil
}

type GameWithDetailsResponse struct {
	ID                  int32      `json:"id"`
	Title               string     `json:"title"`
	Description         string     `json:"description"`
	GMUserID            int32      `json:"gm_user_id"`
	GMUsername          string     `json:"gm_username,omitempty"`
	State               string     `json:"state"`
	Genre               string     `json:"genre,omitempty"`
	StartDate           *time.Time `json:"start_date,omitempty"`
	EndDate             *time.Time `json:"end_date,omitempty"`
	RecruitmentDeadline *time.Time `json:"recruitment_deadline,omitempty"`
	MaxPlayers          int32      `json:"max_players,omitempty"`
	CurrentPlayers      int64      `json:"current_players"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

func (rd *GameWithDetailsResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

func (h *Handler) UpdateGameState(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &UpdateGameStateRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)
	gameService := &db.GameService{DB: h.App.Pool}

	// Verify user is GM of this game
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game for permission check", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if game.GmUserID != userID {
		render.Render(w, r, core.ErrForbidden("only the GM can update this game state"))
		return
	}

	updatedGame, err := gameService.UpdateGameState(r.Context(), int32(gameID), data.State)
	if err != nil {
		h.App.Logger.Error("Failed to update game state", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// If transitioning out of recruitment, convert approved applications to participants
	if game.State == core.GameStateRecruitment && data.State != core.GameStateRecruitment {
		h.App.Logger.Info("Transitioning out of recruitment, converting approved applications", "game_id", gameID)

		applicationService := &db.GameApplicationService{DB: h.App.Pool}

		// First, auto-approve all pending applications (as specified in requirements)
		err = applicationService.BulkApproveApplications(r.Context(), int32(gameID), userID)
		if err != nil {
			h.App.Logger.Error("Failed to bulk approve applications", "error", err, "game_id", gameID)
			// Don't fail the state transition, but log the error
		}

		// Convert approved applications to participants
		err = applicationService.ConvertApprovedApplicationsToParticipants(r.Context(), int32(gameID))
		if err != nil {
			h.App.Logger.Error("Failed to convert approved applications to participants", "error", err, "game_id", gameID)
			// Don't fail the state transition, but log the error
		} else {
			h.App.Logger.Info("Successfully converted approved applications to participants", "game_id", gameID)
		}
	}

	// Convert to response format (same as GetGame)
	response := &GameResponse{
		ID:          updatedGame.ID,
		Title:       updatedGame.Title,
		Description: updatedGame.Description,
		GMUserID:    updatedGame.GmUserID,
		State:       updatedGame.State,
		CreatedAt:   updatedGame.CreatedAt.Time,
		UpdatedAt:   updatedGame.UpdatedAt.Time,
	}

	render.Render(w, r, response)
}

// UpdateGame - Update game details (GM only)
func (h *Handler) UpdateGame(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &UpdateGameRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)
	gameService := &db.GameService{DB: h.App.Pool}

	// Verify user is GM of this game
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game for permission check", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if game.GmUserID != userID {
		render.Render(w, r, core.ErrForbidden("only the GM can update this game"))
		return
	}

	// Update the game
	updatedGame, err := gameService.UpdateGame(r.Context(), core.UpdateGameRequest{
		ID:                  int32(gameID),
		Title:               data.Title,
		Description:         data.Description,
		Genre:               data.Genre,
		StartDate:           data.StartDate,
		EndDate:             data.EndDate,
		RecruitmentDeadline: data.RecruitmentDeadline,
		MaxPlayers:          data.MaxPlayers,
		IsPublic:            data.IsPublic,
	})

	if err != nil {
		h.App.Logger.Error("Failed to update game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &GameResponse{
		ID:          updatedGame.ID,
		Title:       updatedGame.Title,
		Description: updatedGame.Description,
		GMUserID:    updatedGame.GmUserID,
		State:       updatedGame.State,
		CreatedAt:   updatedGame.CreatedAt.Time,
		UpdatedAt:   updatedGame.UpdatedAt.Time,
	}

	if updatedGame.Genre.Valid {
		response.Genre = updatedGame.Genre.String
	}
	if updatedGame.StartDate.Valid {
		response.StartDate = &updatedGame.StartDate.Time
	}
	if updatedGame.EndDate.Valid {
		response.EndDate = &updatedGame.EndDate.Time
	}
	if updatedGame.RecruitmentDeadline.Valid {
		response.RecruitmentDeadline = &updatedGame.RecruitmentDeadline.Time
	}
	if updatedGame.MaxPlayers.Valid {
		response.MaxPlayers = updatedGame.MaxPlayers.Int32
	}

	render.Render(w, r, response)
}

// DeleteGame - Cancel/delete game (GM only)
func (h *Handler) DeleteGame(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)
	gameService := &db.GameService{DB: h.App.Pool}

	// Verify user is GM of this game
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game for permission check", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if game.GmUserID != userID {
		render.Render(w, r, core.ErrForbidden("only the GM can delete this game"))
		return
	}

	// Delete the game
	err = gameService.DeleteGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to delete game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetGameWithDetails - Get game with participant count and GM username
func (h *Handler) GetGameWithDetails(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool}
	game, err := gameService.GetGameWithDetails(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game with details", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &GameWithDetailsResponse{
		ID:             game.ID,
		Title:          game.Title,
		Description:    game.Description,
		GMUserID:       game.GmUserID,
		State:          game.State,
		CurrentPlayers: game.CurrentPlayers,
		CreatedAt:      game.CreatedAt.Time,
		UpdatedAt:      game.UpdatedAt.Time,
	}

	if game.GmUsername.Valid {
		response.GMUsername = game.GmUsername.String
	}
	if game.Genre.Valid {
		response.Genre = game.Genre.String
	}
	if game.StartDate.Valid {
		response.StartDate = &game.StartDate.Time
	}
	if game.EndDate.Valid {
		response.EndDate = &game.EndDate.Time
	}
	if game.RecruitmentDeadline.Valid {
		response.RecruitmentDeadline = &game.RecruitmentDeadline.Time
	}
	if game.MaxPlayers.Valid {
		response.MaxPlayers = game.MaxPlayers.Int32
	}

	render.Render(w, r, response)
}

// GetRecruitingGames - Get games currently accepting players
func (h *Handler) GetRecruitingGames(w http.ResponseWriter, r *http.Request) {
	gameService := &db.GameService{DB: h.App.Pool}
	games, err := gameService.GetRecruitingGames(r.Context())
	if err != nil {
		h.App.Logger.Error("Failed to get recruiting games", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []map[string]interface{}
	for _, game := range games {
		gameData := map[string]interface{}{
			"id":              game.ID,
			"title":           game.Title,
			"description":     game.Description,
			"gm_user_id":      game.GmUserID,
			"gm_username":     game.GmUsername,
			"state":           game.State,
			"current_players": game.CurrentPlayers,
			"created_at":      game.CreatedAt.Time,
			"updated_at":      game.UpdatedAt.Time,
		}

		if game.Genre.Valid {
			gameData["genre"] = game.Genre.String
		}
		if game.StartDate.Valid {
			gameData["start_date"] = game.StartDate.Time
		}
		if game.EndDate.Valid {
			gameData["end_date"] = game.EndDate.Time
		}
		if game.RecruitmentDeadline.Valid {
			gameData["recruitment_deadline"] = game.RecruitmentDeadline.Time
		}
		if game.MaxPlayers.Valid {
			gameData["max_players"] = game.MaxPlayers.Int32
		}

		response = append(response, gameData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// LeaveGame - Remove user from game participants
func (h *Handler) LeaveGame(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)
	gameService := &db.GameService{DB: h.App.Pool}
	applicationService := &db.GameApplicationService{DB: h.App.Pool}

	// First, try to remove user from game participants (if they are a participant)
	participantRemoved := false
	err = gameService.RemoveGameParticipant(r.Context(), int32(gameID), userID)
	if err != nil {
		// Log but don't fail - user might not be a participant (might just have an application)
		h.App.Logger.Debug("User not found in participants (might have application instead)", "game_id", gameID, "user_id", userID)
	} else {
		participantRemoved = true
		h.App.Logger.Info("Removed user from game participants", "game_id", gameID, "user_id", userID)
	}

	// Also check for and withdraw any pending applications
	application, err := applicationService.GetGameApplicationByUserAndGame(r.Context(), int32(gameID), userID)
	if err != nil {
		// User has no application - that's fine if they were a participant
		if !participantRemoved {
			h.App.Logger.Error("User is neither participant nor applicant", "error", err, "game_id", gameID, "user_id", userID)
			render.Render(w, r, core.ErrNotFound("you are not associated with this game"))
			return
		}
	} else {
		// Withdraw the application if it's pending
		if application.Status == core.ApplicationStatusPending {
			err = applicationService.WithdrawGameApplication(r.Context(), application.ID, userID)
			if err != nil {
				h.App.Logger.Error("Failed to withdraw application", "error", err, "application_id", application.ID)
				render.Render(w, r, core.ErrInternalError(err))
				return
			}
			h.App.Logger.Info("Withdrew pending application", "application_id", application.ID, "game_id", gameID, "user_id", userID)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetGameParticipants - Get all participants for a game
func (h *Handler) GetGameParticipants(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	gameService := &db.GameService{DB: h.App.Pool}
	participants, err := gameService.GetGameParticipants(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game participants", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []map[string]interface{}
	for _, participant := range participants {
		participantData := map[string]interface{}{
			"id":        participant.ID,
			"game_id":   participant.GameID,
			"user_id":   participant.UserID,
			"username":  participant.Username,
			"email":     participant.Email,
			"role":      participant.Role,
			"status":    participant.Status,
			"joined_at": participant.JoinedAt.Time,
		}
		response = append(response, participantData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// === GAME APPLICATION ENDPOINTS ===

type ApplyToGameRequest struct {
	Role    string `json:"role" validate:"required"`
	Message string `json:"message,omitempty"`
}

func (r *ApplyToGameRequest) Bind(req *http.Request) error {
	return nil
}

type GameApplicationResponse struct {
	ID               int32      `json:"id"`
	GameID           int32      `json:"game_id"`
	UserID           int32      `json:"user_id"`
	Username         string     `json:"username,omitempty"`
	Email            string     `json:"email,omitempty"`
	Role             string     `json:"role"`
	Message          string     `json:"message,omitempty"`
	Status           string     `json:"status"`
	AppliedAt        time.Time  `json:"applied_at"`
	ReviewedAt       *time.Time `json:"reviewed_at,omitempty"`
	ReviewedByUserID *int32     `json:"reviewed_by_user_id,omitempty"`
}

func (rd *GameApplicationResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// ApplyToGame - Apply to join a game as a player or audience
func (h *Handler) ApplyToGame(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &ApplyToGameRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Validate role
	if data.Role != "player" && data.Role != "audience" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("role must be 'player' or 'audience'")))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)
	applicationService := &db.GameApplicationService{DB: h.App.Pool}

	// Create the application
	application, err := applicationService.CreateGameApplication(r.Context(), core.CreateGameApplicationRequest{
		GameID:  int32(gameID),
		UserID:  userID,
		Role:    data.Role,
		Message: data.Message,
	})
	if err != nil {
		h.App.Logger.Error("Failed to create game application", "error", err, "game_id", gameID, "user_id", userID)

		// Check for specific error types to provide better responses
		if fmt.Sprintf("%v", err) == "user already has a pending application for this game" {
			render.Render(w, r, core.ErrBadRequest(err))
			return
		}
		if fmt.Sprintf("%v", err) == "user is already a participant in this game" {
			render.Render(w, r, core.ErrBadRequest(err))
			return
		}
		if fmt.Sprintf("%v", err) == "game is not currently recruiting" {
			render.Render(w, r, core.ErrBadRequest(err))
			return
		}

		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &GameApplicationResponse{
		ID:        application.ID,
		GameID:    application.GameID,
		UserID:    application.UserID,
		Username:  user.Username,
		Role:      application.Role,
		Status:    application.Status,
		AppliedAt: application.AppliedAt.Time,
	}

	if application.Message.Valid {
		response.Message = application.Message.String
	}
	if application.ReviewedAt.Valid {
		reviewedAt := application.ReviewedAt.Time
		response.ReviewedAt = &reviewedAt
	}
	if application.ReviewedByUserID.Valid {
		reviewedByUserID := application.ReviewedByUserID.Int32
		response.ReviewedByUserID = &reviewedByUserID
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetGameApplications - Get all applications for a game (GM only)
func (h *Handler) GetGameApplications(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)

	// Verify user is GM of this game
	gameService := &db.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game for permission check", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if game.GmUserID != userID {
		render.Render(w, r, core.ErrForbidden("only the GM can view game applications"))
		return
	}

	// Get applications for the game
	applicationService := &db.GameApplicationService{DB: h.App.Pool}
	applications, err := applicationService.GetGameApplications(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game applications", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []map[string]interface{}
	for _, app := range applications {
		appData := map[string]interface{}{
			"id":         app.ID,
			"game_id":    app.GameID,
			"user_id":    app.UserID,
			"username":   app.Username,
			"email":      app.Email,
			"role":       app.Role,
			"status":     app.Status,
			"applied_at": app.AppliedAt.Time,
		}

		if app.Message.Valid {
			appData["message"] = app.Message.String
		}
		if app.ReviewedAt.Valid {
			appData["reviewed_at"] = app.ReviewedAt.Time
		}
		if app.ReviewedByUserID.Valid {
			appData["reviewed_by_user_id"] = app.ReviewedByUserID.Int32
		}

		response = append(response, appData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

type ReviewApplicationRequest struct {
	Action string `json:"action" validate:"required"` // "approve" or "reject"
}

func (r *ReviewApplicationRequest) Bind(req *http.Request) error {
	return nil
}

// ReviewGameApplication - Approve or reject a game application (GM only)
func (h *Handler) ReviewGameApplication(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	applicationIDStr := chi.URLParam(r, "applicationId")
	applicationID, err := strconv.ParseInt(applicationIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid application ID")))
		return
	}

	data := &ReviewApplicationRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Validate action
	if data.Action != "approve" && data.Action != "reject" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("action must be 'approve' or 'reject'")))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)

	// Verify user is GM of this game
	gameService := &db.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game for permission check", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if game.GmUserID != userID {
		render.Render(w, r, core.ErrForbidden("only the GM can review game applications"))
		return
	}

	// Verify application belongs to this game
	applicationService := &db.GameApplicationService{DB: h.App.Pool}
	application, err := applicationService.GetGameApplication(r.Context(), int32(applicationID))
	if err != nil {
		h.App.Logger.Error("Failed to get game application", "error", err, "application_id", applicationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if application.GameID != int32(gameID) {
		render.Render(w, r, core.ErrBadRequest(fmt.Errorf("application does not belong to this game")))
		return
	}

	// Perform the action
	if data.Action == "approve" {
		err = applicationService.ApproveGameApplication(r.Context(), int32(applicationID), userID)
	} else {
		err = applicationService.RejectGameApplication(r.Context(), int32(applicationID), userID)
	}

	if err != nil {
		h.App.Logger.Error("Failed to review game application", "error", err, "application_id", applicationID, "action", data.Action)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Return updated application
	updatedApplication, err := applicationService.GetGameApplication(r.Context(), int32(applicationID))
	if err != nil {
		h.App.Logger.Error("Failed to get updated application", "error", err, "application_id", applicationID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := &GameApplicationResponse{
		ID:        updatedApplication.ID,
		GameID:    updatedApplication.GameID,
		UserID:    updatedApplication.UserID,
		Role:      updatedApplication.Role,
		Status:    updatedApplication.Status,
		AppliedAt: updatedApplication.AppliedAt.Time,
	}

	if updatedApplication.Message.Valid {
		response.Message = updatedApplication.Message.String
	}
	if updatedApplication.ReviewedAt.Valid {
		reviewedAt := updatedApplication.ReviewedAt.Time
		response.ReviewedAt = &reviewedAt
	}
	if updatedApplication.ReviewedByUserID.Valid {
		reviewedByUserID := updatedApplication.ReviewedByUserID.Int32
		response.ReviewedByUserID = &reviewedByUserID
	}

	render.Render(w, r, response)
}

// WithdrawGameApplication - Withdraw user's own application
func (h *Handler) WithdrawGameApplication(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		render.Render(w, r, core.ErrUnauthorized("no valid token found"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up user by username to get user ID
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to get user by username", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int32(user.ID)

	// Find user's application for this game
	applicationService := &db.GameApplicationService{DB: h.App.Pool}
	application, err := applicationService.GetGameApplicationByUserAndGame(r.Context(), int32(gameID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to get user's application", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrNotFound("no application found for this game"))
		return
	}

	// Only allow withdrawal of pending applications
	if application.Status != core.ApplicationStatusPending {
		render.Render(w, r, core.ErrBadRequest(fmt.Errorf("can only withdraw pending applications")))
		return
	}

	// Withdraw the application
	err = applicationService.WithdrawGameApplication(r.Context(), application.ID, userID)
	if err != nil {
		h.App.Logger.Error("Failed to withdraw application", "error", err, "application_id", application.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
