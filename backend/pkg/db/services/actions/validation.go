package actions

import (
	"context"
	"fmt"

	models "actionphase/pkg/db/models"
)

// CanUserSubmitAction checks if a user has permission to submit actions to a phase
func (as *ActionSubmissionService) CanUserSubmitAction(ctx context.Context, phaseID, userID int32) (bool, error) {
	queries := models.New(as.DB)

	// Check if phase exists and is active
	phase, err := queries.GetPhase(ctx, phaseID)
	if err != nil {
		return false, fmt.Errorf("failed to get phase: %w", err)
	}

	// For now, allow submission if phase is active and of type "action"
	return phase.IsActive.Bool && phase.PhaseType == "action", nil
}
