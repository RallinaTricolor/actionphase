package captcha

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"actionphase/pkg/core"
)

// Compile-time verification that HCaptchaService implements CaptchaServiceInterface
var _ core.CaptchaServiceInterface = (*HCaptchaService)(nil)

const hcaptchaVerifyURL = "https://hcaptcha.com/siteverify"

// HCaptchaResponse represents the response from hCaptcha API
type HCaptchaResponse struct {
	Success     bool     `json:"success"`
	ChallengeTS string   `json:"challenge_ts"`
	Hostname    string   `json:"hostname"`
	ErrorCodes  []string `json:"error-codes"`
}

// HCaptchaService implements CaptchaServiceInterface for hCaptcha verification
type HCaptchaService struct {
	secretKey  string
	httpClient *http.Client
	enabled    bool
}

// NewHCaptchaService creates a new HCaptchaService instance
func NewHCaptchaService(secretKey string, enabled bool) *HCaptchaService {
	return &HCaptchaService{
		secretKey: secretKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		enabled: enabled,
	}
}

// Verify validates a CAPTCHA token with hCaptcha
// Returns true if token is valid, false otherwise
func (s *HCaptchaService) Verify(ctx context.Context, token, remoteIP string) (bool, error) {
	// If CAPTCHA is disabled (e.g., in development), always return true
	if !s.enabled {
		return true, nil
	}

	// Validate inputs
	if token == "" {
		return false, fmt.Errorf("captcha token is required")
	}

	// Prepare form data for hCaptcha API
	formData := url.Values{
		"secret":   {s.secretKey},
		"response": {token},
	}

	// Include remote IP if provided (optional but recommended)
	if remoteIP != "" {
		formData.Set("remoteip", remoteIP)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(
		ctx,
		"POST",
		hcaptchaVerifyURL,
		strings.NewReader(formData.Encode()),
	)
	if err != nil {
		return false, fmt.Errorf("failed to create hcaptcha request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	// Make request to hCaptcha API
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return false, fmt.Errorf("failed to verify captcha: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("failed to read hcaptcha response: %w", err)
	}

	// Parse JSON response
	var hcaptchaResp HCaptchaResponse
	if err := json.Unmarshal(body, &hcaptchaResp); err != nil {
		return false, fmt.Errorf("failed to parse hcaptcha response: %w", err)
	}

	// Check for errors from hCaptcha
	if !hcaptchaResp.Success {
		if len(hcaptchaResp.ErrorCodes) > 0 {
			return false, fmt.Errorf("hcaptcha verification failed: %v", hcaptchaResp.ErrorCodes)
		}
		return false, fmt.Errorf("hcaptcha verification failed")
	}

	return true, nil
}

// NewHCaptchaServiceFromEnv creates HCaptchaService from environment variables
func NewHCaptchaServiceFromEnv() *HCaptchaService {
	secretKey := os.Getenv("HCAPTCHA_SECRET")
	enabled := os.Getenv("HCAPTCHA_ENABLED") != "false" // Default to enabled

	return NewHCaptchaService(secretKey, enabled)
}
