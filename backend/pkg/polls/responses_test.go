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

// The wire-parity tests below compare decoded objects rather than raw JSON
// bytes: the contract is the set of keys and values, not the order sqlc happens
// to declare its struct fields in. (Field order shifted when sqlc moved to
// generating from the migrations, which reordered columns without changing the
// payload.)
//
// legacyPollResponse is the pre-DTO shape: the sqlc model embedded, with the
// extra computed fields alongside it.
type legacyPollResponse struct {
	db.CommonRoomPoll
	Options               []db.PollOption `json:"options"`
	HasVoted              bool            `json:"has_voted,omitempty"`
	UserVoteOptionID      *int32          `json:"user_vote_option_id,omitempty"`
	UserVoteOtherResponse *string         `json:"user_vote_other_response,omitempty"`
}

// addedSinceLegacy are the keys the DTOs emit that the embedded sqlc model did
// not. The parity tests assert equality after removing them, so the legacy shape
// still pins every field it used to -- a column silently vanishing from a
// response is still a failure -- while the two intended additions are allowed.
//
//   - is_expired: computed from the deadline. Added because it was the one poll
//     field the frontend already assumed existed and no endpoint sent, so
//     PollsTab's expired/active split never worked.
//   - user_has_voted on the DETAIL response: the flag was called has_voted here
//     and user_has_voted on the list, and nothing on the frontend ever read the
//     detail spelling. Renamed so a poll reports its vote status by one name.
func withoutAdditions(m map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		if k == "is_expired" || k == "user_has_voted" {
			continue
		}
		out[k] = v
	}
	return out
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
			want := marshalToMap(t, legacyPollResponse{
				CommonRoomPoll: samplePoll(), Options: tc.options,
			})
			got := marshalToMap(t, toPollResponse(samplePoll(), tc.options, false))

			assert.Equal(t, want, withoutAdditions(got),
				"the DTO must emit the same JSON the embedded sqlc model did, "+
					"apart from the fields in withoutAdditions")
		})
	}
}

func TestPollResponseShape(t *testing.T) {
	t.Run("nullable columns marshal as scalars, not wrapper objects", func(t *testing.T) {
		m := marshalToMap(t, toPollResponse(samplePoll(), nil, false))

		assert.Equal(t, float64(11), m["phase_id"])
		assert.Equal(t, float64(22), m["created_by_character_id"])
		assert.Equal(t, "pick one", m["description"])
		assert.Equal(t, "2026-03-04T05:06:07Z", m["deadline"])
		assert.Equal(t, true, m["show_individual_votes"])
	})

	t.Run("NULL columns stay explicit nulls", func(t *testing.T) {
		m := marshalToMap(t, toPollResponse(nullablePoll(), nil, false))

		assert.Nil(t, m["phase_id"])
		assert.Nil(t, m["created_by_character_id"])
		assert.Nil(t, m["description"])
	})

	t.Run("options key is present as null when no options are loaded", func(t *testing.T) {
		m := marshalToMap(t, toPollResponse(samplePoll(), nil, false))
		require.Contains(t, m, "options")
		assert.Nil(t, m["options"])
	})

	t.Run("the vote-choice fields are omitted when unset", func(t *testing.T) {
		m := marshalToMap(t, toPollResponse(samplePoll(), nil, false))
		assert.NotContains(t, m, "user_vote_option_id")
		assert.NotContains(t, m, "user_vote_other_response")
	})

	t.Run("user_has_voted is always present, unlike the vote-choice fields", func(t *testing.T) {
		// It is a required bool, not omitempty: "this caller has not voted" is a
		// real answer and belongs on the wire as false, not as an absent key.
		// The old has_voted was omitempty, so the detail endpoint could not say
		// "no" -- another reason nothing read it.
		m := marshalToMap(t, toPollResponse(samplePoll(), nil, false))
		require.Contains(t, m, "user_has_voted")
		assert.Equal(t, false, m["user_has_voted"])
	})

	t.Run("vote fields appear once set", func(t *testing.T) {
		resp := toPollResponse(samplePoll(), nil, true)
		optID := int32(9)
		other := "write-in"
		resp.UserVoteOptionID = &optID
		resp.UserVoteOtherResponse = &other

		m := marshalToMap(t, resp)
		assert.Equal(t, true, m["user_has_voted"])
		assert.Equal(t, float64(9), m["user_vote_option_id"])
		assert.Equal(t, "write-in", m["user_vote_other_response"])
	})

	t.Run("is_expired tracks the deadline", func(t *testing.T) {
		// Deadlines are relative to now rather than the fixed testTime, which
		// would flip this assertion's meaning depending on the wall clock.
		past := samplePoll()
		past.Deadline = ts(time.Now().Add(-time.Hour))
		assert.Equal(t, true, marshalToMap(t, toPollResponse(past, nil, false))["is_expired"])

		future := samplePoll()
		future.Deadline = ts(time.Now().Add(time.Hour))
		assert.Equal(t, false, marshalToMap(t, toPollResponse(future, nil, false))["is_expired"])
	})
}

func TestToPollListItemWireParity(t *testing.T) {
	for _, hasVoted := range []bool{true, false} {
		want := marshalToMap(t, legacyPollListItem{
			CommonRoomPoll: samplePoll(), UserHasVoted: hasVoted,
		})
		got := marshalToMap(t, toPollListItem(samplePoll(), hasVoted))

		// user_has_voted is not an addition here -- the list always had it, so
		// it is dropped from both sides and asserted separately below.
		assert.Equal(t, withoutAdditions(want), withoutAdditions(got))
		assert.Equal(t, hasVoted, got["user_has_voted"])
	}
}

func TestToPollSummaryWireParity(t *testing.T) {
	// Nested under poll results, the summary carried the bare sqlc model.
	want := marshalToMap(t, samplePoll())
	got := marshalToMap(t, toPollSummary(samplePoll()))

	assert.Equal(t, want, withoutAdditions(got))
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
