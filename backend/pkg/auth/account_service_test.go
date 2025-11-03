package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"context"
	"fmt"
	"strings"
	"testing"
)

func TestAccountService_ChangeUsername(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "users")
	defer testDB.CleanupTables(t, "users")

	userService := &db.UserService{DB: testDB.Pool}
	logger := core.NewTestLogger()
	accountService := &AccountService{
		DB:     testDB.Pool,
		Logger: &logger,
	}

	// Create test user
	user, err := userService.CreateUser(&core.User{
		Username: "testuser",
		Password: "password123",
		Email:    "test@example.com",
	})
	core.AssertNoError(t, err, "User creation should succeed")

	t.Run("successfully_changes_username", func(t *testing.T) {
		err := accountService.ChangeUsername(context.Background(), user.ID, &ChangeUsernameRequest{
			NewUsername:     "newusername",
			CurrentPassword: "password123",
		})
		core.AssertNoError(t, err, "Username change should succeed")

		// Verify username changed
		updatedUser, err := userService.GetUserByID(user.ID)
		core.AssertNoError(t, err, "Should fetch updated user")
		core.AssertEqual(t, "newusername", updatedUser.Username, "Username should be updated")
	})

	t.Run("rejects_incorrect_password", func(t *testing.T) {
		err := accountService.ChangeUsername(context.Background(), user.ID, &ChangeUsernameRequest{
			NewUsername:     "anotherusername",
			CurrentPassword: "wrongpassword",
		})
		core.AssertTrue(t, err != nil, "Should reject incorrect password")
		pwdErr, ok := err.(*PasswordValidationError)
		core.AssertTrue(t, ok, "Should be PasswordValidationError")
		core.AssertEqual(t, "current_password", pwdErr.Field, "Error should be for current_password field")
		core.AssertTrue(t, strings.Contains(pwdErr.Reason, "incorrect"), "Error should mention incorrect password")
	})

	t.Run("enforces_cooldown_period", func(t *testing.T) {
		// Create a fresh user for this test
		cooldownUser, err := userService.CreateUser(&core.User{
			Username: "cooldownuser",
			Password: "password123",
			Email:    "cooldown@example.com",
		})
		core.AssertNoError(t, err, "User creation should succeed")

		// First change succeeds
		err = accountService.ChangeUsername(context.Background(), cooldownUser.ID, &ChangeUsernameRequest{
			NewUsername:     "cooldownuser1",
			CurrentPassword: "password123",
		})
		core.AssertNoError(t, err, "First username change should succeed")

		// Immediate second change should fail
		err = accountService.ChangeUsername(context.Background(), cooldownUser.ID, &ChangeUsernameRequest{
			NewUsername:     "cooldownuser2",
			CurrentPassword: "password123",
		})
		core.AssertTrue(t, err != nil, "Should enforce cooldown period")
		pwdErr, ok := err.(*PasswordValidationError)
		core.AssertTrue(t, ok, "Should be PasswordValidationError")
		core.AssertEqual(t, "username", pwdErr.Field, "Error should be for username field")
		core.AssertTrue(t, strings.Contains(pwdErr.Reason, "30 days"), "Error should mention cooldown period")
	})

	t.Run("rejects_username_too_short", func(t *testing.T) {
		err := accountService.ChangeUsername(context.Background(), user.ID, &ChangeUsernameRequest{
			NewUsername:     "ab",
			CurrentPassword: "password123",
		})
		core.AssertTrue(t, err != nil, "Should reject short username")
		pwdErr, ok := err.(*PasswordValidationError)
		core.AssertTrue(t, ok, "Should be PasswordValidationError")
		core.AssertTrue(t, strings.Contains(pwdErr.Reason, "at least 3 characters"), "Error should mention minimum length")
	})

	t.Run("rejects_username_too_long", func(t *testing.T) {
		longUsername := strings.Repeat("a", 51)
		err := accountService.ChangeUsername(context.Background(), user.ID, &ChangeUsernameRequest{
			NewUsername:     longUsername,
			CurrentPassword: "password123",
		})
		core.AssertTrue(t, err != nil, "Should reject long username")
		pwdErr, ok := err.(*PasswordValidationError)
		core.AssertTrue(t, ok, "Should be PasswordValidationError")
		core.AssertTrue(t, strings.Contains(pwdErr.Reason, "at most 50 characters"), "Error should mention maximum length")
	})

	t.Run("rejects_username_with_invalid_characters", func(t *testing.T) {
		invalidUsernames := []string{
			"user@test", // @ symbol
			"user name", // space
			"user.test", // dot
			"user#test", // hash
			"user$test", // dollar sign
			"user!test", // exclamation
			"user&test", // ampersand
			"user*test", // asterisk
			"用户名",       // unicode characters
		}

		for _, invalidUsername := range invalidUsernames {
			err := accountService.ChangeUsername(context.Background(), user.ID, &ChangeUsernameRequest{
				NewUsername:     invalidUsername,
				CurrentPassword: "password123",
			})
			core.AssertTrue(t, err != nil, fmt.Sprintf("Should reject username with invalid characters: %s", invalidUsername))
			pwdErr, ok := err.(*PasswordValidationError)
			core.AssertTrue(t, ok, "Should be PasswordValidationError")
			core.AssertTrue(t, strings.Contains(pwdErr.Reason, "letters, numbers, underscores, and hyphens"), "Error should mention valid characters")
		}
	})

	t.Run("accepts_username_with_valid_characters", func(t *testing.T) {
		validUsernames := []string{
			"user123",       // alphanumeric
			"user_test",     // underscore
			"user-test",     // hyphen
			"User_Test-123", // mixed case with underscore and hyphen
		}

		for i, validUsername := range validUsernames {
			// Create a fresh user for each valid username test (to avoid cooldown)
			validCharUser, err := userService.CreateUser(&core.User{
				Username: fmt.Sprintf("validcharsuser%d", i),
				Password: "password123",
				Email:    fmt.Sprintf("validchars%d@example.com", i),
			})
			core.AssertNoError(t, err, "User creation should succeed")

			err = accountService.ChangeUsername(context.Background(), validCharUser.ID, &ChangeUsernameRequest{
				NewUsername:     validUsername,
				CurrentPassword: "password123",
			})
			core.AssertNoError(t, err, fmt.Sprintf("Should accept valid username: %s", validUsername))
		}
	})

	t.Run("rejects_duplicate_username", func(t *testing.T) {
		// Create a fresh user for this test (to avoid cooldown period)
		freshUser, err := userService.CreateUser(&core.User{
			Username: "freshuser",
			Password: "password123",
			Email:    "fresh@example.com",
		})
		core.AssertNoError(t, err, "User creation should succeed")

		// Create another user with the target username
		otherUser, err := userService.CreateUser(&core.User{
			Username: "existinguser",
			Password: "password123",
			Email:    "existing@example.com",
		})
		core.AssertNoError(t, err, "User creation should succeed")

		// Try to change fresh user's username to existing username
		err = accountService.ChangeUsername(context.Background(), freshUser.ID, &ChangeUsernameRequest{
			NewUsername:     otherUser.Username,
			CurrentPassword: "password123",
		})
		core.AssertTrue(t, err != nil, "Should reject duplicate username")
		pwdErr, ok := err.(*PasswordValidationError)
		core.AssertTrue(t, ok, "Should be PasswordValidationError")
		core.AssertTrue(t, strings.Contains(pwdErr.Reason, "already taken"), "Error should mention username is taken")
	})
}

func TestAccountService_SoftDeleteAccount(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "sessions", "users")
	defer testDB.CleanupTables(t, "sessions", "users")

	userService := &db.UserService{DB: testDB.Pool}
	sessionService := &db.SessionService{DB: testDB.Pool}
	logger := core.NewTestLogger()
	accountService := &AccountService{
		DB:     testDB.Pool,
		Logger: &logger,
	}

	// Create test user
	user, err := userService.CreateUser(&core.User{
		Username: "deleteuser",
		Password: "password123",
		Email:    "delete@example.com",
	})
	core.AssertNoError(t, err, "User creation should succeed")

	// Create a session for the user
	_, err = sessionService.CreateSession(&core.Session{
		User:  user,
		Token: "test-token",
	})
	core.AssertNoError(t, err, "Session creation should succeed")

	t.Run("successfully_soft_deletes_account", func(t *testing.T) {
		err := accountService.SoftDeleteAccount(context.Background(), user.ID)
		core.AssertNoError(t, err, "Account deletion should succeed")

		// Note: Verification of soft delete would require querying deleted users
		// which may require special DB queries. For now, we verify the operation succeeds.
	})

	t.Run("invalidates_all_user_sessions", func(t *testing.T) {
		// Create another user with sessions
		sessionUser, err := userService.CreateUser(&core.User{
			Username: "sessionuser",
			Password: "password123",
			Email:    "session@example.com",
		})
		core.AssertNoError(t, err, "User creation should succeed")

		// Create multiple sessions
		session1, _ := sessionService.CreateSession(&core.Session{User: sessionUser, Token: "token1"})
		session2, _ := sessionService.CreateSession(&core.Session{User: sessionUser, Token: "token2"})
		core.AssertTrue(t, session1.ID > 0, "Session 1 should be created")
		core.AssertTrue(t, session2.ID > 0, "Session 2 should be created")

		// Delete account
		err = accountService.SoftDeleteAccount(context.Background(), sessionUser.ID)
		core.AssertNoError(t, err, "Account deletion should succeed")

		// Verify sessions are deleted
		sessions, err := sessionService.GetUserSessions(context.Background(), int32(sessionUser.ID))
		core.AssertNoError(t, err, "Should be able to query sessions")
		core.AssertEqual(t, 0, len(sessions), "All sessions should be deleted")
	})
}

func TestAccountService_RevokeAllSessions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "sessions", "users")
	defer testDB.CleanupTables(t, "sessions", "users")

	userService := &db.UserService{DB: testDB.Pool}
	sessionService := &db.SessionService{DB: testDB.Pool}
	logger := core.NewTestLogger()
	accountService := &AccountService{
		DB:     testDB.Pool,
		Logger: &logger,
	}

	// Create test user
	user, err := userService.CreateUser(&core.User{
		Username: "multipleuser",
		Password: "password123",
		Email:    "multiple@example.com",
	})
	core.AssertNoError(t, err, "User creation should succeed")

	// Create multiple sessions
	_, _ = sessionService.CreateSession(&core.Session{User: user, Token: "token1"})
	session2, _ := sessionService.CreateSession(&core.Session{User: user, Token: "token2"})
	_, _ = sessionService.CreateSession(&core.Session{User: user, Token: "token3"})

	t.Run("revokes_all_sessions_except_current", func(t *testing.T) {
		// Keep session2, revoke session1 and session3
		currentSessionID := int32(session2.ID)

		err := accountService.RevokeAllSessions(context.Background(), user.ID, currentSessionID)
		core.AssertNoError(t, err, "Revoking sessions should succeed")

		// Verify only current session remains
		sessions, err := sessionService.GetUserSessions(context.Background(), int32(user.ID))
		core.AssertNoError(t, err, "Should be able to query sessions")
		core.AssertEqual(t, 1, len(sessions), "Only current session should remain")
		core.AssertEqual(t, currentSessionID, sessions[0].ID, "Current session should be preserved")
	})

	t.Run("handles_no_sessions_gracefully", func(t *testing.T) {
		// Create user with no sessions
		noSessionUser, err := userService.CreateUser(&core.User{
			Username: "nosessions",
			Password: "password123",
			Email:    "nosessions@example.com",
		})
		core.AssertNoError(t, err, "User creation should succeed")

		// Try to revoke sessions (should not error)
		err = accountService.RevokeAllSessions(context.Background(), noSessionUser.ID, 999)
		core.AssertNoError(t, err, "Should handle no sessions gracefully")
	})
}

func TestAccountService_RequestEmailChange(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "email_verification_tokens", "users")
	defer testDB.CleanupTables(t, "email_verification_tokens", "users")

	userService := &db.UserService{DB: testDB.Pool}
	logger := core.NewTestLogger()
	accountService := &AccountService{
		DB:           testDB.Pool,
		EmailService: nil, // No email service for unit tests
		Logger:       &logger,
	}

	// Create test user
	user, err := userService.CreateUser(&core.User{
		Username: "emailuser",
		Password: "password123",
		Email:    "original@example.com",
	})
	core.AssertNoError(t, err, "User creation should succeed")

	t.Run("successfully_requests_email_change", func(t *testing.T) {
		err := accountService.RequestEmailChange(context.Background(), user.ID, &ChangeEmailRequest{
			NewEmail:        "newemail@example.com",
			CurrentPassword: "password123",
		})
		core.AssertNoError(t, err, "Email change request should succeed")

		// Email verification token should be created (verified by no error)
		// Full verification would require checking the email_verification_tokens table
	})

	t.Run("rejects_incorrect_password", func(t *testing.T) {
		err := accountService.RequestEmailChange(context.Background(), user.ID, &ChangeEmailRequest{
			NewEmail:        "another@example.com",
			CurrentPassword: "wrongpassword",
		})
		core.AssertTrue(t, err != nil, "Should reject incorrect password")
		pwdErr, ok := err.(*PasswordValidationError)
		core.AssertTrue(t, ok, "Should be PasswordValidationError")
		core.AssertTrue(t, strings.Contains(pwdErr.Reason, "incorrect"), "Error should mention incorrect password")
	})

	t.Run("rejects_duplicate_email", func(t *testing.T) {
		// Create another user
		otherUser, err := userService.CreateUser(&core.User{
			Username: "otheremailuser",
			Password: "password123",
			Email:    "existing@example.com",
		})
		core.AssertNoError(t, err, "User creation should succeed")

		// Try to change to existing email
		err = accountService.RequestEmailChange(context.Background(), user.ID, &ChangeEmailRequest{
			NewEmail:        otherUser.Email,
			CurrentPassword: "password123",
		})
		core.AssertTrue(t, err != nil, "Should reject duplicate email")
		pwdErr, ok := err.(*PasswordValidationError)
		core.AssertTrue(t, ok, "Should be PasswordValidationError")
		core.AssertTrue(t, strings.Contains(pwdErr.Reason, "already in use"), "Error should mention email in use")
	})

	t.Run("rejects_invalid_email_format", func(t *testing.T) {
		err := accountService.RequestEmailChange(context.Background(), user.ID, &ChangeEmailRequest{
			NewEmail:        "not-an-email",
			CurrentPassword: "password123",
		})
		core.AssertTrue(t, err != nil, "Should reject invalid email")
		pwdErr, ok := err.(*PasswordValidationError)
		core.AssertTrue(t, ok, "Should be PasswordValidationError")
		core.AssertTrue(t, strings.Contains(pwdErr.Reason, "invalid email"), "Error should mention invalid email format")
	})
}
