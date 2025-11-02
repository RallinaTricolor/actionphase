package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/crypto/bcrypt"
)

const (
	MinPasswordLength = 8
	MaxPasswordLength = 128
)

// PasswordValidationError represents a password validation error
type PasswordValidationError struct {
	Field  string
	Reason string
}

func (e *PasswordValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Reason)
}

// ValidatePassword validates a password meets security requirements
// Requirements:
// - At least 8 characters long
// - At most 128 characters
// - Contains at least one uppercase letter
// - Contains at least one lowercase letter
// - Contains at least one number
// - Contains at least one special character
func ValidatePassword(password string) error {
	if len(password) < MinPasswordLength {
		return &PasswordValidationError{
			Field:  "password",
			Reason: fmt.Sprintf("must be at least %d characters long", MinPasswordLength),
		}
	}

	if len(password) > MaxPasswordLength {
		return &PasswordValidationError{
			Field:  "password",
			Reason: fmt.Sprintf("must be at most %d characters long", MaxPasswordLength),
		}
	}

	var (
		hasUpper   bool
		hasLower   bool
		hasNumber  bool
		hasSpecial bool
	)

	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasNumber = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	if !hasUpper {
		return &PasswordValidationError{
			Field:  "password",
			Reason: "must contain at least one uppercase letter",
		}
	}

	if !hasLower {
		return &PasswordValidationError{
			Field:  "password",
			Reason: "must contain at least one lowercase letter",
		}
	}

	if !hasNumber {
		return &PasswordValidationError{
			Field:  "password",
			Reason: "must contain at least one number",
		}
	}

	if !hasSpecial {
		return &PasswordValidationError{
			Field:  "password",
			Reason: "must contain at least one special character",
		}
	}

	// Check for common weak passwords
	weakPasswords := []string{
		"password", "12345678", "qwerty123", "admin123",
		"welcome123", "letmein123", "password123",
	}

	lowerPassword := strings.ToLower(password)
	for _, weak := range weakPasswords {
		if lowerPassword == weak || strings.Contains(lowerPassword, weak) {
			return &PasswordValidationError{
				Field:  "password",
				Reason: "password is too common and easy to guess",
			}
		}
	}

	return nil
}

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	if err := ValidatePassword(password); err != nil {
		return "", err
	}

	// Use bcrypt cost of 12 (recommended for 2024+)
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}

	return string(hash), nil
}

// VerifyPassword checks if a password matches a bcrypt hash
func VerifyPassword(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// GenerateSecureToken generates a cryptographically secure random token
func GenerateSecureToken(length int) (string, error) {
	// Calculate bytes needed (base64 encoding expands by 4/3)
	byteLength := (length * 3) / 4
	if byteLength < 32 {
		byteLength = 32 // Minimum 32 bytes (256 bits)
	}

	bytes := make([]byte, byteLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random token: %w", err)
	}

	// Encode to URL-safe base64 and trim to desired length
	token := base64.URLEncoding.EncodeToString(bytes)
	if len(token) > length {
		token = token[:length]
	}

	return token, nil
}

// IsValidEmail validates an email address format
func IsValidEmail(email string) bool {
	// Basic email validation regex
	// This is a simplified version - for production use a more comprehensive regex
	// or a dedicated email validation library
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

// ValidatePasswordsMatch checks if password and confirmation match
func ValidatePasswordsMatch(password, confirmPassword string) error {
	if password != confirmPassword {
		return &PasswordValidationError{
			Field:  "confirmPassword",
			Reason: "passwords do not match",
		}
	}
	return nil
}
