package messages

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
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

// Response Types
type MessageResponse struct {
	ID                    int32     `json:"id"`
	GameID                int32     `json:"game_id"`
	PhaseID               *int32    `json:"phase_id,omitempty"`
	AuthorID              int32     `json:"author_id"`
	CharacterID           int32     `json:"character_id"`
	Content               string    `json:"content"`
	MessageType           string    `json:"message_type"`
	ParentID              *int32    `json:"parent_id,omitempty"`
	ThreadDepth           int32     `json:"thread_depth"`
	AuthorUsername        string    `json:"author_username"`
	CharacterName         string    `json:"character_name"`
	CommentCount          int64     `json:"comment_count,omitempty"`
	ReplyCount            int64     `json:"reply_count,omitempty"`
	IsEdited              bool      `json:"is_edited"`
	IsDeleted             bool      `json:"is_deleted"`
	MentionedCharacterIds []int32   `json:"mentioned_character_ids,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

func (rd *MessageResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// Helper function to get user ID from JWT token
func getUserIDFromToken(r *http.Request, app *core.App) (int32, string, error) {
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		return 0, "", fmt.Errorf("no valid token found")
	}

	username, ok := token.Get("username")
	if !ok {
		return 0, "", fmt.Errorf("username not found in token")
	}

	userService := &db.UserService{DB: app.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		return 0, "", fmt.Errorf("user not found: %w", err)
	}

	return int32(user.ID), username.(string), nil
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
		UpdatedAt:             msg.UpdatedAt.Time,
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

	userID, username, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Check if user is GM (only GM can create posts)
	gameService := &db.GameService{DB: h.App.Pool}
	userRole, err := gameService.GetUserRole(ctx, int32(gameID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to get user role", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if userRole != "gm" {
		h.App.Logger.Warn("Non-GM user attempted to create post", "user_id", userID, "username", username, "game_id", gameID)
		render.Render(w, r, core.ErrForbidden("Only the Game Master can create posts"))
		return
	}

	messageService := &db.MessageService{DB: h.App.Pool}

	post, err := messageService.CreatePost(ctx, core.CreatePostRequest{
		GameID:      int32(gameID),
		PhaseID:     data.PhaseID,
		AuthorID:    userID,
		CharacterID: data.CharacterID,
		Content:     data.Content,
		Visibility:  "game", // Common Room posts are always visible to game
	})

	if err != nil {
		h.App.Logger.Error("Failed to create post", "error", err, "game_id", gameID, "username", username)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Post created successfully", "post_id", post.ID, "game_id", gameID, "author", username)

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

	messageService := &db.MessageService{DB: h.App.Pool}
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
			"updated_at":           post.UpdatedAt,
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

	userID, username, err := getUserIDFromToken(r, h.App)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	messageService := &db.MessageService{DB: h.App.Pool}

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
		h.App.Logger.Error("Failed to create comment", "error", err, "game_id", gameID, "post_id", postID, "username", username)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Comment created successfully", "comment_id", comment.ID, "post_id", postID, "author", username)

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

	messageService := &db.MessageService{DB: h.App.Pool}
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
			"updated_at":              comment.UpdatedAt,
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
