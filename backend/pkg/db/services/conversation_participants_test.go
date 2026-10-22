package db

import (
	"context"
	"errors"
	"strings"
	"testing"

	"actionphase/pkg/core"
	dbmodels "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// inboxHas reports whether a conversation is in the user's conversation list.
func inboxHas(t *testing.T, service *ConversationService, gameID, userID, conversationID int32) bool {
	t.Helper()
	conversations, err := service.GetUserConversations(context.Background(), gameID, userID)
	require.NoError(t, err)
	for _, c := range conversations {
		if c.ID == conversationID {
			return true
		}
	}
	return false
}

// TestConversationParticipants_FollowNPCAssignment is the reported bug: a GM
// started a conversation as an NPC, then assigned the NPC to an audience member,
// who could not see the conversation -- not even once new messages arrived.
// Whoever controls an NPC must have all of its conversations, history included,
// so an NPC can change hands mid-game.
func TestConversationParticipants_FollowNPCAssignment(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	defer testDB.Close()
	ctx := context.Background()

	service := NewConversationService(testDB.Pool, nil)
	gameService := &GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	charService := &CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	audienceA := testDB.CreateTestUser(t, "audience_a", "a@example.com")
	audienceB := testDB.CreateTestUser(t, "audience_b", "b@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "NPC Handoff")

	_, err := gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(ctx, game.ID, int32(audienceA.ID), "audience")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(ctx, game.ID, int32(audienceB.ID), "audience")
	require.NoError(t, err)

	playerID := int32(player.ID)
	playerChar, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: &playerID, Name: "Hero", CharacterType: "player_character",
	})
	require.NoError(t, err)
	npc, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: nil, Name: "Innkeeper", CharacterType: "npc",
	})
	require.NoError(t, err)

	// The GM, still controlling the NPC, opens a conversation and speaks in it.
	conv, err := service.CreateConversation(ctx, CreateConversationRequest{
		GameID: game.ID, Title: "At the inn", CreatedByUserID: int32(gm.ID),
		ParticipantIDs: []int32{playerChar.ID, npc.ID},
	})
	require.NoError(t, err)
	_, err = service.SendMessage(ctx, SendMessageRequest{
		ConversationID: conv.ID, SenderUserID: int32(gm.ID), SenderCharacterID: npc.ID,
		Content: "Welcome, traveller.",
	})
	require.NoError(t, err)

	require.False(t, inboxHas(t, service, game.ID, int32(audienceA.ID), conv.ID))

	// Hand the NPC to an audience member.
	require.NoError(t, charService.AssignNPCToUser(ctx, npc.ID, int32(audienceA.ID), int32(gm.ID)))

	t.Run("new controller sees the conversation and its history", func(t *testing.T) {
		assert.True(t, inboxHas(t, service, game.ID, int32(audienceA.ID), conv.ID))

		messages, err := service.GetConversationMessages(ctx, conv.ID, int32(audienceA.ID))
		require.NoError(t, err)
		require.Len(t, messages, 1)
		assert.Equal(t, "Welcome, traveller.", messages[0].Content)
	})

	t.Run("new controller can reply as the NPC and read new messages", func(t *testing.T) {
		_, err := service.SendMessage(ctx, SendMessageRequest{
			ConversationID: conv.ID, SenderUserID: int32(audienceA.ID), SenderCharacterID: npc.ID,
			Content: "What'll it be?",
		})
		require.NoError(t, err)

		_, err = service.SendMessage(ctx, SendMessageRequest{
			ConversationID: conv.ID, SenderUserID: playerID, SenderCharacterID: playerChar.ID,
			Content: "An ale, please.",
		})
		require.NoError(t, err)

		messages, err := service.GetConversationMessages(ctx, conv.ID, int32(audienceA.ID))
		require.NoError(t, err)
		assert.Len(t, messages, 3)
	})

	t.Run("GM keeps the conversation, since the GM still controls the NPC", func(t *testing.T) {
		assert.True(t, inboxHas(t, service, game.ID, int32(gm.ID), conv.ID))
	})

	t.Run("reassigning moves the conversation to the next controller", func(t *testing.T) {
		require.NoError(t, charService.AssignNPCToUser(ctx, npc.ID, int32(audienceB.ID), int32(gm.ID)))

		assert.True(t, inboxHas(t, service, game.ID, int32(audienceB.ID), conv.ID))
		assert.False(t, inboxHas(t, service, game.ID, int32(audienceA.ID), conv.ID),
			"a previous controller no longer receives the NPC's conversations")
		assert.True(t, inboxHas(t, service, game.ID, int32(gm.ID), conv.ID))
	})

	t.Run("the player's own row is untouched", func(t *testing.T) {
		assert.True(t, inboxHas(t, service, game.ID, playerID, conv.ID))
	})

	t.Run("conversations started after the handoff include GM and controller", func(t *testing.T) {
		later, err := service.CreateConversation(ctx, CreateConversationRequest{
			GameID: game.ID, Title: "Later", CreatedByUserID: playerID,
			ParticipantIDs: []int32{playerChar.ID, npc.ID},
		})
		require.NoError(t, err)

		assert.True(t, inboxHas(t, service, game.ID, int32(audienceB.ID), later.ID))
		assert.True(t, inboxHas(t, service, game.ID, int32(gm.ID), later.ID))
	})
}

// TestConversationParticipants_FollowCoGMRole: co-GMs control every NPC, so
// promotion brings the game's NPC conversations into their inbox and demotion
// takes them out again.
func TestConversationParticipants_FollowCoGMRole(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	defer testDB.Close()
	ctx := context.Background()

	service := NewConversationService(testDB.Pool, nil)
	gameService := &GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	charService := &CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	helper := testDB.CreateTestUser(t, "helper", "helper@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Co-GM Handoff")

	_, err := gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(ctx, game.ID, int32(helper.ID), "audience")
	require.NoError(t, err)

	playerID := int32(player.ID)
	playerChar, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: &playerID, Name: "Hero", CharacterType: "player_character",
	})
	require.NoError(t, err)
	npc, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: nil, Name: "Innkeeper", CharacterType: "npc",
	})
	require.NoError(t, err)

	conv, err := service.CreateConversation(ctx, CreateConversationRequest{
		GameID: game.ID, Title: "At the inn", CreatedByUserID: int32(gm.ID),
		ParticipantIDs: []int32{playerChar.ID, npc.ID},
	})
	require.NoError(t, err)

	require.NoError(t, gameService.PromoteToCoGM(ctx, game.ID, int32(helper.ID), int32(gm.ID)))
	assert.True(t, inboxHas(t, service, game.ID, int32(helper.ID), conv.ID), "promoted co-GM should have NPC conversations")

	require.NoError(t, gameService.DemoteFromCoGM(ctx, game.ID, int32(helper.ID), int32(gm.ID)))
	assert.False(t, inboxHas(t, service, game.ID, int32(helper.ID), conv.ID), "demoted co-GM should lose NPC conversations")
	assert.True(t, inboxHas(t, service, game.ID, int32(gm.ID), conv.ID))
}

// TestConversationParticipants_RemovedFromGame: a user who leaves or is removed
// from the game no longer controls its NPCs, so loses their conversations. The
// leave endpoint goes through RemovePlayer too (as the user removing
// themselves), so a co-GM who leaves is covered by the same path.
func TestConversationParticipants_RemovedFromGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	defer testDB.Close()
	ctx := context.Background()

	service := NewConversationService(testDB.Pool, nil)
	gameService := &GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	charService := &CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	coGM := testDB.CreateTestUser(t, "cogm", "cogm@example.com")
	assignee := testDB.CreateTestUser(t, "assignee", "assignee@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Departures")

	_, err := gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(ctx, game.ID, int32(coGM.ID), "audience")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(ctx, game.ID, int32(assignee.ID), "audience")
	require.NoError(t, err)
	require.NoError(t, gameService.PromoteToCoGM(ctx, game.ID, int32(coGM.ID), int32(gm.ID)))

	playerID := int32(player.ID)
	playerChar, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: &playerID, Name: "Hero", CharacterType: "player_character",
	})
	require.NoError(t, err)
	innkeeper, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: nil, Name: "Innkeeper", CharacterType: "npc",
	})
	require.NoError(t, err)
	smith, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: nil, Name: "Smith", CharacterType: "npc",
	})
	require.NoError(t, err)
	require.NoError(t, charService.AssignNPCToUser(ctx, smith.ID, int32(assignee.ID), int32(gm.ID)))

	atInn, err := service.CreateConversation(ctx, CreateConversationRequest{
		GameID: game.ID, Title: "At the inn", CreatedByUserID: int32(gm.ID),
		ParticipantIDs: []int32{playerChar.ID, innkeeper.ID},
	})
	require.NoError(t, err)
	atForge, err := service.CreateConversation(ctx, CreateConversationRequest{
		GameID: game.ID, Title: "At the forge", CreatedByUserID: int32(assignee.ID),
		ParticipantIDs: []int32{playerChar.ID, smith.ID},
	})
	require.NoError(t, err)

	require.True(t, inboxHas(t, service, game.ID, int32(coGM.ID), atInn.ID))
	require.True(t, inboxHas(t, service, game.ID, int32(assignee.ID), atForge.ID))

	t.Run("a co-GM who leaves loses the NPC conversations", func(t *testing.T) {
		require.NoError(t, gameService.RemovePlayer(ctx, game.ID, int32(coGM.ID), int32(coGM.ID)))

		assert.False(t, inboxHas(t, service, game.ID, int32(coGM.ID), atInn.ID))
		assert.False(t, inboxHas(t, service, game.ID, int32(coGM.ID), atForge.ID))
		_, err := service.SendMessage(ctx, SendMessageRequest{
			ConversationID: atInn.ID, SenderUserID: int32(coGM.ID), SenderCharacterID: innkeeper.ID,
			Content: "Still here?",
		})
		assert.Error(t, err, "a departed co-GM cannot send as the game's NPCs")
		assert.True(t, inboxHas(t, service, game.ID, int32(gm.ID), atInn.ID))
	})

	t.Run("a removed assignee loses the NPC and its conversations", func(t *testing.T) {
		require.NoError(t, gameService.RemovePlayer(ctx, game.ID, int32(assignee.ID), int32(gm.ID)))

		_, err := dbmodels.New(testDB.Pool).GetNPCAssignment(ctx, smith.ID)
		assert.Error(t, err, "the NPC assignment should be withdrawn")
		assert.False(t, inboxHas(t, service, game.ID, int32(assignee.ID), atForge.ID))
		assert.True(t, inboxHas(t, service, game.ID, int32(gm.ID), atForge.ID),
			"the GM keeps the conversation of an NPC they control again")
	})

	t.Run("the player's own rows are untouched", func(t *testing.T) {
		assert.True(t, inboxHas(t, service, game.ID, playerID, atInn.ID))
		assert.True(t, inboxHas(t, service, game.ID, playerID, atForge.ID))
	})
}

// TestConversationParticipants_FollowCharacterReassignment: an inactive player
// character given to a new owner takes its conversations with it.
func TestConversationParticipants_FollowCharacterReassignment(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	defer testDB.Close()
	ctx := context.Background()

	service := NewConversationService(testDB.Pool, nil)
	gameService := &GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	charService := &CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	leaver := testDB.CreateTestUser(t, "leaver", "leaver@example.com")
	other := testDB.CreateTestUser(t, "other", "other@example.com")
	replacement := testDB.CreateTestUser(t, "replacement", "replacement@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Reassignment")

	for _, u := range []int32{int32(leaver.ID), int32(other.ID), int32(replacement.ID)} {
		_, err := gameService.AddGameParticipant(ctx, game.ID, u, "player")
		require.NoError(t, err)
	}

	leaverID, otherID := int32(leaver.ID), int32(other.ID)
	abandoned, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: &leaverID, Name: "Abandoned", CharacterType: "player_character",
	})
	require.NoError(t, err)
	otherChar, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: &otherID, Name: "Other", CharacterType: "player_character",
	})
	require.NoError(t, err)

	conv, err := service.CreateConversation(ctx, CreateConversationRequest{
		GameID: game.ID, Title: "Plans", CreatedByUserID: leaverID,
		ParticipantIDs: []int32{abandoned.ID, otherChar.ID},
	})
	require.NoError(t, err)

	_, err = charService.ReassignCharacter(ctx, abandoned.ID, int32(replacement.ID))
	require.NoError(t, err)

	assert.True(t, inboxHas(t, service, game.ID, int32(replacement.ID), conv.ID))
	assert.False(t, inboxHas(t, service, game.ID, leaverID, conv.ID))
	assert.True(t, inboxHas(t, service, game.ID, otherID, conv.ID))
}

// TestNotifyPrivateMessage_OnlyAnswerersOfEachCharacter: the GM holds every NPC
// conversation (they can step in as any NPC), but an NPC handed to an audience
// member is that member's to answer. Notifying the GM of every message to an
// assigned NPC would flood them, so a message notifies, per recipient
// character, only who answers for it: the owner of a player character, the
// assignee of an assigned NPC, or the GM and co-GMs for an unassigned one.
func TestNotifyPrivateMessage_OnlyAnswerersOfEachCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	defer testDB.Close()
	ctx := context.Background()

	service := NewConversationService(testDB.Pool, nil)
	gameService := &GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	charService := &CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	coGM := testDB.CreateTestUser(t, "cogm", "cogm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	audience := testDB.CreateTestUser(t, "audience", "audience@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Notifications")

	_, err := gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(ctx, game.ID, int32(audience.ID), "audience")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(ctx, game.ID, int32(coGM.ID), "audience")
	require.NoError(t, err)
	require.NoError(t, gameService.PromoteToCoGM(ctx, game.ID, int32(coGM.ID), int32(gm.ID)))

	playerID := int32(player.ID)
	playerChar, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: &playerID, Name: "Hero", CharacterType: "player_character",
	})
	require.NoError(t, err)
	assigned, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: nil, Name: "Innkeeper", CharacterType: "npc",
	})
	require.NoError(t, err)
	gmsOwn, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: nil, Name: "Mayor", CharacterType: "npc",
	})
	require.NoError(t, err)
	require.NoError(t, charService.AssignNPCToUser(ctx, assigned.ID, int32(audience.ID), int32(gm.ID)))

	// send stores a message and runs the notifier synchronously, returning how
	// many private-message notifications each user received for it.
	send := func(t *testing.T, convID, senderUserID, senderCharID int32) map[int32]int {
		t.Helper()
		_, err := testDB.Pool.Exec(ctx, "DELETE FROM notifications")
		require.NoError(t, err)
		msg, err := service.Queries.SendPrivateMessage(ctx, dbmodels.SendPrivateMessageParams{
			ConversationID:    convID,
			SenderUserID:      senderUserID,
			SenderCharacterID: pgtype.Int4{Int32: senderCharID, Valid: true},
			Content:           "hello",
		})
		require.NoError(t, err)
		service.notifyPrivateMessage(ctx, convID, senderUserID, senderCharID, msg.ID)

		rows, err := testDB.Pool.Query(ctx, "SELECT user_id, COUNT(*) FROM notifications WHERE type = $1 GROUP BY user_id", core.NotificationTypePrivateMessage)
		require.NoError(t, err)
		defer rows.Close()
		counts := map[int32]int{}
		for rows.Next() {
			var userID int32
			var n int
			require.NoError(t, rows.Scan(&userID, &n))
			counts[userID] = n
		}
		require.NoError(t, rows.Err())
		return counts
	}

	gmID, coGMID, audienceID := int32(gm.ID), int32(coGM.ID), int32(audience.ID)

	withAssigned, err := service.CreateConversation(ctx, CreateConversationRequest{
		GameID: game.ID, Title: "Player and assigned NPC", CreatedByUserID: playerID,
		ParticipantIDs: []int32{playerChar.ID, assigned.ID},
	})
	require.NoError(t, err)

	t.Run("player writing to an assigned NPC notifies its assignee, not the GMs", func(t *testing.T) {
		got := send(t, withAssigned.ID, playerID, playerChar.ID)
		assert.Equal(t, map[int32]int{audienceID: 1}, got)
	})

	t.Run("assignee writing as the NPC notifies the player, not the GMs", func(t *testing.T) {
		got := send(t, withAssigned.ID, audienceID, assigned.ID)
		assert.Equal(t, map[int32]int{playerID: 1}, got)
	})

	t.Run("GM stepping in as an assigned NPC still tells its assignee", func(t *testing.T) {
		got := send(t, withAssigned.ID, gmID, assigned.ID)
		assert.Equal(t, map[int32]int{playerID: 1, audienceID: 1}, got)
	})

	t.Run("an unassigned NPC among the recipients notifies the GMs once each", func(t *testing.T) {
		withBoth, err := service.CreateConversation(ctx, CreateConversationRequest{
			GameID: game.ID, Title: "Both NPCs", CreatedByUserID: playerID,
			ParticipantIDs: []int32{playerChar.ID, assigned.ID, gmsOwn.ID},
		})
		require.NoError(t, err)

		got := send(t, withBoth.ID, playerID, playerChar.ID)
		assert.Equal(t, map[int32]int{gmID: 1, coGMID: 1, audienceID: 1}, got)
	})

	// Regression: one character whose answerers could not be resolved used to
	// abort the whole notifier, so nobody heard about the message.
	t.Run("failing to resolve one character still notifies the others", func(t *testing.T) {
		withBoth, err := service.CreateConversation(ctx, CreateConversationRequest{
			GameID: game.ID, Title: "GM lookup fails", CreatedByUserID: audienceID,
			ParticipantIDs: []int32{playerChar.ID, assigned.ID, gmsOwn.ID},
		})
		require.NoError(t, err)

		// The unassigned NPC is the only character whose answerers need the
		// GM team, so failing that lookup fails it alone.
		healthy := service.Queries
		service.Queries = dbmodels.New(failingQuery{DBTX: testDB.Pool, name: "GetGameCoGMs"})
		defer func() { service.Queries = healthy }()

		got := send(t, withBoth.ID, audienceID, assigned.ID)
		assert.Equal(t, map[int32]int{playerID: 1}, got)
	})
}

// failingQuery fails the sqlc query with the given name and passes every other
// one through, to exercise a lookup failing mid-operation.
type failingQuery struct {
	dbmodels.DBTX
	name string
}

func (f failingQuery) failing(sql string) bool {
	return strings.HasPrefix(sql, "-- name: "+f.name+" ")
}

func (f failingQuery) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	if f.failing(sql) {
		return nil, errors.New("injected failure")
	}
	return f.DBTX.Query(ctx, sql, args...)
}

// TestConversationLists_OneEntryPerConversation: the GM and co-GMs hold a
// participant row for every NPC in a conversation, so a conversation with two
// NPCs gives the GM two rows. The inbox and the dashboard's unread preview must
// still list it once; the preview is capped, so a duplicate takes a slot from
// another conversation. For the same reason, participant_count counts
// characters, not rows.
func TestConversationLists_OneEntryPerConversation(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	defer testDB.Close()
	ctx := context.Background()

	service := NewConversationService(testDB.Pool, nil)
	gameService := &GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	charService := &CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	audience := testDB.CreateTestUser(t, "audience", "audience@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Two NPCs")

	_, err := gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(ctx, game.ID, int32(audience.ID), "audience")
	require.NoError(t, err)

	playerID := int32(player.ID)
	playerChar, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: &playerID, Name: "Hero", CharacterType: "player_character",
	})
	require.NoError(t, err)
	assigned, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: nil, Name: "Innkeeper", CharacterType: "npc",
	})
	require.NoError(t, err)
	unassigned, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: nil, Name: "Mayor", CharacterType: "npc",
	})
	require.NoError(t, err)
	require.NoError(t, charService.AssignNPCToUser(ctx, assigned.ID, int32(audience.ID), int32(gm.ID)))

	conv, err := service.CreateConversation(ctx, CreateConversationRequest{
		GameID: game.ID, Title: "Council", CreatedByUserID: playerID,
		ParticipantIDs: []int32{playerChar.ID, assigned.ID, unassigned.ID},
	})
	require.NoError(t, err)
	_, err = service.SendMessage(ctx, SendMessageRequest{
		ConversationID: conv.ID, SenderUserID: playerID, SenderCharacterID: playerChar.ID,
		Content: "Shall we begin?",
	})
	require.NoError(t, err)

	gmID := int32(gm.ID)

	t.Run("inbox", func(t *testing.T) {
		conversations, err := service.GetUserConversations(ctx, game.ID, gmID)
		require.NoError(t, err)
		require.Len(t, conversations, 1)
		assert.Equal(t, conv.ID, conversations[0].ID)
		assert.EqualValues(t, 3, conversations[0].ParticipantCount, "Hero, Innkeeper and Mayor")
	})

	t.Run("unread preview", func(t *testing.T) {
		unread, err := service.GetUserUnreadConversations(ctx, game.ID, gmID, 3)
		require.NoError(t, err)
		require.Len(t, unread, 1)
		assert.Equal(t, conv.ID, unread[0].ID)
		assert.EqualValues(t, 1, unread[0].UnreadCount)
		assert.EqualValues(t, 3, unread[0].ParticipantCount, "Hero, Innkeeper and Mayor")
	})
}

// TestListExportConversationParticipants_OneEntryPerCharacter: participant rows
// name whoever controls a character now -- for an NPC, the GM, every co-GM and
// its assignee -- so they can't say who played it in an archived conversation.
// The export lists each character once, labelled with the users who actually
// spoke as it there, so a previous controller is kept and the GM team is not
// listed against an NPC they never voiced.
func TestListExportConversationParticipants_OneEntryPerCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	defer testDB.Close()
	ctx := context.Background()

	service := NewConversationService(testDB.Pool, nil)
	gameService := &GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	charService := &CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	coGM := testDB.CreateTestUser(t, "cogm", "cogm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	first := testDB.CreateTestUser(t, "first_voice", "first@example.com")
	second := testDB.CreateTestUser(t, "second_voice", "second@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Export")

	_, err := gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	for _, u := range []int32{int32(coGM.ID), int32(first.ID), int32(second.ID)} {
		_, err = gameService.AddGameParticipant(ctx, game.ID, u, "audience")
		require.NoError(t, err)
	}
	require.NoError(t, gameService.PromoteToCoGM(ctx, game.ID, int32(coGM.ID), int32(gm.ID)))

	playerID := int32(player.ID)
	playerChar, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: &playerID, Name: "Hero", CharacterType: "player_character",
	})
	require.NoError(t, err)
	handedOff, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: nil, Name: "Innkeeper", CharacterType: "npc",
	})
	require.NoError(t, err)
	silent, err := charService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID: game.ID, UserID: nil, Name: "Mayor", CharacterType: "npc",
	})
	require.NoError(t, err)

	require.NoError(t, charService.AssignNPCToUser(ctx, handedOff.ID, int32(first.ID), int32(gm.ID)))
	conv, err := service.CreateConversation(ctx, CreateConversationRequest{
		GameID: game.ID, Title: "At the inn", CreatedByUserID: playerID,
		ParticipantIDs: []int32{playerChar.ID, handedOff.ID, silent.ID},
	})
	require.NoError(t, err)
	send := func(userID, charID int32) {
		_, err := service.SendMessage(ctx, SendMessageRequest{
			ConversationID: conv.ID, SenderUserID: userID, SenderCharacterID: charID, Content: "hi",
		})
		require.NoError(t, err)
	}
	send(int32(first.ID), handedOff.ID)
	require.NoError(t, charService.AssignNPCToUser(ctx, handedOff.ID, int32(second.ID), int32(gm.ID)))
	send(int32(second.ID), handedOff.ID)

	rows, err := service.Queries.ListExportConversationParticipants(ctx, game.ID)
	require.NoError(t, err)

	got := make([]string, 0, len(rows))
	for _, r := range rows {
		require.Equal(t, conv.ID, r.ConversationID)
		got = append(got, r.CharacterName.String+"/"+r.Username)
	}
	assert.ElementsMatch(t, []string{
		"Hero/" + player.Username,
		"Innkeeper/" + first.Username,
		"Innkeeper/" + second.Username,
		"Mayor/",
	}, got)
}
