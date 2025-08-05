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

	gameService := &db.GameService{DB: h.App.Pool}

	// TODO: Verify user has permission to update this game

	game, err := gameService.UpdateGameState(r.Context(), int32(gameID), data.State)
	if err != nil {
		h.App.Logger.Error("Failed to update game state", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format (same as GetGame)
	response := &GameResponse{
		ID:          game.ID,
		Title:       game.Title,
		Description: game.Description,
		GMUserID:    game.GmUserID,
		State:       game.State,
		CreatedAt:   game.CreatedAt.Time,
		UpdatedAt:   game.UpdatedAt.Time,
	}

	render.Render(w, r, response)
}
