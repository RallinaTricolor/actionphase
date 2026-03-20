package messages

import (
	"context"
	"testing"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMessageService_ListCharacterPostsAndComments(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	t.Run("returns posts and comments by character", func(t *testing.T) {
		// Create a post by the character
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Character post",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create a comment by the character
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Character comment",
			ParentID:    post.ID,
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		result, err := service.ListCharacterPostsAndComments(context.Background(), char.ID, 20, 0)
		require.NoError(t, err)

		// Should have both post and comment
		assert.Len(t, result, 2)

		// Find the comment and verify it has parent data
		var foundComment *core.CharacterMessage
		var foundPost *core.CharacterMessage
		for i := range result {
			if result[i].ID == comment.ID {
				foundComment = &result[i]
			}
			if result[i].ID == post.ID {
				foundPost = &result[i]
			}
		}

		require.NotNil(t, foundComment, "comment not found in results")
		assert.Equal(t, "comment", foundComment.MessageType)
		require.NotNil(t, foundComment.ParentContent, "comment should have parent content")
		assert.Equal(t, "Character post", *foundComment.ParentContent)

		require.NotNil(t, foundPost, "post not found in results")
		assert.Equal(t, "post", foundPost.MessageType)
		assert.Nil(t, foundPost.ParentContent, "post should not have parent content")
	})

	t.Run("returns empty slice for character with no messages", func(t *testing.T) {
		otherChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(gm.ID)),
			Name:          "Empty Character",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		result, err := service.ListCharacterPostsAndComments(context.Background(), otherChar.ID, 20, 0)
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("pagination works correctly", func(t *testing.T) {
		paginatedChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(player.ID)),
			Name:          "Paginated Character",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		// Create 3 posts
		for i := 0; i < 3; i++ {
			_, err := service.CreatePost(context.Background(), core.CreatePostRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: paginatedChar.ID,
				Content:     "Post content",
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
		}

		// First page: 2 items
		page1, err := service.ListCharacterPostsAndComments(context.Background(), paginatedChar.ID, 2, 0)
		require.NoError(t, err)
		assert.Len(t, page1, 2)

		// Second page: 1 item
		page2, err := service.ListCharacterPostsAndComments(context.Background(), paginatedChar.ID, 2, 2)
		require.NoError(t, err)
		assert.Len(t, page2, 1)
	})
}

func TestMessageService_ListCharacterPostsAndComments_NPCFilter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm_npc", "gm_npc@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "NPC Filter Test Game")

	npc, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "Test NPC",
		CharacterType: "npc",
	})
	require.NoError(t, err)

	// Create a top-level post by the NPC
	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(gm.ID),
		CharacterID: npc.ID,
		Content:     "NPC post (should be hidden)",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	// Create a comment by the NPC (should be visible)
	_, err = service.CreateComment(context.Background(), core.CreateCommentRequest{
		GameID:      game.ID,
		AuthorID:    int32(gm.ID),
		CharacterID: npc.ID,
		Content:     "NPC comment (should be visible)",
		ParentID:    post.ID,
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	result, err := service.ListCharacterPostsAndComments(context.Background(), npc.ID, 20, 0)
	require.NoError(t, err)

	// Only the comment should be returned, not the post
	assert.Len(t, result, 1)
	assert.Equal(t, "comment", result[0].MessageType)
}

func TestMessageService_CountCharacterPostsAndComments(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "gm2", "gm2@example.com")
	player := testDB.CreateTestUser(t, "player2", "player2@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Count Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Count Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Initially 0
	count, err := service.CountCharacterPostsAndComments(context.Background(), char.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)

	// Create 2 posts
	for i := 0; i < 2; i++ {
		_, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)
	}

	count, err = service.CountCharacterPostsAndComments(context.Background(), char.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(2), count)
}
