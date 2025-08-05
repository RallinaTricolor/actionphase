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

	game, err := gameService.CreateGame(r.Context(), db.CreateGameRequest{
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

type JoinGameRequest struct {
	Role string `json:"role,omitempty"` // defaults to "player"
}

func (r *JoinGameRequest) Bind(req *http.Request) error {
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
	updatedGame, err := gameService.UpdateGame(r.Context(), db.UpdateGameRequest{
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

// JoinGame - Join a game as a participant
func (h *Handler) JoinGame(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "id")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &JoinGameRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Default role to player
	if data.Role == "" {
		data.Role = "player"
	}

	// Validate role
	if data.Role != "player" && data.Role != "audience" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid role: must be 'player' or 'audience'")))
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

	// Check if user can join the game
	joinStatus, err := gameService.CanUserJoinGame(r.Context(), int32(gameID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to check if user can join game", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if joinStatus != "can_join" {
		var message string
		switch joinStatus {
		case "game_not_recruiting":
			message = "Game is not currently accepting new players"
		case "deadline_passed":
			message = "Recruitment deadline has passed"
		case "game_full":
			message = "Game is full"
		case "already_joined":
			message = "You are already a participant in this game"
		default:
			message = "Cannot join game"
		}
		render.Render(w, r, core.ErrBadRequest(fmt.Errorf(message)))
		return
	}

	// Add user as participant
	participant, err := gameService.AddGameParticipant(r.Context(), int32(gameID), userID, data.Role)
	if err != nil {
		h.App.Logger.Error("Failed to add game participant", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := map[string]interface{}{
		"id":        participant.ID,
		"game_id":   participant.GameID,
		"user_id":   participant.UserID,
		"role":      participant.Role,
		"status":    participant.Status,
		"joined_at": participant.JoinedAt.Time,
	}

	render.Status(r, http.StatusCreated)
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

	// Remove user from game participants
	err = gameService.RemoveGameParticipant(r.Context(), int32(gameID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to remove game participant", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
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
