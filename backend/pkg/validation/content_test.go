package validation

import (
	"strings"
	"testing"
)

func TestValidateActionSubmission(t *testing.T) {
	tests := []struct {
		name      string
		content   string
		wantError bool
	}{
		{
			name:      "empty content",
			content:   "",
			wantError: false,
		},
		{
			name:      "normal content",
			content:   "My character investigates the mysterious door.",
			wantError: false,
		},
		{
			name:      "exactly at limit",
			content:   strings.Repeat("a", MaxActionSubmissionLength),
			wantError: false,
		},
		{
			name:      "one character over limit",
			content:   strings.Repeat("a", MaxActionSubmissionLength+1),
			wantError: true,
		},
		{
			name:      "far over limit",
			content:   strings.Repeat("a", MaxActionSubmissionLength*2),
			wantError: true,
		},
		{
			name:      "emoji and multi-byte characters",
			content:   strings.Repeat("🎮", 1000), // Each emoji is 1 character
			wantError: false,
		},
		{
			name:      "mixed ASCII and multi-byte",
			content:   "Test 🎮 message with emoji 🎯 and regular text",
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateActionSubmission(tt.content)
			if (err != nil) != tt.wantError {
				t.Errorf("ValidateActionSubmission() error = %v, wantError %v", err, tt.wantError)
			}
			if err != nil && !strings.Contains(err.Error(), "action submission") {
				t.Errorf("Error message should contain 'action submission', got: %v", err)
			}
		})
	}
}

func TestValidateActionResult(t *testing.T) {
	tests := []struct {
		name      string
		content   string
		wantError bool
	}{
		{
			name:      "empty content",
			content:   "",
			wantError: false,
		},
		{
			name:      "normal GM result",
			content:   "Your investigation reveals a hidden mechanism...",
			wantError: false,
		},
		{
			name:      "exactly at limit",
			content:   strings.Repeat("a", MaxActionResultLength),
			wantError: false,
		},
		{
			name:      "one character over limit",
			content:   strings.Repeat("a", MaxActionResultLength+1),
			wantError: true,
		},
		{
			name:      "far over limit",
			content:   strings.Repeat("a", MaxActionResultLength*2),
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateActionResult(tt.content)
			if (err != nil) != tt.wantError {
				t.Errorf("ValidateActionResult() error = %v, wantError %v", err, tt.wantError)
			}
			if err != nil && !strings.Contains(err.Error(), "action result") {
				t.Errorf("Error message should contain 'action result', got: %v", err)
			}
		})
	}
}

func TestValidatePost(t *testing.T) {
	tests := []struct {
		name      string
		content   string
		wantError bool
	}{
		{
			name:      "empty content",
			content:   "",
			wantError: false,
		},
		{
			name:      "normal post",
			content:   "What do you all think about the latest development?",
			wantError: false,
		},
		{
			name:      "exactly at limit",
			content:   strings.Repeat("a", MaxPostLength),
			wantError: false,
		},
		{
			name:      "one character over limit",
			content:   strings.Repeat("a", MaxPostLength+1),
			wantError: true,
		},
		{
			name:      "far over limit",
			content:   strings.Repeat("a", MaxPostLength*2),
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePost(tt.content)
			if (err != nil) != tt.wantError {
				t.Errorf("ValidatePost() error = %v, wantError %v", err, tt.wantError)
			}
			if err != nil && !strings.Contains(err.Error(), "post") {
				t.Errorf("Error message should contain 'post', got: %v", err)
			}
		})
	}
}

func TestValidateComment(t *testing.T) {
	tests := []struct {
		name      string
		content   string
		wantError bool
	}{
		{
			name:      "empty content",
			content:   "",
			wantError: false,
		},
		{
			name:      "normal comment",
			content:   "I agree with your analysis!",
			wantError: false,
		},
		{
			name:      "exactly at limit",
			content:   strings.Repeat("a", MaxCommentLength),
			wantError: false,
		},
		{
			name:      "one character over limit",
			content:   strings.Repeat("a", MaxCommentLength+1),
			wantError: true,
		},
		{
			name:      "far over limit",
			content:   strings.Repeat("a", MaxCommentLength*2),
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateComment(tt.content)
			if (err != nil) != tt.wantError {
				t.Errorf("ValidateComment() error = %v, wantError %v", err, tt.wantError)
			}
			if err != nil && !strings.Contains(err.Error(), "comment") {
				t.Errorf("Error message should contain 'comment', got: %v", err)
			}
		})
	}
}

func TestValidatePrivateMessage(t *testing.T) {
	tests := []struct {
		name      string
		content   string
		wantError bool
	}{
		{
			name:      "empty content",
			content:   "",
			wantError: false,
		},
		{
			name:      "normal private message",
			content:   "Hey, want to coordinate our actions this phase?",
			wantError: false,
		},
		{
			name:      "exactly at limit",
			content:   strings.Repeat("a", MaxPrivateMessageLength),
			wantError: false,
		},
		{
			name:      "one character over limit",
			content:   strings.Repeat("a", MaxPrivateMessageLength+1),
			wantError: true,
		},
		{
			name:      "far over limit",
			content:   strings.Repeat("a", MaxPrivateMessageLength*2),
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePrivateMessage(tt.content)
			if (err != nil) != tt.wantError {
				t.Errorf("ValidatePrivateMessage() error = %v, wantError %v", err, tt.wantError)
			}
			if err != nil && !strings.Contains(err.Error(), "private message") {
				t.Errorf("Error message should contain 'private message', got: %v", err)
			}
		})
	}
}

// TestErrorMessageFormat verifies that error messages include both max and actual length
func TestErrorMessageFormat(t *testing.T) {
	oversizedContent := strings.Repeat("a", MaxCommentLength+100)
	err := ValidateComment(oversizedContent)

	if err == nil {
		t.Fatal("Expected error for oversized content")
	}

	errMsg := err.Error()

	// Check that error includes the max length
	if !strings.Contains(errMsg, "10000") {
		t.Errorf("Error message should include max length (10000), got: %s", errMsg)
	}

	// Check that error includes the actual length
	if !strings.Contains(errMsg, "10100") {
		t.Errorf("Error message should include actual length (10100), got: %s", errMsg)
	}

	// Check that error includes content type
	if !strings.Contains(errMsg, "comment") {
		t.Errorf("Error message should include content type, got: %s", errMsg)
	}
}

// TestUTF8CharacterCounting verifies that we count Unicode characters, not bytes
func TestUTF8CharacterCounting(t *testing.T) {
	// Emoji characters are 4 bytes each in UTF-8, but count as 1 character
	emojiString := "🎮🎯🎪🎨🎭" // 5 emoji = 20 bytes but 5 characters

	err := ValidateComment(emojiString)
	if err != nil {
		t.Errorf("Short emoji string should pass validation, got error: %v", err)
	}

	// Create string with MaxCommentLength emoji characters (should pass)
	longEmojiString := strings.Repeat("🎮", MaxCommentLength)
	err = ValidateComment(longEmojiString)
	if err != nil {
		t.Errorf("Emoji string at exactly max length should pass, got error: %v", err)
	}

	// Create string with MaxCommentLength + 1 emoji characters (should fail)
	tooLongEmojiString := strings.Repeat("🎮", MaxCommentLength+1)
	err = ValidateComment(tooLongEmojiString)
	if err == nil {
		t.Error("Emoji string over max length should fail validation")
	}
}

// TestConstants verifies that the exported constants have expected values
func TestConstants(t *testing.T) {
	tests := []struct {
		name     string
		constant int
		expected int
	}{
		{"MaxActionSubmissionLength", MaxActionSubmissionLength, 100_000},
		{"MaxActionResultLength", MaxActionResultLength, 100_000},
		{"MaxPostLength", MaxPostLength, 50_000},
		{"MaxCommentLength", MaxCommentLength, 10_000},
		{"MaxPrivateMessageLength", MaxPrivateMessageLength, 50_000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.constant != tt.expected {
				t.Errorf("%s = %d, want %d", tt.name, tt.constant, tt.expected)
			}
		})
	}
}
