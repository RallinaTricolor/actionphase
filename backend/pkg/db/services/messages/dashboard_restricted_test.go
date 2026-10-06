package messages

import (
	"context"
	"testing"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// dashboardFor returns the user's recent message IDs and the unread comment
// count on the scenario game's card.
func (s *restrictedScenario) dashboardFor(t *testing.T, userID int32) (recent []int32, unread int) {
	t.Helper()
	dashboards := &db.DashboardService{DB: s.testDB.Pool, Logger: core.NewTestApp(s.testDB.Pool).ObsLogger}
	data, err := dashboards.GetUserDashboard(context.Background(), userID)
	require.NoError(t, err)

	for _, m := range data.RecentMessages {
		recent = append(recent, m.MessageID)
	}
	found := false
	for _, group := range [][]*core.DashboardGameCard{data.PlayerGames, data.GMGames, data.AudienceGames, data.MixedRoleGames} {
		for _, card := range group {
			if card.GameID == s.game.ID {
				unread, found = card.UnreadComments, true
			}
		}
	}
	require.True(t, found, "the game has a card on user %d's dashboard", userID)
	return recent, unread
}

// TestRestrictedDashboard covers the dashboard's recent-message snippets (L7)
// and per-game unread counts (L8). TestRestrictedRuleAgreement checks the
// same queries against every role and state; this checks them end to end
// through GetUserDashboard.
func TestRestrictedDashboard(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "dashr")
	ctx := context.Background()

	// The unread counts only cover the active Common Room phase.
	_, err := testDB.Pool.Exec(ctx, `UPDATE game_phases SET is_active = true WHERE id = $1`, s.phase.ID)
	require.NoError(t, err)

	t.Run("listed player A sees the thread", func(t *testing.T) {
		recent, unread := s.dashboardFor(t, int32(s.playerA.ID))
		assert.Contains(t, recent, s.restrictedPost.ID)
		assert.Contains(t, recent, s.gmReply.ID)
		assert.Equal(t, 1, unread, "the GM's reply; A wrote the other two")
	})

	t.Run("unlisted player B sees none of it", func(t *testing.T) {
		recent, unread := s.dashboardFor(t, int32(s.playerB.ID))
		assert.Contains(t, recent, s.publicPost.ID)
		for _, id := range s.threadIDs() {
			assert.NotContains(t, recent, id)
		}
		assert.Equal(t, 0, unread)
	})

	t.Run("the GM sees A's comments", func(t *testing.T) {
		recent, unread := s.dashboardFor(t, int32(s.gm.ID))
		assert.Contains(t, recent, s.aComment.ID)
		assert.Contains(t, recent, s.aReply.ID)
		assert.Equal(t, 2, unread)
	})

	t.Run("a comment under an unpublished draft stays off the GM's dashboard", func(t *testing.T) {
		phase := testDB.CreateTestPhase(t, s.game.ID, "common_room", "next phase")
		draft, err := s.service.CreateDraftPost(ctx, core.CreatePostRequest{
			GameID: s.game.ID, PhaseID: &phase.ID, AuthorID: int32(s.gm.ID),
			CharacterID: s.gmChar.ID, Content: "not yet", Visibility: "game",
		})
		require.NoError(t, err)
		onDraft := s.reply(t, draft.ID, s.playerA, s.aChar)

		recent, _ := s.dashboardFor(t, int32(s.gm.ID))
		assert.NotContains(t, recent, onDraft.ID)
	})

	t.Run("a public archive shows B the thread", func(t *testing.T) {
		testDB.SetGameStateDirectly(t, s.game.ID, core.GameStateEpilogue)
		recent, unread := s.dashboardFor(t, int32(s.playerB.ID))
		assert.Contains(t, recent, s.restrictedPost.ID)
		assert.Equal(t, 3, unread)
	})
}
