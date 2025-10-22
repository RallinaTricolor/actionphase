package messages

import (
	"context"
	"testing"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
	phasesvc "actionphase/pkg/db/services/phases"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMessageService_CreatePost(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

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

	t.Run("creates post successfully", func(t *testing.T) {
		req := core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "This is a test post",
			Visibility:  string(models.MessageVisibilityGame),
		}

		post, err := service.CreatePost(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, post)
		assert.Equal(t, req.GameID, post.GameID)
		assert.Equal(t, req.CharacterID, post.CharacterID)
		assert.Equal(t, req.Content, post.Content)
		assert.Equal(t, models.MessageTypePost, post.MessageType)
	})

	t.Run("rejects post from non-owned character", func(t *testing.T) {
		// Try to post as player using GM's character
		gmChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(gm.ID)),
			Name:          "GM Character",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		req := core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID), // Player trying to use GM's character
			CharacterID: gmChar.ID,
			Content:     "Unauthorized post",
			Visibility:  string(models.MessageVisibilityGame),
		}

		_, err = service.CreatePost(context.Background(), req)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "character")
	})
}

func TestMessageService_CreateComment(t *testing.T) {
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

	// Create character
	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create parent post
	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "Parent post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("creates comment successfully", func(t *testing.T) {
		req := core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "This is a comment",
			Visibility:  string(models.MessageVisibilityGame),
		}

		comment, err := service.CreateComment(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, comment)
		assert.Equal(t, req.GameID, comment.GameID)
		assert.Equal(t, req.Content, comment.Content)
		assert.Equal(t, models.MessageTypeComment, comment.MessageType)
		assert.True(t, comment.ParentID.Valid)
		assert.Equal(t, post.ID, comment.ParentID.Int32)
	})

	t.Run("maintains thread depth", func(t *testing.T) {
		// Create first-level comment
		comment1, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "First level comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create second-level comment (nested reply)
		comment2, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    comment1.ID,
			Content:     "Second level comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Verify thread depth increased
		assert.Greater(t, comment2.ThreadDepth, comment1.ThreadDepth)
	})
}

func TestMessageService_GetGamePosts(t *testing.T) {
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
	for i := 0; i < 3; i++ {
		_, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Test post",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)
	}

	t.Run("retrieves all game posts", func(t *testing.T) {
		posts, err := service.GetGamePosts(context.Background(), game.ID, nil, 10, 0)

		require.NoError(t, err)
		assert.Len(t, posts, 3)
	})

	t.Run("respects pagination", func(t *testing.T) {
		// Get first page
		posts1, err := service.GetGamePosts(context.Background(), game.ID, nil, 2, 0)
		require.NoError(t, err)
		assert.Len(t, posts1, 2)

		// Get second page
		posts2, err := service.GetGamePosts(context.Background(), game.ID, nil, 2, 2)
		require.NoError(t, err)
		assert.Len(t, posts2, 1)
	})
}

func TestMessageService_UpdateAndDelete(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
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
		Content:     "Original content",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("updates post content", func(t *testing.T) {
		updatedPost, err := service.UpdatePost(context.Background(), post.ID, "Updated content")

		require.NoError(t, err)
		assert.Equal(t, "Updated content", updatedPost.Content)
		assert.True(t, updatedPost.IsEdited)
	})

	t.Run("soft deletes post", func(t *testing.T) {
		err := service.DeletePost(context.Background(), post.ID)

		require.NoError(t, err)

		// Verify post is marked as deleted but still exists
		deletedPost, err := service.GetPost(context.Background(), post.ID)
		require.NoError(t, err)
		assert.True(t, deletedPost.Message.IsDeleted)
	})
}

func TestMessageService_Reactions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
	user1 := testDB.CreateTestUser(t, "user1", "user1@example.com")
	user2 := testDB.CreateTestUser(t, "user2", "user2@example.com")
	game := testDB.CreateTestGame(t, int32(user1.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user1.ID), "player")
	require.NoError(t, err)

	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(user1.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(user1.ID),
		CharacterID: char.ID,
		Content:     "Test post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("adds reaction to post", func(t *testing.T) {
		reaction, err := service.AddReaction(context.Background(), post.ID, int32(user2.ID), "👍")

		require.NoError(t, err)
		assert.NotNil(t, reaction)
		assert.Equal(t, post.ID, reaction.MessageID)
		assert.Equal(t, int32(user2.ID), reaction.UserID)
		assert.Equal(t, "👍", reaction.ReactionType)
	})

	t.Run("retrieves reaction counts", func(t *testing.T) {
		// Add multiple reactions
		_, err := service.AddReaction(context.Background(), post.ID, int32(user1.ID), "❤️")
		require.NoError(t, err)
		_, err = service.AddReaction(context.Background(), post.ID, int32(user2.ID), "❤️")
		require.NoError(t, err)

		counts, err := service.GetReactionCounts(context.Background(), post.ID)

		require.NoError(t, err)
		assert.NotEmpty(t, counts)

		// Verify reaction count structure
		for _, count := range counts {
			assert.NotEmpty(t, count.ReactionType)
			assert.Greater(t, count.Count, int64(0))
		}
	})

	t.Run("removes reaction", func(t *testing.T) {
		// Add reaction first
		_, err := service.AddReaction(context.Background(), post.ID, int32(user1.ID), "🎉")
		require.NoError(t, err)

		// Remove it
		err = service.RemoveReaction(context.Background(), post.ID, int32(user1.ID), "🎉")

		require.NoError(t, err)
	})
}

func TestMessageService_ValidateCharacterOwnership(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Create player character
	playerChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Player Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create GM NPC
	gmNPC, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "GM NPC",
		CharacterType: "npc_gm",
	})
	require.NoError(t, err)

	t.Run("validates player owns their character", func(t *testing.T) {
		err := service.ValidateCharacterOwnership(context.Background(), playerChar.ID, int32(player.ID), game.ID)

		require.NoError(t, err)
	})

	t.Run("rejects character from different user", func(t *testing.T) {
		err := service.ValidateCharacterOwnership(context.Background(), playerChar.ID, int32(gm.ID), game.ID)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "character does not belong to this user")
	})

	t.Run("allows GM to use GM NPCs", func(t *testing.T) {
		err := service.ValidateCharacterOwnership(context.Background(), gmNPC.ID, int32(gm.ID), game.ID)

		require.NoError(t, err)
	})

	t.Run("rejects character from different game", func(t *testing.T) {
		// Create another game
		otherGame := testDB.CreateTestGame(t, int32(gm.ID), "Other Game")

		err := service.ValidateCharacterOwnership(context.Background(), playerChar.ID, int32(player.ID), otherGame.ID)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "character does not belong to this game")
	})
}

func TestMessageService_GetComment(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
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

	// Create parent post
	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "Parent post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	// Create comment
	comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		ParentID:    post.ID,
		Content:     "Test comment",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("retrieves comment successfully", func(t *testing.T) {
		retrieved, err := service.GetComment(context.Background(), comment.ID)

		require.NoError(t, err)
		assert.NotNil(t, retrieved)
		assert.Equal(t, comment.ID, retrieved.ID)
		assert.Equal(t, comment.Content, retrieved.Content)
		assert.Equal(t, models.MessageTypeComment, retrieved.MessageType)
	})

	t.Run("returns error for non-existent comment", func(t *testing.T) {
		_, err := service.GetComment(context.Background(), 99999)

		require.Error(t, err)
	})
}

func TestMessageService_CommentCRUD(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
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

	// Create parent post
	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "Parent post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("updates comment content", func(t *testing.T) {
		// Create comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Original comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Update comment
		updated, err := service.UpdateComment(context.Background(), comment.ID, "Updated comment")

		require.NoError(t, err)
		assert.Equal(t, "Updated comment", updated.Content)
		assert.True(t, updated.IsEdited)
	})

	t.Run("soft deletes comment", func(t *testing.T) {
		// Create comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Comment to delete",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Delete comment
		err = service.DeleteComment(context.Background(), comment.ID, int32(player.ID))
		require.NoError(t, err)

		// Verify comment is marked as deleted
		deletedComment, err := service.GetComment(context.Background(), comment.ID)
		require.NoError(t, err)
		assert.True(t, deletedComment.IsDeleted)
	})
}

func TestMessageService_GetPostComments(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
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

	// Create parent post
	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "Parent post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	// Create multiple comments
	for i := 0; i < 3; i++ {
		_, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Test comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)
	}

	t.Run("retrieves all direct child comments", func(t *testing.T) {
		comments, err := service.GetPostComments(context.Background(), post.ID)

		require.NoError(t, err)
		assert.Len(t, comments, 3)
	})

	t.Run("returns empty list when no comments exist", func(t *testing.T) {
		// Create a new post with no comments
		newPost, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			Content:     "Post with no comments",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		comments, err := service.GetPostComments(context.Background(), newPost.ID)

		require.NoError(t, err)
		assert.Empty(t, comments)
	})

	t.Run("only returns direct children, not nested replies", func(t *testing.T) {
		// Create a comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "First level comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Create a nested reply to the comment
		_, err = service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    comment.ID,
			Content:     "Nested reply",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Get comments for the original post
		postComments, err := service.GetPostComments(context.Background(), post.ID)
		require.NoError(t, err)
		assert.Len(t, postComments, 4) // 3 from earlier + 1 new

		// Get comments for the first-level comment (should only have the nested reply)
		commentReplies, err := service.GetPostComments(context.Background(), comment.ID)
		require.NoError(t, err)
		assert.Len(t, commentReplies, 1)
	})
}

func TestMessageService_GetPhasePosts(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	phaseService := &phasesvc.PhaseService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(gm.ID), "player")
	require.NoError(t, err)

	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(gm.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create a phase
	phase, err := phaseService.CreatePhase(context.Background(), core.CreatePhaseRequest{
		GameID:      game.ID,
		PhaseType:   "action",
		PhaseNumber: 1,
		Title:       "Test Phase",
		Description: "Test phase description",
	})
	require.NoError(t, err)

	t.Run("retrieves posts for a specific phase", func(t *testing.T) {
		// Create posts with this phase ID
		for i := 0; i < 3; i++ {
			_, err := service.CreatePost(context.Background(), core.CreatePostRequest{
				GameID:      game.ID,
				PhaseID:     &phase.ID,
				AuthorID:    int32(gm.ID),
				CharacterID: char.ID,
				Content:     "Phase-specific post",
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
		}

		posts, err := service.GetPhasePosts(context.Background(), phase.ID)

		require.NoError(t, err)
		assert.Len(t, posts, 3)
		for _, post := range posts {
			assert.True(t, post.PhaseID.Valid)
			assert.Equal(t, phase.ID, post.PhaseID.Int32)
		}
	})

	t.Run("returns empty list when phase has no posts", func(t *testing.T) {
		// Create a new phase with no posts
		newPhase, err := phaseService.CreatePhase(context.Background(), core.CreatePhaseRequest{
			GameID:      game.ID,
			PhaseType:   "action",
			PhaseNumber: 2,
			Title:       "Empty Phase",
			Description: "Phase with no posts",
		})
		require.NoError(t, err)

		posts, err := service.GetPhasePosts(context.Background(), newPhase.ID)

		require.NoError(t, err)
		assert.Empty(t, posts)
	})
}

func TestMessageService_PostCounts(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
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

	// Create posts
	post1, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "First post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	post2, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "Second post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("GetGamePostCount returns correct total", func(t *testing.T) {
		count, err := service.GetGamePostCount(context.Background(), game.ID, nil)

		require.NoError(t, err)
		assert.Equal(t, int64(2), count)
	})

	t.Run("GetPostCommentCount returns correct count", func(t *testing.T) {
		// Add comments to first post
		for i := 0; i < 3; i++ {
			_, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
				GameID:      game.ID,
				AuthorID:    int32(player.ID),
				CharacterID: char.ID,
				ParentID:    post1.ID,
				Content:     "Test comment",
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
		}

		count, err := service.GetPostCommentCount(context.Background(), post1.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(3), count)

		// Second post should have 0 comments
		count2, err := service.GetPostCommentCount(context.Background(), post2.ID)
		require.NoError(t, err)
		assert.Equal(t, int64(0), count2)
	})
}

func TestMessageService_GetUserPostsInGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
	user1 := testDB.CreateTestUser(t, "user1", "user1@example.com")
	user2 := testDB.CreateTestUser(t, "user2", "user2@example.com")
	game := testDB.CreateTestGame(t, int32(user1.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(user2.ID), "player")
	require.NoError(t, err)

	char1, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(user1.ID)),
		Name:          "User1 Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char2, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(user2.ID)),
		Name:          "User2 Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	t.Run("retrieves all posts by a specific user in a game", func(t *testing.T) {
		// Create posts for user1
		for i := 0; i < 3; i++ {
			_, err := service.CreatePost(context.Background(), core.CreatePostRequest{
				GameID:      game.ID,
				AuthorID:    int32(user1.ID),
				CharacterID: char1.ID,
				Content:     "User1 post",
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
		}

		// Create posts for user2
		for i := 0; i < 2; i++ {
			_, err := service.CreatePost(context.Background(), core.CreatePostRequest{
				GameID:      game.ID,
				AuthorID:    int32(user2.ID),
				CharacterID: char2.ID,
				Content:     "User2 post",
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
		}

		// Get user1's posts
		user1Posts, err := service.GetUserPostsInGame(context.Background(), game.ID, int32(user1.ID))
		require.NoError(t, err)
		assert.Len(t, user1Posts, 3)

		// Get user2's posts
		user2Posts, err := service.GetUserPostsInGame(context.Background(), game.ID, int32(user2.ID))
		require.NoError(t, err)
		assert.Len(t, user2Posts, 2)
	})

	t.Run("returns empty list when user has no posts in game", func(t *testing.T) {
		user3 := testDB.CreateTestUser(t, "user3", "user3@example.com")

		posts, err := service.GetUserPostsInGame(context.Background(), game.ID, int32(user3.ID))

		require.NoError(t, err)
		assert.Empty(t, posts)
	})
}

func TestMessageService_GetMessageReactions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
	user1 := testDB.CreateTestUser(t, "user1", "user1@example.com")
	user2 := testDB.CreateTestUser(t, "user2", "user2@example.com")
	game := testDB.CreateTestGame(t, int32(user1.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(user1.ID), "player")
	require.NoError(t, err)

	char, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(user1.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(user1.ID),
		CharacterID: char.ID,
		Content:     "Test post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("retrieves all reactions for a message", func(t *testing.T) {
		// Add multiple reactions
		_, err := service.AddReaction(context.Background(), post.ID, int32(user1.ID), "👍")
		require.NoError(t, err)
		_, err = service.AddReaction(context.Background(), post.ID, int32(user2.ID), "❤️")
		require.NoError(t, err)
		_, err = service.AddReaction(context.Background(), post.ID, int32(user1.ID), "🎉")
		require.NoError(t, err)

		reactions, err := service.GetMessageReactions(context.Background(), post.ID)

		require.NoError(t, err)
		assert.Len(t, reactions, 3)

		// Verify reaction details
		for _, reaction := range reactions {
			assert.NotEmpty(t, reaction.ReactionType)
			assert.NotEmpty(t, reaction.Username)
		}
	})

	t.Run("returns empty list when message has no reactions", func(t *testing.T) {
		// Create a new post with no reactions
		newPost, err := service.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(user1.ID),
			CharacterID: char.ID,
			Content:     "Post with no reactions",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		reactions, err := service.GetMessageReactions(context.Background(), newPost.ID)

		require.NoError(t, err)
		assert.Empty(t, reactions)
	})
}

// TestMessageService_PostWithMentions tests that posts with character mentions store the mentioned_character_ids
func TestMessageService_PostWithMentions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	playerChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Hero",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	aragorn, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	gandalf, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Gandalf",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	t.Run("post with single mention stores mentioned_character_ids", func(t *testing.T) {
		req := core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: playerChar.ID,
			Content:     "Hey @Aragorn, can you help?",
			Visibility:  string(models.MessageVisibilityGame),
		}

		post, err := service.CreatePost(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, post)
		assert.Len(t, post.MentionedCharacterIds, 1)
		assert.Contains(t, post.MentionedCharacterIds, aragorn.ID)
	})

	t.Run("post with multiple mentions stores all mentioned_character_ids", func(t *testing.T) {
		req := core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: playerChar.ID,
			Content:     "Hey @Aragorn and @Gandalf, what do you think?",
			Visibility:  string(models.MessageVisibilityGame),
		}

		post, err := service.CreatePost(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, post)
		assert.Len(t, post.MentionedCharacterIds, 2)
		assert.Contains(t, post.MentionedCharacterIds, aragorn.ID)
		assert.Contains(t, post.MentionedCharacterIds, gandalf.ID)
	})

	t.Run("post without mentions has empty mentioned_character_ids", func(t *testing.T) {
		req := core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: playerChar.ID,
			Content:     "This is a regular post without any mentions",
			Visibility:  string(models.MessageVisibilityGame),
		}

		post, err := service.CreatePost(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, post)
		assert.Empty(t, post.MentionedCharacterIds)
	})

	t.Run("post with duplicate mentions deduplicates", func(t *testing.T) {
		req := core.CreatePostRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: playerChar.ID,
			Content:     "@Aragorn said hello. Later @Aragorn said goodbye.",
			Visibility:  string(models.MessageVisibilityGame),
		}

		post, err := service.CreatePost(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, post)
		assert.Len(t, post.MentionedCharacterIds, 1, "Should deduplicate mentions")
		assert.Contains(t, post.MentionedCharacterIds, aragorn.ID)
	})
}

// TestMessageService_CommentWithMentions tests that comments with character mentions store the mentioned_character_ids
func TestMessageService_CommentWithMentions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	playerChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Hero",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	legolas, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Legolas",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create parent post
	parentPost, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: playerChar.ID,
		Content:     "Original post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("comment with mention stores mentioned_character_ids", func(t *testing.T) {
		req := core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: playerChar.ID,
			ParentID:    parentPost.ID,
			Content:     "Hey @Legolas, check this out!",
			Visibility:  string(models.MessageVisibilityGame),
		}

		comment, err := service.CreateComment(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, comment)
		assert.Len(t, comment.MentionedCharacterIds, 1)
		assert.Contains(t, comment.MentionedCharacterIds, legolas.ID)
	})

	t.Run("comment without mentions has empty mentioned_character_ids", func(t *testing.T) {
		req := core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: playerChar.ID,
			ParentID:    parentPost.ID,
			Content:     "This is a regular comment",
			Visibility:  string(models.MessageVisibilityGame),
		}

		comment, err := service.CreateComment(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, comment)
		assert.Empty(t, comment.MentionedCharacterIds)
	})
}

// Helper function
func int32Ptr(v int32) *int32 {
	return &v
}

// TestMessageService_CommentEditDeleteTracking tests the new edit and delete tracking functionality
func TestMessageService_CommentEditDeleteTracking(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	admin := testDB.CreateTestUser(t, "admin", "admin@example.com")
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

	// Create parent post
	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: char.ID,
		Content:     "Parent post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("tracks edit history correctly", func(t *testing.T) {
		// Create comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Original comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Verify initial state
		assert.Equal(t, int32(0), comment.EditCount)
		assert.False(t, comment.EditedAt.Valid)

		// Update comment once
		updated1, err := service.UpdateComment(context.Background(), comment.ID, "First edit")
		require.NoError(t, err)
		assert.Equal(t, "First edit", updated1.Content)
		assert.Equal(t, int32(1), updated1.EditCount)
		assert.True(t, updated1.EditedAt.Valid)
		firstEditTime := updated1.EditedAt

		// Update comment again
		updated2, err := service.UpdateComment(context.Background(), comment.ID, "Second edit")
		require.NoError(t, err)
		assert.Equal(t, "Second edit", updated2.Content)
		assert.Equal(t, int32(2), updated2.EditCount)
		assert.True(t, updated2.EditedAt.Valid)
		// EditedAt should be more recent
		assert.True(t, updated2.EditedAt.Time.After(firstEditTime.Time) || updated2.EditedAt.Time.Equal(firstEditTime.Time))
	})

	t.Run("tracks who deleted the comment", func(t *testing.T) {
		// Create comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Comment to delete",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Delete comment as GM
		err = service.DeleteComment(context.Background(), comment.ID, int32(gm.ID))
		require.NoError(t, err)

		// Verify deletion tracking
		deleted, err := service.GetComment(context.Background(), comment.ID)
		require.NoError(t, err)
		assert.True(t, deleted.DeletedAt.Valid)
		assert.True(t, deleted.DeletedByUserID.Valid)
		assert.Equal(t, int32(gm.ID), deleted.DeletedByUserID.Int32)
	})

	t.Run("CanUserEditComment - only author can edit", func(t *testing.T) {
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Test comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Author can edit
		canEdit, err := service.CanUserEditComment(context.Background(), comment.ID, int32(player.ID))
		require.NoError(t, err)
		assert.True(t, canEdit)

		// GM cannot edit
		canEdit, err = service.CanUserEditComment(context.Background(), comment.ID, int32(gm.ID))
		require.NoError(t, err)
		assert.False(t, canEdit)

		// Admin cannot edit (unless they're the author)
		canEdit, err = service.CanUserEditComment(context.Background(), comment.ID, int32(admin.ID))
		require.NoError(t, err)
		assert.False(t, canEdit)
	})

	t.Run("CanUserDeleteComment - author, GM, or admin can delete", func(t *testing.T) {
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Test comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Author can delete
		canDelete, err := service.CanUserDeleteComment(context.Background(), comment.ID, int32(player.ID), false)
		require.NoError(t, err)
		assert.True(t, canDelete)

		// GM can delete
		canDelete, err = service.CanUserDeleteComment(context.Background(), comment.ID, int32(gm.ID), false)
		require.NoError(t, err)
		assert.True(t, canDelete)

		// Admin with admin mode can delete
		canDelete, err = service.CanUserDeleteComment(context.Background(), comment.ID, int32(admin.ID), true)
		require.NoError(t, err)
		assert.True(t, canDelete)

		// Admin without admin mode cannot delete (unless they're author or GM)
		canDelete, err = service.CanUserDeleteComment(context.Background(), comment.ID, int32(admin.ID), false)
		require.NoError(t, err)
		assert.False(t, canDelete)
	})

	t.Run("cannot edit or delete already deleted comment", func(t *testing.T) {
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: char.ID,
			ParentID:    post.ID,
			Content:     "Comment to delete",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Delete comment
		err = service.DeleteComment(context.Background(), comment.ID, int32(player.ID))
		require.NoError(t, err)

		// Try to edit deleted comment - should fail
		_, err = service.UpdateComment(context.Background(), comment.ID, "Trying to edit deleted")
		assert.Error(t, err)

		// Try to delete again - should fail
		err = service.DeleteComment(context.Background(), comment.ID, int32(player.ID))
		assert.Error(t, err)
	})
}

// TestMessageService_UpdateCommentWithMentions tests the mention detection and notification behavior in UpdateComment
func TestMessageService_UpdateCommentWithMentions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &db.CharacterService{DB: testDB.Pool}
	gameService := &db.GameService{DB: testDB.Pool}

	// Setup
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(player.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	require.NoError(t, err)

	authorChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Author Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	aragorn, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	gandalf, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Gandalf",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create parent post
	post, err := service.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		AuthorID:    int32(player.ID),
		CharacterID: authorChar.ID,
		Content:     "Parent post",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	t.Run("adding new mention updates mentioned_character_ids", func(t *testing.T) {
		// Create comment without mentions
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: authorChar.ID,
			ParentID:    post.ID,
			Content:     "Original comment without mentions",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)
		assert.Empty(t, comment.MentionedCharacterIds)

		// Update comment to add a mention
		updated, err := service.UpdateComment(context.Background(), comment.ID, "Updated comment with @Aragorn mention")
		require.NoError(t, err)
		assert.Len(t, updated.MentionedCharacterIds, 1)
		assert.Contains(t, updated.MentionedCharacterIds, aragorn.ID)
		assert.True(t, updated.IsEdited)
	})

	t.Run("adding multiple new mentions updates mentioned_character_ids", func(t *testing.T) {
		// Create comment without mentions
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: authorChar.ID,
			ParentID:    post.ID,
			Content:     "Original comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Update comment to add multiple mentions
		updated, err := service.UpdateComment(context.Background(), comment.ID, "Updated with @Aragorn and @Gandalf")
		require.NoError(t, err)
		assert.Len(t, updated.MentionedCharacterIds, 2)
		assert.Contains(t, updated.MentionedCharacterIds, aragorn.ID)
		assert.Contains(t, updated.MentionedCharacterIds, gandalf.ID)
	})

	t.Run("removing mentions clears mentioned_character_ids", func(t *testing.T) {
		// Create comment with mention
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: authorChar.ID,
			ParentID:    post.ID,
			Content:     "Comment with @Aragorn",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)
		assert.Len(t, comment.MentionedCharacterIds, 1)

		// Update comment to remove mention
		updated, err := service.UpdateComment(context.Background(), comment.ID, "Updated without mentions")
		require.NoError(t, err)
		assert.Empty(t, updated.MentionedCharacterIds)
	})

	t.Run("keeping existing mention preserves mentioned_character_ids", func(t *testing.T) {
		// Create comment with mention
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: authorChar.ID,
			ParentID:    post.ID,
			Content:     "Comment with @Aragorn",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)
		assert.Len(t, comment.MentionedCharacterIds, 1)

		// Update comment but keep same mention
		updated, err := service.UpdateComment(context.Background(), comment.ID, "Updated comment still mentions @Aragorn")
		require.NoError(t, err)
		assert.Len(t, updated.MentionedCharacterIds, 1)
		assert.Contains(t, updated.MentionedCharacterIds, aragorn.ID)
	})

	t.Run("replacing one mention with another updates mentioned_character_ids", func(t *testing.T) {
		// Create comment with Aragorn mention
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: authorChar.ID,
			ParentID:    post.ID,
			Content:     "Comment with @Aragorn",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)
		assert.Len(t, comment.MentionedCharacterIds, 1)
		assert.Contains(t, comment.MentionedCharacterIds, aragorn.ID)

		// Update comment to replace Aragorn with Gandalf
		updated, err := service.UpdateComment(context.Background(), comment.ID, "Updated to mention @Gandalf instead")
		require.NoError(t, err)
		assert.Len(t, updated.MentionedCharacterIds, 1)
		assert.Contains(t, updated.MentionedCharacterIds, gandalf.ID)
		assert.NotContains(t, updated.MentionedCharacterIds, aragorn.ID)
	})

	t.Run("adding new mention to existing mentions", func(t *testing.T) {
		// Create comment with Aragorn mention
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: authorChar.ID,
			ParentID:    post.ID,
			Content:     "Comment with @Aragorn",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)
		assert.Len(t, comment.MentionedCharacterIds, 1)

		// Update comment to add Gandalf mention while keeping Aragorn
		updated, err := service.UpdateComment(context.Background(), comment.ID, "Updated with @Aragorn and @Gandalf")
		require.NoError(t, err)
		assert.Len(t, updated.MentionedCharacterIds, 2)
		assert.Contains(t, updated.MentionedCharacterIds, aragorn.ID)
		assert.Contains(t, updated.MentionedCharacterIds, gandalf.ID)
	})

	t.Run("handles mention extraction errors gracefully", func(t *testing.T) {
		// Create comment
		comment, err := service.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      game.ID,
			AuthorID:    int32(player.ID),
			CharacterID: authorChar.ID,
			ParentID:    post.ID,
			Content:     "Original comment",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// Update with non-existent character mention (should not fail, just not add mention)
		updated, err := service.UpdateComment(context.Background(), comment.ID, "Mentioning @NonExistentCharacter")
		require.NoError(t, err)
		assert.NotNil(t, updated)
		assert.Empty(t, updated.MentionedCharacterIds)
		assert.True(t, updated.IsEdited)
	})
}
