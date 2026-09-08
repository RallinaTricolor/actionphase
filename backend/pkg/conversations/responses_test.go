package conversations

import (
	"encoding/json"
	"testing"
	"time"

	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests pin the JSON wire shape of the response DTOs. The DTOs exist to
// keep the emitted JSON identical to what the embedded sqlc models produced
// while giving huma a schema of scalars instead of pgtype wrapper objects, so
// the thing worth asserting is the marshalled bytes, not the Go field values.

var (
	testTime  = time.Date(2026, 3, 4, 5, 6, 7, 0, time.UTC)
	testTime2 = time.Date(2026, 3, 5, 6, 7, 8, 0, time.UTC)
)

func ts(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

// marshalToMap marshals v and decodes it back into a generic map so tests can
// assert on exact keys and values, including explicit nulls.
func marshalToMap(t *testing.T, v any) map[string]any {
	t.Helper()
	raw, err := json.Marshal(v)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(raw, &m))
	return m
}

func TestToConversationResponse(t *testing.T) {
	t.Run("nil input returns nil", func(t *testing.T) {
		assert.Nil(t, toConversationResponse(nil))
	})

	t.Run("null title marshals as explicit null, not a wrapper object", func(t *testing.T) {
		m := marshalToMap(t, toConversationResponse(&models.Conversation{
			ID: 1, GameID: 2, ConversationType: "private", CreatedByUserID: 3,
			CreatedAt: ts(testTime), UpdatedAt: ts(testTime2),
		}))

		require.Contains(t, m, "title")
		assert.Nil(t, m["title"], "a NULL title must stay an explicit null key")
		assert.Equal(t, "2026-03-04T05:06:07Z", m["created_at"])
		assert.Equal(t, "2026-03-05T06:07:08Z", m["updated_at"])
	})

	t.Run("populated title marshals as a bare string", func(t *testing.T) {
		m := marshalToMap(t, toConversationResponse(&models.Conversation{
			ID: 1, Title: pgtype.Text{String: "Plans", Valid: true},
			CreatedAt: ts(testTime), UpdatedAt: ts(testTime),
		}))
		assert.Equal(t, "Plans", m["title"])
	})
}

func TestToConversationParticipantResponses(t *testing.T) {
	t.Run("nil in nil out, so the key can still render as null", func(t *testing.T) {
		assert.Nil(t, toConversationParticipantResponses(nil))
	})

	t.Run("empty stays empty rather than becoming null", func(t *testing.T) {
		got := toConversationParticipantResponses([]models.GetConversationParticipantsRow{})
		require.NotNil(t, got)
		assert.Len(t, got, 0)
	})

	t.Run("nullable joins marshal as scalars or null", func(t *testing.T) {
		rows := []models.GetConversationParticipantsRow{
			{ID: 1, ConversationID: 2, UserID: 3, Username: "alice",
				JoinedAt: ts(testTime), LastReadAt: ts(testTime)},
			{ID: 2, ConversationID: 2, UserID: 4, Username: "bob",
				CharacterID:   pgtype.Int4{Int32: 77, Valid: true},
				CharacterName: pgtype.Text{String: "Rook", Valid: true},
				JoinedAt:      ts(testTime), LastReadAt: ts(testTime)},
		}
		got := toConversationParticipantResponses(rows)
		require.Len(t, got, 2)

		first := marshalToMap(t, got[0])
		assert.Nil(t, first["character_id"])
		assert.Nil(t, first["character_name"])
		assert.Equal(t, "alice", first["username"])

		second := marshalToMap(t, got[1])
		assert.Equal(t, float64(77), second["character_id"])
		assert.Equal(t, "Rook", second["character_name"])
	})
}

func TestToPrivateMessageResponse(t *testing.T) {
	t.Run("nil input returns nil", func(t *testing.T) {
		assert.Nil(t, toPrivateMessageResponse(nil))
	})

	t.Run("an unedited, undeleted message emits explicit nulls", func(t *testing.T) {
		m := marshalToMap(t, toPrivateMessageResponse(&models.PrivateMessage{
			ID: 1, ConversationID: 2, SenderUserID: 3, Content: "hi",
			CreatedAt: ts(testTime), UpdatedAt: ts(testTime),
			IsDeleted: pgtype.Bool{Bool: false, Valid: true},
		}))

		assert.Nil(t, m["deleted_at"])
		assert.Nil(t, m["edited_at"])
		assert.Nil(t, m["sender_character_id"])
		assert.Equal(t, false, m["is_deleted"])
		assert.Equal(t, false, m["is_edited"])
		assert.Equal(t, float64(0), m["edit_count"])
	})

	t.Run("edit and delete timestamps flatten to date-time strings", func(t *testing.T) {
		m := marshalToMap(t, toPrivateMessageResponse(&models.PrivateMessage{
			ID: 1, Content: "hi",
			CreatedAt: ts(testTime), UpdatedAt: ts(testTime2),
			DeletedAt: ts(testTime2), EditedAt: ts(testTime2),
			IsDeleted: pgtype.Bool{Bool: true, Valid: true},
			IsEdited:  true, EditCount: 2,
			SenderCharacterID: pgtype.Int4{Int32: 9, Valid: true},
		}))

		assert.Equal(t, "2026-03-05T06:07:08Z", m["deleted_at"])
		assert.Equal(t, "2026-03-05T06:07:08Z", m["edited_at"])
		assert.Equal(t, true, m["is_deleted"])
		assert.Equal(t, float64(9), m["sender_character_id"])
	})
}

func TestToConversationMessageResponses(t *testing.T) {
	t.Run("nil in nil out", func(t *testing.T) {
		assert.Nil(t, toConversationMessageResponses(nil))
	})

	t.Run("empty slice survives so the messages key renders as []", func(t *testing.T) {
		got := toConversationMessageResponses([]models.GetConversationMessagesRow{})
		require.NotNil(t, got)
		assert.Len(t, got, 0)
	})

	t.Run("joined sender columns marshal as scalars or null", func(t *testing.T) {
		got := toConversationMessageResponses([]models.GetConversationMessagesRow{
			{ID: 1, ConversationID: 2, SenderUserID: 3, Content: "hi",
				CreatedAt: ts(testTime), UpdatedAt: ts(testTime),
				IsDeleted: pgtype.Bool{Bool: false, Valid: true}, SenderUsername: "alice"},
			{ID: 2, ConversationID: 2, SenderUserID: 4, Content: "yo",
				CreatedAt: ts(testTime), UpdatedAt: ts(testTime),
				IsDeleted: pgtype.Bool{Bool: false, Valid: true}, SenderUsername: "bob",
				SenderCharacterName: pgtype.Text{String: "Rook", Valid: true},
				SenderAvatarUrl:     pgtype.Text{String: "/a.png", Valid: true}},
		})
		require.Len(t, got, 2)

		first := marshalToMap(t, got[0])
		assert.Nil(t, first["sender_character_name"])
		assert.Nil(t, first["sender_avatar_url"])

		second := marshalToMap(t, got[1])
		assert.Equal(t, "Rook", second["sender_character_name"])
		assert.Equal(t, "/a.png", second["sender_avatar_url"])
	})
}

func TestConversationListItems(t *testing.T) {
	// Both list queries return the same field set. These assert the two
	// converters agree, so the unread filter cannot drift into a second shape.

	t.Run("empty results marshal as [] rather than null", func(t *testing.T) {
		full := toConversationListItems(nil)
		unread := toUnreadConversationListItems(nil)
		require.NotNil(t, full)
		require.NotNil(t, unread)

		raw, err := json.Marshal(full)
		require.NoError(t, err)
		assert.Equal(t, "[]", string(raw))
	})

	t.Run("both converters produce identical JSON for the same row", func(t *testing.T) {
		full := toConversationListItems([]models.GetUserConversationsRow{{
			ID: 1, GameID: 2, ConversationType: "private", CreatedByUserID: 3,
			CreatedAt: ts(testTime), UpdatedAt: ts(testTime2),
			ParticipantCount: 2, LastMessage: "hi", LastMessageAt: ts(testTime2),
			ParticipantNames: "alice, bob", UnreadCount: 5,
			LastReadMessageID: pgtype.Int4{Int32: 42, Valid: true},
			LastReadAt:        ts(testTime),
		}})
		unread := toUnreadConversationListItems([]models.GetUserUnreadConversationsRow{{
			ID: 1, GameID: 2, ConversationType: "private", CreatedByUserID: 3,
			CreatedAt: ts(testTime), UpdatedAt: ts(testTime2),
			ParticipantCount: 2, LastMessage: "hi", LastMessageAt: ts(testTime2),
			ParticipantNames: "alice, bob", UnreadCount: 5,
			LastReadMessageID: pgtype.Int4{Int32: 42, Valid: true},
			LastReadAt:        ts(testTime),
		}})

		fullJSON, err := json.Marshal(full)
		require.NoError(t, err)
		unreadJSON, err := json.Marshal(unread)
		require.NoError(t, err)
		assert.JSONEq(t, string(fullJSON), string(unreadJSON),
			"the unread list must not present a different shape than the full list")
	})

	t.Run("unread_count is exposed under its documented key", func(t *testing.T) {
		// Regression: the unread query selected `unread.unread_count` without an
		// alias, so sqlc named the column unread_unread_count and the field was
		// absent from the JSON the dashboard preview reads.
		got := toUnreadConversationListItems([]models.GetUserUnreadConversationsRow{{
			ID: 1, UnreadCount: 7, CreatedAt: ts(testTime), UpdatedAt: ts(testTime),
		}})
		require.Len(t, got, 1)

		m := marshalToMap(t, got[0])
		require.Contains(t, m, "unread_count")
		assert.Equal(t, float64(7), m["unread_count"])
		assert.NotContains(t, m, "unread_unread_count")
	})

	t.Run("a never-read conversation emits explicit nulls", func(t *testing.T) {
		got := toConversationListItems([]models.GetUserConversationsRow{{
			ID: 1, CreatedAt: ts(testTime), UpdatedAt: ts(testTime),
		}})
		require.Len(t, got, 1)

		m := marshalToMap(t, got[0])
		assert.Nil(t, m["title"])
		assert.Nil(t, m["last_message_at"])
		assert.Nil(t, m["last_read_message_id"])
		assert.Nil(t, m["last_read_at"])
	})
}
