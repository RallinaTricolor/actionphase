# Feature: User Account Management & Security

**Status**: ✅ IMPLEMENTED (Phases 1-4) | ⚠️ Testing & Documentation Needed (Phase 5)
**Created**: 2025-01-01
**Last Updated**: 2025-01-01 (Status updated after implementation verification)
**Owner**: AI Planning Session
**Implementation Verified**: 2025-01-01
**Related ADRs**: ADR-003 (Authentication Strategy)
**Timeline**: 4 weeks

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

ActionPhase currently lacks essential user account management and security features that are critical for a production-ready gaming platform:

1. **Password Management**: Users cannot change their passwords or reset forgotten passwords
2. **Account Security**: No bot prevention mechanisms (CAPTCHA, rate limiting)
3. **Email Verification**: Accounts aren't verified, allowing disposable emails and spam
4. **Account Flexibility**: Users cannot change usernames or email addresses
5. **Session Management**: No UI for viewing/managing active sessions across devices
6. **Account Deletion**: No self-service account deletion

These gaps create security vulnerabilities, poor user experience, and make the platform susceptible to bot abuse.

### Goals
**What are we trying to achieve?**

- [ ] **Password Management**: Users can change passwords (authenticated) and reset forgotten passwords (unauthenticated)
- [ ] **Bot Prevention**: Multi-layer defense prevents automated account creation and spam (CAPTCHA, rate limiting, honeypots, IP tracking)
- [ ] **Email Verification**: Strict enforcement of email verification for all users to prevent disposable emails
- [ ] **Account Flexibility**: Users can change usernames and email addresses with proper verification
- [ ] **Session Management**: Users can view active sessions and revoke access from specific devices
- [ ] **Account Deletion**: Self-service soft delete with 30-day recovery period
- [ ] **Zero Cost**: All features use free tools (Resend 3k emails/month, hCaptcha unlimited)

### Non-Goals
**What is explicitly out of scope?**

- OAuth2/Social login integration (future consideration)
- Two-factor authentication (future enhancement)
- Account age-based restrictions and reputation system (removed from scope)
- Advanced anomaly detection or machine learning bot prevention
- Custom domain email hosting
- Phone number verification

### Success Criteria
**How do we know this feature is successful?**

**Functional:**
- [ ] Users can successfully change their password while authenticated
- [ ] Users can complete full password reset flow (request → email → reset → login)
- [ ] Email verification required and enforced for creating games/characters
- [ ] Bot registration attempts blocked by CAPTCHA, rate limiting, and honeypot
- [ ] Users can change username and email address with verification
- [ ] Users can view active sessions and revoke specific sessions
- [ ] Users can soft-delete accounts with 30-day recovery window

**Technical:**
- [ ] Unit test coverage: >85% for service layer
- [ ] Integration tests: All API endpoints tested with real database
- [ ] Component test coverage: >80% for frontend components
- [ ] All regression tests passing
- [ ] Manual UI testing complete with documented flows
- [ ] Zero production errors after deployment

**Performance:**
- [ ] Password reset email delivery < 10 seconds
- [ ] Email verification email delivery < 10 seconds
- [ ] API endpoints respond in < 300ms (p95)
- [ ] Rate limiting effectively blocks bot attempts without affecting real users

**Security:**
- [ ] No sensitive data in JWT tokens
- [ ] Tokens use cryptographically secure random generation
- [ ] Rate limiting prevents brute force attacks
- [ ] Disposable email domains blocked (>1000 domains)
- [ ] IP-based limits prevent mass account creation

**Cost:**
- [ ] Monthly email cost: $0 (under Resend free tier of 3,000 emails/month)
- [ ] CAPTCHA cost: $0 (hCaptcha unlimited free tier)
- [ ] Total infrastructure cost: $0/month

---

## 2. User Stories

### Primary User Stories

#### Story 1: Change Password (Authenticated User)
```gherkin
As an authenticated user
I want to change my password
So that I can maintain account security

Acceptance Criteria:
- Given I am logged in
  When I navigate to Settings > Account Security
  And I enter my current password correctly
  And I enter a strong new password
  Then my password is updated
  And I receive a confirmation email
  And all other sessions are invalidated (except current)

- Given I am logged in
  When I try to change my password
  And I enter an incorrect current password
  Then I see an error "Current password is incorrect"
  And my password is not changed
```

#### Story 2: Reset Forgotten Password (Unauthenticated User)
```gherkin
As a user who forgot my password
I want to reset it via email
So that I can regain access to my account

Acceptance Criteria:
- Given I am on the login page
  When I click "Forgot Password?"
  And I enter my email address
  And I complete the CAPTCHA
  Then I receive a password reset email within 10 seconds
  And the email contains a secure reset link valid for 1 hour

- Given I receive a password reset email
  When I click the reset link
  And I enter a strong new password
  And I confirm the new password
  Then my password is updated
  And all my sessions are invalidated
  And I receive a confirmation email
  And I can login with the new password
```

#### Story 3: Email Verification Enforcement
```gherkin
As a platform operator
I want to enforce email verification for all users
So that we prevent spam and disposable email accounts

Acceptance Criteria:
- Given I create a new account
  When I complete registration with CAPTCHA
  Then my account is created with email_verified = FALSE
  And I immediately receive a verification email
  And I can login but cannot create games or characters
  And I see a persistent banner "Verify your email to unlock features"

- Given I am an unverified user
  When I click the verification link in my email
  Then my email is marked as verified
  And I can now create games and characters
  And the verification banner disappears
```

#### Story 4: Bot Prevention During Registration
```gherkin
As a platform operator
I want to prevent automated bot registrations
So that we avoid spam accounts and abuse

Acceptance Criteria:
- Given a user tries to register
  When they submit the registration form
  Then they must complete an hCaptcha challenge
  And the honeypot field must be empty
  And they must not exceed IP-based rate limits (5/day)
  And their email must not be a disposable email domain

- Given a bot tries to register with automated tools
  When it submits the form too quickly (< 3 seconds)
  Or fills the honeypot field
  Or uses a disposable email
  Or exceeds IP limits
  Then the registration is rejected
  And the attempt is logged for monitoring
```

#### Story 5: Change Username
```gherkin
As an authenticated user
I want to change my username
So that I can update my identity

Acceptance Criteria:
- Given I am logged in
  When I navigate to Settings > Account Information
  And I enter a new available username
  And I confirm with my password
  Then my username is updated
  And I receive a new JWT with the new username
  And I receive a confirmation email
  And my old username becomes available for others
```

#### Story 6: Session Management
```gherkin
As an authenticated user
I want to view and manage my active sessions
So that I can secure my account across devices

Acceptance Criteria:
- Given I am logged in
  When I navigate to Settings > Active Sessions
  Then I see a list of all my active sessions
  And each session shows device, location (IP), and last activity
  And my current session is clearly indicated

- Given I see my active sessions
  When I click "Sign Out" on a specific session
  Then that session is invalidated
  And I remain logged in on my current device

- Given I see my active sessions
  When I click "Sign Out Everywhere Else"
  Then all sessions except my current one are invalidated
  And I receive a security notification email
```

### Edge Cases & Error Scenarios

**Password Reset:**
- **Edge Case**: User requests multiple password resets → Only the most recent token is valid, previous tokens are invalidated
- **Edge Case**: Password reset link expires after 1 hour → User sees clear error message with option to request new link
- **Error**: User enters weak password → Validation error with specific requirements shown
- **Error**: Token already used → Error message "This reset link has already been used"

**Email Verification:**
- **Edge Case**: User loses verification email → "Resend verification" button available (rate limited to 3/hour)
- **Edge Case**: Verification link expires → User can request new verification from account settings
- **Error**: Token invalid or expired → Clear error with resend option

**Username Change:**
- **Edge Case**: Username already taken → Real-time validation shows "Username unavailable"
- **Error**: Spammy username (contains "casino", excessive numbers) → Validation error "Username not allowed"

**Bot Prevention:**
- **Edge Case**: Legitimate user on shared IP hits limit → Temporarily blocked with clear message and retry time
- **Error**: CAPTCHA fails → User can retry CAPTCHA
- **Error**: Honeypot triggered → Silent rejection with 5-second delay (to slow down bot)

---

## 3. Technical Design

### 3.1 Database Schema

**New Tables:**

```sql
-- Email verification tokens
CREATE TABLE email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_email_verif_token ON email_verification_tokens(token);
CREATE INDEX idx_email_verif_expires ON email_verification_tokens(expires_at);
CREATE INDEX idx_email_verif_user ON email_verification_tokens(user_id);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    ip_address INET
);

CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);

-- Registration attempt tracking (bot prevention)
CREATE TABLE registration_attempts (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    user_agent TEXT,
    captcha_passed BOOLEAN DEFAULT FALSE,
    honeypot_triggered BOOLEAN DEFAULT FALSE,
    disposable_email_blocked BOOLEAN DEFAULT FALSE,
    successful BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reg_attempts_ip_time ON registration_attempts(ip_address, created_at);
CREATE INDEX idx_reg_attempts_created ON registration_attempts(created_at);
```

**Schema Modifications:**

```sql
-- Add email verification tracking to users
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;

-- Add password/username change tracking
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN username_changed_at TIMESTAMPTZ;

-- Add email change pending (for verification flow)
ALTER TABLE users ADD COLUMN email_change_pending VARCHAR(255);
ALTER TABLE users ADD COLUMN email_change_requested_at TIMESTAMPTZ;

-- Add soft delete support (30-day recovery)
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN deletion_scheduled_for TIMESTAMPTZ;
```

**Migration Plan:**
1. Migration file: `20250101000000_add_account_security_features.up.sql`
2. Rollback file: `20250101000000_add_account_security_features.down.sql`
3. Data migration strategy: Existing users will have `email_verified = FALSE`, but will not be hard-blocked from features (graceful migration)
4. Apply migration: `just migrate`

### 3.2 Database Queries (sqlc)

**Location**: `backend/pkg/db/queries/auth.sql` (new file)

```sql
-- Email Verification Tokens

-- name: CreateEmailVerificationToken :one
INSERT INTO email_verification_tokens (
    user_id, token, email, expires_at
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: GetEmailVerificationToken :one
SELECT * FROM email_verification_tokens
WHERE token = $1 AND used_at IS NULL AND expires_at > NOW();

-- name: MarkEmailVerificationTokenUsed :exec
UPDATE email_verification_tokens
SET used_at = NOW()
WHERE token = $1;

-- name: DeleteExpiredEmailVerificationTokens :exec
DELETE FROM email_verification_tokens
WHERE expires_at < NOW();

-- Password Reset Tokens

-- name: CreatePasswordResetToken :one
INSERT INTO password_reset_tokens (
    user_id, token, expires_at, ip_address
) VALUES (
    $1, $2, $3, $4
) RETURNING *;

-- name: GetPasswordResetToken :one
SELECT * FROM password_reset_tokens
WHERE token = $1 AND used_at IS NULL AND expires_at > NOW();

-- name: MarkPasswordResetTokenUsed :exec
UPDATE password_reset_tokens
SET used_at = NOW()
WHERE token = $1;

-- name: InvalidateUserPasswordResetTokens :exec
UPDATE password_reset_tokens
SET used_at = NOW()
WHERE user_id = $1 AND used_at IS NULL;

-- name: DeleteExpiredPasswordResetTokens :exec
DELETE FROM password_reset_tokens
WHERE expires_at < NOW();

-- Registration Attempt Tracking

-- name: CreateRegistrationAttempt :one
INSERT INTO registration_attempts (
    ip_address, user_agent, captcha_passed, honeypot_triggered,
    disposable_email_blocked, successful
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING *;

-- name: CountRecentRegistrationsByIP :one
SELECT COUNT(*) FROM registration_attempts
WHERE ip_address = $1
  AND created_at > $2
  AND successful = TRUE;

-- name: DeleteOldRegistrationAttempts :exec
DELETE FROM registration_attempts
WHERE created_at < NOW() - INTERVAL '30 days';

-- User Account Management

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1 LIMIT 1;

-- name: UpdateUserPassword :exec
UPDATE users
SET password = $1, password_changed_at = NOW()
WHERE id = $2;

-- name: UpdateUsername :exec
UPDATE users
SET username = $1, username_changed_at = NOW()
WHERE id = $2;

-- name: MarkEmailVerified :exec
UPDATE users
SET email_verified = TRUE, email_verified_at = NOW()
WHERE id = $1;

-- name: SetEmailChangePending :exec
UPDATE users
SET email_change_pending = $1, email_change_requested_at = NOW()
WHERE id = $2;

-- name: CompleteEmailChange :exec
UPDATE users
SET email = $1, email_change_pending = NULL, email_change_requested_at = NULL, email_verified = TRUE
WHERE id = $2;

-- name: ScheduleAccountDeletion :exec
UPDATE users
SET deleted_at = NOW(), deletion_scheduled_for = NOW() + INTERVAL '30 days'
WHERE id = $1;

-- name: CancelAccountDeletion :exec
UPDATE users
SET deleted_at = NULL, deletion_scheduled_for = NULL
WHERE id = $1;

-- name: HardDeleteScheduledAccounts :exec
DELETE FROM users
WHERE deletion_scheduled_for < NOW() AND deletion_scheduled_for IS NOT NULL;
```

**Query Performance Considerations:**
- [ ] Indexes planned for token lookups (unique constraints ensure fast lookups)
- [ ] Composite index on (ip_address, created_at) for rate limiting queries
- [ ] Cleanup queries will run as scheduled jobs (not on request path)
- [ ] Email/username lookups already indexed from existing schema

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

```go
// EmailServiceInterface handles email sending
type EmailServiceInterface interface {
    SendEmail(ctx context.Context, req *SendEmailRequest) error
    SendPasswordResetEmail(ctx context.Context, email, token, resetURL string) error
    SendEmailVerificationEmail(ctx context.Context, email, token, verifyURL string) error
    SendPasswordChangedEmail(ctx context.Context, email string) error
    SendEmailChangedEmail(ctx context.Context, oldEmail, newEmail string) error
    SendAccountDeletionScheduledEmail(ctx context.Context, email string, scheduledFor time.Time) error
}

// CaptchaServiceInterface handles CAPTCHA verification
type CaptchaServiceInterface interface {
    Verify(ctx context.Context, token, remoteIP string) (bool, error)
}

// AuthServiceInterface handles authentication flows
type AuthServiceInterface interface {
    // Password Management
    ChangePassword(ctx context.Context, userID int32, currentPassword, newPassword string) error
    RequestPasswordReset(ctx context.Context, emailOrUsername, ipAddress string) error
    VerifyPasswordResetToken(ctx context.Context, token string) (*PasswordResetTokenInfo, error)
    CompletePasswordReset(ctx context.Context, token, newPassword string) error

    // Email Verification
    SendEmailVerification(ctx context.Context, userID int32) error
    VerifyEmail(ctx context.Context, token string) error
    ResendEmailVerification(ctx context.Context, userID int32) error

    // Account Management
    ChangeUsername(ctx context.Context, userID int32, newUsername, password string) error
    RequestEmailChange(ctx context.Context, userID int32, newEmail, password string) error
    CompleteEmailChange(ctx context.Context, token string) error

    // Session Management
    GetUserSessions(ctx context.Context, userID int32) ([]*SessionInfo, error)
    RevokeSession(ctx context.Context, userID, sessionID int32) error
    RevokeAllSessionsExceptCurrent(ctx context.Context, userID, currentSessionID int32) error

    // Account Deletion
    ScheduleAccountDeletion(ctx context.Context, userID int32, password string) error
    CancelAccountDeletion(ctx context.Context, userID int32) error
}

// BotPreventionServiceInterface handles bot detection
type BotPreventionServiceInterface interface {
    CheckRegistrationAllowed(ctx context.Context, req *RegistrationCheck) error
    RecordRegistrationAttempt(ctx context.Context, req *RegistrationAttempt) error
    IsDisposableEmail(email string) bool
    IsSpammyUsername(username string) bool
}
```

**Domain Models** (`backend/pkg/core/models.go`):

```go
type SendEmailRequest struct {
    To      string
    Subject string
    HTML    string
    Text    string
}

type PasswordResetTokenInfo struct {
    Valid          bool
    ExpiresInSec   int64
    ExpiresAt      time.Time
}

type SessionInfo struct {
    ID          int32     `json:"id"`
    DeviceID    string    `json:"device_id"`
    UserAgent   string    `json:"user_agent"`
    IPAddress   string    `json:"ip_address"`
    LastUsedAt  time.Time `json:"last_used_at"`
    CreatedAt   time.Time `json:"created_at"`
    IsCurrent   bool      `json:"is_current"`
}

type RegistrationCheck struct {
    IPAddress        string
    UserAgent        string
    Email            string
    Username         string
    CaptchaToken     string
    HoneypotFilled   bool
    TimeSincePageLoad time.Duration
}

type RegistrationAttempt struct {
    IPAddress               string
    UserAgent               string
    CaptchaPassed           bool
    HoneypotTriggered       bool
    DisposableEmailBlocked  bool
    Successful              bool
}

type ChangePasswordRequest struct {
    CurrentPassword string `json:"current_password" validate:"required"`
    NewPassword     string `json:"new_password" validate:"required,min=8"`
    ConfirmPassword string `json:"confirm_password" validate:"required,eqfield=NewPassword"`
}

type RequestPasswordResetRequest struct {
    EmailOrUsername string `json:"email_or_username" validate:"required"`
    CaptchaToken    string `json:"captcha_token" validate:"required"`
}

type CompletePasswordResetRequest struct {
    Token           string `json:"token" validate:"required"`
    NewPassword     string `json:"new_password" validate:"required,min=8"`
    ConfirmPassword string `json:"confirm_password" validate:"required,eqfield=NewPassword"`
}

type ChangeUsernameRequest struct {
    NewUsername string `json:"new_username" validate:"required,min=3,max=20,alphanum_underscore"`
    Password    string `json:"password" validate:"required"`
}

type ChangeEmailRequest struct {
    NewEmail string `json:"new_email" validate:"required,email"`
    Password string `json:"password" validate:"required"`
}

type ScheduleAccountDeletionRequest struct {
    Password     string `json:"password" validate:"required"`
    Confirmation string `json:"confirmation" validate:"required,eq=DELETE MY ACCOUNT"`
}
```

**Business Rules:**

1. **Password Strength Requirements**
   - Validation: Minimum 8 characters, at least one uppercase, one lowercase, one number, one special character
   - Error: "Password must be at least 8 characters and contain uppercase, lowercase, number, and special character"

2. **Password Reset Token Expiration**
   - Validation: Tokens expire after 1 hour
   - Error: "This password reset link has expired. Please request a new one."

3. **Email Verification Required for Features**
   - Validation: Check user.email_verified before allowing game/character creation
   - Error: "Please verify your email address to access this feature"

4. **Rate Limiting for Password Resets**
   - Validation: Maximum 3 requests per hour per email/IP
   - Error: "Too many password reset requests. Please try again in X minutes."

5. **Disposable Email Blocking**
   - Validation: Check email domain against disposable domains list
   - Error: "Disposable email addresses are not allowed"

6. **IP-Based Registration Limits**
   - Validation: Maximum 5 successful registrations per IP per 24 hours
   - Error: "Too many accounts created from this IP address. Please try again later."

7. **Session Invalidation on Password Change**
   - Validation: When password changes, invalidate all sessions except current
   - Behavior: User must re-login on other devices

8. **Username Availability and Format**
   - Validation: Username 3-20 characters, alphanumeric + underscores only, not taken, not spammy
   - Error: "Username must be 3-20 characters (letters, numbers, underscores only)"

9. **Soft Delete Recovery Period**
   - Validation: Accounts scheduled for deletion can be recovered within 30 days
   - Behavior: Hard delete automatically after 30 days via scheduled job

### 3.4 API Endpoints

*(Continued in next section due to length...)*

---

## Implementation Status (Verified 2025-01-01)

### ✅ FULLY IMPLEMENTED: Phases 1-4

**Phase 1: Email Infrastructure & Bot Prevention**
- ✅ Email Service (`backend/pkg/email/`) - Resend/MailHog with HTML templates
- ✅ hCaptcha Integration (`backend/pkg/captcha/`) - Unlimited free tier
- ✅ Bot Prevention (`backend/pkg/botprevention/`) - IP tracking, honeypot, disposable emails
- ✅ Rate Limiting (`backend/pkg/middleware/ratelimit.go`) - tollbooth integration
- ✅ Backend unit tests (26.4KB total test code)

**Phase 2: Password Management**
- ✅ Change Password (authenticated) - `backend/pkg/auth/password_service.go:39-89`
- ✅ Request Password Reset - `backend/pkg/auth/password_service.go:91-141`
- ✅ Reset Password with Token - `backend/pkg/auth/password_service.go:143-202`
- ✅ Token Validation - `backend/pkg/auth/password_handlers.go:187-225`
- ✅ Frontend Pages: ForgotPasswordPage.tsx (105 lines), ResetPasswordPage.tsx (237 lines)
- ✅ Frontend Component: ChangePasswordForm.tsx
- ✅ Backend integration tests (16.2KB)

**Phase 3: Email Verification & Account Changes**
- ✅ Email Verification - `backend/pkg/auth/account_service.go:41-125`
- ✅ Resend Verification - `backend/pkg/auth/account_service.go:278-304`
- ✅ Change Username (30-day cooldown) - `backend/pkg/auth/account_service.go:127-184`
- ✅ Change Email (with verification) - `backend/pkg/auth/account_service.go:186-270`
- ✅ Frontend Page: VerifyEmailPage.tsx (117 lines)
- ✅ Frontend Components: ChangeUsernameForm.tsx, ChangeEmailForm.tsx
- ✅ Backend integration tests (16.8KB)

**Phase 4: Session Management & Account Deletion**
- ✅ List User Sessions - `backend/pkg/auth/session_handlers.go:32-88`
- ✅ Revoke Specific Session - `backend/pkg/auth/session_handlers.go:90-162`
- ✅ Revoke All Sessions - `backend/pkg/auth/account_handlers.go:346-404`
- ✅ Soft Delete Account (30-day recovery) - `backend/pkg/auth/account_service.go:306-330`
- ✅ Restore Account - `backend/pkg/auth/account_service.go:332-352`
- ✅ Frontend Components: ActiveSessions.tsx (193 lines), DeleteAccountSection.tsx
- ✅ Settings Page Integration - All components integrated

**API Endpoints Registered (`backend/pkg/http/root.go`):**
- POST `/api/v1/auth/change-password`
- POST `/api/v1/auth/request-password-reset`
- POST `/api/v1/auth/reset-password`
- GET `/api/v1/auth/validate-reset-token`
- POST `/api/v1/auth/verify-email`
- POST `/api/v1/auth/resend-verification`
- POST `/api/v1/auth/change-username`
- POST `/api/v1/auth/request-email-change`
- POST `/api/v1/auth/complete-email-change`
- GET `/api/v1/auth/sessions`
- DELETE `/api/v1/auth/sessions/{sessionID}`
- POST `/api/v1/auth/revoke-all-sessions`
- DELETE `/api/v1/auth/account`

### ⚠️ MISSING: Phase 5 - Testing & Documentation

**Frontend Tests - MISSING:**
- ❌ ChangePasswordForm.test.tsx
- ❌ ChangeUsernameForm.test.tsx
- ❌ ChangeEmailForm.test.tsx
- ❌ DeleteAccountSection.test.tsx
- ❌ ActiveSessions.test.tsx
- ❌ ForgotPasswordPage.test.tsx
- ❌ ResetPasswordPage.test.tsx
- ❌ VerifyEmailPage.test.tsx

**E2E Tests - MISSING:**
- ❌ Password reset flow (request → email → validate → reset → login)
- ❌ Email verification flow (register → verify → access features)
- ❌ Username change flow (settings → change → cooldown enforcement)
- ❌ Email change flow (settings → request → verify → update)
- ❌ Session management flow (list → revoke → revoke all)
- ❌ Account deletion flow (delete → logout → restore)

**Documentation - MISSING:**
- ❌ User guide for account security features
- ❌ API documentation updates
- ❌ Settings page user documentation
- ❌ Password reset flow documentation
- ❌ Email verification documentation

### Next Steps

**To complete Phase 5:**
1. Write frontend component tests (8 components)
2. Write E2E tests for all flows (6 critical flows)
3. Create user-facing documentation
4. Update API documentation
5. Manual QA testing in all themes
6. Performance testing (email delivery, API response times)

---

**Last Updated**: 2025-01-01
