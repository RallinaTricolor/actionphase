package auth

import (
	"actionphase/pkg/core"
	"actionphase/pkg/email"
	"net/http"

	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

// V1VerifyEmail handles email verification with token
func (h *Handler) V1VerifyEmail(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req VerifyEmailRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Create account service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.Logger.Error("Failed to create email service", "error", err)
		emailService = nil
	}

	accountService := &AccountService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       &h.App.Logger,
	}

	// Verify email
	err = accountService.VerifyEmail(r.Context(), &req)
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
		h.App.Logger.Error("Failed to verify email", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Email verified successfully")

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Email verified successfully",
	})
}

// V1ResendVerificationEmail resends verification email for authenticated user
func (h *Handler) V1ResendVerificationEmail(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int(authUser.ID)

	// Create account service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.Logger.Error("Failed to create email service", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	accountService := &AccountService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       &h.App.Logger,
	}

	// Resend verification email
	err = accountService.ResendVerificationEmail(r.Context(), userID)
	if err != nil {
		h.App.Logger.Error("Failed to resend verification email", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Verification email resent", "user_id", userID)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Verification email sent",
	})
}

// V1ChangeUsername handles username change requests for authenticated users
func (h *Handler) V1ChangeUsername(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int(authUser.ID)

	// Parse request body
	var req ChangeUsernameRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Create account service
	accountService := &AccountService{
		DB:     h.App.Pool,
		Logger: &h.App.Logger,
	}

	// Change username
	err := accountService.ChangeUsername(r.Context(), userID, &req)
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
		h.App.Logger.Error("Failed to change username", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Username changed successfully", "user_id", userID, "new_username", req.NewUsername)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Username changed successfully",
	})
}

// V1RequestEmailChange handles email change requests for authenticated users
func (h *Handler) V1RequestEmailChange(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int(authUser.ID)

	// Parse request body
	var req ChangeEmailRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Create account service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.Logger.Error("Failed to create email service", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	accountService := &AccountService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       &h.App.Logger,
	}

	// Request email change
	err = accountService.RequestEmailChange(r.Context(), userID, &req)
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
		h.App.Logger.Error("Failed to request email change", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Email change requested", "user_id", userID, "new_email", req.NewEmail)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Verification email sent to new address",
	})
}

// V1CompleteEmailChange completes the email change after verification
func (h *Handler) V1CompleteEmailChange(w http.ResponseWriter, r *http.Request) {
	// Parse request body
	var req VerifyEmailRequest
	if err := render.DecodeJSON(r.Body, &req); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Create account service
	emailService, err := email.NewEmailServiceFromEnv()
	if err != nil {
		h.App.Logger.Error("Failed to create email service", "error", err)
		emailService = nil
	}

	accountService := &AccountService{
		DB:           h.App.Pool,
		EmailService: emailService,
		Logger:       &h.App.Logger,
	}

	// Complete email change
	err = accountService.CompleteEmailChange(r.Context(), &req)
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
		h.App.Logger.Error("Failed to complete email change", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Email change completed successfully")

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Email changed successfully",
	})
}

// V1DeleteAccount soft deletes the authenticated user's account
func (h *Handler) V1DeleteAccount(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int(authUser.ID)

	// Create account service
	accountService := &AccountService{
		DB:     h.App.Pool,
		Logger: &h.App.Logger,
	}

	// Soft delete account
	err := accountService.SoftDeleteAccount(r.Context(), userID)
	if err != nil {
		h.App.Logger.Error("Failed to delete account", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("Account deleted successfully", "user_id", userID)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "Account deleted successfully. You have 30 days to restore your account.",
	})
}

// V1RevokeAllSessions revokes all sessions except the current one
func (h *Handler) V1RevokeAllSessions(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user from context (set by middleware)
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user in context")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	userID := int(authUser.ID)

	// Get current token to identify current session
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		h.App.Logger.Error("Failed to get token from context", "error", err)
		render.Render(w, r, core.ErrUnauthorized("invalid token"))
		return
	}

	// Get current session ID from token
	sessionIDFloat, ok := token.Get("session_id")
	if !ok {
		h.App.Logger.Error("session_id not found in token")
		render.Render(w, r, core.ErrUnauthorized("session_id not found in token"))
		return
	}

	currentSessionID := int32(sessionIDFloat.(float64))

	// Create account service
	accountService := &AccountService{
		DB:     h.App.Pool,
		Logger: &h.App.Logger,
	}

	// Revoke all sessions except current
	err = accountService.RevokeAllSessions(r.Context(), userID, currentSessionID)
	if err != nil {
		h.App.Logger.Error("Failed to revoke all sessions", "error", err, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	h.App.Logger.Info("All sessions revoked except current", "user_id", userID)

	// Return success response
	render.Status(r, http.StatusOK)
	render.JSON(w, r, map[string]string{
		"message": "All other sessions revoked successfully",
	})
}
