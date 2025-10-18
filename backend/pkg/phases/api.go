package phases

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"actionphase/pkg/core"
	services "actionphase/pkg/db/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

type Handler struct {
	App *core.App
}

// Request/Response types

type CreatePhaseRequest struct {
	PhaseType   string              `json:"phase_type" validate:"required"`
	Title       string              `json:"title,omitempty"`
	Description string              `json:"description,omitempty"`
	StartTime   *core.LocalDateTime `json:"start_time,omitempty"`
	EndTime     *core.LocalDateTime `json:"end_time,omitempty"`
	Deadline    *core.LocalDateTime `json:"deadline,omitempty"`
}

func (r *CreatePhaseRequest) Bind(req *http.Request) error {
	return nil
}

type PhaseResponse struct {
	ID          int32      `json:"id"`
	GameID      int32      `json:"game_id"`
	PhaseType   string     `json:"phase_type"`
	PhaseNumber int32      `json:"phase_number"`
	Title       *string    `json:"title,omitempty"`
	Description *string    `json:"description,omitempty"`
	StartTime   time.Time  `json:"start_time"`
	EndTime     *time.Time `json:"end_time,omitempty"`
	Deadline    *time.Time `json:"deadline,omitempty"`
	IsActive    bool       `json:"is_active"`
	CreatedAt   time.Time  `json:"created_at"`

	// Calculated fields for UI
	TimeRemaining *int64 `json:"time_remaining,omitempty"` // seconds until deadline
	IsExpired     bool   `json:"is_expired"`
}

func (rd *PhaseResponse) Render(w http.ResponseWriter, r *http.Request) error {
	// Calculate time remaining and expiry status
	if rd.Deadline != nil {
		remaining := time.Until(*rd.Deadline)
		if remaining > 0 {
			seconds := int64(remaining.Seconds())
			rd.TimeRemaining = &seconds
			rd.IsExpired = false
		} else {
			rd.IsExpired = true
		}
	}
	return nil
}

type UpdateDeadlineRequest struct {
	Deadline core.LocalDateTime `json:"deadline" validate:"required"`
}

func (r *UpdateDeadlineRequest) Bind(req *http.Request) error {
	return nil
}

type UpdatePhaseRequest struct {
	Title       *string             `json:"title,omitempty"`
	Description *string             `json:"description,omitempty"`
	Deadline    *core.LocalDateTime `json:"deadline,omitempty"`
}

func (r *UpdatePhaseRequest) Bind(req *http.Request) error {
	return nil
}

type SubmitActionRequest struct {
	CharacterID *int32 `json:"character_id,omitempty"`
	Content     string `json:"content" validate:"required"`
	IsDraft     bool   `json:"is_draft,omitempty"`
}

func (r *SubmitActionRequest) Bind(req *http.Request) error {
	return nil
}

type ActionResponse struct {
	ID          int32     `json:"id"`
	GameID      int32     `json:"game_id"`
	UserID      int32     `json:"user_id"`
	PhaseID     int32     `json:"phase_id"`
	CharacterID *int32    `json:"character_id,omitempty"`
	Content     string    `json:"content"`
	SubmittedAt time.Time `json:"submitted_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (rd *ActionResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

type ActionWithDetailsResponse struct {
	ID            int32     `json:"id"`
	GameID        int32     `json:"game_id"`
	UserID        int32     `json:"user_id"`
	PhaseID       int32     `json:"phase_id"`
	CharacterID   *int32    `json:"character_id,omitempty"`
	Content       string    `json:"content"`
	SubmittedAt   time.Time `json:"submitted_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	Username      string    `json:"username"`
	CharacterName *string   `json:"character_name,omitempty"`
	PhaseType     *string   `json:"phase_type,omitempty"`
	PhaseNumber   *int32    `json:"phase_number,omitempty"`
}

func (rd *ActionWithDetailsResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

type CreateActionResultRequest struct {
	UserID      int32  `json:"user_id" validate:"required"`
	Content     string `json:"content" validate:"required"`
	IsPublished bool   `json:"is_published,omitempty"`
}

func (r *CreateActionResultRequest) Bind(req *http.Request) error {
	return nil
}

type ActionResultResponse struct {
	ID          int32      `json:"id"`
	GameID      int32      `json:"game_id"`
	UserID      int32      `json:"user_id"`
	PhaseID     int32      `json:"phase_id"`
	GMUserID    int32      `json:"gm_user_id"`
	Content     string     `json:"content"`
	IsPublished bool       `json:"is_published"`
	SentAt      *time.Time `json:"sent_at,omitempty"`
}

func (rd *ActionResultResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

type ActionResultWithDetailsResponse struct {
	ID          int32      `json:"id"`
	GameID      int32      `json:"game_id"`
	UserID      int32      `json:"user_id"`
	PhaseID     int32      `json:"phase_id"`
	GMUserID    int32      `json:"gm_user_id"`
	Content     string     `json:"content"`
	IsPublished bool       `json:"is_published"`
	SentAt      *time.Time `json:"sent_at,omitempty"`
	Username    string     `json:"username,omitempty"`    // Player username (for GM view)
	GMUsername  string     `json:"gm_username,omitempty"` // GM username (for player view)
	PhaseType   string     `json:"phase_type,omitempty"`
	PhaseNumber int32      `json:"phase_number,omitempty"`
}

func (rd *ActionResultWithDetailsResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// Helper functions

func (h *Handler) getUserFromToken(r *http.Request) (*core.User, error) {
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		return nil, fmt.Errorf("no valid token found")
	}

	username, ok := token.Get("username")
	if !ok {
		return nil, fmt.Errorf("username not found in token")
	}

	userService := &services.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	return user, nil
}

// API Handlers

// CreatePhase - Create a new game phase (GM only)
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
	phaseService := &services.PhaseService{DB: h.App.Pool}
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

// GetCurrentPhase - Get the currently active phase for a game
func (h *Handler) GetCurrentPhase(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	phaseService := &services.PhaseService{DB: h.App.Pool}
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

// GetGamePhases - Get all phases for a game
func (h *Handler) GetGamePhases(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	phaseService := &services.PhaseService{DB: h.App.Pool}
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

// ActivatePhase - Activate a phase (GM only)
func (h *Handler) ActivatePhase(w http.ResponseWriter, r *http.Request) {
	phaseIDStr := chi.URLParam(r, "id")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	phaseService := &services.PhaseService{DB: h.App.Pool}

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
		render.Render(w, r, core.ErrForbidden("only the GM can activate phases"))
		return
	}

	// Activate phase
	err = phaseService.ActivatePhase(r.Context(), int32(phaseID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to activate phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get the updated phase after activation
	activePhase, err := phaseService.GetPhase(r.Context(), int32(phaseID))
	if err != nil {
		h.App.Logger.Error("Failed to get activated phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := phaseService.ConvertPhaseToResponse(activePhase)

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

// UpdatePhaseDeadline - Extend or change phase deadline (GM only)
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

	phaseService := &services.PhaseService{DB: h.App.Pool}

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

// UpdatePhase - Update phase details (GM only)
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

	phaseService := &services.PhaseService{DB: h.App.Pool}

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

// SubmitAction - Submit action during action phase
func (h *Handler) SubmitAction(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &SubmitActionRequest{}
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

	phaseService := &services.PhaseService{DB: h.App.Pool}

	// Check if user can submit actions
	canSubmit, err := phaseService.CanUserSubmitActions(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check action submission permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canSubmit {
		render.Render(w, r, core.ErrForbidden("you cannot submit actions for this game"))
		return
	}

	// Get active phase
	activePhase, err := phaseService.GetActivePhase(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get active phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if activePhase == nil {
		render.Render(w, r, core.ErrBadRequest(fmt.Errorf("no active phase for this game")))
		return
	}

	// Submit action
	req := core.SubmitActionRequest{
		GameID:      int32(gameID),
		UserID:      int32(user.ID),
		PhaseID:     activePhase.ID,
		CharacterID: data.CharacterID,
		Content:     data.Content,
		IsDraft:     data.IsDraft,
	}

	action, err := phaseService.SubmitAction(r.Context(), req)
	if err != nil {
		h.App.Logger.Error("Failed to submit action", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := phaseService.ConvertActionToResponse(action)

	render.Status(r, http.StatusCreated)
	render.Render(w, r, &ActionResponse{
		ID:          response.ID,
		GameID:      response.GameID,
		UserID:      response.UserID,
		PhaseID:     response.PhaseID,
		CharacterID: response.CharacterID,
		Content:     response.Content,
		SubmittedAt: response.SubmittedAt,
		UpdatedAt:   response.UpdatedAt,
	})
}

// GetUserActions - Get user's action submissions for a game
func (h *Handler) GetUserActions(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	phaseService := &services.PhaseService{DB: h.App.Pool}
	actions, err := phaseService.GetUserActions(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to get user actions", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []ActionWithDetailsResponse
	for _, action := range actions {
		actionResp := ActionWithDetailsResponse{
			ID:          action.ID,
			GameID:      action.GameID,
			UserID:      action.UserID,
			PhaseID:     action.PhaseID,
			Content:     action.Content,
			SubmittedAt: action.SubmittedAt.Time,
			UpdatedAt:   action.UpdatedAt.Time,
			PhaseType:   &action.PhaseType,
			PhaseNumber: &action.PhaseNumber,
		}

		if action.CharacterID.Valid {
			actionResp.CharacterID = &action.CharacterID.Int32
		}

		response = append(response, actionResp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetGameActions - Get all actions for a game (GM only)
func (h *Handler) GetGameActions(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
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
	phaseService := &services.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can view all actions"))
		return
	}

	actions, err := phaseService.GetGameActions(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game actions", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []ActionWithDetailsResponse
	for _, action := range actions {
		actionResp := ActionWithDetailsResponse{
			ID:          action.ID,
			GameID:      action.GameID,
			UserID:      action.UserID,
			PhaseID:     action.PhaseID,
			Content:     action.Content,
			SubmittedAt: action.SubmittedAt.Time,
			UpdatedAt:   action.UpdatedAt.Time,
			Username:    action.Username,
			PhaseType:   &action.PhaseType,
			PhaseNumber: &action.PhaseNumber,
		}

		if action.CharacterID.Valid {
			actionResp.CharacterID = &action.CharacterID.Int32
		}

		if action.CharacterName.Valid {
			actionResp.CharacterName = &action.CharacterName.String
		}

		response = append(response, actionResp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateActionResult - GM creates result for a player action
func (h *Handler) CreateActionResult(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &CreateActionResultRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get GM user from token
	gmUser, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Check permissions - must be GM
	phaseService := &services.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(gmUser.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can create action results"))
		return
	}

	// Get active phase
	activePhase, err := phaseService.GetActivePhase(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get active phase", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if activePhase == nil {
		render.Render(w, r, core.ErrBadRequest(fmt.Errorf("no active phase for this game")))
		return
	}

	// Create action result using ActionSubmissionService
	actionService := &services.ActionSubmissionService{DB: h.App.Pool}
	req := core.CreateActionResultRequest{
		GameID:      int32(gameID),
		UserID:      data.UserID,
		PhaseID:     activePhase.ID,
		GMUserID:    int32(gmUser.ID),
		Content:     data.Content,
		IsPublished: data.IsPublished,
	}

	result, err := actionService.CreateActionResult(r.Context(), req)
	if err != nil {
		h.App.Logger.Error("Failed to create action result", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &ActionResultResponse{
		ID:          result.ID,
		GameID:      result.GameID,
		UserID:      result.UserID,
		PhaseID:     result.PhaseID,
		GMUserID:    result.GmUserID,
		Content:     result.Content,
		IsPublished: result.IsPublished.Bool,
	}

	if result.SentAt.Valid {
		response.SentAt = &result.SentAt.Time
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetUserActionResults - Get user's action results for a game
func (h *Handler) GetUserActionResults(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	phaseService := &services.PhaseService{DB: h.App.Pool}
	results, err := phaseService.GetUserResults(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to get user action results", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []ActionResultWithDetailsResponse
	for _, result := range results {
		resultResp := ActionResultWithDetailsResponse{
			ID:          result.ID,
			GameID:      result.GameID,
			UserID:      result.UserID,
			PhaseID:     result.PhaseID,
			GMUserID:    result.GmUserID,
			Content:     result.Content,
			IsPublished: result.IsPublished.Bool,
			GMUsername:  result.GmUsername,
			PhaseType:   result.PhaseType,
			PhaseNumber: result.PhaseNumber,
		}

		if result.SentAt.Valid {
			resultResp.SentAt = &result.SentAt.Time
		}

		response = append(response, resultResp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetGameActionResults - Get all action results for a game (GM only)
func (h *Handler) GetGameActionResults(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Check permissions - must be GM
	phaseService := &services.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can view all action results"))
		return
	}

	results, err := phaseService.GetGameResults(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game action results", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	var response []ActionResultWithDetailsResponse
	for _, result := range results {
		resultResp := ActionResultWithDetailsResponse{
			ID:          result.ID,
			GameID:      result.GameID,
			UserID:      result.UserID,
			PhaseID:     result.PhaseID,
			GMUserID:    result.GmUserID,
			Content:     result.Content,
			IsPublished: result.IsPublished.Bool,
			Username:    result.Username,
			PhaseType:   result.PhaseType,
			PhaseNumber: result.PhaseNumber,
		}

		if result.SentAt.Valid {
			resultResp.SentAt = &result.SentAt.Time
		}

		response = append(response, resultResp)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// PublishAllPhaseResults - Publish all unpublished results for a phase (GM only)
func (h *Handler) PublishAllPhaseResults(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	phaseIDStr := chi.URLParam(r, "phaseId")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Check permissions - must be GM
	phaseService := &services.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can publish action results"))
		return
	}

	// Publish all unpublished results for the phase
	actionService := &services.ActionSubmissionService{DB: h.App.Pool}
	err = actionService.PublishAllPhaseResults(r.Context(), int32(phaseID))
	if err != nil {
		h.App.Logger.Error("Failed to publish all phase results", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "All results published successfully",
	})
}

// GetUnpublishedResultsCount - Get count of unpublished results for a phase (GM only)
func (h *Handler) GetUnpublishedResultsCount(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	phaseIDStr := chi.URLParam(r, "phaseId")
	phaseID, err := strconv.ParseInt(phaseIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid phase ID")))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Check permissions - must be GM
	phaseService := &services.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can view result counts"))
		return
	}

	// Get count of unpublished results
	actionService := &services.ActionSubmissionService{DB: h.App.Pool}
	count, err := actionService.GetUnpublishedResultsCount(r.Context(), int32(phaseID))
	if err != nil {
		h.App.Logger.Error("Failed to get unpublished results count", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"count": count,
	})
}

// UpdateActionResult - Update an unpublished action result (GM only)
func (h *Handler) UpdateActionResult(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	resultIDStr := chi.URLParam(r, "resultId")
	resultID, err := strconv.ParseInt(resultIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid result ID")))
		return
	}

	type UpdateResultRequest struct {
		Content string `json:"content" validate:"required"`
	}

	data := &UpdateResultRequest{}
	if err := json.NewDecoder(r.Body).Decode(data); err != nil {
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

	// Check permissions - must be GM
	phaseService := &services.PhaseService{DB: h.App.Pool}
	canManage, err := phaseService.CanUserManagePhases(r.Context(), int32(gameID), int32(user.ID))
	if err != nil {
		h.App.Logger.Error("Failed to check phase management permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canManage {
		render.Render(w, r, core.ErrForbidden("only the GM can update action results"))
		return
	}

	// Update the action result
	actionService := &services.ActionSubmissionService{DB: h.App.Pool}
	result, err := actionService.UpdateActionResult(r.Context(), int32(resultID), data.Content)
	if err != nil {
		h.App.Logger.Error("Failed to update action result", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &ActionResultResponse{
		ID:          result.ID,
		GameID:      result.GameID,
		UserID:      result.UserID,
		PhaseID:     result.PhaseID,
		GMUserID:    result.GmUserID,
		Content:     result.Content,
		IsPublished: result.IsPublished.Bool,
	}

	if result.SentAt.Valid {
		response.SentAt = &result.SentAt.Time
	}

	render.Render(w, r, response)
}
