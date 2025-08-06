package core

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	models "actionphase/pkg/db/models"
)

// TestDatabase provides utilities for database testing
type TestDatabase struct {
	Pool *pgxpool.Pool
}

// TestingInterface defines the interface that both *testing.T and *testing.B satisfy
type TestingInterface interface {
	Fatalf(format string, args ...interface{})
	Logf(format string, args ...interface{})
	Helper()
}

// NewTestDatabase creates a new test database connection
// Note: This requires a running PostgreSQL instance for integration tests
func NewTestDatabase(t TestingInterface) *TestDatabase {
	// Use environment variable or default test connection string
	connectionString := "postgres://postgres:example@localhost:5432/database?sslmode=disable"

	pool, err := pgxpool.New(context.Background(), connectionString)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	return &TestDatabase{Pool: pool}
}

// Close closes the database connection
func (td *TestDatabase) Close() {
	if td.Pool != nil {
		td.Pool.Close()
	}
}

// CleanupTables removes test data from tables (useful for test cleanup)
// Tables should be provided in dependency order (child tables first)
func (td *TestDatabase) CleanupTables(t TestingInterface, tables ...string) {
	ctx := context.Background()
	for _, table := range tables {
		_, err := td.Pool.Exec(ctx, "TRUNCATE TABLE "+table+" RESTART IDENTITY CASCADE")
		if err != nil {
			t.Logf("Warning: Failed to cleanup table %s: %v", table, err)
		}
	}
}

// generateUniqueUsername creates a unique username for testing
func generateUniqueUsername(base string) string {
	return fmt.Sprintf("%s_%d_%d", base, time.Now().UnixNano(), rand.Intn(10000))
}

// generateUniqueEmail creates a unique email for testing
func generateUniqueEmail(base string) string {
	return fmt.Sprintf("%s_%d_%d@example.com", base, time.Now().UnixNano(), rand.Intn(10000))
}

// CreateTestUser creates a test user for use in tests
func (td *TestDatabase) CreateTestUser(t TestingInterface, username, email string) *User {
	ctx := context.Background()
	queries := models.New(td.Pool)

	// Make username and email unique to avoid conflicts
	uniqueUsername := generateUniqueUsername(username)
	uniqueEmail := generateUniqueEmail(email)

	user := &User{
		Username: uniqueUsername,
		Email:    uniqueEmail,
		Password: "test_password",
	}
	user.HashPassword() // Hash the password before storing

	dbUser, err := queries.CreateUser(ctx, models.CreateUserParams{
		Username: user.Username,
		Password: user.Password,
		Email:    user.Email,
	})
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	return &User{
		ID:        int(dbUser.ID),
		Username:  dbUser.Username,
		Email:     dbUser.Email,
		CreatedAt: &dbUser.CreatedAt.Time,
	}
}

// CreateTestGame creates a test game for use in tests
func (td *TestDatabase) CreateTestGame(t TestingInterface, gmUserID int32, title string) *models.Game {
	ctx := context.Background()
	queries := models.New(td.Pool)

	game, err := queries.CreateGame(ctx, models.CreateGameParams{
		Title:       title,
		Description: "Test game created for testing purposes",
		GmUserID:    gmUserID,
		Genre:       pgtype.Text{String: "Test", Valid: true},
		MaxPlayers:  pgtype.Int4{Int32: 6, Valid: true},
		IsPublic:    pgtype.Bool{Bool: true, Valid: true},
	})
	if err != nil {
		t.Fatalf("Failed to create test game: %v", err)
	}

	return &game
}

// TestFixtures provides common test data
type TestFixtures struct {
	TestUser *User
	TestGame *models.Game
}

// SetupFixtures creates common test data for use across tests
func (td *TestDatabase) SetupFixtures(t TestingInterface) *TestFixtures {
	// Create test user
	testUser := td.CreateTestUser(t, "testuser", "test@example.com")

	// Create test game
	testGame := td.CreateTestGame(t, int32(testUser.ID), "Test Game")

	return &TestFixtures{
		TestUser: testUser,
		TestGame: testGame,
	}
}

// AssertNoError is a test helper that fails the test if err is not nil
func AssertNoError(t *testing.T, err error, message string) {
	t.Helper()
	if err != nil {
		t.Fatalf("%s: %v", message, err)
	}
}

// AssertError is a test helper that fails the test if err is nil
func AssertError(t *testing.T, err error, message string) {
	t.Helper()
	if err == nil {
		t.Fatalf("%s: expected error but got nil", message)
	}
}

// AssertEqual is a generic test helper for equality assertions
func AssertEqual[T comparable](t *testing.T, expected, actual T, message string) {
	t.Helper()
	if expected != actual {
		t.Errorf("%s: expected %v, got %v", message, expected, actual)
	}
}

// AssertNotEqual is a generic test helper for inequality assertions
func AssertNotEqual[T comparable](t *testing.T, notExpected, actual T, message string) {
	t.Helper()
	if notExpected == actual {
		t.Errorf("%s: expected not %v, but got %v", message, notExpected, actual)
	}
}

// TimePtr is a helper function to get a pointer to a time.Time
func TimePtr(t time.Time) *time.Time {
	return &t
}

// StringPtr is a helper function to get a pointer to a string
func StringPtr(s string) *string {
	return &s
}

// Int32Ptr is a helper function to get a pointer to an int32
func Int32Ptr(i int32) *int32 {
	return &i
}

// BoolPtr is a helper function to get a pointer to a bool
func BoolPtr(b bool) *bool {
	return &b
}

// NewTestLogger creates a no-op logger for testing purposes
func NewTestLogger() slog.Logger {
	return *slog.New(slog.NewTextHandler(&discardWriter{}, nil))
}

// discardWriter is a writer that discards all input (for test logging)
type discardWriter struct{}

func (discardWriter) Write(p []byte) (int, error) {
	return len(p), nil
}

// AssertTrue is a test helper that fails if the condition is false
func AssertTrue(t *testing.T, condition bool, message string) {
	t.Helper()
	if !condition {
		t.Errorf("%s: expected true, got false", message)
	}
}
