package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Compile-time verification that BotPreventionService satisfies the interface.
var _ core.BotPreventionServiceInterface = (*BotPreventionService)(nil)

// BotPreventionService handles bot prevention mechanisms.
//
// Configuration arrives via core.BotPreventionConfig rather than being read
// from the environment in the constructor, so the checks can be exercised at
// any threshold without mutating process state.
type BotPreventionService struct {
	DB     *pgxpool.Pool
	Config core.BotPreventionConfig

	// IsDevelopment skips the rate-limit checks so E2E runs can register
	// repeatedly against a shared database.
	IsDevelopment bool

	// HTTPClient performs hCaptcha verification. Defaults to a client bounded
	// by Config.HCaptchaTimeout when nil.
	HTTPClient *http.Client

	// disposableAllowlist is the normalized form of
	// Config.DisposableEmailAllowlist, built once at construction.
	disposableAllowlist map[string]bool
}

// NewBotPreventionService creates a bot prevention service from configuration.
func NewBotPreventionService(pool *pgxpool.Pool, cfg *core.Config) *BotPreventionService {
	botCfg := cfg.BotPrevention

	timeout := botCfg.HCaptchaTimeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}

	allowlist := make(map[string]bool, len(botCfg.DisposableEmailAllowlist))
	for _, domain := range botCfg.DisposableEmailAllowlist {
		if trimmed := strings.ToLower(strings.TrimSpace(domain)); trimmed != "" {
			allowlist[trimmed] = true
		}
	}

	return &BotPreventionService{
		DB:                  pool,
		Config:              botCfg,
		IsDevelopment:       cfg.IsDevelopment(),
		HTTPClient:          &http.Client{Timeout: timeout},
		disposableAllowlist: allowlist,
	}
}

// logAttempt records a registration attempt. Failures are deliberately
// swallowed: a logging error must not turn a decided check into a 500. The
// one exception is the rate-limit counters, which read these same rows -- a
// dropped write there only ever loosens a limit, never tightens it.
func (s *BotPreventionService) logAttempt(ctx context.Context, req *core.RegistrationCheckRequest, captchaPassed, honeypot bool, reason string, successful bool) {
	queries := db.New(s.DB)
	_, _ = queries.CreateRegistrationAttempt(ctx, db.CreateRegistrationAttemptParams{
		Email:             req.Email,
		Username:          req.Username,
		IpAddress:         req.IPAddress,
		UserAgent:         pgtype.Text{String: req.UserAgent, Valid: req.UserAgent != ""},
		CaptchaPassed:     captchaPassed,
		HoneypotTriggered: honeypot,
		BlockedReason:     pgtype.Text{String: reason, Valid: reason != ""},
		Successful:        successful,
	})
}

// CheckRegistrationAttempt performs all bot prevention checks.
func (s *BotPreventionService) CheckRegistrationAttempt(ctx context.Context, req *core.RegistrationCheckRequest) (*core.RegistrationCheckResult, error) {
	queries := db.New(s.DB)

	result := &core.RegistrationCheckResult{
		Allowed: true,
	}

	// 1. Honeypot check (must be empty)
	if req.HoneypotValue != "" {
		result.Allowed = false
		result.BlockedReason = core.BlockReasonHoneypot
		result.HoneypotFailed = true
		s.logAttempt(ctx, req, false, true, core.BlockReasonHoneypot, false)
		return result, nil
	}

	// 2. hCaptcha verification (if enabled)
	if s.Config.HCaptchaEnabled {
		captchaPassed, err := s.VerifyHCaptcha(ctx, req.HCaptchaToken, req.IPAddress)
		if err != nil {
			return nil, fmt.Errorf("failed to verify hCaptcha: %w", err)
		}

		result.CaptchaPassed = captchaPassed

		if !captchaPassed {
			result.Allowed = false
			result.BlockedReason = core.BlockReasonCaptchaFailed
			s.logAttempt(ctx, req, false, false, core.BlockReasonCaptchaFailed, false)
			return result, nil
		}
	} else {
		result.CaptchaPassed = true // No captcha configured
	}

	// 3. Rate limiting by IP - Skip in development
	if !s.IsDevelopment {
		oneHourAgo := time.Now().Add(-1 * time.Hour)
		ipAttempts, err := queries.CountRecentRegistrationAttemptsByIP(ctx, db.CountRecentRegistrationAttemptsByIPParams{
			IpAddress: req.IPAddress,
			CreatedAt: pgtype.Timestamptz{Time: oneHourAgo, Valid: true},
		})
		if err != nil {
			return nil, fmt.Errorf("failed to count IP attempts: %w", err)
		}

		if ipAttempts >= int64(s.Config.IPAttemptLimit) {
			result.Allowed = false
			result.BlockedReason = core.BlockReasonRateLimitIP
			s.logAttempt(ctx, req, result.CaptchaPassed, false, core.BlockReasonRateLimitIP, false)
			return result, nil
		}
	}

	// 4. Rate limiting by email - Skip in development
	if !s.IsDevelopment {
		oneDayAgo := time.Now().Add(-24 * time.Hour)
		emailAttempts, err := queries.CountRecentRegistrationAttemptsByEmail(ctx, db.CountRecentRegistrationAttemptsByEmailParams{
			Email:     req.Email,
			CreatedAt: pgtype.Timestamptz{Time: oneDayAgo, Valid: true},
		})
		if err != nil {
			return nil, fmt.Errorf("failed to count email attempts: %w", err)
		}

		if emailAttempts >= int64(s.Config.EmailAttemptLimit) {
			result.Allowed = false
			result.BlockedReason = core.BlockReasonRateLimitEmail
			s.logAttempt(ctx, req, result.CaptchaPassed, false, core.BlockReasonRateLimitEmail, false)
			return result, nil
		}
	}

	// 5. Disposable email detection
	if s.Config.BlockDisposableEmails && s.IsDisposableEmail(req.Email) {
		result.Allowed = false
		result.BlockedReason = core.BlockReasonDisposableEmail
		s.logAttempt(ctx, req, result.CaptchaPassed, false, core.BlockReasonDisposableEmail, false)
		return result, nil
	}

	// 6. Spammy username detection
	if s.Config.BlockSpammyUsernames && IsSpammyUsername(req.Username) {
		result.Allowed = false
		result.BlockedReason = core.BlockReasonSpammyUsername
		s.logAttempt(ctx, req, result.CaptchaPassed, false, core.BlockReasonSpammyUsername, false)
		return result, nil
	}

	// All checks passed - log the attempt as pending (not successful yet, user
	// not created). This is important for rate limiting to work correctly.
	s.logAttempt(ctx, req, result.CaptchaPassed, false, "", false)

	return result, nil
}

// LogSuccessfulRegistration logs a successful registration attempt.
func (s *BotPreventionService) LogSuccessfulRegistration(ctx context.Context, req *core.RegistrationCheckRequest) error {
	queries := db.New(s.DB)

	_, err := queries.CreateRegistrationAttempt(ctx, db.CreateRegistrationAttemptParams{
		Email:             req.Email,
		Username:          req.Username,
		IpAddress:         req.IPAddress,
		UserAgent:         pgtype.Text{String: req.UserAgent, Valid: req.UserAgent != ""},
		CaptchaPassed:     true,
		HoneypotTriggered: false,
		BlockedReason:     pgtype.Text{Valid: false},
		Successful:        true,
	})

	return err
}

// VerifyHCaptcha verifies an hCaptcha token.
//
// The request carries ctx and runs on a timeout-bounded client so a hung
// hcaptcha.com cannot stall registration.
func (s *BotPreventionService) VerifyHCaptcha(ctx context.Context, token string, remoteIP string) (bool, error) {
	if token == "" {
		return false, nil
	}

	data := url.Values{}
	data.Set("secret", s.Config.HCaptchaSecret)
	data.Set("response", token)
	data.Set("remoteip", remoteIP)

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://hcaptcha.com/siteverify", strings.NewReader(data.Encode()))
	if err != nil {
		return false, fmt.Errorf("failed to build hCaptcha verification request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := s.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		return false, fmt.Errorf("failed to send hCaptcha verification request: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Success bool `json:"success"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, fmt.Errorf("failed to decode hCaptcha response: %w", err)
	}

	return result.Success, nil
}

// CleanupOldRegistrationAttempts removes registration attempts older than 90 days.
func (s *BotPreventionService) CleanupOldRegistrationAttempts(ctx context.Context) error {
	queries := db.New(s.DB)
	ninetyDaysAgo := time.Now().Add(-90 * 24 * time.Hour)
	return queries.DeleteOldRegistrationAttempts(ctx, pgtype.Timestamptz{Time: ninetyDaysAgo, Valid: true})
}
