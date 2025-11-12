# Test Issue #4: Auth Package Insufficient Coverage (62.8%)

## Status: 🟡 IN PROGRESS - Session 3 Planned (Email Verification, Password Reset, V1Me)

## Problem Statement
The authentication package has only **62.8% coverage** despite being the most security-critical component. JWT handling, token refresh, and password reset flows have gaps.

## Current State
- Coverage: **62.8%** (Target: 90%+ for security code)
- Missing areas:
  - JWT edge cases
  - Token refresh scenarios
  - Password reset flow
  - Rate limiting
  - Session management

## Security Impact
- 🔴 **Auth Bypass Risk**: Untested token validation
- 🔴 **Session Hijack Risk**: Refresh token gaps
- 🔴 **Brute Force Risk**: Rate limiting untested

## Critical Untested Scenarios

### JWT Token Validation
```go
// Need tests for:
- Expired tokens
- Malformed tokens
- Wrong signing key
- Missing claims
- Tampered payload
- Token from different environment
```

### Refresh Token Flow
```go
// Need tests for:
- Valid refresh
- Expired refresh token
- Revoked refresh token
- Concurrent refresh attempts
- Refresh with invalid access token
```

### Password Reset
```go
// Need tests for:
- Valid reset flow
- Expired reset token
- Already used token
- Invalid token format
- User doesn't exist
- Concurrent reset attempts
```

## Test Implementation Plan

### auth_jwt_test.go
```go
func TestValidateToken(t *testing.T) {
    tests := []struct {
        name      string
        token     string
        setupFunc func() string
        wantErr   bool
        errMsg    string
    }{
        {
            "valid token",
            setupFunc: createValidToken,
            wantErr:   false,
        },
        {
            "expired token",
            setupFunc: createExpiredToken,
            wantErr:   true,
            errMsg:    "token has expired",
        },
        {
            "wrong signature",
            setupFunc: createTokenWrongKey,
            wantErr:   true,
            errMsg:    "signature is invalid",
        },
        {
            "malformed token",
            token:     "not.a.token",
            wantErr:   true,
            errMsg:    "token is malformed",
        },
        {
            "missing claims",
            setupFunc: createTokenNoClaims,
            wantErr:   true,
            errMsg:    "token claims are invalid",
        },
    }
}
```

### auth_refresh_test.go
```go
func TestRefreshToken(t *testing.T) {
    t.Run("successful refresh", func(t *testing.T) {
        // Setup valid refresh token
        // Call refresh
        // Verify new tokens
    })

    t.Run("expired refresh token", func(t *testing.T) {
        // Create expired refresh token
        // Attempt refresh
        // Verify 401 error
    })

    t.Run("concurrent refresh attempts", func(t *testing.T) {
        // Setup goroutines
        // Attempt concurrent refresh
        // Verify only one succeeds
    })

    t.Run("refresh with revoked token", func(t *testing.T) {
        // Revoke token in DB
        // Attempt refresh
        // Verify rejection
    })
}
```

### auth_rate_limit_test.go
```go
func TestRateLimiting(t *testing.T) {
    t.Run("allows requests under limit", func(t *testing.T) {
        for i := 0; i < 5; i++ {
            err := attemptLogin()
            assert.NoError(t, err)
        }
    })

    t.Run("blocks after limit exceeded", func(t *testing.T) {
        // Exceed limit
        for i := 0; i < 10; i++ {
            attemptLogin()
        }

        // Next request should be blocked
        err := attemptLogin()
        assert.Error(t, err)
        assert.Contains(t, err.Error(), "rate limit exceeded")
    })

    t.Run("resets after time window", func(t *testing.T) {
        // Exceed limit
        // Wait for reset
        // Verify can request again
    })
}
```

## Areas Needing Coverage

### Priority 1: Token Security
- Token validation edge cases
- Token expiration handling
- Signature verification
- Claims validation

### Priority 2: Session Management
- Session creation
- Session invalidation
- Concurrent sessions
- Session timeout

### Priority 3: Password Security
- Password validation rules
- Password history
- Reset token lifecycle
- Brute force protection

### Priority 4: Integration Points
- Database failures
- Network timeouts
- External service failures

## Testing Utilities Needed
```go
// test_helpers.go
func createTokenWithClaims(claims jwt.MapClaims) string
func createExpiredToken() string
func createTokenWrongSignature() string
func setupRateLimiter(limit int, window time.Duration)
```

## Success Metrics
- [ ] Coverage increased to 90%+
- [ ] All JWT scenarios tested
- [ ] Refresh flow fully covered
- [ ] Rate limiting tested
- [ ] Password reset flow tested
- [ ] No auth bypass vulnerabilities

## Security Test Checklist
- [ ] Token cannot be forged
- [ ] Expired tokens rejected
- [ ] Refresh tokens single-use
- [ ] Rate limits enforced
- [ ] Session hijack prevented
- [ ] Password reset secure

## Estimated Effort
**8 hours** - Critical security component

## Next Actions
1. ✅ Add JWT validation edge cases (Session 1 Complete)
2. Add logout and session tests
3. Test complete refresh flow (currently at 55.2%)
4. Add rate limiting tests (VerifyHCaptcha 0%)
5. Test password reset flow
6. Add integration failure tests

---

## Session 1 Work Log: JWT Edge Case Tests (2025-11-11)

**Goal**: Add comprehensive JWT token validation edge case tests

**Coverage Analysis Before**:
- Overall auth package: 62.8%
- JWT functions already well-tested:
  - `CreateToken`: 77.8%
  - `VerifyToken`: 91.7%
  - `DecodeToken`: 88.9%
  - `SetJWTCookie`: 100.0%

**Critical Gaps Identified** (0% coverage):
- `ClearJWTCookie` (logout functionality)
- `V1Logout` (logout endpoint)
- `V1Refresh` (only 55.2% - token refresh flow)
- `VerifyHCaptcha` (bot prevention)
- `V1RevokeAllSessions` (session management)
- `ListUserSessions`, `RevokeSession` (session management)

**Changes Made**:

1. `pkg/auth/jwt_test.go` - Added comprehensive edge case testing
   - **New function**: `TestJWTHandler_TokenEdgeCases` (11 test cases)
   - Empty token → Error
   - Token with only header (missing payload/signature) → Error
   - Token with header+payload but no signature → Error
   - Invalid base64 in token → Error
   - Missing sub claim → Error
   - Missing exp claim → Error
   - Invalid sub type (number instead of string) → Documents behavior
   - Invalid exp format (string instead of number) → Error
   - Very long expiry (100 years) → Decodes successfully (documents lack of max expiry check)
   - Tampered payload → Error
   - Token with null bytes → Error
   - **Total**: 129 lines added, 11 new test cases
   - **File size**: 188 → 317 lines

**Tests Passing**: All 22 JWT tests pass ✅ (11 existing + 11 new)

**Coverage Impact**: 62.8% → 62.8% (no change)
- JWT edge cases were already being exercised by existing integration tests
- The 0% coverage functions are in different areas (logout, refresh, sessions)

**Key Technical Findings**:
- JWT validation is already robust in existing implementation
- Edge cases like malformed tokens, missing claims, and tampered payloads are properly rejected
- No maximum expiry validation exists (tokens can be valid for 100+ years)
- DecodeToken succeeds even with wrong claim types, but VerifyToken catches issues
- The main coverage gaps are in **flow tests** (logout, refresh, session management), not token validation

**Security Validation**:
- ✅ Tokens cannot be forged (wrong signature rejected)
- ✅ Expired tokens rejected
- ✅ Malformed tokens rejected
- ✅ Missing required claims rejected
- ✅ Tampered payload rejected
- ⚠️ No max expiry check (100-year tokens accepted)

**Next Priority**: Add logout, refresh token, and session management tests to address the 0% coverage functions

---

## Session 2 Work Log: Logout, Refresh, and Session Management Tests (2025-11-11)

**Goal**: Add comprehensive tests for logout, refresh token flows, and session management

**Coverage Before Session 2**: 62.8%
**Coverage After Session 2**: 65.3% (+2.5%)

**Changes Made**:

1. **`pkg/auth/auth_integration_test.go`** - Added logout tests
   - Updated `setupAuthTestRouter` to include logout route
   - **New function**: `TestAuthFlow_Logout` (2 test cases)
     - `logout_succeeds`: Verifies logout clears JWT cookie (MaxAge=-1, empty value)
     - `logout_is_idempotent`: Verifies multiple logout calls succeed
   - **Lines added**: ~58 lines
   - **Coverage impact**: V1Logout: 0% → 100%, ClearJWTCookie: 0% → 100%

2. **`pkg/auth/auth_integration_test.go`** - Added refresh token edge case tests
   - **New function**: `TestAuthFlow_RefreshEdgeCases` (6 test cases)
     - `refresh_without_authorization_header`: No auth → 401
     - `refresh_with_invalid_token_format`: Malformed token → 401
     - `refresh_with_expired_token`: Expired token → 401
     - `refresh_with_token_missing_sub_claim`: Missing sub → 401
     - `refresh_with_non_existent_user`: Non-existent user → 401 (middleware catches)
     - `refresh_creates_new_session`: Valid refresh creates new session and cookie
   - **Lines added**: ~148 lines
   - **Coverage impact**: V1Refresh: 55.2% (remained the same - error paths already tested)

3. **`pkg/auth/auth_integration_test.go`** - Added session management tests
   - Updated `setupAuthTestRouter` to include session routes
   - Added `core.RequireAuthenticationMiddleware` for protected routes
   - **New function**: `TestAuthFlow_SessionManagement` (8 test cases)
     - `list_sessions_requires_auth`: No auth → 401
     - `list_sessions_returns_all_user_sessions`: Lists multiple sessions, marks current
     - `revoke_session_requires_auth`: No auth → 401
     - `revoke_session_with_invalid_id`: Invalid ID format → 400
     - `revoke_session_not_belonging_to_user`: Wrong user → 404
     - `revoke_specific_session_succeeds`: Successful revoke, verified by re-listing
     - `revoke_all_sessions_requires_auth`: No auth → 401
     - `revoke_all_sessions_keeps_current`: Revokes all except current, verified count
   - **Lines added**: ~247 lines
   - **Coverage impact**: V1ListSessions: 0% → 71.4%, V1RevokeSession: 0% → 73.5%

4. **Imports updated**: Added `time`, `jwt2`, `strconv`, `db` imports

**Tests Passing**: All 43+ auth tests pass ✅ (previous 22 + new 21)

**Files Modified**: 1 file (`auth_integration_test.go`)
**Total Lines Added**: ~453 lines (logout: 58, refresh: 148, sessions: 247)
**File Size**: 505 → 901 lines

**Coverage Analysis**:

Functions now at 100% coverage:
- ✅ `V1Logout`: 0% → 100%
- ✅ `ClearJWTCookie`: 0% → 100%

Functions with improved coverage:
- ✅ `V1ListSessions`: 0% → 71.4%
- ✅ `V1RevokeSession`: 0% → 73.5%

Functions still needing work:
- ⚠️ `V1ResendVerificationEmail`: 0% (email verification)
- ⚠️ `V1Me`: 57.1% (current user endpoint)
- ⚠️ `V1Register`: 59.3% (registration edge cases)
- ⚠️ `V1ChangePassword`: 61.5% (password change)
- ⚠️ `V1VerifyEmail`: 65.2% (email verification)
- ⚠️ `V1RequestPasswordReset`: 65.0% (password reset)

**Key Technical Findings**:
- Logout implementation correctly clears cookies with `MaxAge=-1`
- Refresh token validation happens in middleware before handler logic
- Session management properly validates ownership before revocation
- Revoke-all-sessions correctly preserves current session
- Authentication middleware (`RequireAuthenticationMiddleware`) catches non-existent users early

**Security Validation**:
- ✅ Logout clears JWT cookie correctly
- ✅ Refresh tokens validated before use
- ✅ Session management requires authentication
- ✅ Users cannot revoke other users' sessions
- ✅ Revoke-all preserves current session

**Next Priority**: Add tests for email verification, password reset, and registration edge cases to reach 90%+ coverage

---

## Session 3 Work Plan: Email Verification, Password Reset, V1Me (2025-11-12)

**Goal**: Add comprehensive tests for critical missing flows and reach 70%+ coverage

**Coverage Before Session 3**: 66.5%
**Target Coverage After Session 3**: 70-75%

**Priority Functions** (Analysis):

**Critical 0% Coverage** (MUST FIX):
1. `V1ResendVerificationEmail` - 0% - Email verification resend
2. `ResendVerificationEmail` (service) - 0% - Service layer
3. `V1CompleteEmailChange` - 0% - Email change completion
4. `VerifyHCaptcha` - 0% - Bot prevention service (hard to test in integration)

**High Priority < 70%**:
5. `V1Me` - 57.1% - Current user endpoint
6. `V1RevokeAllSessions` - 57.1% - Already tested but needs edge cases
7. `V1GetPreferences` - 58.6% - User preferences GET
8. `V1ChangePassword` - 61.5% - Password change flow
9. `V1RequestEmailChange` - 62.1% - Email change initiation
10. `V1DeleteAccount` - 64.7% - Account deletion
11. `V1UpdatePreferences` - 64.7% - Preferences update
12. `V1ResetPassword` - 65.0% - Password reset completion
13. `V1RequestPasswordReset` - 65.0% - Password reset initiation
14. `V1VerifyEmail` - 65.2% - Email verification

**Session 3 Test Plan**:

### 1. Email Verification Flow Tests
**Target**: V1VerifyEmail (65.2% → 90%), V1ResendVerificationEmail (0% → 90%)

```go
func TestAuthFlow_EmailVerification(t *testing.T) {
    t.Run("verify_email_with_valid_token", func(t *testing.T) {
        // Create user with unverified email
        // Generate verification token
        // Call verify endpoint
        // Verify email_verified = true
    })

    t.Run("verify_email_with_expired_token", func(t *testing.T) {
        // Create expired verification token
        // Attempt verification
        // Verify 400 error
    })

    t.Run("verify_email_with_invalid_token", func(t *testing.T) {
        // Use random/malformed token
        // Verify 400 error
    })

    t.Run("verify_email_already_verified", func(t *testing.T) {
        // User already verified
        // Attempt verification again
        // Should succeed (idempotent)
    })

    t.Run("resend_verification_email", func(t *testing.T) {
        // Create unverified user
        // Call resend endpoint
        // Verify new token created
        // Verify old token invalidated
    })

    t.Run("resend_verification_already_verified", func(t *testing.T) {
        // User already verified
        // Attempt resend
        // Verify 400 error
    })

    t.Run("resend_verification_rate_limit", func(t *testing.T) {
        // Call resend multiple times rapidly
        // Verify rate limiting applied
    })
}
```

### 2. Password Reset Comprehensive Tests
**Target**: V1RequestPasswordReset (65% → 90%), V1ResetPassword (65% → 90%)

```go
func TestAuthFlow_PasswordResetEdgeCases(t *testing.T) {
    t.Run("request_reset_non_existent_email", func(t *testing.T) {
        // Request reset for non-existent email
        // Should succeed (don't leak user existence)
    })

    t.Run("request_reset_multiple_times", func(t *testing.T) {
        // Request reset multiple times
        // Verify only latest token is valid
    })

    t.Run("reset_password_with_expired_token", func(t *testing.T) {
        // Create expired reset token
        // Attempt reset
        // Verify 400 error
    })

    t.Run("reset_password_with_used_token", func(t *testing.T) {
        // Use token once successfully
        // Attempt to use same token again
        // Verify 400 error (single-use)
    })

    t.Run("reset_password_invalidates_sessions", func(t *testing.T) {
        // User has active sessions
        // Reset password
        // Verify all sessions invalidated
    })

    t.Run("reset_password_weak_password", func(t *testing.T) {
        // Attempt reset with weak password
        // Verify validation error
    })
}
```

### 3. V1Me Endpoint Edge Cases
**Target**: V1Me (57.1% → 90%)

```go
func TestAuthFlow_CurrentUserEndpoint(t *testing.T) {
    t.Run("me_returns_current_user_info", func(t *testing.T) {
        // Create and login user
        // Call /me endpoint
        // Verify correct user data returned
    })

    t.Run("me_requires_authentication", func(t *testing.T) {
        // Call /me without auth
        // Verify 401 error
    })

    t.Run("me_with_expired_token", func(t *testing.T) {
        // Use expired JWT
        // Verify 401 error
    })

    t.Run("me_with_deleted_user", func(t *testing.T) {
        // Get token for user
        // Delete user
        // Call /me with old token
        // Verify 401 error (middleware catches)
    })

    t.Run("me_includes_email_verified_status", func(t *testing.T) {
        // Verify response includes email_verified field
    })
}
```

### 4. Change Password Edge Cases
**Target**: V1ChangePassword (61.5% → 90%)

```go
func TestAuthFlow_ChangePasswordEdgeCases(t *testing.T) {
    t.Run("change_password_requires_current", func(t *testing.T) {
        // Attempt change without current password
        // Verify 400 error
    })

    t.Run("change_password_wrong_current", func(t *testing.T) {
        // Provide incorrect current password
        // Verify 400/401 error
    })

    t.Run("change_password_weak_new", func(t *testing.T) {
        // Attempt change to weak password
        // Verify validation error
    })

    t.Run("change_password_same_as_current", func(t *testing.T) {
        // Use same password as current
        // May allow or reject based on policy
    })

    t.Run("change_password_invalidates_other_sessions", func(t *testing.T) {
        // User has multiple sessions
        // Change password in one session
        // Verify other sessions invalidated
    })
}
```

**Implementation Order**:
1. Email verification tests (highest priority, 0% functions)
2. Password reset edge cases (security critical)
3. V1Me endpoint tests (simple, quick wins)
4. Change password edge cases (security critical)

**Expected Outcomes**:
- Coverage increase to 70-75%
- All 0% critical functions covered
- Email verification flow fully tested
- Password reset security validated
- Change password edge cases covered

**Files to Modify**:
- `pkg/auth/auth_integration_test.go` - Add new test functions

**Estimated Lines**: ~400-500 lines of test code

**Next Session Priority**: Account management (V1DeleteAccount, preferences, email change)

---

## Session 3 Implementation Status (2025-11-12)

**Status**: 🔨 IN PROGRESS - Router updated, ready for test implementation

### Changes Made So Far

1. **Updated `setupAuthTestRouter` function** (pkg/auth/auth_integration_test.go:627-666)
   - Added public routes:
     - `POST /api/v1/auth/request-password-reset`
     - `POST /api/v1/auth/reset-password`
     - `GET /api/v1/auth/validate-reset-token`
     - `POST /api/v1/auth/verify-email`
   - Added protected routes:
     - `GET /api/v1/auth/me`
     - `POST /api/v1/auth/change-password`
     - `POST /api/v1/auth/resend-verification`

### Test Implementation Checklist

#### 1. Email Verification Tests (0% → Target 90%)
**Location**: Add after line 1287 in `auth_integration_test.go`
**Function**: `TestAuthFlow_EmailVerification`

- [ ] `verify_email_with_valid_token` - Create user, generate token, verify
- [ ] `verify_email_with_expired_token` - Use expired token, expect 400
- [ ] `verify_email_with_invalid_token` - Random token, expect 400
- [ ] `verify_email_already_verified` - Idempotent verification
- [ ] `resend_verification_email` - Create new token, invalidate old
- [ ] `resend_verification_already_verified` - Expect 400
- [ ] `resend_verification_requires_auth` - Test auth requirement

**Estimated lines**: ~140

#### 2. Password Reset Comprehensive Tests (65% → Target 90%)
**Location**: Add after Email Verification tests
**Function**: `TestAuthFlow_PasswordReset`

- [ ] `request_reset_non_existent_email` - Should succeed (don't leak)
- [ ] `request_reset_multiple_times` - Latest token valid
- [ ] `reset_password_with_expired_token` - Expect 400
- [ ] `reset_password_with_used_token` - Single-use enforcement
- [ ] `reset_password_invalidates_sessions` - Verify session cleanup
- [ ] `reset_password_weak_password` - Validation error
- [ ] `validate_reset_token_valid` - Token validation endpoint
- [ ] `validate_reset_token_expired` - Expired token validation

**Estimated lines**: ~160

#### 3. V1Me Endpoint Tests (57.1% → Target 90%)
**Location**: Add after Password Reset tests
**Function**: `TestAuthFlow_CurrentUserEndpoint`

- [ ] `me_returns_current_user_info` - Happy path
- [ ] `me_requires_authentication` - No auth → 401
- [ ] `me_with_expired_token` - Expired → 401
- [ ] `me_with_deleted_user` - Deleted user → 401
- [ ] `me_includes_email_verified_status` - Check response fields

**Estimated lines**: ~100

#### 4. Change Password Tests (61.5% → Target 90%)
**Location**: Add after V1Me tests
**Function**: `TestAuthFlow_ChangePassword`

- [ ] `change_password_success` - Happy path
- [ ] `change_password_requires_current` - Missing current → 400
- [ ] `change_password_wrong_current` - Incorrect current → 400
- [ ] `change_password_weak_new` - Weak password → 400
- [ ] `change_password_requires_auth` - No auth → 401

**Estimated lines**: ~100

### Implementation Notes

**Helper Functions Needed**:
```go
// createUserWithToken - Create user, login, return token
// createExpiredVerificationToken - Create expired email verification token
// createExpiredResetToken - Create expired password reset token
```

**Database Tables to Clean**:
```go
defer testDB.CleanupTables(t, "email_verification_tokens", "password_reset_tokens", "sessions", "users")
```

**Test Pattern**:
```go
func TestAuthFlow_EmailVerification(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "email_verification_tokens", "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	router := setupAuthTestRouter(app)

	t.Run("verify_email_with_valid_token", func(t *testing.T) {
		// Test implementation
	})
	// ... more subtests
}
```

### Next Steps to Complete Session 3

1. **Implement Test Functions** (~400-500 lines total)
   - Copy test patterns from existing tests (Logout, Refresh, Sessions)
   - Follow TDD approach: write test → verify it fails → run against existing code → verify it passes

2. **Run Tests and Measure Coverage**
   ```bash
   cd backend
   go test -cover ./pkg/auth
   go test -coverprofile=/tmp/auth_coverage.out ./pkg/auth
   go tool cover -func=/tmp/auth_coverage.out | grep -E "V1|VerifyHCaptcha|ChangePassword"
   ```

3. **Verify Coverage Goals**
   - V1VerifyEmail: 65.2% → 90%+
   - V1ResendVerificationEmail: 0% → 90%+
   - V1RequestPasswordReset: 65.0% → 90%+
   - V1ResetPassword: 65.0% → 90%+
   - V1Me: 57.1% → 90%+
   - V1ChangePassword: 61.5% → 90%+
   - **Overall**: 66.5% → 70-75%+

4. **Document Results**
   - Update Session 3 Work Log below with:
     - Coverage before/after
     - Test counts added
     - Lines of code added
     - Functions improved
     - Security validations completed

### Ready to Implement

The router is configured, the plan is detailed, and the patterns are established from Session 1 and Session 2. The test implementation can proceed systematically following the checklist above.

**Continuation Point**: Begin with `TestAuthFlow_EmailVerification` at line 1288 in `pkg/auth/auth_integration_test.go`
