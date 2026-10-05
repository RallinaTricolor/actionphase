package messages

import (
	"context"
	"testing"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func characterMessageIDs(rows []core.CharacterMessage) []int32 {
	ids := make([]int32, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	return ids
}

// assertCharacterFeed checks one character's profile feed, its total and both
// stats queries against the IDs the viewer should see. The stats count is the
// same number the profile shows, so it must match the feed for every viewer.
func (s *restrictedScenario) assertCharacterFeed(t *testing.T, character *models.Character, scope core.ViewerScope, want []int32) {
	t.Helper()
	ctx := context.Background()

	rows, err := s.service.ListCharacterPostsAndComments(ctx, character.ID, 100, 0, scope)
	require.NoError(t, err)
	assert.ElementsMatch(t, want, characterMessageIDs(rows), "feed")

	total, err := s.service.CountCharacterPostsAndComments(ctx, character.ID, scope)
	require.NoError(t, err)
	assert.Equal(t, int64(len(want)), total, "feed total")

	stats, err := s.characters.GetCharacterActivityStats(ctx, character.ID, scope)
	require.NoError(t, err)
	assert.Equal(t, int64(len(want)), stats.PublicMessages, "stats")

	byGame, err := s.characters.GetCharacterActivityStatsByGame(ctx, s.game.ID, scope)
	require.NoError(t, err)
	require.Contains(t, byGame, character.ID)
	assert.Equal(t, int64(len(want)), byGame[character.ID].PublicMessages, "stats by game")
}

func TestRestrictedCharacterFeed(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "charfeed")

	for _, v := range s.viewers() {
		scope := s.service.ResolveViewerScope(v.ctx(), s.game.ID, v.userID)
		t.Run(v.name, func(t *testing.T) {
			// The GM's character wrote both posts and the depth-2 reply.
			gmWants := []int32{s.publicPost.ID}
			// Player A's character only wrote in the restricted thread.
			aWants := []int32{}
			if v.seesHere {
				gmWants = append(gmWants, s.restrictedPost.ID, s.gmReply.ID)
				aWants = append(aWants, s.aComment.ID, s.aReply.ID)
			}
			s.assertCharacterFeed(t, s.gmChar, scope, gmWants)
			s.assertCharacterFeed(t, s.aChar, scope, aWants)
		})
	}

	t.Run("an unpublished draft and its comments stay off the profile", func(t *testing.T) {
		phase := testDB.CreateTestPhase(t, s.game.ID, "common_room", "next phase")
		draft, err := s.service.CreateDraftPost(context.Background(), core.CreatePostRequest{
			GameID: s.game.ID, PhaseID: &phase.ID, AuthorID: int32(s.gm.ID),
			CharacterID: s.gmChar.ID, Content: "not yet", Visibility: "game",
		})
		require.NoError(t, err)
		s.reply(t, draft.ID, s.gm, s.gmChar)

		// Even the GM: the profile shows published play. Drafts have their own
		// endpoints.
		scope := s.service.ResolveViewerScope(context.Background(), s.game.ID, int32(s.gm.ID))
		s.assertCharacterFeed(t, s.gmChar, scope, []int32{s.publicPost.ID, s.restrictedPost.ID, s.gmReply.ID})
	})

	t.Run("a public archive shows the thread to everyone", func(t *testing.T) {
		for _, state := range []string{core.GameStateCompleted, core.GameStateEpilogue} {
			testDB.SetGameStateDirectly(t, s.game.ID, state)
			for _, uid := range []int32{int32(s.playerB.ID), int32(s.outsider.ID), 0} {
				scope := s.service.ResolveViewerScope(context.Background(), s.game.ID, uid)
				s.assertCharacterFeed(t, s.aChar, scope, []int32{s.aComment.ID, s.aReply.ID})
			}
		}
	})
}

// TestRestrictedCharacterFeed_Pagination walks player A's profile five at a
// time, with A's comments in the restricted thread mixed in among their
// public ones.
func TestRestrictedCharacterFeed_Pagination(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "charpage")
	public, restricted := s.interleave(t)
	everything := append(append(append([]int32{}, public...), restricted...), s.aComment.ID, s.aReply.ID)

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
		t.Run(c.name, func(t *testing.T) {
			got := walkPages(t, limit, func(offset int32) []int32 {
				rows, err := s.service.ListCharacterPostsAndComments(context.Background(), s.aChar.ID, limit, offset, scope)
				require.NoError(t, err)
				return characterMessageIDs(rows)
			})
			assert.ElementsMatch(t, c.want, got, "every visible message once, nothing hidden")
			s.assertCharacterFeed(t, s.aChar, scope, c.want)
		})
	}
}
