package core

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"net/url"
	"os"
	"strings"
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
// Set TEST_DATABASE_URL environment variable to override default connection string
// Set SKIP_DB_TESTS=true to skip tests that require a database
func NewTestDatabase(t TestingInterface) *TestDatabase {
	// Check if database tests should be skipped
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Logf("Skipping database test - SKIP_DB_TESTS=true")
		if tb, ok := t.(*testing.T); ok {
			tb.Skip("Database tests skipped - set SKIP_DB_TESTS=false to enable")
		}
		return nil // This won't be reached due to Skip(), but keeps the compiler happy
	}

	connectionString := os.Getenv("TEST_DATABASE_URL")
	if connectionString == "" {
		connectionString = "postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable"
	}

	// Validate connection string format
	if _, err := url.Parse(connectionString); err != nil {
		t.Fatalf("Invalid test database URL '%s': %v", connectionString, err)
	}

	pool, err := pgxpool.New(context.Background(), connectionString)
	if err != nil {
		// Instead of failing immediately, try to provide helpful guidance
		t.Logf("Failed to connect to test database: %v", err)
		t.Logf("To skip database tests, set SKIP_DB_TESTS=true")
		t.Logf("To run with database tests, ensure PostgreSQL is running and database exists:")
		t.Logf("  createdb actionphase_test")
		t.Logf("  or set TEST_DATABASE_URL to point to your test database")

		if tb, ok := t.(*testing.T); ok {
			tb.Skip("Database unavailable - skipping test")
		}
		return nil
	}

	// Test the connection
	if err := pool.Ping(context.Background()); err != nil {
		pool.Close()
		t.Logf("Database connection test failed: %v", err)
		if tb, ok := t.(*testing.T); ok {
			tb.Skip("Database connection failed - skipping test")
		}
		return nil
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
// Uses CASCADE to handle foreign key dependencies automatically
func (td *TestDatabase) CleanupTables(t TestingInterface, tables ...string) {
	ctx := context.Background()

	// If no tables specified, clean up common test tables in proper order
	if len(tables) == 0 {
		tables = []string{"game_participants", "games", "sessions", "users"}
	}

	// Use a single transaction for atomic cleanup
	tx, err := td.Pool.Begin(ctx)
	if err != nil {
		t.Logf("Warning: Failed to begin cleanup transaction: %v", err)
		return
	}
	defer func() {
		if err := tx.Rollback(ctx); err != nil {
			t.Logf("Warning: Failed to rollback cleanup transaction: %v", err)
		}
	}()

	for _, table := range tables {
		_, err := tx.Exec(ctx, "TRUNCATE TABLE "+table+" RESTART IDENTITY CASCADE")
		if err != nil {
			t.Logf("Warning: Failed to cleanup table %s: %v", table, err)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		t.Logf("Warning: Failed to commit cleanup transaction: %v", err)
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

// AssertErrorContains checks that an error contains a specific substring
func AssertErrorContains(t *testing.T, err error, substring string, message string) {
	t.Helper()
	if err == nil {
		t.Errorf("%s: expected error containing '%s', got nil", message, substring)
		return
	}
	if !strings.Contains(err.Error(), substring) {
		t.Errorf("%s: expected error to contain '%s', got '%s'", message, substring, err.Error())
	}
}

// AssertHttpStatus checks HTTP status code with detailed error message
func AssertHttpStatus(t *testing.T, expected, actual int, testName, responseBody string) {
	t.Helper()
	if expected != actual {
		t.Errorf("Test '%s' failed: expected status %d, got %d. Response: %s",
			testName, expected, actual, responseBody)
	}
}

// TestConfig holds configuration for test execution
type TestConfig struct {
	DatabaseURL    string
	EnableParallel bool
	CleanupTables  bool
	LogLevel       string
}

// LoadTestConfig loads test configuration from environment variables
func LoadTestConfig() *TestConfig {
	return &TestConfig{
		DatabaseURL:    getEnvOrDefault("TEST_DATABASE_URL", "postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable"),
		EnableParallel: getEnvBoolOrDefault("TEST_PARALLEL", false),
		CleanupTables:  getEnvBoolOrDefault("TEST_CLEANUP", true),
		LogLevel:       getEnvOrDefault("TEST_LOG_LEVEL", "warn"),
	}
}

// getEnvOrDefault returns environment variable value or default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvBoolOrDefault returns environment variable as bool or default if not set
func getEnvBoolOrDefault(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		switch value {
		case "true", "1", "yes":
			return true
		case "false", "0", "no":
			return false
		}
	}
	return defaultValue
}

// CreateTestUserWithCredentials creates a test user and returns both the user and plain password
// This is useful for tests that need to know the plain password for login
func (td *TestDatabase) CreateTestUserWithCredentials(t TestingInterface, username, email, plainPassword string) (*User, string) {
	ctx := context.Background()
	queries := models.New(td.Pool)

	// Make username and email unique to avoid conflicts
	uniqueUsername := generateUniqueUsername(username)
	uniqueEmail := generateUniqueEmail(email)

	user := &User{
		Username: uniqueUsername,
		Email:    uniqueEmail,
		Password: plainPassword,
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
	}, plainPassword
}
