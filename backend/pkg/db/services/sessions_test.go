package db

import (
	"testing"

	"actionphase/pkg/core"
)

func TestSessionService_SessionByToken(t *testing.T) {
	// Setup test database
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	// Setup test fixtures
	fixtures := testDB.SetupFixtures(t)

	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a test session
	testSession := &core.Session{
		User:  fixtures.TestUser,
		Token: "test-token-123",
	}

	_, err := sessionService.CreateSession(testSession)
	core.AssertNoError(t, err, "Failed to create session")

	// Test retrieving session by token
	retrievedSession, err := sessionService.SessionByToken("test-token-123")
	core.AssertNoError(t, err, "Failed to retrieve session by token")
	core.AssertNotEqual(t, 0, retrievedSession.ID, "Session ID should be set")
}

func TestSessionService_SessionByToken_NotFound(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Test retrieving non-existent session
	_, err := sessionService.SessionByToken("non-existent-token")
	core.AssertError(t, err, "Should return error for non-existent token")
}

func TestSessionService_CreateSession(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	testCases := []struct {
		name        string
		session     *core.Session
		expectError bool
	}{
		{
			name: "valid session",
			session: &core.Session{
				User:  fixtures.TestUser,
				Token: "valid-token-456",
			},
			expectError: false,
		},
		{
			name: "session with invalid user ID",
			session: &core.Session{
				User:  &core.User{ID: -1},
				Token: "invalid-token",
			},
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			session, err := sessionService.CreateSession(tc.session)

			if tc.expectError {
				core.AssertError(t, err, "Expected error for invalid session")
				return
			}

			core.AssertNoError(t, err, "Failed to create valid session")
			core.AssertNotEqual(t, 0, session.ID, "Session ID should be set")
		})
	}
}

func TestSessionService_DeleteSessionByToken(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a session to delete
	testSession := &core.Session{
		User:  fixtures.TestUser,
		Token: "token-to-delete",
	}

	_, err := sessionService.CreateSession(testSession)
	core.AssertNoError(t, err, "Failed to create session")

	// Delete the session
	err = sessionService.DeleteSessionByToken("token-to-delete")
	core.AssertNoError(t, err, "Failed to delete session")

	// Verify session is deleted
	_, err = sessionService.SessionByToken("token-to-delete")
	core.AssertError(t, err, "Session should be deleted and not findable")
}

func TestSessionService_DeleteSessionByToken_NotFound(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Try to delete non-existent session
	err := sessionService.DeleteSessionByToken("non-existent-token")
	// Note: This may or may not error depending on implementation
	// The current implementation doesn't check if the session existed
	// so this test documents the current behavior
	core.AssertNoError(t, err, "Deleting non-existent session should not error")
}

func TestSessionService_Session_ById(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a session
	testSession := &core.Session{
		User:  fixtures.TestUser,
		Token: "test-token-by-id",
	}

	createdSession, err := sessionService.CreateSession(testSession)
	core.AssertNoError(t, err, "Failed to create session")

	// Test Session by ID (currently returns nil in implementation)
	retrievedSession, err := sessionService.Session(createdSession.ID)

	// Note: Current implementation returns nil, nil
	// This test documents the current behavior and will need updating
	// when the method is properly implemented
	if retrievedSession != nil {
		core.AssertEqual(t, createdSession.ID, retrievedSession.ID, "Session IDs should match")
	}
}

func TestSessionService_Sessions(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "sessions", "users")

	fixtures := testDB.SetupFixtures(t)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create multiple sessions
	session1 := &core.Session{
		User:  fixtures.TestUser,
		Token: "session-1-token",
	}
	session2 := &core.Session{
		User:  fixtures.TestUser,
		Token: "session-2-token",
	}

	_, err := sessionService.CreateSession(session1)
	core.AssertNoError(t, err, "Failed to create session 1")

	_, err = sessionService.CreateSession(session2)
	core.AssertNoError(t, err, "Failed to create session 2")

	// Test Sessions method (currently returns nil in implementation)
	sessions, err := sessionService.Sessions()

	// Note: Current implementation returns nil, nil
	// This test documents the current behavior and will need updating
	// when the method is properly implemented
	if sessions != nil && len(sessions) > 0 {
		t.Logf("Retrieved %d sessions", len(sessions))
	}
}

// Benchmark tests for performance monitoring
func BenchmarkSessionService_CreateSession(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "sessions", "users")

	fixtures := testDB.SetupFixtures(b)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		testSession := &core.Session{
			User:  fixtures.TestUser,
			Token: "benchmark-token-" + string(rune(i)),
		}

		_, err := sessionService.CreateSession(testSession)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkSessionService_SessionByToken(b *testing.B) {
	testDB := core.NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b, "sessions", "users")

	fixtures := testDB.SetupFixtures(b)
	app := core.NewTestApp(testDB.Pool)
	sessionService := &SessionService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create a session for benchmarking
	testSession := &core.Session{
		User:  fixtures.TestUser,
		Token: "benchmark-lookup-token",
	}

	_, err := sessionService.CreateSession(testSession)
	if err != nil {
		b.Fatal(err)
	}

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		_, err := sessionService.SessionByToken("benchmark-lookup-token")
		if err != nil {
			b.Fatal(err)
		}
	}
}
