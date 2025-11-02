package auth

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidatePassword(t *testing.T) {
	tests := []struct {
		name        string
		password    string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "valid strong password",
			password:    "SecurePass123!",
			expectError: false,
		},
		{
			name:        "too short",
			password:    "Short1!",
			expectError: true,
			errorMsg:    "must be at least 8 characters",
		},
		{
			name:        "too long",
			password:    strings.Repeat("a", 129) + "A1!",
			expectError: true,
			errorMsg:    "must be at most 128 characters",
		},
		{
			name:        "no uppercase",
			password:    "lowercase123!",
			expectError: true,
			errorMsg:    "must contain at least one uppercase letter",
		},
		{
			name:        "no lowercase",
			password:    "UPPERCASE123!",
			expectError: true,
			errorMsg:    "must contain at least one lowercase letter",
		},
		{
			name:        "no number",
			password:    "NoNumbers!",
			expectError: true,
			errorMsg:    "must contain at least one number",
		},
		{
			name:        "no special character",
			password:    "NoSpecial123",
			expectError: true,
			errorMsg:    "must contain at least one special character",
		},
		{
			name:        "weak password - password123",
			password:    "Password123!",
			expectError: true,
			errorMsg:    "too common and easy to guess",
		},
		{
			name:        "weak password - admin123",
			password:    "Admin123!",
			expectError: true,
			errorMsg:    "too common and easy to guess",
		},
		{
			name:        "complex password with symbols",
			password:    "MyP@ssw0rd!2024",
			expectError: false,
		},
		{
			name:        "password with unicode",
			password:    "Secure🔒Pass123!",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePassword(tt.password)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestHashPassword(t *testing.T) {
	tests := []struct {
		name        string
		password    string
		expectError bool
	}{
		{
			name:        "valid password",
			password:    "SecurePass123!",
			expectError: false,
		},
		{
			name:        "invalid password",
			password:    "weak",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hash, err := HashPassword(tt.password)

			if tt.expectError {
				require.Error(t, err)
				assert.Empty(t, hash)
			} else {
				require.NoError(t, err)
				assert.NotEmpty(t, hash)
				assert.NotEqual(t, tt.password, hash)
				// Hash should start with $2a$ or $2b$ (bcrypt prefix)
				assert.True(t, strings.HasPrefix(hash, "$2"))
			}
		})
	}
}

func TestVerifyPassword(t *testing.T) {
	password := "SecurePass123!"
	hash, err := HashPassword(password)
	require.NoError(t, err)

	tests := []struct {
		name        string
		password    string
		hash        string
		expectError bool
	}{
		{
			name:        "correct password",
			password:    password,
			hash:        hash,
			expectError: false,
		},
		{
			name:        "incorrect password",
			password:    "WrongPass123!",
			hash:        hash,
			expectError: true,
		},
		{
			name:        "empty password",
			password:    "",
			hash:        hash,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := VerifyPassword(tt.password, tt.hash)

			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGenerateSecureToken(t *testing.T) {
	tests := []struct {
		name   string
		length int
	}{
		{
			name:   "32 characters",
			length: 32,
		},
		{
			name:   "64 characters",
			length: 64,
		},
		{
			name:   "small length",
			length: 16,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := GenerateSecureToken(tt.length)
			require.NoError(t, err)
			assert.Len(t, token, tt.length)

			// Generate another token and ensure they're different (randomness check)
			token2, err := GenerateSecureToken(tt.length)
			require.NoError(t, err)
			assert.NotEqual(t, token, token2)
		})
	}
}

func TestIsValidEmail(t *testing.T) {
	tests := []struct {
		name  string
		email string
		valid bool
	}{
		{
			name:  "valid email",
			email: "user@example.com",
			valid: true,
		},
		{
			name:  "valid email with subdomain",
			email: "user@mail.example.com",
			valid: true,
		},
		{
			name:  "valid email with plus",
			email: "user+tag@example.com",
			valid: true,
		},
		{
			name:  "valid email with dots",
			email: "first.last@example.com",
			valid: true,
		},
		{
			name:  "invalid - no @",
			email: "userexample.com",
			valid: false,
		},
		{
			name:  "invalid - no domain",
			email: "user@",
			valid: false,
		},
		{
			name:  "invalid - no TLD",
			email: "user@example",
			valid: false,
		},
		{
			name:  "invalid - spaces",
			email: "user name@example.com",
			valid: false,
		},
		{
			name:  "empty email",
			email: "",
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValidEmail(tt.email)
			assert.Equal(t, tt.valid, result)
		})
	}
}

func TestValidatePasswordsMatch(t *testing.T) {
	tests := []struct {
		name            string
		password        string
		confirmPassword string
		expectError     bool
	}{
		{
			name:            "passwords match",
			password:        "SecurePass123!",
			confirmPassword: "SecurePass123!",
			expectError:     false,
		},
		{
			name:            "passwords don't match",
			password:        "SecurePass123!",
			confirmPassword: "DifferentPass123!",
			expectError:     true,
		},
		{
			name:            "empty passwords match",
			password:        "",
			confirmPassword: "",
			expectError:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePasswordsMatch(tt.password, tt.confirmPassword)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), "passwords do not match")
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestPasswordValidationError(t *testing.T) {
	err := &PasswordValidationError{
		Field:  "password",
		Reason: "too short",
	}

	assert.Equal(t, "password: too short", err.Error())
}
