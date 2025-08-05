package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	models "actionphase/pkg/db/models"
)

type GameService struct {
	DB *pgxpool.Pool
}

type CreateGameRequest struct {
	Title               string
	Description         string
	GMUserID            int32
	Genre               string
	StartDate           *time.Time
	EndDate             *time.Time
	RecruitmentDeadline *time.Time
	MaxPlayers          int32
	IsPublic            bool
}

type GameWithDetails struct {
	Game             models.Game
	GMUsername       string
	ParticipantCount int64
	UserRole         string // empty if user not in game
}

func (gs *GameService) CreateGame(ctx context.Context, req CreateGameRequest) (*models.Game, error) {
	queries := models.New(gs.DB)

	var startDate, endDate, recruitmentDeadline pgtype.Timestamptz

	if req.StartDate != nil {
		startDate = pgtype.Timestamptz{Time: *req.StartDate, Valid: true}
	}
	if req.EndDate != nil {
		endDate = pgtype.Timestamptz{Time: *req.EndDate, Valid: true}
	}
	if req.RecruitmentDeadline != nil {
		recruitmentDeadline = pgtype.Timestamptz{Time: *req.RecruitmentDeadline, Valid: true}
	}

	game, err := queries.CreateGame(ctx, models.CreateGameParams{
		Title:               req.Title,
		Description:         req.Description,
		GmUserID:            req.GMUserID,
		Genre:               pgtype.Text{String: req.Genre, Valid: req.Genre != ""},
		StartDate:           startDate,
		EndDate:             endDate,
		RecruitmentDeadline: recruitmentDeadline,
		MaxPlayers:          pgtype.Int4{Int32: req.MaxPlayers, Valid: req.MaxPlayers > 0},
		IsPublic:            pgtype.Bool{Bool: req.IsPublic, Valid: true},
	})

	return &game, err
}

func (gs *GameService) GetGame(ctx context.Context, gameID int32) (*models.Game, error) {
	queries := models.New(gs.DB)
	game, err := queries.GetGame(ctx, gameID)
	return &game, err
}

func (gs *GameService) GetGamesByUser(ctx context.Context, userID int32) ([]models.GetGamesByUserRow, error) {
	queries := models.New(gs.DB)
	return queries.GetGamesByUser(ctx, userID)
}

func (gs *GameService) GetPublicGames(ctx context.Context) ([]models.GetPublicGamesRow, error) {
	queries := models.New(gs.DB)
	return queries.GetPublicGames(ctx)
}

func (gs *GameService) UpdateGameState(ctx context.Context, gameID int32, newState string) (*models.Game, error) {
	queries := models.New(gs.DB)

	// Validate state transition
	if !isValidGameState(newState) {
		return nil, fmt.Errorf("invalid game state: %s", newState)
	}

	game, err := queries.UpdateGameState(ctx, models.UpdateGameStateParams{
		ID:    gameID,
		State: newState,
	})

	return &game, err
}

func (gs *GameService) JoinGame(ctx context.Context, gameID, userID int32, role string) error {
	queries := models.New(gs.DB)

	// Check if game is in recruitment state
	game, err := queries.GetGame(ctx, gameID)
	if err != nil {
		return err
	}

	if game.State != "recruitment" {
		return fmt.Errorf("game is not accepting new participants (current state: %s)", game.State)
	}

	// Check if game is full (for players)
	if role == "player" {
		count, err := queries.GetGameParticipantCount(ctx, gameID)
		if err != nil {
			return err
		}

		maxPlayers := int64(6) // default
		if game.MaxPlayers.Valid {
			maxPlayers = int64(game.MaxPlayers.Int32)
		}

		if count >= maxPlayers {
			return fmt.Errorf("game is full (%d/%d players)", count, maxPlayers)
		}
	}

	// Add participant
	_, err = queries.AddGameParticipant(ctx, models.AddGameParticipantParams{
		GameID: gameID,
		UserID: userID,
		Role:   role,
	})

	return err
}

func (gs *GameService) LeaveGame(ctx context.Context, gameID, userID int32) error {
	queries := models.New(gs.DB)

	// Check if user is GM (GMs cannot leave their own games)
	game, err := queries.GetGame(ctx, gameID)
	if err != nil {
		return err
	}

	if game.GmUserID == userID {
		return fmt.Errorf("game master cannot leave their own game")
	}

	return queries.RemoveGameParticipant(ctx, models.RemoveGameParticipantParams{
		GameID: gameID,
		UserID: userID,
	})
}

func (gs *GameService) GetUserRole(ctx context.Context, gameID, userID int32) (string, error) {
	queries := models.New(gs.DB)

	// Check if user is GM
	game, err := queries.GetGame(ctx, gameID)
	if err != nil {
		return "", err
	}

	if game.GmUserID == userID {
		return "gm", nil
	}

	// Check participant role
	role, err := queries.GetParticipantRole(ctx, models.GetParticipantRoleParams{
		GameID: gameID,
		UserID: userID,
	})
	if err != nil {
		return "", err
	}

	return role, nil
}

func (gs *GameService) IsUserInGame(ctx context.Context, gameID, userID int32) (bool, error) {
	queries := models.New(gs.DB)

	// Check if user is GM
	game, err := queries.GetGame(ctx, gameID)
	if err != nil {
		return false, err
	}

	if game.GmUserID == userID {
		return true, nil
	}

	// Check if user is participant
	exists, err := queries.IsUserInGame(ctx, models.IsUserInGameParams{
		GameID: gameID,
		UserID: userID,
	})

	return exists, err
}

func isValidGameState(state string) bool {
	validStates := []string{"setup", "recruitment", "character_creation", "in_progress", "paused", "completed", "cancelled"}
	for _, validState := range validStates {
		if state == validState {
			return true
		}
	}
	return false
}
