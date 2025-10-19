package phases

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"actionphase/pkg/core"
	phasesvc "actionphase/pkg/db/services/phases"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// CreatePhase creates a new game phase (GM only)
func (h *Handler) CreatePhase(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &CreatePhaseRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Validate phase type
	validTypes := []string{"common_room", "action", "results"}
	isValid := false
	for _, validType := range validTypes {
		if data.PhaseType == validType {
			isValid = true
			break
		}
	}
	if !isValid {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase type")))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Check permissions
	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can create phases"))
		return
	}

	// Create phase
	req := core.CreatePhaseRequest{
		GameID:      int32(gameID),
		PhaseType:   data.PhaseType,
		Title:       data.Title,
		Description: data.Description,
		StartTime:   data.StartTime.ToTimePtr(),
		EndTime:     data.EndTime.ToTimePtr(),
		Deadline:    data.Deadline.ToTimePtr(),
	}

	phase, err := phaseService.CreatePhase(r.Context(), req)
	if err != nil {
		h.App.Logger.Error("Failed to create phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := phaseService.ConvertPhaseToResponse(phase)

	render.Status(r, http.StatusCreated)
	render.Render(w, r, &PhaseResponse{
		ID:          response.ID,
		GameID:      response.GameID,
		PhaseType:   response.PhaseType,
		PhaseNumber: response.PhaseNumber,
		Title:       response.Title,
		Description: response.Description,
		StartTime:   response.StartTime,
		EndTime:     response.EndTime,
		Deadline:    response.Deadline,
		IsActive:    response.IsActive,
		CreatedAt:   response.CreatedAt,
	})
}

// GetCurrentPhase retrieves the currently active phase for a game
func (h *Handler) GetCurrentPhase(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}
	phase, err := phaseService.GetActivePhase(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get active phase", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var phaseResponse *PhaseResponse
	if phase != nil {
		response := phaseService.ConvertPhaseToResponse(phase)
		phaseResponse = &PhaseResponse{
			ID:          response.ID,
			GameID:      response.GameID,
			PhaseType:   response.PhaseType,
			PhaseNumber: response.PhaseNumber,
			Title:       response.Title,
			Description: response.Description,
			StartTime:   response.StartTime,
			EndTime:     response.EndTime,
			Deadline:    response.Deadline,
			IsActive:    response.IsActive,
			CreatedAt:   response.CreatedAt,
		}
		// Calculate time remaining and expiry
		phaseResponse.Render(w, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"phase": phaseResponse})
}

// GetGamePhases retrieves all phases for a game
func (h *Handler) GetGamePhases(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}
	phases, err := phaseService.GetGamePhases(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game phases", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []PhaseResponse
	for _, phase := range phases {
		phaseResp := phaseService.ConvertPhaseToResponse(&phase)
		response = append(response, PhaseResponse{
			ID:          phaseResp.ID,
			GameID:      phaseResp.GameID,
			PhaseType:   phaseResp.PhaseType,
			PhaseNumber: phaseResp.PhaseNumber,
			Title:       phaseResp.Title,
			Description: phaseResp.Description,
			StartTime:   phaseResp.StartTime,
			EndTime:     phaseResp.EndTime,
			Deadline:    phaseResp.Deadline,
			IsActive:    phaseResp.IsActive,
			CreatedAt:   phaseResp.CreatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdatePhaseDeadline extends or changes phase deadline (GM only)
func (h *Handler) UpdatePhaseDeadline(w http.ResponseWriter, r *http.Request) {
	phaseIDStr := chi.URLParam(r, "id")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")))
		return
	}

	data := &UpdateDeadlineRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}

	// Get phase to check game ID
	phase, err := phaseService.GetPhase(r.Context(), int32(phaseID))
	if err != nil {
		h.App.Logger.Error("Failed to get phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Check permissions
	canManage, err := phaseService.CanUserManagePhases(r.Context(), phase.GameID, int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can update phase deadlines"))
		return
	}

	// Update deadline
	updatedPhase, err := phaseService.ExtendPhaseDeadline(r.Context(), int32(phaseID), data.Deadline.Time)
	if err != nil {
		h.App.Logger.Error("Failed to update phase deadline", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := phaseService.ConvertPhaseToResponse(updatedPhase)

	render.Render(w, r, &PhaseResponse{
		ID:          response.ID,
		GameID:      response.GameID,
		PhaseType:   response.PhaseType,
		PhaseNumber: response.PhaseNumber,
		Title:       response.Title,
		Description: response.Description,
		StartTime:   response.StartTime,
		EndTime:     response.EndTime,
		Deadline:    response.Deadline,
		IsActive:    response.IsActive,
		CreatedAt:   response.CreatedAt,
	})
}

// UpdatePhase updates phase details (GM only)
func (h *Handler) UpdatePhase(w http.ResponseWriter, r *http.Request) {
	phaseIDStr := chi.URLParam(r, "id")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")))
		return
	}

	data := &UpdatePhaseRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	phaseService := &phasesvc.PhaseService{DB: h.App.Pool}

	// Get phase to check game ID
	phase, err := phaseService.GetPhase(r.Context(), int32(phaseID))
	if err != nil {
		h.App.Logger.Error("Failed to get phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Check permissions
	canManage, err := phaseService.CanUserManagePhases(r.Context(), phase.GameID, int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can update phases"))
		return
	}

	// Update phase
	req := core.UpdatePhaseRequest{
		ID:       int32(phaseID),
		Deadline: data.Deadline.ToTimePtr(),
	}

	if data.Title != nil {
		req.Title = *data.Title
	}

	if data.Description != nil {
		req.Description = *data.Description
	}

	updatedPhase, err := phaseService.UpdatePhase(r.Context(), req)
	if err != nil {
		h.App.Logger.Error("Failed to update phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := phaseService.ConvertPhaseToResponse(updatedPhase)

	render.Render(w, r, &PhaseResponse{
		ID:          response.ID,
		GameID:      response.GameID,
		PhaseType:   response.PhaseType,
		PhaseNumber: response.PhaseNumber,
		Title:       response.Title,
		Description: response.Description,
		StartTime:   response.StartTime,
		EndTime:     response.EndTime,
		Deadline:    response.Deadline,
		IsActive:    response.IsActive,
		CreatedAt:   response.CreatedAt,
	})
}
