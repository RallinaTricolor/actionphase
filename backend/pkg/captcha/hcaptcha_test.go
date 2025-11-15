package captcha

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHCaptchaService_Verify_Success(t *testing.T) {
	// Create mock hCaptcha server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request method
		assert.Equal(t, "POST", r.Method)

		// Verify content type
		assert.Equal(t, "application/x-www-form-urlencoded", r.Header.Get("Content-Type"))

		// Parse form data
		err := r.ParseForm()
		require.NoError(t, err)

		// Verify form fields
		assert.Equal(t, "test-secret", r.FormValue("secret"))
		assert.Equal(t, "valid-token", r.FormValue("response"))
		assert.Equal(t, "192.168.1.1", r.FormValue("remoteip"))

		// Return success response
		response := HCaptchaResponse{
			Success:     true,
			ChallengeTS: "2024-01-01T00:00:00Z",
			Hostname:    "example.com",
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	// Create service with custom HTTP client pointing to mock server
	service := &HCaptchaService{
		secretKey: "test-secret",
		enabled:   true,
		httpClient: &http.Client{
			Transport: &customTransport{server.URL},
		},
	}

	// Test verification
	valid, err := service.Verify(context.Background(), "valid-token", "192.168.1.1")
	require.NoError(t, err)
	assert.True(t, valid)
}

func TestHCaptchaService_Verify_Failure(t *testing.T) {
	// Create mock hCaptcha server that returns failure
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := HCaptchaResponse{
			Success:    false,
			ErrorCodes: []string{"invalid-input-response"},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	service := &HCaptchaService{
		secretKey: "test-secret",
		enabled:   true,
		httpClient: &http.Client{
			Transport: &customTransport{server.URL},
		},
	}

	valid, err := service.Verify(context.Background(), "invalid-token", "192.168.1.1")
	require.Error(t, err)
	assert.False(t, valid)
	assert.Contains(t, err.Error(), "hcaptcha verification failed")
}

func TestHCaptchaService_Verify_Disabled(t *testing.T) {
	// When CAPTCHA is disabled, should always return true
	service := NewHCaptchaService("test-secret", false)

	valid, err := service.Verify(context.Background(), "any-token", "192.168.1.1")
	require.NoError(t, err)
	assert.True(t, valid, "Should return true when CAPTCHA is disabled")
}

func TestHCaptchaService_Verify_EmptyToken(t *testing.T) {
	service := NewHCaptchaService("test-secret", true)

	valid, err := service.Verify(context.Background(), "", "192.168.1.1")
	require.Error(t, err)
	assert.False(t, valid)
	assert.Contains(t, err.Error(), "captcha token is required")
}

func TestHCaptchaService_Verify_WithoutRemoteIP(t *testing.T) {
	// Should still work without remote IP (it's optional)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		err := r.ParseForm()
		require.NoError(t, err)

		// Verify remoteip is not sent
		assert.Empty(t, r.FormValue("remoteip"))

		response := HCaptchaResponse{
			Success: true,
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	service := &HCaptchaService{
		secretKey: "test-secret",
		enabled:   true,
		httpClient: &http.Client{
			Transport: &customTransport{server.URL},
		},
	}

	valid, err := service.Verify(context.Background(), "valid-token", "")
	require.NoError(t, err)
	assert.True(t, valid)
}

func TestHCaptchaService_Verify_NetworkError(t *testing.T) {
	// Create service pointing to non-existent server
	service := &HCaptchaService{
		secretKey: "test-secret",
		enabled:   true,
		httpClient: &http.Client{
			Transport: &customTransport{"http://localhost:9999"},
		},
	}

	valid, err := service.Verify(context.Background(), "valid-token", "192.168.1.1")
	require.Error(t, err)
	assert.False(t, valid)
	assert.Contains(t, err.Error(), "failed to verify captcha")
}

func TestHCaptchaService_Verify_InvalidJSON(t *testing.T) {
	// Create mock server that returns invalid JSON
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("invalid json{"))
	}))
	defer server.Close()

	service := &HCaptchaService{
		secretKey: "test-secret",
		enabled:   true,
		httpClient: &http.Client{
			Transport: &customTransport{server.URL},
		},
	}

	valid, err := service.Verify(context.Background(), "valid-token", "192.168.1.1")
	require.Error(t, err)
	assert.False(t, valid)
	assert.Contains(t, err.Error(), "failed to parse hcaptcha response")
}

func TestHCaptchaService_Verify_MultipleErrorCodes(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := HCaptchaResponse{
			Success:    false,
			ErrorCodes: []string{"missing-input-secret", "invalid-input-response"},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	service := &HCaptchaService{
		secretKey: "test-secret",
		enabled:   true,
		httpClient: &http.Client{
			Transport: &customTransport{server.URL},
		},
	}

	valid, err := service.Verify(context.Background(), "token", "192.168.1.1")
	require.Error(t, err)
	assert.False(t, valid)
	assert.Contains(t, err.Error(), "missing-input-secret")
	assert.Contains(t, err.Error(), "invalid-input-response")
}

func TestNewHCaptchaService(t *testing.T) {
	service := NewHCaptchaService("my-secret-key", true)

	require.NotNil(t, service)
	assert.Equal(t, "my-secret-key", service.secretKey)
	assert.True(t, service.enabled)
	assert.NotNil(t, service.httpClient)
}

func TestNewHCaptchaServiceFromEnv(t *testing.T) {
	// Test with default environment (no env vars set)
	service := NewHCaptchaServiceFromEnv()

	require.NotNil(t, service)
	// Should have default enabled=true when env var not set
	assert.True(t, service.enabled)

	// Note: Testing with actual env vars would require setting/unsetting them,
	// which can interfere with other tests. In a real scenario, you'd use
	// a test-specific environment or dependency injection.
}

// customTransport is a test helper that redirects all requests to a test server
type customTransport struct {
	serverURL string
}

func (t *customTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Redirect request to test server
	req.URL.Scheme = "http"
	// Host will be set by Parse below

	// Parse server URL to get host
	req.URL, _ = req.URL.Parse(t.serverURL)

	return http.DefaultTransport.RoundTrip(req)
}
