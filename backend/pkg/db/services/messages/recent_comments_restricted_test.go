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

// commentFeed is one read mode of New Comments: the page query and the total
// that must agree with it.
type commentFeed struct {
	name   string
	unread bool
	list   func(ctx context.Context, gameID, limit, offset int32, viewer core.ViewerScope) ([]core.CommentWithParent, error)
	count  func(ctx context.Context, gameID int32, viewer core.ViewerScope) (int64, error)
}

func (s *restrictedScenario) commentFeeds() []commentFeed {
	return []commentFeed{
		{"all", false, s.service.ListRecentCommentsWithParents, s.service.GetTotalCommentCount},
		{"unread only", true, s.service.ListRecentUnreadCommentsWithParents, s.service.GetTotalUnreadCommentCount},
	}
}

// expect narrows the visible IDs to what this feed shows the user. Creating a
// comment marks it read for its author, so the unread feed leaves out the
// user's own comments.
func (s *restrictedScenario) expect(t *testing.T, feed commentFeed, userID int32, visible []int32) []int32 {
	t.Helper()
	if !feed.unread {
		return visible
	}
	rows, err := s.testDB.Pool.Query(context.Background(),
		"SELECT id FROM messages WHERE author_id = $1 AND game_id = $2", userID, s.game.ID)
	require.NoError(t, err)
	own, err := pgx.CollectRows(rows, pgx.RowTo[int32])
	require.NoError(t, err)
	var want []int32
	for _, id := range visible {
		if !slices.Contains(own, id) {
			want = append(want, id)
		}
	}
	return want
}

// interleave adds 35 comments by player A, alternating between the two
// threads: 10 on the public post and 25 in the restricted thread, mixed so a
// filter applied after LIMIT would leave short pages. It returns both sets in
// creation order.
func (s *restrictedScenario) interleave(t *testing.T) (public, restricted []int32) {
	t.Helper()
	for i := 0; i < 35; i++ {
		if i%7 == 0 || i%7 == 3 {
			public = append(public, s.reply(t, s.publicPost.ID, s.playerA, s.aChar).ID)
		} else {
			restricted = append(restricted, s.reply(t, s.restrictedPost.ID, s.playerA, s.aChar).ID)
		}
	}
	require.Len(t, public, 10)
	require.Len(t, restricted, 25)
	return public, restricted
}

// walkPages reads every page of a feed and returns the IDs in order. It stops
// at the first short page, so a short page in the middle shows up as rows
// missing from the result.
func walkPages(t *testing.T, limit int32, page func(offset int32) []int32) []int32 {
	t.Helper()
	var all []int32
	for offset := int32(0); ; offset += limit {
		ids := page(offset)
		all = append(all, ids...)
		if int32(len(ids)) < limit {
			return all
		}
		require.Less(t, offset, int32(1000), "runaway pagination")
	}
}

func commentIDs(rows []core.CommentWithParent) []int32 {
	ids := make([]int32, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	return ids
}

func TestRestrictedRecentComments(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "recentr")
	publicComment := s.reply(t, s.publicPost.ID, s.gm, s.gmChar)
	restricted := []int32{s.aComment.ID, s.gmReply.ID, s.aReply.ID}

	for _, v := range s.viewers() {
		scope := s.service.ResolveViewerScope(v.ctx(), s.game.ID, v.userID)
		visible := []int32{publicComment.ID}
		if v.seesHere {
			visible = append(visible, restricted...)
		}
		for _, feed := range s.commentFeeds() {
			t.Run(v.name+"/"+feed.name, func(t *testing.T) {
				want := s.expect(t, feed, v.userID, visible)
				rows, err := feed.list(context.Background(), s.game.ID, 50, 0, scope)
				require.NoError(t, err)
				assert.ElementsMatch(t, want, commentIDs(rows))

				total, err := feed.count(context.Background(), s.game.ID, scope)
				require.NoError(t, err)
				assert.Equal(t, int64(len(want)), total, "the total counts exactly the rows shown")

				// post_id now comes from root_post_id rather than a walk up
				// the tree; it must still name the thread's post at depth 3.
				for _, row := range rows {
					require.NotNil(t, row.PostID)
					if row.ID == publicComment.ID {
						assert.Equal(t, s.publicPost.ID, *row.PostID)
					} else {
						assert.Equal(t, s.restrictedPost.ID, *row.PostID)
					}
				}
			})
		}
	}

	t.Run("unread only still drops what the listed player has read", func(t *testing.T) {
		require.NoError(t, models.New(testDB.Pool).MarkCommentRead(context.Background(), models.MarkCommentReadParams{
			UserID: int32(s.playerA.ID), CommentID: s.gmReply.ID, PostID: s.restrictedPost.ID, GameID: s.game.ID,
		}))
		scope := core.ViewerScope{UserID: int32(s.playerA.ID)}

		// A wrote aComment and aReply, so they were never unread.
		rows, err := s.service.ListRecentUnreadCommentsWithParents(context.Background(), s.game.ID, 50, 0, scope)
		require.NoError(t, err)
		assert.ElementsMatch(t, []int32{publicComment.ID}, commentIDs(rows))

		total, err := s.service.GetTotalUnreadCommentCount(context.Background(), s.game.ID, scope)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
	})

	t.Run("comments under an unpublished draft are hidden from everyone", func(t *testing.T) {
		phase := testDB.CreateTestPhase(t, s.game.ID, "common_room", "next phase")
		draft, err := s.service.CreateDraftPost(context.Background(), core.CreatePostRequest{
			GameID: s.game.ID, PhaseID: &phase.ID, AuthorID: int32(s.gm.ID),
			CharacterID: s.gmChar.ID, Content: "not yet", Visibility: "game",
		})
		require.NoError(t, err)
		draftComment := s.reply(t, draft.ID, s.gm, s.gmChar)

		for _, v := range s.viewers() {
			scope := s.service.ResolveViewerScope(v.ctx(), s.game.ID, v.userID)
			for _, feed := range s.commentFeeds() {
				rows, err := feed.list(context.Background(), s.game.ID, 50, 0, scope)
				require.NoError(t, err)
				assert.NotContains(t, commentIDs(rows), draftComment.ID, "%s/%s", v.name, feed.name)
			}
		}
	})

	t.Run("a public archive shows the thread to everyone", func(t *testing.T) {
		for _, state := range []string{core.GameStateCompleted, core.GameStateEpilogue} {
			testDB.SetGameStateDirectly(t, s.game.ID, state)
			for _, uid := range []int32{int32(s.playerB.ID), int32(s.outsider.ID), 0} {
				scope := s.service.ResolveViewerScope(context.Background(), s.game.ID, uid)
				rows, err := s.service.ListRecentCommentsWithParents(context.Background(), s.game.ID, 50, 0, scope)
				require.NoError(t, err)
				assert.Subset(t, commentIDs(rows), restricted, "%s, user %d", state, uid)
			}
		}
	})
}

// TestRestrictedRecentComments_Pagination walks New Comments five at a time
// with 25 hidden comments mixed in among 10 visible ones. Every page but the
// last must be full, and the total must be 10, in both read modes.
func TestRestrictedRecentComments_Pagination(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "recentpage")
	public, restricted := s.interleave(t)
	everything := append(append(append([]int32{}, public...), restricted...),
		s.aComment.ID, s.gmReply.ID, s.aReply.ID)

	cases := []struct {
		name   string
		userID int32
		want   []int32
	}{
		{"unlisted player B", int32(s.playerB.ID), public},
		{"non-participant", int32(s.outsider.ID), public},
		{"listed player A", int32(s.playerA.ID), everything},
		{"gm", int32(s.gm.ID), everything},
	}
	const limit = 5
	for _, c := range cases {
		scope := s.service.ResolveViewerScope(context.Background(), s.game.ID, c.userID)
		for _, feed := range s.commentFeeds() {
			t.Run(c.name+"/"+feed.name, func(t *testing.T) {
				want := s.expect(t, feed, c.userID, c.want)
				got := walkPages(t, limit, func(offset int32) []int32 {
					rows, err := feed.list(context.Background(), s.game.ID, limit, offset, scope)
					require.NoError(t, err)
					return commentIDs(rows)
				})
				assert.ElementsMatch(t, want, got, "every visible comment once, nothing hidden")

				total, err := feed.count(context.Background(), s.game.ID, scope)
				require.NoError(t, err)
				assert.Equal(t, int64(len(want)), total)
			})
		}
	}
}
