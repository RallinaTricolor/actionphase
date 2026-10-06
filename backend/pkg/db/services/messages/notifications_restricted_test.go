package messages

import (
	"context"
	"testing"
	"time"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// notificationsAbout counts userID's notifications of one type pointing at
// relatedID.
func (s *restrictedScenario) notificationsAbout(t *testing.T, userID int32, notificationType string, relatedID int32) int {
	t.Helper()
	var n int
	require.NoError(t, s.testDB.Pool.QueryRow(context.Background(),
		`SELECT count(*) FROM notifications WHERE user_id = $1 AND type = $2 AND related_id = $3`,
		userID, notificationType, relatedID).Scan(&n))
	return n
}

// TestRestrictedPostNotification covers N1: a restricted post notifies only
// those who can see it. The notification title holds the start of the post.
func TestRestrictedPostNotification(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "notifypost")

	// CreatePost notifies in the background. Every recipient comes from one
	// bulk call, so once the expected ones have landed, so has everyone else's.
	recipients := []int32{int32(s.playerA.ID), int32(s.coGM.ID), int32(s.audience.ID)}
	require.Eventually(t, func() bool {
		for _, uid := range recipients {
			if s.notificationsAbout(t, uid, core.NotificationTypeCommonRoomPost, s.restrictedPost.ID) != 1 {
				return false
			}
		}
		return s.notificationsAbout(t, int32(s.playerB.ID), core.NotificationTypeCommonRoomPost, s.publicPost.ID) == 1
	}, 5*time.Second, 20*time.Millisecond, "listed player, co-GM and audience are notified; B gets the public post")

	for _, u := range []*core.User{s.playerB, s.playerC, s.outsider, s.admin} {
		assert.Zero(t, s.notificationsAbout(t, int32(u.ID), core.NotificationTypeCommonRoomPost, s.restrictedPost.ID),
			"user %s", u.Username)
	}
	assert.Zero(t, s.notificationsAbout(t, int32(s.gm.ID), core.NotificationTypeCommonRoomPost, s.restrictedPost.ID),
		"the author isn't notified of their own post")
}

// TestRestrictedPostNotification_PublicArchive checks that a restricted post
// written during the epilogue notifies everyone, since the archive shows it to
// everyone.
func TestRestrictedPostNotification_PublicArchive(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "notifyarchive")
	testDB.SetGameStateDirectly(t, s.game.ID, core.GameStateEpilogue)

	post := s.createPost(t, "epilogue scene", []int32{int32(s.playerA.ID)})
	require.Eventually(t, func() bool {
		return s.notificationsAbout(t, int32(s.playerB.ID), core.NotificationTypeCommonRoomPost, post.ID) == 1
	}, 5*time.Second, 20*time.Millisecond)
}

// TestRestrictedMentionNotification covers N2: an @mention inside a
// restricted thread doesn't reach a mentioned character's owner who can't
// read the thread.
func TestRestrictedMentionNotification(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "notifymention")
	ctx := context.Background()

	bID := int32(s.playerB.ID)
	bChar, err := s.characters.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID: s.game.ID, UserID: &bID, Name: "notifymention Bob", CharacterType: "player_character",
	})
	require.NoError(t, err)
	publicComment := s.reply(t, s.publicPost.ID, s.gm, s.gmChar)

	// Called directly so nothing races the background notifications.
	mention := func(messageID int32, character *models.Character) {
		s.service.notifyCharacterMentions(ctx, []int32{character.ID}, s.gmChar.ID, int32(s.gm.ID), s.game.ID, messageID)
	}

	mention(s.gmReply.ID, bChar)
	assert.Zero(t, s.notificationsAbout(t, bID, core.NotificationTypeCharacterMention, s.gmReply.ID), "B can't read the thread")

	mention(s.gmReply.ID, s.aChar)
	assert.Equal(t, 1, s.notificationsAbout(t, int32(s.playerA.ID), core.NotificationTypeCharacterMention, s.gmReply.ID), "A can")

	mention(publicComment.ID, bChar)
	assert.Equal(t, 1, s.notificationsAbout(t, bID, core.NotificationTypeCharacterMention, publicComment.ID), "B is mentioned in public")

	t.Run("the author's admin mode doesn't carry over to the recipient", func(t *testing.T) {
		adminID := int32(s.admin.ID)
		adminChar, err := s.characters.CreateCharacter(ctx, db.CreateCharacterRequest{
			GameID: s.game.ID, UserID: &adminID, Name: "notifymention Admin", CharacterType: "player_character",
		})
		require.NoError(t, err)
		s.service.notifyCharacterMentions(core.WithAdminMode(ctx, true), []int32{adminChar.ID},
			s.gmChar.ID, int32(s.gm.ID), s.game.ID, s.gmReply.ID)
		assert.Zero(t, s.notificationsAbout(t, adminID, core.NotificationTypeCharacterMention, s.gmReply.ID))
	})
}

// TestRestrictedReplyNotification covers N3: a reply to the comment of a
// player taken off the list doesn't notify them.
func TestRestrictedReplyNotification(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "notifyreply")
	ctx := context.Background()
	aID := int32(s.playerA.ID)

	// The reply is inserted straight into the database and notified directly:
	// CreateComment would also notify from a background goroutine, which can
	// land after setPostViewers has deleted the thread's notifications.
	replyTo := func(parent *models.Message) *models.Message {
		reply, err := models.New(testDB.Pool).CreateComment(ctx, models.CreateCommentParams{
			GameID:      s.game.ID,
			AuthorID:    int32(s.gm.ID),
			CharacterID: s.gmChar.ID,
			Content:     "reply",
			ParentID:    pgtype.Int4{Int32: parent.ID, Valid: true},
			Visibility:  models.MessageVisibilityGame,
		})
		require.NoError(t, err)
		s.service.notifyCommentReply(ctx, parent.ID, s.gmChar.ID, int32(s.gm.ID), s.game.ID, reply.ID)
		return &reply
	}

	listed := replyTo(s.aReply)
	assert.GreaterOrEqual(t, s.notificationsAbout(t, aID, core.NotificationTypeCommentReply, listed.ID), 1, "A is on the list")

	require.NoError(t, s.setPostViewers(ctx, s.restrictedPost.ID, true, []int32{int32(s.playerC.ID)}))
	removed := replyTo(s.aReply)
	assert.Zero(t, s.notificationsAbout(t, aID, core.NotificationTypeCommentReply, removed.ID), "A was taken off the list")
	assert.Zero(t, s.notificationsAbout(t, aID, core.NotificationTypeCommentReply, listed.ID),
		"taking A off the list also deleted the earlier reply notification")
}
