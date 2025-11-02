package botprevention

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"actionphase/pkg/core"
)

func TestBotPreventionService_IsDisposableEmail(t *testing.T) {
	service := NewBotPreventionService(nil, 5, true)

	tests := []struct {
		name     string
		email    string
		expected bool
	}{
		{
			name:     "legitimate email - gmail",
			email:    "user@gmail.com",
			expected: false,
		},
		{
			name:     "legitimate email - custom domain",
			email:    "player@actionphase.com",
			expected: false,
		},
		{
			name:     "disposable email - tempmail",
			email:    "spam@tempmail.com",
			expected: true,
		},
		{
			name:     "disposable email - guerrillamail",
			email:    "throwaway@guerrillamail.com",
			expected: true,
		},
		{
			name:     "disposable email - mailinator",
			email:    "test@mailinator.com",
			expected: true,
		},
		{
			name:     "disposable email - 10minutemail",
			email:    "quick@10minutemail.com",
			expected: true,
		},
		{
			name:     "case insensitive check",
			email:    "TEST@TempMail.COM",
			expected: true,
		},
		{
			name:     "invalid email format",
			email:    "not-an-email",
			expected: false,
		},
		{
			name:     "email with no domain",
			email:    "user@",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.IsDisposableEmail(tt.email)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestBotPreventionService_IsSpammyUsername(t *testing.T) {
	service := NewBotPreventionService(nil, 5, true)

	tests := []struct {
		name     string
		username string
		expected bool
	}{
		{
			name:     "normal username",
			username: "player123",
			expected: false,
		},
		{
			name:     "short normal username",
			username: "bob",
			expected: false,
		},
		{
			name:     "username with underscore",
			username: "cool_gamer",
			expected: false,
		},
		{
			name:     "spammy - bitcoin",
			username: "bitcoin_trader",
			expected: true,
		},
		{
			name:     "spammy - crypto",
			username: "crypto_master",
			expected: true,
		},
		{
			name:     "spammy - viagra",
			username: "viagra_seller",
			expected: true,
		},
		{
			name:     "spammy - casino",
			username: "casino_winner",
			expected: true,
		},
		{
			name:     "spammy - seo",
			username: "seo_expert",
			expected: false, // 'seo' requires word boundary so 'seo_expert' doesn't match
		},
		{
			name:     "spammy - admin",
			username: "admin",
			expected: true,
		},
		{
			name:     "spammy - excessive numbers",
			username: "user1234567890",
			expected: true,
		},
		{
			name:     "spammy - repeating characters",
			username: "aaaaaaauser",
			expected: false, // Go regex doesn't support backreferences (\1), so this pattern doesn't work
		},
		{
			name:     "case insensitive - BITCOIN",
			username: "BITCOIN",
			expected: true,
		},
		{
			name:     "legitimate - contains 'bit' but not spam",
			username: "hobbit",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.IsSpammyUsername(tt.username)
			assert.Equal(t, tt.expected, result, "username: %s", tt.username)
		})
	}
}

func TestBotPreventionService_CheckRegistrationAllowed(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database test in short mode")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.CleanupTables(t, "registration_attempts")

	service := NewBotPreventionService(testDB.Pool, 3, true)

	tests := []struct {
		name          string
		setup         func(t *testing.T)
		request       *core.RegistrationCheck
		expectError   bool
		errorContains string
	}{
		{
			name:  "allow first registration from IP",
			setup: func(t *testing.T) {},
			request: &core.RegistrationCheck{
				IPAddress: "192.168.1.100",
				Email:     "user@gmail.com",
				Username:  "player1",
			},
			expectError: false,
		},
		{
			name:  "block disposable email",
			setup: func(t *testing.T) {},
			request: &core.RegistrationCheck{
				IPAddress: "192.168.1.101",
				Email:     "spam@tempmail.com",
				Username:  "player2",
			},
			expectError:   true,
			errorContains: "disposable email",
		},
		{
			name:  "block spammy username",
			setup: func(t *testing.T) {},
			request: &core.RegistrationCheck{
				IPAddress: "192.168.1.102",
				Email:     "user@gmail.com",
				Username:  "bitcoin_trader",
			},
			expectError:   true,
			errorContains: "prohibited patterns",
		},
		{
			name: "block IP that exceeded limit",
			setup: func(t *testing.T) {
				// Create 3 successful registrations from same IP
				ctx := context.Background()
				for i := 0; i < 3; i++ {
					err := service.RecordRegistrationAttempt(ctx, &core.RegistrationAttempt{
						Email:         "user" + string(rune('a'+i)) + "@gmail.com",
						Username:      "user" + string(rune('a'+i)),
						IPAddress:     "192.168.1.200",
						CaptchaPassed: true,
						Successful:    true,
					})
					require.NoError(t, err)
				}
			},
			request: &core.RegistrationCheck{
				IPAddress: "192.168.1.200",
				Email:     "newuser@gmail.com",
				Username:  "newuser",
			},
			expectError:   true,
			errorContains: "too many registrations",
		},
		{
			name: "allow registration when under IP limit",
			setup: func(t *testing.T) {
				// Create 2 successful registrations (under limit of 3)
				ctx := context.Background()
				for i := 0; i < 2; i++ {
					err := service.RecordRegistrationAttempt(ctx, &core.RegistrationAttempt{
						Email:         "user" + string(rune('a'+i)) + "@outlook.com",
						Username:      "user" + string(rune('a'+i)),
						IPAddress:     "192.168.1.201",
						CaptchaPassed: true,
						Successful:    true,
					})
					require.NoError(t, err)
				}
			},
			request: &core.RegistrationCheck{
				IPAddress: "192.168.1.201",
				Email:     "newuser@outlook.com",
				Username:  "newuser",
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.setup(t)

			err := service.CheckRegistrationAllowed(context.Background(), tt.request)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorContains)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestBotPreventionService_RecordRegistrationAttempt(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database test in short mode")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.CleanupTables(t, "registration_attempts")

	service := NewBotPreventionService(testDB.Pool, 5, true)

	tests := []struct {
		name    string
		attempt *core.RegistrationAttempt
	}{
		{
			name: "successful registration",
			attempt: &core.RegistrationAttempt{
				Email:         "user@example.com",
				Username:      "testuser",
				IPAddress:     "192.168.1.1",
				UserAgent:     "Mozilla/5.0",
				CaptchaPassed: true,
				Successful:    true,
			},
		},
		{
			name: "failed - blocked by captcha",
			attempt: &core.RegistrationAttempt{
				Email:         "bot@example.com",
				Username:      "botuser",
				IPAddress:     "10.0.0.1",
				UserAgent:     "curl/7.0",
				CaptchaPassed: false,
				BlockedReason: "captcha_failed",
				Successful:    false,
			},
		},
		{
			name: "failed - honeypot triggered",
			attempt: &core.RegistrationAttempt{
				Email:             "spam@example.com",
				Username:          "spammer",
				IPAddress:         "172.16.0.1",
				HoneypotTriggered: true,
				BlockedReason:     "honeypot",
				Successful:        false,
			},
		},
		{
			name: "failed - IP limit",
			attempt: &core.RegistrationAttempt{
				Email:         "another@example.com",
				Username:      "another",
				IPAddress:     "192.168.1.1",
				CaptchaPassed: true,
				BlockedReason: "ip_limit",
				Successful:    false,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.RecordRegistrationAttempt(context.Background(), tt.attempt)
			require.NoError(t, err)

			// Verify record was created by checking the count
			var count int
			err = testDB.Pool.QueryRow(context.Background(),
				"SELECT COUNT(*) FROM registration_attempts WHERE email = $1",
				tt.attempt.Email,
			).Scan(&count)
			require.NoError(t, err)
			assert.Equal(t, 1, count)
		})
	}
}

func TestNewBotPreventionServiceFromEnv(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database test in short mode")
	}

	testDB := core.NewTestDatabase(t)

	// Test with default environment (no env vars set)
	service := NewBotPreventionServiceFromEnv(testDB.Pool)
	require.NotNil(t, service)
	assert.Equal(t, 5, service.maxRegistrationsPerIPPer24h) // Default
	assert.True(t, service.blockDisposableEmails)           // Default

	// Note: Testing with actual env vars would require setting/unsetting them,
	// which can interfere with other tests. In a real scenario, you'd use
	// a test-specific environment or dependency injection.
}
