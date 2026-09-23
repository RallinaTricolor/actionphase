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

// Mentions of hidden NPCs.
//
// An @mention is an outbound reference to a character -- the same act as naming
// one when starting a conversation -- so it is gated the same way. Gating a
// mention has THREE observable effects, and each is asserted separately here: a
// test that only checked the returned ID slice would pass while the
// notification still fired and confirmed the NPC exists.
//
//  1. The ID is absent from messages.mentioned_character_ids (which ships on
//     the wire in every message response).
//  2. No mention notification is created.
//  3. The frontend renders plain text, because it highlights only characters
//     present in the roster -- covered by the roster gate, not here.
//
// The counterpart assertions matter just as much: the GM's mention of the same
// NPC must still resolve, or hiding has simply made the NPC unmentionable.

type hiddenMentionFixture struct {
	game       *models.Game
	gm         *core.User
	player     *core.User
	playerChar *models.Character
	gmChar     *models.Character
	hiddenNPC  *models.Character
	visibleNPC *models.Character
}

func setupHiddenMentionFixture(t *testing.T, testDB *core.TestDatabase, app *core.App) *hiddenMentionFixture {
	t.Helper()
	ctx := context.Background()

	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "mention_gm", "mention_gm@example.com")
	player := testDB.CreateTestUser(t, "mention_player", "mention_player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Hidden Mention Game")

	_, err := gameService.AddGameParticipant(ctx, game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	playerChar, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Speaker",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	gmChar, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(gm.ID)),
		Name:          "Narrator",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	hiddenNPC, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "Masked Informant",
		CharacterType: "npc",
	})
	require.NoError(t, err)
	_, err = characterService.SetCharacterHidden(ctx, hiddenNPC.ID, true)
	require.NoError(t, err)

	visibleNPC, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "Town Crier",
		CharacterType: "npc",
	})
	require.NoError(t, err)

	return &hiddenMentionFixture{
		game: game, gm: gm, player: player,
		playerChar: playerChar, gmChar: gmChar,
		hiddenNPC: hiddenNPC, visibleNPC: visibleNPC,
	}
}

// TestExtractCharacterMentions_HiddenNPCScopedToAuthor is the resolution gate
// itself: same content, same game, different author, different result.
func TestExtractCharacterMentions_HiddenNPCScopedToAuthor(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	ctx := context.Background()

	f := setupHiddenMentionFixture(t, testDB, app)

	// Both NPCs are named, so a gate that suppressed mentions wholesale would
	// fail on the visible one.
	content := "Word from @Masked Informant and @Town Crier."

	t.Run("player's mention of the hidden NPC does not resolve", func(t *testing.T) {
		ids, err := service.extractCharacterMentions(ctx, content, f.game.ID, int32(f.player.ID))
		require.NoError(t, err)

		assert.NotContains(t, ids, f.hiddenNPC.ID,
			"A player must not resolve a hidden NPC: the pill would confirm it exists")
		assert.Contains(t, ids, f.visibleNPC.ID,
			"The gate must be scoped to hidden NPCs, not mentions generally")
	})

	t.Run("gm's mention of the same NPC does resolve", func(t *testing.T) {
		ids, err := service.extractCharacterMentions(ctx, content, f.game.ID, int32(f.gm.ID))
		require.NoError(t, err)

		assert.Contains(t, ids, f.hiddenNPC.ID,
			"Hiding must not make the NPC unmentionable by the GM who hid it")
		assert.Contains(t, ids, f.visibleNPC.ID, "The visible NPC resolves for the GM too")
	})

	t.Run("public archive resolves the hidden NPC for everyone", func(t *testing.T) {
		_, err := testDB.Pool.Exec(ctx, "UPDATE games SET state = 'completed' WHERE id = $1", f.game.ID)
		require.NoError(t, err)

		ids, err := service.extractCharacterMentions(ctx, content, f.game.ID, int32(f.player.ID))
		require.NoError(t, err)

		assert.Contains(t, ids, f.hiddenNPC.ID,
			"A completed game is a public archive; its hidden cast is disclosed")
	})
}

// TestCreatePost_HiddenNPCMentionStoresNoID covers the wire effect: the hidden
// NPC's ID must not reach messages.mentioned_character_ids, which ships in
// every message response.
func TestCreatePost_HiddenNPCMentionStoresNoID(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &MessageService{
		DB:      testDB.Pool,
		Logger:  app.ObsLogger,
		Metrics: app.Observability.OTELMetrics,
	}
	ctx := context.Background()

	f := setupHiddenMentionFixture(t, testDB, app)

	storedIDsFor := func(t *testing.T, postID int32) []int32 {
		t.Helper()
		var stored []int32
		err := testDB.Pool.QueryRow(ctx,
			"SELECT mentioned_character_ids FROM messages WHERE id = $1", postID).Scan(&stored)
		require.NoError(t, err)
		return stored
	}

	t.Run("player's post stores no hidden ID", func(t *testing.T) {
		post, err := service.CreatePost(ctx, core.CreatePostRequest{
			GameID:      f.game.ID,
			AuthorID:    int32(f.player.ID),
			CharacterID: f.playerChar.ID,
			Content:     "I hear @Masked Informant is about.",
			Visibility:  string(models.MessageVisibilityGame),
		})

		// The post itself must still succeed: an unresolved mention degrades to
		// ordinary text, exactly as a typo does. Erroring would tell the player
		// the name means something.
		require.NoError(t, err, "The post must save; the mention just does not resolve")
		require.NotNil(t, post)

		assert.NotContains(t, storedIDsFor(t, post.ID), f.hiddenNPC.ID,
			"The hidden NPC's ID must not reach mentioned_character_ids: it ships on the wire")
	})

	t.Run("gm's post resolves the same mention", func(t *testing.T) {
		post, err := service.CreatePost(ctx, core.CreatePostRequest{
			GameID:      f.game.ID,
			AuthorID:    int32(f.gm.ID),
			CharacterID: f.gmChar.ID,
			Content:     "A word with @Masked Informant.",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		assert.Contains(t, storedIDsFor(t, post.ID), f.hiddenNPC.ID,
			"The GM's mention of their own hidden NPC must resolve normally")
	})
}

// TestNotifyCharacterMentions_HiddenNPCNotifiesNobody covers the notification
// effect, which is the one that would otherwise tell a player their guess was
// right.
//
// The NPC is assigned to an AUDIENCE MEMBER rather than left unassigned, and
// notifyCharacterMentions is called synchronously -- both deliberate, following
// TestNotifyCharacterMentions_AudienceControlledNPC:
//
//   - An unassigned NPC resolves to the GM as its owner, and the GM is the
//     author in the counterpart case, so notifyCharacterMentions would skip it
//     as a self-notification. The assertion would then compare 0 to 0 and pass
//     whether or not the gate worked.
//   - CreatePost dispatches notifications through SafeGo, so a post-level test
//     races the goroutine and reads an empty table either way.
func TestNotifyCharacterMentions_HiddenNPCNotifiesNobody(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &MessageService{
		DB:      testDB.Pool,
		Logger:  app.ObsLogger,
		Metrics: app.Observability.OTELMetrics,
	}
	notificationService := &db.NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}
	ctx := context.Background()

	f := setupHiddenMentionFixture(t, testDB, app)

	// Give the hidden NPC an audience-member controller, so a notification has
	// somewhere real to land.
	controller := testDB.CreateTestUser(t, "hidden_controller", "hidden_controller@example.com")
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	_, err := gameService.AddGameParticipant(ctx, f.game.ID, int32(controller.ID), "audience")
	require.NoError(t, err)

	queries := models.New(testDB.Pool)
	_, err = queries.AssignNPCToAudience(ctx, models.AssignNPCToAudienceParams{
		CharacterID:      f.hiddenNPC.ID,
		AssignedUserID:   int32(controller.ID),
		AssignedByUserID: int32(f.gm.ID),
	})
	require.NoError(t, err)

	countFor := func(t *testing.T, userID int32) int {
		t.Helper()
		notifs, err := notificationService.GetUserNotifications(ctx, userID, 50, 0)
		require.NoError(t, err)
		n := 0
		for _, notif := range notifs {
			if notif.Type == core.NotificationTypeCharacterMention {
				n++
			}
		}
		return n
	}

	// The control case runs FIRST and proves the counter can move: without it,
	// "no notification fired" is indistinguishable from "notifications never
	// fire in this test".
	t.Run("a resolved mention does notify the controller", func(t *testing.T) {
		before := countFor(t, int32(controller.ID))

		ids, err := service.extractCharacterMentions(ctx,
			"Speaking to @Masked Informant.", f.game.ID, int32(f.gm.ID))
		require.NoError(t, err)
		require.Contains(t, ids, f.hiddenNPC.ID, "Precondition: the GM's mention resolves")

		service.notifyCharacterMentions(ctx, ids, f.gmChar.ID, int32(f.gm.ID), f.game.ID, 9999)

		assert.Equal(t, before+1, countFor(t, int32(controller.ID)),
			"The NPC's controller should be notified when the mention resolves")
	})

	t.Run("a player's mention of the hidden NPC notifies nobody", func(t *testing.T) {
		before := countFor(t, int32(controller.ID))

		ids, err := service.extractCharacterMentions(ctx,
			"I hear @Masked Informant is about.", f.game.ID, int32(f.player.ID))
		require.NoError(t, err)
		require.NotContains(t, ids, f.hiddenNPC.ID, "Precondition: the player's mention does not resolve")

		service.notifyCharacterMentions(ctx, ids, f.playerChar.ID, int32(f.player.ID), f.game.ID, 9998)

		assert.Equal(t, before, countFor(t, int32(controller.ID)),
			"No notification may fire, or it would confirm the hidden NPC exists")
	})
}

// TestGetGamePosts_HiddenNPCContentStaysVisible is the load-bearing test for
// what hiding must NOT do.
//
// Hiding conceals a character's presence in the cast, never content it has
// authored. A hidden NPC that could not speak in the common room would be
// indistinguishable from a deleted one, and the feature exists precisely so the
// GM can have an unknown NPC address the players.
//
// This test fails if someone ever "fixes" hiding by filtering posts, comments
// or authorship by character. That is the most plausible wrong turn here, which
// is why the assertion is on the author's NAME being present rather than merely
// on the post count.
func TestGetGamePosts_HiddenNPCContentStaysVisible(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	service := &MessageService{
		DB:      testDB.Pool,
		Logger:  app.ObsLogger,
		Metrics: app.Observability.OTELMetrics,
	}
	ctx := context.Background()

	f := setupHiddenMentionFixture(t, testDB, app)

	// The GM speaks AS the hidden NPC in the common room.
	post, err := service.CreatePost(ctx, core.CreatePostRequest{
		GameID:      f.game.ID,
		AuthorID:    int32(f.gm.ID),
		CharacterID: f.hiddenNPC.ID,
		Content:     "A voice from the shadows: you are being watched.",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err, "The GM must be able to post as a hidden NPC")
	require.NotNil(t, post)

	posts, err := service.GetGamePosts(ctx, f.game.ID, nil, 50, 0)
	require.NoError(t, err)

	var found *core.MessageWithDetails
	for i := range posts {
		if posts[i].ID == post.ID {
			found = &posts[i]
			break
		}
	}

	require.NotNil(t, found,
		"A hidden NPC's post must still be returned: hiding conceals the cast, not content")
	assert.Equal(t, "A voice from the shadows: you are being watched.", found.Content,
		"The post's content must be intact")
	assert.Equal(t, f.hiddenNPC.Name, found.CharacterName,
		"The post must still be ATTRIBUTED to the hidden NPC by name; that is how players learn of it")
}
