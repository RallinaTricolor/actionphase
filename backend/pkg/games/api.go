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
	IsPublic            bool       `json:"is_public"`
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
	IsPublic            bool       `json:"is_public"`
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

	// Get user ID from JWT token (for now, we'll use a placeholder)
	userID := int32(1) // TODO: Extract from JWT

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
		IsPublic:            data.IsPublic,
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
		IsPublic:    game.IsPublic.Bool,
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
		IsPublic:    game.IsPublic.Bool,
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

func (h *Handler) GetPublicGames(w http.ResponseWriter, r *http.Request) {
	gameService := &db.GameService{DB: h.App.Pool}
	games, err := gameService.GetPublicGames(r.Context())
	if err != nil {
		h.App.Logger.Error("Failed to get public games", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

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
			"is_public":   game.IsPublic.Bool,
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

		response = append(response, gameData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
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
		IsPublic:    game.IsPublic.Bool,
		CreatedAt:   game.CreatedAt.Time,
		UpdatedAt:   game.UpdatedAt.Time,
	}

	render.Render(w, r, response)
}
