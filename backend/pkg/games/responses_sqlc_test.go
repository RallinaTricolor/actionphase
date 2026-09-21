package games

import (
	"encoding/json"
	"testing"
	"time"

	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests pin the JSON wire shape of the game response DTOs, which replaced
// embedded sqlc models so huma documents scalars rather than pgtype wrapper
// objects. Each parity test marshals the sqlc model the DTO replaced and
// requires byte equality.

var sqlcTestTime = time.Date(2026, 3, 4, 5, 6, 7, 0, time.UTC)

func sqlcTS(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

func sqlcMarshalToMap(t *testing.T, v any) map[string]any {
	t.Helper()
	raw, err := json.Marshal(v)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(raw, &m))
	return m
}

func TestToGameParticipantResponse(t *testing.T) {
	t.Run("nil input returns nil", func(t *testing.T) {
		assert.Nil(t, toGameParticipantResponse(nil))
	})

	t.Run("matches the sqlc model it replaced", func(t *testing.T) {
		p := models.GameParticipant{
			ID: 1, GameID: 2, UserID: 3, Role: "player",
			Status:   "active",
			JoinedAt: sqlcTS(sqlcTestTime),
		}
		want, err := json.Marshal(p)
		require.NoError(t, err)

		got, err := json.Marshal(toGameParticipantResponse(&p))
		require.NoError(t, err)

		assert.Equal(t, string(want), string(got))
	})

	t.Run("an active participant emits explicit nulls for removal fields", func(t *testing.T) {
		m := sqlcMarshalToMap(t, toGameParticipantResponse(&models.GameParticipant{
			ID: 1, GameID: 2, UserID: 3, Role: "player",
			Status:   "active",
			JoinedAt: sqlcTS(sqlcTestTime),
		}))

		assert.Equal(t, "active", m["status"])
		assert.Nil(t, m["removed_at"])
		assert.Nil(t, m["removed_by_user_id"])
		assert.Equal(t, false, m["is_former_player"])
	})

	t.Run("a removed participant carries the removal metadata", func(t *testing.T) {
		m := sqlcMarshalToMap(t, toGameParticipantResponse(&models.GameParticipant{
			ID: 1, GameID: 2, UserID: 3, Role: "player",
			Status:          "removed",
			JoinedAt:        sqlcTS(sqlcTestTime),
			RemovedAt:       sqlcTS(sqlcTestTime),
			RemovedByUserID: pgtype.Int4{Int32: 77, Valid: true},
			IsFormerPlayer:  true,
		}))

		assert.Equal(t, "2026-03-04T05:06:07Z", m["removed_at"])
		assert.Equal(t, float64(77), m["removed_by_user_id"])
		assert.Equal(t, true, m["is_former_player"])
	})
}

func TestToGameLootTableResponse(t *testing.T) {
	t.Run("nil input returns nil", func(t *testing.T) {
		assert.Nil(t, toGameLootTableResponse(nil))
	})

	t.Run("matches the sqlc model it replaced", func(t *testing.T) {
		tbl := models.GameLootTable{
			ID: 1, GameID: 2, Name: "Common",
			CreatedAt: sqlcTS(sqlcTestTime), UpdatedAt: sqlcTS(sqlcTestTime),
		}
		want, err := json.Marshal(tbl)
		require.NoError(t, err)

		got, err := json.Marshal(toGameLootTableResponse(&tbl))
		require.NoError(t, err)

		assert.Equal(t, string(want), string(got))
	})

	t.Run("timestamps flatten to date-time strings", func(t *testing.T) {
		m := sqlcMarshalToMap(t, toGameLootTableResponse(&models.GameLootTable{
			ID: 1, GameID: 2, Name: "Common",
			CreatedAt: sqlcTS(sqlcTestTime), UpdatedAt: sqlcTS(sqlcTestTime),
		}))

		assert.Equal(t, "2026-03-04T05:06:07Z", m["created_at"])
		assert.Equal(t, "Common", m["name"])
	})
}

func TestToGameLootTableContentResponse(t *testing.T) {
	t.Run("nil input returns nil", func(t *testing.T) {
		assert.Nil(t, toGameLootTableContentResponse(nil))
	})

	t.Run("matches the sqlc model it replaced", func(t *testing.T) {
		c := models.GameLootTableContent{
			ID: 1, LootTableID: 2, Name: "Sword",
			Data: pgtype.Text{String: `{"dmg":3}`, Valid: true},
		}
		want, err := json.Marshal(c)
		require.NoError(t, err)

		got, err := json.Marshal(toGameLootTableContentResponse(&c))
		require.NoError(t, err)

		assert.Equal(t, string(want), string(got))
	})

	t.Run("absent data stays an explicit null", func(t *testing.T) {
		m := sqlcMarshalToMap(t, toGameLootTableContentResponse(&models.GameLootTableContent{
			ID: 1, LootTableID: 2, Name: "Sword",
		}))

		require.Contains(t, m, "data")
		assert.Nil(t, m["data"])
	})
}
