package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PhaseService implements the PhaseServiceInterface for game phase management.
type PhaseService struct {
	DB *pgxpool.Pool
}

// Compile-time verification that PhaseService implements PhaseServiceInterface
var _ core.PhaseServiceInterface = (*PhaseService)(nil)

// ActionSubmissionService implements the ActionSubmissionServiceInterface for action submission management.
type ActionSubmissionService struct {
	DB *pgxpool.Pool
}

// Compile-time verification that ActionSubmissionService implements ActionSubmissionServiceInterface
var _ core.ActionSubmissionServiceInterface = (*ActionSubmissionService)(nil)

// Request/Response types for phase management

type CreatePhaseRequest struct {
	GameID    int32
	PhaseType string // "common_room" or "action"
	StartTime *time.Time
	EndTime   *time.Time
	Deadline  *time.Time
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
	IsPublished bool       `json:"is_published"`
	CreatedAt   time.Time  `json:"created_at"`
}

type ActionSubmissionRequest struct {
	GameID      int32
	UserID      int32
	PhaseID     int32
	CharacterID *int32
	Content     string
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

// Phase Management Methods

func (ps *PhaseService) CreatePhase(ctx context.Context, req core.CreatePhaseRequest) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	// Validate phase type
	validPhaseTypes := []string{"common_room", "action"}
	isValid := false
	for _, validType := range validPhaseTypes {
		if req.PhaseType == validType {
			isValid = true
			break
		}
	}
	if !isValid {
		return nil, fmt.Errorf("invalid phase type: %s (must be 'common_room' or 'action')", req.PhaseType)
	}

	// Get next phase number
	latestPhaseNum, err := queries.GetLatestPhaseNumber(ctx, req.GameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest phase number: %w", err)
	}

	// Convert interface{} to int32 safely
	var phaseNumber int32 = 1
	if latestPhaseNum != nil {
		switch val := latestPhaseNum.(type) {
		case int32:
			phaseNumber = val + 1
		case int64:
			phaseNumber = int32(val) + 1
		}
	}

	// Set default start time if not provided
	startTime := time.Now()
	if req.StartTime != nil {
		startTime = *req.StartTime
	}

	// Convert times to pgtype.Timestamptz
	params := models.CreateGamePhaseParams{
		GameID:      req.GameID,
		PhaseType:   req.PhaseType,
		PhaseNumber: phaseNumber,
		Title:       req.Title,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
		StartTime:   pgtype.Timestamptz{Time: startTime, Valid: true},
	}

	if req.EndTime != nil {
		params.EndTime = pgtype.Timestamptz{Time: *req.EndTime, Valid: true}
	}

	if req.Deadline != nil {
		params.Deadline = pgtype.Timestamptz{Time: *req.Deadline, Valid: true}
	}

	phase, err := queries.CreateGamePhase(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create phase: %w", err)
	}

	return &phase, nil
}

func (ps *PhaseService) GetActivePhase(ctx context.Context, gameID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	phase, err := queries.GetActivePhase(ctx, gameID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No active phase
		}
		return nil, fmt.Errorf("failed to get active phase: %w", err)
	}

	return &phase, nil
}

func (ps *PhaseService) GetGamePhases(ctx context.Context, gameID int32) ([]models.GamePhase, error) {
	queries := models.New(ps.DB)

	phases, err := queries.GetGamePhases(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game phases: %w", err)
	}

	return phases, nil
}

func (ps *PhaseService) GetPhase(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	phase, err := queries.GetPhase(ctx, phaseID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("phase not found")
		}
		return nil, fmt.Errorf("failed to get phase: %w", err)
	}

	return &phase, nil
}

// Legacy method - keeping for backward compatibility
func (ps *PhaseService) ActivatePhaseOld(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
	return ps.activatePhaseInternal(ctx, phaseID)
}

// Legacy method - keeping for backward compatibility
func (ps *PhaseService) DeactivatePhaseOld(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
	return ps.deactivatePhaseInternal(ctx, phaseID)
}

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

// Action Submission Methods

func (ps *PhaseService) SubmitAction(ctx context.Context, req core.SubmitActionRequest) (*models.ActionSubmission, error) {
	queries := models.New(ps.DB)

	// Verify phase exists and is active
	phase, err := queries.GetPhase(ctx, req.PhaseID)
	if err != nil {
		return nil, fmt.Errorf("phase not found")
	}

	if !phase.IsActive.Bool {
		return nil, fmt.Errorf("phase is not active")
	}

	if phase.PhaseType != "action" {
		return nil, fmt.Errorf("actions can only be submitted during action phases")
	}

	// Check deadline if set
	if phase.Deadline.Valid && time.Now().After(phase.Deadline.Time) {
		return nil, fmt.Errorf("action submission deadline has passed")
	}

	// Validate character ownership if character_id is provided
	if req.CharacterID != nil {
		character, err := queries.GetCharacter(ctx, *req.CharacterID)
		if err != nil {
			return nil, fmt.Errorf("character not found")
		}

		// Verify the character belongs to the user submitting the action
		if !character.UserID.Valid || character.UserID.Int32 != req.UserID {
			return nil, fmt.Errorf("you can only submit actions for characters you own")
		}

		// Verify the character belongs to the same game
		if character.GameID != req.GameID {
			return nil, fmt.Errorf("character does not belong to this game")
		}
	}

	// Convert content to string
	contentStr := ""
	switch v := req.Content.(type) {
	case string:
		contentStr = v
	case []byte:
		contentStr = string(v)
	default:
		contentStr = fmt.Sprintf("%v", v)
	}

	// Prepare parameters
	params := models.SubmitActionParams{
		GameID:  req.GameID,
		UserID:  req.UserID,
		PhaseID: req.PhaseID,
		Content: contentStr,
		IsDraft: pgtype.Bool{Bool: req.IsDraft, Valid: true},
	}

	if req.CharacterID != nil {
		params.CharacterID = pgtype.Int4{Int32: *req.CharacterID, Valid: true}
	}

	action, err := queries.SubmitAction(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to submit action: %w", err)
	}

	return &action, nil
}

func (ps *PhaseService) GetUserAction(ctx context.Context, gameID, userID, phaseID int32) (*models.GetUserActionRow, error) {
	queries := models.New(ps.DB)

	params := models.GetUserActionParams{
		GameID:  gameID,
		UserID:  userID,
		PhaseID: phaseID,
	}

	action, err := queries.GetUserAction(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No action submitted yet
		}
		return nil, fmt.Errorf("failed to get user action: %w", err)
	}

	return &action, nil
}

func (ps *PhaseService) GetUserActions(ctx context.Context, gameID, userID int32) ([]models.GetUserActionsRow, error) {
	queries := models.New(ps.DB)

	params := models.GetUserActionsParams{
		GameID: gameID,
		UserID: userID,
	}

	actions, err := queries.GetUserActions(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get user actions: %w", err)
	}

	return actions, nil
}

func (ps *PhaseService) GetPhaseActions(ctx context.Context, phaseID int32) ([]models.GetPhaseActionsRow, error) {
	queries := models.New(ps.DB)

	actions, err := queries.GetPhaseActions(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get phase actions: %w", err)
	}

	return actions, nil
}

func (ps *PhaseService) GetGameActions(ctx context.Context, gameID int32) ([]models.GetGameActionsRow, error) {
	queries := models.New(ps.DB)

	actions, err := queries.GetGameActions(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game actions: %w", err)
	}

	return actions, nil
}

func (ps *PhaseService) DeleteAction(ctx context.Context, gameID, userID, phaseID int32) error {
	queries := models.New(ps.DB)

	params := models.DeleteActionParams{
		GameID:  gameID,
		UserID:  userID,
		PhaseID: phaseID,
	}

	err := queries.DeleteAction(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to delete action: %w", err)
	}

	return nil
}

// Action Results Methods

func (ps *PhaseService) SendActionResult(ctx context.Context, gameID, userID, phaseID, gmUserID int32, content string) (*models.ActionResult, error) {
	queries := models.New(ps.DB)

	params := models.CreateActionResultParams{
		GameID:      gameID,
		UserID:      userID,
		PhaseID:     phaseID,
		GmUserID:    gmUserID,
		Content:     content,
		IsPublished: pgtype.Bool{Bool: true, Valid: true}, // Send means publish immediately
	}

	result, err := queries.CreateActionResult(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to send action result: %w", err)
	}

	return &result, nil
}

func (ps *PhaseService) GetUserResults(ctx context.Context, gameID, userID int32) ([]models.GetUserResultsRow, error) {
	queries := models.New(ps.DB)

	params := models.GetUserResultsParams{
		GameID: gameID,
		UserID: userID,
	}

	results, err := queries.GetUserResults(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get user results: %w", err)
	}

	return results, nil
}

func (ps *PhaseService) GetGameResults(ctx context.Context, gameID int32) ([]models.GetGameResultsRow, error) {
	queries := models.New(ps.DB)

	results, err := queries.GetGameResults(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game results: %w", err)
	}

	return results, nil
}

// Permission checking

func (ps *PhaseService) CanUserManagePhases(ctx context.Context, gameID, userID int32) (bool, error) {
	// Check if user is GM of the game
	gameService := &GameService{DB: ps.DB}
	game, err := gameService.GetGame(ctx, gameID)
	if err != nil {
		return false, fmt.Errorf("failed to get game: %w", err)
	}

	return game.GmUserID == userID, nil
}

func (ps *PhaseService) CanUserSubmitActions(ctx context.Context, gameID, userID int32) (bool, error) {
	// Check if user is participant (player, GM, or audience with assigned NPCs)
	gameService := &GameService{DB: ps.DB}
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

// Helper functions

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

func (ps *PhaseService) ConvertActionToResponse(action *models.ActionSubmission) ActionResponse {
	response := ActionResponse{
		ID:          action.ID,
		GameID:      action.GameID,
		UserID:      action.UserID,
		PhaseID:     action.PhaseID,
		Content:     action.Content,
		SubmittedAt: action.SubmittedAt.Time,
		UpdatedAt:   action.UpdatedAt.Time,
	}

	if action.CharacterID.Valid {
		response.CharacterID = &action.CharacterID.Int32
	}

	return response
}

// Additional PhaseService methods to complete the interface

func (ps *PhaseService) UpdatePhase(ctx context.Context, req core.UpdatePhaseRequest) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	params := models.UpdatePhaseParams{
		ID:          req.ID,
		Title:       req.Title,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
	}

	if req.StartTime != nil {
		params.StartTime = pgtype.Timestamptz{Time: *req.StartTime, Valid: true}
	}
	if req.EndTime != nil {
		params.EndTime = pgtype.Timestamptz{Time: *req.EndTime, Valid: true}
	}
	if req.Deadline != nil {
		params.Deadline = pgtype.Timestamptz{Time: *req.Deadline, Valid: true}
	}

	phase, err := queries.UpdatePhase(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to update phase: %w", err)
	}

	return &phase, nil
}

func (ps *PhaseService) TransitionToNextPhase(ctx context.Context, gameID, userID int32, req core.TransitionPhaseRequest) (*models.GamePhase, error) {
	// Start transaction for atomic phase transition
	tx, err := ps.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	txQueries := models.New(tx)

	// Get current active phase
	currentPhase, err := txQueries.GetActivePhase(ctx, gameID)
	var currentPhaseID *int32
	if err == nil {
		currentPhaseID = &currentPhase.ID
		// Deactivate current phase
		_, err = txQueries.DeactivatePhase(ctx, currentPhase.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to deactivate current phase: %w", err)
		}
	}

	// Get next phase number
	latestPhaseNum, err := txQueries.GetLatestPhaseNumber(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest phase number: %w", err)
	}

	var phaseNumber int32 = 1
	if latestPhaseNum != nil {
		switch val := latestPhaseNum.(type) {
		case int32:
			phaseNumber = val + 1
		case int64:
			phaseNumber = int32(val) + 1
		}
	}

	// Calculate timing
	startTime := time.Now()
	var endTime *time.Time
	if req.Duration != nil {
		calcEndTime := startTime.Add(*req.Duration)
		endTime = &calcEndTime
	} else if req.EndTime != nil {
		endTime = req.EndTime
	}

	// Create new phase
	createReq := core.CreatePhaseRequest{
		GameID:      gameID,
		PhaseType:   req.PhaseType,
		PhaseNumber: phaseNumber,
		Title:       req.Title,
		Description: req.Description,
		StartTime:   &startTime,
		EndTime:     endTime,
		Deadline:    req.Deadline,
	}

	params := models.CreateGamePhaseParams{
		GameID:      createReq.GameID,
		PhaseType:   createReq.PhaseType,
		PhaseNumber: createReq.PhaseNumber,
		Title:       createReq.Title,
		Description: pgtype.Text{String: createReq.Description, Valid: createReq.Description != ""},
		StartTime:   pgtype.Timestamptz{Time: startTime, Valid: true},
	}

	if createReq.EndTime != nil {
		params.EndTime = pgtype.Timestamptz{Time: *createReq.EndTime, Valid: true}
	}
	if createReq.Deadline != nil {
		params.Deadline = pgtype.Timestamptz{Time: *createReq.Deadline, Valid: true}
	}

	newPhase, err := txQueries.CreateGamePhase(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create new phase: %w", err)
	}

	// Activate the new phase
	activePhase, err := txQueries.ActivatePhase(ctx, newPhase.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to activate new phase: %w", err)
	}

	// Log the transition
	transitionParams := models.CreatePhaseTransitionParams{
		GameID:      gameID,
		ToPhaseID:   newPhase.ID,
		InitiatedBy: userID,
		Reason:      pgtype.Text{String: req.Reason, Valid: req.Reason != ""},
	}
	if currentPhaseID != nil {
		transitionParams.FromPhaseID = pgtype.Int4{Int32: *currentPhaseID, Valid: true}
	}

	_, err = txQueries.CreatePhaseTransition(ctx, transitionParams)
	if err != nil {
		return nil, fmt.Errorf("failed to log phase transition: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &activePhase, nil
}

func (ps *PhaseService) ActivatePhase(ctx context.Context, phaseID, userID int32) error {
	_, err := ps.activatePhaseInternal(ctx, phaseID)
	return err
}

// Internal method to avoid recursion
func (ps *PhaseService) activatePhaseInternal(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	// Get the phase to find the game ID
	phase, err := queries.GetPhase(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get phase: %w", err)
	}

	// Start transaction to ensure atomicity
	tx, err := ps.DB.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	txQueries := models.New(tx)

	// Deactivate all other phases for this game
	err = txQueries.DeactivateAllGamePhases(ctx, phase.GameID)
	if err != nil {
		return nil, fmt.Errorf("failed to deactivate existing phases: %w", err)
	}

	// Activate the new phase
	activePhase, err := txQueries.ActivatePhase(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to activate phase: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &activePhase, nil
}

func (ps *PhaseService) DeactivatePhase(ctx context.Context, gameID, userID int32) error {
	// Get active phase
	activePhase, err := ps.GetActivePhase(ctx, gameID)
	if err != nil {
		return fmt.Errorf("failed to get active phase: %w", err)
	}
	if activePhase == nil {
		return fmt.Errorf("no active phase to deactivate")
	}

	_, err = ps.deactivatePhaseInternal(ctx, activePhase.ID)
	return err
}

// Internal method to avoid recursion
func (ps *PhaseService) deactivatePhaseInternal(ctx context.Context, phaseID int32) (*models.GamePhase, error) {
	queries := models.New(ps.DB)

	phase, err := queries.DeactivatePhase(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to deactivate phase: %w", err)
	}

	return &phase, nil
}

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

// ActionSubmissionService methods

func (as *ActionSubmissionService) SubmitAction(ctx context.Context, req core.SubmitActionRequest) (*models.ActionSubmission, error) {
	queries := models.New(as.DB)

	// Verify phase exists and user can submit
	canSubmit, err := queries.CanUserSubmitToPhase(ctx, models.CanUserSubmitToPhaseParams{
		ID:     req.PhaseID,
		UserID: req.UserID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to check submission permissions: %w", err)
	}

	if !canSubmit {
		return nil, fmt.Errorf("user cannot submit actions to this phase")
	}

	// Validate character ownership if character_id is provided
	if req.CharacterID != nil {
		character, err := queries.GetCharacter(ctx, *req.CharacterID)
		if err != nil {
			return nil, fmt.Errorf("character not found")
		}

		// Verify the character belongs to the user submitting the action
		if !character.UserID.Valid || character.UserID.Int32 != req.UserID {
			return nil, fmt.Errorf("you can only submit actions for characters you own")
		}

		// Verify the character belongs to the same game
		if character.GameID != req.GameID {
			return nil, fmt.Errorf("character does not belong to this game")
		}
	}

	// Convert content to string (assuming JSON marshaling)
	contentStr := fmt.Sprintf("%v", req.Content)

	params := models.SubmitActionParams{
		GameID:  req.GameID,
		UserID:  req.UserID,
		PhaseID: req.PhaseID,
		Content: contentStr,
		IsDraft: pgtype.Bool{Bool: req.IsDraft, Valid: true},
	}

	if req.CharacterID != nil {
		params.CharacterID = pgtype.Int4{Int32: *req.CharacterID, Valid: true}
	}

	action, err := queries.SubmitAction(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to submit action: %w", err)
	}

	return &action, nil
}

func (as *ActionSubmissionService) GetActionSubmission(ctx context.Context, submissionID int32) (*models.ActionSubmission, error) {
	queries := models.New(as.DB)

	submission, err := queries.GetActionSubmission(ctx, submissionID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("action submission not found")
		}
		return nil, fmt.Errorf("failed to get action submission: %w", err)
	}

	return &submission, nil
}

func (as *ActionSubmissionService) GetUserPhaseSubmission(ctx context.Context, phaseID, userID int32) (*models.ActionSubmission, error) {
	queries := models.New(as.DB)

	submission, err := queries.GetUserPhaseSubmission(ctx, models.GetUserPhaseSubmissionParams{
		PhaseID: phaseID,
		UserID:  userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No submission found
		}
		return nil, fmt.Errorf("failed to get user phase submission: %w", err)
	}

	return &submission, nil
}

func (as *ActionSubmissionService) GetPhaseSubmissions(ctx context.Context, phaseID int32) ([]models.ActionSubmission, error) {
	queries := models.New(as.DB)

	submissions, err := queries.GetPhaseSubmissions(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get phase submissions: %w", err)
	}

	// Convert to models.ActionSubmission
	result := make([]models.ActionSubmission, len(submissions))
	for i, s := range submissions {
		result[i] = models.ActionSubmission{
			ID:        s.ID,
			GameID:    s.GameID,
			PhaseID:   s.PhaseID,
			UserID:    s.UserID,
			Content:   s.Content,
			IsDraft:   s.IsDraft,
			UpdatedAt: s.UpdatedAt,
		}
		if s.CharacterID.Valid {
			result[i].CharacterID = pgtype.Int4{Int32: s.CharacterID.Int32, Valid: true}
		}
		if s.SubmittedAt.Valid {
			result[i].SubmittedAt = pgtype.Timestamptz{Time: s.SubmittedAt.Time, Valid: true}
		}
	}

	return result, nil
}

func (as *ActionSubmissionService) DeleteActionSubmission(ctx context.Context, submissionID, userID int32) error {
	queries := models.New(as.DB)

	err := queries.DeleteActionSubmission(ctx, models.DeleteActionSubmissionParams{
		ID:     submissionID,
		UserID: userID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete action submission: %w", err)
	}

	return nil
}

func (as *ActionSubmissionService) CreateActionResult(ctx context.Context, req core.CreateActionResultRequest) (*models.ActionResult, error) {
	queries := models.New(as.DB)

	// Get the game to find the GM user ID
	game, err := queries.GetGame(ctx, req.GameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game: %w", err)
	}

	// Convert content to string
	contentStr := fmt.Sprintf("%v", req.Content)

	params := models.CreateActionResultParams{
		GameID:      req.GameID,
		UserID:      req.UserID,
		PhaseID:     req.PhaseID,
		GmUserID:    game.GmUserID,
		Content:     contentStr,
		IsPublished: pgtype.Bool{Bool: req.IsPublished, Valid: true},
	}

	// Note: ActionSubmissionID field not available in CreateActionResultParams

	result, err := queries.CreateActionResult(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create action result: %w", err)
	}

	return &result, nil
}

func (as *ActionSubmissionService) GetActionResult(ctx context.Context, resultID int32) (*models.ActionResult, error) {
	queries := models.New(as.DB)

	result, err := queries.GetActionResult(ctx, resultID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("action result not found")
		}
		return nil, fmt.Errorf("failed to get action result: %w", err)
	}

	return &result, nil
}

func (as *ActionSubmissionService) GetUserPhaseResults(ctx context.Context, phaseID, userID int32) ([]models.ActionResult, error) {
	queries := models.New(as.DB)

	results, err := queries.GetUserPhaseResults(ctx, models.GetUserPhaseResultsParams{
		PhaseID: phaseID,
		UserID:  userID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user phase results: %w", err)
	}

	return results, nil
}

func (as *ActionSubmissionService) PublishActionResult(ctx context.Context, resultID, userID int32) error {
	queries := models.New(as.DB)

	_, err := queries.PublishActionResult(ctx, resultID)
	if err != nil {
		return fmt.Errorf("failed to publish action result: %w", err)
	}

	return nil
}

func (as *ActionSubmissionService) PublishAllPhaseResults(ctx context.Context, phaseID int32) error {
	queries := models.New(as.DB)

	err := queries.PublishAllPhaseResults(ctx, phaseID)
	if err != nil {
		return fmt.Errorf("failed to publish all phase results: %w", err)
	}

	return nil
}

func (as *ActionSubmissionService) GetUnpublishedResultsCount(ctx context.Context, phaseID int32) (int64, error) {
	queries := models.New(as.DB)

	count, err := queries.GetUnpublishedResultsCount(ctx, phaseID)
	if err != nil {
		return 0, fmt.Errorf("failed to get unpublished results count: %w", err)
	}

	return count, nil
}

func (as *ActionSubmissionService) UpdateActionResult(ctx context.Context, resultID int32, content string) (*models.ActionResult, error) {
	queries := models.New(as.DB)

	result, err := queries.UpdateActionResult(ctx, models.UpdateActionResultParams{
		ID:      resultID,
		Content: content,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("result not found or already published")
		}
		return nil, fmt.Errorf("failed to update action result: %w", err)
	}

	return &result, nil
}

func (as *ActionSubmissionService) GetSubmissionStats(ctx context.Context, phaseID int32) (*core.ActionSubmissionStats, error) {
	queries := models.New(as.DB)

	// Get all submissions for this phase
	submissions, err := queries.GetPhaseSubmissions(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to get phase submissions: %w", err)
	}

	// Calculate stats manually
	var submittedCount, draftCount int32
	var latestSubmission *time.Time

	for _, submission := range submissions {
		if submission.IsDraft.Bool {
			draftCount++
		} else {
			submittedCount++
			if submission.SubmittedAt.Valid {
				if latestSubmission == nil || submission.SubmittedAt.Time.After(*latestSubmission) {
					latestSubmission = &submission.SubmittedAt.Time
				}
			}
		}
	}

	// Get total players count - for now use a simple approach
	// This should ideally be the number of participants in the game
	totalPlayers := submittedCount + draftCount
	if totalPlayers == 0 {
		totalPlayers = 1 // Avoid division by zero
	}

	submissionRate := float64(submittedCount) / float64(totalPlayers) * 100

	result := &core.ActionSubmissionStats{
		PhaseID:        phaseID,
		TotalPlayers:   totalPlayers,
		SubmittedCount: submittedCount,
		DraftCount:     draftCount,
		SubmissionRate: submissionRate,
	}

	if latestSubmission != nil {
		result.LatestSubmission = latestSubmission
	}

	return result, nil
}

func (as *ActionSubmissionService) CanUserSubmitAction(ctx context.Context, phaseID, userID int32) (bool, error) {
	queries := models.New(as.DB)

	// Check if phase exists and is active
	phase, err := queries.GetPhase(ctx, phaseID)
	if err != nil {
		return false, fmt.Errorf("failed to get phase: %w", err)
	}

	// For now, allow submission if phase is active and of type "action"
	return phase.IsActive.Bool && phase.PhaseType == "action", nil
}
