package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	dbsvc "actionphase/pkg/db/services"

	"github.com/jackc/pgx/v5/pgconn"
)

// These tests exercise HumaRegister against a mocked bot-prevention service, so
// they run with no database at all -- the reason for extracting the interface.
// Before it, the handler built its own service from the pool mid-request and
// every one of these paths needed a live DB and real env vars.

// stubUserService is a local double covering the whole UserServiceInterface.
// core.MockUserService implements only a handful of methods and so cannot be
// assigned to the interface field.
type stubUserService struct {
	core.UserServiceInterface // nil embed: unused methods panic if ever called

	createUser         func(user *core.User) (*core.User, error)
	setPendingApproval func(ctx context.Context, userID int32) error

	setPendingApprovalCalls int
}

func (s *stubUserService) CreateUser(user *core.User) (*core.User, error) {
	if s.createUser != nil {
		return s.createUser(user)
	}
	user.ID = 1
	return user, nil
}

func (s *stubUserService) SetPendingApproval(ctx context.Context, userID int32) error {
	s.setPendingApprovalCalls++
	if s.setPendingApproval != nil {
		return s.setPendingApproval(ctx, userID)
	}
	return nil
}

// stubIPBanService and stubFingerprintBanService answer "not banned" so the
// register handler reaches the bot-prevention check.
type stubIPBanService struct{ core.IPBanServiceInterface }

func (s *stubIPBanService) IsIPBanned(context.Context, string) (bool, error) { return false, nil }

type stubFingerprintBanService struct {
	core.FingerprintBanServiceInterface
}

func (s *stubFingerprintBanService) IsFingerprintBanned(context.Context, string) (bool, error) {
	return false, nil
}

var _ core.UserServiceInterface = (*stubUserService)(nil)

func newRegisterTestHandler(t *testing.T, bot *core.MockBotPreventionService, users *stubUserService) *Handler {
	t.Helper()

	app := core.NewTestApp(nil)

	return &Handler{
		App:                   app,
		UserService:           users,
		IPBanService:          &stubIPBanService{},
		FingerprintBanService: &stubFingerprintBanService{},
		BotPreventionService:  bot,
	}
}

func postRegister(t *testing.T, h *Handler, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()

	b, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	serveAuthHuma(w, req, h)
	return w
}

func validRegistrationBody() map[string]any {
	return map[string]any{
		"username": "legituser",
		"email":    "legit@example.com",
		"password": "SuperSecret123!",
	}
}

// Each blocked reason must reach the user as its own message, except rate
// limiting, which must not be revealed (see notRateLimit below).
func TestHumaRegister_BlockedReasonMessages(t *testing.T) {
	tests := []struct {
		name        string
		reason      string
		wantContain string
	}{
		{"honeypot", core.BlockReasonHoneypot, "Invalid registration attempt detected"},
		{"captcha", core.BlockReasonCaptchaFailed, "CAPTCHA verification failed"},
		{"ip rate limit", core.BlockReasonRateLimitIP, genericRegistrationFailure},
		{"email rate limit", core.BlockReasonRateLimitEmail, genericRegistrationFailure},
		{"disposable email", core.BlockReasonDisposableEmail, "Disposable email addresses are not allowed"},
		{"spammy username", core.BlockReasonSpammyUsername, "This username is not allowed"},
		{"unknown reason", "something_new", "Registration not allowed at this time"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			users := &stubUserService{
				createUser: func(*core.User) (*core.User, error) {
					t.Fatal("CreateUser must not be called when registration is blocked")
					return nil, nil
				},
			}
			bot := &core.MockBotPreventionService{
				CheckRegistrationAttemptFunc: func(context.Context, *core.RegistrationCheckRequest) (*core.RegistrationCheckResult, error) {
					return &core.RegistrationCheckResult{Allowed: false, BlockedReason: tt.reason}, nil
				},
			}

			w := postRegister(t, newRegisterTestHandler(t, bot, users), validRegistrationBody())

			if w.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d (body: %s)", w.Code, http.StatusBadRequest, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), tt.wantContain) {
				t.Errorf("body = %s, want it to contain %q", w.Body.String(), tt.wantContain)
			}
			// Being told you hit the limit tells a bot how to pace itself, so
			// no blocked registration may mention it.
			for _, notRateLimit := range []string{"too many", "rate limit", "try again later"} {
				if strings.Contains(strings.ToLower(w.Body.String()), notRateLimit) {
					t.Errorf("body = %s, must not reveal rate limiting (%q)", w.Body.String(), notRateLimit)
				}
			}
		})
	}
}

// A bot-prevention failure is an infrastructure fault, not a bad request: it
// must not be reported to the client as though they did something wrong, and
// it must fail closed rather than letting the registration through unchecked.
func TestHumaRegister_BotPreventionErrorFailsClosed(t *testing.T) {
	users := &stubUserService{
		createUser: func(*core.User) (*core.User, error) {
			t.Fatal("CreateUser must not be called when the bot check errors")
			return nil, nil
		},
	}
	bot := &core.MockBotPreventionService{
		CheckRegistrationAttemptFunc: func(context.Context, *core.RegistrationCheckRequest) (*core.RegistrationCheckResult, error) {
			return nil, context.DeadlineExceeded
		},
	}

	w := postRegister(t, newRegisterTestHandler(t, bot, users), validRegistrationBody())

	if w.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d (body: %s)", w.Code, http.StatusInternalServerError, w.Body.String())
	}
}

// The registration data the checks act on must be the data actually submitted,
// including the honeypot and captcha fields that only exist for this purpose.
func TestHumaRegister_PassesSubmittedDataToBotCheck(t *testing.T) {
	var got *core.RegistrationCheckRequest
	bot := &core.MockBotPreventionService{
		CheckRegistrationAttemptFunc: func(_ context.Context, req *core.RegistrationCheckRequest) (*core.RegistrationCheckResult, error) {
			got = req
			return &core.RegistrationCheckResult{Allowed: false, BlockedReason: core.BlockReasonHoneypot}, nil
		},
	}

	body := validRegistrationBody()
	body["honeypot_value"] = "filled-by-bot"
	body["hcaptcha_token"] = "tok-123"

	postRegister(t, newRegisterTestHandler(t, bot, &stubUserService{}), body)

	if got == nil {
		t.Fatal("bot prevention was never called")
	}
	if got.Email != "legit@example.com" {
		t.Errorf("Email = %q, want %q", got.Email, "legit@example.com")
	}
	if got.Username != "legituser" {
		t.Errorf("Username = %q, want %q", got.Username, "legituser")
	}
	if got.HoneypotValue != "filled-by-bot" {
		t.Errorf("HoneypotValue = %q, want %q", got.HoneypotValue, "filled-by-bot")
	}
	if got.HCaptchaToken != "tok-123" {
		t.Errorf("HCaptchaToken = %q, want %q", got.HCaptchaToken, "tok-123")
	}
}

// Logging the success is bookkeeping. If it fails the account still exists, so
// failing the request would tell the user registration failed when it did not.
//
// Unlike the checks above, this one needs a database: the success path runs on
// to CreateToken, which persists a session. Only the assertion about the
// logging failure is unique to bot prevention.
func TestHumaRegister_LogFailureDoesNotFailRegistration(t *testing.T) {
	if os.Getenv("SKIP_DB_TESTS") == "true" {
		t.Skip("Skipping database test")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	bot := &core.MockBotPreventionService{
		LogSuccessfulRegistrationFunc: func(context.Context, *core.RegistrationCheckRequest) error {
			return context.DeadlineExceeded
		},
	}

	app := core.NewTestApp(testDB.Pool)
	h := &Handler{
		App:                   app,
		UserService:           &dbsvc.UserService{DB: testDB.Pool, Logger: app.ObsLogger},
		SessionService:        &dbsvc.SessionService{DB: testDB.Pool, Logger: app.ObsLogger},
		IPBanService:          &stubIPBanService{},
		FingerprintBanService: &stubFingerprintBanService{},
		BotPreventionService:  bot,
	}

	body := validRegistrationBody()
	body["username"] = "loguser"
	body["email"] = "loguser@example.com"

	w := postRegister(t, h, body)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Errorf("status = %d, want a success status (body: %s)", w.Code, w.Body.String())
	}
	if bot.LogSuccessfulRegistrationCalls != 1 {
		t.Errorf("LogSuccessfulRegistration calls = %d, want 1", bot.LogSuccessfulRegistrationCalls)
	}
}

// When approval is required the account is not yet usable, so it must not be
// recorded as a completed registration.
func TestHumaRegister_PendingApprovalSkipsSuccessLog(t *testing.T) {
	bot := &core.MockBotPreventionService{}
	users := &stubUserService{}

	h := newRegisterTestHandler(t, bot, users)
	h.App.Config.App.RequireRegistrationApproval = true

	w := postRegister(t, h, validRegistrationBody())

	if w.Code != http.StatusAccepted {
		t.Errorf("status = %d, want %d (body: %s)", w.Code, http.StatusAccepted, w.Body.String())
	}
	if users.setPendingApprovalCalls != 1 {
		t.Errorf("SetPendingApproval calls = %d, want 1", users.setPendingApprovalCalls)
	}
	if bot.LogSuccessfulRegistrationCalls != 0 {
		t.Errorf("LogSuccessfulRegistration calls = %d, want 0 -- the account is not usable yet", bot.LogSuccessfulRegistrationCalls)
	}
}

// Guard against the mock drifting out of sync with the real service.
var _ core.BotPreventionServiceInterface = (*BotPreventionService)(nil)
var _ = models.CreateRegistrationAttemptParams{}

// allowAllBot lets every registration through the bot check.
func allowAllBot() *core.MockBotPreventionService {
	return &core.MockBotPreventionService{
		CheckRegistrationAttemptFunc: func(context.Context, *core.RegistrationCheckRequest) (*core.RegistrationCheckResult, error) {
			return &core.RegistrationCheckResult{Allowed: true}, nil
		},
	}
}

// Regression: registration answered with go-playground's "Key: 'User.Password'
// Error:Field validation for 'Password' failed on the 'min' tag" and with
// "username: username must be at least 3 characters long". Every rejected
// field must come back as a sentence naming it.
func TestHumaRegister_ValidationMessagesAreSentences(t *testing.T) {
	users := &stubUserService{
		createUser: func(*core.User) (*core.User, error) {
			t.Fatal("CreateUser must not be called for an invalid registration")
			return nil, nil
		},
	}
	h := newRegisterTestHandler(t, allowAllBot(), users)

	tests := []struct {
		name string
		body map[string]any
		want []string
	}{
		{"short password", map[string]any{"username": "legituser", "email": "legit@example.com", "password": "short"},
			[]string{"Password must be at least 8 characters"}},
		{"bad email", map[string]any{"username": "legituser", "email": "not-an-email", "password": "SuperSecret123!"},
			[]string{"Email must be a valid email address"}},
		{"short username", map[string]any{"username": "ab", "email": "legit@example.com", "password": "SuperSecret123!"},
			[]string{"Username must be at least 3 characters"}},
		{"username characters", map[string]any{"username": "bad name!", "email": "legit@example.com", "password": "SuperSecret123!"},
			[]string{"Username must be only letters, numbers, underscores and hyphens"}},
		{"several at once", map[string]any{"username": "a", "email": "legit@example.com", "password": "short"},
			[]string{"Username must be at least 3 characters", "Password must be at least 8 characters"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := postRegister(t, h, tt.body)

			if w.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status = %d, want 422 (body: %s)", w.Code, w.Body.String())
			}
			var body struct {
				Detail string `json:"detail"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			for _, want := range tt.want {
				if !strings.Contains(body.Detail, want) {
					t.Errorf("detail = %q, want it to contain %q", body.Detail, want)
				}
			}
			for _, raw := range []string{"Key: '", "expected ", "username: "} {
				if strings.Contains(body.Detail, raw) {
					t.Errorf("detail = %q, must not contain raw validator text %q", body.Detail, raw)
				}
			}
		})
	}
}

// Regression: a taken username or email came back as Postgres' own
// "duplicate key value violates unique constraint ... (SQLSTATE 23505)".
func TestHumaRegister_TakenUsernameOrEmail(t *testing.T) {
	tests := []struct {
		constraint string
		want       string
	}{
		{"users_username_key", "Username is already taken"},
		{"users_email_unique", "Email is already in use"},
	}
	for _, tt := range tests {
		t.Run(tt.constraint, func(t *testing.T) {
			users := &stubUserService{
				createUser: func(*core.User) (*core.User, error) {
					return nil, &pgconn.PgError{Code: "23505", ConstraintName: tt.constraint,
						Message: "duplicate key value violates unique constraint"}
				},
			}
			w := postRegister(t, newRegisterTestHandler(t, allowAllBot(), users), validRegistrationBody())

			if w.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400 (body: %s)", w.Code, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), tt.want) {
				t.Errorf("body = %s, want it to contain %q", w.Body.String(), tt.want)
			}
			if strings.Contains(w.Body.String(), "SQLSTATE") || strings.Contains(w.Body.String(), "duplicate key") {
				t.Errorf("body = %s, must not contain database text", w.Body.String())
			}
		})
	}
}

// Any other CreateUser failure is a server fault, not something the person
// registering can fix.
func TestHumaRegister_CreateUserFaultIs500(t *testing.T) {
	users := &stubUserService{
		createUser: func(*core.User) (*core.User, error) {
			return nil, context.DeadlineExceeded
		},
	}
	w := postRegister(t, newRegisterTestHandler(t, allowAllBot(), users), validRegistrationBody())

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500 (body: %s)", w.Code, w.Body.String())
	}
}
