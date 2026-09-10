package messages

import (
	"context"
	"fmt"
	"testing"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// favoriteTestEnv is the shared fixture for favorites tests: two games under
// the same GM so cross-game behavior can be exercised, and two players so
// privacy between users can be.
type favoriteTestEnv struct {
	service *MessageService
	gameA   *models.Game
	gameB   *models.Game
	player  int32
	other   int32
	charA   int32
	charB   int32
}

func setupFavoriteTest(t *testing.T, testDB *core.TestDatabase) *favoriteTestEnv {
	t.Helper()

	app := core.NewTestApp(testDB.Pool)
	service := &MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "fav_gm", "fav_gm@example.com")
	player := testDB.CreateTestUser(t, "fav_player", "fav_player@example.com")
	other := testDB.CreateTestUser(t, "fav_other", "fav_other@example.com")

	gameA := testDB.CreateTestGame(t, int32(gm.ID), "Game A")
	gameB := testDB.CreateTestGame(t, int32(gm.ID), "Game B")

	ctx := context.Background()
	_, err := gameService.AddGameParticipant(ctx, gameA.ID, int32(player.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(ctx, gameB.ID, int32(player.ID), "player")
	require.NoError(t, err)

	charA, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        gameA.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Character A",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	charB, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        gameB.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Character B",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	return &favoriteTestEnv{
		service: service,
		gameA:   gameA,
		gameB:   gameB,
		player:  int32(player.ID),
		other:   int32(other.ID),
		charA:   charA.ID,
		charB:   charB.ID,
	}
}

// createPostWithComment builds a post and one comment on it, returning both.
func (e *favoriteTestEnv) createPostWithComment(t *testing.T, gameID, charID int32, body string) (*models.Message, *models.Message) {
	t.Helper()
	ctx := context.Background()

	post, err := e.service.CreatePost(ctx, core.CreatePostRequest{
		GameID:      gameID,
		AuthorID:    e.player,
		CharacterID: charID,
		Content:     body + " (post)",
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	comment, err := e.service.CreateComment(ctx, core.CreateCommentRequest{
		GameID:      gameID,
		AuthorID:    e.player,
		CharacterID: charID,
		ParentID:    post.ID,
		Content:     body,
		Visibility:  string(models.MessageVisibilityGame),
	})
	require.NoError(t, err)

	return post, comment
}

func TestMessageService_SetCommentFavorite(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	env := setupFavoriteTest(t, testDB)
	ctx := context.Background()

	t.Run("favorite then unfavorite round-trips through the listing", func(t *testing.T) {
		_, comment := env.createPostWithComment(t, env.gameA.ID, env.charA, "round trip")

		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, true))

		favorites, total, err := env.service.ListFavoriteComments(ctx, env.player, 50, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total)
		require.Len(t, favorites, 1)
		assert.Equal(t, comment.ID, favorites[0].ID)
		assert.Equal(t, "round trip", favorites[0].Content)

		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, false))

		favorites, total, err = env.service.ListFavoriteComments(ctx, env.player, 50, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(0), total)
		assert.Empty(t, favorites)
	})

	t.Run("favoriting twice is idempotent", func(t *testing.T) {
		_, comment := env.createPostWithComment(t, env.gameA.ID, env.charA, "idempotent")

		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, true))
		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, true))

		favorites, total, err := env.service.ListFavoriteComments(ctx, env.player, 50, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(1), total, "second favorite must not create a duplicate row")
		assert.Len(t, favorites, 1)

		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, false))
	})

	t.Run("unfavoriting something never favorited is a no-op", func(t *testing.T) {
		_, comment := env.createPostWithComment(t, env.gameA.ID, env.charA, "never favorited")

		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, false))

		_, total, err := env.service.ListFavoriteComments(ctx, env.player, 50, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(0), total)
	})

	t.Run("favoriting a post is rejected", func(t *testing.T) {
		post, _ := env.createPostWithComment(t, env.gameA.ID, env.charA, "post rejection")

		err := env.service.SetCommentFavorite(ctx, env.player, post.ID, true)
		require.Error(t, err, "posts are not favoritable")

		_, total, err := env.service.ListFavoriteComments(ctx, env.player, 50, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(0), total, "rejected favorite must not be persisted")
	})

	t.Run("favoriting a nonexistent comment is rejected", func(t *testing.T) {
		err := env.service.SetCommentFavorite(ctx, env.player, 999999, true)
		require.Error(t, err)

		_, total, err := env.service.ListFavoriteComments(ctx, env.player, 50, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(0), total)
	})
}

func TestMessageService_ListFavoriteComments(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	env := setupFavoriteTest(t, testDB)
	ctx := context.Background()

	t.Run("soft-deleted comment is excluded but the favorite row survives", func(t *testing.T) {
		_, comment := env.createPostWithComment(t, env.gameA.ID, env.charA, "to be deleted")
		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, true))

		require.NoError(t, env.service.DeleteComment(ctx, comment.ID, env.player))

		favorites, total, err := env.service.ListFavoriteComments(ctx, env.player, 50, 0)
		require.NoError(t, err)
		assert.Empty(t, favorites, "deleted comments are filtered at read time")
		assert.Equal(t, int64(0), total, "count must apply the same deleted filter as the listing")

		// The row itself is still there -- the ID set is not deleted-filtered,
		// which is what proves this is a read-time filter and not a cascade.
		ids, err := env.service.GetFavoriteCommentIDsForGame(ctx, env.player, env.gameA.ID)
		require.NoError(t, err)
		assert.Contains(t, ids, comment.ID)

		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, false))
	})

	t.Run("listing spans games and orders by favorited_at descending", func(t *testing.T) {
		_, commentA := env.createPostWithComment(t, env.gameA.ID, env.charA, "from game A")
		_, commentB := env.createPostWithComment(t, env.gameB.ID, env.charB, "from game B")

		// Favorite A first, then B. Newest-favorited must come first, which is
		// the reverse of neither creation order nor comment ID order here.
		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, commentA.ID, true))
		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, commentB.ID, true))

		favorites, total, err := env.service.ListFavoriteComments(ctx, env.player, 50, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(2), total)
		require.Len(t, favorites, 2)

		assert.Equal(t, commentB.ID, favorites[0].ID, "most recently favorited comes first")
		assert.Equal(t, commentA.ID, favorites[1].ID)

		// Each card must be able to label its source game without an N+1 lookup.
		assert.Equal(t, env.gameB.ID, favorites[0].GameID)
		assert.Equal(t, "Game B", favorites[0].GameTitle)
		assert.Equal(t, env.gameA.ID, favorites[1].GameID)
		assert.Equal(t, "Game A", favorites[1].GameTitle)

		assert.False(t, favorites[0].FavoritedAt.IsZero())
		assert.False(t, favorites[0].FavoritedAt.Before(favorites[1].FavoritedAt))

		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, commentA.ID, false))
		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, commentB.ID, false))
	})

	t.Run("deeply nested comment resolves its root post", func(t *testing.T) {
		post, err := env.service.CreatePost(ctx, core.CreatePostRequest{
			GameID:      env.gameA.ID,
			AuthorID:    env.player,
			CharacterID: env.charA,
			Content:     "Root post for deep nesting",
			Visibility:  string(models.MessageVisibilityGame),
		})
		require.NoError(t, err)

		// post -> c1 -> c2 -> c3 -> c4 -> c5
		parentID := post.ID
		var deepest *models.Message
		for i := 0; i < 5; i++ {
			deepest, err = env.service.CreateComment(ctx, core.CreateCommentRequest{
				GameID:      env.gameA.ID,
				AuthorID:    env.player,
				CharacterID: env.charA,
				ParentID:    parentID,
				Content:     fmt.Sprintf("Deep reply level %d", i+1),
				Visibility:  string(models.MessageVisibilityGame),
			})
			require.NoError(t, err)
			parentID = deepest.ID
		}

		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, deepest.ID, true))

		favorites, _, err := env.service.ListFavoriteComments(ctx, env.player, 50, 0)
		require.NoError(t, err)
		require.Len(t, favorites, 1)

		// The recursive CTE must walk all the way to the post, not stop at the
		// immediate parent -- this is the deep link target for the card.
		require.NotNil(t, favorites[0].PostID, "root post must resolve for a deeply nested comment")
		assert.Equal(t, post.ID, *favorites[0].PostID)

		// The immediate parent is the level-4 comment, not the post.
		require.NotNil(t, favorites[0].ParentMessageType)
		assert.Equal(t, "comment", *favorites[0].ParentMessageType)

		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, deepest.ID, false))
	})

	t.Run("one user's favorites never appear in another's listing", func(t *testing.T) {
		_, comment := env.createPostWithComment(t, env.gameA.ID, env.charA, "private to player")
		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, true))

		favorites, total, err := env.service.ListFavoriteComments(ctx, env.other, 50, 0)
		require.NoError(t, err)
		assert.Empty(t, favorites)
		assert.Equal(t, int64(0), total)

		ids, err := env.service.GetFavoriteCommentIDsForUser(ctx, env.other)
		require.NoError(t, err)
		assert.Empty(t, ids)

		require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, false))
	})

	t.Run("pagination pages through in favorited order with a stable total", func(t *testing.T) {
		var created []int32
		for i := 0; i < 3; i++ {
			_, comment := env.createPostWithComment(t, env.gameA.ID, env.charA, fmt.Sprintf("page %d", i))
			require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, comment.ID, true))
			created = append(created, comment.ID)
		}

		first, total, err := env.service.ListFavoriteComments(ctx, env.player, 2, 0)
		require.NoError(t, err)
		assert.Equal(t, int64(3), total, "total reflects all favorites, not the page size")
		require.Len(t, first, 2)

		second, total, err := env.service.ListFavoriteComments(ctx, env.player, 2, 2)
		require.NoError(t, err)
		assert.Equal(t, int64(3), total)
		require.Len(t, second, 1)

		// Newest-favorited first, so the pages walk the creation order backwards.
		assert.Equal(t, created[2], first[0].ID)
		assert.Equal(t, created[1], first[1].ID)
		assert.Equal(t, created[0], second[0].ID)

		for _, id := range created {
			require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, id, false))
		}
	})
}

func TestMessageService_GetFavoriteCommentIDs(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	env := setupFavoriteTest(t, testDB)
	ctx := context.Background()

	_, commentA := env.createPostWithComment(t, env.gameA.ID, env.charA, "id set game A")
	_, commentB := env.createPostWithComment(t, env.gameB.ID, env.charB, "id set game B")

	require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, commentA.ID, true))
	require.NoError(t, env.service.SetCommentFavorite(ctx, env.player, commentB.ID, true))

	t.Run("per-game set contains only that game's favorites", func(t *testing.T) {
		idsA, err := env.service.GetFavoriteCommentIDsForGame(ctx, env.player, env.gameA.ID)
		require.NoError(t, err)
		assert.Equal(t, []int32{commentA.ID}, idsA)

		idsB, err := env.service.GetFavoriteCommentIDsForGame(ctx, env.player, env.gameB.ID)
		require.NoError(t, err)
		assert.Equal(t, []int32{commentB.ID}, idsB)
	})

	t.Run("global set spans games", func(t *testing.T) {
		ids, err := env.service.GetFavoriteCommentIDsForUser(ctx, env.player)
		require.NoError(t, err)
		assert.ElementsMatch(t, []int32{commentA.ID, commentB.ID}, ids)
	})

	t.Run("empty results are an empty slice, not nil", func(t *testing.T) {
		ids, err := env.service.GetFavoriteCommentIDsForUser(ctx, env.other)
		require.NoError(t, err)
		assert.NotNil(t, ids, "handlers serialize this straight to JSON; nil would emit null")
		assert.Empty(t, ids)

		gameIDs, err := env.service.GetFavoriteCommentIDsForGame(ctx, env.other, env.gameA.ID)
		require.NoError(t, err)
		assert.NotNil(t, gameIDs)
		assert.Empty(t, gameIDs)
	})
}
