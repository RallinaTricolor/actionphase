package messages

import (
	"context"
	"testing"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRootPostID verifies the insert trigger records every message's thread
// root: a post points at itself, and every comment at any depth points at the
// post at the head of its thread. Restricted-post filtering joins on this
// column, so a wrong root would leak or hide a whole subtree.
func TestRootPostID(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	fixtures := testDB.SetupFixtures(t)
	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	queries := models.New(testDB.Pool)
	ctx := context.Background()

	gameID := fixtures.TestGame.ID
	player := testDB.CreateTestUser(t, "player_rootpost", "player_rootpost@example.com")
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	character, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        gameID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "RootPostChar",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	newPost := func(content string) *models.Message {
		post, err := service.CreatePost(ctx, core.CreatePostRequest{
			GameID:      gameID,
			AuthorID:    int32(player.ID),
			CharacterID: character.ID,
			Content:     content,
			Visibility:  "game",
		})
		require.NoError(t, err)
		return post
	}
	reply := func(parentID int32) *models.Message {
		comment, err := service.CreateComment(ctx, core.CreateCommentRequest{
			GameID:      gameID,
			ParentID:    parentID,
			AuthorID:    int32(player.ID),
			CharacterID: character.ID,
			Content:     "reply",
			Visibility:  "game",
		})
		require.NoError(t, err)
		return comment
	}
	storedRoot := func(id int32) int32 {
		msg, err := queries.GetMessage(ctx, id)
		require.NoError(t, err)
		return msg.RootPostID
	}

	t.Run("a post is its own root", func(t *testing.T) {
		post := newPost("standalone")
		assert.Equal(t, post.ID, post.RootPostID, "returned row")
		assert.Equal(t, post.ID, storedRoot(post.ID), "stored row")
	})

	t.Run("every comment in a deep thread points at the post", func(t *testing.T) {
		post := newPost("deep thread")

		// post -> c1 -> c2 -> c3 -> c4, plus a sibling branch off c1, so a bug
		// that only resolves direct children of the post shows up.
		parentID := post.ID
		var chain []*models.Message
		for range 4 {
			c := reply(parentID)
			chain = append(chain, c)
			parentID = c.ID
		}
		sibling := reply(chain[0].ID)
		require.Equal(t, int32(4), chain[3].ThreadDepth)

		for _, c := range append(chain, sibling) {
			assert.Equal(t, post.ID, c.RootPostID, "returned row for comment %d at depth %d", c.ID, c.ThreadDepth)
			assert.Equal(t, post.ID, storedRoot(c.ID), "stored row for comment %d at depth %d", c.ID, c.ThreadDepth)
		}
	})

	t.Run("threads don't share roots", func(t *testing.T) {
		postA, postB := newPost("thread A"), newPost("thread B")
		replyA, replyB := reply(reply(postA.ID).ID), reply(reply(postB.ID).ID)

		assert.Equal(t, postA.ID, replyA.RootPostID)
		assert.Equal(t, postB.ID, replyB.RootPostID)
	})
}
