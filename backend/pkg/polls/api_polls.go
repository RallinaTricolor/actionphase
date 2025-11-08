package polls

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	dbservices "actionphase/pkg/db/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// Request and Response Types

// CreatePollRequest is the API request for creating a poll
type CreatePollRequest struct {
	Question            string              `json:"question"`
	Description         *string             `json:"description,omitempty"`
	Deadline            time.Time           `json:"deadline"`
	VoteAsType          string              `json:"vote_as_type"` // "player" or "character"
	PhaseID             *int32              `json:"phase_id,omitempty"`
	ShowIndividualVotes bool                `json:"show_individual_votes"`
	AllowOtherOption    bool                `json:"allow_other_option"`
	Options             []PollOptionRequest `json:"options"`
}

// PollOptionRequest represents a poll option in the API request
type PollOptionRequest struct {
	Text         string `json:"text"`
	DisplayOrder int32  `json:"display_order"`
}

// Bind validates the CreatePollRequest
func (req *CreatePollRequest) Bind(r *http.Request) error {
	if req.Question == "" {
		return fmt.Errorf("question is required")
	}
	if req.Deadline.Before(time.Now()) {
		return fmt.Errorf("deadline must be in the future")
	}
	if req.VoteAsType != "player" && req.VoteAsType != "character" {
		return fmt.Errorf("vote_as_type must be 'player' or 'character'")
	}
	if len(req.Options) < 2 {
		return fmt.Errorf("at least 2 options are required")
	}
	return nil
}

// UpdatePollRequest is the API request for updating a poll
type UpdatePollRequest struct {
	Question            string    `json:"question"`
	Description         *string   `json:"description,omitempty"`
	Deadline            time.Time `json:"deadline"`
	ShowIndividualVotes bool      `json:"show_individual_votes"`
	AllowOtherOption    bool      `json:"allow_other_option"`
}

// Bind validates the UpdatePollRequest
func (req *UpdatePollRequest) Bind(r *http.Request) error {
	if req.Question == "" {
		return fmt.Errorf("question is required")
	}
	if req.Deadline.Before(time.Now()) {
		return fmt.Errorf("deadline must be in the future")
	}
	return nil
}

// SubmitVoteRequest is the API request for submitting a vote
type SubmitVoteRequest struct {
	CharacterID      *int32  `json:"character_id,omitempty"`
	SelectedOptionID *int32  `json:"selected_option_id,omitempty"`
	OtherResponse    *string `json:"other_response,omitempty"`
}

// Bind validates the SubmitVoteRequest
func (req *SubmitVoteRequest) Bind(r *http.Request) error {
	if req.SelectedOptionID == nil && req.OtherResponse == nil {
		return fmt.Errorf("either selected_option_id or other_response is required")
	}
	return nil
}

// PollResponse is the API response for a poll with options
// Returns a flat structure with poll fields at top level and options array
type PollResponse struct {
	// Embed all poll fields at top level
	db.CommonRoomPoll

	// Additional response fields
	Options  []db.PollOption `json:"options"`
	HasVoted bool            `json:"has_voted,omitempty"`
}

// PollResultsResponse is the API response for poll results
type PollResultsResponse struct {
	Poll                db.CommonRoomPoll `json:"poll"`
	OptionResults       []OptionResult    `json:"option_results"`
	OtherResponses      []OtherResponse   `json:"other_responses"` // Always include even if empty array
	TotalVotes          int32             `json:"total_votes"`
	ShowIndividualVotes bool              `json:"show_individual_votes"`
}

// OptionResult represents voting results for one option
// Returns flattened structure matching frontend expectations
type OptionResult struct {
	PollOptionID *int32      `json:"poll_option_id,omitempty"`
	OptionText   *string     `json:"option_text,omitempty"`
	VoteCount    int32       `json:"vote_count"`
	Voters       []VoterInfo `json:"voters,omitempty"`
}

// VoterInfo represents information about a voter (only shown if show_individual_votes = true)
type VoterInfo struct {
	UserID        int32   `json:"user_id"`
	Username      string  `json:"username"`
	CharacterID   *int32  `json:"character_id,omitempty"`
	CharacterName *string `json:"character_name,omitempty"`
}

// OtherResponse represents a free-text "other" response
type OtherResponse struct {
	VoteID        int32   `json:"vote_id"`
	OtherText     string  `json:"other_text"`
	Username      string  `json:"username"`
	CharacterName *string `json:"character_name,omitempty"`
}

// Helper Functions

// strPtr returns a pointer to a string
func strPtr(s string) *string {
	return &s
}

// verifyUserIsGM checks if a user is the GM of a game
func (h *Handler) verifyUserIsGM(ctx context.Context, gameID int32, userID int32) error {
	gameService := &dbservices.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, gameID)
	if err != nil {
		return fmt.Errorf("failed to get game: %w", err)
	}

	if game.GmUserID != userID {
		return fmt.Errorf("only the GM can perform this action")
	}

	return nil
}

// verifyUserInGame checks if a user is a participant in a game (GM or player)
func (h *Handler) verifyUserInGame(ctx context.Context, gameID int32, userID int32) error {
	gameService := &dbservices.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	game, err := gameService.GetGame(ctx, gameID)
	if err != nil {
		return fmt.Errorf("failed to get game: %w", err)
	}

	// Check if user is GM
	if game.GmUserID == userID {
		return nil
	}

	// Check if user has any characters in the game
	characterService := &dbservices.CharacterService{DB: h.App.Pool}
	characters, err := characterService.GetCharactersByGame(ctx, gameID)
	if err != nil {
		return fmt.Errorf("failed to list characters: %w", err)
	}

	for _, char := range characters {
		if char.UserID.Valid && char.UserID.Int32 == userID {
			return nil
		}
	}

	return fmt.Errorf("user is not a participant in this game")
}

// API Handler Methods

// CreatePoll handles POST /games/{gameId}/polls
func (h *Handler) CreatePoll(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_create_poll")()

	defer h.App.ObsLogger.LogOperation(ctx, "CreatePoll")()

	// Extract game ID from URL
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid game ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse request body
	data := &CreatePollRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to bind create poll request")
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Authenticate user
	userService := &dbservices.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Verify user is GM
	if err := h.verifyUserIsGM(ctx, int32(gameID), userID); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "User is not GM of the game")
		render.Render(w, r, core.ErrForbidden(err.Error()))
		return
	}

	// Convert API request to service request
	options := make([]core.PollOptionInput, len(data.Options))
	for i, opt := range data.Options {
		options[i] = core.PollOptionInput{
			Text:         opt.Text,
			DisplayOrder: opt.DisplayOrder,
		}
	}

	serviceReq := core.CreatePollRequest{
		GameID:              int32(gameID),
		PhaseID:             data.PhaseID,
		CreatedByUserID:     userID,
		Question:            data.Question,
		Description:         data.Description,
		Deadline:            data.Deadline,
		VoteAsType:          data.VoteAsType,
		ShowIndividualVotes: data.ShowIndividualVotes,
		AllowOtherOption:    data.AllowOtherOption,
		Options:             options,
	}

	// Create poll
	pollService := &dbservices.PollService{DB: h.App.Pool}
	pollWithOptions, err := pollService.CreatePollWithOptions(ctx, serviceReq)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to create poll")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Send notification to all game participants
	gameService := &dbservices.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}
	participants, err := gameService.GetGameParticipants(ctx, int32(gameID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get game participants for notification")
		// Don't fail the request if notification fails - just log
	} else {
		// Build list of user IDs (exclude the creator)
		userIDs := make([]int32, 0)
		for _, participant := range participants {
			if participant.UserID != userID {
				userIDs = append(userIDs, participant.UserID)
			}
		}

		if len(userIDs) > 0 {
			notificationService := &dbservices.NotificationService{DB: h.App.Pool}
			gameIDInt32 := int32(gameID)
			linkURL := fmt.Sprintf("/games/%d?tab=polls", gameID)

			notifReq := &core.CreateNotificationRequest{
				GameID:      &gameIDInt32,
				Type:        "poll_created",
				Title:       fmt.Sprintf("New Poll: %s", pollWithOptions.Poll.Question),
				RelatedType: strPtr("poll"),
				RelatedID:   &pollWithOptions.Poll.ID,
				LinkURL:     &linkURL,
			}

			err = notificationService.CreateBulkNotifications(ctx, userIDs, notifReq)
			if err != nil {
				h.App.ObsLogger.LogError(ctx, err, "Failed to create bulk notifications")
				// Don't fail the request if notification fails
			}
		}
	}

	// Flatten the response structure
	response := PollResponse{
		CommonRoomPoll: pollWithOptions.Poll,
		Options:        pollWithOptions.Options,
	}

	render.JSON(w, r, response)
}

// ListGamePolls handles GET /games/{gameId}/polls
func (h *Handler) ListGamePolls(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_list_game_polls")()

	defer h.App.ObsLogger.LogOperation(ctx, "ListGamePolls")()

	// Extract game ID from URL
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid game ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Authenticate user
	userService := &dbservices.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Verify user is in game
	if err := h.verifyUserInGame(ctx, int32(gameID), userID); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "User is not in the game")
		render.Render(w, r, core.ErrForbidden(err.Error()))
		return
	}

	// Check for includeExpired query parameter
	includeExpired := r.URL.Query().Get("include_expired") == "true"

	// List polls
	pollService := &dbservices.PollService{DB: h.App.Pool}
	polls, err := pollService.ListPollsByGame(ctx, int32(gameID), includeExpired)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to list polls")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, polls)
}

// GetPoll handles GET /polls/{pollId}
func (h *Handler) GetPoll(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_poll")()

	defer h.App.ObsLogger.LogOperation(ctx, "GetPoll")()

	// Extract poll ID from URL
	pollIDStr := chi.URLParam(r, "pollId")
	pollID, err := strconv.ParseInt(pollIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid poll ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid poll ID")))
		return
	}

	// Authenticate user
	userService := &dbservices.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Get poll with options
	pollService := &dbservices.PollService{DB: h.App.Pool}
	pollWithOptions, err := pollService.GetPollWithOptions(ctx, int32(pollID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get poll")
		render.Render(w, r, core.ErrNotFound("poll"))
		return
	}

	// Verify user is in game
	if err := h.verifyUserInGame(ctx, pollWithOptions.Poll.GameID, userID); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "User is not in the game")
		render.Render(w, r, core.ErrForbidden(err.Error()))
		return
	}

	// Check if user has voted (for character polls, we'll check for player-level vote)
	hasVoted, err := pollService.HasUserVoted(ctx, int32(pollID), userID, nil)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to check if user voted")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Flatten the response structure
	response := PollResponse{
		CommonRoomPoll: pollWithOptions.Poll,
		Options:        pollWithOptions.Options,
		HasVoted:       hasVoted,
	}

	render.JSON(w, r, response)
}

// GetPollResults handles GET /polls/{pollId}/results
func (h *Handler) GetPollResults(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_poll_results")()

	// Extract poll ID from URL
	pollIDStr := chi.URLParam(r, "pollId")
	pollID, err := strconv.ParseInt(pollIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid poll ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid poll ID")))
		return
	}

	// Authenticate user
	userService := &dbservices.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Get poll results
	pollService := &dbservices.PollService{DB: h.App.Pool}
	results, err := pollService.GetPollResults(ctx, int32(pollID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get poll results")
		render.Render(w, r, core.ErrNotFound("poll"))
		return
	}

	// Verify user is in game
	if err := h.verifyUserInGame(ctx, results.Poll.GameID, userID); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "User is not in the game")
		render.Render(w, r, core.ErrForbidden(err.Error()))
		return
	}

	// Convert core.PollResults to API response with flattened structure
	optionResults := make([]OptionResult, len(results.OptionResults))
	for i, optRes := range results.OptionResults {
		voters := make([]VoterInfo, len(optRes.Voters))
		for j, voter := range optRes.Voters {
			voters[j] = VoterInfo{
				UserID:        voter.UserID,
				Username:      voter.Username,
				CharacterID:   voter.CharacterID,
				CharacterName: voter.CharacterName,
			}
		}

		// Flatten option fields to top level
		// For "Other" responses, these will be zero values (0 and "")
		var pollOptionID *int32
		var optionText *string
		if optRes.Option.ID != 0 {
			pollOptionID = &optRes.Option.ID
			optionText = &optRes.Option.OptionText
		}

		optionResults[i] = OptionResult{
			PollOptionID: pollOptionID,
			OptionText:   optionText,
			VoteCount:    optRes.VoteCount,
			Voters:       voters,
		}
	}

	otherResponses := make([]OtherResponse, len(results.OtherResponses))
	for i, other := range results.OtherResponses {
		otherResponses[i] = OtherResponse{
			VoteID:        other.VoteID,
			OtherText:     other.OtherText,
			Username:      other.Username,
			CharacterName: other.CharacterName,
		}
	}

	response := PollResultsResponse{
		Poll:                results.Poll,
		OptionResults:       optionResults,
		OtherResponses:      otherResponses,
		TotalVotes:          results.TotalVotes,
		ShowIndividualVotes: results.ShowIndividualVotes,
	}

	render.JSON(w, r, response)
}

// SubmitVote handles POST /polls/{pollId}/vote
func (h *Handler) SubmitVote(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_submit_vote")()

	defer h.App.ObsLogger.LogOperation(ctx, "SubmitVote")()

	// Extract poll ID from URL
	pollIDStr := chi.URLParam(r, "pollId")
	pollID, err := strconv.ParseInt(pollIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid poll ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid poll ID")))
		return
	}

	// Authenticate user
	userService := &dbservices.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Parse request body
	data := &SubmitVoteRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to bind submit vote request")
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get poll to verify it exists and check game membership
	pollService := &dbservices.PollService{DB: h.App.Pool}
	poll, err := pollService.GetPoll(ctx, int32(pollID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get poll")
		render.Render(w, r, core.ErrNotFound("poll"))
		return
	}

	// Verify user is in game
	if err := h.verifyUserInGame(ctx, poll.GameID, userID); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "User is not in the game")
		render.Render(w, r, core.ErrForbidden(err.Error()))
		return
	}

	// Check if deadline has passed
	if poll.Deadline.Time.Before(time.Now()) {
		h.App.ObsLogger.Error(ctx, "Cannot vote - poll deadline has passed")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("voting closed - poll deadline has passed")))
		return
	}

	// Validate vote type matches poll settings
	if poll.VoteAsType == "character" && data.CharacterID == nil {
		h.App.ObsLogger.Error(ctx, "Character ID required for character voting")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("character_id is required for character voting")))
		return
	}

	// If character voting, verify user owns the character
	if data.CharacterID != nil {
		characterService := &dbservices.CharacterService{DB: h.App.Pool}
		char, err := characterService.GetCharacter(ctx, *data.CharacterID)
		if err != nil {
			h.App.ObsLogger.LogError(ctx, err, "Character not found")
			render.Render(w, r, core.ErrNotFound("character"))
			return
		}
		if !char.UserID.Valid || char.UserID.Int32 != userID {
			h.App.ObsLogger.Error(ctx, "User does not own this character")
			render.Render(w, r, core.ErrForbidden("you do not own this character"))
			return
		}
		if char.GameID != poll.GameID {
			h.App.ObsLogger.Error(ctx, "Character is not in this game")
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("character is not in this game")))
			return
		}
	}

	// Submit vote
	serviceReq := core.SubmitVoteRequest{
		PollID:           int32(pollID),
		UserID:           userID,
		CharacterID:      data.CharacterID,
		SelectedOptionID: data.SelectedOptionID,
		OtherResponse:    data.OtherResponse,
	}

	vote, err := pollService.SubmitVote(ctx, serviceReq)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to submit vote")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, vote)
}

// UpdatePoll handles PUT /polls/{pollId}
func (h *Handler) UpdatePoll(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_poll")()

	defer h.App.ObsLogger.LogOperation(ctx, "UpdatePoll")()

	// Extract poll ID from URL
	pollIDStr := chi.URLParam(r, "pollId")
	pollID, err := strconv.ParseInt(pollIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid poll ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid poll ID")))
		return
	}

	// Authenticate user
	userService := &dbservices.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Parse request body
	data := &UpdatePollRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to bind update poll request")
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get poll to verify it exists and get game ID
	pollService := &dbservices.PollService{DB: h.App.Pool}
	poll, err := pollService.GetPoll(ctx, int32(pollID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get poll")
		render.Render(w, r, core.ErrNotFound("poll"))
		return
	}

	// Verify user is GM
	if err := h.verifyUserIsGM(ctx, poll.GameID, userID); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "User is not GM of the game")
		render.Render(w, r, core.ErrForbidden(err.Error()))
		return
	}

	// Update poll
	serviceReq := core.UpdatePollRequest{
		Question:            data.Question,
		Description:         data.Description,
		Deadline:            data.Deadline,
		ShowIndividualVotes: data.ShowIndividualVotes,
		AllowOtherOption:    data.AllowOtherOption,
	}

	updatedPoll, err := pollService.UpdatePoll(ctx, int32(pollID), serviceReq)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to update poll")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, updatedPoll)
}

// DeletePoll handles DELETE /polls/{pollId}
func (h *Handler) DeletePoll(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_delete_poll")()

	defer h.App.ObsLogger.LogOperation(ctx, "DeletePoll")()

	// Extract poll ID from URL
	pollIDStr := chi.URLParam(r, "pollId")
	pollID, err := strconv.ParseInt(pollIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid poll ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid poll ID")))
		return
	}

	// Authenticate user
	userService := &dbservices.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Get poll to verify it exists and get game ID
	pollService := &dbservices.PollService{DB: h.App.Pool}
	poll, err := pollService.GetPoll(ctx, int32(pollID))
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get poll")
		render.Render(w, r, core.ErrNotFound("poll"))
		return
	}

	// Verify user is GM
	if err := h.verifyUserIsGM(ctx, poll.GameID, userID); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "User is not GM of the game")
		render.Render(w, r, core.ErrForbidden(err.Error()))
		return
	}

	// Delete poll
	if err := pollService.DeletePoll(ctx, int32(pollID)); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to delete poll")
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.Status(r, http.StatusNoContent)
}
