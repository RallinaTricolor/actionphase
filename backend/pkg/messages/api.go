package messages

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
	messagesvc "actionphase/pkg/db/services/messages"
)

type Handler struct {
	App *core.App
}

// Request Types
type CreatePostRequest struct {
	PhaseID     *int32 `json:"phase_id,omitempty"`
	CharacterID int32  `json:"character_id" validate:"required"`
	Content     string `json:"content" validate:"required,min=1"`
}

func (r *CreatePostRequest) Bind(req *http.Request) error {
	return nil
}

type CreateCommentRequest struct {
	PhaseID     *int32 `json:"phase_id,omitempty"`
	CharacterID int32  `json:"character_id" validate:"required"`
	Content     string `json:"content" validate:"required,min=1"`
}

func (r *CreateCommentRequest) Bind(req *http.Request) error {
	return nil
}

type UpdateCommentRequest struct {
	Content     string `json:"content" validate:"required,min=1"`
	CharacterID *int32 `json:"character_id,omitempty"`
}

func (r *UpdateCommentRequest) Bind(req *http.Request) error {
	return nil
}

// Response Types
type MessageResponse struct {
	ID                    int32      `json:"id"`
	GameID                int32      `json:"game_id"`
	PhaseID               *int32     `json:"phase_id,omitempty"`
	AuthorID              int32      `json:"author_id"`
	CharacterID           int32      `json:"character_id"`
	Content               string     `json:"content"`
	MessageType           string     `json:"message_type"`
	ParentID              *int32     `json:"parent_id,omitempty"`
	ThreadDepth           int32      `json:"thread_depth"`
	AuthorUsername        string     `json:"author_username"`
	CharacterName         string     `json:"character_name"`
	CommentCount          int64      `json:"comment_count,omitempty"`
	ReplyCount            int64      `json:"reply_count,omitempty"`
	IsEdited              bool       `json:"is_edited"`
	IsDeleted             bool       `json:"is_deleted"`
	MentionedCharacterIds []int32    `json:"mentioned_character_ids,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	DeletedAt             *time.Time `json:"deleted_at,omitempty"`
	DeletedByUserID       *int32     `json:"deleted_by_user_id,omitempty"`
	EditedAt              *time.Time `json:"edited_at,omitempty"`
	EditCount             int32      `json:"edit_count"`
}

func (rd *MessageResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// Helper function to get user ID from JWT token
func getUserIDFromToken(r *http.Request, app *core.App) (int32, error) {
	userService := &db.UserService{DB: app.Pool}
	userID, errResp := core.GetUserIDFromJWT(r.Context(), userService)
	if errResp != nil {
		return 0, fmt.Errorf("authentication failed")
	}
	return userID, nil
}

// Helper function to convert MessageWithDetails to MessageResponse
func messageWithDetailsToResponse(msg *core.MessageWithDetails) *MessageResponse {
	fmt.Printf("API messageWithDetailsToResponse: msg.ID=%d, msg.MentionedCharacterIds=%v\n", msg.ID, msg.MentionedCharacterIds)
	response := &MessageResponse{
		ID:                    msg.ID,
		GameID:                msg.GameID,
		AuthorID:              msg.AuthorID,
		CharacterID:           msg.CharacterID,
		Content:               msg.Content,
		MessageType:           string(msg.MessageType),
		ThreadDepth:           msg.ThreadDepth,
		AuthorUsername:        msg.AuthorUsername,
		CharacterName:         msg.CharacterName,
		IsEdited:              msg.IsEdited,
		IsDeleted:             msg.IsDeleted,
		MentionedCharacterIds: msg.MentionedCharacterIds,
		CreatedAt:             msg.CreatedAt.Time,
		EditCount:             msg.EditCount,
	}
	fmt.Printf("API messageWithDetailsToResponse: response.ID=%d, response.MentionedCharacterIds=%v\n", response.ID, response.MentionedCharacterIds)

	if msg.PhaseID.Valid {
		phaseID := msg.PhaseID.Int32
		response.PhaseID = &phaseID
	}

	if msg.ParentID.Valid {
		parentID := msg.ParentID.Int32
		response.ParentID = &parentID
	}

	if msg.DeletedAt.Valid {
		deletedAt := msg.DeletedAt.Time
		response.DeletedAt = &deletedAt
	}

	if msg.DeletedByUserID.Valid {
		deletedByUserID := msg.DeletedByUserID.Int32
		response.DeletedByUserID = &deletedByUserID
	}

	if msg.EditedAt.Valid {
		editedAt := msg.EditedAt.Time
		response.EditedAt = &editedAt
	}

	// Set either CommentCount or ReplyCount depending on message type
	if string(msg.MessageType) == "post" {
		response.CommentCount = msg.CommentCount
	} else {
		response.ReplyCount = msg.ReplyCount
	}

	return response
}

// CreatePost creates a new post in the common room
func (h *Handler) CreatePost(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &CreatePostRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Check if user is GM or co-GM (only GM/co-GM can create posts)
	queries := models.New(h.App.Pool)
	game, err := queries.GetGame(ctx, int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	isPrimaryGM := game.GmUserID == userID
	isCoGM := core.IsUserCoGM(ctx, h.App.Pool, int32(gameID), userID)

	if !isPrimaryGM && !isCoGM {
		h.App.Logger.Warn("Non-GM/co-GM user attempted to create post", "user_id", userID, "game_id", gameID)
		render.Render(w, r, core.ErrForbidden("Only the Game Master or co-GM can create posts"))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool}

	post, err := messageService.CreatePost(ctx, core.CreatePostRequest{
		GameID:      int32(gameID),
		PhaseID:     data.PhaseID,
		AuthorID:    userID,
		CharacterID: data.CharacterID,
		Content:     data.Content,
		Visibility:  "game", // Common Room posts are always visible to game
	})

	if err != nil {
		h.App.Logger.Error("Failed to create post", "error", err, "game_id", gameID, "user_id", userID)
		// Check if error is due to archived game
		if core.IsArchivedGameError(err) {
			render.Render(w, r, core.ErrGameArchived())
			return
		}
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Post created successfully", "post_id", post.ID, "game_id", gameID, "author_id", userID)

	// Fetch full post details to return with metadata
	postDetails, err := messageService.GetPost(ctx, post.ID)
	if err != nil {
		h.App.Logger.Error("Failed to fetch post details", "error", err, "post_id", post.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := messageWithDetailsToResponse(postDetails)
	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetGamePosts retrieves all posts for a game
func (h *Handler) GetGamePosts(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse optional query parameters
	phaseIDStr := r.URL.Query().Get("phase_id")
	var phaseID *int32
	if phaseIDStr != "" {
		pid, err := strconv.ParseInt(phaseIDStr, 10, 32)
		if err == nil {
			pid32 := int32(pid)
			phaseID = &pid32
		}
	}

	limitStr := r.URL.Query().Get("limit")
	limit := int32(50) // Default limit
	if limitStr != "" {
		l, err := strconv.ParseInt(limitStr, 10, 32)
		if err == nil && l > 0 && l <= 100 {
			limit = int32(l)
		}
	}

	offsetStr := r.URL.Query().Get("offset")
	offset := int32(0)
	if offsetStr != "" {
		o, err := strconv.ParseInt(offsetStr, 10, 32)
		if err == nil && o >= 0 {
			offset = int32(o)
		}
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	posts, err := messageService.GetGamePosts(ctx, int32(gameID), phaseID, limit, offset)
	if err != nil {
		h.App.Logger.Error("Failed to get game posts", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := make([]map[string]interface{}, 0)
	for _, post := range posts {
		postData := map[string]interface{}{
			"id":                   post.ID,
			"game_id":              post.GameID,
			"author_id":            post.AuthorID,
			"character_id":         post.CharacterID,
			"content":              post.Content,
			"message_type":         string(post.MessageType),
			"thread_depth":         post.ThreadDepth,
			"author_username":      post.AuthorUsername,
			"character_name":       post.CharacterName,
			"character_avatar_url": post.CharacterAvatarUrl,
			"comment_count":        post.CommentCount,
			"is_edited":            post.IsEdited,
			"is_deleted":           post.IsDeleted,
			"created_at":           post.CreatedAt,
		}

		if post.PhaseID.Valid {
			postData["phase_id"] = post.PhaseID.Int32
		}
		if post.ParentID.Valid {
			postData["parent_id"] = post.ParentID.Int32
		}

		response = append(response, postData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CreateComment creates a comment on a post or another comment
func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	postIDStr := chi.URLParam(r, "postId")
	postID, err := strconv.ParseInt(postIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid post ID")))
		return
	}

	data := &CreateCommentRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool}

	comment, err := messageService.CreateComment(ctx, core.CreateCommentRequest{
		GameID:      int32(gameID),
		PhaseID:     data.PhaseID,
		AuthorID:    userID,
		CharacterID: data.CharacterID,
		Content:     data.Content,
		ParentID:    int32(postID),
		Visibility:  "game",
	})

	if err != nil {
		h.App.Logger.Error("Failed to create comment", "error", err, "game_id", gameID, "post_id", postID, "user_id", userID)
		// Check if error is due to archived game
		if core.IsArchivedGameError(err) {
			render.Render(w, r, core.ErrGameArchived())
			return
		}
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Comment created successfully", "comment_id", comment.ID, "post_id", postID, "author_id", userID)

	// Fetch full comment details
	commentDetails, err := messageService.GetComment(ctx, comment.ID)
	if err != nil {
		h.App.Logger.Error("Failed to fetch comment details", "error", err, "comment_id", comment.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := messageWithDetailsToResponse(commentDetails)
	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetMessage retrieves a single message by ID (for deep linking)
func (h *Handler) GetMessage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	gameIDStr := chi.URLParam(r, "gameId")
	_, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	messageIDStr := chi.URLParam(r, "messageId")
	messageID, err := strconv.ParseInt(messageIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid message ID")))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	message, err := messageService.GetMessage(ctx, int32(messageID))
	if err != nil {
		h.App.Logger.Error("Failed to get message", "error", err, "message_id", messageID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := messageWithDetailsToResponse(message)
	render.Render(w, r, response)
}

// GetPostComments retrieves direct comments for a post
func (h *Handler) GetPostComments(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	gameIDStr := chi.URLParam(r, "gameId")
	_, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	postIDStr := chi.URLParam(r, "postId")
	postID, err := strconv.ParseInt(postIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid post ID")))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	comments, err := messageService.GetPostComments(ctx, int32(postID))
	if err != nil {
		h.App.Logger.Error("Failed to get post comments", "error", err, "post_id", postID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := make([]map[string]interface{}, 0)
	for _, comment := range comments {
		commentData := map[string]interface{}{
			"id":                      comment.ID,
			"game_id":                 comment.GameID,
			"author_id":               comment.AuthorID,
			"character_id":            comment.CharacterID,
			"content":                 comment.Content,
			"message_type":            string(comment.MessageType),
			"thread_depth":            comment.ThreadDepth,
			"author_username":         comment.AuthorUsername,
			"character_name":          comment.CharacterName,
			"character_avatar_url":    comment.CharacterAvatarUrl,
			"reply_count":             comment.ReplyCount,
			"is_edited":               comment.IsEdited,
			"is_deleted":              comment.IsDeleted,
			"mentioned_character_ids": comment.MentionedCharacterIds,
			"created_at":              comment.CreatedAt,
		}

		if comment.PhaseID.Valid {
			commentData["phase_id"] = comment.PhaseID.Int32
		}
		if comment.ParentID.Valid {
			commentData["parent_id"] = comment.ParentID.Int32
		}

		response = append(response, commentData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ============================================================================
// READ TRACKING HANDLERS
// ============================================================================

// MarkPostRead marks a post (and optionally a specific comment) as read
// POST /api/v1/games/:gameId/posts/:postId/mark-read
func (h *Handler) MarkPostRead(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse post ID
	postIDStr := chi.URLParam(r, "postId")
	postID, err := strconv.ParseInt(postIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid post ID")))
		return
	}

	// Get user ID from JWT
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Parse request body for optional last_read_comment_id
	var requestBody struct {
		LastReadCommentID *int32 `json:"last_read_comment_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil && err != io.EOF {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid request body")))
		return
	}

	// Mark as read
	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	readMarker, err := messageService.MarkPostAsRead(ctx, userID, int32(gameID), int32(postID), requestBody.LastReadCommentID)
	if err != nil {
		h.App.Logger.Error("Failed to mark post as read", "error", err, "game_id", gameID, "post_id", postID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Return the read marker
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":                   readMarker.ID,
		"user_id":              readMarker.UserID,
		"game_id":              readMarker.GameID,
		"post_id":              readMarker.PostID,
		"last_read_comment_id": readMarker.LastReadCommentID,
		"last_read_at":         readMarker.LastReadAt,
		"created_at":           readMarker.CreatedAt,
		"updated_at":           readMarker.UpdatedAt,
	})
}

// GetGameReadMarkers gets all read markers for the current user in a game
// GET /api/v1/games/:gameId/read-markers
func (h *Handler) GetGameReadMarkers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Get read markers
	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	readMarkers, err := messageService.GetUserReadMarkersForGame(ctx, userID, int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get read markers", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := make([]map[string]interface{}, 0, len(readMarkers))
	for _, marker := range readMarkers {
		response = append(response, map[string]interface{}{
			"id":                   marker.ID,
			"user_id":              marker.UserID,
			"game_id":              marker.GameID,
			"post_id":              marker.PostID,
			"last_read_comment_id": marker.LastReadCommentID,
			"last_read_at":         marker.LastReadAt,
			"created_at":           marker.CreatedAt,
			"updated_at":           marker.UpdatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetPostsUnreadInfo gets post metadata to determine unread status
// GET /api/v1/games/:gameId/posts-unread-info
func (h *Handler) GetPostsUnreadInfo(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get posts unread info
	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	postsInfo, err := messageService.GetPostsWithUnreadInfo(ctx, int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get posts unread info", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := make([]map[string]interface{}, 0, len(postsInfo))
	for _, info := range postsInfo {
		postData := map[string]interface{}{
			"post_id":         info.PostID,
			"post_created_at": info.PostCreatedAt,
			"total_comments":  info.TotalComments,
		}

		if info.LatestCommentAt != nil {
			postData["latest_comment_at"] = info.LatestCommentAt
		}

		response = append(response, postData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetUnreadCommentIDs gets the specific IDs of unread comments for all posts in a game
// GET /api/v1/games/:gameId/unread-comment-ids
func (h *Handler) GetUnreadCommentIDs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from JWT
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Get unread comment IDs
	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	unreadComments, err := messageService.GetUnreadCommentIDsForPosts(ctx, userID, int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get unread comment IDs", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := make([]map[string]interface{}, 0, len(unreadComments))
	for _, uc := range unreadComments {
		response = append(response, map[string]interface{}{
			"post_id":            uc.PostID,
			"unread_comment_ids": uc.UnreadCommentIDs,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UpdateComment updates the content of an existing comment
// PATCH /api/v1/games/:gameId/posts/:postId/comments/:commentId
func (h *Handler) UpdateComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse IDs
	gameIDStr := chi.URLParam(r, "gameId")
	_, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	commentIDStr := chi.URLParam(r, "commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid comment ID")))
		return
	}

	// Parse request body
	data := &UpdateCommentRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user ID from token
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &messagesvc.MessageService{DB: h.App.Pool}

	// Check if user can edit this comment (must be author)
	canEdit, err := messageService.CanUserEditComment(ctx, int32(commentID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to check edit permission", "error", err, "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canEdit {
		h.App.Logger.Warn("User attempted to edit comment without permission", "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrForbidden("You can only edit your own comments"))
		return
	}

	// Update the comment
	updatedComment, err := messageService.UpdateComment(ctx, int32(commentID), data.Content, data.CharacterID)
	if err != nil {
		// Check if this is a permission error
		if errors.Is(err, core.ErrCharacterNotControlled) {
			h.App.Logger.Warn("User attempted to use character they don't control", "comment_id", commentID, "user_id", userID, "requested_character_id", data.CharacterID)
			render.Render(w, r, core.ErrForbidden("You do not control this character"))
			return
		}
		h.App.Logger.Error("Failed to update comment", "error", err, "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Comment updated successfully", "comment_id", commentID, "user_id", userID, "edit_count", updatedComment.EditCount)

	// Fetch full comment details to return
	commentDetails, err := messageService.GetComment(ctx, updatedComment.ID)
	if err != nil {
		h.App.Logger.Error("Failed to fetch updated comment details", "error", err, "comment_id", updatedComment.ID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	response := messageWithDetailsToResponse(commentDetails)
	render.Render(w, r, response)
}

// DeleteComment soft-deletes a comment
// DELETE /api/v1/games/:gameId/posts/:postId/comments/:commentId
func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse IDs
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	commentIDStr := chi.URLParam(r, "commentId")
	commentID, err := strconv.ParseInt(commentIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid comment ID")))
		return
	}

	// Get user ID from token
	userID, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Get admin mode header
	adminModeHeader := r.Header.Get("X-Admin-Mode")
	isAdminMode := adminModeHeader == "true"

	// Get user service to check if user is admin
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.User(int(userID))
	if err != nil {
		h.App.Logger.Error("Failed to get user", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Admin mode only works for actual admins
	isAdmin := isAdminMode && user.IsAdmin

	messageService := &messagesvc.MessageService{DB: h.App.Pool}

	// Check if user can delete this comment
	canDelete, err := messageService.CanUserDeleteComment(ctx, int32(commentID), userID, isAdmin)
	if err != nil {
		h.App.Logger.Error("Failed to check delete permission", "error", err, "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canDelete {
		h.App.Logger.Warn("User attempted to delete comment without permission",
			"comment_id", commentID,
			"user_id", userID,
			"is_admin", isAdmin)
		render.Render(w, r, core.ErrForbidden("You don't have permission to delete this comment"))
		return
	}

	// Delete the comment
	err = messageService.DeleteComment(ctx, int32(commentID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to delete comment", "error", err, "comment_id", commentID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Comment deleted successfully",
		"comment_id", commentID,
		"game_id", gameID,
		"deleted_by_user_id", userID,
		"is_admin", isAdmin)

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Comment deleted successfully",
		"id":      commentID,
	})
}

// ListRecentCommentsWithParents lists recent comments with their parent messages for the "New Comments" view
// GET /api/v1/games/:gameId/comments/recent
func (h *Handler) ListRecentCommentsWithParents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse game ID
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Parse pagination parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	// Default limit is 10, max is 50
	limit := 10
	if limitStr != "" {
		parsedLimit, err := strconv.Atoi(limitStr)
		if err != nil || parsedLimit < 1 {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid limit parameter")))
			return
		}
		if parsedLimit > 50 {
			parsedLimit = 50
		}
		limit = parsedLimit
	}

	// Default offset is 0
	offset := 0
	if offsetStr != "" {
		parsedOffset, err := strconv.Atoi(offsetStr)
		if err != nil || parsedOffset < 0 {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid offset parameter")))
			return
		}
		offset = parsedOffset
	}

	// Get comments with parents from service
	// Note: No permission check required - comments are publicly viewable like posts
	messageService := &messagesvc.MessageService{DB: h.App.Pool}
	comments, err := messageService.ListRecentCommentsWithParents(ctx, int32(gameID), int32(limit), int32(offset))
	if err != nil {
		h.App.Logger.Error("Failed to list recent comments", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Get total comment count for pagination metadata
	totalCount, err := messageService.GetTotalCommentCount(ctx, int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get total comment count", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Listed recent comments with parents",
		"game_id", gameID,
		"limit", limit,
		"offset", offset,
		"count", len(comments),
		"total", totalCount)

	// Convert to response format
	response := map[string]interface{}{
		"comments": commentsWithParentsToResponse(comments),
		"pagination": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  totalCount,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Helper function to convert CommentWithParent slice to response format
func commentsWithParentsToResponse(comments []core.CommentWithParent) []map[string]interface{} {
	result := make([]map[string]interface{}, len(comments))
	for i, comment := range comments {
		commentData := map[string]interface{}{
			"id":              comment.ID,
			"game_id":         comment.GameID,
			"parent_id":       comment.ParentID,
			"author_id":       comment.AuthorID,
			"character_id":    comment.CharacterID,
			"content":         comment.Content,
			"created_at":      comment.CreatedAt.Format(time.RFC3339),
			"edited_at":       formatTimePtr(comment.EditedAt),
			"edit_count":      comment.EditCount,
			"deleted_at":      formatTimePtr(comment.DeletedAt),
			"is_deleted":      comment.IsDeleted,
			"author_username": comment.AuthorUsername,
			"character_name":  comment.CharacterName,
		}

		// Add parent data if exists
		if comment.ParentContent != nil {
			commentData["parent"] = map[string]interface{}{
				"content":         comment.ParentContent,
				"created_at":      formatTimePtr(comment.ParentCreatedAt),
				"deleted_at":      formatTimePtr(comment.ParentDeletedAt),
				"is_deleted":      comment.ParentIsDeleted,
				"message_type":    comment.ParentMessageType,
				"author_username": comment.ParentAuthorUsername,
				"character_name":  comment.ParentCharacterName,
			}
		}

		result[i] = commentData
	}
	return result
}

// Helper function to format *time.Time as RFC3339 string or nil
func formatTimePtr(t *time.Time) interface{} {
	if t == nil {
		return nil
	}
	return t.Format(time.RFC3339)
}
