# User Account Security - Context & Decisions

**Last Updated**: 2025-01-01

---

## Key Decisions Made

### Email Provider Strategy
**Decision**: Use Resend for production, MailHog for local development
**Rationale**:
- Resend offers 3,000 emails/month free (no credit card required)
- Simple API integration (easier than SMTP)
- MailHog provides local SMTP server for development testing
- Both solutions are $0 cost for hobby project scale

**Alternatives Considered**:
- Gmail SMTP: Against TOS for automated systems, poor deliverability
- Mailgun: Requires credit card even for trial, expensive after trial
- Brevo: Good option (300/day free), but daily limits less flexible than monthly

### Bot Prevention Strategy
**Decision**: Multi-layer MVP approach (hCaptcha + rate limiting + honeypot + IP tracking + disposable email blocking)
**Rationale**:
- hCaptcha is free unlimited, better privacy than reCAPTCHA
- Rate limiting stops brute force without external dependencies
- Honeypot catches dumb bots with zero cost
- IP tracking prevents mass signups from single source
- Disposable email list prevents throwaway accounts

**NOT Implementing** (out of scope):
- Account age restrictions/graduated permissions
- Reputation scoring systems
- Advanced machine learning detection
- Phone verification

### Email Verification Enforcement
**Decision**: Strict enforcement for ALL users (new and existing)
**Rationale**:
- App isn't live yet, so no legacy users to migrate
- Prevents spam/bot accounts from day one
- Better security posture from launch

**Feature Gating**:
- Unverified users CAN: Browse games, update settings, login
- Unverified users CANNOT: Create games, join games, create characters, post messages

### Account Deletion Strategy
**Decision**: 30-day soft delete with recovery period
**Rationale**:
- Protects against accidental deletions
- Standard industry practice (Google, Microsoft use similar)
- Automated hard delete after 30 days via scheduled job

**Implementation**:
- Set `deleted_at` and `deletion_scheduled_for` timestamps
- Filter out soft-deleted users in queries
- Scheduled job runs daily to hard delete expired accounts

### Username Changes
**Decision**: Allow unlimited username changes (for now)
**Rationale**:
- Simple to implement initially
- Can add cooldown period later if abused
- Provides user flexibility
- JWT contains username, so new token issued on change

---

## Key Files & Locations

### Backend Files (New)

**Email Service**:
- `backend/pkg/email/service.go` - Email sending service implementation
- `backend/pkg/email/templates/*.html` - Email HTML templates
- `backend/pkg/email/disposable.go` - Disposable email domain checking

**CAPTCHA Service**:
- `backend/pkg/captcha/hcaptcha.go` - hCaptcha verification service

**Auth Service**:
- `backend/pkg/auth/password.go` - Password change/reset logic
- `backend/pkg/auth/email_verification.go` - Email verification logic
- `backend/pkg/auth/account.go` - Username/email change logic
- `backend/pkg/auth/sessions.go` - Session management logic

**Bot Prevention**:
- `backend/pkg/middleware/ratelimit.go` - Rate limiting middleware
- `backend/pkg/botprevention/service.go` - Bot detection logic

**Database**:
- `backend/pkg/db/migrations/20250101000000_add_account_security_features.up.sql`
- `backend/pkg/db/migrations/20250101000000_add_account_security_features.down.sql`
- `backend/pkg/db/queries/auth.sql` - All auth-related queries

### Backend Files (Modified)

**Core**:
- `backend/pkg/core/interfaces.go` - Add new service interfaces
- `backend/pkg/core/models.go` - Add new domain models
- `backend/pkg/core/errors.go` - Add new error types (if needed)

**HTTP**:
- `backend/pkg/http/root.go` - Add new routes with rate limiting
- `backend/pkg/users/api.go` - Add account management endpoints

**Registration**:
- `backend/pkg/auth/register.go` - Add CAPTCHA, honeypot, bot prevention

### Frontend Files (New)

**Pages**:
- `frontend/src/pages/ForgotPasswordPage.tsx` - Request password reset
- `frontend/src/pages/CheckEmailPage.tsx` - "Check your email" confirmation
- `frontend/src/pages/ResetPasswordPage.tsx` - Reset password form
- `frontend/src/pages/ResetSuccessPage.tsx` - Reset success confirmation
- `frontend/src/pages/EmailVerificationPage.tsx` - Email verification success

**Components**:
- `frontend/src/components/auth/HCaptcha.tsx` - CAPTCHA widget component
- `frontend/src/components/auth/PasswordStrengthMeter.tsx` - Password strength indicator
- `frontend/src/components/auth/PasswordInput.tsx` - Password input with visibility toggle
- `frontend/src/components/auth/VerificationBanner.tsx` - Email verification banner
- `frontend/src/components/settings/AccountSecurity.tsx` - Settings section
- `frontend/src/components/settings/AccountInformation.tsx` - Settings section
- `frontend/src/components/settings/ActiveSessions.tsx` - Settings section
- `frontend/src/components/settings/DangerZone.tsx` - Settings section

**Hooks**:
- `frontend/src/hooks/usePasswordReset.ts` - Password reset flow hooks
- `frontend/src/hooks/useEmailVerification.ts` - Email verification hooks
- `frontend/src/hooks/useAccountManagement.ts` - Username/email change hooks
- `frontend/src/hooks/useSessions.ts` - Session management hooks

### Frontend Files (Modified)

**Settings Page**:
- `frontend/src/pages/SettingsPage.tsx` - Add new sections

**Registration/Login**:
- `frontend/src/pages/RegisterPage.tsx` - Add CAPTCHA, honeypot field
- `frontend/src/pages/LoginPage.tsx` - Add "Forgot Password?" link

**API Client**:
- `frontend/src/lib/api.ts` - Add new API methods

**Types**:
- `frontend/src/types/auth.ts` - Add new type definitions

---

## Dependencies

### Go Packages (Backend)

**New Dependencies**:
```bash
# hCaptcha verification
go get github.com/hCaptcha/go-hcaptcha

# Rate limiting
go get github.com/didip/tollbooth/v7

# Email sending (Resend SDK)
go get github.com/resendlabs/resend-go/v2
```

**Existing Dependencies** (already in project):
- `github.com/jackc/pgx/v5` - PostgreSQL driver
- `github.com/go-chi/chi/v5` - HTTP router
- `golang.org/x/crypto/bcrypt` - Password hashing
- `github.com/golang-jwt/jwt/v5` - JWT tokens

### NPM Packages (Frontend)

**New Dependencies**:
```bash
# hCaptcha React component
npm install @hcaptcha/react-hcaptcha

# Password strength estimation (optional)
npm install zxcvbn
npm install @types/zxcvbn
```

**Existing Dependencies** (already in project):
- `react-query` - Data fetching
- `axios` - HTTP client
- `react-router-dom` - Routing

### External Services

**Resend (Production Email)**:
- Website: https://resend.com
- Free tier: 3,000 emails/month, 100/day
- No credit card required for free tier
- Setup: Sign up → Verify domain → Get API key
- Documentation: https://resend.com/docs

**hCaptcha (Bot Prevention)**:
- Website: https://www.hcaptcha.com
- Free tier: Unlimited requests
- Setup: Sign up → Get site key + secret key
- Documentation: https://docs.hcaptcha.com

**MailHog (Local Development)**:
- GitHub: https://github.com/mailhog/MailHog
- Run with Docker: `docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog`
- SMTP: localhost:1025
- Web UI: http://localhost:8025

---

## Environment Variables

```env
# Email Provider
EMAIL_PROVIDER=resend              # "resend" | "mailhog" | "smtp"
RESEND_API_KEY=re_...              # Get from resend.com dashboard
EMAIL_FROM=noreply@actionphase.com
EMAIL_FROM_NAME=ActionPhase

# MailHog (development)
MAILHOG_HOST=localhost
MAILHOG_PORT=1025

# hCaptcha
HCAPTCHA_SITE_KEY=10000000-...     # Get from hcaptcha.com
HCAPTCHA_SECRET=0x...              # Get from hcaptcha.com
HCAPTCHA_ENABLED=true              # Set to false to disable in dev

# Bot Prevention
REQUIRE_EMAIL_VERIFICATION=true
MAX_REGISTRATIONS_PER_IP_PER_DAY=5
BLOCK_DISPOSABLE_EMAILS=true
PASSWORD_MIN_LENGTH=8
TOKEN_EXPIRY_HOURS=1               # For password reset/email verification

# Frontend
VITE_HCAPTCHA_SITE_KEY=10000000-...  # Same as backend site key
VITE_API_URL=http://localhost:3000   # Backend URL
```

---

## Testing Data

### Test Users (for manual testing)

**Unverified User**:
- Username: `unverified_user`
- Email: `unverified@example.com`
- Password: `Test1234!`
- email_verified: `FALSE`

**Verified User**:
- Username: `verified_user`
- Email: `verified@example.com`
- Password: `Test1234!`
- email_verified: `TRUE`

### Test Email Addresses

**Valid Emails**:
- `test@example.com`
- `user@actionphase.com`
- `player@gmail.com`

**Disposable Emails** (should be blocked):
- `test@tempmail.com`
- `user@guerrillamail.com`
- `fake@10minutemail.com`

### Test Scenarios

**Password Reset Flow**:
1. Login as `verified_user`
2. Logout
3. Click "Forgot Password?"
4. Enter `verified@example.com`
5. Complete CAPTCHA
6. Check MailHog for reset email
7. Click reset link
8. Set new password
9. Verify old password doesn't work
10. Login with new password

**Email Verification Flow**:
1. Create new account
2. Check MailHog for verification email
3. Try to create game → should be blocked
4. Click verification link
5. Create game → should work

**Bot Prevention**:
1. Try to register without CAPTCHA → blocked
2. Fill honeypot field → silently rejected
3. Create 6 accounts from same IP → 6th blocked
4. Use disposable email → blocked

---

## Integration Points

### Existing Systems

**Authentication Flow**:
- Password reset integrates with existing JWT auth
- New password triggers session invalidation (except current)
- Email verification adds gate to existing feature permissions

**User Table**:
- Adds columns to existing users table
- All existing queries need WHERE clause update for soft delete
- Email field already exists with UNIQUE constraint

**Sessions Table**:
- Already tracks IP, user agent, device
- Session management UI exposes existing data
- Revoke functionality uses existing session deletion

### New Systems

**Email Sending**:
- New EmailService abstraction
- Pluggable providers (Resend/MailHog/SMTP)
- HTML template system for branded emails

**Token Management**:
- New tables for password reset / email verification
- Cryptographically secure random tokens (32 bytes hex)
- Automatic cleanup of expired tokens

**Bot Prevention**:
- CAPTCHA verification on registration
- Rate limiting middleware on sensitive endpoints
- Registration attempt tracking for analytics

---

## Risk Mitigation

### Technical Risks

**Email Deliverability** (Medium Risk):
- **Mitigation**: Use Resend (good reputation), verify domain with SPF/DKIM
- **Fallback**: Test emails in MailHog during development

**Rate Limiting False Positives** (Low Risk):
- **Mitigation**: Conservative limits (3-10/hour), clear error messages
- **Monitoring**: Log all rate limit hits for analysis

**Session Invalidation Issues** (Medium Risk):
- **Mitigation**: Thorough testing of session cleanup, keep current session exempt
- **Rollback**: Can disable password change feature via feature flag if issues arise

**Migration Failures** (Low Risk):
- **Mitigation**: Test migration in staging, have rollback script ready
- **Impact**: Low - additive schema changes, no data loss risk

### Security Risks

**Token Exposure** (Medium Risk):
- **Mitigation**: Tokens are single-use, expire in 1 hour, cryptographically random
- **Monitoring**: Log all token usage, alert on suspicious patterns

**CAPTCHA Bypass** (Low Risk):
- **Mitigation**: Multiple layers (rate limiting, honeypot, IP tracking)
- **Monitoring**: Track registration patterns, alert on spikes

**Email Enumeration** (Low Risk):
- **Mitigation**: Same response whether email exists or not
- **Impact**: Low - email addresses not sensitive in gaming platform

---

## Success Metrics

### Functional Metrics

**Email Delivery**:
- [ ] 100% of password reset emails delivered within 10 seconds
- [ ] 100% of verification emails delivered within 10 seconds
- [ ] Zero email bounces due to configuration issues

**Bot Prevention Effectiveness**:
- [ ] >95% of bot registration attempts blocked
- [ ] <5% false positives (legitimate users blocked)
- [ ] Zero spam accounts created post-launch

**User Adoption**:
- [ ] >80% of users verify email within 24 hours
- [ ] <10% support tickets related to password reset
- [ ] >90% password reset flows completed successfully

### Technical Metrics

**Performance**:
- [ ] All API endpoints <300ms response time (p95)
- [ ] Password reset email sent in <10 seconds
- [ ] Database queries <50ms (p95)

**Reliability**:
- [ ] 99.9% uptime for password reset flow
- [ ] Zero data loss incidents
- [ ] Zero security breaches related to these features

**Cost**:
- [ ] Email costs: $0/month (under free tier)
- [ ] CAPTCHA costs: $0/month (free tier)
- [ ] Total infrastructure costs: $0/month

---

**Last Updated**: 2025-01-01
