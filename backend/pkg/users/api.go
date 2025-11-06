package users

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"actionphase/pkg/core"
	dbservices "actionphase/pkg/db/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// Handler holds dependencies for user profile API handlers
type Handler struct {
	App *core.App
}

// Request and Response Types

// UpdateUserProfileRequest is the API request for updating a user's profile
type UpdateUserProfileRequest struct {
	DisplayName *string `json:"display_name,omitempty"`
	Bio         *string `json:"bio,omitempty"`
}

// Bind validates the UpdateUserProfileRequest
func (req *UpdateUserProfileRequest) Bind(r *http.Request) error {
	// Both fields are optional, so just basic validation
	if req.DisplayName != nil && len(*req.DisplayName) > 255 {
		return fmt.Errorf("display name must be 255 characters or less")
	}
	if req.Bio != nil && len(*req.Bio) > 10000 {
		return fmt.Errorf("bio must be 10000 characters or less")
	}
	return nil
}

// UploadAvatarResponse is the response after uploading an avatar
type UploadAvatarResponse struct {
	AvatarURL string `json:"avatar_url"`
}

// API Handler Methods

// GetUserProfile handles GET /users/{id}/profile
// Returns a user's profile information and game history.
// This is a public endpoint (anyone authenticated can view any profile).
func (h *Handler) GetUserProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "GetUserProfile")()

	// Extract user ID from URL
	userIDStr := chi.URLParam(r, "id")
	userID, err := strconv.ParseInt(userIDStr, 10, 32)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Invalid user ID")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid user ID")))
		return
	}

	// Authenticate request user (viewer must be authenticated)
	userService := &dbservices.UserService{DB: h.App.Pool}
	_, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Parse pagination parameters
	queryParams := r.URL.Query()
	page := 1
	pageSize := 12 // Default page size for user game history
	if pageParam := queryParams.Get("page"); pageParam != "" {
		if p, err := strconv.Atoi(pageParam); err == nil && p > 0 {
			page = p
		}
	}
	if pageSizeParam := queryParams.Get("page_size"); pageSizeParam != "" {
		if ps, err := strconv.Atoi(pageSizeParam); err == nil && ps > 0 && ps <= 100 {
			pageSize = ps
		}
	}

	// Get user profile with pagination
	profileService := &UserProfileService{DB: h.App.Pool}
	profile, err := profileService.GetUserProfile(ctx, int32(userID), page, pageSize)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get user profile", "user_id", userID)
		render.Render(w, r, core.ErrNotFound("user profile"))
		return
	}

	render.JSON(w, r, profile)
}

// GetUserProfileByUsername handles GET /users/username/{username}/profile
// Returns a user's profile information and game history by username.
// This is a public endpoint (anyone authenticated can view any profile).
func (h *Handler) GetUserProfileByUsername(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "GetUserProfileByUsername")()

	// Extract username from URL
	username := chi.URLParam(r, "username")
	if username == "" {
		h.App.ObsLogger.Error(ctx, "Missing username parameter")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("username is required")))
		return
	}

	// Authenticate request user (viewer must be authenticated)
	userService := &dbservices.UserService{DB: h.App.Pool}
	_, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Look up user by username
	user, err := userService.UserByUsername(username)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to find user", "username", username)
		render.Render(w, r, core.ErrNotFound("user"))
		return
	}

	// Parse pagination parameters
	queryParams := r.URL.Query()
	page := 1
	pageSize := 12 // Default page size for user game history
	if pageParam := queryParams.Get("page"); pageParam != "" {
		if p, err := strconv.Atoi(pageParam); err == nil && p > 0 {
			page = p
		}
	}
	if pageSizeParam := queryParams.Get("page_size"); pageSizeParam != "" {
		if ps, err := strconv.Atoi(pageSizeParam); err == nil && ps > 0 && ps <= 100 {
			pageSize = ps
		}
	}

	// Get user profile with pagination
	profileService := &UserProfileService{DB: h.App.Pool}
	profile, err := profileService.GetUserProfile(ctx, int32(user.ID), page, pageSize)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get user profile", "user_id", user.ID)
		render.Render(w, r, core.ErrNotFound("user profile"))
		return
	}

	render.JSON(w, r, profile)
}

// UpdateUserProfile handles PATCH /users/me/profile
// Updates the authenticated user's profile (display name and/or bio).
// Only the user can update their own profile.
func (h *Handler) UpdateUserProfile(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "UpdateUserProfile")()

	// Authenticate user
	userService := &dbservices.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Parse request body
	data := &UpdateUserProfileRequest{}
	if err := render.Bind(r, data); err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to bind update profile request")
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Update profile
	profileService := &UserProfileService{DB: h.App.Pool}
	err := profileService.UpdateUserProfile(ctx, userID, data.DisplayName, data.Bio)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to update user profile", "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Return updated profile (first page with default page size)
	profile, err := profileService.GetUserProfile(ctx, userID, 1, 12)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get updated profile", "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.JSON(w, r, profile)
}

// UploadUserAvatar handles POST /users/me/avatar
// Uploads an avatar image for the authenticated user.
func (h *Handler) UploadUserAvatar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "UploadUserAvatar")()

	// Authenticate user
	userService := &dbservices.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Parse multipart form (max 10MB for total upload)
	err := r.ParseMultipartForm(10 << 20) // 10MB
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to parse multipart form")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("failed to parse form data")))
		return
	}

	// Get file from form
	file, header, err := r.FormFile("avatar")
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to get avatar file from form")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("avatar file is required")))
		return
	}
	defer file.Close()

	// Get content type from header
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream" // Fallback
	}

	// Upload avatar
	avatarService := &UserAvatarService{
		DB:      h.App.Pool,
		Storage: h.App.Storage,
	}

	// Read file into memory for upload service
	fileData, err := io.ReadAll(file)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to read file data")
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("failed to read file")))
		return
	}

	// Upload avatar
	avatarURL, err := avatarService.UploadUserAvatar(
		ctx,
		userID,
		bytes.NewReader(fileData),
		header.Filename,
		contentType,
	)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to upload user avatar", "user_id", userID)
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	response := UploadAvatarResponse{
		AvatarURL: avatarURL,
	}
	render.Status(r, http.StatusCreated)
	render.JSON(w, r, response)
}

// DeleteUserAvatar handles DELETE /users/me/avatar
// Deletes the authenticated user's avatar.
func (h *Handler) DeleteUserAvatar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "DeleteUserAvatar")()

	// Authenticate user
	userService := &dbservices.UserService{DB: h.App.Pool}
	userID, errResp := core.GetUserIDFromJWT(ctx, userService)
	if errResp != nil {
		h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
		render.Render(w, r, errResp)
		return
	}

	// Delete avatar
	avatarService := &UserAvatarService{
		DB:      h.App.Pool,
		Storage: h.App.Storage,
	}

	err := avatarService.DeleteUserAvatar(ctx, userID)
	if err != nil {
		h.App.ObsLogger.LogError(ctx, err, "Failed to delete user avatar", "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{"message": "Avatar deleted successfully"})
}
