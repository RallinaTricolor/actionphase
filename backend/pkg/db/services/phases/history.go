package phases

import (
	"context"
	"fmt"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// GetPhaseHistory retrieves the transition history for a game
func (ps *PhaseService) GetPhaseHistory(ctx context.Context, gameID int32) ([]core.PhaseTransitionInfo, error) {
	queries := models.New(ps.DB)
	transitions, err := queries.GetPhaseTransitions(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get phase transitions: %w", err)
	}

	// Convert to core.PhaseTransitionInfo
	result := make([]core.PhaseTransitionInfo, len(transitions))
	for i, t := range transitions {
		result[i] = core.PhaseTransitionInfo{
			ID:              t.ID,
			GameID:          t.GameID,
			ToPhaseID:       t.ToPhaseID,
			InitiatedBy:     t.InitiatedBy,
			CreatedAt:       t.CreatedAt.Time,
			ToPhaseType:     t.ToPhaseType,
			ToPhaseNum:      t.ToPhaseNumber,
			InitiatedByUser: t.InitiatedByUsername,
		}
		if t.FromPhaseID.Valid {
			result[i].FromPhaseID = &t.FromPhaseID.Int32
			result[i].FromPhaseType = t.FromPhaseType.String
			result[i].FromPhaseNum = t.FromPhaseNumber.Int32
		}
		if t.Reason.Valid {
			result[i].Reason = t.Reason.String
		}
	}

	return result, nil
}
