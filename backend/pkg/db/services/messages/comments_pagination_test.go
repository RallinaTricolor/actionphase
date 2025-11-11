package messages

import (
	"context"
	"fmt"
	"testing"
	"time"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMessageService_GetPostCommentsWithThreads(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Setup test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

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

	t.Run("fetches paginated top-level comments with nested replies", func(t *testing.T) {
		// Create a post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for pagination test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create 10 top-level comments with nested replies
		var topLevelCommentIDs []int32
		for i := 0; i < 10; i++ {
			time.Sleep(1 * time.Millisecond) // Ensure different timestamps
			comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: char.ID,
				ParentID:    post.ID,
				Content:     fmt.Sprintf("Top-level comment %d", i),
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
			topLevelCommentIDs = append(topLevelCommentIDs, comment.ID)

			// Add 2 nested replies to each top-level comment
			for j := 0; j < 2; j++ {
				time.Sleep(1 * time.Millisecond)
				_, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
					GameID:      game.ID,
					AuthorID:    int32(player.ID),
					CharacterID: char.ID,
					ParentID:    comment.ID,
					Content:     fmt.Sprintf("Reply %d to comment %d", j, i),
					Visibility:  string(models.MessageVisibilityGame),
				})
				require.NoError(t, err)
			}
		}

		// Fetch first 5 top-level comments with all nested replies
		comments, err := service.GetPostCommentsWithThreads(context.Background(), post.ID, 5, 0, 5)
		require.NoError(t, err)

		// Should return 5 top-level comments + (5 * 2) nested = 15 total
		assert.Equal(t, 15, len(comments))

		// Count top-level comments (depth=0)
		topLevelCount := 0
		nestedCount := 0
		for _, c := range comments {
			if c.Depth == 0 {
				topLevelCount++
			} else {
				nestedCount++
			}
		}
		assert.Equal(t, 5, topLevelCount, "Should have 5 top-level comments")
		assert.Equal(t, 10, nestedCount, "Should have 10 nested replies (5 comments * 2 replies each)")

		// Verify depth field is correct
		for _, c := range comments {
			if c.Comment.ParentID.Valid {
				// Find parent to verify depth
				parentID := c.Comment.ParentID.Int32
				if parentID == post.ID {
					assert.Equal(t, int32(0), c.Depth, "Top-level comments should have depth=0")
				} else {
					assert.Equal(t, int32(1), c.Depth, "First-level replies should have depth=1")
				}
			}
		}
	})

	t.Run("respects max_depth parameter", func(t *testing.T) {
		// Create a post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for max_depth test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create nested comment chain: level 0 -> level 1 -> level 2 -> level 3 -> level 4
		time.Sleep(1 * time.Millisecond)
		level0, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Level 0 (top-level)",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		level1, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    level0.ID,
			Content:     "Level 1",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		level2, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    level1.ID,
			Content:     "Level 2",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		level3, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    level2.ID,
			Content:     "Level 3",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		level4, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    level3.ID,
			Content:     "Level 4",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Fetch with max_depth=2 (should get levels 0, 1, 2 only)
		comments, err := service.GetPostCommentsWithThreads(context.Background(), post.ID, 10, 0, 2)
		require.NoError(t, err)

		// Should return 3 comments: level 0, 1, 2
		assert.Equal(t, 3, len(comments))

		// Verify we got the right levels
		foundLevels := make(map[int32]bool)
		for _, c := range comments {
			foundLevels[c.Depth] = true
		}
		assert.True(t, foundLevels[0], "Should include level 0")
		assert.True(t, foundLevels[1], "Should include level 1")
		assert.True(t, foundLevels[2], "Should include level 2")

		// Verify level 3 and 4 are NOT included
		commentIDs := make(map[int32]bool)
		for _, c := range comments {
			commentIDs[c.Comment.ID] = true
		}
		assert.False(t, commentIDs[level3.ID], "Should NOT include level 3")
		assert.False(t, commentIDs[level4.ID], "Should NOT include level 4")
	})

	t.Run("offset pagination works correctly", func(t *testing.T) {
		// Create a post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for offset test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create 8 top-level comments
		var topLevelIDs []int32
		for i := 0; i < 8; i++ {
			time.Sleep(1 * time.Millisecond)
			comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: char.ID,
				ParentID:    post.ID,
				Content:     fmt.Sprintf("Comment %d", i),
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
			topLevelIDs = append(topLevelIDs, comment.ID)
		}

		// Get first page (limit 3, offset 0)
		page1, err := service.GetPostCommentsWithThreads(context.Background(), post.ID, 3, 0, 5)
		require.NoError(t, err)

		// Get second page (limit 3, offset 3)
		page2, err := service.GetPostCommentsWithThreads(context.Background(), post.ID, 3, 3, 5)
		require.NoError(t, err)

		// Count top-level in each page
		page1TopLevel := 0
		page2TopLevel := 0
		for _, c := range page1 {
			if c.Depth == 0 {
				page1TopLevel++
			}
		}
		for _, c := range page2 {
			if c.Depth == 0 {
				page2TopLevel++
			}
		}

		assert.Equal(t, 3, page1TopLevel, "Page 1 should have 3 top-level comments")
		assert.Equal(t, 3, page2TopLevel, "Page 2 should have 3 top-level comments")

		// Verify no duplicates between pages (checking top-level comments only)
		page1TopLevelIDs := make(map[int32]bool)
		for _, c := range page1 {
			if c.Depth == 0 {
				page1TopLevelIDs[c.Comment.ID] = true
			}
		}

		for _, c := range page2 {
			if c.Depth == 0 {
				assert.False(t, page1TopLevelIDs[c.Comment.ID], "Top-level comment should not appear in both pages")
			}
		}

		// Get third page (limit 3, offset 6) - should have remaining 2
		page3, err := service.GetPostCommentsWithThreads(context.Background(), post.ID, 3, 6, 5)
		require.NoError(t, err)

		page3TopLevel := 0
		for _, c := range page3 {
			if c.Depth == 0 {
				page3TopLevel++
			}
		}
		assert.Equal(t, 2, page3TopLevel, "Page 3 should have 2 top-level comments")
	})

	t.Run("returns empty array for post with no comments", func(t *testing.T) {
		// Create a post with no comments
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post with no comments",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Fetch comments
		comments, err := service.GetPostCommentsWithThreads(context.Background(), post.ID, 10, 0, 5)
		require.NoError(t, err)

		// Should return empty array
		assert.Equal(t, 0, len(comments))
	})

	t.Run("reply_count is accurate for each comment", func(t *testing.T) {
		// Create a post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for reply_count test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create top-level comment
		time.Sleep(1 * time.Millisecond)
		topLevel, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Top-level with 3 replies",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Add 3 replies to top-level
		for i := 0; i < 3; i++ {
			time.Sleep(1 * time.Millisecond)
			_, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: char.ID,
				ParentID:    topLevel.ID,
				Content:     fmt.Sprintf("Reply %d", i),
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
		}

		// Fetch comments
		comments, err := service.GetPostCommentsWithThreads(context.Background(), post.ID, 10, 0, 5)
		require.NoError(t, err)

		// Find the top-level comment in results
		var topLevelComment *core.CommentWithDepth
		for i := range comments {
			if comments[i].Comment.ID == topLevel.ID {
				topLevelComment = &comments[i]
				break
			}
		}

		require.NotNil(t, topLevelComment, "Top-level comment should be in results")
		assert.Equal(t, int64(3), topLevelComment.Comment.ReplyCount, "Top-level comment should have reply_count=3")
	})

	t.Run("includes deleted comments to preserve thread structure", func(t *testing.T) {
		// Create a post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for deletion test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create top-level comment
		time.Sleep(1 * time.Millisecond)
		topLevel, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Top-level comment to be deleted",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create nested reply
		time.Sleep(1 * time.Millisecond)
		nested, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    topLevel.ID,
			Content:     "Nested reply",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Verify both appear before deletion
		commentsBefore, err := service.GetPostCommentsWithThreads(context.Background(), post.ID, 10, 0, 5)
		require.NoError(t, err)
		assert.Equal(t, 2, len(commentsBefore), "Should have 2 comments before deletion")

		// Delete the top-level comment
		err = service.DeleteComment(context.Background(), topLevel.ID, int32(player.ID))
		require.NoError(t, err)

		// Verify both are STILL INCLUDED after deletion (to preserve thread structure)
		commentsAfter, err := service.GetPostCommentsWithThreads(context.Background(), post.ID, 10, 0, 5)
		require.NoError(t, err)
		assert.Equal(t, 2, len(commentsAfter), "Should still have 2 comments after deletion")

		// Find the deleted comment and verify it's marked as deleted
		commentIDs := make(map[int32]bool)
		var deletedComment *core.CommentWithDepth
		for i := range commentsAfter {
			commentIDs[commentsAfter[i].Comment.ID] = true
			if commentsAfter[i].Comment.ID == topLevel.ID {
				deletedComment = &commentsAfter[i]
			}
		}
		assert.True(t, commentIDs[topLevel.ID], "Deleted top-level comment should still appear")
		assert.True(t, commentIDs[nested.ID], "Nested reply should still appear")
		require.NotNil(t, deletedComment, "Should find deleted comment")
		assert.True(t, deletedComment.Comment.IsDeleted, "Comment should be marked as deleted")
	})
}

func TestMessageService_CountTopLevelComments(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)

	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Setup test data
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

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

	t.Run("returns correct count of top-level comments", func(t *testing.T) {
		// Create a post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for count test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Initial count should be 0
		count, err := service.CountTopLevelComments(context.Background(), post.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)

		// Create 5 top-level comments
		for i := 0; i < 5; i++ {
			time.Sleep(1 * time.Millisecond)
			topLevel, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: char.ID,
				ParentID:    post.ID,
				Content:     fmt.Sprintf("Top-level %d", i),
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)

			// Add 2 nested replies (should NOT be counted)
			for j := 0; j < 2; j++ {
				time.Sleep(1 * time.Millisecond)
				_, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
					GameID:      game.ID,
					AuthorID:    int32(player.ID),
					CharacterID: char.ID,
					ParentID:    topLevel.ID,
					Content:     fmt.Sprintf("Nested %d-%d", i, j),
					Visibility:  string(models.MessageVisibilityGame),
				})
				require.NoError(t, err)
			}
		}

		// Count should be 5 (only top-level, not nested)
		count, err = service.CountTopLevelComments(context.Background(), post.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(5), count)
	})

	t.Run("includes deleted top-level comments in count", func(t *testing.T) {
		// Create a post
		post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post for deletion count test",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create 3 top-level comments
		var commentIDs []int32
		for i := 0; i < 3; i++ {
			time.Sleep(1 * time.Millisecond)
			comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: char.ID,
				ParentID:    post.ID,
				Content:     fmt.Sprintf("Comment %d", i),
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
			commentIDs = append(commentIDs, comment.ID)
		}

		// Count before deletion
		countBefore, err := service.CountTopLevelComments(context.Background(), post.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(3), countBefore)

		// Delete one comment
		err = service.DeleteComment(context.Background(), commentIDs[1], int32(player.ID))
		require.NoError(t, err)

		// Count after deletion should STAY THE SAME (includes deleted to preserve thread structure)
		countAfter, err := service.CountTopLevelComments(context.Background(), post.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(3), countAfter, "Count should include deleted comments")
	})
}
