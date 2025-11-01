package validation

import (
	"fmt"
	"unicode/utf8"
)

// Content length limits for different types of user-generated content.
// These limits are enforced at the application layer to prevent abuse
// while allowing the database to use flexible TEXT columns.
const (
	// MaxActionSubmissionLength is the maximum length for player action submissions.
	// 100,000 characters ≈ 20,000 words ≈ 40 pages of text.
	MaxActionSubmissionLength = 100_000

	// MaxActionResultLength is the maximum length for GM action results.
	// 100,000 characters allows GMs to provide comprehensive narrative outcomes.
	MaxActionResultLength = 100_000

	// MaxPostLength is the maximum length for common room posts.
	// 50,000 characters ≈ 10,000 words ≈ 20 pages of text.
	MaxPostLength = 50_000

	// MaxCommentLength is the maximum length for comments on posts.
	// 10,000 characters ≈ 2,000 words keeps discussions focused.
	MaxCommentLength = 10_000

	// MaxPrivateMessageLength is the maximum length for private messages.
	// 50,000 characters allows detailed player-to-player communication.
	MaxPrivateMessageLength = 50_000
)

// ValidateActionSubmission validates that action submission content does not exceed the maximum length.
// Returns an error if the content is too long, with details about the limit and actual length.
func ValidateActionSubmission(content string) error {
	return validateContentLength(content, MaxActionSubmissionLength, "action submission")
}

// ValidateActionResult validates that action result content does not exceed the maximum length.
// Returns an error if the content is too long, with details about the limit and actual length.
func ValidateActionResult(content string) error {
	return validateContentLength(content, MaxActionResultLength, "action result")
}

// ValidatePost validates that post content does not exceed the maximum length.
// Returns an error if the content is too long, with details about the limit and actual length.
func ValidatePost(content string) error {
	return validateContentLength(content, MaxPostLength, "post")
}

// ValidateComment validates that comment content does not exceed the maximum length.
// Returns an error if the content is too long, with details about the limit and actual length.
func ValidateComment(content string) error {
	return validateContentLength(content, MaxCommentLength, "comment")
}

// ValidatePrivateMessage validates that private message content does not exceed the maximum length.
// Returns an error if the content is too long, with details about the limit and actual length.
func ValidatePrivateMessage(content string) error {
	return validateContentLength(content, MaxPrivateMessageLength, "private message")
}

// validateContentLength is a helper function that validates content against a maximum character limit.
// It counts Unicode characters (not bytes) to handle multi-byte UTF-8 characters correctly.
//
// Parameters:
//   - content: The text content to validate
//   - maxLength: The maximum number of characters allowed
//   - contentType: A descriptive name for the content type (used in error messages)
//
// Returns an error if the content exceeds maxLength, nil otherwise.
func validateContentLength(content string, maxLength int, contentType string) error {
	// Count Unicode characters, not bytes
	// This correctly handles emoji and other multi-byte UTF-8 characters
	charCount := utf8.RuneCountInString(content)

	if charCount > maxLength {
		return fmt.Errorf(
			"%s content exceeds maximum length of %d characters (submitted: %d)",
			contentType,
			maxLength,
			charCount,
		)
	}

	return nil
}
