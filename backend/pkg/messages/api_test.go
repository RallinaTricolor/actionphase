package messages

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"actionphase/pkg/db/services/messages"
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
)

// Helper function for creating int32 pointers
func int32Ptr(i int32) *int32 {
	return &i
}

// setupMessageAPITestRouter creates a test router with message routes
func setupMessageAPITestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &db.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	r := chi.NewRouter()

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/games", func(r chi.Router) {
			messageHandler := Handler{App: app}

			r.Group(func(r chi.Router) {
				r.Use(jwtauth.Verifier(tokenAuth))
				r.Use(jwtauth.Authenticator(tokenAuth))
				r.Use(core.RequireAuthenticationMiddleware(userService))

				// Post routes
				r.Patch("/{gameId}/posts/{postId}", messageHandler.UpdatePost)
			})
		})
	})

	return r
}

// TestMessageAPI_UpdatePost tests the PATCH /games/{gameId}/posts/{postId} endpoint
func TestMessageAPI_UpdatePost(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "messages", "characters", "games", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupMessageAPITestRouter(app, testDB)

	// Create test users
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")

	// Create test game
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Setup services
	messageService := &messages.MessageService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Add player as participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(player.ID), "player")
	core.AssertNoError(t, err, "Should add player as participant")

	// Create character for player
	playerChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(player.ID)),
		Name:          "Player Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create player character")

	// Create character for GM
	gmChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        int32Ptr(int32(gm.ID)),
		Name:          "GM Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Should create GM character")

	// Create a test post by player
	post, err := messageService.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		PhaseID:     nil,
		AuthorID:    int32(player.ID),
		CharacterID: playerChar.ID,
		Content:     "Original post content",
		Visibility:  "game",
	})
	core.AssertNoError(t, err, "Should create test post")

	// Create another post by GM for negative testing
	gmPost, err := messageService.CreatePost(context.Background(), core.CreatePostRequest{
		GameID:      game.ID,
		PhaseID:     nil,
		AuthorID:    int32(gm.ID),
		CharacterID: gmChar.ID,
		Content:     "GM's post",
		Visibility:  "game",
	})
	core.AssertNoError(t, err, "Should create GM's test post")

	// Get tokens for authentication
	userToken, err := core.CreateTestJWTTokenForUser(app, player)
	core.AssertNoError(t, err, "Should generate user JWT")

	gmToken, err := core.CreateTestJWTTokenForUser(app, gm)
	core.AssertNoError(t, err, "Should generate GM JWT")

	testCases := []struct {
		name           string
		postID         int32
		token          string
		requestBody    UpdatePostRequest
		expectedStatus int
		description    string
	}{
		{
			name:   "author_can_edit_own_post",
			postID: post.ID,
			token:  userToken,
			requestBody: UpdatePostRequest{
				Content: "Updated content by author",
			},
			expectedStatus: 200,
			description:    "Author should be able to edit their own post",
		},
		{
			name:   "non_author_cannot_edit_post",
			postID: post.ID,
			token:  gmToken,
			requestBody: UpdatePostRequest{
				Content: "Trying to edit someone else's post",
			},
			expectedStatus: 403,
			description:    "Non-author should not be able to edit post",
		},
		{
			name:   "nonexistent_post",
			postID: 99999,
			token:  userToken,
			requestBody: UpdatePostRequest{
				Content: "Trying to edit nonexistent post",
			},
			expectedStatus: 404,
			description:    "Should return 404 for non-existent post",
		},
		{
			name:   "empty_content",
			postID: post.ID,
			token:  userToken,
			requestBody: UpdatePostRequest{
				Content: "",
			},
			expectedStatus: 400,
			description:    "Should reject empty content",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			bodyBytes, err := json.Marshal(tc.requestBody)
			core.AssertNoError(t, err, "Should marshal request body")

			url := "/api/v1/games/" + strconv.Itoa(int(game.ID)) + "/posts/" + strconv.Itoa(int(tc.postID))
			req := httptest.NewRequest("PATCH", url, bytes.NewReader(bodyBytes))
			req.Header.Set("Authorization", "Bearer "+tc.token)
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)

			// Verify response structure for successful requests
			if w.Code == 200 {
				var response core.MessageWithDetails
				err := json.Unmarshal(w.Body.Bytes(), &response)
				core.AssertNoError(t, err, "Response should be valid JSON")
				core.AssertEqual(t, tc.requestBody.Content, response.Content, "Content should be updated")
				core.AssertEqual(t, true, response.IsEdited, "IsEdited should be true")
			}
		})
	}

	// Additional test: Verify edit history tracking
	t.Run("edit_history_tracking", func(t *testing.T) {
		// First edit
		bodyBytes, _ := json.Marshal(UpdatePostRequest{Content: "First edit"})
		url := "/api/v1/games/" + strconv.Itoa(int(game.ID)) + "/posts/" + strconv.Itoa(int(gmPost.ID))
		req := httptest.NewRequest("PATCH", url, bytes.NewReader(bodyBytes))
		req.Header.Set("Authorization", "Bearer "+gmToken)
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		core.AssertEqual(t, 200, w.Code, "First edit should succeed")

		var firstEdit core.MessageWithDetails
		json.Unmarshal(w.Body.Bytes(), &firstEdit)

		// Second edit
		bodyBytes, _ = json.Marshal(UpdatePostRequest{Content: "Second edit"})
		req = httptest.NewRequest("PATCH", url, bytes.NewReader(bodyBytes))
		req.Header.Set("Authorization", "Bearer "+gmToken)
		req.Header.Set("Content-Type", "application/json")
		w = httptest.NewRecorder()

		router.ServeHTTP(w, req)
		core.AssertEqual(t, 200, w.Code, "Second edit should succeed")

		var secondEdit core.MessageWithDetails
		json.Unmarshal(w.Body.Bytes(), &secondEdit)

		// Note: edit_count is tracked in the database but not exposed in MessageWithDetails
		// The service-layer test verifies edit_count tracking
		core.AssertEqual(t, true, secondEdit.IsEdited, "Should be marked as edited")
		core.AssertEqual(t, "Second edit", secondEdit.Content, "Should have latest content")
	})
}
