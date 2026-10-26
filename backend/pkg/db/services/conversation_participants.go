package db

import (
	"context"
	"errors"
	"fmt"

	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// Conversation participants follow control of the character
//
// A conversation_participants row says "this user sees this conversation, as
// this character". Its user_id is what the inbox, message reads, sends, read
// tracking and notifications all key on, so it must name whoever controls the
// character NOW, not whoever did when the conversation was created.
//
// Rows were once written only at creation, so an NPC handed to an audience
// member mid-game took none of its conversations with it: the new controller
// could not see them, even as new messages arrived. Every change of control
// therefore re-syncs the character's rows through
// syncCharacterConversationParticipants (or, for a whole game's NPCs at once,
// syncGameNPCConversationParticipants):
//
//   - NPC assigned or taken back (CharacterService.AssignNPCToUser)
//   - inactive character given a new owner (CharacterService.ReassignCharacter)
//   - co-GM promoted or demoted, which changes who controls every NPC in the
//     game (GameService.PromoteToCoGM / DemoteFromCoGM)
//   - a co-GM or NPC assignee leaving or removed from the game
//     (GameService.RemovePlayer, which also withdraws their NPC assignments)

// characterControl is what decides who controls and answers for a character:
// its type, its owner and, for an NPC, the user it is assigned to.
type characterControl struct {
	characterType  string
	ownerUserID    pgtype.Int4
	assigneeUserID pgtype.Int4
}

// isPlayerCharacter reports whether the character belongs to its owner alone.
// A character with no owner is treated as an NPC, so it is never left without
// a participant row (which would drop it from the conversation's participant
// list).
func (c characterControl) isPlayerCharacter() bool {
	return c.characterType != "npc" && c.ownerUserID.Valid
}

// controllers returns the users who control a character, and so hold its
// participant rows.
//
// A player character belongs to its owner alone. An NPC is controlled by the
// GM, every co-GM and the user it is assigned to, matching
// core.CanUserControlNPC: an assigned NPC stays in the GM's inbox, since the GM
// can still send as it.
func (c characterControl) controllers(ctx context.Context, gms *gameGMs) ([]int32, error) {
	if c.isPlayerCharacter() {
		return []int32{c.ownerUserID.Int32}, nil
	}
	gmUserIDs, err := gms.userIDs(ctx)
	if err != nil {
		return nil, err
	}
	ids := append([]int32{}, gmUserIDs...)
	if c.assigneeUserID.Valid {
		ids = append(ids, c.assigneeUserID.Int32)
	}
	return uniqueUserIDs(ids), nil
}

// answerers returns the users who answer for a character, and so are notified
// of messages to it: a player character's owner, an assigned NPC's assignee,
// or, for an unassigned NPC, the GM and co-GMs.
//
// This is narrower than controllers on purpose. The GMs keep every NPC
// conversation so they can step in, but an NPC handed to someone else is
// theirs to answer, and notifying the GMs of every message to it would bury
// the ones about NPCs they actually play.
func (c characterControl) answerers(ctx context.Context, gms *gameGMs) ([]int32, error) {
	if c.isPlayerCharacter() {
		return []int32{c.ownerUserID.Int32}, nil
	}
	if c.assigneeUserID.Valid {
		return []int32{c.assigneeUserID.Int32}, nil
	}
	return gms.userIDs(ctx)
}

// loadCharacterControl reads a character's NPC assignment, when it can have
// one, to complete its characterControl.
func loadCharacterControl(ctx context.Context, q *models.Queries, char models.Character) (characterControl, error) {
	c := characterControl{characterType: char.CharacterType, ownerUserID: char.UserID}
	if c.isPlayerCharacter() {
		return c, nil
	}
	assignment, err := q.GetNPCAssignment(ctx, char.ID)
	switch {
	case err == nil:
		c.assigneeUserID = pgtype.Int4{Int32: assignment.AssignedUserID, Valid: true}
	case !errors.Is(err, pgx.ErrNoRows):
		return c, fmt.Errorf("failed to get NPC assignment: %w", err)
	}
	return c, nil
}

// gameGMs is a game's GM and co-GMs, who control every NPC in it. It is
// fetched on first use and then shared, so resolving many NPCs costs one
// lookup, and none when every character is a player character.
type gameGMs struct {
	q      *models.Queries
	gameID int32
	ids    []int32
	loaded bool
}

func newGameGMs(q *models.Queries, gameID int32) *gameGMs {
	return &gameGMs{q: q, gameID: gameID}
}

func (g *gameGMs) userIDs(ctx context.Context) ([]int32, error) {
	if g.loaded {
		return g.ids, nil
	}
	game, err := g.q.GetGame(ctx, g.gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game: %w", err)
	}
	coGMUserIDs, err := g.q.GetGameCoGMs(ctx, g.gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get co-GMs: %w", err)
	}
	g.ids = uniqueUserIDs(append([]int32{game.GmUserID}, coGMUserIDs...))
	g.loaded = true
	return g.ids, nil
}

// syncCharacterConversationParticipants makes a character's participant rows,
// in every conversation it is part of, match its current controllers: new
// controllers gain the conversations (history included), previous ones lose
// them. Run it in the same transaction as the change of control.
func syncCharacterConversationParticipants(ctx context.Context, q *models.Queries, characterID int32) error {
	char, err := q.GetCharacter(ctx, characterID)
	if err != nil {
		return fmt.Errorf("failed to get character %d: %w", characterID, err)
	}
	control, err := loadCharacterControl(ctx, q, char)
	if err != nil {
		return err
	}
	userIDs, err := control.controllers(ctx, newGameGMs(q, char.GameID))
	if err != nil {
		return err
	}
	return syncConversationControllers(ctx, q, map[int32][]int32{characterID: userIDs})
}

// syncGameNPCConversationParticipants re-syncs every NPC in a game. A co-GM
// change alters who controls all of them at once, so the NPCs (with their
// assignments) and the GM team are each read once and the rows rewritten in
// two statements, however many NPCs the game has.
func syncGameNPCConversationParticipants(ctx context.Context, q *models.Queries, gameID int32) error {
	npcs, err := q.GetNPCsByGame(ctx, gameID)
	if err != nil {
		return fmt.Errorf("failed to list NPCs: %w", err)
	}
	gms := newGameGMs(q, gameID)
	controllers := make(map[int32][]int32, len(npcs))
	for _, npc := range npcs {
		control := characterControl{
			characterType:  npc.CharacterType,
			ownerUserID:    npc.UserID,
			assigneeUserID: npc.AssignedUserID,
		}
		if controllers[npc.ID], err = control.controllers(ctx, gms); err != nil {
			return err
		}
	}
	return syncConversationControllers(ctx, q, controllers)
}

// syncConversationControllers gives each character's controllers (character ID
// -> user IDs) its participant rows in every conversation it is in, and takes
// them from anyone else.
func syncConversationControllers(ctx context.Context, q *models.Queries, controllers map[int32][]int32) error {
	if len(controllers) == 0 {
		return nil
	}
	var characterIDs, userIDs []int32
	for characterID, users := range controllers {
		for _, userID := range users {
			characterIDs = append(characterIDs, characterID)
			userIDs = append(userIDs, userID)
		}
	}

	// Add before removing: the insert finds the characters' conversations
	// through their existing rows.
	if err := q.AddControllersToCharacterConversations(ctx, models.AddControllersToCharacterConversationsParams{
		CharacterIds: characterIDs,
		UserIds:      userIDs,
	}); err != nil {
		return fmt.Errorf("failed to add conversation participants: %w", err)
	}
	if err := q.RemoveNonControllersFromCharacterConversations(ctx, models.RemoveNonControllersFromCharacterConversationsParams{
		CharacterIds: characterIDs,
		UserIds:      userIDs,
	}); err != nil {
		return fmt.Errorf("failed to remove conversation participants: %w", err)
	}
	return nil
}

func uniqueUserIDs(ids []int32) []int32 {
	seen := make(map[int32]bool, len(ids))
	out := make([]int32, 0, len(ids))
	for _, id := range ids {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}
