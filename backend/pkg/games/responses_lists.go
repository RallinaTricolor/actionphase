package games

import (
	"time"
)

// Response types for the six list endpoints that built `[]map[string]any` by
// hand.
//
// A map has no schema, so huma documented every one of these as
// `array of {additionalProperties}` -- the generated TypeScript was an index
// signature, and the frontend hand-maintained the real shape in parallel. These
// structs are transcriptions of the literals the handlers already wrote, key for
// key, so the wire is unchanged; only the spec gains a name.
//
// Two conventions from the maps are load-bearing and preserved exactly:
//
//   - A key the map set unconditionally is a plain field, or a *T WITHOUT
//     omitempty when it could be null. A key the map added inside an `if` is a
//     *T WITH omitempty, so a nil value drops the key rather than sending null.
//     The two are different wire contracts and the handlers use both, sometimes
//     for the same column -- see avatar_url on participants (explicit null) vs
//     applicants (omitted).
//   - Whether an empty list is `[]` or `null` is inherited from the handler's
//     own `var x []T` vs `make([]T, 0)`, and is likewise left alone. Five of the
//     six use make(...,0) and carry `nullable:"false"` on their output Body;
//     participants uses a bare `var` and genuinely sends null, so it does NOT
//     get the tag. Pinned by TestListEndpointArrayNullability.
//
// huma honours `nullable:"false"` on a top-level `Body []T` as well as on a
// struct field, which had no precedent in this repo -- verified by spike before
// relying on it, the same way the Group B field tags were.

// ParticipantListItemResponse is one entry of the participant list.
//
// Wider than GameParticipantResponse, which is the single-participant write
// response: this joins username and avatar_url, and omits the removal audit
// columns the list has never carried. They are separate shapes rather than one
// shared type because the list deliberately withholds `email` for privacy.
//
// In an anonymous game a viewer who may not see former-player status gets those
// participants reported as ordinary players: `role` is spoofed to "player" and
// `is_former_player` cleared. That redaction happens before this struct is
// built, so the field names say nothing about it.
type ParticipantListItemResponse struct {
	ID       int32  `json:"id"`
	GameID   int32  `json:"game_id"`
	UserID   int32  `json:"user_id"`
	Username string `json:"username"`
	// Email is intentionally omitted for privacy.
	// Tagged so the generated TypeScript keeps the unions the hand-written
	// types carried. Values pinned by CHECK constraints on game_participants
	// (migration 20250805170112). Note `role` here can be spoofed to "player"
	// by the anonymity redaction above.
	Role     string    `json:"role" enum:"player,co_gm,audience"`
	Status   string    `json:"status" enum:"active,inactive,removed"`
	JoinedAt time.Time `json:"joined_at"`
	// Explicit null rather than an absent key -- no omitempty. The client reads
	// this directly to decide whether to render an avatar, so the key must
	// always be present.
	AvatarURL      *string `json:"avatar_url"`
	IsFormerPlayer bool    `json:"is_former_player"`
}

// ApplicationListItemResponse is one entry of the GM's application list.
//
// Distinct from GameApplicationResponse, which carries `email`; this endpoint
// omits it for privacy even though the GM is the only caller.
//
// The four omitempty fields mirror the handler's `if x.Valid` blocks: an
// unreviewed application sends neither `reviewed_at` nor
// `reviewed_by_user_id`, and absence -- not null -- is how a client tells a
// pending application from a reviewed one.
type ApplicationListItemResponse struct {
	ID       int32  `json:"id"`
	GameID   int32  `json:"game_id"`
	UserID   int32  `json:"user_id"`
	Username string `json:"username"`
	// Email is intentionally omitted for privacy.
	// Values pinned by CHECK constraints on game_applications (migration
	// 20250806175738). An application's role cannot be co_gm.
	Role             string     `json:"role" enum:"player,audience"`
	Status           string     `json:"status" enum:"pending,approved,rejected,withdrawn"`
	AppliedAt        time.Time  `json:"applied_at"`
	AvatarURL        *string    `json:"avatar_url,omitempty"`
	Message          *string    `json:"message,omitempty"`
	ReviewedAt       *time.Time `json:"reviewed_at,omitempty"`
	ReviewedByUserID *int32     `json:"reviewed_by_user_id,omitempty"`
}

// PublicApplicantResponse is one entry of the applicant list shown during
// recruitment.
//
// Username and role only: no status and no review information. This endpoint is
// readable by anyone, which is why it is a separate, deliberately narrow shape
// rather than a filtered ApplicationListItemResponse.
type PublicApplicantResponse struct {
	ID        int32     `json:"id"`
	Username  string    `json:"username"`
	Role      string    `json:"role" enum:"player,audience"`
	AppliedAt time.Time `json:"applied_at"`
	AvatarURL *string   `json:"avatar_url,omitempty"`
}

// GameLogEntryResponse is one line of a game's log.
//
// `message` is a plain string: the handler reads log.Message.String, which
// yields "" for a NULL column rather than propagating the null.
type GameLogEntryResponse struct {
	ID        int32     `json:"id"`
	GameID    int32     `json:"game_id"`
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

// LootTableContentResponse is one item in a loot table, as the list returns it.
//
// Narrower than GameLootTableContentResponse (the single-item write response),
// which also carries loot_table_id. `data` is a plain string here because the
// handler reads item.Data.String, flattening a NULL to "".
type LootTableContentResponse struct {
	ID   int32  `json:"id"`
	Name string `json:"name"`
	Data string `json:"data"`
}
