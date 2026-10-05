package messages

import (
	"context"
	"errors"
	"testing"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func postIDsOf(posts []core.MessageWithDetails) []int32 {
	ids := make([]int32, len(posts))
	for i := range posts {
		ids[i] = posts[i].ID
	}
	return ids
}

// TestRestrictedPosts_Listing checks the Common Room list, the phase list and
// the post count for every viewer: hidden posts are absent from the rows and
// from the count.
func TestRestrictedPosts_Listing(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "listing")

	for _, v := range s.viewers() {
		t.Run(v.name, func(t *testing.T) {
			ctx := v.ctx()
			scope := s.service.ResolveViewerScope(ctx, s.game.ID, v.userID)
			require.Equal(t, v.seesAll, scope.SeesAll)

			want := []int32{s.publicPost.ID}
			if v.seesHere {
				want = append(want, s.restrictedPost.ID)
			}

			posts, err := s.service.GetGamePosts(ctx, s.game.ID, nil, 50, 0, scope)
			require.NoError(t, err)
			assert.ElementsMatch(t, want, postIDsOf(posts), "game posts")

			phaseID := s.phase.ID
			posts, err = s.service.GetGamePosts(ctx, s.game.ID, &phaseID, 50, 0, scope)
			require.NoError(t, err)
			assert.ElementsMatch(t, want, postIDsOf(posts), "game posts filtered by phase")

			posts, err = s.service.GetPhasePosts(ctx, s.phase.ID, scope)
			require.NoError(t, err)
			assert.ElementsMatch(t, want, postIDsOf(posts), "phase posts")

			count, err := s.service.GetGamePostCount(ctx, s.game.ID, nil, scope)
			require.NoError(t, err)
			assert.Equal(t, int64(len(want)), count, "count must match the rows")
		})
	}

	t.Run("is_restricted is carried on the rows", func(t *testing.T) {
		posts, err := s.service.GetGamePosts(context.Background(), s.game.ID, nil, 50, 0, core.ViewerScope{SeesAll: true})
		require.NoError(t, err)
		for _, p := range posts {
			assert.Equal(t, p.ID == s.restrictedPost.ID, p.IsRestricted, "post %d", p.ID)
		}

		post, err := s.service.GetPost(context.Background(), s.restrictedPost.ID)
		require.NoError(t, err)
		assert.True(t, post.IsRestricted)
	})

	t.Run("a public archive lists the restricted post for everyone", func(t *testing.T) {
		testDB.SetGameStateDirectly(t, s.game.ID, core.GameStateCompleted)
		scope := s.service.ResolveViewerScope(context.Background(), s.game.ID, int32(s.outsider.ID))
		posts, err := s.service.GetGamePosts(context.Background(), s.game.ID, nil, 50, 0, scope)
		require.NoError(t, err)
		assert.Contains(t, postIDsOf(posts), s.restrictedPost.ID)
	})
}

func TestRestrictedPosts_Create(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "create")
	ctx := context.Background()
	gmScope := core.ViewerScope{UserID: int32(s.gm.ID), SeesAll: true}

	postCount := func() int64 {
		n, err := s.service.GetGamePostCount(ctx, s.game.ID, nil, gmScope)
		require.NoError(t, err)
		return n
	}

	t.Run("the allowlist is written with the post", func(t *testing.T) {
		viewers, err := s.service.ListPostViewers(ctx, []int32{s.restrictedPost.ID, s.publicPost.ID})
		require.NoError(t, err)
		assert.Equal(t, map[int32][]int32{s.restrictedPost.ID: {int32(s.playerA.ID)}}, viewers)
		assert.True(t, s.restrictedPost.IsRestricted)
		assert.False(t, s.publicPost.IsRestricted)
	})

	t.Run("duplicates are collapsed", func(t *testing.T) {
		a := int32(s.playerA.ID)
		post := s.createPost(t, "dupes", []int32{a, int32(s.playerB.ID), a})
		viewers, err := s.service.ListPostViewers(ctx, []int32{post.ID})
		require.NoError(t, err)
		assert.ElementsMatch(t, []int32{a, int32(s.playerB.ID)}, viewers[post.ID])
	})

	invalid := map[string][]int32{
		"empty list":                {},
		"a co-GM":                   {int32(s.playerA.ID), int32(s.coGM.ID)},
		"an audience member":        {int32(s.audience.ID)},
		"the GM":                    {int32(s.gm.ID)},
		"a non-participant":         {int32(s.playerA.ID), int32(s.outsider.ID)},
		"a user that doesn't exist": {999999},
	}
	for name, ids := range invalid {
		t.Run("rejects "+name+" and writes nothing", func(t *testing.T) {
			before := postCount()
			_, err := s.service.CreatePost(ctx, core.CreatePostRequest{
				GameID:              s.game.ID,
				AuthorID:            int32(s.gm.ID),
				CharacterID:         s.gmChar.ID,
				Content:             "should not exist",
				Visibility:          "game",
				RestrictedToUserIDs: ids,
			})
			require.Error(t, err)
			assert.True(t, errors.Is(err, core.ErrInvalidPostViewers), "got %v", err)
			assert.Equal(t, before, postCount())
		})
	}

	t.Run("an inactive player can't be listed", func(t *testing.T) {
		_, err := testDB.Pool.Exec(ctx, "UPDATE game_participants SET status = 'inactive' WHERE game_id = $1 AND user_id = $2",
			s.game.ID, s.playerC.ID)
		require.NoError(t, err)
		t.Cleanup(func() {
			_, _ = testDB.Pool.Exec(context.Background(), "UPDATE game_participants SET status = 'active' WHERE game_id = $1 AND user_id = $2",
				s.game.ID, s.playerC.ID)
		})

		_, err = s.service.CreatePost(ctx, core.CreatePostRequest{
			GameID: s.game.ID, AuthorID: int32(s.gm.ID), CharacterID: s.gmChar.ID,
			Content: "x", Visibility: "game", RestrictedToUserIDs: []int32{int32(s.playerC.ID)},
		})
		assert.True(t, errors.Is(err, core.ErrInvalidPostViewers), "got %v", err)
	})
}

func TestRestrictedPosts_Draft(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "draft")
	ctx := context.Background()

	phase := testDB.CreateTestPhase(t, s.game.ID, "common_room", "pending")
	newDraft := func(viewers []int32) (*core.MessageWithDetails, error) {
		return s.service.CreateDraftPost(ctx, core.CreatePostRequest{
			GameID: s.game.ID, PhaseID: &phase.ID, AuthorID: int32(s.gm.ID), CharacterID: s.gmChar.ID,
			Content: "scene setting", Visibility: "game", RestrictedToUserIDs: viewers,
		})
	}

	t.Run("a bad list writes no draft", func(t *testing.T) {
		_, err := newDraft([]int32{int32(s.outsider.ID)})
		assert.True(t, errors.Is(err, core.ErrInvalidPostViewers), "got %v", err)
		existing, err := s.service.GetDraftPostForPhase(ctx, phase.ID)
		require.NoError(t, err)
		assert.Nil(t, existing)
	})

	t.Run("a restricted draft stays restricted once published", func(t *testing.T) {
		draft, err := newDraft([]int32{int32(s.playerA.ID)})
		require.NoError(t, err)
		assert.True(t, draft.IsRestricted)

		require.NoError(t, s.service.PublishDraftPostsForPhase(ctx, phase.ID))

		for _, v := range []struct {
			user *core.User
			sees bool
		}{{s.playerA, true}, {s.playerB, false}} {
			scope := s.service.ResolveViewerScope(ctx, s.game.ID, int32(v.user.ID))
			posts, err := s.service.GetPhasePosts(ctx, phase.ID, scope)
			require.NoError(t, err)
			assert.Equal(t, v.sees, len(posts) == 1, "user %s", v.user.Username)
		}
	})
}

func TestSetPostViewers(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	notifications := db.NewNotificationService(testDB.Pool, app.ObsLogger)

	// notify files a notification for user pointing at message, and returns
	// its ID. relatedType is "post" or "comment", as the real senders use.
	notify := func(t *testing.T, s *restrictedScenario, user *core.User, relatedType string, messageID int32) int32 {
		t.Helper()
		n, err := notifications.CreateNotification(ctx, &core.CreateNotificationRequest{
			UserID:      int32(user.ID),
			GameID:      &s.game.ID,
			Type:        core.NotificationTypeCommentReply,
			Title:       "secret scene",
			RelatedType: &relatedType,
			RelatedID:   &messageID,
		})
		require.NoError(t, err)
		return n.ID
	}
	exists := func(t *testing.T, id int32) bool {
		t.Helper()
		var n int
		require.NoError(t, testDB.Pool.QueryRow(ctx, "SELECT count(*) FROM notifications WHERE id = $1", id).Scan(&n))
		return n == 1
	}
	canView := func(t *testing.T, s *restrictedScenario, user *core.User, messageID int32) bool {
		t.Helper()
		visible, err := s.service.CanUserViewMessage(ctx, messageID, int32(user.ID))
		require.NoError(t, err)
		return visible
	}

	t.Run("replacing the list moves access and deletes the removed player's notifications", func(t *testing.T) {
		s := newRestrictedScenario(t, testDB, "setviewers_replace")

		aThread := notify(t, s, s.playerA, "comment", s.gmReply.ID)
		aPost := notify(t, s, s.playerA, "post", s.restrictedPost.ID)
		aPublic := notify(t, s, s.playerA, "post", s.publicPost.ID)
		gm := notify(t, s, s.gm, "comment", s.aReply.ID)
		coGM := notify(t, s, s.coGM, "post", s.restrictedPost.ID)
		audience := notify(t, s, s.audience, "comment", s.aComment.ID)

		require.NoError(t, s.service.SetPostViewers(ctx, s.restrictedPost.ID, true, []int32{int32(s.playerB.ID)}))

		for _, id := range s.threadIDs() {
			assert.False(t, canView(t, s, s.playerA, id), "A lost message %d, including their own comments", id)
			assert.True(t, canView(t, s, s.playerB, id), "B gained message %d", id)
		}

		assert.False(t, exists(t, aThread), "A's reply notification inside the thread")
		assert.False(t, exists(t, aPost), "A's post notification")
		assert.True(t, exists(t, aPublic), "A's notification for a different, public post")
		assert.True(t, exists(t, gm), "the GM keeps theirs")
		assert.True(t, exists(t, coGM), "a co-GM keeps theirs")
		assert.True(t, exists(t, audience), "audience keeps theirs")

		viewers, err := s.service.ListPostViewers(ctx, []int32{s.restrictedPost.ID})
		require.NoError(t, err)
		assert.Equal(t, []int32{int32(s.playerB.ID)}, viewers[s.restrictedPost.ID])
	})

	t.Run("restricting a public post deletes notifications of everyone not listed", func(t *testing.T) {
		s := newRestrictedScenario(t, testDB, "setviewers_restrict")
		comment := s.reply(t, s.publicPost.ID, s.playerA, s.aChar)

		bNotif := notify(t, s, s.playerB, "comment", comment.ID)
		aNotif := notify(t, s, s.playerA, "post", s.publicPost.ID)

		require.NoError(t, s.service.SetPostViewers(ctx, s.publicPost.ID, true, []int32{int32(s.playerA.ID)}))

		assert.False(t, canView(t, s, s.playerB, s.publicPost.ID))
		assert.False(t, canView(t, s, s.playerB, comment.ID))
		assert.False(t, exists(t, bNotif), "B can no longer see the thread")
		assert.True(t, exists(t, aNotif), "A is on the list")

		post, err := s.service.GetPost(ctx, s.publicPost.ID)
		require.NoError(t, err)
		assert.True(t, post.IsRestricted)
	})

	t.Run("making a post public clears the list and deletes nothing", func(t *testing.T) {
		s := newRestrictedScenario(t, testDB, "setviewers_public")
		aNotif := notify(t, s, s.playerA, "comment", s.aComment.ID)

		require.NoError(t, s.service.SetPostViewers(ctx, s.restrictedPost.ID, false, nil))

		for _, id := range s.threadIDs() {
			assert.True(t, canView(t, s, s.playerB, id))
		}
		assert.True(t, exists(t, aNotif))

		viewers, err := s.service.ListPostViewers(ctx, []int32{s.restrictedPost.ID})
		require.NoError(t, err)
		assert.Empty(t, viewers)
		post, err := s.service.GetPost(ctx, s.restrictedPost.ID)
		require.NoError(t, err)
		assert.False(t, post.IsRestricted)
	})

	t.Run("invalid changes are rejected and change nothing", func(t *testing.T) {
		s := newRestrictedScenario(t, testDB, "setviewers_invalid")
		aNotif := notify(t, s, s.playerA, "comment", s.aComment.ID)

		cases := map[string]struct {
			restricted bool
			ids        []int32
		}{
			"restricted with no players": {true, nil},
			"public with a list":         {false, []int32{int32(s.playerA.ID)}},
			"a non-player in the list":   {true, []int32{int32(s.playerB.ID), int32(s.outsider.ID)}},
		}
		for name, c := range cases {
			t.Run(name, func(t *testing.T) {
				err := s.service.SetPostViewers(ctx, s.restrictedPost.ID, c.restricted, c.ids)
				assert.True(t, errors.Is(err, core.ErrInvalidPostViewers), "got %v", err)
			})
		}

		assert.True(t, canView(t, s, s.playerA, s.aReply.ID))
		assert.False(t, canView(t, s, s.playerB, s.aReply.ID))
		assert.True(t, exists(t, aNotif))
	})

	t.Run("a comment is not a post", func(t *testing.T) {
		s := newRestrictedScenario(t, testDB, "setviewers_comment")
		err := s.service.SetPostViewers(ctx, s.aComment.ID, true, []int32{int32(s.playerB.ID)})
		require.Error(t, err)

		msg, err := models.New(testDB.Pool).GetMessage(ctx, s.aComment.ID)
		require.NoError(t, err)
		assert.False(t, msg.IsRestricted)
	})

	t.Run("a completed game is read-only", func(t *testing.T) {
		s := newRestrictedScenario(t, testDB, "setviewers_completed")
		testDB.SetGameStateDirectly(t, s.game.ID, core.GameStateCompleted)
		err := s.service.SetPostViewers(ctx, s.restrictedPost.ID, false, nil)
		assert.True(t, core.IsArchivedGameError(err), "got %v", err)
	})
}
