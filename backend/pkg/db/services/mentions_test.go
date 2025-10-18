package db

import (
	"context"
	"testing"

	core "actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestExtractCharacterMentions_SingleMention tests extraction of a single character mention
func TestExtractCharacterMentions_SingleMention(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &CharacterService{DB: testDB.Pool}

	ctx := context.Background()

	// Setup: Create a game and character
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	character, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Test content with single mention
	content := "Hello @Aragorn, how are you?"

	mentionedIDs, err := service.extractCharacterMentions(ctx, content, game.ID)

	require.NoError(t, err)
	assert.Len(t, mentionedIDs, 1)
	assert.Contains(t, mentionedIDs, character.ID)
}

// TestExtractCharacterMentions_MultipleMentions tests extraction of multiple distinct mentions
func TestExtractCharacterMentions_MultipleMentions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &CharacterService{DB: testDB.Pool}

	ctx := context.Background()

	// Setup: Create a game and multiple characters
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	aragorn, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	gandalf, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Gandalf",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	legolas, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Legolas",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Test content with multiple mentions
	content := "Hey @Aragorn and @Gandalf, let's meet @Legolas at the tavern!"

	mentionedIDs, err := service.extractCharacterMentions(ctx, content, game.ID)

	require.NoError(t, err)
	assert.Len(t, mentionedIDs, 3)
	assert.Contains(t, mentionedIDs, aragorn.ID)
	assert.Contains(t, mentionedIDs, gandalf.ID)
	assert.Contains(t, mentionedIDs, legolas.ID)
}

// TestExtractCharacterMentions_DuplicateMentions tests that duplicate mentions are deduplicated
func TestExtractCharacterMentions_DuplicateMentions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &CharacterService{DB: testDB.Pool}

	ctx := context.Background()

	// Setup: Create a game and character
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	aragorn, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Test content with duplicate mentions
	content := "@Aragorn said hello. Later, @Aragorn said goodbye. @Aragorn is great!"

	mentionedIDs, err := service.extractCharacterMentions(ctx, content, game.ID)

	require.NoError(t, err)
	assert.Len(t, mentionedIDs, 1, "Should deduplicate to single character ID")
	assert.Contains(t, mentionedIDs, aragorn.ID)
}

// TestExtractCharacterMentions_NonExistentCharacter tests graceful handling of typos/non-existent names
func TestExtractCharacterMentions_NonExistentCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &CharacterService{DB: testDB.Pool}

	ctx := context.Background()

	// Setup: Create a game with a character
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	aragorn, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Test content with one valid and one non-existent character
	content := "@Aragorn meets @Aragron (typo should be ignored)"

	mentionedIDs, err := service.extractCharacterMentions(ctx, content, game.ID)

	require.NoError(t, err)
	assert.Len(t, mentionedIDs, 1, "Should only include valid character")
	assert.Contains(t, mentionedIDs, aragorn.ID)
}

// TestExtractCharacterMentions_EmptyContent tests handling of empty string
func TestExtractCharacterMentions_EmptyContent(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}

	ctx := context.Background()

	// Setup: Create a game (no characters needed)
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Test with empty content
	content := ""

	mentionedIDs, err := service.extractCharacterMentions(ctx, content, game.ID)

	require.NoError(t, err)
	assert.Empty(t, mentionedIDs, "Should return empty slice for empty content")
}

// TestExtractCharacterMentions_NoMentions tests content without any @ mentions
func TestExtractCharacterMentions_NoMentions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}

	ctx := context.Background()

	// Setup: Create a game (no characters needed)
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Test content without mentions
	content := "This is a normal message without any mentions. Just regular text."

	mentionedIDs, err := service.extractCharacterMentions(ctx, content, game.ID)

	require.NoError(t, err)
	assert.Empty(t, mentionedIDs, "Should return empty slice when no mentions present")
}

// TestExtractCharacterMentions_MultiWordNames tests handling of multi-word character names
func TestExtractCharacterMentions_MultiWordNames(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &CharacterService{DB: testDB.Pool}

	ctx := context.Background()

	// Setup: Create characters with multi-word names
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	bob, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Bob",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	_, err = characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game.ID,
		Name:          "Bob Smith",
		CharacterType: "npc_gm",
	})
	require.NoError(t, err)

	// Test: Current regex will only match first word
	content := "Hello @Bob, meet Bob Smith" // Only @Bob has @, "Bob Smith" is plain text

	mentionedIDs, err := service.extractCharacterMentions(ctx, content, game.ID)

	require.NoError(t, err)
	assert.Len(t, mentionedIDs, 1, "Regex only captures single word after @")
	assert.Contains(t, mentionedIDs, bob.ID, "Should match 'Bob' not 'Bob Smith'")
}

// TestExtractCharacterMentions_CrossGameIsolation tests that mentions are isolated to specific game
func TestExtractCharacterMentions_CrossGameIsolation(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &CharacterService{DB: testDB.Pool}

	ctx := context.Background()

	// Setup: Create two games with same character name
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game1 := testDB.CreateTestGame(t, int32(gm.ID), "Game 1")
	game2 := testDB.CreateTestGame(t, int32(gm.ID), "Game 2")

	aragorn1, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game1.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	aragorn2, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game2.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	content := "Hello @Aragorn!"

	// Test: Mention in game1 should only return game1's Aragorn
	mentionedIDs1, err := service.extractCharacterMentions(ctx, content, game1.ID)
	require.NoError(t, err)
	assert.Len(t, mentionedIDs1, 1)
	assert.Contains(t, mentionedIDs1, aragorn1.ID)
	assert.NotContains(t, mentionedIDs1, aragorn2.ID)

	// Test: Mention in game2 should only return game2's Aragorn
	mentionedIDs2, err := service.extractCharacterMentions(ctx, content, game2.ID)
	require.NoError(t, err)
	assert.Len(t, mentionedIDs2, 1)
	assert.Contains(t, mentionedIDs2, aragorn2.ID)
	assert.NotContains(t, mentionedIDs2, aragorn1.ID)
}

// TestExtractCharacterMentions_EdgeCasePatterns tests various edge case patterns
func TestExtractCharacterMentions_EdgeCasePatterns(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &CharacterService{DB: testDB.Pool}

	ctx := context.Background()

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	bob, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Bob",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	tests := []struct {
		name          string
		content       string
		expectedCount int
		shouldContain []int32
	}{
		{
			name:          "mention at start",
			content:       "@Bob hello!",
			expectedCount: 1,
			shouldContain: []int32{bob.ID},
		},
		{
			name:          "mention at end",
			content:       "Hello @Bob",
			expectedCount: 1,
			shouldContain: []int32{bob.ID},
		},
		{
			name:          "mention in middle",
			content:       "Hey @Bob how are you?",
			expectedCount: 1,
			shouldContain: []int32{bob.ID},
		},
		{
			name:          "@ symbol alone",
			content:       "Send email to @ company",
			expectedCount: 0,
			shouldContain: []int32{},
		},
		{
			name:          "@ with numbers",
			content:       "Meet @Bob123 at 5pm",
			expectedCount: 0, // "Bob123" won't match if character is named "Bob"
			shouldContain: []int32{},
		},
		{
			name:          "multiple @ symbols",
			content:       "@@Bob should match once",
			expectedCount: 1, // Regex will find @Bob after @@
			shouldContain: []int32{bob.ID},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mentionedIDs, err := service.extractCharacterMentions(ctx, tt.content, game.ID)
			require.NoError(t, err)
			assert.Len(t, mentionedIDs, tt.expectedCount, "Expected %d mentions", tt.expectedCount)
			for _, id := range tt.shouldContain {
				assert.Contains(t, mentionedIDs, id)
			}
		})
	}
}

// TestExtractCharacterMentions_PublicWrapper tests the public ExtractCharacterMentions wrapper
func TestExtractCharacterMentions_PublicWrapper(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &MessageService{DB: testDB.Pool}
	characterService := &CharacterService{DB: testDB.Pool}

	ctx := context.Background()

	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	aragorn, err := characterService.CreateCharacter(ctx, CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Aragorn",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	content := "Hello @Aragorn!"

	// Test public wrapper method
	mentionedIDs, err := service.ExtractCharacterMentions(ctx, content, game.ID)

	require.NoError(t, err)
	assert.Len(t, mentionedIDs, 1)
	assert.Contains(t, mentionedIDs, aragorn.ID)
}
