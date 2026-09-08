package observability

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// corsHandler wraps a trivial handler in CORSMiddleware and records whether the
// wrapped handler was reached, which is what separates a pass-through from a
// short-circuited preflight.
func corsHandler(cfg CORSConfig) (http.Handler, *bool) {
	reached := false
	h := CORSMiddleware(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	}))
	return h, &reached
}

func TestCORSMiddlewareAllowList(t *testing.T) {
	cfg := CORSConfig{
		Enabled:        true,
		AllowedOrigins: []string{"http://localhost:5173", "*.example.com"},
	}

	tests := []struct {
		name       string
		origin     string
		wantOrigin string
	}{
		{
			name:       "exact match is echoed back",
			origin:     "http://localhost:5173",
			wantOrigin: "http://localhost:5173",
		},
		{
			name:       "wildcard matches a subdomain",
			origin:     "https://app.example.com",
			wantOrigin: "https://app.example.com",
		},
		{
			name:       "wildcard matches the bare domain",
			origin:     "https://example.com",
			wantOrigin: "https://example.com",
		},
		{
			name:       "wildcard does not match a suffix lookalike",
			origin:     "https://evilexample.com",
			wantOrigin: "",
		},
		{
			name:       "wildcard does not match the domain as a path",
			origin:     "https://evil.com/example.com",
			wantOrigin: "",
		},
		{
			name:       "unlisted origin gets no header",
			origin:     "https://attacker.test",
			wantOrigin: "",
		},
		{
			name:       "port mismatch is not a match",
			origin:     "http://localhost:3000",
			wantOrigin: "",
		},
		{
			name:       "same-origin request with no Origin gets no header",
			origin:     "",
			wantOrigin: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h, reached := corsHandler(cfg)

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tt.wantOrigin {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, tt.wantOrigin)
			}
			if !*reached {
				t.Error("non-preflight request did not reach the wrapped handler")
			}
			if got := rec.Header().Get("Vary"); got != "Origin" {
				t.Errorf("Vary = %q, want %q", got, "Origin")
			}
		})
	}
}

// TestCORSMiddlewareNeverEmitsWildcard pins the regression this middleware
// exists to fix: the previous implementation answered every request with
// Access-Control-Allow-Origin: *, regardless of configuration.
func TestCORSMiddlewareNeverEmitsWildcard(t *testing.T) {
	h, _ := corsHandler(CORSConfig{
		Enabled:        true,
		AllowedOrigins: []string{"http://localhost:5173"},
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://attacker.test")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got == "*" {
		t.Fatal("Access-Control-Allow-Origin is *, allow-list not enforced")
	}
}

// A literal "*" in the allow-list is still honoured, because an operator who
// configures it has opted into a fully public API -- but it is emitted verbatim
// rather than reflected, and carries no credentials. Reflecting the origin would
// pass a naive "did any origin get allowed?" check while silently removing the
// browser's guarantee that a public wildcard cannot carry credentials.
func TestCORSMiddlewareExplicitWildcardEntry(t *testing.T) {
	h, _ := corsHandler(CORSConfig{Enabled: true, AllowedOrigins: []string{"*"}})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://anything.test")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Access-Control-Allow-Origin = %q, want a literal %q", got, "*")
	}
	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf("Access-Control-Allow-Credentials = %q, want it absent alongside a wildcard", got)
	}
}

// The API authenticates with an HttpOnly jwt cookie and the frontend sends
// withCredentials, so a specifically-allowed origin must get Allow-Credentials
// or the browser drops the cookie on both the login response and every request
// after it.
func TestCORSMiddlewareAllowsCredentialsForSpecificOrigin(t *testing.T) {
	cfg := CORSConfig{
		Enabled:        true,
		AllowedOrigins: []string{"https://action-phase.com", "*.example.com"},
	}

	for _, origin := range []string{"https://action-phase.com", "https://app.example.com"} {
		t.Run(origin, func(t *testing.T) {
			h, _ := corsHandler(cfg)

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			req.Header.Set("Origin", origin)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != origin {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, origin)
			}
			if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
				t.Errorf("Access-Control-Allow-Credentials = %q, want %q", got, "true")
			}
		})
	}
}

// A denied origin must not get Allow-Credentials either.
func TestCORSMiddlewareNoCredentialsForDeniedOrigin(t *testing.T) {
	h, _ := corsHandler(CORSConfig{
		Enabled:        true,
		AllowedOrigins: []string{"https://action-phase.com"},
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://attacker.test")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Errorf("Access-Control-Allow-Credentials = %q, want it absent", got)
	}
}

func TestCORSMiddlewarePreflight(t *testing.T) {
	cfg := CORSConfig{Enabled: true, AllowedOrigins: []string{"http://localhost:5173"}}

	t.Run("allowed origin gets the full preflight response", func(t *testing.T) {
		h, reached := corsHandler(cfg)

		req := httptest.NewRequest(http.MethodOptions, "/test", nil)
		req.Header.Set("Origin", "http://localhost:5173")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
		}
		if *reached {
			t.Error("preflight reached the wrapped handler; it should short-circuit")
		}
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
			t.Errorf("Access-Control-Allow-Origin = %q, want the origin echoed", got)
		}
		for header, want := range map[string]string{
			"Access-Control-Allow-Methods":  "GET, POST, PUT, PATCH, DELETE, OPTIONS",
			"Access-Control-Allow-Headers":  "Content-Type, Authorization, X-Correlation-ID",
			"Access-Control-Expose-Headers": "X-Correlation-ID, X-Request-ID, X-Trace-ID",
		} {
			if got := rec.Header().Get(header); got != want {
				t.Errorf("%s = %q, want %q", header, got, want)
			}
		}
	})

	t.Run("disallowed origin is short-circuited without CORS headers", func(t *testing.T) {
		h, reached := corsHandler(cfg)

		req := httptest.NewRequest(http.MethodOptions, "/test", nil)
		req.Header.Set("Origin", "https://attacker.test")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if *reached {
			t.Error("preflight reached the wrapped handler; it should short-circuit")
		}
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("Access-Control-Allow-Origin = %q, want it absent", got)
		}
		if got := rec.Header().Get("Access-Control-Allow-Methods"); got != "" {
			t.Errorf("Access-Control-Allow-Methods = %q, want it absent", got)
		}
	})
}

// With CORS_ENABLED=false the middleware must be inert -- no headers at all, and
// OPTIONS passes through to whatever the router does with it.
func TestCORSMiddlewareDisabled(t *testing.T) {
	h, reached := corsHandler(CORSConfig{Enabled: false, AllowedOrigins: []string{"*"}})

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if !*reached {
		t.Error("disabled middleware short-circuited the request")
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want it absent", got)
	}
	if got := rec.Header().Get("Vary"); got != "" {
		t.Errorf("Vary = %q, want it absent", got)
	}
}

// An empty allow-list denies everything rather than falling open.
func TestCORSMiddlewareEmptyAllowList(t *testing.T) {
	h, _ := corsHandler(CORSConfig{Enabled: true})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want it absent", got)
	}
}
