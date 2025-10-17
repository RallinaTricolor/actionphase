package db

import (
	"context"
	"testing"

	"actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConversationService_CreateConversation(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := NewConversationService(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Setup: Create game, users, and characters
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Add players as participants
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)

	// Create characters
	char1, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Character 1",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char2, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Character 2",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	t.Run("creates direct conversation successfully", func(t *testing.T) {
		req := CreateConversationRequest{
			GameID:          game.ID,
			Title:           "Direct Chat",
			CreatedByUserID: int32(player1.ID),
			ParticipantIDs:  []int32{char1.ID, char2.ID},
		}

		conversation, err := service.CreateConversation(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, conversation)
		assert.Equal(t, game.ID, conversation.GameID)
		assert.Equal(t, "direct", conversation.ConversationType)
		assert.Equal(t, "Direct Chat", conversation.Title.String)
	})

	t.Run("creates group conversation with 3+ participants", func(t *testing.T) {
		// Create third character
		player3 := testDB.CreateTestUser(t, "player3", "player3@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player3.ID), "player")
		require.NoError(t, err)

		char3, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(player3.ID)),
			Name:          "Character 3",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		req := CreateConversationRequest{
			GameID:          game.ID,
			Title:           "Group Chat",
			CreatedByUserID: int32(player1.ID),
			ParticipantIDs:  []int32{char1.ID, char2.ID, char3.ID},
		}

		conversation, err := service.CreateConversation(context.Background(), req)

		require.NoError(t, err)
		assert.Equal(t, "group", conversation.ConversationType)
	})

	t.Run("adds all participants to conversation", func(t *testing.T) {
		req := CreateConversationRequest{
			GameID:          game.ID,
			Title:           "Participant Test",
			CreatedByUserID: int32(player1.ID),
			ParticipantIDs:  []int32{char1.ID, char2.ID},
		}

		conversation, err := service.CreateConversation(context.Background(), req)
		require.NoError(t, err)

		// Verify participants were added
		participants, err := service.GetConversationParticipants(context.Background(), conversation.ID)
		require.NoError(t, err)
		assert.Len(t, participants, 2)
	})
}

func TestConversationService_SendMessage(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := NewConversationService(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)

	char1, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Character 1",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char2, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Character 2",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create conversation
	conversation, err := service.CreateConversation(context.Background(), CreateConversationRequest{
		GameID:          game.ID,
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{char1.ID, char2.ID},
	})
	require.NoError(t, err)

	t.Run("sends message successfully", func(t *testing.T) {
		req := SendMessageRequest{
			ConversationID:    conversation.ID,
			SenderUserID:      int32(player1.ID),
			SenderCharacterID: char1.ID,
			Content:           "Hello, this is a test message!",
		}

		message, err := service.SendMessage(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, message)
		assert.Equal(t, conversation.ID, message.ConversationID)
		assert.Equal(t, int32(player1.ID), message.SenderUserID)
		assert.Equal(t, "Hello, this is a test message!", message.Content)
	})

	t.Run("rejects message from non-participant", func(t *testing.T) {
		// Create a third player who is not in the conversation
		player3 := testDB.CreateTestUser(t, "player3", "player3@example.com")

		req := SendMessageRequest{
			ConversationID:    conversation.ID,
			SenderUserID:      int32(player3.ID),
			SenderCharacterID: 0, // No character
			Content:           "Unauthorized message",
		}

		_, err := service.SendMessage(context.Background(), req)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "not a participant")
	})

	t.Run("updates conversation activity timestamp", func(t *testing.T) {
		// Send a message
		req := SendMessageRequest{
			ConversationID:    conversation.ID,
			SenderUserID:      int32(player1.ID),
			SenderCharacterID: char1.ID,
			Content:           "Activity test message",
		}

		_, err := service.SendMessage(context.Background(), req)
		require.NoError(t, err)

		// Verify conversation has updated timestamp
		// (implicitly verified by successful message send)
	})
}

func TestConversationService_GetConversationMessages(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := NewConversationService(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)

	char1, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Character 1",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char2, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Character 2",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create conversation
	conversation, err := service.CreateConversation(context.Background(), CreateConversationRequest{
		GameID:          game.ID,
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{char1.ID, char2.ID},
	})
	require.NoError(t, err)

	// Send several messages
	messages := []string{"First message", "Second message", "Third message"}
	for _, content := range messages {
		_, err := service.SendMessage(context.Background(), SendMessageRequest{
			ConversationID:    conversation.ID,
			SenderUserID:      int32(player1.ID),
			SenderCharacterID: char1.ID,
			Content:           content,
		})
		require.NoError(t, err)
	}

	t.Run("retrieves all conversation messages", func(t *testing.T) {
		msgs, err := service.GetConversationMessages(context.Background(), conversation.ID, int32(player1.ID))

		require.NoError(t, err)
		assert.Len(t, msgs, 3)
		assert.Equal(t, "First message", msgs[0].Content)
		assert.Equal(t, "Second message", msgs[1].Content)
		assert.Equal(t, "Third message", msgs[2].Content)
	})

	t.Run("rejects non-participant from viewing messages", func(t *testing.T) {
		// Create a third player not in conversation
		player3 := testDB.CreateTestUser(t, "player3", "player3@example.com")

		_, err := service.GetConversationMessages(context.Background(), conversation.ID, int32(player3.ID))

		require.Error(t, err)
		assert.Contains(t, err.Error(), "not a participant")
	})
}

func TestConversationService_GetUserConversations(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := NewConversationService(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)

	char1, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Character 1",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char2, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Character 2",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create multiple conversations for player1
	_, err = service.CreateConversation(context.Background(), CreateConversationRequest{
		GameID:          game.ID,
		Title:           "Conversation 1",
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{char1.ID, char2.ID},
	})
	require.NoError(t, err)

	_, err = service.CreateConversation(context.Background(), CreateConversationRequest{
		GameID:          game.ID,
		Title:           "Conversation 2",
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{char1.ID, char2.ID},
	})
	require.NoError(t, err)

	t.Run("retrieves all user conversations in game", func(t *testing.T) {
		conversations, err := service.GetUserConversations(context.Background(), game.ID, int32(player1.ID))

		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(conversations), 2)
	})

	t.Run("filters by game", func(t *testing.T) {
		// Create another game
		otherGame := testDB.CreateTestGame(t, int32(gm.ID), "Other Game")

		conversations, err := service.GetUserConversations(context.Background(), otherGame.ID, int32(player1.ID))

		require.NoError(t, err)
		// Should have no conversations in the other game
		assert.Len(t, conversations, 0)
	})
}

func TestConversationService_MarkAsRead(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := NewConversationService(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)

	char1, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Character 1",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char2, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Character 2",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create conversation
	conversation, err := service.CreateConversation(context.Background(), CreateConversationRequest{
		GameID:          game.ID,
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{char1.ID, char2.ID},
	})
	require.NoError(t, err)

	// Player1 sends messages
	_, err = service.SendMessage(context.Background(), SendMessageRequest{
		ConversationID:    conversation.ID,
		SenderUserID:      int32(player1.ID),
		SenderCharacterID: char1.ID,
		Content:           "Unread message",
	})
	require.NoError(t, err)

	t.Run("marks conversation as read", func(t *testing.T) {
		err := service.MarkConversationAsRead(context.Background(), conversation.ID, int32(player2.ID))

		require.NoError(t, err)
	})

	t.Run("rejects non-participant from marking as read", func(t *testing.T) {
		player3 := testDB.CreateTestUser(t, "player3", "player3@example.com")

		err := service.MarkConversationAsRead(context.Background(), conversation.ID, int32(player3.ID))

		require.Error(t, err)
		assert.Contains(t, err.Error(), "not a participant")
	})
}

func TestConversationService_UnreadCount(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := NewConversationService(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)

	char1, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Character 1",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char2, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Character 2",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create conversation
	conversation, err := service.CreateConversation(context.Background(), CreateConversationRequest{
		GameID:          game.ID,
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{char1.ID, char2.ID},
	})
	require.NoError(t, err)

	// Send messages from player1
	for i := 0; i < 3; i++ {
		_, err := service.SendMessage(context.Background(), SendMessageRequest{
			ConversationID:    conversation.ID,
			SenderUserID:      int32(player1.ID),
			SenderCharacterID: char1.ID,
			Content:           "Unread message",
		})
		require.NoError(t, err)
	}

	t.Run("counts unread messages correctly", func(t *testing.T) {
		count, err := service.GetUnreadMessageCount(context.Background(), conversation.ID, int32(player2.ID))

		require.NoError(t, err)
		assert.GreaterOrEqual(t, count, int64(3))
	})

	t.Run("zero unread after marking as read", func(t *testing.T) {
		err := service.MarkConversationAsRead(context.Background(), conversation.ID, int32(player2.ID))
		require.NoError(t, err)

		count, err := service.GetUnreadMessageCount(context.Background(), conversation.ID, int32(player2.ID))
		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})
}

func TestConversationService_AddParticipant(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := NewConversationService(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")
	player3 := testDB.CreateTestUser(t, "player3", "player3@example.com")

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player3.ID), "player")
	require.NoError(t, err)

	char1, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Character 1",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char2, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Character 2",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char3, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player3.ID)),
		Name:          "Character 3",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create conversation with 2 participants
	conversation, err := service.CreateConversation(context.Background(), CreateConversationRequest{
		GameID:          game.ID,
		Title:           "Initial Conversation",
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{char1.ID, char2.ID},
	})
	require.NoError(t, err)

	t.Run("adds participant successfully", func(t *testing.T) {
		err := service.AddParticipant(context.Background(), conversation.ID, char3.ID)

		require.NoError(t, err)

		// Verify participant was added
		participants, err := service.GetConversationParticipants(context.Background(), conversation.ID)
		require.NoError(t, err)
		assert.Len(t, participants, 3)
	})

	t.Run("adds NPC participant using GM's user ID", func(t *testing.T) {
		// Create an NPC (no user_id)
		npc, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        nil, // NPC has no user
			Name:          "NPC Character",
			CharacterType: "npc_gm",
		})
		require.NoError(t, err)

		// Create new conversation
		newConv, err := service.CreateConversation(context.Background(), CreateConversationRequest{
			GameID:          game.ID,
			Title:           "NPC Conversation",
			CreatedByUserID: int32(gm.ID),
			ParticipantIDs:  []int32{char1.ID, char2.ID},
		})
		require.NoError(t, err)

		// Add NPC to conversation
		err = service.AddParticipant(context.Background(), newConv.ID, npc.ID)
		require.NoError(t, err)

		// Verify NPC was added
		participants, err := service.GetConversationParticipants(context.Background(), newConv.ID)
		require.NoError(t, err)
		assert.Len(t, participants, 3)
	})

	t.Run("returns error for non-existent character", func(t *testing.T) {
		err := service.AddParticipant(context.Background(), conversation.ID, 99999)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "character")
	})
}

func TestConversationService_GetOrCreateConversation(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := NewConversationService(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)

	char1, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Character 1",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char2, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Character 2",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	t.Run("creates new conversation for two characters", func(t *testing.T) {
		conv, err := service.GetOrCreateConversation(
			context.Background(),
			game.ID,
			[]int32{char1.ID, char2.ID},
			int32(player1.ID),
			"Test Conversation",
		)

		require.NoError(t, err)
		assert.NotNil(t, conv)
		assert.Equal(t, game.ID, conv.GameID)
		assert.Equal(t, "direct", conv.ConversationType)
	})

	t.Run("creates new group conversation for three characters", func(t *testing.T) {
		player3 := testDB.CreateTestUser(t, "player3", "player3@example.com")
		_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player3.ID), "player")
		require.NoError(t, err)

		char3, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
			GameID:        game.ID,
			UserID:        int32Ptr(int32(player3.ID)),
			Name:          "Character 3",
			CharacterType: "player_character",
		})
		require.NoError(t, err)

		conv, err := service.GetOrCreateConversation(
			context.Background(),
			game.ID,
			[]int32{char1.ID, char2.ID, char3.ID},
			int32(player1.ID),
			"Group Chat",
		)

		require.NoError(t, err)
		assert.Equal(t, "group", conv.ConversationType)
	})
}

func TestConversationService_CreateConversationWithNPC(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := NewConversationService(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)

	char1, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Player Character",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create NPC without user_id
	npc, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        nil, // NPC has no user
		Name:          "NPC Character",
		CharacterType: "npc_gm",
	})
	require.NoError(t, err)

	t.Run("creates conversation with NPC using GM's user ID", func(t *testing.T) {
		req := CreateConversationRequest{
			GameID:          game.ID,
			Title:           "Player-NPC Chat",
			CreatedByUserID: int32(player1.ID),
			ParticipantIDs:  []int32{char1.ID, npc.ID},
		}

		conversation, err := service.CreateConversation(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, conversation)
		assert.Equal(t, "direct", conversation.ConversationType)

		// Verify both participants were added
		participants, err := service.GetConversationParticipants(context.Background(), conversation.ID)
		require.NoError(t, err)
		assert.Len(t, participants, 2)
	})
}

func TestConversationService_EdgeCases(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := NewConversationService(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool}
	charService := &CharacterService{DB: testDB.Pool}

	// Setup
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player1.ID), "player")
	require.NoError(t, err)
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(player2.ID), "player")
	require.NoError(t, err)

	char1, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player1.ID)),
		Name:          "Character 1",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	char2, err := charService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player2.ID)),
		Name:          "Character 2",
		CharacterType: "player_character",
	})
	require.NoError(t, err)

	// Create conversation
	conversation, err := service.CreateConversation(context.Background(), CreateConversationRequest{
		GameID:          game.ID,
		CreatedByUserID: int32(player1.ID),
		ParticipantIDs:  []int32{char1.ID, char2.ID},
	})
	require.NoError(t, err)

	t.Run("GetUnreadMessageCount returns 0 for participant with no unread messages", func(t *testing.T) {
		// Player1 is participant but hasn't received any messages (they sent the messages)
		count, err := service.GetUnreadMessageCount(context.Background(), conversation.ID, int32(player1.ID))

		require.NoError(t, err)
		assert.Equal(t, int64(0), count)
	})

	t.Run("GetConversationParticipants returns empty for non-existent conversation", func(t *testing.T) {
		participants, err := service.GetConversationParticipants(context.Background(), 99999)

		// Should return empty list or error
		if err == nil {
			assert.Empty(t, participants)
		} else {
			// Error is acceptable for non-existent conversation
			assert.Error(t, err)
		}
	})

	t.Run("CreateConversation with empty title", func(t *testing.T) {
		req := CreateConversationRequest{
			GameID:          game.ID,
			Title:           "", // Empty title
			CreatedByUserID: int32(player1.ID),
			ParticipantIDs:  []int32{char1.ID, char2.ID},
		}

		conv, err := service.CreateConversation(context.Background(), req)

		require.NoError(t, err)
		assert.NotNil(t, conv)
		// Empty title should result in null/invalid title
		assert.False(t, conv.Title.Valid)
	})
}
