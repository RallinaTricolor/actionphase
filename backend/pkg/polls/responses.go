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
	PollSummary

	// Additional response fields, not columns on the poll row.
	Options               []PollOptionResponse `json:"options"`
	UserHasVoted          bool                 `json:"user_has_voted"`
	UserVoteOptionID      *int32               `json:"user_vote_option_id,omitempty"`
	UserVoteOtherResponse *string              `json:"user_vote_other_response,omitempty"`
}

// PollListItem is a poll as it appears in a list response.
//
// EMBEDS PollSummary rather than restating it. The two were verbatim copies of
// the same sixteen fields; embedding makes it impossible for a field added to
// one to go missing from the other. huma merges anonymous fields into the parent
// object, so the wire shape stays flat exactly as before.
//
// It carries no options array: a list entry is the poll row plus the caller's
// vote status, and the options come from the detail endpoint.
type PollListItem struct {
	PollSummary

	UserHasVoted bool `json:"user_has_voted"`
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
	Poll PollSummary `json:"poll"`
	// nullable:"false" on both: huma renders every bare []T as nullable because
	// a nil Go slice marshals to `null`, but these are make()'d to a known
	// length before the response is built, so neither can be nil. Without it the
	// generated client type is `T[] | null` and PollResults.tsx has to guard a
	// case that cannot happen.
	OptionResults       []OptionResult  `json:"option_results" nullable:"false"`
	OtherResponses      []OtherResponse `json:"other_responses" nullable:"false"` // Always include even if empty array
	TotalVotes          int32           `json:"total_votes"`
	ShowIndividualVotes bool            `json:"show_individual_votes"`
}

// toPollResponse converts a poll row and its options into the detail response.
func toPollResponse(p db.CommonRoomPoll, options []db.PollOption, userHasVoted bool) *PollResponse {
	return &PollResponse{
		PollSummary:  toPollSummary(p),
		Options:      toPollOptionResponses(options),
		UserHasVoted: userHasVoted,
	}
}

// toPollListItem converts a poll row plus the caller's vote status into a list entry.
func toPollListItem(p db.CommonRoomPoll, userHasVoted bool) PollListItem {
	return PollListItem{
		PollSummary:  toPollSummary(p),
		UserHasVoted: userHasVoted,
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

// PollSummary is the poll row itself: every column on `common_room_polls`, plus
// the one field computed from them.
//
// It is the BASE SHAPE for every poll-shaped response. PollListItem and
// PollResponse both embed it and add only what their endpoint genuinely knows
// that the others do not -- the caller's vote status, and the options array.
// Nothing here is role-conditional: a poll exposes the same row to every caller
// entitled to see it at all. What varies between the three responses is how much
// has been *loaded*, never what the viewer is *allowed* to see. (Result
// visibility is enforced by rejecting the results request outright, not by
// trimming fields from this struct.)
//
// IsExpired is calculated, not stored -- the same pattern as PhaseResponse,
// which computes is_expired and time_remaining in withCalculatedFields. Deadline
// is NOT NULL here, so unlike a phase there is no "no deadline set" case and the
// flag is unconditional.
//
// It is computed server-side on purpose. Every client otherwise has to
// re-derive "is this poll over?" from the deadline, and the frontend proved how
// that goes: PollCard computed it correctly from the deadline while PollsTab
// read a poll.is_expired that no endpoint ever sent, so its expired/active split
// silently put every poll in "active" and left "expired" permanently empty.
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

	// Calculated, not a column. See the type doc.
	IsExpired bool `json:"is_expired"`
}

// toPollSummary converts a poll row into the shared base shape.
//
// This is the ONLY place a db.CommonRoomPoll becomes a poll response. The three
// endpoints previously each had their own converter repeating the same sixteen
// assignments and the same three null-unwrapping blocks; they now all funnel
// through here, so a column can no longer reach one response and miss another.
func toPollSummary(p db.CommonRoomPoll) PollSummary {
	s := PollSummary{
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

	// Deadline is NOT NULL, so this is unconditional -- there is no
	// "no deadline set" case the way there is for a phase.
	s.IsExpired = time.Now().After(s.Deadline)

	if p.PhaseID.Valid {
		phaseID := p.PhaseID.Int32
		s.PhaseID = &phaseID
	}
	if p.CreatedByCharacterID.Valid {
		charID := p.CreatedByCharacterID.Int32
		s.CreatedByCharacterID = &charID
	}
	if p.Description.Valid {
		desc := p.Description.String
		s.Description = &desc
	}

	return s
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
