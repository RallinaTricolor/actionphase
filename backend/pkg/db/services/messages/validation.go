package messages

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"

	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
)

// ValidateCharacterOwnership verifies character belongs to author and game
func (s *MessageService) ValidateCharacterOwnership(ctx context.Context, characterID, authorID, gameID int32) error {
	queries := models.New(s.DB)

	// Get the character to verify ownership
	character, err := queries.GetCharacter(ctx, characterID)
	if err != nil {
		return fmt.Errorf("character not found: %w", err)
	}

	// Verify character belongs to the game
	if character.GameID != gameID {
		return errors.New("character does not belong to this game")
	}

	// Check if this is a player character owned by the author
	if character.UserID.Valid && character.UserID.Int32 == authorID {
		return nil
	}

	// Check if this is an NPC (GM or audience controlled)
	if character.CharacterType == "npc_gm" || character.CharacterType == "npc_audience" {
		// Check if user is assigned to this NPC
		assignment, err := queries.GetNPCAssignment(ctx, characterID)
		if err == nil && assignment.AssignedUserID == authorID {
			return nil
		}

		// Check if user is the GM (GMs can post as any NPC, even assigned ones, for emergency situations)
		game, err := queries.GetGame(ctx, gameID)
		if err != nil {
			return fmt.Errorf("failed to get game: %w", err)
		}

		if game.GmUserID == authorID {
			// GM can always post as any NPC in their game
			return nil
		}
	}

	return errors.New("character does not belong to this user")
}

// notifyCharacterMentions triggers notifications for all characters mentioned in a message
// This runs in a goroutine and should not fail the parent operation
func (s *MessageService) notifyCharacterMentions(ctx context.Context, mentionedCharacterIDs []int32, authorCharacterID, authorUserID, gameID, messageID int32) {
	if len(mentionedCharacterIDs) == 0 {
		return
	}

	queries := models.New(s.DB)
	notificationService := &db.NotificationService{DB: s.DB}

	// Get the author character's name
	authorChar, err := queries.GetCharacter(ctx, authorCharacterID)
	if err != nil {
		slog.Error("Failed to get author character for mention notifications", "error", err, "character_id", authorCharacterID)
		return
	}

	// For each mentioned character, notify the owner
	for _, mentionedCharID := range mentionedCharacterIDs {
		mentionedChar, err := queries.GetCharacter(ctx, mentionedCharID)
		if err != nil {
			slog.Error("Failed to get mentioned character", "error", err, "character_id", mentionedCharID)
			continue
		}

		// Don't notify if user is mentioning their own character
		var characterOwnerID int32
		if mentionedChar.UserID.Valid {
			characterOwnerID = mentionedChar.UserID.Int32
		} else {
			// NPC - notify the GM
			game, err := queries.GetGame(ctx, gameID)
			if err != nil {
				slog.Error("Failed to get game for NPC mention notification", "error", err, "game_id", gameID)
				continue
			}
			characterOwnerID = game.GmUserID
		}

		// Skip if author is the character owner (don't notify self)
		if characterOwnerID == authorUserID {
			continue
		}

		// Trigger notification
		err = notificationService.NotifyCharacterMention(
			ctx,
			characterOwnerID,
			messageID,
			gameID,
			authorChar.Name,
			mentionedChar.Name,
		)
		if err != nil {
			slog.Error("Failed to send character mention notification", "error", err, "mentioned_character_id", mentionedCharID)
		}
	}
}

// notifyCommentReply triggers a notification when someone replies to a comment
// This runs in a goroutine and should not fail the parent operation
func (s *MessageService) notifyCommentReply(ctx context.Context, parentMessageID, replierCharacterID, replierUserID, gameID, replyMessageID int32) {
	queries := models.New(s.DB)
	notificationService := &db.NotificationService{DB: s.DB}

	// Get the parent message
	parentMessage, err := queries.GetComment(ctx, parentMessageID)
	if err != nil {
		slog.Error("Failed to get parent message for reply notification", "error", err, "parent_id", parentMessageID)
		return
	}

	// Don't notify if replying to own comment
	if parentMessage.AuthorID == replierUserID {
		return
	}

	// Get the replier character's name
	replierChar, err := queries.GetCharacter(ctx, replierCharacterID)
	if err != nil {
		slog.Error("Failed to get replier character", "error", err, "character_id", replierCharacterID)
		return
	}

	// Trigger notification to the parent comment author
	err = notificationService.NotifyCommentReply(
		ctx,
		parentMessage.AuthorID,
		replyMessageID,
		gameID,
		replierChar.Name,
	)
	if err != nil {
		slog.Error("Failed to send comment reply notification", "error", err, "parent_author_id", parentMessage.AuthorID)
	}
}

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
