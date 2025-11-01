package actions

import (
	"context"
	"errors"
	"fmt"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	"actionphase/pkg/validation"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// CreateActionResult creates a new action result (GM response to player action)
func (as *ActionSubmissionService) CreateActionResult(ctx context.Context, req core.CreateActionResultRequest) (*models.ActionResult, error) {
	queries := models.New(as.DB)

	// Get the game to find the GM user ID
	game, err := queries.GetGame(ctx, req.GameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game: %w", err)
	}

	// Convert content to string
	contentStr := fmt.Sprintf("%v", req.Content)

	// Validate content length
	if err := validation.ValidateActionResult(contentStr); err != nil {
		return nil, err
	}

	params := models.CreateActionResultParams{
		GameID:      req.GameID,
		UserID:      req.UserID,
		PhaseID:     req.PhaseID,
		GmUserID:    game.GmUserID,
		Content:     contentStr,
		IsPublished: pgtype.Bool{Bool: req.IsPublished, Valid: true},
	}

	// Note: ActionSubmissionID field not available in CreateActionResultParams

	result, err := queries.CreateActionResult(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create action result: %w", err)
	}

	return &result, nil
}

// GetActionResult retrieves a specific action result by ID
func (as *ActionSubmissionService) GetActionResult(ctx context.Context, resultID int32) (*models.ActionResult, error) {
	queries := models.New(as.DB)

	result, err := queries.GetActionResult(ctx, resultID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("action result not found")
		}
		return nil, fmt.Errorf("failed to get action result: %w", err)
	}

	return &result, nil
}

// GetUserPhaseResults retrieves all action results for a user in a specific phase
func (as *ActionSubmissionService) GetUserPhaseResults(ctx context.Context, phaseID, userID int32) ([]models.ActionResult, error) {
	queries := models.New(as.DB)

	results, err := queries.GetUserPhaseResults(ctx, models.GetUserPhaseResultsParams{
		PhaseID: phaseID,
		UserID:  userID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user phase results: %w", err)
	}

	return results, nil
}

// PublishActionResult publishes a single action result, making it visible to the player
func (as *ActionSubmissionService) PublishActionResult(ctx context.Context, resultID, userID int32) error {
	queries := models.New(as.DB)

	_, err := queries.PublishActionResult(ctx, resultID)
	if err != nil {
		return fmt.Errorf("failed to publish action result: %w", err)
	}

	return nil
}

// PublishAllPhaseResults publishes all unpublished results for a phase
func (as *ActionSubmissionService) PublishAllPhaseResults(ctx context.Context, phaseID int32) error {
	queries := models.New(as.DB)

	err := queries.PublishAllPhaseResults(ctx, phaseID)
	if err != nil {
		return fmt.Errorf("failed to publish all phase results: %w", err)
	}

	return nil
}

// GetUnpublishedResultsCount retrieves the count of unpublished results for a phase
func (as *ActionSubmissionService) GetUnpublishedResultsCount(ctx context.Context, phaseID int32) (int64, error) {
	queries := models.New(as.DB)

	count, err := queries.GetUnpublishedResultsCount(ctx, phaseID)
	if err != nil {
		return 0, fmt.Errorf("failed to get unpublished results count: %w", err)
	}

	return count, nil
}

// UpdateActionResult updates the content of an unpublished action result
func (as *ActionSubmissionService) UpdateActionResult(ctx context.Context, resultID int32, content string) (*models.ActionResult, error) {
	queries := models.New(as.DB)

	result, err := queries.UpdateActionResult(ctx, models.UpdateActionResultParams{
		ID:      resultID,
		Content: content,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("result not found or already published")
		}
		return nil, fmt.Errorf("failed to update action result: %w", err)
	}

	return &result, nil
}
