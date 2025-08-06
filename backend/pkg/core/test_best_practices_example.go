package core

import (
	"testing"
	"time"

	"github.com/go-chi/jwtauth/v5"
)

// ExampleImprovedTest demonstrates best practices for test implementation
// This serves as a template for other tests to follow
func ExampleImprovedTest(t *testing.T) {
	// Enable parallel execution for faster CI/CD
	t.Parallel()

	testCases := []struct {
		name            string
		username        string
		password        string
		expectedStatus  int
		expectedMessage string
	}{
		{
			name:            "valid_credentials",
			username:        "testuser1",
			password:        "securepass123",
			expectedStatus:  200,
			expectedMessage: "",
		},
		{
			name:            "invalid_password",
			username:        "testuser2",
			password:        "wrongpassword",
			expectedStatus:  401,
			expectedMessage: "invalid credentials",
		},
		{
			name:            "nonexistent_user",
			username:        "nonexistent_user",
			password:        "anypassword",
			expectedStatus:  404,
			expectedMessage: "user not found",
		},
	}

	for _, tc := range testCases {
		tc := tc // Capture loop variable for parallel execution
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel() // Each subtest can run in parallel

			// Each subtest creates its own independent setup
			testDB := NewTestDatabase(t)
			defer testDB.Close()
			defer testDB.CleanupTables(t) // Clean up after this specific test

			// Create independent test data for each test
			if tc.expectedStatus == 200 {
				// Only create user for valid credential test
				_, _ = testDB.CreateTestUserWithCredentials(t, tc.username, tc.username+"@test.com", tc.password)
			}

			// Use enhanced assertion helpers
			if tc.expectedStatus == 401 {
				err := validateUserCredentials(tc.username, tc.password)
				AssertErrorContains(t, err, tc.expectedMessage, "Should return authentication error")
			}

			// Use HTTP status assertion helper
			// AssertHttpStatus(t, tc.expectedStatus, actualStatus, tc.name, responseBody)
		})
	}
}

// Example of proper test isolation - each test creates its own state
func ExampleTestIsolation(t *testing.T) {
	t.Parallel()

	t.Run("create_user", func(t *testing.T) {
		t.Parallel() // Enable parallel execution for this subtest

		// Each subtest gets its own database instance
		testDB := NewTestDatabase(t)
		defer testDB.Close()
		defer testDB.CleanupTables(t)

		// This test is completely independent
		user, _ := testDB.CreateTestUserWithCredentials(t, "isolated1", "isolated1@test.com", "pass123")
		AssertNotEqual(t, 0, user.ID, "User should have been created with valid ID")
	})

	t.Run("create_different_user", func(t *testing.T) {
		t.Parallel() // Enable parallel execution for this subtest

		// Each subtest gets its own database instance
		testDB := NewTestDatabase(t)
		defer testDB.Close()
		defer testDB.CleanupTables(t)

		// This test doesn't depend on the previous test
		user, _ := testDB.CreateTestUserWithCredentials(t, "isolated2", "isolated2@test.com", "pass456")
		AssertNotEqual(t, 0, user.ID, "User should have been created with valid ID")
	})
}

// Example of proper JWT token creation for testing
func ExampleCreateTestToken(username string, expiresIn time.Duration) (string, error) {
	tokenAuth := jwtauth.New("HS256", []byte("TEST_SECRET"), nil)

	claims := map[string]interface{}{
		"username": username,
		"exp":      time.Now().Add(expiresIn).Unix(),
		"iat":      time.Now().Unix(),
	}

	_, tokenString, err := tokenAuth.Encode(claims)
	return tokenString, err
}

// Dummy function for example purposes
func validateUserCredentials(username, password string) error {
	// This is just for example - real implementation would check credentials
	if password == "wrongpassword" {
		return &AuthenticationError{Message: "invalid credentials"}
	}
	if username == "nonexistent_user" {
		return &NotFoundError{Message: "user not found"}
	}
	return nil
}

// Example error types for better error testing
type AuthenticationError struct {
	Message string
}

func (e *AuthenticationError) Error() string {
	return e.Message
}

type NotFoundError struct {
	Message string
}

func (e *NotFoundError) Error() string {
	return e.Message
}

// Example benchmark test with proper setup
func BenchmarkUserCreation(b *testing.B) {
	testDB := NewTestDatabase(b)
	defer testDB.Close()
	defer testDB.CleanupTables(b)

	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		// Each benchmark iteration creates unique data
		username := "benchuser_" + string(rune(i))
		email := "bench_" + string(rune(i)) + "@test.com"
		_, _ = testDB.CreateTestUserWithCredentials(b, username, email, "benchpass")
	}
}

// Example of using test configuration
func ExampleConfigurableTest(t *testing.T) {
	config := LoadTestConfig()

	if config.EnableParallel {
		t.Parallel()
	}

	testDB := NewTestDatabase(t)
	defer testDB.Close()

	if config.CleanupTables {
		defer testDB.CleanupTables(t)
	}

	// Test logic here...
}
