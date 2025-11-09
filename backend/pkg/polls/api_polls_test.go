package polls

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	dbservices "actionphase/pkg/db/services"
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
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
