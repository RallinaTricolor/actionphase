package characters

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	dbmessages "actionphase/pkg/db/services/messages"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestCharacterStats_RestrictedPosts checks that both stats endpoints count a
// comment in a restricted thread only for callers who can see the thread. A
// count that includes it would tell an unlisted player the thread exists.
func TestCharacterStats_RestrictedPosts(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	app := core.NewTestApp(testDB.Pool)
	ctx := context.Background()

	statsRouter := setupStatsTestRouter(app, testDB)
	gameStatsRouter := setupGameStatsTestRouter(app, testDB)

	gm := testDB.CreateTestUser(t, "rstats_gm", "rstats_gm@example.com")
	playerA := testDB.CreateTestUser(t, "rstats_a", "rstats_a@example.com")
	playerB := testDB.CreateTestUser(t, "rstats_b", "rstats_b@example.com")
	audience := testDB.CreateTestUser(t, "rstats_audience", "rstats_audience@example.com")
	game := testDB.CreateTestGameWithState(t, int32(gm.ID), "Restricted Stats Game", core.GameStateInProgress)
	testDB.AddTestGameParticipant(t, game.ID, int32(playerA.ID), "player")
	testDB.AddTestGameParticipant(t, game.ID, int32(playerB.ID), "player")
	testDB.AddTestGameParticipant(t, game.ID, int32(audience.ID), "audience")
	phase := testDB.CreateTestPhase(t, game.ID, "common_room", "Scene")

	characters := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gmID, aID := int32(gm.ID), int32(playerA.ID)
	gmChar, err := characters.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID: game.ID, UserID: &gmID, Name: "Narrator", CharacterType: "player_character",
	})
	require.NoError(t, err)
	aChar, err := characters.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID: game.ID, UserID: &aID, Name: "Alice", CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Alice has one comment in a public thread and one in a thread restricted
	// to her player.
	messages := &dbmessages.MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	post := func(viewers []int32) int32 {
		p, err := messages.CreatePost(ctx, core.CreatePostRequest{
			GameID: game.ID, PhaseID: &phase.ID, AuthorID: gmID, CharacterID: gmChar.ID,
			Content: "scene", Visibility: "game", RestrictedToUserIDs: viewers,
		})
		require.NoError(t, err)
		return p.ID
	}
	for _, postID := range []int32{post(nil), post([]int32{aID})} {
		_, err := messages.CreateComment(ctx, core.CreateCommentRequest{
			GameID: game.ID, ParentID: postID, AuthorID: aID, CharacterID: aChar.ID,
			Content: "reply", Visibility: "game",
		})
		require.NoError(t, err)
	}

	get := func(t *testing.T, router http.Handler, user *core.User, path string, into any) {
		t.Helper()
		token, err := core.CreateTestJWTTokenForUser(app, user)
		require.NoError(t, err)
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), into))
	}

	for _, c := range []struct {
		name string
		user *core.User
		want int64
	}{
		{"gm", gm, 2},
		{"audience", audience, 2},
		{"listed player A", playerA, 2},
		{"unlisted player B", playerB, 1},
	} {
		t.Run(c.name, func(t *testing.T) {
			var one CharacterStatsResponse
			get(t, statsRouter, c.user, fmt.Sprintf("/api/v1/characters/%d/stats", aChar.ID), &one)
			assert.Equal(t, c.want, one.PublicMessages, "single character")

			var roster map[string]CharacterStatsResponse
			get(t, gameStatsRouter, c.user, fmt.Sprintf("/api/v1/games/%d/characters/stats", game.ID), &roster)
			assert.Equal(t, c.want, roster[strconv.Itoa(int(aChar.ID))].PublicMessages, "whole roster")
		})
	}
}
