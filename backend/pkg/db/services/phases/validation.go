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

// CanDeletePhase checks if a phase can be deleted (no associated content exists)
func (ps *PhaseService) CanDeletePhase(ctx context.Context, phaseID int32) error {
	queries := models.New(ps.DB)

	// Check for action submissions
	submissionsCount, err := queries.CountActionSubmissionsByPhase(ctx, phaseID)
	if err != nil {
		return fmt.Errorf("failed to count action submissions: %w", err)
	}
	if submissionsCount > 0 {
		return fmt.Errorf("cannot delete phase: %d action submission(s) exist for this phase", submissionsCount)
	}

	// Check for action results
	resultsCount, err := queries.CountActionResultsByPhase(ctx, phaseID)
	if err != nil {
		return fmt.Errorf("failed to count action results: %w", err)
	}
	if resultsCount > 0 {
		return fmt.Errorf("cannot delete phase: %d action result(s) exist for this phase", resultsCount)
	}

	// Check for polls
	pollsCount, err := queries.CountPollsByPhase(ctx, pgtype.Int4{Int32: phaseID, Valid: true})
	if err != nil {
		return fmt.Errorf("failed to count polls: %w", err)
	}
	if pollsCount > 0 {
		return fmt.Errorf("cannot delete phase: %d poll(s) exist for this phase", pollsCount)
	}

	// Check for threads
	threadsCount, err := queries.CountThreadsByPhase(ctx, pgtype.Int4{Int32: phaseID, Valid: true})
	if err != nil {
		return fmt.Errorf("failed to count threads: %w", err)
	}
	if threadsCount > 0 {
		return fmt.Errorf("cannot delete phase: %d thread(s) exist for this phase", threadsCount)
	}

	// Check for messages
	messagesCount, err := queries.CountMessagesByPhase(ctx, pgtype.Int4{Int32: phaseID, Valid: true})
	if err != nil {
		return fmt.Errorf("failed to count messages: %w", err)
	}
	if messagesCount > 0 {
		return fmt.Errorf("cannot delete phase: %d message(s) exist for this phase", messagesCount)
	}

	return nil
}
