package core

import (
	"context"
	"errors"
	"testing"

	"github.com/go-chi/jwtauth/v5"
	"github.com/lestrrat-go/jwx/v2/jwt"
)

// TestGetUserIDFromJWT tests extracting user ID from JWT context
func TestGetUserIDFromJWT(t *testing.T) {
	// Create a mock user service (not needed for this function but required by signature)
	mockUserService := &MockUserService{}

	tests := []struct {
		name           string
		setupContext   func() context.Context
		expectUserID   int32
		expectError    bool
		expectedErrMsg string
	}{
		{
			name: "valid token with user ID",
			setupContext: func() context.Context {
				token := jwt.New()
				token.Set("sub", "12345")

				ctx := context.Background()
				ctx = context.WithValue(ctx, jwtauth.TokenCtxKey, token)
				ctx = context.WithValue(ctx, jwtauth.ErrorCtxKey, nil)

				return ctx
			},
			expectUserID: 12345,
			expectError:  false,
		},
		{
			name: "missing token in context",
			setupContext: func() context.Context {
				ctx := context.Background()
				ctx = context.WithValue(ctx, jwtauth.ErrorCtxKey, errors.New("no token"))
				return ctx
			},
			expectUserID:   0,
			expectError:    true,
			expectedErrMsg: "no valid token found",
		},
		{
			name: "token without sub claim",
			setupContext: func() context.Context {
				token := jwt.New()
				// No "sub" claim set

				ctx := context.Background()
				ctx = context.WithValue(ctx, jwtauth.TokenCtxKey, token)
				ctx = context.WithValue(ctx, jwtauth.ErrorCtxKey, nil)

				return ctx
			},
			expectUserID:   0,
			expectError:    true,
			expectedErrMsg: "user id not found in token",
		},
		{
			name: "valid token with different user ID",
			setupContext: func() context.Context {
				token := jwt.New()
				token.Set("sub", "999")

				ctx := context.Background()
				ctx = context.WithValue(ctx, jwtauth.TokenCtxKey, token)
				ctx = context.WithValue(ctx, jwtauth.ErrorCtxKey, nil)

				return ctx
			},
			expectUserID: 999,
			expectError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := tt.setupContext()
			userID, errResp := GetUserIDFromJWT(ctx, mockUserService)

			if tt.expectError {
				if errResp == nil {
					t.Error("Expected error response, got nil")
					return
				}

				// Check error message
				errResponse := errResp.(*ErrResponse)
				if errResponse.ErrorText != tt.expectedErrMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.expectedErrMsg, errResponse.ErrorText)
				}

				if userID != 0 {
					t.Errorf("Expected userID 0 on error, got %d", userID)
				}
			} else {
				if errResp != nil {
					t.Errorf("Expected no error, got: %v", errResp)
					return
				}

				if userID != tt.expectUserID {
					t.Errorf("Expected userID %d, got %d", tt.expectUserID, userID)
				}
			}
		})
	}
}

// TestGetUsernameFromJWT tests extracting username from JWT with DB lookup
func TestGetUsernameFromJWT(t *testing.T) {
	tests := []struct {
		name           string
		setupContext   func() context.Context
		setupMock      func(*MockUserService)
		expectUsername string
		expectError    bool
		expectedErrMsg string
	}{
		{
			name: "valid token with existing user",
			setupContext: func() context.Context {
				token := jwt.New()
				token.Set("sub", "123")

				ctx := context.Background()
				ctx = context.WithValue(ctx, jwtauth.TokenCtxKey, token)
				ctx = context.WithValue(ctx, jwtauth.ErrorCtxKey, nil)

				return ctx
			},
			setupMock: func(m *MockUserService) {
				m.UserFunc = func(id int) (*User, error) {
					if id == 123 {
						return &User{ID: 123, Username: "testuser"}, nil
					}
					return nil, errors.New("user not found")
				}
			},
			expectUsername: "testuser",
			expectError:    false,
		},
		{
			name: "missing token in context",
			setupContext: func() context.Context {
				ctx := context.Background()
				ctx = context.WithValue(ctx, jwtauth.ErrorCtxKey, errors.New("no token"))
				return ctx
			},
			setupMock: func(m *MockUserService) {
				// Not called
			},
			expectUsername: "",
			expectError:    true,
			expectedErrMsg: "no valid token found",
		},
		{
			name: "token without sub claim",
			setupContext: func() context.Context {
				token := jwt.New()
				// No "sub" claim

				ctx := context.Background()
				ctx = context.WithValue(ctx, jwtauth.TokenCtxKey, token)
				ctx = context.WithValue(ctx, jwtauth.ErrorCtxKey, nil)

				return ctx
			},
			setupMock: func(m *MockUserService) {
				// Not called
			},
			expectUsername: "",
			expectError:    true,
			expectedErrMsg: "user id not found in token",
		},
		{
			name: "user not found in database",
			setupContext: func() context.Context {
				token := jwt.New()
				token.Set("sub", "999")

				ctx := context.Background()
				ctx = context.WithValue(ctx, jwtauth.TokenCtxKey, token)
				ctx = context.WithValue(ctx, jwtauth.ErrorCtxKey, nil)

				return ctx
			},
			setupMock: func(m *MockUserService) {
				m.UserFunc = func(id int) (*User, error) {
					return nil, errors.New("user not found")
				}
			},
			expectUsername: "",
			expectError:    true,
			expectedErrMsg: "user not found",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockUserService := &MockUserService{}
			tt.setupMock(mockUserService)

			ctx := tt.setupContext()
			username, errResp := GetUsernameFromJWT(ctx, mockUserService)

			if tt.expectError {
				if errResp == nil {
					t.Error("Expected error response, got nil")
					return
				}

				errResponse := errResp.(*ErrResponse)
				if errResponse.ErrorText != tt.expectedErrMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.expectedErrMsg, errResponse.ErrorText)
				}

				if username != "" {
					t.Errorf("Expected empty username on error, got '%s'", username)
				}
			} else {
				if errResp != nil {
					t.Errorf("Expected no error, got: %v", errResp)
					return
				}

				if username != tt.expectUsername {
					t.Errorf("Expected username '%s', got '%s'", tt.expectUsername, username)
				}
			}
		})
	}
}

// TestValidateRequired tests the required field validation
func TestValidateRequired(t *testing.T) {
	tests := []struct {
		name           string
		value          string
		fieldName      string
		expectError    bool
		expectedErrMsg string
	}{
		{
			name:        "non-empty value is valid",
			value:       "test value",
			fieldName:   "title",
			expectError: false,
		},
		{
			name:           "empty string returns error",
			value:          "",
			fieldName:      "title",
			expectError:    true,
			expectedErrMsg: "title is required",
		},
		{
			name:           "empty email field",
			value:          "",
			fieldName:      "email",
			expectError:    true,
			expectedErrMsg: "email is required",
		},
		{
			name:        "whitespace is considered valid (not trimmed)",
			value:       "   ",
			fieldName:   "description",
			expectError: false,
		},
		{
			name:        "single character is valid",
			value:       "a",
			fieldName:   "code",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errResp := ValidateRequired(tt.value, tt.fieldName)

			if tt.expectError {
				if errResp == nil {
					t.Error("Expected error response, got nil")
					return
				}

				errResponse := errResp.(*ErrResponse)
				if errResponse.ErrorText != tt.expectedErrMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.expectedErrMsg, errResponse.ErrorText)
				}

				if errResponse.HTTPStatusCode != 400 {
					t.Errorf("Expected HTTP 400, got %d", errResponse.HTTPStatusCode)
				}
			} else {
				if errResp != nil {
					t.Errorf("Expected no error, got: %v", errResp)
				}
			}
		})
	}
}

// TestValidateStringLength tests string length validation
func TestValidateStringLength(t *testing.T) {
	tests := []struct {
		name           string
		value          string
		fieldName      string
		min            int
		max            int
		expectError    bool
		expectedErrMsg string
	}{
		{
			name:        "valid length within range",
			value:       "test",
			fieldName:   "title",
			min:         3,
			max:         10,
			expectError: false,
		},
		{
			name:        "exactly minimum length",
			value:       "abc",
			fieldName:   "code",
			min:         3,
			max:         10,
			expectError: false,
		},
		{
			name:        "exactly maximum length",
			value:       "1234567890",
			fieldName:   "code",
			min:         3,
			max:         10,
			expectError: false,
		},
		{
			name:           "below minimum length",
			value:          "ab",
			fieldName:      "title",
			min:            3,
			max:            10,
			expectError:    true,
			expectedErrMsg: "title must be at least 3 characters",
		},
		{
			name:           "above maximum length",
			value:          "12345678901",
			fieldName:      "title",
			min:            3,
			max:            10,
			expectError:    true,
			expectedErrMsg: "title must be at most 10 characters",
		},
		{
			name:           "empty string below minimum",
			value:          "",
			fieldName:      "description",
			min:            1,
			max:            255,
			expectError:    true,
			expectedErrMsg: "description must be at least 1 characters",
		},
		{
			name:        "zero minimum allows empty",
			value:       "",
			fieldName:   "optional",
			min:         0,
			max:         100,
			expectError: false,
		},
		{
			name:           "unicode characters counted as bytes (not runes)",
			value:          "你好世界", // 4 Chinese chars = 12 bytes in UTF-8
			fieldName:      "title",
			min:            1,
			max:            10,
			expectError:    true, // Exceeds 10 bytes
			expectedErrMsg: "title must be at most 10 characters",
		},
		{
			name:           "very long string",
			value:          string(make([]byte, 300)),
			fieldName:      "bio",
			min:            0,
			max:            255,
			expectError:    true,
			expectedErrMsg: "bio must be at most 255 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errResp := ValidateStringLength(tt.value, tt.fieldName, tt.min, tt.max)

			if tt.expectError {
				if errResp == nil {
					t.Error("Expected error response, got nil")
					return
				}

				errResponse := errResp.(*ErrResponse)
				if errResponse.ErrorText != tt.expectedErrMsg {
					t.Errorf("Expected error message '%s', got '%s'", tt.expectedErrMsg, errResponse.ErrorText)
				}

				if errResponse.HTTPStatusCode != 422 {
					t.Errorf("Expected HTTP 422, got %d", errResponse.HTTPStatusCode)
				}
			} else {
				if errResp != nil {
					errResponse := errResp.(*ErrResponse)
					t.Errorf("Expected no error, got: %s", errResponse.ErrorText)
				}
			}
		})
	}
}

// Using existing MockUserService from mocks.go
// No need to redefine it here
