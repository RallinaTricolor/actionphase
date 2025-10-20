package db

import (
	"actionphase/pkg/core"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTestSuite_Basic(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("games").
		Setup()
	defer suite.Cleanup()

	// Verify suite components are initialized
	assert.NotNil(t, suite.DB(), "DB should be initialized")
	assert.NotNil(t, suite.Factory(), "Factory should be initialized")
	assert.NotNil(t, suite.Pool(), "Pool should be initialized")
}

func TestTestSuite_WithFixtures(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("games", "sessions", "users").
		WithFixtures().
		Setup()
	defer suite.Cleanup()

	// Verify fixtures are created
	fixtures := suite.Fixtures()
	require.NotNil(t, fixtures, "Fixtures should be created")
	assert.NotNil(t, fixtures.TestUser, "TestUser fixture should exist")
	assert.NotNil(t, fixtures.TestGame, "TestGame fixture should exist")
}

func TestTestSuite_ServiceFactory(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("games").
		Setup()
	defer suite.Cleanup()

	// Verify all services can be created
	assert.NotNil(t, suite.UserService(), "UserService should be created")
	assert.NotNil(t, suite.SessionService(), "SessionService should be created")
	assert.NotNil(t, suite.GameService(), "GameService should be created")
	assert.NotNil(t, suite.CharacterService(), "CharacterService should be created")
	assert.NotNil(t, suite.GameApplicationService(), "GameApplicationService should be created")
}

func TestTestSuite_TransitionGameTo(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("games").
		Setup()
	defer suite.Cleanup()

	// Create test data
	user := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(user.ID).Create()

	// Test transition helper
	assert.Equal(t, "setup", game.State.String, "Initial state should be setup")

	updatedGame := suite.TransitionGameTo(game, "recruitment")
	assert.Equal(t, "recruitment", updatedGame.State.String, "State should be recruitment after transition")
}

func TestTestSuite_AddParticipant(t *testing.T) {
	suite := NewTestSuite(t).
		WithCleanup("participants").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("gamemaster").Create()
	player := suite.Factory().NewUser().WithUsername("player").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()

	// Test add participant helper
	participant := suite.AddParticipant(game, player, "player")

	require.NotNil(t, participant, "Participant should be created")
	assert.Equal(t, game.ID, participant.GameID, "Participant should be for correct game")
	assert.Equal(t, player.ID, participant.UserID, "Participant should be correct user")
	assert.Equal(t, "player", participant.Role, "Participant should have correct role")
}

func TestServiceFactory_AllServices(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "games", "sessions", "users")

	factory := NewServiceFactory(testDB.Pool)

	// Verify all services can be created and have correct pool
	userService := factory.UserService()
	require.NotNil(t, userService)
	assert.Equal(t, testDB.Pool, userService.DB)

	sessionService := factory.SessionService()
	require.NotNil(t, sessionService)
	assert.Equal(t, testDB.Pool, sessionService.DB)

	gameService := factory.GameService()
	require.NotNil(t, gameService)
	assert.Equal(t, testDB.Pool, gameService.DB)

	characterService := factory.CharacterService()
	require.NotNil(t, characterService)
	assert.Equal(t, testDB.Pool, characterService.DB)

	applicationService := factory.GameApplicationService()
	require.NotNil(t, applicationService)
	assert.Equal(t, testDB.Pool, applicationService.DB)
}

func TestTestSuite_CleanupPresets(t *testing.T) {
	// Test that cleanup presets work correctly
	testCases := []struct {
		name   string
		preset string
		verify func(*testing.T, *TestSuite)
	}{
		{
			name:   "games preset",
			preset: "games",
			verify: func(t *testing.T, suite *TestSuite) {
				// Create game and verify it's cleaned up
				user := suite.Factory().NewUser().Create()
				game := suite.Factory().NewGame().WithGM(user.ID).Create()
				assert.NotEqual(t, int32(0), game.ID, "Game should be created")
			},
		},
		{
			name:   "characters preset",
			preset: "characters",
			verify: func(t *testing.T, suite *TestSuite) {
				user := suite.Factory().NewUser().Create()
				game := suite.Factory().NewGame().WithGM(user.ID).Create()
				character := suite.Factory().NewCharacter().
					InGame(game).
					OwnedBy(user).
					Create()
				assert.NotEqual(t, int32(0), character.ID, "Character should be created")
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			suite := NewTestSuite(t).
				WithCleanup(tc.preset).
				Setup()
			defer suite.Cleanup()

			tc.verify(t, suite)
		})
	}
}
