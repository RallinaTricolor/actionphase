package polls

import (
	"encoding/json"
	"testing"
	"time"

	db "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// These tests pin the JSON wire shape of the poll response DTOs.
//
// The DTOs replaced embedded sqlc models so huma documents scalars instead of
// pgtype wrapper objects, and the emitted JSON was required to stay identical.
// The parity tests below encode that requirement directly: they marshal the old
// embedded-model shape alongside the new DTO and require byte equality.

var testTime = time.Date(2026, 3, 4, 5, 6, 7, 0, time.UTC)

func ts(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

// samplePoll is a poll row as the write path actually produces one: every
// pgtype column Valid, because poll_service.go always sets Valid: true and the
// nullable columns carry DEFAULTs.
func samplePoll() db.CommonRoomPoll {
	return db.CommonRoomPoll{
		ID: 1, GameID: 2, CreatedByUserID: 3, Question: "Which way?",
		PhaseID:                    pgtype.Int4{Int32: 11, Valid: true},
		CreatedByCharacterID:       pgtype.Int4{Int32: 22, Valid: true},
		Description:                pgtype.Text{String: "pick one", Valid: true},
		Deadline:                   ts(testTime),
		ShowIndividualVotes:        pgtype.Bool{Bool: true, Valid: true},
		AllowOtherOption:           pgtype.Bool{Bool: true, Valid: true},
		HideResultsFromPlayers:     false,
		AllowAudienceVoting:        true,
		ShowRunningTotalsToPlayers: true,
		IsDeleted:                  pgtype.Bool{Bool: false, Valid: true},
		CreatedAt:                  ts(testTime),
		UpdatedAt:                  ts(testTime),
	}
}

// nullablePoll is the same row with every nullable column left NULL.
func nullablePoll() db.CommonRoomPoll {
	return db.CommonRoomPoll{ID: 1, GameID: 2, CreatedByUserID: 3, Question: "Which way?"}
}

func marshalToMap(t *testing.T, v any) map[string]any {
	t.Helper()
	raw, err := json.Marshal(v)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(raw, &m))
	return m
}

// legacyPollResponse is the pre-DTO shape: the sqlc model embedded, with the
// extra computed fields alongside it.
type legacyPollResponse struct {
	db.CommonRoomPoll
	Options               []db.PollOption `json:"options"`
	HasVoted              bool            `json:"has_voted,omitempty"`
	UserVoteOptionID      *int32          `json:"user_vote_option_id,omitempty"`
	UserVoteOtherResponse *string         `json:"user_vote_other_response,omitempty"`
}

type legacyPollListItem struct {
	db.CommonRoomPoll
	UserHasVoted bool `json:"user_has_voted"`
}

func TestPollResponseWireParity(t *testing.T) {
	options := []db.PollOption{
		{ID: 9, PollID: 1, OptionText: "left", DisplayOrder: 0, CreatedAt: ts(testTime)},
		{ID: 10, PollID: 1, OptionText: "right", DisplayOrder: 1, CreatedAt: ts(testTime)},
	}

	tests := []struct {
		name    string
		options []db.PollOption
	}{
		// updatePoll returns a poll with no options loaded; the key must stay null.
		{"nil options", nil},
		{"empty options", []db.PollOption{}},
		{"populated options", options},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			want, err := json.Marshal(legacyPollResponse{
				CommonRoomPoll: samplePoll(), Options: tc.options,
			})
			require.NoError(t, err)

			got, err := json.Marshal(toPollResponse(samplePoll(), tc.options))
			require.NoError(t, err)

			assert.Equal(t, string(want), string(got),
				"the DTO must emit the same JSON the embedded sqlc model did")
		})
	}
}

func TestPollResponseShape(t *testing.T) {
	t.Run("nullable columns marshal as scalars, not wrapper objects", func(t *testing.T) {
		m := marshalToMap(t, toPollResponse(samplePoll(), nil))

		assert.Equal(t, float64(11), m["phase_id"])
		assert.Equal(t, float64(22), m["created_by_character_id"])
		assert.Equal(t, "pick one", m["description"])
		assert.Equal(t, "2026-03-04T05:06:07Z", m["deadline"])
		assert.Equal(t, true, m["show_individual_votes"])
	})

	t.Run("NULL columns stay explicit nulls", func(t *testing.T) {
		m := marshalToMap(t, toPollResponse(nullablePoll(), nil))

		assert.Nil(t, m["phase_id"])
		assert.Nil(t, m["created_by_character_id"])
		assert.Nil(t, m["description"])
	})

	t.Run("options key is present as null when no options are loaded", func(t *testing.T) {
		m := marshalToMap(t, toPollResponse(samplePoll(), nil))
		require.Contains(t, m, "options")
		assert.Nil(t, m["options"])
	})

	t.Run("computed vote fields are omitted when unset", func(t *testing.T) {
		m := marshalToMap(t, toPollResponse(samplePoll(), nil))
		assert.NotContains(t, m, "has_voted")
		assert.NotContains(t, m, "user_vote_option_id")
		assert.NotContains(t, m, "user_vote_other_response")
	})

	t.Run("computed vote fields appear once set", func(t *testing.T) {
		resp := toPollResponse(samplePoll(), nil)
		optID := int32(9)
		other := "write-in"
		resp.HasVoted = true
		resp.UserVoteOptionID = &optID
		resp.UserVoteOtherResponse = &other

		m := marshalToMap(t, resp)
		assert.Equal(t, true, m["has_voted"])
		assert.Equal(t, float64(9), m["user_vote_option_id"])
		assert.Equal(t, "write-in", m["user_vote_other_response"])
	})
}

func TestToPollListItemWireParity(t *testing.T) {
	for _, hasVoted := range []bool{true, false} {
		want, err := json.Marshal(legacyPollListItem{
			CommonRoomPoll: samplePoll(), UserHasVoted: hasVoted,
		})
		require.NoError(t, err)

		got, err := json.Marshal(toPollListItem(samplePoll(), hasVoted))
		require.NoError(t, err)

		assert.Equal(t, string(want), string(got))
	}
}

func TestToPollSummaryWireParity(t *testing.T) {
	// Nested under poll results, the summary carried the bare sqlc model.
	want, err := json.Marshal(samplePoll())
	require.NoError(t, err)

	got, err := json.Marshal(toPollSummary(samplePoll()))
	require.NoError(t, err)

	assert.Equal(t, string(want), string(got))
}

func TestToPollVoteResponse(t *testing.T) {
	t.Run("matches the sqlc model it replaced", func(t *testing.T) {
		vote := db.PollVote{
			ID: 1, PollID: 2, UserID: 3,
			SelectedOptionID: pgtype.Int4{Int32: 9, Valid: true},
			CreatedAt:        ts(testTime), UpdatedAt: ts(testTime),
		}
		want, err := json.Marshal(vote)
		require.NoError(t, err)

		got, err := json.Marshal(toPollVoteResponse(vote))
		require.NoError(t, err)

		assert.Equal(t, string(want), string(got))
	})

	t.Run("a write-in vote nulls the option and fills the text", func(t *testing.T) {
		m := marshalToMap(t, toPollVoteResponse(db.PollVote{
			ID: 1, PollID: 2, UserID: 3,
			OtherResponse: pgtype.Text{String: "neither", Valid: true},
			CreatedAt:     ts(testTime), UpdatedAt: ts(testTime),
		}))

		assert.Nil(t, m["selected_option_id"])
		assert.Equal(t, "neither", m["other_response"])
	})
}

func TestToPollOptionResponses(t *testing.T) {
	t.Run("nil in nil out so the options key can render as null", func(t *testing.T) {
		assert.Nil(t, toPollOptionResponses(nil))
	})

	t.Run("empty stays an empty array", func(t *testing.T) {
		got := toPollOptionResponses([]db.PollOption{})
		require.NotNil(t, got)
		assert.Len(t, got, 0)
	})

	t.Run("ordering and fields are preserved", func(t *testing.T) {
		got := toPollOptionResponses([]db.PollOption{
			{ID: 9, PollID: 1, OptionText: "left", DisplayOrder: 0, CreatedAt: ts(testTime)},
			{ID: 10, PollID: 1, OptionText: "right", DisplayOrder: 1, CreatedAt: ts(testTime)},
		})
		require.Len(t, got, 2)
		assert.Equal(t, "left", got[0].OptionText)
		assert.Equal(t, int32(1), got[1].DisplayOrder)
	})
}
