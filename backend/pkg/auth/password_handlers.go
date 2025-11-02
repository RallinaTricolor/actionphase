package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"actionphase/pkg/email"
	"fmt"
	"net/http"

	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

// ChangePasswordHandler handles password change requests for authenticated users
func (h *Handler) V1ChangePassword(w http.ResponseWriter, r *http.Request) {
	// Get username from JWT token
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		h.App.Logger.Error("Failed to get token from context", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	username, ok := token.Get("username")
	if !ok {
		h.App.Logger.Error("username not found in token")
		render.Render(w, r, core.ErrUnauthorized("username not found in token"))
		return
	}

	// Look up current user from database
	userService := &db.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		h.App.Logger.Error("Failed to find user", "error", err, "username", username)
		render.Render(w, r, core.ErrUnauthorized("user not found"))
		return
	}

	userID := int(user.ID)

	// Parse request body
	var req ChangePasswordRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Create password service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.Logger.Error("Failed to create email service", "error", err)
		// Continue without email service - password change will still work
		emailService = nil
	}

	passwordService := &PasswordService{
		DB:           h.App.Pool,
		EmailService: emailService,
	}

	// Change password
	err = passwordService.ChangePassword(r.Context(), userID, &req)
	if err != nil {
		if pwdErr, ok := err.(*PasswordValidationError); ok {
			render.Render(w, r, &core.ErrResponse{
				Err:            err,
				HTTPStatusCode: http.StatusBadRequest,
				StatusText:     "Validation Error",
				ErrorText:      pwdErr.Error(),
			})
			return
		}
		h.App.Logger.Error("Failed to change password", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Password changed successfully", "user_id", userID)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Password changed successfully",
	})
}

// RequestPasswordResetHandler handles password reset requests (forgot password)
func (h *Handler) V1RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req RequestPasswordResetRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Create password service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.Logger.Error("Failed to create email service", "error", err)
		// Return success anyway to avoid revealing if email exists
		render.Status(r, http.StatusOK)
		render.JSON(w, r, map[string]string{
			"message": "If an account exists with this email, a password reset link will be sent",
		})
		return
	}

	passwordService := &PasswordService{
		DB:           h.App.Pool,
		EmailService: emailService,
	}

	// Request password reset
	err = passwordService.RequestPasswordReset(r.Context(), &req)
	if err != nil {
		if pwdErr, ok := err.(*PasswordValidationError); ok {
			render.Render(w, r, &core.ErrResponse{
				Err:            err,
				HTTPStatusCode: http.StatusBadRequest,
				StatusText:     "Validation Error",
				ErrorText:      pwdErr.Error(),
			})
			return
		}
		h.App.Logger.Error("Failed to request password reset", "error", err)
		// Don't reveal internal errors - return success anyway
	}

	h.App.Logger.Info("Password reset requested", "email", req.Email)

	// Always return success to prevent email enumeration
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "If an account exists with this email, a password reset link will be sent",
	})
}

// ResetPasswordHandler handles password reset with token
func (h *Handler) V1ResetPassword(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req ResetPasswordRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Create password service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.Logger.Error("Failed to create email service", "error", err)
		// Continue without email service - password reset will still work
		emailService = nil
	}

	passwordService := &PasswordService{
		DB:           h.App.Pool,
		EmailService: emailService,
	}

	// Reset password
	err = passwordService.ResetPassword(r.Context(), &req)
	if err != nil {
		if pwdErr, ok := err.(*PasswordValidationError); ok {
			render.Render(w, r, &core.ErrResponse{
				Err:            err,
				HTTPStatusCode: http.StatusBadRequest,
				StatusText:     "Validation Error",
				ErrorText:      pwdErr.Error(),
			})
			return
		}
		h.App.Logger.Error("Failed to reset password", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Password reset successfully")

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Password reset successfully",
	})
}

// ValidateResetTokenHandler validates a password reset token without using it
func (h *Handler) V1ValidateResetToken(w http.ResponseWriter, r *http.Request) {
	// Get token from query parameter
	token := r.URL.Query().Get("token")
	if token == "" {
		render.Render(w, r, &core.ErrResponse{
			Err:            fmt.Errorf("token is required"),
			HTTPStatusCode: http.StatusBadRequest,
			StatusText:     "Bad Request",
			ErrorText:      "token query parameter is required",
		})
		return
	}

	// Create password service
	passwordService := &PasswordService{
		DB: h.App.Pool,
	}

	// Check if token exists and is valid
	queries := passwordService.DB
	resetToken, err := queries.Query(r.Context(), "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()", token)
	if err != nil || !resetToken.Next() {
		render.Render(w, r, &core.ErrResponse{
			Err:            fmt.Errorf("invalid or expired token"),
			HTTPStatusCode: http.StatusBadRequest,
			StatusText:     "Invalid Token",
			ErrorText:      "This password reset link is invalid or has expired",
		})
		return
	}
	resetToken.Close()

	// Token is valid
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]bool{
		"valid": true,
	})
}
