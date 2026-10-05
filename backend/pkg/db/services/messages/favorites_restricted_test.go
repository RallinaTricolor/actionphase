package messages

import (
	"context"
	"slices"
	"testing"

	"actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func favoriteIDs(rows []*core.FavoriteComment) []int32 {
	ids := make([]int32, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	return ids
}

// walkFavorites reads every page of a user's favorites through the keyset
// cursor. Every page but the last must be full, so a filter applied after
// LIMIT shows up as a short page in the middle.
func (s *restrictedScenario) walkFavorites(t *testing.T, userID, limit int32) []int32 {
	t.Helper()
	var all []int32
	var cursor *core.FavoriteCursor
	for page := 0; ; page++ {
		require.Less(t, page, 200, "runaway pagination")
		rows, next, err := s.service.ListFavoriteComments(context.Background(), userID, limit, cursor)
		require.NoError(t, err)
		all = append(all, favoriteIDs(rows)...)
		if next == nil {
			return all
		}
		require.Len(t, rows, int(limit), "only the last page may be short")
		cursor = next
	}
}

func TestRestrictedFavorites(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "favr")
	ctx := context.Background()
	publicComment := s.reply(t, s.publicPost.ID, s.gm, s.gmChar)

	// Everyone stars one public comment and one in the restricted thread. The
	// service doesn't gate starring (the handler does), which stands in for a
	// star left over from before the viewer lost access.
	for _, v := range s.viewers() {
		if v.userID == 0 {
			continue
		}
		require.NoError(t, s.service.SetCommentFavorite(ctx, v.userID, publicComment.ID, true))
		require.NoError(t, s.service.SetCommentFavorite(ctx, v.userID, s.gmReply.ID, true))
	}

	for _, v := range s.viewers() {
		if v.userID == 0 {
			continue
		}
		t.Run(v.name, func(t *testing.T) {
			// The game-scoped IDs resolve the scope in Go, admin mode
			// included. The cross-game list and IDs restate the rule in SQL
			// without admin mode, so an admin sees their own favorites as a
			// normal user would.
			crossGame := v.seesHere && !v.adminMode
			want := []int32{publicComment.ID}
			if crossGame {
				want = append(want, s.gmReply.ID)
			}

			rows, _, err := s.service.ListFavoriteComments(ctx, v.userID, 50, nil)
			require.NoError(t, err)
			assert.ElementsMatch(t, want, favoriteIDs(rows), "favorites list")
			for _, row := range rows {
				require.NotNil(t, row.PostID)
				if row.ID == s.gmReply.ID {
					assert.Equal(t, s.restrictedPost.ID, *row.PostID, "post_id comes from root_post_id")
				}
			}

			ids, err := s.service.GetFavoriteCommentIDsForUser(ctx, v.userID)
			require.NoError(t, err)
			assert.ElementsMatch(t, want, ids, "favorite IDs, all games")

			scope := s.service.ResolveViewerScope(v.ctx(), s.game.ID, v.userID)
			gameIDs, err := s.service.GetFavoriteCommentIDsForGame(ctx, s.game.ID, scope)
			require.NoError(t, err)
			assert.Equal(t, v.seesHere, slices.Contains(gameIDs, s.gmReply.ID), "favorite IDs, one game")
			assert.Contains(t, gameIDs, publicComment.ID)
		})
	}

	t.Run("a public archive shows the starred comment again", func(t *testing.T) {
		for _, state := range []string{core.GameStateCompleted, core.GameStateEpilogue} {
			testDB.SetGameStateDirectly(t, s.game.ID, state)
			uid := int32(s.playerB.ID)
			ids, err := s.service.GetFavoriteCommentIDsForUser(ctx, uid)
			require.NoError(t, err)
			assert.Contains(t, ids, s.gmReply.ID, state)

			scope := s.service.ResolveViewerScope(ctx, s.game.ID, uid)
			gameIDs, err := s.service.GetFavoriteCommentIDsForGame(ctx, s.game.ID, scope)
			require.NoError(t, err)
			assert.Contains(t, gameIDs, s.gmReply.ID, state)
		}
	})
}

// TestRestrictedFavorites_Pagination has player B star 35 comments while on
// the list, 25 of them in the restricted thread, then come off the list. B's
// favorites must walk five at a time with full pages and exactly the 10
// public ones, and come back whole when B is added again.
func TestRestrictedFavorites_Pagination(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "favpage")
	ctx := context.Background()
	a, b := int32(s.playerA.ID), int32(s.playerB.ID)

	require.NoError(t, s.service.SetPostViewers(ctx, s.restrictedPost.ID, true, []int32{a, b}))
	public, restricted := s.interleave(t)
	everything := append(append([]int32{}, public...), restricted...)
	for _, id := range everything {
		require.NoError(t, s.service.SetCommentFavorite(ctx, b, id, true))
		require.NoError(t, s.service.SetCommentFavorite(ctx, a, id, true))
	}
	require.NoError(t, s.service.SetPostViewers(ctx, s.restrictedPost.ID, true, []int32{a}))

	const limit = 5
	t.Run("removed player B", func(t *testing.T) {
		assert.ElementsMatch(t, public, s.walkFavorites(t, b, limit))
	})
	t.Run("listed player A", func(t *testing.T) {
		assert.ElementsMatch(t, everything, s.walkFavorites(t, a, limit))
	})
	t.Run("B added back gets the stars back", func(t *testing.T) {
		require.NoError(t, s.service.SetPostViewers(ctx, s.restrictedPost.ID, true, []int32{a, b}))
		assert.ElementsMatch(t, everything, s.walkFavorites(t, b, limit))
	})
}
