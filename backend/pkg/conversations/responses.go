package conversations

import (
	"time"

	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
)

// Hand-written response DTOs for the conversation endpoints.
//
// These replace the sqlc models the response bodies used to expose directly.
// pgtype marshals to clean scalars at runtime, but huma builds its OpenAPI
// schemas by reflecting over Go fields, so every nullable column was documented
// as a {Valid, ...} wrapper object rather than a scalar or null.
//
// As in pkg/polls, nullable columns are *T *without* omitempty: the current
// output emits explicit nulls (`deleted_at: null`, `sender_avatar_url: null`)
// and dropping those keys would be a wire change. Columns that are NOT NULL in
// the schema use plain value types even where sqlc wrapped them, which it does
// for every timestamptz regardless of nullability.

// ConversationResponse is a conversation row.
type ConversationResponse struct {
	ID               int32     `json:"id"`
	GameID           int32     `json:"game_id"`
	ConversationType string    `json:"conversation_type"`
	Title            *string   `json:"title"`
	CreatedByUserID  int32     `json:"created_by_user_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// ConversationParticipantResponse is one participant, joined with their user and
// character names.
type ConversationParticipantResponse struct {
	ID             int32     `json:"id"`
	ConversationID int32     `json:"conversation_id"`
	UserID         int32     `json:"user_id"`
	CharacterID    *int32    `json:"character_id"`
	JoinedAt       time.Time `json:"joined_at"`
	LastReadAt     time.Time `json:"last_read_at"`
	Username       string    `json:"username"`
	CharacterName  *string   `json:"character_name"`
}

// PrivateMessageResponse is a message row as returned by the send and update
// endpoints, which render the bare row without the joined sender columns.
type PrivateMessageResponse struct {
	ID                int32      `json:"id"`
	ConversationID    int32      `json:"conversation_id"`
	SenderUserID      int32      `json:"sender_user_id"`
	SenderCharacterID *int32     `json:"sender_character_id"`
	Content           string     `json:"content"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	DeletedAt         *time.Time `json:"deleted_at"`
	IsDeleted         bool       `json:"is_deleted"`
	IsEdited          bool       `json:"is_edited"`
	EditedAt          *time.Time `json:"edited_at"`
	EditCount         int32      `json:"edit_count"`
}

// ConversationMessageResponse is a message as returned by the thread endpoint,
// which joins the sender's username, character name and avatar onto the row.
type ConversationMessageResponse struct {
	ID                  int32      `json:"id"`
	ConversationID      int32      `json:"conversation_id"`
	SenderUserID        int32      `json:"sender_user_id"`
	SenderCharacterID   *int32     `json:"sender_character_id"`
	Content             string     `json:"content"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
	DeletedAt           *time.Time `json:"deleted_at"`
	IsDeleted           bool       `json:"is_deleted"`
	IsEdited            bool       `json:"is_edited"`
	EditedAt            *time.Time `json:"edited_at"`
	EditCount           int32      `json:"edit_count"`
	SenderUsername      string     `json:"sender_username"`
	SenderCharacterName *string    `json:"sender_character_name"`
	SenderAvatarUrl     *string    `json:"sender_avatar_url"`
}

func toConversationResponse(c *models.Conversation) *ConversationResponse {
	if c == nil {
		return nil
	}
	r := &ConversationResponse{
		ID:               c.ID,
		GameID:           c.GameID,
		ConversationType: c.ConversationType,
		CreatedByUserID:  c.CreatedByUserID,
		CreatedAt:        c.CreatedAt.Time,
		UpdatedAt:        c.UpdatedAt.Time,
	}
	if c.Title.Valid {
		title := c.Title.String
		r.Title = &title
	}
	return r
}

// toConversationParticipantResponses preserves nil vs empty so the participants
// key keeps whatever the handler built.
func toConversationParticipantResponses(rows []models.GetConversationParticipantsRow) []ConversationParticipantResponse {
	if rows == nil {
		return nil
	}
	out := make([]ConversationParticipantResponse, len(rows))
	for i, p := range rows {
		out[i] = ConversationParticipantResponse{
			ID:             p.ID,
			ConversationID: p.ConversationID,
			UserID:         p.UserID,
			JoinedAt:       p.JoinedAt.Time,
			LastReadAt:     p.LastReadAt.Time,
			Username:       p.Username,
		}
		if p.CharacterID.Valid {
			charID := p.CharacterID.Int32
			out[i].CharacterID = &charID
		}
		if p.CharacterName.Valid {
			name := p.CharacterName.String
			out[i].CharacterName = &name
		}
	}
	return out
}

func toPrivateMessageResponse(m *models.PrivateMessage) *PrivateMessageResponse {
	if m == nil {
		return nil
	}
	r := &PrivateMessageResponse{
		ID:             m.ID,
		ConversationID: m.ConversationID,
		SenderUserID:   m.SenderUserID,
		Content:        m.Content,
		CreatedAt:      m.CreatedAt.Time,
		UpdatedAt:      m.UpdatedAt.Time,
		IsDeleted:      m.IsDeleted.Bool,
		IsEdited:       m.IsEdited,
		EditCount:      m.EditCount,
	}
	if m.SenderCharacterID.Valid {
		charID := m.SenderCharacterID.Int32
		r.SenderCharacterID = &charID
	}
	if m.DeletedAt.Valid {
		deletedAt := m.DeletedAt.Time
		r.DeletedAt = &deletedAt
	}
	if m.EditedAt.Valid {
		editedAt := m.EditedAt.Time
		r.EditedAt = &editedAt
	}
	return r
}

// toConversationMessageResponses preserves nil vs empty: the handler
// deliberately substitutes an empty slice so the messages key renders as [].
func toConversationMessageResponses(rows []models.GetConversationMessagesRow) []ConversationMessageResponse {
	if rows == nil {
		return nil
	}
	out := make([]ConversationMessageResponse, len(rows))
	for i, m := range rows {
		out[i] = ConversationMessageResponse{
			ID:             m.ID,
			ConversationID: m.ConversationID,
			SenderUserID:   m.SenderUserID,
			Content:        m.Content,
			CreatedAt:      m.CreatedAt.Time,
			UpdatedAt:      m.UpdatedAt.Time,
			IsDeleted:      m.IsDeleted.Bool,
			IsEdited:       m.IsEdited,
			EditCount:      m.EditCount,
			SenderUsername: m.SenderUsername,
		}
		if m.SenderCharacterID.Valid {
			charID := m.SenderCharacterID.Int32
			out[i].SenderCharacterID = &charID
		}
		if m.DeletedAt.Valid {
			deletedAt := m.DeletedAt.Time
			out[i].DeletedAt = &deletedAt
		}
		if m.EditedAt.Valid {
			editedAt := m.EditedAt.Time
			out[i].EditedAt = &editedAt
		}
		if m.SenderCharacterName.Valid {
			name := m.SenderCharacterName.String
			out[i].SenderCharacterName = &name
		}
		if m.SenderAvatarUrl.Valid {
			url := m.SenderAvatarUrl.String
			out[i].SenderAvatarUrl = &url
		}
	}
	return out
}

// ConversationListItemResponse is a conversation as it appears in the list
// endpoints, joined with participant/last-message summary columns and the
// caller's unread state.
//
// GetUserConversationsRow and GetUserUnreadConversationsRow have the same field
// set, so both list variants share this type and the endpoint documents one
// schema instead of an untyped `any`.
type ConversationListItemResponse struct {
	ID                int32      `json:"id"`
	GameID            int32      `json:"game_id"`
	ConversationType  string     `json:"conversation_type"`
	Title             *string    `json:"title"`
	CreatedByUserID   int32      `json:"created_by_user_id"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	ParticipantCount  int64      `json:"participant_count"`
	LastMessage       string     `json:"last_message"`
	LastMessageAt     *time.Time `json:"last_message_at"`
	ParticipantNames  string     `json:"participant_names"`
	UnreadCount       int64      `json:"unread_count"`
	LastReadMessageID *int32     `json:"last_read_message_id"`
	LastReadAt        *time.Time `json:"last_read_at"`
}

// toConversationListItems converts the full conversation list rows.
func toConversationListItems(rows []models.GetUserConversationsRow) []ConversationListItemResponse {
	out := make([]ConversationListItemResponse, 0, len(rows))
	for _, c := range rows {
		out = append(out, newConversationListItem(conversationListFields{
			ID:                c.ID,
			GameID:            c.GameID,
			ConversationType:  c.ConversationType,
			Title:             c.Title,
			CreatedByUserID:   c.CreatedByUserID,
			CreatedAt:         c.CreatedAt,
			UpdatedAt:         c.UpdatedAt,
			ParticipantCount:  c.ParticipantCount,
			LastMessage:       c.LastMessage,
			LastMessageAt:     c.LastMessageAt,
			ParticipantNames:  c.ParticipantNames,
			UnreadCount:       c.UnreadCount,
			LastReadMessageID: c.LastReadMessageID,
			LastReadAt:        c.LastReadAt,
		}))
	}
	return out
}

// toUnreadConversationListItems converts the unread-only list rows.
func toUnreadConversationListItems(rows []models.GetUserUnreadConversationsRow) []ConversationListItemResponse {
	out := make([]ConversationListItemResponse, 0, len(rows))
	for _, c := range rows {
		out = append(out, newConversationListItem(conversationListFields{
			ID:                c.ID,
			GameID:            c.GameID,
			ConversationType:  c.ConversationType,
			Title:             c.Title,
			CreatedByUserID:   c.CreatedByUserID,
			CreatedAt:         c.CreatedAt,
			UpdatedAt:         c.UpdatedAt,
			ParticipantCount:  c.ParticipantCount,
			LastMessage:       c.LastMessage,
			LastMessageAt:     c.LastMessageAt,
			ParticipantNames:  c.ParticipantNames,
			UnreadCount:       c.UnreadCount,
			LastReadMessageID: c.LastReadMessageID,
			LastReadAt:        c.LastReadAt,
		}))
	}
	return out
}

// conversationListFields is the shared column set of the two list row types.
type conversationListFields struct {
	ID                int32
	GameID            int32
	ConversationType  string
	Title             pgtype.Text
	CreatedByUserID   int32
	CreatedAt         pgtype.Timestamptz
	UpdatedAt         pgtype.Timestamptz
	ParticipantCount  int64
	LastMessage       string
	LastMessageAt     pgtype.Timestamptz
	ParticipantNames  string
	UnreadCount       int64
	LastReadMessageID pgtype.Int4
	LastReadAt        pgtype.Timestamptz
}

func newConversationListItem(f conversationListFields) ConversationListItemResponse {
	r := ConversationListItemResponse{
		ID:               f.ID,
		GameID:           f.GameID,
		ConversationType: f.ConversationType,
		CreatedByUserID:  f.CreatedByUserID,
		CreatedAt:        f.CreatedAt.Time,
		UpdatedAt:        f.UpdatedAt.Time,
		ParticipantCount: f.ParticipantCount,
		LastMessage:      f.LastMessage,
		ParticipantNames: f.ParticipantNames,
		UnreadCount:      f.UnreadCount,
	}
	if f.Title.Valid {
		title := f.Title.String
		r.Title = &title
	}
	if f.LastMessageAt.Valid {
		at := f.LastMessageAt.Time
		r.LastMessageAt = &at
	}
	if f.LastReadMessageID.Valid {
		id := f.LastReadMessageID.Int32
		r.LastReadMessageID = &id
	}
	if f.LastReadAt.Valid {
		at := f.LastReadAt.Time
		r.LastReadAt = &at
	}
	return r
}
