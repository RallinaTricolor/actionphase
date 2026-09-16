package games

import (
	"net/http"
	"time"

	"actionphase/pkg/core"
)

// GameResponse is a game's own stored settings and metadata -- everything that
// lives on the `games` row itself, with no joins.
//
// This is the WRITE-PATH shape: create and update answer with it because
// neither has a joined row in hand, only the row it just wrote. Reads use
// GameWithDetailsResponse, which embeds this and adds the joined columns.
//
// Nothing here is role-conditional. A game exposes the same fields to every
// caller entitled to see it at all, which is why there is no viewer-dependent
// variant of this type the way there is for characters.
type GameResponse struct {
	ID                      int32          `json:"id"`
	Title                   string         `json:"title"`
	Description             string         `json:"description"`
	GMUserID                int32          `json:"gm_user_id"`
	State                   core.GameState `json:"state"`
	Genre                   string         `json:"genre,omitempty"`
	StartDate               *time.Time     `json:"start_date,omitempty"`
	EndDate                 *time.Time     `json:"end_date,omitempty"`
	RecruitmentDeadline     *time.Time     `json:"recruitment_deadline,omitempty"`
	MaxPlayers              int32          `json:"max_players,omitempty"`
	IsAnonymous             bool           `json:"is_anonymous"`
	AutoAcceptAudience      bool           `json:"auto_accept_audience"`
	AllowGroupConversations bool           `json:"allow_group_conversations"`
	PortraitAvatars         bool           `json:"portrait_avatars"`
	BannerURL               *string        `json:"banner_url,omitempty"`
	CommonRoomOpenDay       *int16         `json:"common_room_open_day,omitempty"`
	CommonRoomOpenTime      *string        `json:"common_room_open_time,omitempty"`
	CommonRoomCloseDay      *int16         `json:"common_room_close_day,omitempty"`
	CommonRoomCloseTime     *string        `json:"common_room_close_time,omitempty"`
	ScheduleTimezone        *string        `json:"schedule_timezone,omitempty"`
	// A POINTER because legacy games genuinely have no community (req 5). A
	// zero int32 would render as community 0, which no client can distinguish
	// from "unset" -- absent is the honest encoding.
	CommunityID *int32 `json:"community_id,omitempty"`
	// As stored: sparse, containing only genuine GM overrides. Defaults are NOT
	// filled in here — the frontend owns them, so exactly one place knows them.
	CharacterSheet *core.CharacterSheetConfig `json:"character_sheet,omitempty"`
	CreatedAt      time.Time                  `json:"created_at"`
	UpdatedAt      time.Time                  `json:"updated_at"`
}

func (rd *GameResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// GameWithDetailsResponse is what every game READ answers with: the stored row
// plus the columns GetGameWithDetails joins in.
//
// EMBEDS GameResponse rather than restating it. The two were near-verbatim
// copies -- the same 13 fields and the same 12 null-unwrapping blocks -- and
// they had already drifted: community_name and community_slug were added here
// and never to GameResponse, so the two endpoints disagreed about what a game
// is. Embedding makes that drift impossible; huma merges anonymous fields into
// the parent object, so the wire shape is flat exactly as before.
//
// Everything added here is a JOIN or an aggregate, not a visibility decision.
type GameWithDetailsResponse struct {
	GameResponse
	GMUsername string `json:"gm_username,omitempty"`
	// Name and slug of the owning community, joined alongside CommunityID so a
	// game surface can label and link it without a second request. Both nil for
	// a legacy game, exactly like CommunityID.
	//
	// The Info tab's community section needs these even when the community has
	// published NO documents -- naming the community is not conditional on it
	// having written anything.
	CommunityName  *string `json:"community_name,omitempty"`
	CommunitySlug  *string `json:"community_slug,omitempty"`
	CurrentPlayers int64   `json:"current_players"`
}

func (rd *GameWithDetailsResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// GameStateChangedResponse is what PUT /games/{gameID}/state answers with.
//
// Deliberately NOT GameResponse. The handler assigns exactly these seven
// fields, so declaring the full game shape advertised 21 more that it never
// sets -- and the four booleans among them (is_anonymous, auto_accept_audience,
// allow_group_conversations, portrait_avatars) would marshal as `false`
// regardless of what the game has stored. A client that trusted the declared
// type would read is_anonymous:false off a game that is anonymous.
//
// The reduced shape is the honest one rather than a regression: a state change
// answers "the move succeeded, here is the new state", and a caller needing the
// game's settings refetches. useGameStateManagement already does exactly that,
// discarding this body and calling refetchGameData.
//
// Pinned by TestUpdateGameStateResponseMatchesWhatItSends in pkg/http.
type GameStateChangedResponse struct {
	ID          int32          `json:"id"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	GMUserID    int32          `json:"gm_user_id"`
	State       core.GameState `json:"state"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// GameApplicationResponse represents a game application
type GameApplicationResponse struct {
	ID               int32      `json:"id"`
	GameID           int32      `json:"game_id"`
	UserID           int32      `json:"user_id"`
	Username         string     `json:"username,omitempty"`
	Email            string     `json:"email,omitempty"`
	Role             string     `json:"role"`
	Message          string     `json:"message,omitempty"`
	Status           string     `json:"status"`
	AppliedAt        time.Time  `json:"applied_at"`
	ReviewedAt       *time.Time `json:"reviewed_at,omitempty"`
	ReviewedByUserID *int32     `json:"reviewed_by_user_id,omitempty"`
}

func (rd *GameApplicationResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// EnrichedGameListItemResponse is one row of the games listing.
//
// This is the ONE game shape that genuinely differs rather than differing by
// accident: user_relationship is viewer-dependent, and the phase and activity
// columns are aggregates computed by the listing query alone. A read of a
// single game cannot answer them, so this is not GameWithDetailsResponse with
// extras bolted on.
//
// It deliberately does NOT embed GameResponse. The listing query returns
// genre and max_players as nullable columns, so they are pointers here where
// the base type has values -- embedding would silently change the wire shape
// of two fields to make the Go read tidier.
type EnrichedGameListItemResponse struct {
	ID                      int32          `json:"id"`
	Title                   string         `json:"title"`
	Description             string         `json:"description"`
	GMUserID                int32          `json:"gm_user_id"`
	GMUsername              string         `json:"gm_username"`
	State                   core.GameState `json:"state"`
	Genre                   *string        `json:"genre,omitempty"`
	StartDate               *time.Time     `json:"start_date,omitempty"`
	EndDate                 *time.Time     `json:"end_date,omitempty"`
	RecruitmentDeadline     *time.Time     `json:"recruitment_deadline,omitempty"`
	MaxPlayers              *int32         `json:"max_players,omitempty"`
	IsAnonymous             bool           `json:"is_anonymous"`
	AutoAcceptAudience      bool           `json:"auto_accept_audience"`
	AllowGroupConversations bool           `json:"allow_group_conversations"`
	PortraitAvatars         bool           `json:"portrait_avatars"`
	BannerURL               *string        `json:"banner_url,omitempty"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
	CurrentPlayers          int32          `json:"current_players"`
	// The viewer's relationship to this game. Absent for a signed-out caller.
	//
	// 'none' is NOT a member: the listing query emits it, but
	// interfaceToStringPtr maps both "" and "none" to nil, so it can never
	// reach the wire. Absent IS "none".
	UserRelationship *string `json:"user_relationship,omitempty" enum:"gm,co_gm,participant,audience,applied"`
	// Absent when the game has no active phase.
	CurrentPhaseType     *string    `json:"current_phase_type,omitempty" enum:"action,common_room"`
	CurrentPhaseDeadline *time.Time `json:"current_phase_deadline,omitempty"`
	// Always present: the listing query's CASE falls through to 'normal'.
	DeadlineUrgency   string `json:"deadline_urgency" enum:"critical,warning,normal"`
	HasRecentActivity bool   `json:"has_recent_activity"`
}

// GameListingMetadataResponse represents metadata about the game listing
type GameListingMetadataResponse struct {
	TotalCount      int              `json:"total_count"`
	FilteredCount   int              `json:"filtered_count"`
	AvailableStates []core.GameState `json:"available_states"`
	Page            int              `json:"page"`
	PageSize        int              `json:"page_size"`
	TotalPages      int              `json:"total_pages"`
	HasNextPage     bool             `json:"has_next_page"`
	HasPreviousPage bool             `json:"has_previous_page"`
}

// GameListingResponse represents the full game listing response
type GameListingResponse struct {
	// nullable:"false": built with make([]*EnrichedGameListItemResponse,
	// len(...)), so never nil. See PollResultsResponse for why the tag is needed.
	Games    []*EnrichedGameListItemResponse `json:"games" nullable:"false"`
	Metadata GameListingMetadataResponse     `json:"metadata"`
}

func (rd *GameListingResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// Audience response types.
//
// Moved here from api_audience.go when that file's handlers were converted;
// they are response shapes like everything else in this file.

type AudienceMemberResponse struct {
	ID       int32     `json:"id"`
	GameID   int32     `json:"game_id"`
	UserID   int32     `json:"user_id"`
	Username string    `json:"username"`
	Role     string    `json:"role"`
	Status   string    `json:"status"`
	JoinedAt time.Time `json:"joined_at"`
}

type ListAudienceMembersResponse struct {
	AudienceMembers []AudienceMemberResponse `json:"audience_members"`
}

type PrivateConversationResponse struct {
	ConversationID          int32       `json:"conversation_id"`
	Subject                 *string     `json:"subject"`
	ConversationType        string      `json:"conversation_type"`
	CreatedAt               string      `json:"created_at"`
	MessageCount            int64       `json:"message_count"`
	LastMessageAt           interface{} `json:"last_message_at"`
	ParticipantNames        interface{} `json:"participant_names"`
	ParticipantUsernames    interface{} `json:"participant_usernames"`
	ParticipantCharacterIDs interface{} `json:"participant_character_ids"`
	LastMessageContent      *string     `json:"last_message_content"`
	LastSenderName          *string     `json:"last_sender_name"`
	LastSenderUsername      *string     `json:"last_sender_username"`
	LastSenderCharacterID   *int32      `json:"last_sender_character_id"`
}

type ActionSubmissionResponse struct {
	ID            int32   `json:"id"`
	GameID        int32   `json:"game_id"`
	UserID        int32   `json:"user_id"`
	PhaseID       int32   `json:"phase_id"`
	CharacterID   *int32  `json:"character_id"`
	Content       string  `json:"content"`
	SubmittedAt   *string `json:"submitted_at"`
	UpdatedAt     *string `json:"updated_at"`
	Username      string  `json:"username"`
	CharacterName *string `json:"character_name"`
	PhaseType     string  `json:"phase_type"`
	PhaseNumber   int32   `json:"phase_number"`
	PhaseTitle    string  `json:"phase_title"`
}

type AudienceMessageResponse struct {
	ID                  int32   `json:"id"`
	ConversationID      int32   `json:"conversation_id"`
	SenderUserID        *int32  `json:"sender_user_id"`
	SenderCharacterID   *int32  `json:"sender_character_id"`
	Content             string  `json:"content"`
	CreatedAt           string  `json:"created_at"`
	UpdatedAt           string  `json:"updated_at"`
	IsDeleted           bool    `json:"is_deleted"`
	SenderUsername      string  `json:"sender_username"`
	SenderCharacterName *string `json:"sender_character_name"`
}
