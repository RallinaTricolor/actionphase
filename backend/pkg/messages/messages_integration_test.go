package messages

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	messagesvc "actionphase/pkg/db/services/messages"
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

// TestMessageAPI_PostCreationFlow tests the complete post creation workflow
func TestMessageAPI_PostCreationFlow(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "messages", "character_mentions", "characters", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupMessageTestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	// Create auth token for GM user
	gmToken, err := createTestAuthToken(fixtures.TestUser.Username)
	core.AssertNoError(t, err, "GM token creation should succeed")

	gameID := fixtures.TestGame.ID

	// Create a character for the GM to post as
	charService := &db.CharacterService{DB: testDB.Pool}
	userID := int32(fixtures.TestUser.ID)
	gmCharacter, err := charService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        gameID,
		UserID:        &userID,
		Name:          "GM Test Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "GM character creation should succeed")

	testCases := []struct {
		name           string
		payload        CreatePostRequest
		expectedStatus int
		description    string
		validateFn     func(t *testing.T, response *MessageResponse)
	}{
		{
			name: "successful_post_creation",
			payload: CreatePostRequest{
				CharacterID: gmCharacter.ID,
				Content:     "Welcome to the mission briefing!",
			},
			expectedStatus: 201,
			description:    "Valid post should be created successfully",
			validateFn: func(t *testing.T, response *MessageResponse) {
				core.AssertEqual(t, "Welcome to the mission briefing!", response.Content, "Content should match")
				core.AssertEqual(t, "post", response.MessageType, "Message type should be post")
				core.AssertEqual(t, gameID, response.GameID, "Game ID should match")
				core.AssertEqual(t, gmCharacter.ID, response.CharacterID, "Character ID should match")
				core.AssertEqual(t, int32(0), response.ThreadDepth, "Post thread depth should be 0")
			},
		},
		{
			name: "post_with_character_mention",
			payload: CreatePostRequest{
				CharacterID: gmCharacter.ID,
				Content:     "Attention @Test Player 1 Character and @Test Player 2 Character, report in!",
			},
			expectedStatus: 201,
			description:    "Post with character mentions should be created",
			validateFn: func(t *testing.T, response *MessageResponse) {
				core.AssertEqual(t, "post", response.MessageType, "Message type should be post")
				// Note: Mention extraction happens in the service layer
				// This test verifies the endpoint accepts the content
			},
		},
		{
			name: "post_missing_character_id",
			payload: CreatePostRequest{
				Content: "This should fail",
			},
			expectedStatus: 500, // TODO: Backend should validate and return 400
			description:    "Post without character ID currently returns 500 (needs validation)",
		},
		{
			name: "post_missing_content",
			payload: CreatePostRequest{
				CharacterID: gmCharacter.ID,
				Content:     "",
			},
			expectedStatus: 201, // TODO: Backend should validate content and return 400
			description:    "Post with empty content currently succeeds (needs validation)",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest("POST", "/api/v1/games/"+strconv.Itoa(int(gameID))+"/posts", bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+gmToken)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			if tc.expectedStatus == 201 && tc.validateFn != nil {
				var response MessageResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Response should be valid JSON")
				tc.validateFn(t, &response)
			}
		})
	}
}

// TestMessageAPI_CommentCreationFlow tests comment creation with mentions
func TestMessageAPI_CommentCreationFlow(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "messages", "character_mentions", "characters", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupMessageTestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	// Create player user
	playerUser := testDB.CreateTestUser(t, "player", "player@example.com")

	playerToken, err := createTestAuthToken(playerUser.Username)
	core.AssertNoError(t, err, "Player token creation should succeed")

	gameID := fixtures.TestGame.ID

	// Create characters
	charService := &db.CharacterService{DB: testDB.Pool}
	gmUserID := int32(fixtures.TestUser.ID)
	gmCharacter, err := charService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        gameID,
		UserID:        &gmUserID,
		Name:          "GM Test Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "GM character creation should succeed")

	playerUserID := int32(playerUser.ID)
	playerCharacter, err := charService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        gameID,
		UserID:        &playerUserID,
		Name:          "Player Test Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Player character creation should succeed")

	// Create a post first
	messageService := &messagesvc.MessageService{DB: testDB.Pool}
	post, err := messageService.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      gameID,
		AuthorID:    int32(fixtures.TestUser.ID),
		CharacterID: gmCharacter.ID,
		Content:     "This is a test post for commenting",
		Visibility:  "game",
	})
	core.AssertNoError(t, err, "Post creation should succeed")

	testCases := []struct {
		name           string
		token          string
		payload        CreateCommentRequest
		expectedStatus int
		description    string
		validateFn     func(t *testing.T, response *MessageResponse)
	}{
		{
			name:  "successful_comment_creation",
			token: playerToken,
			payload: CreateCommentRequest{
				CharacterID: playerCharacter.ID,
				Content:     "I acknowledge the briefing!",
			},
			expectedStatus: 201,
			description:    "Valid comment should be created successfully",
			validateFn: func(t *testing.T, response *MessageResponse) {
				core.AssertEqual(t, "comment", response.MessageType, "Message type should be comment")
				core.AssertEqual(t, "I acknowledge the briefing!", response.Content, "Content should match")
				core.AssertEqual(t, post.ID, *response.ParentID, "Parent ID should match the post")
				core.AssertEqual(t, int32(1), response.ThreadDepth, "Comment thread depth should be 1")
			},
		},
		{
			name:  "comment_with_mention",
			token: playerToken,
			payload: CreateCommentRequest{
				CharacterID: playerCharacter.ID,
				Content:     "Hey @GM Test Character, what are the mission parameters?",
			},
			expectedStatus: 201,
			description:    "Comment with character mention should be created",
			validateFn: func(t *testing.T, response *MessageResponse) {
				core.AssertEqual(t, "comment", response.MessageType, "Message type should be comment")
				// Verify content preserved (mention extraction is service-level concern)
				core.AssertEqual(t, "Hey @GM Test Character, what are the mission parameters?", response.Content, "Content should preserve mentions")
			},
		},
		{
			name:  "comment_missing_character_id",
			token: playerToken,
			payload: CreateCommentRequest{
				Content: "This should fail",
			},
			expectedStatus: 500, // TODO: Backend should validate and return 400
			description:    "Comment without character ID currently returns 500 (needs validation)",
		},
		{
			name:  "comment_missing_content",
			token: playerToken,
			payload: CreateCommentRequest{
				CharacterID: playerCharacter.ID,
				Content:     "",
			},
			expectedStatus: 201, // TODO: Backend should validate content and return 400
			description:    "Comment with empty content currently succeeds (needs validation)",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			payload, _ := json.Marshal(tc.payload)
			url := "/api/v1/games/" + strconv.Itoa(int(gameID)) + "/posts/" + strconv.Itoa(int(post.ID)) + "/comments"
			req := httptest.NewRequest("POST", url, bytes.NewBuffer(payload))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+tc.token)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			if tc.expectedStatus == 201 && tc.validateFn != nil {
				var response MessageResponse
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Response should be valid JSON")
				tc.validateFn(t, &response)
			}
		})
	}
}

// TestMessageAPI_GetGamePosts tests fetching posts for a game
func TestMessageAPI_GetGamePosts(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "messages", "character_mentions", "characters", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupMessageTestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	gmToken, err := createTestAuthToken(fixtures.TestUser.Username)
	core.AssertNoError(t, err, "GM token creation should succeed")

	gameID := fixtures.TestGame.ID

	// Create a character
	charService := &db.CharacterService{DB: testDB.Pool}
	gmUserID := int32(fixtures.TestUser.ID)
	gmCharacter, err := charService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        gameID,
		UserID:        &gmUserID,
		Name:          "GM Test Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Character creation should succeed")

	// Create multiple posts
	messageService := &messagesvc.MessageService{DB: testDB.Pool}
	for i := 1; i <= 3; i++ {
		_, err := messageService.CreatePost(context.Background(), core.CreatePostRequest{
			GameID:      gameID,
			AuthorID:    int32(fixtures.TestUser.ID),
			CharacterID: gmCharacter.ID,
			Content:     "Test post " + strconv.Itoa(i),
			Visibility:  "game",
		})
		core.AssertNoError(t, err, "Post creation should succeed")
	}

	t.Run("get_all_posts", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(gameID))+"/posts", nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Get posts should succeed")

		var response []map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")
		core.AssertEqual(t, 3, len(response), "Should return 3 posts")
	})

	t.Run("get_posts_with_pagination", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/v1/games/"+strconv.Itoa(int(gameID))+"/posts?limit=2&offset=0", nil)
		req.Header.Set("Authorization", "Bearer "+gmToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Get posts with pagination should succeed")

		var response []map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")
		core.AssertEqual(t, 2, len(response), "Should return 2 posts (limit applied)")
	})
}

// TestMessageAPI_GetPostComments tests fetching comments for a post
func TestMessageAPI_GetPostComments(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "messages", "character_mentions", "characters", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupMessageTestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	// Create player user
	playerUser := testDB.CreateTestUser(t, "player", "player@example.com")

	playerToken, err := createTestAuthToken(playerUser.Username)
	core.AssertNoError(t, err, "Player token creation should succeed")

	gameID := fixtures.TestGame.ID

	// Create characters
	charService := &db.CharacterService{DB: testDB.Pool}
	gmUserID := int32(fixtures.TestUser.ID)
	gmCharacter, err := charService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        gameID,
		UserID:        &gmUserID,
		Name:          "GM Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "GM character creation should succeed")

	playerUserID := int32(playerUser.ID)
	playerCharacter, err := charService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        gameID,
		UserID:        &playerUserID,
		Name:          "Player Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Player character creation should succeed")

	// Create a post
	messageService := &messagesvc.MessageService{DB: testDB.Pool}
	post, err := messageService.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      gameID,
		AuthorID:    int32(fixtures.TestUser.ID),
		CharacterID: gmCharacter.ID,
		Content:     "Test post for comments",
		Visibility:  "game",
	})
	core.AssertNoError(t, err, "Post creation should succeed")

	// Create multiple comments
	for i := 1; i <= 2; i++ {
		_, err := messageService.CreateComment(context.Background(), core.CreateCommentRequest{
			GameID:      gameID,
			AuthorID:    int32(playerUser.ID),
			CharacterID: playerCharacter.ID,
			Content:     "Test comment " + strconv.Itoa(i),
			ParentID:    post.ID,
			Visibility:  "game",
		})
		core.AssertNoError(t, err, "Comment creation should succeed")
	}

	t.Run("get_post_comments", func(t *testing.T) {
		url := "/api/v1/games/" + strconv.Itoa(int(gameID)) + "/posts/" + strconv.Itoa(int(post.ID)) + "/comments"
		req := httptest.NewRequest("GET", url, nil)
		req.Header.Set("Authorization", "Bearer "+playerToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 200, w.Code, "Get comments should succeed")

		var response []map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		core.AssertNoError(t, err, "Response should be valid JSON")
		core.AssertEqual(t, 2, len(response), "Should return 2 comments")

		// Verify comment structure
		firstComment := response[0]
		core.AssertNotEqual(t, nil, firstComment["id"], "Comment should have ID")
		core.AssertNotEqual(t, nil, firstComment["content"], "Comment should have content")
		core.AssertEqual(t, "comment", firstComment["message_type"], "Should be comment type")
	})
}

// TestMessageAPI_AuthorizationChecks tests that only GMs can create posts
func TestMessageAPI_AuthorizationChecks(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "messages", "character_mentions", "characters", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupMessageTestRouter(app)
	fixtures := testDB.SetupFixtures(t)

	// Create player user
	playerUser := testDB.CreateTestUser(t, "player", "player@example.com")

	playerToken, err := createTestAuthToken(playerUser.Username)
	core.AssertNoError(t, err, "Player token creation should succeed")

	gameID := fixtures.TestGame.ID

	// Add player as a participant so they can access the game
	gameService := &db.GameService{DB: testDB.Pool}
	_, err = gameService.AddGameParticipant(context.Background(), gameID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Failed to add player as participant")

	// Create a character for the player
	charService := &db.CharacterService{DB: testDB.Pool}
	playerUserID := int32(playerUser.ID)
	playerCharacter, err := charService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        gameID,
		UserID:        &playerUserID,
		Name:          "Player Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Player character creation should succeed")

	t.Run("player_cannot_create_post", func(t *testing.T) {
		payload := CreatePostRequest{
			CharacterID: playerCharacter.ID,
			Content:     "Players should not be able to create posts",
		}

		payloadBytes, _ := json.Marshal(payload)
		req := httptest.NewRequest("POST", "/api/v1/games/"+strconv.Itoa(int(gameID))+"/posts", bytes.NewBuffer(payloadBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+playerToken)
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		core.AssertEqual(t, 403, w.Code, "Non-GM should not be able to create posts")
	})
}

// setupMessageTestRouter creates a test router with message routes
func setupMessageTestRouter(app *core.App) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)

	r := chi.NewRouter()

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/games/{gameId}", func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))

			messageHandler := &Handler{App: app}

			// Post routes
			r.Post("/posts", messageHandler.CreatePost)
			r.Get("/posts", messageHandler.GetGamePosts)

			// Comment routes
			r.Post("/posts/{postId}/comments", messageHandler.CreateComment)
			r.Get("/posts/{postId}/comments", messageHandler.GetPostComments)
		})
	})

	return r
}

// createTestAuthToken creates a JWT token for testing
func createTestAuthToken(username string) (string, error) {
	return core.CreateTestJWTToken(username)
}
