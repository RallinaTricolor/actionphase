package phases

import (
	"context"
	"fmt"

	models "actionphase/pkg/db/models"
)

// RunScheduledActivations finds all inactive phases whose start_time has arrived
// and activates them. Each activation deactivates whatever phase is currently
// active in that game (via activatePhaseInternal's transaction).
// Returns the count of phases activated.
func (ps *PhaseService) RunScheduledActivations(ctx context.Context) (int, error) {
	queries := models.New(ps.DB)

	phases, err := queries.GetScheduledPhasesToActivate(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to query scheduled phases: %w", err)
	}

	if len(phases) == 0 {
		return 0, nil
	}

	activated := 0
	// Track games we've already transitioned in this run — only activate the
	// earliest scheduled phase per game (they're ordered by start_time ASC).
	processedGames := make(map[int32]bool)

	for _, phase := range phases {
		if processedGames[phase.GameID] {
			ps.Logger.Info(ctx, "Skipping additional scheduled phase for game (already activated one this run)",
				"game_id", phase.GameID,
				"phase_id", phase.ID,
			)
			continue
		}

		// Guard: if the current active phase was manually activated AFTER this
		// scheduled phase's start_time, a human has already taken over — don't
		// override their decision. This prevents a silent override when a GM
		// manually activates a phase seconds before a scheduled transition fires.
		activatedAt, err := queries.GetActivePhaseActivatedAt(ctx, phase.GameID)
		if err == nil && activatedAt.Valid && phase.StartTime.Valid {
			if activatedAt.Time.After(phase.StartTime.Time) {
				ps.Logger.Info(ctx, "Skipping scheduled phase — current phase was manually activated after scheduled start_time",
					"game_id", phase.GameID,
					"phase_id", phase.ID,
					"scheduled_start", phase.StartTime.Time,
					"current_activated_at", activatedAt.Time,
				)
				processedGames[phase.GameID] = true // don't try later phases for this game either
				continue
			}
		}

		ps.Logger.Info(ctx, "Auto-activating scheduled phase",
			"game_id", phase.GameID,
			"phase_id", phase.ID,
			"phase_type", phase.PhaseType,
			"scheduled_start", phase.StartTime,
		)

		_, err = ps.activatePhaseInternal(ctx, phase.ID)
		if err != nil {
			// Log but continue — don't let one failure block other games
			ps.Logger.LogError(ctx, err, "Failed to auto-activate scheduled phase",
				"game_id", phase.GameID,
				"phase_id", phase.ID,
			)
			continue
		}

		processedGames[phase.GameID] = true
		activated++
	}

	if activated > 0 {
		ps.Logger.Info(ctx, "Scheduled phase activation run complete", "activated", activated)
	}

	return activated, nil
}
