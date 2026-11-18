package core

import (
	"context"
	"errors"
	"fmt"

	models "actionphase/pkg/db/models"
)

// ErrPhaseEnded is returned when something tries to change a phase that has
// ended: its results board, or its results and their sheet updates. An ended
// phase is read-only, and unpublished drafts stay as they are until the GM
// activates the phase again. Handlers translate it to 423.
var ErrPhaseEnded = errors.New("phase has ended")

// PhaseEndedMessage is what a GM is told when an ended phase refuses a write.
const PhaseEndedMessage = "This phase has ended, so it's read-only. Activate it again to keep working on it."

// PhaseNotActiveMessage is what a GM is told when a new result names a phase
// other than the active one.
const PhaseNotActiveMessage = "This phase isn't active, so new results can't be written for it."

// PhaseHasEnded reports whether phase has run and is over: it isn't active, and
// either it has been activated or a later phase has been. A phase that hasn't
// started yet hasn't ended.
//
// A later phase is consulted because activated_at was added without a backfill,
// so a phase that ended before then has no timestamp of its own. phases is the
// game's full list.
func PhaseHasEnded(phase models.GamePhase, phases []models.GamePhase) bool {
	if phase.IsActive.Bool {
		return false
	}
	if phase.ActivatedAt.Valid {
		return true
	}
	for _, other := range phases {
		if other.PhaseNumber > phase.PhaseNumber && (other.IsActive.Bool || other.ActivatedAt.Valid) {
			return true
		}
	}
	return false
}

// PhaseReader is the part of the generated queries RefuseEndedPhase needs.
type PhaseReader interface {
	GetPhase(ctx context.Context, id int32) (models.GamePhase, error)
	GetGamePhases(ctx context.Context, gameID int32) ([]models.GamePhase, error)
}

// RefuseEndedPhase returns ErrPhaseEnded when the phase has ended.
func RefuseEndedPhase(ctx context.Context, q PhaseReader, phaseID int32) error {
	phase, err := q.GetPhase(ctx, phaseID)
	if err != nil {
		return fmt.Errorf("failed to get phase: %w", err)
	}
	if phase.IsActive.Bool {
		return nil
	}
	phases, err := q.GetGamePhases(ctx, phase.GameID)
	if err != nil {
		return fmt.Errorf("failed to get game phases: %w", err)
	}
	if PhaseHasEnded(phase, phases) {
		return ErrPhaseEnded
	}
	return nil
}
