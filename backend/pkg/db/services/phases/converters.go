package phases

import (
	models "actionphase/pkg/db/models"
)

// ConvertPhaseToResponse converts a database GamePhase model to a PhaseResponse
func (ps *PhaseService) ConvertPhaseToResponse(phase *models.GamePhase) PhaseResponse {
	response := PhaseResponse{
		ID:          phase.ID,
		GameID:      phase.GameID,
		PhaseType:   phase.PhaseType,
		PhaseNumber: phase.PhaseNumber,
		StartTime:   phase.StartTime.Time,
		IsActive:    phase.IsActive.Bool,
		IsPublished: phase.IsPublished,
		CreatedAt:   phase.CreatedAt.Time,
	}

	if phase.Title != "" {
		response.Title = &phase.Title
	}

	if phase.Description.Valid && phase.Description.String != "" {
		response.Description = &phase.Description.String
	}

	if phase.EndTime.Valid {
		response.EndTime = &phase.EndTime.Time
	}

	if phase.Deadline.Valid {
		response.Deadline = &phase.Deadline.Time
	}

	return response
}

// NOTE: ConvertActionToResponse has been removed from PhaseService
// It belongs in ActionSubmissionService and will be added there during the actions package migration
