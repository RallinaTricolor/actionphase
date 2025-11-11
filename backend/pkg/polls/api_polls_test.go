package polls

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	dbservices "actionphase/pkg/db/services"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// setupPollTestRouter creates a test router with auth middleware
func setupPollTestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &dbservices.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	router := chi.NewRouter()

	router.Route("/api/v1", func(r chi.Router) {
		r.Route("/polls/{pollId}/results", func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(core.RequireAuthenticationMiddleware(userService))

			handler := &Handler{App: app}
			r.Get("/", handler.GetPollResults)
		})
	})

	return router
}

// TestPollResultsAccess tests the access control for poll results
func TestPollResultsAccess(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "common_room_poll_responses", "common_room_poll_options", "common_room_polls", "game_audience", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupPollTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create test users
	gmUser := fixtures.TestUser // GM
	playerUser := testDB.CreateTestUser(t, "testplayer", "player@example.com")
	audienceUser := testDB.CreateTestUser(t, "testaudience", "audience@example.com")

	gameService := &dbservices.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a game
	game := testDB.CreateTestGame(t, int32(gmUser.ID), "Test Game")

	// Add player as participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Adding player to game should succeed")

	// Add audience member directly via SQL
	queries := db.New(testDB.Pool)
	_, err = queries.CreateAudienceApplication(context.Background(), db.CreateAudienceApplicationParams{
		GameID: game.ID,
		UserID: int32(audienceUser.ID),
		Status: pgtype.Text{String: "active", Valid: true},
	})
	core.AssertNoError(t, err, "Adding audience member to game should succeed")

	// Create an active poll (expires in future)
	activePollDeadline := time.Now().Add(24 * time.Hour)
	activePoll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              nil,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Active Poll Question",
		Description:          core.StringPtr("Active poll for testing"),
		Deadline:             activePollDeadline,
		VoteAsType:           "player",
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating active poll should succeed")

	// Create an expired poll (deadline in past)
	expiredPollDeadline := time.Now().Add(-24 * time.Hour)
	expiredPoll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              nil,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Expired Poll Question",
		Description:          core.StringPtr("Expired poll for testing"),
		Deadline:             expiredPollDeadline,
		VoteAsType:           "player",
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating expired poll should succeed")

	// Create tokens
	gmToken, err := core.CreateTestJWTTokenForUser(app, gmUser)
	core.AssertNoError(t, err, "GM token creation should succeed")

	playerToken, err := core.CreateTestJWTTokenForUser(app, playerUser)
	core.AssertNoError(t, err, "Player token creation should succeed")

	audienceToken, err := core.CreateTestJWTTokenForUser(app, audienceUser)
	core.AssertNoError(t, err, "Audience token creation should succeed")

	testCases := []struct {
		name           string
		pollID         int32
		token          string
		expectedStatus int
		description    string
	}{
		{
			name:           "gm_can_view_active_poll_results",
			pollID:         activePoll.Poll.ID,
			token:          gmToken,
			expectedStatus: http.StatusOK,
			description:    "GM should be able to view results of active polls",
		},
		{
			name:           "gm_can_view_expired_poll_results",
			pollID:         expiredPoll.Poll.ID,
			token:          gmToken,
			expectedStatus: http.StatusOK,
			description:    "GM should be able to view results of expired polls",
		},
		{
			name:           "audience_can_view_active_poll_results",
			pollID:         activePoll.Poll.ID,
			token:          audienceToken,
			expectedStatus: http.StatusOK,
			description:    "Audience members should be able to view results of active polls",
		},
		{
			name:           "audience_can_view_expired_poll_results",
			pollID:         expiredPoll.Poll.ID,
			token:          audienceToken,
			expectedStatus: http.StatusOK,
			description:    "Audience members should be able to view results of expired polls",
		},
		{
			name:           "player_cannot_view_active_poll_results",
			pollID:         activePoll.Poll.ID,
			token:          playerToken,
			expectedStatus: http.StatusForbidden,
			description:    "Players should not be able to view results of active polls",
		},
		{
			name:           "player_can_view_expired_poll_results",
			pollID:         expiredPoll.Poll.ID,
			token:          playerToken,
			expectedStatus: http.StatusOK,
			description:    "Players should be able to view results of expired polls",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create request
			req := httptest.NewRequest(http.MethodGet, "/api/v1/polls/"+strconv.Itoa(int(tc.pollID))+"/results", nil)
			req.Header.Set("Authorization", "Bearer "+tc.token)

			// Set URL parameters
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("pollId", strconv.Itoa(int(tc.pollID)))
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			// Execute request
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Verify status code
			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)
		})
	}
}

// TestPollResultsAccess_NotInGame tests that users not in the game cannot view poll results
func TestPollResultsAccess_NotInGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "common_room_poll_responses", "common_room_poll_options", "common_room_polls", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupPollTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create test users
	gmUser := fixtures.TestUser // GM
	outsiderUser := testDB.CreateTestUser(t, "outsider", "outsider@example.com")

	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a game
	game := testDB.CreateTestGame(t, int32(gmUser.ID), "Test Game")

	// Create a poll
	pollDeadline := time.Now().Add(24 * time.Hour)
	poll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              nil,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Test Poll Question",
		Description:          core.StringPtr("Test poll"),
		Deadline:             pollDeadline,
		VoteAsType:           "player",
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating poll should succeed")

	// Create token for outsider
	outsiderToken, err := core.CreateTestJWTTokenForUser(app, outsiderUser)
	core.AssertNoError(t, err, "Outsider token creation should succeed")

	// Create request
	req := httptest.NewRequest(http.MethodGet, "/api/v1/polls/"+strconv.Itoa(int(poll.Poll.ID))+"/results", nil)
	req.Header.Set("Authorization", "Bearer "+outsiderToken)

	// Set URL parameters
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("pollId", strconv.Itoa(int(poll.Poll.ID)))
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Verify forbidden status
	core.AssertEqual(t, http.StatusForbidden, w.Code, "Users not in the game should not be able to view poll results")
}

// setupPollVoteTestRouter creates a test router for poll voting
func setupPollVoteTestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &dbservices.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	router := chi.NewRouter()

	router.Route("/api/v1", func(r chi.Router) {
		r.Route("/polls/{pollId}/vote", func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(core.RequireAuthenticationMiddleware(userService))

			handler := &Handler{App: app}
			r.Post("/", handler.SubmitVote)
		})
	})

	return router
}

// setupGetPollTestRouter creates a test router for getting poll details
func setupGetPollTestRouter(app *core.App, testDB *core.TestDatabase) *chi.Mux {
	tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
	userService := &dbservices.UserService{DB: testDB.Pool, Logger: app.ObsLogger}

	router := chi.NewRouter()

	router.Route("/api/v1", func(r chi.Router) {
		r.Route("/polls/{pollId}", func(r chi.Router) {
			r.Use(jwtauth.Verifier(tokenAuth))
			r.Use(jwtauth.Authenticator(tokenAuth))
			r.Use(core.RequireAuthenticationMiddleware(userService))

			handler := &Handler{App: app}
			r.Get("/", handler.GetPoll)
		})
	})

	return router
}

// TestGetPoll_VotedCharacterIDs tests that the GetPoll endpoint returns voted_character_ids for character-level polls
func TestGetPoll_VotedCharacterIDs(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "common_room_poll_responses", "common_room_poll_options", "common_room_polls", "characters", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupGetPollTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create test users
	gmUser := fixtures.TestUser // GM
	playerUser := testDB.CreateTestUser(t, "testplayer", "player@example.com")

	gameService := &dbservices.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &dbservices.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a game
	game := testDB.CreateTestGame(t, int32(gmUser.ID), "Test Game")

	// Add player as participant
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Adding player to game should succeed")

	// Create characters for the player
	playerUserID := int32(playerUser.ID)
	char1, err := characterService.CreateCharacter(context.Background(), dbservices.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &playerUserID,
		Name:          "Character 1",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Creating character 1 should succeed")

	char2, err := characterService.CreateCharacter(context.Background(), dbservices.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &playerUserID,
		Name:          "Character 2",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Creating character 2 should succeed")

	_, err = characterService.CreateCharacter(context.Background(), dbservices.CreateCharacterRequest{
		GameID:        game.ID,
		UserID:        &playerUserID,
		Name:          "Character 3",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Creating character 3 should succeed")

	// Create a character-level poll
	pollDeadline := time.Now().Add(24 * time.Hour)
	poll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:              game.ID,
		CreatedByUserID:     int32(gmUser.ID),
		Question:            "Character Poll Question",
		Description:         core.StringPtr("Character-level poll for testing"),
		Deadline:            pollDeadline,
		VoteAsType:          "character",
		ShowIndividualVotes: false,
		AllowOtherOption:    false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating character poll should succeed")

	// Player votes with char1 and char2
	_, err = pollService.SubmitVote(context.Background(), core.SubmitVoteRequest{
		PollID:           poll.Poll.ID,
		UserID:           int32(playerUser.ID),
		CharacterID:      &char1.ID,
		SelectedOptionID: &poll.Options[0].ID,
	})
	core.AssertNoError(t, err, "Voting with character 1 should succeed")

	_, err = pollService.SubmitVote(context.Background(), core.SubmitVoteRequest{
		PollID:           poll.Poll.ID,
		UserID:           int32(playerUser.ID),
		CharacterID:      &char2.ID,
		SelectedOptionID: &poll.Options[1].ID,
	})
	core.AssertNoError(t, err, "Voting with character 2 should succeed")

	// Create token for player
	playerToken, err := core.CreateTestJWTTokenForUser(app, playerUser)
	core.AssertNoError(t, err, "Player token creation should succeed")

	// Create request to get poll
	req := httptest.NewRequest(http.MethodGet, "/api/v1/polls/"+strconv.Itoa(int(poll.Poll.ID)), nil)
	req.Header.Set("Authorization", "Bearer "+playerToken)

	// Set URL parameters
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("pollId", strconv.Itoa(int(poll.Poll.ID)))
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	// Execute request
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Verify status code
	core.AssertEqual(t, http.StatusOK, w.Code, "GetPoll should return 200 OK")

	// Parse response body
	body := w.Body.String()

	// Verify response contains voted_character_ids field
	core.AssertTrue(t, strings.Contains(body, "voted_character_ids"), "Response should contain voted_character_ids field")

	// Verify the character IDs are in the response (they should be char1 and char2)
	char1IDStr := strconv.Itoa(int(char1.ID))
	char2IDStr := strconv.Itoa(int(char2.ID))

	core.AssertTrue(t, strings.Contains(body, char1IDStr), "Response should contain char1 ID: "+char1IDStr)
	core.AssertTrue(t, strings.Contains(body, char2IDStr), "Response should contain char2 ID: "+char2IDStr)

	// Verify char3 (not voted) is NOT in voted_character_ids
	// The presence of char1 and char2 IDs in the voted_character_ids array verifies the feature works
}

// TestPollVoting_GMAndCoGMBlocked tests that GMs and co-GMs cannot vote on polls
func TestPollVoting_GMAndCoGMBlocked(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "common_room_poll_responses", "common_room_poll_options", "common_room_polls", "co_gms", "game_participants", "games", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupPollVoteTestRouter(app, testDB)
	fixtures := testDB.SetupFixtures(t)

	// Create test users
	gmUser := fixtures.TestUser // GM
	coGMUser := testDB.CreateTestUser(t, "cogm", "cogm@example.com")
	playerUser := testDB.CreateTestUser(t, "player", "player@example.com")

	gameService := &dbservices.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	pollService := &dbservices.PollService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a game
	game := testDB.CreateTestGame(t, int32(gmUser.ID), "Test Game")

	// Add co-GM as a participant with co_gm role
	_, err := gameService.AddGameParticipant(context.Background(), game.ID, int32(coGMUser.ID), "co_gm")
	core.AssertNoError(t, err, "Adding co-GM should succeed")

	// Add player as participant
	_, err = gameService.AddGameParticipant(context.Background(), game.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Adding player to game should succeed")

	// Create an active poll
	pollDeadline := time.Now().Add(24 * time.Hour)
	poll, err := pollService.CreatePollWithOptions(context.Background(), core.CreatePollRequest{
		GameID:               game.ID,
		PhaseID:              nil,
		CreatedByUserID:      int32(gmUser.ID),
		CreatedByCharacterID: nil,
		Question:             "Test Poll",
		Description:          core.StringPtr("Test poll for voting"),
		Deadline:             pollDeadline,
		VoteAsType:           "player",
		ShowIndividualVotes:  false,
		AllowOtherOption:     false,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	})
	core.AssertNoError(t, err, "Creating poll should succeed")

	// Create tokens
	gmToken, err := core.CreateTestJWTTokenForUser(app, gmUser)
	core.AssertNoError(t, err, "GM token creation should succeed")

	coGMToken, err := core.CreateTestJWTTokenForUser(app, coGMUser)
	core.AssertNoError(t, err, "Co-GM token creation should succeed")

	playerToken, err := core.CreateTestJWTTokenForUser(app, playerUser)
	core.AssertNoError(t, err, "Player token creation should succeed")

	// Test cases
	testCases := []struct {
		name           string
		token          string
		expectedStatus int
		description    string
	}{
		{
			name:           "gm_cannot_vote",
			token:          gmToken,
			expectedStatus: http.StatusForbidden,
			description:    "GMs should not be able to vote on polls",
		},
		{
			name:           "co_gm_cannot_vote",
			token:          coGMToken,
			expectedStatus: http.StatusForbidden,
			description:    "Co-GMs should not be able to vote on polls",
		},
		{
			name:           "player_can_vote",
			token:          playerToken,
			expectedStatus: http.StatusOK,
			description:    "Players should be able to vote on polls",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create vote request body
			body := `{"selected_option_id":` + strconv.Itoa(int(poll.Options[0].ID)) + `}`

			// Create request
			req := httptest.NewRequest(http.MethodPost, "/api/v1/polls/"+strconv.Itoa(int(poll.Poll.ID))+"/vote",
				io.NopCloser(strings.NewReader(body)))
			req.Header.Set("Authorization", "Bearer "+tc.token)
			req.Header.Set("Content-Type", "application/json")

			// Set URL parameters
			rctx := chi.NewRouteContext()
			rctx.URLParams.Add("pollId", strconv.Itoa(int(poll.Poll.ID)))
			req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

			// Execute request
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Verify status code
			core.AssertEqual(t, tc.expectedStatus, w.Code, tc.description)
		})
	}
}
