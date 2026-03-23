package scheduler

import (
	"context"
	"time"

	"actionphase/pkg/core"
	"actionphase/pkg/observability"
)

// Scheduler runs periodic background tasks for the ActionPhase application.
// Currently handles: automatic phase activation based on scheduled start times.
type Scheduler struct {
	phaseService core.PhaseServiceInterface
	logger       *observability.Logger
	interval     time.Duration
}

// New creates a Scheduler. interval controls how often scheduled activations are checked.
func New(phaseService core.PhaseServiceInterface, logger *observability.Logger, interval time.Duration) *Scheduler {
	return &Scheduler{
		phaseService: phaseService,
		logger:       logger,
		interval:     interval,
	}
}

// Start begins the scheduler loop in a background goroutine.
// It returns immediately; call the returned cancel func to stop it.
func (s *Scheduler) Start(ctx context.Context) context.CancelFunc {
	ctx, cancel := context.WithCancel(ctx)

	go func() {
		s.logger.Info(ctx, "Phase scheduler started", "interval", s.interval)

		// Run once immediately on startup to catch any phases that should have
		// activated while the server was down.
		s.runActivations(ctx)

		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.runActivations(ctx)
			case <-ctx.Done():
				s.logger.Info(ctx, "Phase scheduler stopped")
				return
			}
		}
	}()

	return cancel
}

func (s *Scheduler) runActivations(ctx context.Context) {
	activated, err := s.phaseService.RunScheduledActivations(ctx)
	if err != nil {
		s.logger.LogError(ctx, err, "Scheduled phase activation run failed")
		return
	}
	if activated > 0 {
		s.logger.Info(ctx, "Scheduler activated phases", "count", activated)
	}
}
