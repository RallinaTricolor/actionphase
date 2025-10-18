package avatars

import (
	"actionphase/pkg/core"
	services "actionphase/pkg/db/services"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

type Handler struct {
	App *core.App
}

// Response types

type AvatarUploadResponse struct {
	AvatarURL string `json:"avatar_url"`
}

func (r *AvatarUploadResponse) Render(w http.ResponseWriter, req *http.Request) error {
	return nil
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func (r *ErrorResponse) Render(w http.ResponseWriter, req *http.Request) error {
	return nil
}

// UploadCharacterAvatar handles POST /api/v1/characters/:id/avatar
// Accepts multipart/form-data with "avatar" field containing the image file
func (h *Handler) UploadCharacterAvatar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get character ID from URL
	characterIDStr := chi.URLParam(r, "id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 32)
	if err != nil {
		render.Status(r, http.StatusBadRequest)
		render.Render(w, r, &ErrorResponse{Error: "Invalid character ID"})
		return
	}

	// Get authenticated user
	token, _, err := jwtauth.FromContext(ctx)
	if err != nil {
		render.Status(r, http.StatusUnauthorized)
		render.Render(w, r, &ErrorResponse{Error: "Unauthorized"})
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.Render(w, r, &ErrorResponse{Error: "Username not found in token"})
		return
	}

	// Look up user by username to get user ID
	userService := &services.UserService{DB: h.App.DB}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		render.Status(r, http.StatusUnauthorized)
		render.Render(w, r, &ErrorResponse{Error: "User not found"})
		return
	}

	userID := user.ID

	// Check if user can edit this character
	characterService := &services.CharacterService{DB: h.App.DB}
	canEdit, err := characterService.CanUserEditCharacter(ctx, int32(characterID), int32(userID))
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.Render(w, r, &ErrorResponse{Error: "Failed to check permissions"})
		return
	}

	if !canEdit {
		render.Status(r, http.StatusForbidden)
		render.Render(w, r, &ErrorResponse{Error: "You don't have permission to modify this character's avatar"})
		return
	}

	// Parse multipart form (10MB max)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		render.Status(r, http.StatusBadRequest)
		render.Render(w, r, &ErrorResponse{Error: "Failed to parse multipart form"})
		return
	}

	// Get file from form
	file, header, err := r.FormFile("avatar")
	if err != nil {
		render.Status(r, http.StatusBadRequest)
		render.Render(w, r, &ErrorResponse{Error: "Missing 'avatar' file in request"})
		return
	}
	defer file.Close()

	// Get content type from header
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		// Fallback to detecting from filename
		contentType = detectContentType(header.Filename)
	}

	// Upload avatar
	avatarService := &AvatarService{
		DB:      h.App.DB,
		Storage: h.App.Storage,
	}

	avatarURL, err := avatarService.UploadCharacterAvatar(
		ctx,
		int32(characterID),
		file,
		header.Filename,
		contentType,
	)
	if err != nil {
		// Determine status code based on error
		statusCode := http.StatusInternalServerError
		if isValidationError(err) {
			statusCode = http.StatusBadRequest
		}

		render.Status(r, statusCode)
		render.Render(w, r, &ErrorResponse{Error: err.Error()})
		return
	}

	// Return success response
	render.Status(r, http.StatusOK)
	render.Render(w, r, &AvatarUploadResponse{AvatarURL: avatarURL})
}

// DeleteCharacterAvatar handles DELETE /api/v1/characters/:id/avatar
func (h *Handler) DeleteCharacterAvatar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get character ID from URL
	characterIDStr := chi.URLParam(r, "id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 32)
	if err != nil {
		render.Status(r, http.StatusBadRequest)
		render.Render(w, r, &ErrorResponse{Error: "Invalid character ID"})
		return
	}

	// Get authenticated user
	token, _, err := jwtauth.FromContext(ctx)
	if err != nil {
		render.Status(r, http.StatusUnauthorized)
		render.Render(w, r, &ErrorResponse{Error: "Unauthorized"})
		return
	}

	username, ok := token.Get("username")
	if !ok {
		render.Status(r, http.StatusUnauthorized)
		render.Render(w, r, &ErrorResponse{Error: "Username not found in token"})
		return
	}

	// Look up user by username to get user ID
	userService := &services.UserService{DB: h.App.DB}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		render.Status(r, http.StatusUnauthorized)
		render.Render(w, r, &ErrorResponse{Error: "User not found"})
		return
	}

	userID := user.ID

	// Check if user can edit this character
	characterService := &services.CharacterService{DB: h.App.DB}
	canEdit, err := characterService.CanUserEditCharacter(ctx, int32(characterID), int32(userID))
	if err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.Render(w, r, &ErrorResponse{Error: "Failed to check permissions"})
		return
	}

	if !canEdit {
		render.Status(r, http.StatusForbidden)
		render.Render(w, r, &ErrorResponse{Error: "You don't have permission to modify this character's avatar"})
		return
	}

	// Delete avatar
	avatarService := &AvatarService{
		DB:      h.App.DB,
		Storage: h.App.Storage,
	}

	if err := avatarService.DeleteCharacterAvatar(ctx, int32(characterID)); err != nil {
		render.Status(r, http.StatusInternalServerError)
		render.Render(w, r, &ErrorResponse{Error: "Failed to delete avatar"})
		return
	}

	// Return 204 No Content
	w.WriteHeader(http.StatusNoContent)
}

// Helper functions

// detectContentType attempts to detect content type from filename
func detectContentType(filename string) string {
	// Simple extension-based detection
	ext := filename[len(filename)-4:]
	switch ext {
	case ".jpg", "jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case "webp":
		return "image/webp"
	default:
		return "application/octet-stream"
	}
}

// isValidationError checks if an error is a validation error (vs server error)
func isValidationError(err error) bool {
	errMsg := err.Error()
	// Check for common validation error phrases
	return contains(errMsg, "invalid file type") ||
		contains(errMsg, "too large") ||
		contains(errMsg, "Only JPG, PNG, and WebP")
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && s[:len(substr)] == substr || len(s) > len(substr) && findSubstring(s, substr)
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
