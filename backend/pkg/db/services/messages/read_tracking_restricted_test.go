package messages

import (
	"context"
	"slices"
	"testing"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRestrictedReadTracking covers the read-tracking endpoints: unread info
// (L9), unread comment IDs (L10), read markers (L11) and manual reads (L12).
// Each must leave out a restricted thread the viewer can't see, including
// read state written before the viewer lost access.
func TestRestrictedReadTracking(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "readr")
	ctx := context.Background()
	queries := models.New(testDB.Pool)

	// Read state for everyone in both threads, as if they had read it while
	// they could see it. The aComment row is also filed under the public post,
	// as a client may send a post ID that isn't the comment's thread: the
	// filter must follow the comment's own root.
	for _, v := range s.viewers() {
		if v.userID == 0 {
			continue
		}
		for _, postID := range []int32{s.publicPost.ID, s.restrictedPost.ID} {
			_, err := s.service.MarkPostAsRead(ctx, v.userID, s.game.ID, postID, nil)
			require.NoError(t, err)
		}
		require.NoError(t, queries.MarkCommentRead(ctx, models.MarkCommentReadParams{
			UserID: v.userID, CommentID: s.gmReply.ID, PostID: s.restrictedPost.ID, GameID: s.game.ID,
		}))
		require.NoError(t, queries.MarkCommentRead(ctx, models.MarkCommentReadParams{
			UserID: v.userID, CommentID: s.aComment.ID, PostID: s.publicPost.ID, GameID: s.game.ID,
		}))
	}
	// A new comment after everyone's read marker, so the unread IDs are
	// non-empty for anyone who can see the thread.
	late := s.reply(t, s.aReply.ID, s.gm, s.gmChar)

	for _, v := range s.viewers() {
		scope := s.service.ResolveViewerScope(v.ctx(), s.game.ID, v.userID)
		t.Run(v.name, func(t *testing.T) {
			infos, err := s.service.GetPostsWithUnreadInfo(ctx, s.game.ID, scope)
			require.NoError(t, err)
			var infoIDs []int32
			for _, info := range infos {
				infoIDs = append(infoIDs, info.PostID)
			}
			assert.Contains(t, infoIDs, s.publicPost.ID)
			assert.Equal(t, v.seesHere, slices.Contains(infoIDs, s.restrictedPost.ID), "unread info")

			unread, err := s.service.GetUnreadCommentIDsForPosts(ctx, s.game.ID, scope)
			require.NoError(t, err)
			var unreadPosts, unreadComments []int32
			for _, u := range unread {
				unreadPosts = append(unreadPosts, u.PostID)
				unreadComments = append(unreadComments, u.UnreadCommentIDs...)
			}
			assert.Contains(t, unreadPosts, s.publicPost.ID)
			assert.Equal(t, v.seesHere, slices.Contains(unreadPosts, s.restrictedPost.ID), "unread comment IDs: posts")
			if v.userID != 0 && v.userID != int32(s.gm.ID) {
				assert.Equal(t, v.seesHere, slices.Contains(unreadComments, late.ID), "unread comment IDs: comments")
			}
			if !v.seesHere {
				for _, id := range s.threadIDs() {
					assert.NotContains(t, unreadComments, id)
				}
			}

			if v.userID == 0 {
				return
			}
			markers, err := s.service.GetUserReadMarkersForGame(ctx, s.game.ID, scope)
			require.NoError(t, err)
			var markerPosts []int32
			for _, m := range markers {
				markerPosts = append(markerPosts, m.PostID)
			}
			assert.Contains(t, markerPosts, s.publicPost.ID)
			assert.Equal(t, v.seesHere, slices.Contains(markerPosts, s.restrictedPost.ID), "read markers")

			reads, err := s.service.GetManualReadCommentIDsForGame(ctx, s.game.ID, scope)
			require.NoError(t, err)
			var readIDs []int32
			for _, r := range reads {
				readIDs = append(readIDs, r.ReadCommentIDs...)
			}
			assert.Equal(t, v.seesHere, slices.Contains(readIDs, s.gmReply.ID), "manual reads")
			assert.Equal(t, v.seesHere, slices.Contains(readIDs, s.aComment.ID),
				"manual reads: a row filed under the public post still follows the comment's own thread")
		})
	}

	t.Run("an unpublished draft's ID never comes back, even to the GM", func(t *testing.T) {
		phase := testDB.CreateTestPhase(t, s.game.ID, "common_room", "next phase")
		draft, err := s.service.CreateDraftPost(ctx, core.CreatePostRequest{
			GameID: s.game.ID, PhaseID: &phase.ID, AuthorID: int32(s.gm.ID),
			CharacterID: s.gmChar.ID, Content: "not yet", Visibility: "game",
		})
		require.NoError(t, err)

		for _, uid := range []int32{int32(s.gm.ID), int32(s.playerB.ID)} {
			unread, err := s.service.GetUnreadCommentIDsForPosts(ctx, s.game.ID, s.service.ResolveViewerScope(ctx, s.game.ID, uid))
			require.NoError(t, err)
			for _, u := range unread {
				assert.NotEqual(t, draft.ID, u.PostID, "user %d", uid)
			}
		}
	})

	// Only the epilogue: moving a game to completed deletes its read markers
	// (trigger_cleanup_reads_on_game_complete).
	t.Run("the epilogue shows the thread's read state to everyone", func(t *testing.T) {
		testDB.SetGameStateDirectly(t, s.game.ID, core.GameStateEpilogue)
		scope := s.service.ResolveViewerScope(ctx, s.game.ID, int32(s.playerB.ID))
		markers, err := s.service.GetUserReadMarkersForGame(ctx, s.game.ID, scope)
		require.NoError(t, err)
		assert.True(t, slices.ContainsFunc(markers, func(m *core.ReadMarker) bool { return m.PostID == s.restrictedPost.ID }))

		infos, err := s.service.GetPostsWithUnreadInfo(ctx, s.game.ID, scope)
		require.NoError(t, err)
		assert.True(t, slices.ContainsFunc(infos, func(i *core.PostUnreadInfo) bool { return i.PostID == s.restrictedPost.ID }))
	})
}

// TestRestrictedMarkAllCommentsRead covers G9: "mark all read" must not write
// read rows for a thread the user can't see. Otherwise, once added to the
// list, they would find its comments already read.
func TestRestrictedMarkAllCommentsRead(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "markall")
	ctx := context.Background()
	publicComment := s.reply(t, s.publicPost.ID, s.gm, s.gmChar)

	readRows := func(t *testing.T, userID int32) []int32 {
		t.Helper()
		rows, err := testDB.Pool.Query(ctx, "SELECT comment_id FROM user_comment_reads WHERE user_id = $1", userID)
		require.NoError(t, err)
		ids, err := pgx.CollectRows(rows, pgx.RowTo[int32])
		require.NoError(t, err)
		return ids
	}

	done := map[int32]bool{0: true, int32(s.playerA.ID): true} // A wrote most of the thread, so it is already read for A
	for _, v := range s.viewers() {
		// The admin appears twice (with and without admin mode); the first
		// run's rows would muddle the second.
		if done[v.userID] {
			continue
		}
		done[v.userID] = true
		t.Run(v.name, func(t *testing.T) {
			scope := s.service.ResolveViewerScope(v.ctx(), s.game.ID, v.userID)
			require.NoError(t, s.service.MarkAllCommentsReadForPhase(ctx, s.game.ID, s.phase.ID, scope))

			rows := readRows(t, v.userID)
			assert.Contains(t, rows, publicComment.ID)
			for _, id := range []int32{s.aComment.ID, s.aReply.ID} {
				assert.Equal(t, v.seesHere, slices.Contains(rows, id), "comment %d", id)
			}
		})
	}

	t.Run("B added to the list later finds the thread unread", func(t *testing.T) {
		b := int32(s.playerB.ID)
		require.NoError(t, s.setPostViewers(ctx, s.restrictedPost.ID, true, []int32{int32(s.playerA.ID), b}))
		reads, err := s.service.GetManualReadCommentIDsForGame(ctx, s.game.ID, s.service.ResolveViewerScope(ctx, s.game.ID, b))
		require.NoError(t, err)
		for _, r := range reads {
			assert.NotEqual(t, s.restrictedPost.ID, r.PostID)
		}
	})
}
