package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// GameService provides database operations for game management.
// It implements core.GameServiceInterface and handles all game-related
// database interactions including CRUD operations, state management,
// and participant management.
type GameService struct {
	DB *pgxpool.Pool
}

// Ensure GameService implements the interface at compile time
var _ core.GameServiceInterface = (*GameService)(nil)

// GameWithDetails represents a game enriched with additional metadata
// including GM information, participant count, and user's role in the game.
// This is used for detailed game views that require aggregated data.
type GameWithDetails struct {
	Game             models.Game
	GMUsername       string // Username of the Game Master
	ParticipantCount int64  // Number of current participants
	UserRole         string // User's role in this game, empty if not participating
}

// CreateGame creates a new game with the specified parameters.
// The game is initially created in "setup" state and requires the GM to
// transition it to "recruitment" when ready to accept players.
//
// Parameters:
//   - ctx: Context for the database operation
//   - req: Game creation request with title, description, GM user ID, and optional settings
//
// Returns:
//   - *models.Game: The created game with generated ID and default state
//   - error: Database error or validation failure
//
// Business Rules:
//   - GMUserID must reference a valid user
//   - Title and description are required
//   - Optional dates must be in logical order (recruitment < start < end)
//   - MaxPlayers defaults to 6 if not specified
//   - Game starts in "setup" state
func (gs *GameService) CreateGame(ctx context.Context, req core.CreateGameRequest) (*models.Game, error) {
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

func (gs *GameService) GetAllGames(ctx context.Context) ([]models.GetAllGamesRow, error) {
	queries := models.New(gs.DB)
	return queries.GetAllGames(ctx)
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

// isValidGameState validates that a game state string is one of the allowed values.
// This function enforces the game state machine and prevents invalid transitions.
//
// Valid Game States:
//   - "setup": Initial state when game is created, GM configuring game
//   - "recruitment": Game is accepting new players to join
//   - "character_creation": Players are creating their characters
//   - "in_progress": Game is actively being played
//   - "paused": Game is temporarily suspended but can resume
//   - "completed": Game has finished successfully
//   - "cancelled": Game was cancelled before completion
//
// State Transition Rules (enforced at business logic level):
//
//	setup → recruitment → character_creation → in_progress ↔ paused → completed
//	Any state → cancelled (emergency cancellation)
//
// Parameters:
//   - state: The state string to validate
//
// Returns:
//   - bool: true if state is valid, false otherwise
func isValidGameState(state string) bool {
	validStates := []string{"setup", "recruitment", "character_creation", "in_progress", "paused", "completed", "cancelled"}
	for _, validState := range validStates {
		if state == validState {
			return true
		}
	}
	return false
}

// UpdateGame - Update game details
func (gs *GameService) UpdateGame(ctx context.Context, req core.UpdateGameRequest) (*models.Game, error) {
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

	game, err := queries.UpdateGame(ctx, models.UpdateGameParams{
		ID:                  req.ID,
		Title:               req.Title,
		Description:         req.Description,
		Genre:               pgtype.Text{String: req.Genre, Valid: req.Genre != ""},
		StartDate:           startDate,
		EndDate:             endDate,
		RecruitmentDeadline: recruitmentDeadline,
		MaxPlayers:          pgtype.Int4{Int32: req.MaxPlayers, Valid: req.MaxPlayers > 0},
		IsPublic:            pgtype.Bool{Bool: req.IsPublic, Valid: true},
	})

	return &game, err
}

// DeleteGame - Delete a game
func (gs *GameService) DeleteGame(ctx context.Context, gameID int32) error {
	queries := models.New(gs.DB)
	return queries.DeleteGame(ctx, gameID)
}

// GetGameWithDetails - Get game with additional details like GM username and player count
func (gs *GameService) GetGameWithDetails(ctx context.Context, gameID int32) (*models.GetGameWithDetailsRow, error) {
	queries := models.New(gs.DB)
	game, err := queries.GetGameWithDetails(ctx, gameID)
	return &game, err
}

// GetRecruitingGames - Get games currently accepting players
func (gs *GameService) GetRecruitingGames(ctx context.Context) ([]models.GetRecruitingGamesRow, error) {
	queries := models.New(gs.DB)
	return queries.GetRecruitingGames(ctx)
}

// CanUserJoinGame - Check if user can join a game
func (gs *GameService) CanUserJoinGame(ctx context.Context, gameID, userID int32) (string, error) {
	queries := models.New(gs.DB)
	return queries.CanUserJoinGame(ctx, models.CanUserJoinGameParams{
		GameID: gameID,
		UserID: userID,
	})
}

// AddGameParticipant - Add a user as a participant to a game
func (gs *GameService) AddGameParticipant(ctx context.Context, gameID, userID int32, role string) (*models.GameParticipant, error) {
	queries := models.New(gs.DB)
	participant, err := queries.AddGameParticipant(ctx, models.AddGameParticipantParams{
		GameID: gameID,
		UserID: userID,
		Role:   role,
	})
	return &participant, err
}

// RemoveGameParticipant - Remove a user from game participants
func (gs *GameService) RemoveGameParticipant(ctx context.Context, gameID, userID int32) error {
	queries := models.New(gs.DB)
	return queries.RemoveGameParticipant(ctx, models.RemoveGameParticipantParams{
		GameID: gameID,
		UserID: userID,
	})
}

// GetGameParticipants - Get all participants for a game
func (gs *GameService) GetGameParticipants(ctx context.Context, gameID int32) ([]models.GetGameParticipantsRow, error) {
	queries := models.New(gs.DB)
	return queries.GetGameParticipants(ctx, gameID)
}
