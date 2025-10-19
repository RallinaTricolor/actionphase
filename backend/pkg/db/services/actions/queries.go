package actions

import (
	"context"
	"fmt"

	models "actionphase/pkg/db/models"
)

// GetUserActions retrieves all action submissions for a user in a specific game
func (as *ActionSubmissionService) GetUserActions(ctx context.Context, gameID, userID int32) ([]models.GetUserActionsRow, error) {
	queries := models.New(as.DB)
	actions, err := queries.GetUserActions(ctx, models.GetUserActionsParams{
		GameID: gameID,
		UserID: userID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user actions: %w", err)
	}
	return actions, nil
}

// GetGameActions retrieves all action submissions for a game (GM only)
func (as *ActionSubmissionService) GetGameActions(ctx context.Context, gameID int32) ([]models.GetGameActionsRow, error) {
	queries := models.New(as.DB)
	actions, err := queries.GetGameActions(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game actions: %w", err)
	}
	return actions, nil
}

// GetUserResults retrieves all published action results for a user in a specific game
func (as *ActionSubmissionService) GetUserResults(ctx context.Context, gameID, userID int32) ([]models.GetUserResultsRow, error) {
	queries := models.New(as.DB)
	results, err := queries.GetUserResults(ctx, models.GetUserResultsParams{
		GameID: gameID,
		UserID: userID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user results: %w", err)
	}
	return results, nil
}

// GetGameResults retrieves all action results for a game (GM only)
func (as *ActionSubmissionService) GetGameResults(ctx context.Context, gameID int32) ([]models.GetGameResultsRow, error) {
	queries := models.New(as.DB)
	results, err := queries.GetGameResults(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game results: %w", err)
	}
	return results, nil
}
