package messages

import (
	"context"
	"fmt"
	"slices"
	"testing"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// restrictedScenario is the shared cast for restricted-post tests: a GM, a
// co-GM, players A, B and C, an audience member, an authenticated
// non-participant and a site admin. One public post, and one post restricted
// to A with a thread three deep (A comments, the GM replies, A replies again)
// so a bug that only resolves direct children shows up.
//
// Both posts are in one phase so phase-scoped listings can be checked too.
type restrictedScenario struct {
	testDB     *core.TestDatabase
	service    *MessageService
	characters *db.CharacterService
	game       *models.Game
	phase      *models.GamePhase

	gm, coGM, playerA, playerB, playerC, audience, outsider, admin *core.User

	gmChar, aChar *models.Character

	publicPost, restrictedPost *models.Message
	aComment, gmReply, aReply  *models.Message
}

// setPostViewers calls SetPostViewers in the scenario's game, for tests that
// only need its side effects.
func (s *restrictedScenario) setPostViewers(ctx context.Context, postID int32, restricted bool, userIDs []int32) error {
	_, _, err := s.service.SetPostViewers(ctx, s.game.ID, postID, restricted, userIDs)
	return err
}

// newRestrictedScenario builds the cast. prefix keeps usernames unique when a
// package builds more than one scenario in the same database.
func newRestrictedScenario(t *testing.T, testDB *core.TestDatabase, prefix string) *restrictedScenario {
	t.Helper()
	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)

	s := &restrictedScenario{
		testDB:  testDB,
		service: &MessageService{DB: testDB.Pool, Logger: app.ObsLogger},
	}
	user := func(name string) *core.User {
		return testDB.CreateTestUser(t, prefix+"_"+name, prefix+"_"+name+"@example.com")
	}
	s.gm, s.coGM = user("gm"), user("cogm")
	s.playerA, s.playerB, s.playerC = user("a"), user("b"), user("c")
	s.audience, s.outsider, s.admin = user("audience"), user("outsider"), user("admin")

	_, err := testDB.Pool.Exec(ctx, "UPDATE users SET is_admin = true WHERE id = $1", s.admin.ID)
	require.NoError(t, err)

	s.game = testDB.CreateTestGameWithState(t, int32(s.gm.ID), prefix+" game", core.GameStateInProgress)
	s.phase = testDB.CreateTestPhase(t, s.game.ID, "common_room", prefix+" phase")
	testDB.AddTestGameParticipant(t, s.game.ID, int32(s.coGM.ID), "co_gm")
	testDB.AddTestGameParticipant(t, s.game.ID, int32(s.playerA.ID), "player")
	testDB.AddTestGameParticipant(t, s.game.ID, int32(s.playerB.ID), "player")
	testDB.AddTestGameParticipant(t, s.game.ID, int32(s.playerC.ID), "player")
	testDB.AddTestGameParticipant(t, s.game.ID, int32(s.audience.ID), "audience")

	characters := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	s.characters = characters
	character := func(owner *core.User, name string) *models.Character {
		ownerID := int32(owner.ID)
		c, err := characters.CreateCharacter(ctx, db.CreateCharacterRequest{
			GameID:        s.game.ID,
			UserID:        &ownerID,
			Name:          prefix + " " + name,
			CharacterType: "player_character",
		})
		require.NoError(t, err)
		return c
	}
	s.gmChar, s.aChar = character(s.gm, "Narrator"), character(s.playerA, "Alice")

	s.publicPost = s.createPost(t, "public scene", nil)
	s.restrictedPost = s.createPost(t, "secret scene", []int32{int32(s.playerA.ID)})
	s.aComment = s.reply(t, s.restrictedPost.ID, s.playerA, s.aChar)
	s.gmReply = s.reply(t, s.aComment.ID, s.gm, s.gmChar)
	s.aReply = s.reply(t, s.gmReply.ID, s.playerA, s.aChar)
	require.Equal(t, int32(3), s.aReply.ThreadDepth)

	return s
}

func (s *restrictedScenario) createPost(t *testing.T, content string, viewers []int32) *models.Message {
	t.Helper()
	phaseID := s.phase.ID
	post, err := s.service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:              s.game.ID,
		PhaseID:             &phaseID,
		AuthorID:            int32(s.gm.ID),
		CharacterID:         s.gmChar.ID,
		Content:             content,
		Visibility:          "game",
		RestrictedToUserIDs: viewers,
	})
	require.NoError(t, err)
	return post
}

func (s *restrictedScenario) reply(t *testing.T, parentID int32, author *core.User, character *models.Character) *models.Message {
	t.Helper()
	comment, err := s.service.CreateComment(context.Background(), core.CreateCommentRequest{
		GameID:      s.game.ID,
		ParentID:    parentID,
		AuthorID:    int32(author.ID),
		CharacterID: character.ID,
		Content:     "reply",
		Visibility:  "game",
	})
	require.NoError(t, err)
	return comment
}

// threadIDs is every message in the restricted thread, post first.
func (s *restrictedScenario) threadIDs() []int32 {
	return []int32{s.restrictedPost.ID, s.aComment.ID, s.gmReply.ID, s.aReply.ID}
}

// viewer is one member of the cast, with whether they may see the restricted
// thread in a game that is in progress.
type viewer struct {
	name      string
	userID    int32
	adminMode bool
	seesAll   bool // bypasses the allowlist
	seesHere  bool // sees the scenario's restricted thread
}

func (s *restrictedScenario) viewers() []viewer {
	return []viewer{
		{name: "gm", userID: int32(s.gm.ID), seesAll: true, seesHere: true},
		{name: "co-gm", userID: int32(s.coGM.ID), seesAll: true, seesHere: true},
		{name: "audience", userID: int32(s.audience.ID), seesAll: true, seesHere: true},
		{name: "admin in admin mode", userID: int32(s.admin.ID), adminMode: true, seesAll: true, seesHere: true},
		{name: "listed player A", userID: int32(s.playerA.ID), seesHere: true},
		{name: "unlisted player B", userID: int32(s.playerB.ID)},
		{name: "unlisted player C", userID: int32(s.playerC.ID)},
		{name: "non-participant", userID: int32(s.outsider.ID)},
		{name: "admin without admin mode", userID: int32(s.admin.ID)},
		{name: "no user", userID: 0},
	}
}

func (v viewer) ctx() context.Context {
	return core.WithAdminMode(context.Background(), v.adminMode)
}

func TestCanUserViewMessage(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "canview")

	for _, v := range s.viewers() {
		t.Run(v.name, func(t *testing.T) {
			visible, err := s.service.CanUserViewMessage(v.ctx(), s.publicPost.ID, v.userID)
			require.NoError(t, err)
			assert.True(t, visible, "everyone sees the public post")

			for _, id := range s.threadIDs() {
				visible, err := s.service.CanUserViewMessage(v.ctx(), id, v.userID)
				require.NoError(t, err)
				assert.Equal(t, v.seesHere, visible, "message %d in the restricted thread", id)
			}
		})
	}

	t.Run("unknown message is hidden, not an error", func(t *testing.T) {
		visible, err := s.service.CanUserViewMessage(context.Background(), 999999, int32(s.gm.ID))
		require.NoError(t, err)
		assert.False(t, visible)
	})
}

func TestCanUserViewMessage_GameState(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "canviewstate")
	ctx := context.Background()

	for _, state := range core.ValidGameStates {
		t.Run(state, func(t *testing.T) {
			testDB.SetGameStateDirectly(t, s.game.ID, state)
			for _, uid := range []int32{int32(s.playerB.ID), int32(s.outsider.ID)} {
				for _, id := range s.threadIDs() {
					visible, err := s.service.CanUserViewMessage(ctx, id, uid)
					require.NoError(t, err)
					assert.Equal(t, core.IsPublicArchive(state), visible,
						"user %d, message %d: only a public archive lifts the restriction", uid, id)
				}
			}
		})
	}
}

func TestCanUserViewMessage_DraftPost(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "canviewdraft")

	phase := testDB.CreateTestPhase(t, s.game.ID, "common_room", "pending phase")
	draft, err := s.service.CreateDraftPost(context.Background(), core.CreatePostRequest{
		GameID:      s.game.ID,
		PhaseID:     &phase.ID,
		AuthorID:    int32(s.gm.ID),
		CharacterID: s.gmChar.ID,
		Content:     "not yet",
		Visibility:  "game",
	})
	require.NoError(t, err)

	// Drafts follow the draft endpoints (GM and co-GM only), not the allowlist
	// bypass: audience can't open the draft endpoints, so not this either.
	want := map[string]bool{"gm": true, "co-gm": true, "admin in admin mode": true}
	for _, v := range s.viewers() {
		t.Run(v.name, func(t *testing.T) {
			visible, err := s.service.CanUserViewMessage(v.ctx(), draft.ID, v.userID)
			require.NoError(t, err)
			assert.Equal(t, want[v.name], visible)
		})
	}
}

// TestResolveViewerScope runs every role through every game state and checks
// the scope agrees with the rule as core states it.
func TestResolveViewerScope(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "scope")

	roles := map[string]string{
		"gm": "gm", "co-gm": "co_gm", "audience": "audience",
		"listed player A": "player", "unlisted player B": "player", "unlisted player C": "player",
		"non-participant": "", "admin in admin mode": "", "admin without admin mode": "", "no user": "",
	}

	for _, state := range core.ValidGameStates {
		testDB.SetGameStateDirectly(t, s.game.ID, state)
		for _, v := range s.viewers() {
			t.Run(fmt.Sprintf("%s/%s", state, v.name), func(t *testing.T) {
				scope := s.service.ResolveViewerScope(v.ctx(), s.game.ID, v.userID)
				want := core.IsPublicArchive(state) || core.CanSeeAllRestrictedPosts(roles[v.name], v.adminMode)
				assert.Equal(t, want, scope.SeesAll)
				assert.Equal(t, v.userID, scope.UserID)
			})
		}
	}

	t.Run("unknown game fails closed", func(t *testing.T) {
		scope := s.service.ResolveViewerScope(context.Background(), 999999, int32(s.gm.ID))
		assert.False(t, scope.SeesAll)
	})
}

// TestRestrictedRuleAgreement runs every role through every game state and
// checks that each SQL copy of the restricted-post rule gives the same answer
// as the Go rule (CanUserViewMessage). Cross-game queries can't take a
// precomputed viewer_sees_all, so they restate the rule in SQL; this is what
// stops a copy drifting.
//
// Admin mode is left out: it is a per-request flag, and the SQL copies treat
// admins as normal users on purpose.
func TestRestrictedRuleAgreement(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	s := newRestrictedScenario(t, testDB, "agree")
	ctx := context.Background()
	queries := models.New(testDB.Pool)

	// Two participants whose role would bypass the list if they were active.
	inactiveCoGM := testDB.CreateTestUser(t, "agree_inactive_cogm", "agree_inactive_cogm@example.com")
	removedAudience := testDB.CreateTestUser(t, "agree_removed_audience", "agree_removed_audience@example.com")
	testDB.AddTestGameParticipant(t, s.game.ID, int32(inactiveCoGM.ID), "co_gm")
	testDB.AddTestGameParticipant(t, s.game.ID, int32(removedAudience.ID), "audience")
	_, err := testDB.Pool.Exec(ctx, `UPDATE game_participants SET status = 'inactive' WHERE game_id = $1 AND user_id = $2`, s.game.ID, inactiveCoGM.ID)
	require.NoError(t, err)
	_, err = testDB.Pool.Exec(ctx, `UPDATE game_participants SET status = 'removed' WHERE game_id = $1 AND user_id = $2`, s.game.ID, removedAudience.ID)
	require.NoError(t, err)

	// The dashboard's unread count only covers the active Common Room phase.
	_, err = testDB.Pool.Exec(ctx, `UPDATE game_phases SET is_active = true WHERE id = $1`, s.phase.ID)
	require.NoError(t, err)

	type member struct {
		name   string
		userID int32
		// onDashboard: the dashboard covers this game for them at all.
		// inRecent: the recent-messages snippet covers it (no audience).
		onDashboard, inRecent bool
	}
	cast := []member{
		{"gm", int32(s.gm.ID), true, true},
		{"co-gm", int32(s.coGM.ID), true, true},
		{"audience", int32(s.audience.ID), true, false},
		{"listed player A", int32(s.playerA.ID), true, true},
		{"unlisted player B", int32(s.playerB.ID), true, true},
		{"non-participant", int32(s.outsider.ID), false, false},
		{"site admin", int32(s.admin.ID), false, false},
		{"inactive co-gm", int32(inactiveCoGM.ID), false, false},
		{"removed audience", int32(removedAudience.ID), false, false},
	}

	// Everyone stars the GM's reply in the restricted thread.
	for _, m := range cast {
		require.NoError(t, queries.AddCommentFavorite(ctx, models.AddCommentFavoriteParams{
			UserID: m.userID, CommentID: s.gmReply.ID, GameID: s.game.ID,
		}))
	}
	notifications := &db.NotificationService{DB: testDB.Pool, Logger: core.NewTestApp(testDB.Pool).ObsLogger}
	thread := []*models.Message{s.restrictedPost, s.aComment, s.gmReply, s.aReply}

	for _, state := range core.ValidGameStates {
		testDB.SetGameStateDirectly(t, s.game.ID, state)
		for _, m := range cast {
			t.Run(state+"/"+m.name, func(t *testing.T) {
				want, err := s.service.CanUserViewMessage(ctx, s.gmReply.ID, m.userID)
				require.NoError(t, err)

				// Favorites: the ID set and the list.
				ids, err := queries.GetFavoriteCommentIDsForUser(ctx, m.userID)
				require.NoError(t, err)
				assert.Equal(t, want, slices.Contains(ids, s.gmReply.ID), "GetFavoriteCommentIDsForUser")

				rows, err := queries.ListFavoriteCommentsWithParents(ctx, models.ListFavoriteCommentsWithParentsParams{
					ViewerUserID: m.userID, PageLimit: 50,
				})
				require.NoError(t, err)
				listed := slices.ContainsFunc(rows, func(r models.ListFavoriteCommentsWithParentsRow) bool { return r.ID == s.gmReply.ID })
				assert.Equal(t, want, listed, "ListFavoriteCommentsWithParents")

				// Dashboard unread count: every thread comment the member
				// didn't write is unread in manual mode.
				if m.onDashboard {
					counts, err := queries.GetUnreadCommentCountsForDashboard(ctx, models.GetUnreadCommentCountsForDashboardParams{
						UserID: m.userID, CommentReadMode: "manual",
					})
					require.NoError(t, err)
					var wantCount int64
					if want {
						for _, msg := range thread[1:] {
							if msg.AuthorID != m.userID {
								wantCount++
							}
						}
					}
					var got int64 = -1
					for _, c := range counts {
						if c.GameID == s.game.ID {
							got = c.UnreadCount
						}
					}
					assert.Equal(t, wantCount, got, "GetUnreadCommentCountsForDashboard")
				}

				// Dashboard recent messages.
				if m.inRecent {
					recent, err := queries.GetUserRecentMessages(ctx, models.GetUserRecentMessagesParams{UserID: m.userID, RowLimit: 100})
					require.NoError(t, err)
					for _, msg := range thread {
						if msg.AuthorID == m.userID {
							continue
						}
						found := slices.ContainsFunc(recent, func(r models.GetUserRecentMessagesRow) bool { return r.MessageID == msg.ID })
						assert.Equal(t, want, found, "GetUserRecentMessages, message %d", msg.ID)
					}
				}

				// The notification cleanup only runs outside a public archive,
				// so its SQL has no state check to compare there.
				if core.IsPublicArchive(state) {
					return
				}
				const title = "agreement probe"
				gameID, relatedID, relatedType := s.game.ID, s.aComment.ID, "comment"
				_, err = notifications.CreateNotification(ctx, &core.CreateNotificationRequest{
					UserID: m.userID, GameID: &gameID, Type: core.NotificationTypeCommentReply, Title: title,
					RelatedType: &relatedType, RelatedID: &relatedID,
				})
				require.NoError(t, err)
				require.NoError(t, queries.DeleteThreadNotificationsForHiddenUsers(ctx, s.restrictedPost.ID))
				var kept int
				require.NoError(t, testDB.Pool.QueryRow(ctx,
					`SELECT count(*) FROM notifications WHERE user_id = $1 AND title = $2`, m.userID, title).Scan(&kept))
				assert.Equal(t, want, kept == 1, "DeleteThreadNotificationsForHiddenUsers")
				_, err = testDB.Pool.Exec(ctx, `DELETE FROM notifications WHERE user_id = $1 AND title = $2`, m.userID, title)
				require.NoError(t, err)
			})
		}
	}
}
