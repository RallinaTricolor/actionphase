# User Account Security - Task Checklist

**Last Updated**: 2025-01-01
**Estimated Timeline**: 4 weeks
**Status**: Not Started

---

## Phase 1: Email Infrastructure & Bot Prevention (Week 1)

### 1.1 Email Service Foundation
- [ ] **Task 1.1.1**: Install Resend Go SDK (`go get github.com/resendlabs/resend-go/v2`)
- [ ] **Task 1.1.2**: Create `EmailServiceInterface` in `backend/pkg/core/interfaces.go`
- [ ] **Task 1.1.3**: Implement `EmailService` in `backend/pkg/email/service.go`
  - Support Resend provider
  - Support MailHog provider (dev)
  - Provider selection via ENV (`EMAIL_PROVIDER`)
- [ ] **Task 1.1.4**: Create HTML email templates in `backend/pkg/email/templates/`
  - `password_reset.html`
  - `email_verification.html`
  - `password_changed.html`
  - `email_changed.html`
  - `account_deletion_scheduled.html`
- [ ] **Task 1.1.5**: Add environment variables to `.env.example`
  - EMAIL_PROVIDER, RESEND_API_KEY, EMAIL_FROM, MAILHOG_HOST, etc.
- [ ] **Task 1.1.6**: Write unit tests for EmailService (mock SMTP/API calls)
  - Test template rendering
  - Test provider selection
  - Test error handling
- [ ] **Task 1.1.7**: Set up MailHog for local development
  - Add docker-compose service or document manual setup
  - Test email sending locally

**Acceptance Criteria**:
- [ ] Emails send successfully via Resend in production
- [ ] Emails captured by MailHog in development
- [ ] All email templates render correctly with test data
- [ ] Unit tests passing (>85% coverage)

---

### 1.2 hCaptcha Integration
- [ ] **Task 1.2.1**: Install hCaptcha Go package (`go get github.com/hCaptcha/go-hcaptcha`)
- [ ] **Task 1.2.2**: Create `CaptchaServiceInterface` in `backend/pkg/core/interfaces.go`
- [ ] **Task 1.2.3**: Implement `HCaptchaService` in `backend/pkg/captcha/hcaptcha.go`
  - Verify tokens via hCaptcha API
  - Handle errors gracefully
  - Support disabling via ENV for testing
- [ ] **Task 1.2.4**: Install hCaptcha React package (`npm install @hcaptcha/react-hcaptcha`)
- [ ] **Task 1.2.5**: Create `HCaptcha` component in `frontend/src/components/auth/HCaptcha.tsx`
  - Render hCaptcha widget
  - Expose token via callback
  - Handle errors
- [ ] **Task 1.2.6**: Add HCAPTCHA environment variables
  - Backend: `HCAPTCHA_SECRET`, `HCAPTCHA_ENABLED`
  - Frontend: `VITE_HCAPTCHA_SITE_KEY`
- [ ] **Task 1.2.7**: Write tests for CAPTCHA verification
  - Mock hCaptcha API responses
  - Test success/failure cases

**Acceptance Criteria**:
- [ ] CAPTCHA widget renders correctly on frontend
- [ ] Backend successfully verifies CAPTCHA tokens
- [ ] Invalid tokens are rejected
- [ ] CAPTCHA can be disabled for testing

---

### 1.3 Rate Limiting Middleware
- [ ] **Task 1.3.1**: Install tollbooth (`go get github.com/didip/tollbooth/v7`)
- [ ] **Task 1.3.2**: Create rate limiting middleware in `backend/pkg/middleware/ratelimit.go`
  - `RateLimitAuth()` - 10 requests/hour for login
  - `RateLimitRegistration()` - 3 requests/hour for registration
  - `RateLimitPasswordReset()` - 3 requests/hour for password reset
  - `RateLimitEmailResend()` - 3 requests/hour for email resend
- [ ] **Task 1.3.3**: Apply middleware to sensitive endpoints in `backend/pkg/http/root.go`
  - POST /api/v1/auth/register
  - POST /api/v1/auth/login
  - POST /api/v1/auth/password-reset/request
  - POST /api/v1/auth/email/resend
- [ ] **Task 1.3.4**: Write tests for rate limiting
  - Test that limits are enforced
  - Test that limits reset after time window
  - Test error responses

**Acceptance Criteria**:
- [ ] Rate limits prevent excessive requests
- [ ] Clear error messages returned when limit exceeded
- [ ] Tests verify rate limiting behavior

---

### 1.4 Honeypot & IP Tracking
- [ ] **Task 1.4.1**: Add honeypot field to registration form
  - Hidden input field (`name="website"`)
  - CSS: `display: none`
  - Tab index: -1
  - Auto-complete: off
- [ ] **Task 1.4.2**: Create `registration_attempts` table migration
  - Track IP, user agent, CAPTCHA, honeypot, success
  - Add indexes for IP + timestamp queries
- [ ] **Task 1.4.3**: Create `BotPreventionServiceInterface` in `backend/pkg/core/interfaces.go`
- [ ] **Task 1.4.4**: Implement `BotPreventionService` in `backend/pkg/botprevention/service.go`
  - Check IP-based limits (5 registrations/24 hours)
  - Validate honeypot empty
  - Log all registration attempts
- [ ] **Task 1.4.5**: Update registration handler to use bot prevention
  - Reject if honeypot filled
  - Reject if IP limit exceeded
  - Record attempt in database
- [ ] **Task 1.4.6**: Write bot prevention tests
  - Test honeypot detection
  - Test IP limits
  - Test attempt logging

**Acceptance Criteria**:
- [ ] Honeypot field catches bot submissions
- [ ] IP limits prevent mass account creation
- [ ] All attempts logged for monitoring
- [ ] Tests verify bot detection logic

---

### 1.5 Disposable Email Blocking
- [ ] **Task 1.5.1**: Download disposable email domains list
  - Source: https://github.com/disposable-email-domains/disposable-email-domains
  - Store in `backend/pkg/email/disposable_domains.txt`
- [ ] **Task 1.5.2**: Implement disposable email checking in `backend/pkg/email/disposable.go`
  - Load domains list into memory map
  - Check email domain against list
  - Cache for performance
- [ ] **Task 1.5.3**: Add disposable email check to registration
  - Validate before creating user
  - Return clear error message
  - Log blocked disposable emails
- [ ] **Task 1.5.4**: Write disposable email tests
  - Test known disposable domains blocked
  - Test legitimate domains allowed

**Acceptance Criteria**:
- [ ] Disposable email domains blocked (>1000 domains)
- [ ] Legitimate email domains allowed
- [ ] Clear error message shown to users
- [ ] Tests verify blocking logic

---

## Phase 2: Password Management (Week 2)

### 2.1 Database Schema & Queries
- [ ] **Task 2.1.1**: Create migration `add_account_security_features.up.sql`
  - Add `email_verification_tokens` table
  - Add `password_reset_tokens` table
  - Add columns to `users` (email_verified, password_changed_at, etc.)
  - Add indexes
- [ ] **Task 2.1.2**: Create rollback migration `.down.sql`
- [ ] **Task 2.1.3**: Create `backend/pkg/db/queries/auth.sql` with all auth queries
  - Password reset token CRUD
  - Email verification token CRUD
  - User password/email/username updates
  - Session management queries
- [ ] **Task 2.1.4**: Run `just sqlgen` to generate Go code
- [ ] **Task 2.1.5**: Test migration up/down
  - Apply migration: `just migrate`
  - Verify schema changes
  - Rollback: `just migrate_down`
  - Verify clean rollback

**Acceptance Criteria**:
- [ ] Migration applies cleanly
- [ ] Rollback works without errors
- [ ] sqlc generates code successfully
- [ ] All queries compile

---

### 2.2 Change Password (Authenticated)
- [ ] **Task 2.2.1**: Define `AuthServiceInterface.ChangePassword` in `core/interfaces.go`
- [ ] **Task 2.2.2**: Implement password change in `backend/pkg/auth/password.go`
  - Validate current password correct
  - Validate new password strength
  - Hash new password with bcrypt
  - Update database
  - Invalidate other sessions
  - Send confirmation email
- [ ] **Task 2.2.3**: Create API endpoint `POST /api/v1/users/me/password`
  - Request: current_password, new_password, confirm_password
  - Validate input
  - Call service
  - Return success
- [ ] **Task 2.2.4**: Write backend tests for password change
  - Test successful password change
  - Test incorrect current password
  - Test weak new password
  - Test session invalidation
- [ ] **Task 2.2.5**: Create frontend `PasswordInput` component (with visibility toggle)
- [ ] **Task 2.2.6**: Create frontend `PasswordStrengthMeter` component
- [ ] **Task 2.2.7**: Add "Account Security" section to `SettingsPage.tsx`
  - Form with current/new/confirm password fields
  - Password strength meter
  - Submit button
  - Success/error messaging
- [ ] **Task 2.2.8**: Create `useChangePassword` hook
  - useMutation for password change API call
  - Handle success/error states
  - Show toast notifications
- [ ] **Task 2.2.9**: Write frontend tests for password change
  - Test form submission
  - Test validation
  - Test success/error handling

**Acceptance Criteria**:
- [ ] Users can successfully change password
- [ ] Other sessions invalidated on password change
- [ ] Confirmation email sent
- [ ] Frontend shows password strength
- [ ] All tests passing

---

### 2.3 Password Reset Flow (Unauthenticated)
- [ ] **Task 2.3.1**: Implement `AuthService.RequestPasswordReset`
  - Verify CAPTCHA token
  - Find user by email OR username
  - Generate secure random token (32 bytes hex)
  - Store token with 1-hour expiration
  - Send password reset email
  - Return same response regardless of email existence (security)
- [ ] **Task 2.3.2**: Implement `AuthService.VerifyPasswordResetToken`
  - Check token exists and not expired
  - Check token not already used
  - Return validity + expiration info
- [ ] **Task 2.3.3**: Implement `AuthService.CompletePasswordReset`
  - Verify token valid
  - Validate new password strength
  - Update password
  - Mark token as used
  - Invalidate all user sessions
  - Send confirmation email
- [ ] **Task 2.3.4**: Create API endpoints
  - POST /api/v1/auth/password-reset/request (with rate limiting)
  - GET /api/v1/auth/password-reset/verify/:token
  - POST /api/v1/auth/password-reset/complete
- [ ] **Task 2.3.5**: Write backend tests for reset flow
  - Test complete happy path
  - Test token expiration
  - Test token reuse prevention
  - Test invalid tokens
- [ ] **Task 2.3.6**: Create frontend pages
  - `ForgotPasswordPage.tsx` - Email/username + CAPTCHA
  - `CheckEmailPage.tsx` - Confirmation message
  - `ResetPasswordPage.tsx` - New password form (reads token from URL)
  - `ResetSuccessPage.tsx` - Success + login link
- [ ] **Task 2.3.7**: Create frontend hooks
  - `useRequestPasswordReset` - Request reset mutation
  - `useVerifyResetToken` - Verify token query
  - `useCompletePasswordReset` - Complete reset mutation
- [ ] **Task 2.3.8**: Update `LoginPage.tsx`
  - Add "Forgot Password?" link
- [ ] **Task 2.3.9**: Add routes to `App.tsx`
  - /forgot-password
  - /password-reset/check-email
  - /password-reset/confirm?token=...
  - /password-reset/success
- [ ] **Task 2.3.10**: Write frontend tests for reset flow
  - Test request reset form
  - Test token verification
  - Test password reset form
  - Test complete flow integration

**Acceptance Criteria**:
- [ ] Users can successfully reset forgotten passwords
- [ ] Reset emails delivered within 10 seconds
- [ ] Tokens expire after 1 hour
- [ ] Used tokens cannot be reused
- [ ] All sessions invalidated after reset
- [ ] Frontend handles all states (loading, success, error)
- [ ] All tests passing

---

## Phase 3: Email Verification & Account Changes (Week 3)

### 3.1 Email Verification
- [ ] **Task 3.1.1**: Implement `AuthService.SendEmailVerification`
  - Generate secure verification token
  - Store token with 24-hour expiration
  - Send verification email
  - Rate limit resends (3/hour)
- [ ] **Task 3.1.2**: Implement `AuthService.VerifyEmail`
  - Check token valid
  - Mark user email as verified
  - Mark token as used
- [ ] **Task 3.1.3**: Update registration handler
  - Set email_verified = FALSE on new accounts
  - Send verification email immediately
- [ ] **Task 3.1.4**: Create API endpoints
  - GET /api/v1/auth/email/verify/:token
  - POST /api/v1/auth/email/resend (authenticated, rate limited)
- [ ] **Task 3.1.5**: Create feature gate middleware
  - Check email_verified for protected actions
  - Return 403 with clear message if unverified
- [ ] **Task 3.1.6**: Apply feature gates to endpoints
  - POST /api/v1/games (create game)
  - POST /api/v1/games/:id/characters (create character)
  - POST /api/v1/messages (post message)
- [ ] **Task 3.1.7**: Write backend tests for email verification
  - Test verification flow
  - Test feature gates
  - Test resend rate limiting
- [ ] **Task 3.1.8**: Create `VerificationBanner` component
  - Persistent banner for unverified users
  - "Verify your email" message
  - "Resend" button
  - Dismissible (but reappears on refresh if still unverified)
- [ ] **Task 3.1.9**: Create `EmailVerificationPage.tsx`
  - Success message after verification
  - Link to continue to dashboard
- [ ] **Task 3.1.10**: Add verification check to `AuthContext`
  - Expose `isEmailVerified` flag
  - Use in feature gate components
- [ ] **Task 3.1.11**: Add feature gate UI indicators
  - Disabled buttons with tooltip for unverified users
  - "Verify email to unlock" messages
- [ ] **Task 3.1.12**: Write frontend tests
  - Test banner display for unverified users
  - Test resend functionality
  - Test feature gate UI behavior

**Acceptance Criteria**:
- [ ] Verification emails sent on registration
- [ ] Users can verify email via link
- [ ] Unverified users see persistent banner
- [ ] Feature gates block unverified users
- [ ] Clear messaging about why features locked
- [ ] All tests passing

---

### 3.2 Email-Based Login
- [ ] **Task 3.2.1**: Update login handler
  - Try to find user by username first
  - If not found, try to find by email
  - Continue with password validation
- [ ] **Task 3.2.2**: Update `GetUserByEmail` query (if not exists)
- [ ] **Task 3.2.3**: Write tests for email-based login
  - Test login with email
  - Test login with username
  - Test both work correctly
- [ ] **Task 3.2.4**: Update frontend login form
  - Change label from "Username" to "Username or Email"
  - Update placeholder text
- [ ] **Task 3.2.5**: Test login with both email and username

**Acceptance Criteria**:
- [ ] Users can login with email OR username
- [ ] No breaking changes for existing users
- [ ] Tests verify both methods work

---

### 3.3 Change Username
- [ ] **Task 3.3.1**: Implement `AuthService.ChangeUsername`
  - Verify password correct
  - Validate username format (3-20 chars, alphanumeric + underscore)
  - Check username availability
  - Check not spammy (regex patterns)
  - Update username
  - Issue new JWT (username in token claims)
  - Send confirmation email
- [ ] **Task 3.3.2**: Create API endpoint `POST /api/v1/users/me/username`
  - Request: new_username, password
  - Return new JWT in response
- [ ] **Task 3.3.3**: Create `IsSpammyUsername` helper
  - Regex patterns for spam keywords
  - Check for excessive numbers
  - Check for random character strings
- [ ] **Task 3.3.4**: Write backend tests
  - Test successful username change
  - Test taken username
  - Test invalid format
  - Test spammy username
  - Test new JWT issued
- [ ] **Task 3.3.5**: Add "Account Information" section to Settings
  - Current username display
  - Change username form
  - Password confirmation field
  - Real-time availability checking (debounced)
- [ ] **Task 3.3.6**: Create `useCheckUsernameAvailability` hook
  - Debounced query to check availability
  - Show green checkmark or red X
- [ ] **Task 3.3.7**: Create `useChangeUsername` mutation
  - Call API
  - Update auth context with new token
  - Show success notification
- [ ] **Task 3.3.8**: Write frontend tests
  - Test availability checking
  - Test form submission
  - Test validation

**Acceptance Criteria**:
- [ ] Users can change username
- [ ] New JWT issued with new username
- [ ] Real-time availability checking works
- [ ] Spammy usernames blocked
- [ ] All tests passing

---

### 3.4 Change Email Address
- [ ] **Task 3.4.1**: Implement `AuthService.RequestEmailChange`
  - Verify password correct
  - Validate email format
  - Check email not already taken
  - Check not disposable email
  - Set email_change_pending
  - Generate verification token
  - Send verification to NEW email
  - Send notification to OLD email
- [ ] **Task 3.4.2**: Implement `AuthService.CompleteEmailChange`
  - Verify token valid
  - Update email from pending
  - Clear pending status
  - Mark email as verified
  - Send confirmation to both emails
- [ ] **Task 3.4.3**: Create API endpoints
  - POST /api/v1/users/me/email (request change)
  - GET /api/v1/users/me/email/verify/:token (complete change)
- [ ] **Task 3.4.4**: Write backend tests
  - Test email change flow
  - Test notifications to both emails
  - Test disposable email blocked
- [ ] **Task 3.4.5**: Add email change form to Settings
  - Current email display (with verification badge)
  - New email input
  - Password confirmation
  - Two-step flow UI (pending verification indicator)
- [ ] **Task 3.4.6**: Create `useChangeEmail` hooks
  - `useRequestEmailChange` - Request change mutation
  - `useCompleteEmailChange` - Complete change mutation
- [ ] **Task 3.4.7**: Write frontend tests
  - Test request flow
  - Test verification flow

**Acceptance Criteria**:
- [ ] Users can change email with verification
- [ ] Notifications sent to both old and new email
- [ ] Disposable emails blocked
- [ ] All tests passing

---

## Phase 4: Session Management & Account Deletion (Week 4)

### 4.1 Session Management UI
- [ ] **Task 4.1.1**: Create `AuthService.GetUserSessions`
  - Query sessions table for user
  - Include device, IP, last used, created timestamps
  - Mark current session
- [ ] **Task 4.1.2**: Create `AuthService.RevokeSession`
  - Delete specific session by ID
  - Verify user owns session
- [ ] **Task 4.1.3**: Create `AuthService.RevokeAllSessionsExceptCurrent`
  - Delete all sessions except specified ID
  - Send security notification email
- [ ] **Task 4.1.4**: Create API endpoints
  - GET /api/v1/users/me/sessions
  - DELETE /api/v1/users/me/sessions/:id
  - DELETE /api/v1/users/me/sessions (revoke all except current)
- [ ] **Task 4.1.5**: Write backend tests
  - Test session listing
  - Test individual revocation
  - Test bulk revocation
  - Test current session exemption
- [ ] **Task 4.1.6**: Create `ActiveSessions` component for Settings
  - List of sessions with device/IP/timestamp info
  - "Current Device" indicator
  - Individual "Sign Out" buttons
  - "Sign Out Everywhere Else" button
- [ ] **Task 4.1.7**: Create `useSessions` hooks
  - `useSessions` - Query hook for session list
  - `useRevokeSession` - Mutation for single revoke
  - `useRevokeAllOther` - Mutation for bulk revoke
- [ ] **Task 4.1.8**: Write frontend tests
  - Test session list rendering
  - Test revoke functionality
  - Test current session protection

**Acceptance Criteria**:
- [ ] Users can view all active sessions
- [ ] Users can revoke individual sessions
- [ ] Users can sign out everywhere else
- [ ] Current session never revoked
- [ ] All tests passing

---

### 4.2 Account Deletion (Soft Delete)
- [ ] **Task 4.2.1**: Implement `AuthService.ScheduleAccountDeletion`
  - Verify password correct
  - Verify confirmation string matches
  - Set deleted_at = NOW()
  - Set deletion_scheduled_for = NOW() + 30 days
  - Send confirmation email with recovery instructions
- [ ] **Task 4.2.2**: Implement `AuthService.CancelAccountDeletion`
  - Clear deleted_at and deletion_scheduled_for
  - Send cancellation confirmation email
- [ ] **Task 4.2.3**: Update user queries to filter soft-deleted
  - Add WHERE clause: deleted_at IS NULL
  - Update all GetUser queries
  - Update authentication queries
- [ ] **Task 4.2.4**: Create scheduled job for hard deletion
  - Query users WHERE deletion_scheduled_for < NOW()
  - Hard delete (CASCADE removes all related data)
  - Run daily via cron or scheduler
- [ ] **Task 4.2.5**: Create API endpoints
  - POST /api/v1/users/me/delete (schedule deletion)
  - POST /api/v1/users/me/undelete (cancel deletion)
- [ ] **Task 4.2.6**: Write backend tests
  - Test soft delete
  - Test hard delete job
  - Test recovery
  - Test query filtering
- [ ] **Task 4.2.7**: Create "Danger Zone" section in Settings
  - Red warning box
  - Password input
  - Confirmation text input (must type "DELETE MY ACCOUNT")
  - Modal with final warning
  - Delete button
- [ ] **Task 4.2.8**: Create recovery page for soft-deleted users
  - Show when soft-deleted user tries to login
  - "Your account is scheduled for deletion on [date]"
  - "Recover Account" button
- [ ] **Task 4.2.9**: Create `useDeleteAccount` hooks
  - `useScheduleAccountDeletion` - Schedule deletion mutation
  - `useCancelAccountDeletion` - Cancel deletion mutation
- [ ] **Task 4.2.10**: Write frontend tests
  - Test deletion form
  - Test confirmation flow
  - Test recovery UI

**Acceptance Criteria**:
- [ ] Users can schedule account deletion
- [ ] 30-day recovery period enforced
- [ ] Soft-deleted users cannot login
- [ ] Users can recover within 30 days
- [ ] Hard delete happens automatically after 30 days
- [ ] All tests passing

---

## Phase 5: Testing & Documentation (Week 4, continued)

### 5.1 Integration Testing
- [ ] **Task 5.1.1**: Test complete password reset flow
  - Request → Email → Reset → Login
  - Verify all states work
- [ ] **Task 5.1.2**: Test complete email verification flow
  - Register → Email → Verify → Unlock features
- [ ] **Task 5.1.3**: Test bot prevention
  - Try CAPTCHA bypass → blocked
  - Try honeypot → blocked
  - Try IP limit → blocked
  - Try disposable email → blocked
- [ ] **Task 5.1.4**: Test session management
  - Create multiple sessions
  - Revoke one → verify others remain
  - Change password → verify all others revoked
- [ ] **Task 5.1.5**: Test account deletion
  - Schedule → soft deleted
  - Try login → blocked
  - Recover → restored
  - Wait 30 days (simulate) → hard deleted

**Acceptance Criteria**:
- [ ] All integration tests passing
- [ ] All user flows work end-to-end
- [ ] Edge cases handled correctly

---

### 5.2 Manual UI Testing
- [ ] **Task 5.2.1**: Test password change flow in browser
  - Login → Settings → Change password → Verify success
  - Try login with old password → fails
  - Login with new password → works
  - Check other session invalidated
- [ ] **Task 5.2.2**: Test password reset flow in browser
  - Logout → Forgot password? → Complete flow
  - Check MailHog for email
  - Click link → Reset → Login
- [ ] **Task 5.2.3**: Test email verification in browser
  - Create account → Check unverified state
  - Try to create game → blocked
  - Verify email → feature unlocked
- [ ] **Task 5.2.4**: Test bot prevention in browser
  - Try registration without CAPTCHA → blocked
  - Fill honeypot → blocked
  - Complete valid registration → works
- [ ] **Task 5.2.5**: Test username/email changes
  - Change username → verify success
  - Change email → verify two-step flow
- [ ] **Task 5.2.6**: Test session management
  - Open in Chrome + Firefox → see both sessions
  - Revoke Firefox session → verify logged out there
- [ ] **Task 5.2.7**: Test account deletion
  - Schedule deletion → verify confirmation
  - Logout → Login → see recovery option
  - Recover → verify account restored

**Acceptance Criteria**:
- [ ] All manual test scenarios pass
- [ ] UI displays correctly
- [ ] Error messages clear and helpful
- [ ] Loading states show appropriately
- [ ] No console errors

---

### 5.3 Documentation
- [ ] **Task 5.3.1**: Update `.env.example`
  - Add all new environment variables
  - Add comments explaining each
- [ ] **Task 5.3.2**: Create email setup guide
  - Document Resend setup process
  - Document MailHog local setup
  - Document domain verification (SPF/DKIM)
- [ ] **Task 5.3.3**: Create hCaptcha setup guide
  - Document signup process
  - Document key configuration
  - Document testing with disabled CAPTCHA
- [ ] **Task 5.3.4**: Update API documentation
  - Document all new endpoints
  - Include request/response examples
  - Document error codes
- [ ] **Task 5.3.5**: Create user guide for features
  - How to reset password
  - How to verify email
  - How to manage sessions
  - How to delete account
- [ ] **Task 5.3.6**: Update developer onboarding
  - Add setup steps for email/CAPTCHA
  - Add testing instructions

**Acceptance Criteria**:
- [ ] All documentation complete and accurate
- [ ] New developers can set up features from docs
- [ ] User guides clear and helpful

---

## Final Checklist

### Pre-Deployment
- [ ] All unit tests passing (>85% coverage)
- [ ] All integration tests passing
- [ ] All frontend tests passing (>80% coverage)
- [ ] Manual testing complete
- [ ] Performance testing done (API <300ms p95)
- [ ] Security review complete
- [ ] Documentation updated
- [ ] Environment variables configured

### Deployment
- [ ] Database migration tested in staging
- [ ] Resend account configured and verified
- [ ] hCaptcha keys configured
- [ ] MailHog available for development
- [ ] Disposable email list up to date
- [ ] Scheduled job configured for account cleanup

### Post-Deployment
- [ ] Monitor email delivery rates
- [ ] Monitor registration patterns
- [ ] Monitor error rates
- [ ] Check costs (should be $0)
- [ ] Collect user feedback

### Success Metrics (30 days post-launch)
- [ ] >80% of users verify email within 24 hours
- [ ] <10% support tickets for password reset
- [ ] >95% bot registration attempts blocked
- [ ] Zero email delivery failures
- [ ] Zero security incidents
- [ ] Monthly costs: $0

---

**Last Updated**: 2025-01-01
**Next Review**: Start of Week 1
