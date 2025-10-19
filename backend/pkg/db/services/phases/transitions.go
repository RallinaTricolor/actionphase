package phases

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/jackc/pgx/v5/pgtype"
)

// TransitionToNextPhase creates and activates a new phase, deactivating the current one if it exists
func (ps *PhaseService) TransitionToNextPhase(ctx context.Context, gameID, userID int32, req core.TransitionPhaseRequest) (*models.GamePhase, error) {
	// Start transaction for atomic phase transition
	tx, err := ps.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	txQueries := models.New(tx)

	// Get current active phase
	currentPhase, err := txQueries.GetActivePhase(ctx, gameID)
	var currentPhaseID *int32
	if err == nil {
		currentPhaseID = &currentPhase.ID
		// Deactivate current phase
		_, err = txQueries.DeactivatePhase(ctx, currentPhase.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to deactivate current phase: %w", err)
		}
	}

	// Get next phase number
	latestPhaseNum, err := txQueries.GetLatestPhaseNumber(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest phase number: %w", err)
	}

	var phaseNumber int32 = 1
	if latestPhaseNum != nil {
		switch val := latestPhaseNum.(type) {
		case int32:
			phaseNumber = val + 1
		case int64:
			phaseNumber = int32(val) + 1
		}
	}

	// Calculate timing
	startTime := time.Now()
	var endTime *time.Time
	if req.Duration != nil {
		calcEndTime := startTime.Add(*req.Duration)
		endTime = &calcEndTime
	} else if req.EndTime != nil {
		endTime = req.EndTime
	}

	// Create new phase
	createReq := core.CreatePhaseRequest{
		GameID:      gameID,
		PhaseType:   req.PhaseType,
		PhaseNumber: phaseNumber,
		Title:       req.Title,
		Description: req.Description,
		StartTime:   &startTime,
		EndTime:     endTime,
		Deadline:    req.Deadline,
	}

	params := models.CreateGamePhaseParams{
		GameID:      createReq.GameID,
		PhaseType:   createReq.PhaseType,
		PhaseNumber: createReq.PhaseNumber,
		Title:       createReq.Title,
		Description: pgtype.Text{String: createReq.Description, Valid: createReq.Description != ""},
		StartTime:   pgtype.Timestamptz{Time: startTime, Valid: true},
	}

	if createReq.EndTime != nil {
		params.EndTime = pgtype.Timestamptz{Time: *createReq.EndTime, Valid: true}
	}
	if createReq.Deadline != nil {
		params.Deadline = pgtype.Timestamptz{Time: *createReq.Deadline, Valid: true}
	}

	newPhase, err := txQueries.CreateGamePhase(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create new phase: %w", err)
	}

	// Activate the new phase
	activePhase, err := txQueries.ActivatePhase(ctx, newPhase.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to activate new phase: %w", err)
	}

	// Log the transition
	transitionParams := models.CreatePhaseTransitionParams{
		GameID:      gameID,
		ToPhaseID:   newPhase.ID,
		InitiatedBy: userID,
		Reason:      pgtype.Text{String: req.Reason, Valid: req.Reason != ""},
	}
	if currentPhaseID != nil {
		transitionParams.FromPhaseID = pgtype.Int4{Int32: *currentPhaseID, Valid: true}
	}

	_, err = txQueries.CreatePhaseTransition(ctx, transitionParams)
	if err != nil {
		return nil, fmt.Errorf("failed to log phase transition: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &activePhase, nil
}

// ActivatePhase activates a specific phase for a game
func (ps *PhaseService) ActivatePhase(ctx context.Context, phaseID, userID int32) error {
	_, err := ps.activatePhaseInternal(ctx, phaseID)
	return err
}

// activatePhaseInternal is an internal method to avoid recursion
func (ps *PhaseService) activatePhaseInternal(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
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

	// Trigger notifications for phase activation (fire-and-forget)
	go ps.notifyPhaseActivated(context.Background(), phase.GameID, activePhase.ID, activePhase.Title, 0)

	return &activePhase, nil
}

// DeactivatePhase deactivates the currently active phase for a game
func (ps *PhaseService) DeactivatePhase(ctx context.Context, gameID, userID int32) error {
	// Get active phase
	activePhase, err := ps.GetActivePhase(ctx, gameID)
	if err != nil {
		return fmt.Errorf("failed to get active phase: %w", err)
	}
	if activePhase == nil {
		return fmt.Errorf("no active phase to deactivate")
	}

	_, err = ps.deactivatePhaseInternal(ctx, activePhase.ID)
	return err
}

// deactivatePhaseInternal is an internal method to avoid recursion
func (ps *PhaseService) deactivatePhaseInternal(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	phase, err := queries.DeactivatePhase(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to deactivate phase: %w", err)
	}

	return &phase, nil
}

// notifyPhaseActivated sends notifications to game participants when a phase is activated
func (ps *PhaseService) notifyPhaseActivated(ctx context.Context, gameID, phaseID int32, phaseTitle string, excludeUserID int32) {
	notificationService := &db.NotificationService{DB: ps.DB}

	// Notify all participants except the GM who activated the phase
	err := notificationService.NotifyPhaseCreated(
		ctx,
		gameID,
		phaseID,
		phaseTitle,
		excludeUserID,
	)
	if err != nil {
		slog.Error("Failed to send phase activation notifications", "error", err, "game_id", gameID, "phase_id", phaseID)
	}
}
