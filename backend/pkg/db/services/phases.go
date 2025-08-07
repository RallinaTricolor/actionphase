package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PhaseService struct {
	DB *pgxpool.Pool
}

// Request/Response types for phase management

type CreatePhaseRequest struct {
	GameID    int32
	PhaseType string // "common_room", "action", "results"
	StartTime *time.Time
	EndTime   *time.Time
	Deadline  *time.Time
}

type PhaseResponse struct {
	ID          int32      `json:"id"`
	GameID      int32      `json:"game_id"`
	PhaseType   string     `json:"phase_type"`
	PhaseNumber int32      `json:"phase_number"`
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time,omitempty"`
	Deadline    *time.Time `json:"deadline,omitempty"`
	IsActive    bool       `json:"is_active"`
	CreatedAt   time.Time  `json:"created_at"`
}

type ActionSubmissionRequest struct {
	GameID      int32
	UserID      int32
	PhaseID     int32
	CharacterID *int32
	Content     string
}

type ActionResponse struct {
	ID          int32     `json:"id"`
	GameID      int32     `json:"game_id"`
	UserID      int32     `json:"user_id"`
	PhaseID     int32     `json:"phase_id"`
	CharacterID *int32    `json:"character_id,omitempty"`
	Content     string    `json:"content"`
	SubmittedAt time.Time `json:"submitted_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Phase Management Methods

func (ps *PhaseService) CreatePhase(ctx context.Context, req CreatePhaseRequest) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	// Validate phase type
	validPhaseTypes := []string{"common_room", "action", "results"}
	isValid := false
	for _, validType := range validPhaseTypes {
		if req.PhaseType == validType {
			isValid = true
			break
		}
	}
	if !isValid {
		return nil, fmt.Errorf("invalid phase type: %s", req.PhaseType)
	}

	// Get next phase number
	latestPhaseNum, err := queries.GetLatestPhaseNumber(ctx, req.GameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest phase number: %w", err)
	}

	// Convert interface{} to int32 safely
	var phaseNumber int32 = 1
	if latestPhaseNum != nil {
		if val, ok := latestPhaseNum.(int64); ok {
			phaseNumber = int32(val) + 1
		}
	}

	// Set default start time if not provided
	startTime := time.Now()
	if req.StartTime != nil {
		startTime = *req.StartTime
	}

	// Convert times to pgtype.Timestamptz
	params := models.CreateGamePhaseParams{
		GameID:      req.GameID,
		PhaseType:   req.PhaseType,
		PhaseNumber: phaseNumber,
		StartTime:   pgtype.Timestamptz{Time: startTime, Valid: true},
	}

	if req.EndTime != nil {
		params.EndTime = pgtype.Timestamptz{Time: *req.EndTime, Valid: true}
	}

	if req.Deadline != nil {
		params.Deadline = pgtype.Timestamptz{Time: *req.Deadline, Valid: true}
	}

	phase, err := queries.CreateGamePhase(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create phase: %w", err)
	}

	return &phase, nil
}

func (ps *PhaseService) GetActivePhase(ctx context.Context, gameID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	phase, err := queries.GetActivePhase(ctx, gameID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No active phase
		}
		return nil, fmt.Errorf("failed to get active phase: %w", err)
	}

	return &phase, nil
}

func (ps *PhaseService) GetGamePhases(ctx context.Context, gameID int32) ([]models.GamePhase, error) {
	queries := models.New(ps.DB)

	phases, err := queries.GetGamePhases(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game phases: %w", err)
	}

	return phases, nil
}

func (ps *PhaseService) GetPhase(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	phase, err := queries.GetPhase(ctx, phaseID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("phase not found")
		}
		return nil, fmt.Errorf("failed to get phase: %w", err)
	}

	return &phase, nil
}

func (ps *PhaseService) ActivatePhase(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	// Get the phase to find the game ID
	phase, err := queries.GetPhase(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get phase: %w", err)
	}

	// Start transaction to ensure atomicity
	tx, err := ps.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	txQueries := models.New(tx)

	// Deactivate all other phases for this game
	err = txQueries.DeactivateAllGamePhases(ctx, phase.GameID)
	if err != nil {
		return nil, fmt.Errorf("failed to deactivate existing phases: %w", err)
	}

	// Activate the new phase
	activePhase, err := txQueries.ActivatePhase(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to activate phase: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &activePhase, nil
}

func (ps *PhaseService) DeactivatePhase(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	phase, err := queries.DeactivatePhase(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to deactivate phase: %w", err)
	}

	return &phase, nil
}

func (ps *PhaseService) ExtendPhaseDeadline(ctx context.Context, phaseID int32, newDeadline time.Time) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	params := models.UpdatePhaseDeadlineParams{
		ID:       phaseID,
		Deadline: pgtype.Timestamptz{Time: newDeadline, Valid: true},
	}

	phase, err := queries.UpdatePhaseDeadline(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to update phase deadline: %w", err)
	}

	return &phase, nil
}

// Action Submission Methods

func (ps *PhaseService) SubmitAction(ctx context.Context, req ActionSubmissionRequest) (*models.ActionSubmission, error) {
	queries := models.New(ps.DB)

	// Verify phase exists and is active
	phase, err := queries.GetPhase(ctx, req.PhaseID)
	if err != nil {
		return nil, fmt.Errorf("phase not found")
	}

	if !phase.IsActive.Bool {
		return nil, fmt.Errorf("phase is not active")
	}

	if phase.PhaseType != "action" {
		return nil, fmt.Errorf("actions can only be submitted during action phases")
	}

	// Check deadline if set
	if phase.Deadline.Valid && time.Now().After(phase.Deadline.Time) {
		return nil, fmt.Errorf("action submission deadline has passed")
	}

	// Prepare parameters
	params := models.SubmitActionParams{
		GameID:  req.GameID,
		UserID:  req.UserID,
		PhaseID: req.PhaseID,
		Content: req.Content,
	}

	if req.CharacterID != nil {
		params.CharacterID = pgtype.Int4{Int32: *req.CharacterID, Valid: true}
	}

	action, err := queries.SubmitAction(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to submit action: %w", err)
	}

	return &action, nil
}

func (ps *PhaseService) GetUserAction(ctx context.Context, gameID, userID, phaseID int32) (*models.ActionSubmission, error) {
	queries := models.New(ps.DB)

	params := models.GetUserActionParams{
		GameID:  gameID,
		UserID:  userID,
		PhaseID: phaseID,
	}

	action, err := queries.GetUserAction(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No action submitted yet
		}
		return nil, fmt.Errorf("failed to get user action: %w", err)
	}

	return &action, nil
}

func (ps *PhaseService) GetUserActions(ctx context.Context, gameID, userID int32) ([]models.GetUserActionsRow, error) {
	queries := models.New(ps.DB)

	params := models.GetUserActionsParams{
		GameID: gameID,
		UserID: userID,
	}

	actions, err := queries.GetUserActions(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get user actions: %w", err)
	}

	return actions, nil
}

func (ps *PhaseService) GetPhaseActions(ctx context.Context, phaseID int32) ([]models.GetPhaseActionsRow, error) {
	queries := models.New(ps.DB)

	actions, err := queries.GetPhaseActions(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get phase actions: %w", err)
	}

	return actions, nil
}

func (ps *PhaseService) GetGameActions(ctx context.Context, gameID int32) ([]models.GetGameActionsRow, error) {
	queries := models.New(ps.DB)

	actions, err := queries.GetGameActions(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game actions: %w", err)
	}

	return actions, nil
}

func (ps *PhaseService) DeleteAction(ctx context.Context, gameID, userID, phaseID int32) error {
	queries := models.New(ps.DB)

	params := models.DeleteActionParams{
		GameID:  gameID,
		UserID:  userID,
		PhaseID: phaseID,
	}

	err := queries.DeleteAction(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to delete action: %w", err)
	}

	return nil
}

// Action Results Methods

func (ps *PhaseService) SendActionResult(ctx context.Context, gameID, userID, phaseID, gmUserID int32, content string) (*models.ActionResult, error) {
	queries := models.New(ps.DB)

	params := models.SendActionResultParams{
		GameID:   gameID,
		UserID:   userID,
		PhaseID:  phaseID,
		GmUserID: gmUserID,
		Content:  content,
	}

	result, err := queries.SendActionResult(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to send action result: %w", err)
	}

	return &result, nil
}

func (ps *PhaseService) GetUserResults(ctx context.Context, gameID, userID int32) ([]models.GetUserResultsRow, error) {
	queries := models.New(ps.DB)

	params := models.GetUserResultsParams{
		GameID: gameID,
		UserID: userID,
	}

	results, err := queries.GetUserResults(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get user results: %w", err)
	}

	return results, nil
}

// Permission checking

func (ps *PhaseService) CanUserManagePhases(ctx context.Context, gameID, userID int32) (bool, error) {
	// Check if user is GM of the game
	gameService := &GameService{DB: ps.DB}
	game, err := gameService.GetGame(ctx, gameID)
	if err != nil {
		return false, fmt.Errorf("failed to get game: %w", err)
	}

	return game.GmUserID == userID, nil
}

func (ps *PhaseService) CanUserSubmitActions(ctx context.Context, gameID, userID int32) (bool, error) {
	// Check if user is participant (player, GM, or audience with assigned NPCs)
	gameService := &GameService{DB: ps.DB}
	participants, err := gameService.GetGameParticipants(ctx, gameID)
	if err != nil {
		return false, fmt.Errorf("failed to get game participants: %w", err)
	}

	for _, participant := range participants {
		if participant.UserID == userID && participant.Status == "active" {
			return true, nil
		}
	}

	return false, nil
}

// Helper functions

func (ps *PhaseService) ConvertPhaseToResponse(phase *models.GamePhase) PhaseResponse {
	response := PhaseResponse{
		ID:          phase.ID,
		GameID:      phase.GameID,
		PhaseType:   phase.PhaseType,
		PhaseNumber: phase.PhaseNumber,
		StartTime:   phase.StartTime.Time,
		IsActive:    phase.IsActive.Bool,
		CreatedAt:   phase.CreatedAt.Time,
	}

	if phase.EndTime.Valid {
		response.EndTime = &phase.EndTime.Time
	}

	if phase.Deadline.Valid {
		response.Deadline = &phase.Deadline.Time
	}

	return response
}

func (ps *PhaseService) ConvertActionToResponse(action *models.ActionSubmission) ActionResponse {
	response := ActionResponse{
		ID:          action.ID,
		GameID:      action.GameID,
		UserID:      action.UserID,
		PhaseID:     action.PhaseID,
		Content:     action.Content,
		SubmittedAt: action.SubmittedAt.Time,
		UpdatedAt:   action.UpdatedAt.Time,
	}

	if action.CharacterID.Valid {
		response.CharacterID = &action.CharacterID.Int32
	}

	return response
}
