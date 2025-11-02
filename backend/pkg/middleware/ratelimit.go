package middleware

import (
	"net/http"
	"time"

	"github.com/didip/tollbooth/v7"
	"github.com/didip/tollbooth/v7/limiter"
)

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	RequestsPerSecond float64
	Burst             int
	TTL               time.Duration
	IPLookups         []string
}

// DefaultRateLimitConfig returns sensible defaults for rate limiting
func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerSecond: 5.0,              // 5 requests per second
		Burst:             10,               // Allow bursts of 10
		TTL:               60 * time.Minute, // Clean up old entries after 1 hour
		IPLookups:         []string{"X-Real-IP", "X-Forwarded-For", "RemoteAddr"},
	}
}

// RateLimitMiddleware creates a rate limiting middleware with custom config
func RateLimitMiddleware(config RateLimitConfig) func(http.Handler) http.Handler {
	lmt := tollbooth.NewLimiter(config.RequestsPerSecond, &limiter.ExpirableOptions{
		DefaultExpirationTTL: config.TTL,
	})

	// Set burst size
	lmt.SetBurst(config.Burst)

	// Configure IP lookup methods
	lmt.SetIPLookups(config.IPLookups)

	// Custom error message
	lmt.SetMessage(`{"error": "Rate limit exceeded. Please try again later."}`)
	lmt.SetMessageContentType("application/json")

	return func(next http.Handler) http.Handler {
		return tollbooth.LimitHandler(lmt, next)
	}
}

// StrictRateLimit creates a strict rate limiter for sensitive endpoints
// (e.g., registration, password reset, login)
func StrictRateLimit() func(http.Handler) http.Handler {
	return RateLimitMiddleware(RateLimitConfig{
		RequestsPerSecond: 0.1, // 1 request per 10 seconds
		Burst:             3,   // Allow small burst of 3
		TTL:               60 * time.Minute,
		IPLookups:         []string{"X-Real-IP", "X-Forwarded-For", "RemoteAddr"},
	})
}

// ModerateRateLimit creates a moderate rate limiter for standard endpoints
// (e.g., API endpoints, form submissions)
func ModerateRateLimit() func(http.Handler) http.Handler {
	return RateLimitMiddleware(RateLimitConfig{
		RequestsPerSecond: 1.0, // 1 request per second
		Burst:             5,   // Allow burst of 5
		TTL:               30 * time.Minute,
		IPLookups:         []string{"X-Real-IP", "X-Forwarded-For", "RemoteAddr"},
	})
}

// LenientRateLimit creates a lenient rate limiter for general endpoints
// (e.g., public pages, search)
func LenientRateLimit() func(http.Handler) http.Handler {
	return RateLimitMiddleware(DefaultRateLimitConfig())
}
