package core

import (
	"testing"
	"time"

	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
)

func TestPhaseHasEnded(t *testing.T) {
	at := pgtype.Timestamptz{Time: time.Now(), Valid: true}
	active := pgtype.Bool{Bool: true, Valid: true}
	phase := func(number int32, isActive pgtype.Bool, activatedAt pgtype.Timestamptz) models.GamePhase {
		return models.GamePhase{PhaseNumber: number, IsActive: isActive, ActivatedAt: activatedAt}
	}

	tests := []struct {
		name   string
		phase  models.GamePhase
		others []models.GamePhase
		want   bool
	}{
		{"the active phase", phase(2, active, at), []models.GamePhase{phase(1, pgtype.Bool{}, at)}, false},
		{"ran, and another phase took over", phase(1, pgtype.Bool{}, at), []models.GamePhase{phase(2, active, at)}, true},
		{"ran, and no phase is active now", phase(1, pgtype.Bool{}, at), nil, true},
		{"ran before activated_at existed: a later phase is active", phase(1, pgtype.Bool{}, pgtype.Timestamptz{}), []models.GamePhase{phase(2, active, at)}, true},
		{"ran before activated_at existed: a later phase has run", phase(1, pgtype.Bool{}, pgtype.Timestamptz{}), []models.GamePhase{phase(2, pgtype.Bool{}, at)}, true},
		{"not started: the active phase is earlier", phase(3, pgtype.Bool{}, pgtype.Timestamptz{}), []models.GamePhase{phase(2, active, at)}, false},
		{"not started: nothing has run", phase(1, pgtype.Bool{}, pgtype.Timestamptz{}), []models.GamePhase{phase(2, pgtype.Bool{}, pgtype.Timestamptz{})}, false},
		{"a later phase ended and an earlier one was reactivated", phase(3, pgtype.Bool{}, at), []models.GamePhase{phase(2, active, at)}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, PhaseHasEnded(tt.phase, append([]models.GamePhase{tt.phase}, tt.others...)))
		})
	}
}
