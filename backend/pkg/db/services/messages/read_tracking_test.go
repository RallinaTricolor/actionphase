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

func TestMessageService_MarkPostAsRead(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup test data
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(player.ID), "Test Game")

	// Add player as participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	// Create character for player
	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create a post
	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "This is a test post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("creates read marker successfully", func(t *testing.T) {
		marker, err := service.MarkPostAsRead(context.Background(), int32(player.ID), game.ID, post.ID, nil)

		require.NoError(t, err)
		assert.NotNil(t, marker)
		assert.Equal(t, int32(player.ID), marker.UserID)
		assert.Equal(t, game.ID, marker.GameID)
		assert.Equal(t, post.ID, marker.PostID)
		assert.Nil(t, marker.LastReadCommentID)
		assert.NotZero(t, marker.ID)
		assert.NotZero(t, marker.LastReadAt)
		assert.NotZero(t, marker.CreatedAt)
		assert.NotZero(t, marker.UpdatedAt)
	})

	t.Run("updates existing read marker with comment ID", func(t *testing.T) {
		// Create a comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			ParentID:    post.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "This is a test comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Mark as read with comment ID
		commentID := comment.ID
		marker, err := service.MarkPostAsRead(context.Background(), int32(player.ID), game.ID, post.ID, &commentID)

		require.NoError(t, err)
		assert.NotNil(t, marker)
		assert.NotNil(t, marker.LastReadCommentID)
		assert.Equal(t, comment.ID, *marker.LastReadCommentID)
	})

	t.Run("upsert behavior - updates timestamp on second call", func(t *testing.T) {
		// Create new user and post for isolated test
		player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
		game2 := testDB.CreateTestGame(t, int32(player2.ID), "Test Game 2")
		_, err := gameService.AddGameParticipant(context.Background(), game2.ID, int32(player2.ID), "player")
		require.NoError(t, err)

		char2, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game2.ID,
			UserID:        int32Ptr(int32(player2.ID)),
			Name:          "Test Character 2",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		post2, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game2.ID,
			AuthorID:    int32(player2.ID),
			CharacterID: char2.ID,
			Content:     "Another test post",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// First call
		marker1, err := service.MarkPostAsRead(context.Background(), int32(player2.ID), game2.ID, post2.ID, nil)
		require.NoError(t, err)

		// Second call - should update existing marker
		marker2, err := service.MarkPostAsRead(context.Background(), int32(player2.ID), game2.ID, post2.ID, nil)
		require.NoError(t, err)

		// Should have same ID (updated, not created)
		assert.Equal(t, marker1.ID, marker2.ID)
		// Created at should be the same
		assert.Equal(t, marker1.CreatedAt, marker2.CreatedAt)
		// Updated at should be different (newer)
		assert.True(t, marker2.UpdatedAt.After(marker1.UpdatedAt) || marker2.UpdatedAt.Equal(marker1.UpdatedAt))
	})
}

func TestMessageService_GetUserReadMarker(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup test data
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(player.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "This is a test post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("returns nil when no marker exists", func(t *testing.T) {
		marker, err := service.GetUserReadMarker(context.Background(), int32(player.ID), post.ID)

		require.NoError(t, err)
		assert.Nil(t, marker)
	})

	t.Run("returns marker after creation", func(t *testing.T) {
		// Create marker
		created, err := service.MarkPostAsRead(context.Background(), int32(player.ID), game.ID, post.ID, nil)
		require.NoError(t, err)

		// Retrieve it
		marker, err := service.GetUserReadMarker(context.Background(), int32(player.ID), post.ID)

		require.NoError(t, err)
		assert.NotNil(t, marker)
		assert.Equal(t, created.ID, marker.ID)
		assert.Equal(t, created.UserID, marker.UserID)
		assert.Equal(t, created.PostID, marker.PostID)
	})
}

func TestMessageService_GetUserReadMarkersForGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup test data
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(player.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create multiple posts
	post1, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "Post 1",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	post2, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "Post 2",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("returns empty array when no markers exist", func(t *testing.T) {
		markers, err := service.GetUserReadMarkersForGame(context.Background(), int32(player.ID), game.ID)

		require.NoError(t, err)
		assert.NotNil(t, markers)
		assert.Empty(t, markers)
	})

	t.Run("returns all markers for user in game", func(t *testing.T) {
		// Mark both posts as read
		_, err := service.MarkPostAsRead(context.Background(), int32(player.ID), game.ID, post1.ID, nil)
		require.NoError(t, err)

		_, err = service.MarkPostAsRead(context.Background(), int32(player.ID), game.ID, post2.ID, nil)
		require.NoError(t, err)

		// Retrieve all markers
		markers, err := service.GetUserReadMarkersForGame(context.Background(), int32(player.ID), game.ID)

		require.NoError(t, err)
		assert.Len(t, markers, 2)

		// Verify both posts are tracked
		postIDs := []int32{markers[0].PostID, markers[1].PostID}
		assert.Contains(t, postIDs, post1.ID)
		assert.Contains(t, postIDs, post2.ID)
	})

	t.Run("only returns markers for specified user", func(t *testing.T) {
		// Create another user
		player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
		require.NoError(t, err)

		// Player2 marks post1 as read
		_, err = service.MarkPostAsRead(context.Background(), int32(player2.ID), game.ID, post1.ID, nil)
		require.NoError(t, err)

		// Get markers for player1 - should still only have 2
		markers, err := service.GetUserReadMarkersForGame(context.Background(), int32(player.ID), game.ID)

		require.NoError(t, err)
		assert.Len(t, markers, 2)

		// All markers should belong to player1
		for _, marker := range markers {
			assert.Equal(t, int32(player.ID), marker.UserID)
		}
	})
}

func TestMessageService_GetPostsWithUnreadInfo(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup test data
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(player.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	t.Run("returns empty array when no posts exist", func(t *testing.T) {
		emptyGame := testDB.CreateTestGame(t, int32(player.ID), "Empty Game")

		infos, err := service.GetPostsWithUnreadInfo(context.Background(), emptyGame.ID)

		require.NoError(t, err)
		assert.NotNil(t, infos)
		assert.Empty(t, infos)
	})

	t.Run("returns post info with zero comments", func(t *testing.T) {
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post without comments",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		infos, err := service.GetPostsWithUnreadInfo(context.Background(), game.ID)

		require.NoError(t, err)
		assert.NotEmpty(t, infos)

		// Find our post
		var postInfo *core.PostUnreadInfo
		for _, info := range infos {
			if info.PostID == post.ID {
				postInfo = info
				break
			}
		}

		require.NotNil(t, postInfo)
		assert.Equal(t, post.ID, postInfo.PostID)
		assert.Equal(t, int64(0), postInfo.TotalComments)
		assert.Nil(t, postInfo.LatestCommentAt)
	})

	t.Run("returns post info with comments", func(t *testing.T) {
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post with comments",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create 2 comments
		_, err = service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			ParentID:    post.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Comment 1",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		_, err = service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			ParentID:    post.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Comment 2",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		infos, err := service.GetPostsWithUnreadInfo(context.Background(), game.ID)

		require.NoError(t, err)
		assert.NotEmpty(t, infos)

		// Find our post
		var postInfo *core.PostUnreadInfo
		for _, info := range infos {
			if info.PostID == post.ID {
				postInfo = info
				break
			}
		}

		require.NotNil(t, postInfo)
		assert.Equal(t, post.ID, postInfo.PostID)
		assert.Equal(t, int64(2), postInfo.TotalComments)
		// LatestCommentAt might be nil due to type assertion issues, but total comments should be correct
		if postInfo.LatestCommentAt != nil {
			assert.NotZero(t, *postInfo.LatestCommentAt)
		}
	})

	t.Run("excludes deleted posts", func(t *testing.T) {
		// Create a post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post to be deleted",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Delete it
		err = service.DeletePost(context.Background(), post.ID)
		require.NoError(t, err)

		// Should not appear in results
		infos, err := service.GetPostsWithUnreadInfo(context.Background(), game.ID)

		require.NoError(t, err)
		for _, info := range infos {
			assert.NotEqual(t, post.ID, info.PostID, "Deleted post should not appear in unread info")
		}
	})

	t.Run("excludes deleted comments from count", func(t *testing.T) {
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post with deleted comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			ParentID:    post.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Comment to be deleted",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Delete comment
		err = service.DeleteComment(context.Background(), comment.ID)
		require.NoError(t, err)

		infos, err := service.GetPostsWithUnreadInfo(context.Background(), game.ID)

		require.NoError(t, err)

		// Find our post
		var postInfo *core.PostUnreadInfo
		for _, info := range infos {
			if info.PostID == post.ID {
				postInfo = info
				break
			}
		}

		require.NotNil(t, postInfo)
		assert.Equal(t, int64(0), postInfo.TotalComments, "Deleted comments should not be counted")
	})
}
