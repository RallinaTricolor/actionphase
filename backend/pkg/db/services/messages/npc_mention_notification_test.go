package messages

import (
	"context"
	"testing"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNotifyCharacterMentions_AudienceControlledNPC is a regression test for the bug where
// NPC mention notifications were sent to the GM instead of the audience member controlling the NPC.
func TestNotifyCharacterMentions_AudienceControlledNPC(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	notificationService := &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	ctx := context.Background()

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	audienceMember := testDB.CreateTestUser(t, "audience", "audience@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(ctx, game.ID, int32(audienceMember.ID), "audience")
	require.NoError(t, err)

	// Create a player character (the author who will do the mentioning)
	playerChar, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create an NPC
	npc, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "Sauron",
		CharacterType: "npc",
	})
	require.NoError(t, err)

	// Assign the NPC to the audience member
	queries := models.New(testDB.Pool)
	_, err = queries.AssignNPCToAudience(ctx, models.AssignNPCToAudienceParams{
		CharacterID:      npc.ID,
		AssignedUserID:   int32(audienceMember.ID),
		AssignedByUserID: int32(gm.ID),
	})
	require.NoError(t, err)

	// Record notification counts before
	gmNotifsBefore, err := notificationService.GetUserNotifications(ctx, int32(gm.ID), 50, 0)
	require.NoError(t, err)
	audienceNotifsBefore, err := notificationService.GetUserNotifications(ctx, int32(audienceMember.ID), 50, 0)
	require.NoError(t, err)

	// Create a fake message ID for the notification
	fakeMessageID := int32(9999)

	// Call notifyCharacterMentions directly (synchronously, not in goroutine)
	service.notifyCharacterMentions(ctx, []int32{npc.ID}, playerChar.ID, int32(player.ID), game.ID, fakeMessageID)

	// Check notifications after
	gmNotifsAfter, err := notificationService.GetUserNotifications(ctx, int32(gm.ID), 50, 0)
	require.NoError(t, err)
	audienceNotifsAfter, err := notificationService.GetUserNotifications(ctx, int32(audienceMember.ID), 50, 0)
	require.NoError(t, err)

	// The audience member should receive the notification, not the GM
	assert.Equal(t, len(audienceNotifsBefore)+1, len(audienceNotifsAfter),
		"Audience member controlling the NPC should receive the mention notification")
	assert.Equal(t, len(gmNotifsBefore), len(gmNotifsAfter),
		"GM should NOT receive the mention notification when NPC is controlled by an audience member")

	// Verify notification content
	var mentionNotif *core.Notification
	for _, n := range audienceNotifsAfter {
		if n.Type == core.NotificationTypeCharacterMention {
			mentionNotif = n
			break
		}
	}
	require.NotNil(t, mentionNotif, "Audience member should have a character_mention notification")
}

// TestNotifyCharacterMentions_UnassignedNPC verifies that unassigned NPCs still notify the GM.
func TestNotifyCharacterMentions_UnassignedNPC(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	notificationService := &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	ctx := context.Background()

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	playerChar, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create an NPC that is NOT assigned to anyone
	npc, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "Orc",
		CharacterType: "npc",
	})
	require.NoError(t, err)

	gmNotifsBefore, err := notificationService.GetUserNotifications(ctx, int32(gm.ID), 50, 0)
	require.NoError(t, err)

	fakeMessageID := int32(9998)
	service.notifyCharacterMentions(ctx, []int32{npc.ID}, playerChar.ID, int32(player.ID), game.ID, fakeMessageID)

	gmNotifsAfter, err := notificationService.GetUserNotifications(ctx, int32(gm.ID), 50, 0)
	require.NoError(t, err)

	assert.Equal(t, len(gmNotifsBefore)+1, len(gmNotifsAfter),
		"GM should receive the mention notification for an unassigned NPC")
}
