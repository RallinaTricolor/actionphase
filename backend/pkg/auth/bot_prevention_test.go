package auth

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// botPreventionTestConfig builds a config with production-like thresholds.
// Environment is deliberately not "development" -- the rate-limit checks are
// skipped there, which would make the rate-limit tests below vacuous.
func botPreventionTestConfig() *core.Config {
	return &core.Config{
		App: core.AppConfig{Environment: "test"},
		BotPrevention: core.BotPreventionConfig{
			HCaptchaEnabled:       false,
			IPAttemptLimit:        5,
			EmailAttemptLimit:     3,
			BlockDisposableEmails: true,
			BlockSpammyUsernames:  true,
		},
	}
}

func setupBotPreventionTest(t *testing.T) (*pgxpool.Pool, func()) {
	t.Helper()

	testDB := core.NewTestDatabase(t)

	// Clean up registration_attempts table
	_, err := testDB.Pool.Exec(context.Background(), "DELETE FROM registration_attempts")
	if err != nil {
		t.Fatalf("Failed to clean up registration_attempts: %v", err)
	}

	cleanup := func() {
		testDB.Close()
	}

	return testDB.Pool, cleanup
}

func TestBotPreventionService_HoneypotDetection(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping database test")
	}

	pool, cleanup := setupBotPreventionTest(t)
	defer cleanup()

	service := NewBotPreventionService(pool, botPreventionTestConfig())
	ctx := context.Background()

	// Test with honeypot triggered
	req := &core.RegistrationCheckRequest{
		Email:         "test@example.com",
		Username:      "testuser",
		IPAddress:     "192.168.1.1",
		UserAgent:     "Mozilla/5.0",
		HCaptchaToken: "",
		HoneypotValue: "bot-filled-this", // Honeypot triggered
	}

	result, err := service.CheckRegistrationAttempt(ctx, req)
	if err != nil {
		t.Fatalf("CheckRegistrationAttempt failed: %v", err)
	}

	if result.Allowed {
		t.Error("Expected registration to be blocked, but it was allowed")
	}

	if result.BlockedReason != "honeypot" {
		t.Errorf("Expected blocked reason 'honeypot', got '%s'", result.BlockedReason)
	}

	if !result.HoneypotFailed {
		t.Error("Expected HoneypotFailed to be true")
	}

	// Verify attempt was logged
	queries := db.New(pool)
	attempts, err := queries.CountRecentRegistrationAttemptsByEmail(ctx, db.CountRecentRegistrationAttemptsByEmailParams{
		Email:     req.Email,
		CreatedAt: pgtype.Timestamptz{Time: time.Now().Add(-1 * time.Hour), Valid: true},
	})
	if err != nil {
		t.Fatalf("Failed to count attempts: %v", err)
	}

	if attempts != 1 {
		t.Errorf("Expected 1 logged attempt, got %d", attempts)
	}
}

func TestBotPreventionService_IPRateLimiting(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping database test")
	}

	pool, cleanup := setupBotPreventionTest(t)
	defer cleanup()

	service := NewBotPreventionService(pool, botPreventionTestConfig())
	ctx := context.Background()
	ipAddress := "192.168.1.100"

	// Create 5 registration attempts from same IP
	for i := 0; i < 5; i++ {
		req := &core.RegistrationCheckRequest{
			Email:         "test" + string(rune('1'+i)) + "@example.com",
			Username:      "testuser" + string(rune('1'+i)),
			IPAddress:     ipAddress,
			UserAgent:     "Mozilla/5.0",
			HCaptchaToken: "",
			HoneypotValue: "",
		}

		result, err := service.CheckRegistrationAttempt(ctx, req)
		if err != nil {
			t.Fatalf("CheckRegistrationAttempt failed: %v", err)
		}

		if i < 4 {
			// First 4 attempts should be allowed
			if !result.Allowed {
				t.Errorf("Attempt %d should be allowed, but was blocked: %s", i+1, result.BlockedReason)
			}
		}
	}

	// 6th attempt should be blocked
	req := &core.RegistrationCheckRequest{
		Email:         "test6@example.com",
		Username:      "testuser6",
		IPAddress:     ipAddress,
		UserAgent:     "Mozilla/5.0",
		HCaptchaToken: "",
		HoneypotValue: "",
	}

	result, err := service.CheckRegistrationAttempt(ctx, req)
	if err != nil {
		t.Fatalf("CheckRegistrationAttempt failed: %v", err)
	}

	if result.Allowed {
		t.Error("Expected 6th attempt to be blocked by IP rate limit")
	}

	if result.BlockedReason != "rate_limit_ip" {
		t.Errorf("Expected blocked reason 'rate_limit_ip', got '%s'", result.BlockedReason)
	}
}

func TestBotPreventionService_EmailRateLimiting(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping database test")
	}

	pool, cleanup := setupBotPreventionTest(t)
	defer cleanup()

	service := NewBotPreventionService(pool, botPreventionTestConfig())
	ctx := context.Background()
	email := "test@example.com"

	// Create 3 registration attempts with same email
	for i := 0; i < 3; i++ {
		req := &core.RegistrationCheckRequest{
			Email:         email,
			Username:      "testuser" + string(rune('1'+i)),
			IPAddress:     "192.168.1." + string(rune('1'+i)),
			UserAgent:     "Mozilla/5.0",
			HCaptchaToken: "",
			HoneypotValue: "",
		}

		result, err := service.CheckRegistrationAttempt(ctx, req)
		if err != nil {
			t.Fatalf("CheckRegistrationAttempt failed: %v", err)
		}

		if i < 2 {
			// First 2 attempts should be allowed
			if !result.Allowed {
				t.Errorf("Attempt %d should be allowed, but was blocked: %s", i+1, result.BlockedReason)
			}
		}
	}

	// 4th attempt should be blocked
	req := &core.RegistrationCheckRequest{
		Email:         email,
		Username:      "testuser4",
		IPAddress:     "192.168.1.4",
		UserAgent:     "Mozilla/5.0",
		HCaptchaToken: "",
		HoneypotValue: "",
	}

	result, err := service.CheckRegistrationAttempt(ctx, req)
	if err != nil {
		t.Fatalf("CheckRegistrationAttempt failed: %v", err)
	}

	if result.Allowed {
		t.Error("Expected 4th attempt to be blocked by email rate limit")
	}

	if result.BlockedReason != "rate_limit_email" {
		t.Errorf("Expected blocked reason 'rate_limit_email', got '%s'", result.BlockedReason)
	}
}

func TestBotPreventionService_DisposableEmailDetection(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping database test")
	}

	pool, cleanup := setupBotPreventionTest(t)
	defer cleanup()

	service := NewBotPreventionService(pool, botPreventionTestConfig())
	ctx := context.Background()

	disposableEmails := []string{
		"test@temp-mail.org",
		"user@guerrillamail.com",
		"temp@10minutemail.com",
		"fake@mailinator.com",
		"throw@yopmail.com",
		// Mixed case must still block: the underlying list is all-lowercase
		// and does a bare map lookup, so normalization is our job.
		"bot@MAILINATOR.COM",
	}

	for i, email := range disposableEmails {
		req := &core.RegistrationCheckRequest{
			Email:         email,
			Username:      "testuser",
			IPAddress:     fmt.Sprintf("192.168.1.%d", i+10), // Use different IPs to avoid rate limiting
			UserAgent:     "Mozilla/5.0",
			HCaptchaToken: "",
			HoneypotValue: "",
		}

		result, err := service.CheckRegistrationAttempt(ctx, req)
		if err != nil {
			t.Fatalf("CheckRegistrationAttempt failed for %s: %v", email, err)
		}

		if result.Allowed {
			t.Errorf("Expected %s to be blocked as disposable email", email)
		}

		if result.BlockedReason != "disposable_email" {
			t.Errorf("Expected blocked reason 'disposable_email' for %s, got '%s'", email, result.BlockedReason)
		}
	}

	// Test with valid email (use different IP to avoid rate limiting from previous tests)
	req := &core.RegistrationCheckRequest{
		Email:         "user@gmail.com",
		Username:      "testuser",
		IPAddress:     "192.168.1.99",
		UserAgent:     "Mozilla/5.0",
		HCaptchaToken: "",
		HoneypotValue: "",
	}

	result, err := service.CheckRegistrationAttempt(ctx, req)
	if err != nil {
		t.Fatalf("CheckRegistrationAttempt failed: %v", err)
	}

	if !result.Allowed {
		t.Error("Expected gmail.com to be allowed")
	}
}

func TestBotPreventionService_AllChecksPass(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping database test")
	}

	pool, cleanup := setupBotPreventionTest(t)
	defer cleanup()

	service := NewBotPreventionService(pool, botPreventionTestConfig())
	ctx := context.Background()

	req := &core.RegistrationCheckRequest{
		Email:         "valid@gmail.com",
		Username:      "validuser",
		IPAddress:     "192.168.1.50",
		UserAgent:     "Mozilla/5.0",
		HCaptchaToken: "", // No captcha configured in test
		HoneypotValue: "", // Honeypot not triggered
	}

	result, err := service.CheckRegistrationAttempt(ctx, req)
	if err != nil {
		t.Fatalf("CheckRegistrationAttempt failed: %v", err)
	}

	if !result.Allowed {
		t.Errorf("Expected registration to be allowed, but was blocked: %s", result.BlockedReason)
	}

	if result.BlockedReason != "" {
		t.Errorf("Expected no blocked reason, got '%s'", result.BlockedReason)
	}

	if result.HoneypotFailed {
		t.Error("Expected HoneypotFailed to be false")
	}

	// CaptchaPassed should be true when captcha is not configured
	if !result.CaptchaPassed {
		t.Error("Expected CaptchaPassed to be true when captcha not configured")
	}
}

func TestBotPreventionService_LogSuccessfulRegistration(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping database test")
	}

	pool, cleanup := setupBotPreventionTest(t)
	defer cleanup()

	service := NewBotPreventionService(pool, botPreventionTestConfig())
	ctx := context.Background()

	req := &core.RegistrationCheckRequest{
		Email:         "success@example.com",
		Username:      "successuser",
		IPAddress:     "192.168.1.200",
		UserAgent:     "Mozilla/5.0",
		HCaptchaToken: "",
		HoneypotValue: "",
	}

	err := service.LogSuccessfulRegistration(ctx, req)
	if err != nil {
		t.Fatalf("LogSuccessfulRegistration failed: %v", err)
	}

	// Verify successful registration was logged
	queries := db.New(pool)
	attempt, err := queries.GetRecentSuccessfulRegistrationByIP(ctx, db.GetRecentSuccessfulRegistrationByIPParams{
		IpAddress: req.IPAddress,
		CreatedAt: pgtype.Timestamptz{Time: time.Now().Add(-1 * time.Minute), Valid: true},
	})
	if err != nil {
		t.Fatalf("Failed to get successful registration: %v", err)
	}

	if attempt.Email != req.Email {
		t.Errorf("Expected email %s, got %s", req.Email, attempt.Email)
	}

	if !attempt.Successful {
		t.Error("Expected successful flag to be true")
	}

	if attempt.CaptchaPassed != true {
		t.Error("Expected captcha_passed to be true for successful registration")
	}
}

func TestIsDisposableEmail(t *testing.T) {
	// No DB is touched: IsDisposableEmail is a pure lookup over the embedded
	// burner list plus the configured allowlist.
	service := &BotPreventionService{
		disposableAllowlist: map[string]bool{"allowed-by-operator.com": true},
	}

	tests := []struct {
		name         string
		email        string
		isDisposable bool
	}{
		{"known burner", "test@guerrillamail.com", true},
		{"known burner 2", "fake@10minutemail.com", true},
		{"known burner 3", "temp@mailinator.com", true},
		{"known burner 4", "user@temp-mail.org", true},

		// The upstream list is all-lowercase and looked up directly, so
		// without normalization one capital letter bypasses the whole check.
		{"uppercase domain", "bot@MAILINATOR.COM", true},
		{"mixed case domain", "bot@MailInator.com", true},
		{"whitespace padded", "bot@ mailinator.com ", true},

		// Real providers must never be blocked.
		{"gmail", "valid@gmail.com", false},
		{"outlook", "personal@outlook.com", false},
		{"proton", "user@proton.me", false},
		{"fastmail", "user@fastmail.com", false},
		{"icloud", "user@icloud.com", false},
		{"custom domain", "work@company.com", false},

		// RFC 2606 / RFC 6761 reserved names. The upstream list flags
		// example.com; this repo uses it in over a thousand fixtures and
		// tests, and no bot can read mail there anyway.
		{"example.com", "test_gm@example.com", false},
		{"example.com uppercase", "user@EXAMPLE.COM", false},
		{"example.org", "user@example.org", false},
		{"example.net", "user@example.net", false},
		{"dot test tld", "user@myhost.test", false},
		{"dot invalid tld", "user@foo.invalid", false},
		{"localhost", "user@localhost", false},

		// The operator allowlist overrides the blocklist, which is the only
		// recourse for an upstream false positive.
		{"allowlisted", "user@allowed-by-operator.com", false},

		// Malformed input stays fail-open, matching the pre-library behavior;
		// address validity is settled earlier by user.Validate. The library's
		// own IsBurnerEmail returns true for all of these.
		{"no at sign", "invalid-email", false},
		{"empty", "", false},
		{"empty domain", "user@", false},

		// The domain comes from the last "@", so an address whose local-part
		// legally contains one (RFC 5321 quoted form) is still checked rather
		// than skipped.
		{"quoted local part", `"a@b"@mailinator.com`, true},
		{"two at signs", "a@b@mailinator.com", true},
		{"two at signs not burner", "a@b@gmail.com", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := service.IsDisposableEmail(tt.email)
			if result != tt.isDisposable {
				t.Errorf("IsDisposableEmail(%q) = %v, want %v", tt.email, result, tt.isDisposable)
			}
		})
	}
}

func TestBotPreventionService_CleanupOldAttempts(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping database test")
	}

	pool, cleanup := setupBotPreventionTest(t)
	defer cleanup()

	service := NewBotPreventionService(pool, botPreventionTestConfig())
	ctx := context.Background()

	// Create a registration attempt
	req := &core.RegistrationCheckRequest{
		Email:         "cleanup@example.com",
		Username:      "cleanupuser",
		IPAddress:     "192.168.1.99",
		UserAgent:     "Mozilla/5.0",
		HCaptchaToken: "",
		HoneypotValue: "",
	}

	_, err := service.CheckRegistrationAttempt(ctx, req)
	if err != nil {
		t.Fatalf("CheckRegistrationAttempt failed: %v", err)
	}

	// Verify attempt was created
	queries := db.New(pool)
	countBefore, err := queries.CountRecentRegistrationAttemptsByEmail(ctx, db.CountRecentRegistrationAttemptsByEmailParams{
		Email:     req.Email,
		CreatedAt: pgtype.Timestamptz{Time: time.Now().Add(-1 * time.Hour), Valid: true},
	})
	if err != nil {
		t.Fatalf("Failed to count attempts: %v", err)
	}

	if countBefore != 1 {
		t.Errorf("Expected 1 attempt before cleanup, got %d", countBefore)
	}

	// Run cleanup (should not delete recent attempts)
	err = service.CleanupOldRegistrationAttempts(ctx)
	if err != nil {
		t.Fatalf("CleanupOldRegistrationAttempts failed: %v", err)
	}

	// Verify attempt still exists
	countAfter, err := queries.CountRecentRegistrationAttemptsByEmail(ctx, db.CountRecentRegistrationAttemptsByEmailParams{
		Email:     req.Email,
		CreatedAt: pgtype.Timestamptz{Time: time.Now().Add(-1 * time.Hour), Valid: true},
	})
	if err != nil {
		t.Fatalf("Failed to count attempts after cleanup: %v", err)
	}

	if countAfter != 1 {
		t.Errorf("Expected 1 attempt after cleanup (should not delete recent), got %d", countAfter)
	}
}
