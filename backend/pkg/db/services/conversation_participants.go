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
// syncCharacterConversationParticipants:
//
//   - NPC assigned or taken back (CharacterService.AssignNPCToUser)
//   - inactive character given a new owner (CharacterService.ReassignCharacter)
//   - co-GM promoted or demoted, which changes who controls every NPC in the
//     game (GameService.PromoteToCoGM / DemoteFromCoGM)

// characterControllerUserIDs returns the users who control a character, and so
// hold its participant rows.
//
// A player character belongs to its owner alone. An NPC is controlled by the
// GM, every co-GM and the user it is assigned to, matching
// core.CanUserControlNPC: an assigned NPC stays in the GM's inbox, since the GM
// can still send as it. A character with no owner is treated as an NPC so it
// is never left without a participant row (which would drop it from the
// conversation's participant list).
func characterControllerUserIDs(ctx context.Context, q *models.Queries, char models.Character) ([]int32, error) {
	if char.CharacterType != "npc" && char.UserID.Valid {
		return []int32{char.UserID.Int32}, nil
	}
	gmUserIDs, assignee, err := npcControl(ctx, q, char)
	if err != nil {
		return nil, err
	}
	if assignee != nil {
		gmUserIDs = append(gmUserIDs, *assignee)
	}
	return uniqueUserIDs(gmUserIDs), nil
}

// characterAnswererUserIDs returns the users who answer for a character, and so
// are notified of messages to it: a player character's owner, an assigned
// NPC's assignee, or, for an unassigned NPC, the GM and co-GMs.
//
// This is narrower than characterControllerUserIDs on purpose. The GMs keep
// every NPC conversation so they can step in, but an NPC handed to someone
// else is theirs to answer, and notifying the GMs of every message to it would
// bury the ones about NPCs they actually play.
func characterAnswererUserIDs(ctx context.Context, q *models.Queries, char models.Character) ([]int32, error) {
	if char.CharacterType != "npc" && char.UserID.Valid {
		return []int32{char.UserID.Int32}, nil
	}
	gmUserIDs, assignee, err := npcControl(ctx, q, char)
	if err != nil {
		return nil, err
	}
	if assignee != nil {
		return []int32{*assignee}, nil
	}
	return uniqueUserIDs(gmUserIDs), nil
}

// npcControl returns the GM and co-GMs of an NPC's game, and the user the NPC
// is assigned to (nil when unassigned).
func npcControl(ctx context.Context, q *models.Queries, char models.Character) ([]int32, *int32, error) {
	game, err := q.GetGame(ctx, char.GameID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get game: %w", err)
	}
	coGMUserIDs, err := q.GetGameCoGMs(ctx, char.GameID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get co-GMs: %w", err)
	}
	gmUserIDs := append([]int32{game.GmUserID}, coGMUserIDs...)

	assignment, err := q.GetNPCAssignment(ctx, char.ID)
	switch {
	case err == nil:
		return gmUserIDs, &assignment.AssignedUserID, nil
	case errors.Is(err, pgx.ErrNoRows):
		return gmUserIDs, nil, nil
	default:
		return nil, nil, fmt.Errorf("failed to get NPC assignment: %w", err)
	}
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
	userIDs, err := characterControllerUserIDs(ctx, q, char)
	if err != nil {
		return err
	}

	charID := pgtype.Int4{Int32: characterID, Valid: true}
	// Add before removing: the insert finds the character's conversations
	// through its existing rows.
	if err := q.AddCharacterControllersToConversations(ctx, models.AddCharacterControllersToConversationsParams{
		UserIds:     userIDs,
		CharacterID: charID,
	}); err != nil {
		return fmt.Errorf("failed to add conversation participants for character %d: %w", characterID, err)
	}
	if err := q.RemoveCharacterControllersFromConversations(ctx, models.RemoveCharacterControllersFromConversationsParams{
		CharacterID: charID,
		UserIds:     userIDs,
	}); err != nil {
		return fmt.Errorf("failed to remove conversation participants for character %d: %w", characterID, err)
	}
	return nil
}

// syncGameNPCConversationParticipants re-syncs every NPC in a game. A co-GM
// change alters who controls all of them at once.
func syncGameNPCConversationParticipants(ctx context.Context, q *models.Queries, gameID int32) error {
	npcs, err := q.GetNPCsByGame(ctx, gameID)
	if err != nil {
		return fmt.Errorf("failed to list NPCs: %w", err)
	}
	for _, npc := range npcs {
		if err := syncCharacterConversationParticipants(ctx, q, npc.ID); err != nil {
			return err
		}
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
