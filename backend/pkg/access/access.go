// Package access declares, per operation, who may call a game-scoped route,
// and enforces it before the handler runs.
//
// Why it exists: every route under /games/{gameID} used to decide its own
// authorization inside the handler, so the safe outcome depended on each author
// picking the right helper. The audience oversight endpoints picked the
// participant check, and any player could read every private conversation and
// action submission in their game. Here the level is one word at registration,
// visible in the generated spec as x-access, and a route that declares nothing
// is refused.
//
// Routes that address a game's row by its own ID (/characters/{id},
// /polls/{pollId}) declare levels the same way. ResourceMiddleware reads the
// game from that row, so the level is checked against the game the row
// really belongs to.
//
// A declared level is a FLOOR, not the whole rule. Handlers keep their own
// checks, which are often stricter (primary GM only, row-level filtering, a
// child ID scoped to the game). What the floor guarantees is that a route can
// never be more open than its declaration.
package access

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// Level is who may reach a game-scoped operation.
type Level string

const (
	// Member: anyone in the game (any role, any status the participant query
	// admits), the GM flag, or anyone at all once the game is a public archive.
	Member Level = "member"
	// Audience: the GM flag (GM, co-GMs, a site admin in admin mode), audience
	// members, or anyone once the game is a public archive. For views of other
	// players' secrets: every private conversation, every action submission
	// and result, who controls each NPC.
	Audience Level = "audience"
	// GM: the is_gm flag GameMiddleware sets -- the GM, co-GMs, and a site
	// admin with admin mode on.
	GM Level = "gm"
	// Public: no game-level gate; the route serves callers with no relationship
	// to the game. Requires a reason.
	Public Level = "public"
	// Handler: the gate cannot be expressed as one of the levels above, so the
	// handler owns it entirely. Requires a reason. Use sparingly: this is the
	// opt-in authorization the package exists to replace.
	Handler Level = "handler"
)

// Extension keys written into each operation's OpenAPI extensions.
const (
	ExtensionKey = "x-access"
	ReasonKey    = "x-access-reason"
)

// Levels lists every valid level, for tests that validate declarations.
var Levels = []Level{Member, Audience, GM, Public, Handler}

// Reasons shared by the Public routes. A route whose reason is its own spells
// it out at the call site instead.
const (
	// The game's page, roster, schedule and phase list.
	ReasonGameInfo = "public game information, open to any logged-in user"
	// Common Room reads. Restricted posts are still filtered per viewer by the
	// message service; this only says the room itself has no member gate.
	ReasonCommonRoom = "the Common Room is open to any logged-in user; restricted posts are filtered per viewer"
	// The caller's own rows: read markers, favourites, their application,
	// their own actions and results. A non-member gets an empty answer.
	ReasonOwnRecords = "reads or changes only the caller's own records"
	// Polls and their results. Individual votes, and hidden results, are
	// still filtered per viewer by the poll handlers.
	ReasonPolls = "polls are open to any logged-in user; individual votes are filtered per viewer"
)

// Declarations: assign one to huma.Operation.Extensions.

// MembersOnly declares the Member level.
func MembersOnly() map[string]any { return map[string]any{ExtensionKey: string(Member)} }

// PublicRoute declares a route with no game-level gate, and why.
func PublicRoute(reason string) map[string]any {
	return map[string]any{ExtensionKey: string(Public), ReasonKey: reason}
}

// AudienceOnly declares the Audience level.
func AudienceOnly() map[string]any { return map[string]any{ExtensionKey: string(Audience)} }

// GMOnly declares the GM level.
func GMOnly() map[string]any { return map[string]any{ExtensionKey: string(GM)} }

// CheckedInHandler declares a route whose handler owns its gate, and why.
func CheckedInHandler(reason string) map[string]any {
	return map[string]any{ExtensionKey: string(Handler), ReasonKey: reason}
}

// LevelOf reports the level an operation declares, if any.
func LevelOf(op *huma.Operation) (Level, bool) {
	if op == nil || op.Extensions == nil {
		return "", false
	}
	raw, ok := op.Extensions[ExtensionKey].(string)
	if !ok || raw == "" {
		return "", false
	}
	return Level(raw), true
}

// Checker is the participant lookups the levels need. Both take a game the
// caller has already loaded, so neither re-reads the games row.
type Checker interface {
	// CheckAudienceAccess: an active co-GM or audience row (or the primary GM).
	CheckAudienceAccess(ctx context.Context, gameID, userID int32) (bool, error)
	// IsActiveParticipant: an active game_participants row of any role. The
	// primary GM has none; Allows covers them through isGM.
	IsActiveParticipant(ctx context.Context, gameID, userID int32) (bool, error)
}

// Allows reports whether user may reach a route of this level in game. isGM
// is the flag GameMiddleware resolved for this request.
//
// This is the ONLY definition of what each level means. Handlers that still
// gate inline for the same level call it rather than restating the rule.
// Public and Handler always allow: they put no gate here by definition. An
// unknown level denies.
func Allows(ctx context.Context, checker Checker, level Level, game *models.Game, user *core.AuthenticatedUser, isGM bool) (bool, error) {
	switch level {
	case Public, Handler:
		return true, nil
	}
	if game == nil || user == nil {
		return false, nil
	}

	if level == GM {
		return isGM, nil
	}
	// Every level below admits whoever passes GM: a site admin in admin mode
	// moderates through the oversight reads as well as the GM writes.
	if isGM || core.IsPublicArchive(game.State) {
		return level == Audience || level == Member, nil
	}
	switch level {
	case Audience:
		return checker.CheckAudienceAccess(ctx, game.ID, user.ID)
	case Member:
		return checker.IsActiveParticipant(ctx, game.ID, user.ID)
	default:
		return false, nil
	}
}
