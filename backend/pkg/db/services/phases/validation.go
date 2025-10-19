package phases

import (
	"context"
	"fmt"
	"time"

	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/jackc/pgx/v5/pgtype"
)

// ExtendPhaseDeadline updates the deadline for a phase
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

// CanUserManagePhases checks if a user has permission to manage phases for a game
func (ps *PhaseService) CanUserManagePhases(ctx context.Context, gameID, userID int32) (bool, error) {
	// Check if user is GM of the game
	gameService := &db.GameService{DB: ps.DB}
	game, err := gameService.GetGame(ctx, gameID)
	if err != nil {
		return false, fmt.Errorf("failed to get game: %w", err)
	}

	return game.GmUserID == userID, nil
}

// CanUserSubmitActions checks if a user has permission to submit actions for a game
func (ps *PhaseService) CanUserSubmitActions(ctx context.Context, gameID, userID int32) (bool, error) {
	// Check if user is participant (player, GM, or audience with assigned NPCs)
	gameService := &db.GameService{DB: ps.DB}
	participants, err := gameService.GetGameParticipants(ctx, gameID)
	if err != nil {
		return false, fmt.Errorf("failed to get game participants: %w", err)
	}

	for _, participant := range participants {
		if participant.UserID == userID && participant.Status.String == "active" {
			return true, nil
		}
	}

	return false, nil
}
