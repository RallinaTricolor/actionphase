package characters

import (
	"time"

	"actionphase/pkg/core"
)

// Response bodies
//
// Several of these replace `map[string]interface{}` literals the chi handlers
// encoded directly. The maps built their keys conditionally -- omitting player
// identity in anonymous games, omitting nullable columns that were NULL -- so
// every such key is a pointer with `omitempty` here. That reproduces the wire
// format exactly: absent stays absent rather than becoming a null or a zero
// value the frontend would render as a real answer.

// CharacterResponse is the character row, and the shape every character-shaped
// endpoint answers with.
//
// It is the BASE SHAPE: create, get, approve, reassign, rename, the per-game
// roster and both controllable lists all return exactly this, and
// InactiveCharacterResponse embeds it to add ownership history.
//
// This used to be four near-identical structs, which differed only by which
// columns the endpoint's query happened to join -- not by what the caller was
// entitled to see. That distinction matters, because entitlement here is
// enforced by BLANKING FIELDS WITHIN this shape, never by returning a narrower
// one:
//
//   - The four identity fields (UserID, Username, AssignedUserID,
//     AssignedUsername) are dropped TOGETHER for a regular player in an
//     anonymous game -- see canSeePlayerNames. Treat them as a unit; never infer
//     one's value from another's presence.
//   - CharacterType is dropped for that same caller, because in an anonymous
//     game it leaks whether a character is a player's or the GM's.
//   - AvatarURL deliberately survives anonymous mode: the portrait belongs to
//     the character, not the player behind it.
//
// Because of that, a pointer here means "may be withheld or NULL", and a value
// means "always sent". Status is a plain string: the column is NOT NULL and
// every handler sets it, so modelling it as *string only told the client it
// might be absent when it never is.
type CharacterResponse struct {
	ID     int32  `json:"id" doc:"Character ID"`
	GameID int32  `json:"game_id" doc:"Game the character belongs to"`
	Name   string `json:"name" doc:"Character name"`
	// A pointer because an anonymous game withholds it from regular players,
	// not because the column is nullable.
	CharacterType *string `json:"character_type,omitempty" required:"false" enum:"player_character,npc" doc:"Absent when an anonymous game hides it from the caller"`
	Status        string  `json:"status" enum:"pending,approved" doc:"Approval status"`
	AvatarURL     *string `json:"avatar_url,omitempty" required:"false" doc:"Character portrait URL"`
	// Reported on every character the caller can see -- hiding conceals WHICH
	// characters are hidden, not that the mechanic exists. A hidden character
	// is omitted from the response outright for callers who may not see it, so
	// this flag never discloses anything the row itself did not.
	//
	// Optional in the schema rather than required, so consumers test `=== true`
	// rather than falsiness: an absent key must read as "not hidden".
	IsHidden  *bool     `json:"is_hidden,omitempty" required:"false" doc:"NPC concealed from regular players; absent when the caller may not see the distinction"`
	IsActive  bool      `json:"is_active" doc:"False once the character has been retired"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Identity. All four are withheld together in an anonymous game; each is
	// also absent when its own column is NULL (an unassigned NPC has no owner).
	UserID           *int32  `json:"user_id,omitempty" required:"false" doc:"Owning player, absent for unassigned NPCs"`
	Username         *string `json:"username,omitempty" required:"false" doc:"Owning player's username"`
	AssignedUserID   *int32  `json:"assigned_user_id,omitempty" required:"false" doc:"User controlling this NPC"`
	AssignedUsername *string `json:"assigned_username,omitempty" required:"false" doc:"Username controlling this NPC"`
}

// ControllableCharacterWithGameResponse adds the game context the cross-game
// list needs, for surfaces rendering a sheet with no game in scope.
type ControllableCharacterWithGameResponse struct {
	CharacterResponse

	GameTitle           string  `json:"game_title" doc:"Title of the game this character belongs to"`
	GameState           *string `json:"game_state,omitempty" required:"false" doc:"That game's lifecycle state"`
	GameIsAnonymous     bool    `json:"game_is_anonymous" doc:"Whether that game hides player identity"`
	GamePortraitAvatars bool    `json:"game_portrait_avatars" doc:"Whether that game renders avatars as portraits"`

	// Omitted when the GM has set no overrides, which is the common case. The
	// frontend owns the default labels, so absent means "use the defaults" --
	// filling them in here would put the defaults in two places.
	GameCharacterSheet *core.CharacterSheetConfig `json:"game_character_sheet,omitempty" required:"false" doc:"That game's sheet label overrides, absent when it has none"`

	// Username / AssignedUsername come from the embedded CharacterResponse.
	// They are populated here without an anonymity check, which is safe only
	// because of what this query returns: a caller receives their OWN
	// characters, or -- as GM/co-GM -- the cast of a game they run. Both are
	// cases where canSeePlayerNames would return true anyway. If the query is
	// ever widened to include other players' characters, this handler has to
	// start checking. See humaGetUserControllableCharactersAcrossGames.

	UserRole string `json:"user_role" enum:"gm,co_gm,player,audience" doc:"The caller's role in that game"`
}

// InactiveCharacterResponse is one entry of the GM's inactive-character list,
// which carries the ownership history a reassignment decision needs.
//
// This is the one character shape that genuinely earns its own type: the three
// ownership-history fields exist nowhere else, and the endpoint is GM-only
// (403 otherwise). Note that makes it the WIDEST shape, not a narrowed one --
// it withholds nothing, it adds. Everything else it reports comes from the
// embedded CharacterResponse.
type InactiveCharacterResponse struct {
	CharacterResponse

	// Always present but nullable, matching the chi handler: it put the raw
	// nullable column in the map, which encodes as a string or an explicit
	// null -- never as an absent key. Note these have no `omitempty`, unlike
	// most pointers here.
	CurrentOwnerUsername  *string `json:"current_owner_username" doc:"Who holds the character now; null if that account is gone"`
	OriginalOwnerUsername *string `json:"original_owner_username" doc:"Who created the character; null if that account is gone"`

	OriginalOwnerUserID *int32 `json:"original_owner_user_id,omitempty" required:"false" doc:"Original owner"`
}

// CharacterDataResponse is one stored character-sheet field.
type CharacterDataResponse struct {
	ID          int32  `json:"id" doc:"Row ID"`
	CharacterID int32  `json:"character_id" doc:"Character this field belongs to"`
	ModuleType  string `json:"module_type" doc:"Sheet tab, e.g. bio, skills, inventory"`
	FieldName   string `json:"field_name" doc:"Field key within the module"`
	// Nullable in the database, though every row written through the API sets
	// it. Kept nullable rather than defaulted so a legacy NULL row is reported
	// as unknown rather than silently claiming to be text.
	FieldType *string   `json:"field_type" enum:"text,number,boolean,json" doc:"How field_value should be parsed"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	FieldValue *string `json:"field_value,omitempty" required:"false" doc:"Stored value, absent when NULL"`
	IsPublic   *bool   `json:"is_public,omitempty" required:"false" doc:"Whether non-editors may read this field"`
}

// CharacterStatsResponse represents the activity stats response for a character.
//
// PrivateMessages is omitted rather than zeroed when the caller may not see it:
// a 0 would read as "this character has no private messages", which is a
// different and misleading claim.
type CharacterStatsResponse struct {
	PublicMessages  int64  `json:"public_messages" doc:"Messages visible to the whole game"`
	PrivateMessages *int64 `json:"private_messages,omitempty" required:"false" doc:"Omitted when the caller may not see it"`
}
