package polls

import (
	"time"

	db "actionphase/pkg/db/models"
)

// Hand-written response DTOs for the poll endpoints.
//
// These replace the sqlc models (db.CommonRoomPoll, db.PollOption, db.PollVote)
// that the response bodies used to embed. The models marshalled to clean scalars
// at runtime -- pgtype implements MarshalJSON -- but huma builds its schemas by
// reflecting over Go fields, so the *documented* shape of every nullable column
// was a {Valid, Int32}-style wrapper object rather than a scalar. A client
// generated from that OpenAPI document would have been wrong for exactly the
// fields the DDL happened to leave nullable.
//
// The emitted JSON is deliberately byte-identical to what the embedded models
// produced, verified endpoint by endpoint against a running server:
//
//   - Nullable columns use *T *without* omitempty. pgtype marshals a null column
//     as an explicit `null`, and dropping the key instead would be a wire change
//     for a strict client. `created_by_character_id: null` is real output today.
//   - Deadline is a plain time.Time, not a pointer: the column is NOT NULL in the
//     schema. sqlc types every timestamptz as pgtype.Timestamptz regardless of
//     nullability, so the wrapper there never signalled optionality, and the
//     frontend's Poll type already declares `deadline: string` as required.
//   - show_individual_votes, allow_other_option, is_deleted, created_at and
//     updated_at are also plain value types, but on different grounds: those
//     columns are nullable in the DDL, carrying only a DEFAULT. They are treated
//     as non-null because nothing can write a NULL to them -- the insert never
//     names created_at/updated_at, so the DEFAULT always applies, and
//     poll_service.go always sets Valid: true on the booleans. The frontend's
//     Poll type has always declared all five as required and non-nullable, so a
//     NULL would have broken it under the old shape too. If that ever stops
//     holding, add NOT NULL to the columns rather than making these pointers.
//   - PollResponse.Options keeps its nil-vs-empty distinction. updatePoll returns
//     a poll with no options loaded and emits `"options": null`; create and get
//     populate it. Adding omitempty would drop the key on update.
type PollResponse struct {
	ID                         int32     `json:"id"`
	GameID                     int32     `json:"game_id"`
	PhaseID                    *int32    `json:"phase_id"`
	CreatedByUserID            int32     `json:"created_by_user_id"`
	CreatedByCharacterID       *int32    `json:"created_by_character_id"`
	Question                   string    `json:"question"`
	Description                *string   `json:"description"`
	Deadline                   time.Time `json:"deadline"`
	ShowIndividualVotes        bool      `json:"show_individual_votes"`
	AllowOtherOption           bool      `json:"allow_other_option"`
	HideResultsFromPlayers     bool      `json:"hide_results_from_players"`
	AllowAudienceVoting        bool      `json:"allow_audience_voting"`
	ShowRunningTotalsToPlayers bool      `json:"show_running_totals_to_players"`
	IsDeleted                  bool      `json:"is_deleted"`
	CreatedAt                  time.Time `json:"created_at"`
	UpdatedAt                  time.Time `json:"updated_at"`

	// Additional response fields, not columns on the poll row.
	Options               []PollOptionResponse `json:"options"`
	HasVoted              bool                 `json:"has_voted,omitempty"`
	UserVoteOptionID      *int32               `json:"user_vote_option_id,omitempty"`
	UserVoteOtherResponse *string              `json:"user_vote_other_response,omitempty"`
}

// PollListItem represents a poll in the list response with the caller's vote status.
//
// It carries the same poll fields as PollResponse minus the options array, so the
// same poll cannot present two different shapes across the list and detail
// endpoints.
type PollListItem struct {
	ID                         int32     `json:"id"`
	GameID                     int32     `json:"game_id"`
	PhaseID                    *int32    `json:"phase_id"`
	CreatedByUserID            int32     `json:"created_by_user_id"`
	CreatedByCharacterID       *int32    `json:"created_by_character_id"`
	Question                   string    `json:"question"`
	Description                *string   `json:"description"`
	Deadline                   time.Time `json:"deadline"`
	ShowIndividualVotes        bool      `json:"show_individual_votes"`
	AllowOtherOption           bool      `json:"allow_other_option"`
	HideResultsFromPlayers     bool      `json:"hide_results_from_players"`
	AllowAudienceVoting        bool      `json:"allow_audience_voting"`
	ShowRunningTotalsToPlayers bool      `json:"show_running_totals_to_players"`
	IsDeleted                  bool      `json:"is_deleted"`
	CreatedAt                  time.Time `json:"created_at"`
	UpdatedAt                  time.Time `json:"updated_at"`

	UserHasVoted bool `json:"user_has_voted"`
}

// pollDetails holds the poll-row fields shared by every poll-shaped response.
//
// It exists to decode the pgtype columns exactly once, in pollRowDetails, so the
// three converters cannot disagree about how a NULL becomes a pointer. It does
// not keep the response structs themselves in sync -- each one is flat by design,
// to hold the wire shape the embedded sqlc model produced, so a field added to
// one and not the others still compiles. The parity tests in responses_test.go
// are what catch that.
type pollDetails struct {
	ID                         int32
	GameID                     int32
	PhaseID                    *int32
	CreatedByUserID            int32
	CreatedByCharacterID       *int32
	Question                   string
	Description                *string
	Deadline                   time.Time
	ShowIndividualVotes        bool
	AllowOtherOption           bool
	HideResultsFromPlayers     bool
	AllowAudienceVoting        bool
	ShowRunningTotalsToPlayers bool
	IsDeleted                  bool
	CreatedAt                  time.Time
	UpdatedAt                  time.Time
}

// PollOptionResponse is one selectable option on a poll.
type PollOptionResponse struct {
	ID           int32     `json:"id"`
	PollID       int32     `json:"poll_id"`
	OptionText   string    `json:"option_text"`
	DisplayOrder int32     `json:"display_order"`
	CreatedAt    time.Time `json:"created_at"`
}

// PollVoteResponse is a single recorded vote, returned by the vote endpoint.
type PollVoteResponse struct {
	ID               int32     `json:"id"`
	PollID           int32     `json:"poll_id"`
	UserID           int32     `json:"user_id"`
	SelectedOptionID *int32    `json:"selected_option_id"`
	OtherResponse    *string   `json:"other_response"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// PollResultsResponse is the API response for poll results.
type PollResultsResponse struct {
	Poll                PollSummary     `json:"poll"`
	OptionResults       []OptionResult  `json:"option_results"`
	OtherResponses      []OtherResponse `json:"other_responses"` // Always include even if empty array
	TotalVotes          int32           `json:"total_votes"`
	ShowIndividualVotes bool            `json:"show_individual_votes"`
}

// pollRowDetails flattens the sqlc poll model into the shared field set.
func pollRowDetails(p db.CommonRoomPoll) pollDetails {
	d := pollDetails{
		ID:                         p.ID,
		GameID:                     p.GameID,
		CreatedByUserID:            p.CreatedByUserID,
		Question:                   p.Question,
		Deadline:                   p.Deadline.Time,
		ShowIndividualVotes:        p.ShowIndividualVotes.Bool,
		AllowOtherOption:           p.AllowOtherOption.Bool,
		HideResultsFromPlayers:     p.HideResultsFromPlayers,
		AllowAudienceVoting:        p.AllowAudienceVoting,
		ShowRunningTotalsToPlayers: p.ShowRunningTotalsToPlayers,
		IsDeleted:                  p.IsDeleted.Bool,
		CreatedAt:                  p.CreatedAt.Time,
		UpdatedAt:                  p.UpdatedAt.Time,
	}

	if p.PhaseID.Valid {
		phaseID := p.PhaseID.Int32
		d.PhaseID = &phaseID
	}
	if p.CreatedByCharacterID.Valid {
		charID := p.CreatedByCharacterID.Int32
		d.CreatedByCharacterID = &charID
	}
	if p.Description.Valid {
		desc := p.Description.String
		d.Description = &desc
	}

	return d
}

// toPollResponse converts a poll row and its options into the detail response.
func toPollResponse(p db.CommonRoomPoll, options []db.PollOption) *PollResponse {
	d := pollRowDetails(p)
	return &PollResponse{
		ID:                         d.ID,
		GameID:                     d.GameID,
		PhaseID:                    d.PhaseID,
		CreatedByUserID:            d.CreatedByUserID,
		CreatedByCharacterID:       d.CreatedByCharacterID,
		Question:                   d.Question,
		Description:                d.Description,
		Deadline:                   d.Deadline,
		ShowIndividualVotes:        d.ShowIndividualVotes,
		AllowOtherOption:           d.AllowOtherOption,
		HideResultsFromPlayers:     d.HideResultsFromPlayers,
		AllowAudienceVoting:        d.AllowAudienceVoting,
		ShowRunningTotalsToPlayers: d.ShowRunningTotalsToPlayers,
		IsDeleted:                  d.IsDeleted,
		CreatedAt:                  d.CreatedAt,
		UpdatedAt:                  d.UpdatedAt,
		Options:                    toPollOptionResponses(options),
	}
}

// toPollListItem converts a poll row plus the caller's vote status into a list entry.
func toPollListItem(p db.CommonRoomPoll, userHasVoted bool) PollListItem {
	d := pollRowDetails(p)
	return PollListItem{
		ID:                         d.ID,
		GameID:                     d.GameID,
		PhaseID:                    d.PhaseID,
		CreatedByUserID:            d.CreatedByUserID,
		CreatedByCharacterID:       d.CreatedByCharacterID,
		Question:                   d.Question,
		Description:                d.Description,
		Deadline:                   d.Deadline,
		ShowIndividualVotes:        d.ShowIndividualVotes,
		AllowOtherOption:           d.AllowOtherOption,
		HideResultsFromPlayers:     d.HideResultsFromPlayers,
		AllowAudienceVoting:        d.AllowAudienceVoting,
		ShowRunningTotalsToPlayers: d.ShowRunningTotalsToPlayers,
		IsDeleted:                  d.IsDeleted,
		CreatedAt:                  d.CreatedAt,
		UpdatedAt:                  d.UpdatedAt,
		UserHasVoted:               userHasVoted,
	}
}

// toPollOptionResponses converts option rows, preserving nil so a poll returned
// without its options loaded still emits `"options": null`.
func toPollOptionResponses(options []db.PollOption) []PollOptionResponse {
	if options == nil {
		return nil
	}
	out := make([]PollOptionResponse, len(options))
	for i, o := range options {
		out[i] = PollOptionResponse{
			ID:           o.ID,
			PollID:       o.PollID,
			OptionText:   o.OptionText,
			DisplayOrder: o.DisplayOrder,
			CreatedAt:    o.CreatedAt.Time,
		}
	}
	return out
}

// PollSummary is the poll row as it appears nested under poll results. It is the
// same field set as PollListItem without the caller-specific user_has_voted flag,
// matching what the results endpoint emitted when it embedded the sqlc model.
type PollSummary struct {
	ID                         int32     `json:"id"`
	GameID                     int32     `json:"game_id"`
	PhaseID                    *int32    `json:"phase_id"`
	CreatedByUserID            int32     `json:"created_by_user_id"`
	CreatedByCharacterID       *int32    `json:"created_by_character_id"`
	Question                   string    `json:"question"`
	Description                *string   `json:"description"`
	Deadline                   time.Time `json:"deadline"`
	ShowIndividualVotes        bool      `json:"show_individual_votes"`
	AllowOtherOption           bool      `json:"allow_other_option"`
	HideResultsFromPlayers     bool      `json:"hide_results_from_players"`
	AllowAudienceVoting        bool      `json:"allow_audience_voting"`
	ShowRunningTotalsToPlayers bool      `json:"show_running_totals_to_players"`
	IsDeleted                  bool      `json:"is_deleted"`
	CreatedAt                  time.Time `json:"created_at"`
	UpdatedAt                  time.Time `json:"updated_at"`
}

// toPollSummary converts a poll row for nesting under results.
func toPollSummary(p db.CommonRoomPoll) PollSummary {
	d := pollRowDetails(p)
	return PollSummary{
		ID:                         d.ID,
		GameID:                     d.GameID,
		PhaseID:                    d.PhaseID,
		CreatedByUserID:            d.CreatedByUserID,
		CreatedByCharacterID:       d.CreatedByCharacterID,
		Question:                   d.Question,
		Description:                d.Description,
		Deadline:                   d.Deadline,
		ShowIndividualVotes:        d.ShowIndividualVotes,
		AllowOtherOption:           d.AllowOtherOption,
		HideResultsFromPlayers:     d.HideResultsFromPlayers,
		AllowAudienceVoting:        d.AllowAudienceVoting,
		ShowRunningTotalsToPlayers: d.ShowRunningTotalsToPlayers,
		IsDeleted:                  d.IsDeleted,
		CreatedAt:                  d.CreatedAt,
		UpdatedAt:                  d.UpdatedAt,
	}
}

// toPollVoteResponse converts a recorded vote row.
func toPollVoteResponse(v db.PollVote) *PollVoteResponse {
	r := &PollVoteResponse{
		ID:        v.ID,
		PollID:    v.PollID,
		UserID:    v.UserID,
		CreatedAt: v.CreatedAt.Time,
		UpdatedAt: v.UpdatedAt.Time,
	}
	if v.SelectedOptionID.Valid {
		optID := v.SelectedOptionID.Int32
		r.SelectedOptionID = &optID
	}
	if v.OtherResponse.Valid {
		other := v.OtherResponse.String
		r.OtherResponse = &other
	}
	return r
}
