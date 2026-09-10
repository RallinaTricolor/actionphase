package messages

import (
	"time"

	"actionphase/pkg/core"
)

type Handler struct {
	App            *core.App
	UserService    core.UserServiceInterface
	MessageService core.MessageServiceInterface
}

// Request bodies live in requests.go; the other response bodies in
// responses.go. This file holds the message detail shape and the converters
// that build it.

// Response Types

type MessageResponse struct {
	ID                    int32      `json:"id"`
	GameID                int32      `json:"game_id"`
	PhaseID               *int32     `json:"phase_id,omitempty"`
	AuthorID              int32      `json:"author_id"`
	CharacterID           int32      `json:"character_id"`
	Content               string     `json:"content"`
	MessageType           string     `json:"message_type"`
	ParentID              *int32     `json:"parent_id,omitempty"`
	ThreadDepth           int32      `json:"thread_depth"`
	AuthorUsername        string     `json:"author_username"`
	CharacterName         string     `json:"character_name"`
	CharacterAvatarUrl    *string    `json:"character_avatar_url,omitempty"`
	CommentCount          int64      `json:"comment_count"` // Always include, even if 0
	ReplyCount            int64      `json:"reply_count,omitempty"`
	IsEdited              bool       `json:"is_edited"`
	IsDeleted             bool       `json:"is_deleted"`
	IsDraft               bool       `json:"is_draft"`
	MentionedCharacterIds []int32    `json:"mentioned_character_ids,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	DeletedAt             *time.Time `json:"deleted_at,omitempty"`
	DeletedByUserID       *int32     `json:"deleted_by_user_id,omitempty"`
	EditedAt              *time.Time `json:"edited_at,omitempty"`
	EditCount             int32      `json:"edit_count"`
}

// MessageThreadContextResponse is the payload for deep-linking to a nested comment:
// the target plus a bounded slice of its ancestors, and the true root post ID.
type MessageThreadContextResponse struct {
	// Chain is the target comment plus up to max_parents nearest ancestors,
	// ordered parent-to-child (nearest included ancestor → target).
	Chain []*MessageResponse `json:"chain"`
	// RootPostID is the top-level post at the head of the full thread, even when
	// Chain is trimmed and does not itself reach the root.
	RootPostID int32 `json:"root_post_id"`
	// HasFullThread is true when Chain reaches the root post (nothing trimmed above).
	HasFullThread bool `json:"has_full_thread"`
}

// messageWithDetailsToResponse converts a MessageWithDetails to a MessageResponse.
func messageWithDetailsToResponse(msg *core.MessageWithDetails) *MessageResponse {
	response := &MessageResponse{
		ID:                    msg.ID,
		GameID:                msg.GameID,
		AuthorID:              msg.AuthorID,
		CharacterID:           msg.CharacterID,
		Content:               msg.Content,
		MessageType:           string(msg.MessageType),
		ThreadDepth:           msg.ThreadDepth,
		AuthorUsername:        msg.AuthorUsername,
		CharacterName:         msg.CharacterName,
		CharacterAvatarUrl:    msg.CharacterAvatarUrl,
		IsEdited:              msg.IsEdited,
		IsDeleted:             msg.IsDeleted,
		IsDraft:               msg.IsDraft,
		MentionedCharacterIds: msg.MentionedCharacterIds,
		CreatedAt:             msg.CreatedAt.Time,
		EditCount:             msg.EditCount,
	}

	if msg.PhaseID.Valid {
		phaseID := msg.PhaseID.Int32
		response.PhaseID = &phaseID
	}

	if msg.ParentID.Valid {
		parentID := msg.ParentID.Int32
		response.ParentID = &parentID
	}

	if msg.DeletedAt.Valid {
		deletedAt := msg.DeletedAt.Time
		response.DeletedAt = &deletedAt
	}

	if msg.DeletedByUserID.Valid {
		deletedByUserID := msg.DeletedByUserID.Int32
		response.DeletedByUserID = &deletedByUserID
	}

	if msg.EditedAt.Valid {
		editedAt := msg.EditedAt.Time
		response.EditedAt = &editedAt
	}

	// Set either CommentCount or ReplyCount depending on message type
	if string(msg.MessageType) == "post" {
		response.CommentCount = msg.CommentCount
	} else {
		response.ReplyCount = msg.ReplyCount
	}

	return response
}

// countTopLevelInResponse counts how many top-level comments (depth=0) are in the response.
func countTopLevelInResponse(comments []core.CommentWithDepth) int {
	count := 0
	for _, c := range comments {
		if c.Depth == 0 {
			count++
		}
	}
	return count
}

// commentsWithParentsToResponse converts comment rows into the "New Comments"
// response shape.
//
// showUsernames false blanks the author to "" rather than dropping the key,
// which is what the chi handler did and what the frontend's non-optional
// author_username field expects. Note the parent's username is blanked to an
// empty string here, where the character-feed endpoint nils it instead -- two
// spellings of the same rule, both preserved as they were.
func commentsWithParentsToResponse(comments []core.CommentWithParent, showUsernames bool) []*CommentWithParentResponse {
	result := make([]*CommentWithParentResponse, len(comments))
	for i := range comments {
		c := &comments[i]
		item := &CommentWithParentResponse{
			ID:                 c.ID,
			GameID:             c.GameID,
			ParentID:           c.ParentID,
			PostID:             c.PostID,
			AuthorID:           c.AuthorID,
			CharacterID:        c.CharacterID,
			Content:            c.Content,
			CreatedAt:          c.CreatedAt.Format(time.RFC3339),
			EditedAt:           formatTimePtr(c.EditedAt),
			EditCount:          c.EditCount,
			DeletedAt:          formatTimePtr(c.DeletedAt),
			IsDeleted:          c.IsDeleted,
			AuthorUsername:     blankIfHidden(c.AuthorUsername, showUsernames),
			CharacterName:      c.CharacterName,
			CharacterAvatarURL: c.CharacterAvatarUrl,
		}

		if c.ParentContent != nil {
			parentAuthor := c.ParentAuthorUsername
			if !showUsernames {
				empty := ""
				parentAuthor = &empty
			}
			item.Parent = &ParentContextResponse{
				Content:            c.ParentContent,
				CreatedAt:          formatTimePtr(c.ParentCreatedAt),
				DeletedAt:          formatTimePtr(c.ParentDeletedAt),
				IsDeleted:          c.ParentIsDeleted,
				MessageType:        c.ParentMessageType,
				AuthorUsername:     parentAuthor,
				CharacterName:      c.ParentCharacterName,
				CharacterAvatarURL: c.ParentCharacterAvatarUrl,
			}
		}

		result[i] = item
	}
	return result
}

// favoriteCommentsToResponse converts the favorites listing to its wire shape.
//
// showUsernames is resolved per game rather than once for the whole page: the
// list is cross-game, so one response can mix an anonymous game (where a
// player may not see who is behind a character) with a normal one. Callers
// pass a lookup keyed by game ID, built once per request, so a page of N
// favorites spanning M games costs M game reads rather than N.
func favoriteCommentsToResponse(favorites []*core.FavoriteComment, showUsernamesByGame map[int32]bool) []*FavoriteCommentResponse {
	result := make([]*FavoriteCommentResponse, len(favorites))
	for i, f := range favorites {
		showUsernames := showUsernamesByGame[f.GameID]

		item := &FavoriteCommentResponse{
			ID:                 f.ID,
			GameID:             f.GameID,
			GameTitle:          f.GameTitle,
			ParentID:           f.ParentID,
			PostID:             f.PostID,
			AuthorID:           f.AuthorID,
			CharacterID:        f.CharacterID,
			Content:            f.Content,
			CreatedAt:          f.CreatedAt.Format(time.RFC3339),
			EditedAt:           formatTimePtr(f.EditedAt),
			EditCount:          f.EditCount,
			DeletedAt:          formatTimePtr(f.DeletedAt),
			IsDeleted:          f.IsDeleted,
			AuthorUsername:     blankIfHidden(f.AuthorUsername, showUsernames),
			CharacterName:      f.CharacterName,
			CharacterAvatarURL: f.CharacterAvatarUrl,
			FavoritedAt:        f.FavoritedAt.Format(time.RFC3339),
		}

		if f.ParentContent != nil {
			parentAuthor := f.ParentAuthorUsername
			if !showUsernames {
				empty := ""
				parentAuthor = &empty
			}
			item.Parent = &ParentContextResponse{
				Content:            f.ParentContent,
				CreatedAt:          formatTimePtr(f.ParentCreatedAt),
				DeletedAt:          formatTimePtr(f.ParentDeletedAt),
				IsDeleted:          f.ParentIsDeleted,
				MessageType:        f.ParentMessageType,
				AuthorUsername:     parentAuthor,
				CharacterName:      f.ParentCharacterName,
				CharacterAvatarURL: f.ParentCharacterAvatarUrl,
			}
		}

		result[i] = item
	}
	return result
}
