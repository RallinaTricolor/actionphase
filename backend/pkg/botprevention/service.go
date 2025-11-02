package botprevention

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
)

// Compile-time verification that BotPreventionService implements BotPreventionServiceInterface
var _ core.BotPreventionServiceInterface = (*BotPreventionService)(nil)

// BotPreventionService implements BotPreventionServiceInterface
type BotPreventionService struct {
	db                          *pgxpool.Pool
	maxRegistrationsPerIPPer24h int
	blockDisposableEmails       bool
	disposableEmailDomains      map[string]bool
	spammyUsernamePatterns      []*regexp.Regexp
}

// NewBotPreventionService creates a new BotPreventionService instance
func NewBotPreventionService(db *pgxpool.Pool, maxRegistrationsPerIPPer24h int, blockDisposableEmails bool) *BotPreventionService {
	service := &BotPreventionService{
		db:                          db,
		maxRegistrationsPerIPPer24h: maxRegistrationsPerIPPer24h,
		blockDisposableEmails:       blockDisposableEmails,
		disposableEmailDomains:      loadDisposableEmailDomains(),
		spammyUsernamePatterns:      compileSpammyUsernamePatterns(),
	}

	return service
}

// CheckRegistrationAllowed validates if registration should proceed
// Returns error with specific reason if registration should be blocked
func (s *BotPreventionService) CheckRegistrationAllowed(ctx context.Context, req *core.RegistrationCheck) error {
	// Check disposable email domains
	if s.blockDisposableEmails && s.IsDisposableEmail(req.Email) {
		return fmt.Errorf("disposable email addresses are not allowed")
	}

	// Check spammy username patterns
	if s.IsSpammyUsername(req.Username) {
		return fmt.Errorf("username contains prohibited patterns")
	}

	// Check IP-based registration limits
	if err := s.checkIPRateLimit(ctx, req.IPAddress); err != nil {
		return err
	}

	return nil
}

// checkIPRateLimit checks if IP has exceeded registration limits
func (s *BotPreventionService) checkIPRateLimit(ctx context.Context, ipAddress string) error {
	// Count registrations from this IP in last 24 hours
	query := `
		SELECT COUNT(*)
		FROM registration_attempts
		WHERE ip_address = $1
		  AND created_at > NOW() - INTERVAL '24 hours'
		  AND successful = TRUE
	`

	var count int
	err := s.db.QueryRow(ctx, query, ipAddress).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check IP rate limit: %w", err)
	}

	if count >= s.maxRegistrationsPerIPPer24h {
		return fmt.Errorf("too many registrations from this IP address. Please try again later")
	}

	return nil
}

// RecordRegistrationAttempt logs a registration attempt for analytics
func (s *BotPreventionService) RecordRegistrationAttempt(ctx context.Context, req *core.RegistrationAttempt) error {
	query := `
		INSERT INTO registration_attempts (
			id, email, username, ip_address, user_agent,
			captcha_passed, honeypot_triggered, blocked_reason,
			successful, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`

	_, err := s.db.Exec(ctx, query,
		uuid.New(),
		req.Email,
		req.Username,
		req.IPAddress,
		req.UserAgent,
		req.CaptchaPassed,
		req.HoneypotTriggered,
		req.BlockedReason,
		req.Successful,
		time.Now(),
	)

	if err != nil {
		return fmt.Errorf("failed to record registration attempt: %w", err)
	}

	return nil
}

// IsDisposableEmail checks if email domain is in disposable list
func (s *BotPreventionService) IsDisposableEmail(email string) bool {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return false // Invalid email format
	}

	domain := strings.ToLower(parts[1])
	return s.disposableEmailDomains[domain]
}

// IsSpammyUsername checks if username contains spam patterns
func (s *BotPreventionService) IsSpammyUsername(username string) bool {
	lowerUsername := strings.ToLower(username)

	for _, pattern := range s.spammyUsernamePatterns {
		if pattern.MatchString(lowerUsername) {
			return true
		}
	}

	return false
}

// loadDisposableEmailDomains loads a list of known disposable email domains
// In production, this could be loaded from a database or external service
func loadDisposableEmailDomains() map[string]bool {
	domains := map[string]bool{
		// Common disposable email providers
		"tempmail.com":           true,
		"guerrillamail.com":      true,
		"10minutemail.com":       true,
		"mailinator.com":         true,
		"throwaway.email":        true,
		"trashmail.com":          true,
		"temp-mail.org":          true,
		"getnada.com":            true,
		"sharklasers.com":        true,
		"yopmail.com":            true,
		"maildrop.cc":            true,
		"fakeinbox.com":          true,
		"mintemail.com":          true,
		"mytemp.email":           true,
		"tempinbox.com":          true,
		"dispostable.com":        true,
		"throwawaymail.com":      true,
		"mohmal.com":             true,
		"emailondeck.com":        true,
		"guerrillamailblock.com": true,
		"spam4.me":               true,
		"mailcatch.com":          true,
		"getairmail.com":         true,
		"harakirimail.com":       true,
		"tmpeml.info":            true,
	}

	return domains
}

// compileSpammyUsernamePatterns returns regex patterns for detecting spammy usernames
func compileSpammyUsernamePatterns() []*regexp.Regexp {
	patterns := []string{
		// Bitcoin/crypto spam
		`bitcoin`,
		`crypto`,
		`\bbtc\b`,
		`\beth\b`,
		// Viagra/pharma spam
		`viagra`,
		`cialis`,
		`pharmacy`,
		// Casino/gambling spam
		`casino`,
		`poker`,
		`betting`,
		// SEO/marketing spam
		`\bseo\b`,
		`backlink`,
		`marketing`,
		// Generic spam patterns
		`\badmin\b`,
		`\btest\d+\b`,
		`\bbot\d*\b`,
		`\bspam\b`,
		// Excessive numbers (e.g., user12345678)
		`\d{6,}`,
		// Excessive repeating characters
		`(.)\1{5,}`,
	}

	var compiled []*regexp.Regexp
	for _, pattern := range patterns {
		re, err := regexp.Compile(pattern)
		if err == nil {
			compiled = append(compiled, re)
		}
	}

	return compiled
}

// NewBotPreventionServiceFromEnv creates BotPreventionService from environment variables
func NewBotPreventionServiceFromEnv(db *pgxpool.Pool) *BotPreventionService {
	maxRegistrations := 5 // Default
	if val := os.Getenv("MAX_REGISTRATIONS_PER_IP_PER_DAY"); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil {
			maxRegistrations = parsed
		}
	}

	blockDisposable := os.Getenv("BLOCK_DISPOSABLE_EMAILS") != "false" // Default to true

	return NewBotPreventionService(db, maxRegistrations, blockDisposable)
}
