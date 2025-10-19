package db

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"

	models "actionphase/pkg/db/models"
)

// extractCharacterMentions parses content for @CharacterName mentions and returns character IDs.
// It deduplicates mentions and gracefully handles non-existent character names.
// It skips mentions inside code blocks (inline backticks or fenced code blocks).
//
// Strategy: Get all characters in the game, then check if @CharacterName appears in content.
// This approach handles multi-word names correctly (e.g., "Test Player 2 Character").
func (s *MessageService) extractCharacterMentions(ctx context.Context, content string, gameID int32) ([]int32, error) {
	queries := models.New(s.DB)

	// Get all characters in this game
	characters, err := queries.GetCharactersByGame(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game characters: %w", err)
	}

	slog.Info("Extracting mentions", "game_id", gameID, "num_characters", len(characters), "content", content)

	// Remove code blocks before extracting mentions
	// This regex matches:
	// - Fenced code blocks (```lang\ncode\n``` or ```code```)
	// - Inline code (`code`)
	codeBlockRegex := regexp.MustCompile("```[\\s\\S]*?```|`[^`\\n]+?`")
	contentWithoutCode := codeBlockRegex.ReplaceAllString(content, "")

	slog.Info("Content after removing code blocks", "content", contentWithoutCode)

	mentionedIDs := make([]int32, 0)
	seenIDs := make(map[int32]bool)

	// For each character, check if @CharacterName appears in non-code content
	for _, char := range characters {
		// Escape special regex characters in character name
		escapedName := regexp.QuoteMeta(char.Name)

		// Match @CharacterName ensuring @ is not part of another mention
		// Use word boundary \b before @ (or start of string)
		// After the name, use \b or non-alphanumeric (allows punctuation like comma, period)
		mentionPattern := fmt.Sprintf(`(?:^|\s|[^\w@])@%s(?:\s|[^\w]|$)`, escapedName)
		mentionRegex := regexp.MustCompile(mentionPattern)

		matched := mentionRegex.MatchString(contentWithoutCode)
		if matched {
			slog.Info("Matched character mention", "character_name", char.Name, "character_id", char.ID)
			// Deduplicate - only add each character ID once
			if !seenIDs[char.ID] {
				mentionedIDs = append(mentionedIDs, char.ID)
				seenIDs[char.ID] = true
			}
		}
	}

	slog.Info("Mention extraction complete", "num_mentions", len(mentionedIDs), "mentioned_ids", mentionedIDs)

	return mentionedIDs, nil
}

// extractCharacterMentionsWithLogging is a wrapper that adds logging for production use
func (s *MessageService) ExtractCharacterMentions(ctx context.Context, content string, gameID int32) ([]int32, error) {
	mentionedIDs, err := s.extractCharacterMentions(ctx, content, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to extract character mentions: %w", err)
	}
	return mentionedIDs, nil
}
