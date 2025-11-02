# JWT Username → User ID Migration Plan

**Created**: 2025-11-01
**Status**: Draft
**Priority**: High - Blocking account security features

## Executive Summary

The current JWT implementation stores `username` as the primary identifier in token claims. This architectural decision prevents users from changing their username, as existing JWTs become invalid after a username change (the middleware looks up users by the old username from the token, which no longer exists in the database).

**Solution**: Migrate to using `user_id` (database primary key) as the JWT subject (`sub` claim), which is:
- Immutable (never changes)
- Standard practice for JWTs (RFC 7519)
- Faster for database lookups (primary key vs string search)
- Enables username changes without token invalidation

## Current Architecture

### JWT Creation (`backend/pkg/auth/jwt.go:31-50`)

```go
func (j *JWTHandler) CreateToken(user *core.User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256,
		jwt.MapClaims{
			// SECURITY: Only include username, not user_id
			// This prevents stale user_id from being used for authorization
			// Backend always looks up current user_id by username from database
			"username": user.Username,
			"exp":      time.Now().Add(time.Hour * 24 * 7).Unix(),
		})
	// ...
}
```

**Problems**:
1. Comment claims this prevents "stale user_id" - this concern is likely incorrect (user IDs don't change)
2. Username changes invalidate existing tokens
3. Database lookup by username is slower than by ID
4. Non-standard JWT pattern (should use `sub` claim)

### JWT Extraction Pattern (`backend/pkg/http/middleware/admin.go`)

```go
// Extract username from token
username, ok := token.Get("username")
if !ok {
    app.Logger.Warn("Admin middleware: username not found in token")
    render.Render(w, r, core.ErrUnauthorized("invalid token"))
    return
}

// Look up user from database
userService := &db.UserService{DB: app.Pool}
user, err := userService.UserByUsername(username.(string))
if err != nil {
    app.Logger.Error("Admin middleware: failed to find user",
        "error", err,
        "username", username)
    render.Render(w, r, core.ErrUnauthorized("user not found"))
    return
}
```

**Problems**:
1. Uses `UserByUsername()` which requires database index on username column
2. After username change, `UserByUsername(old_username)` fails → 401 Unauthorized
3. Forces user to log out and back in after username change

## Proposed Architecture

### JWT Creation (Proposed)

```go
func (j *JWTHandler) CreateToken(user *core.User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256,
		jwt.MapClaims{
			"sub": strconv.Itoa(user.ID),  // Standard JWT subject claim
			"exp": time.Now().Add(time.Hour * 24 * 7).Unix(),
		})
	// Use the secret from app configuration
	secretKey := []byte(j.App.Config.JWT.Secret)
	tokenString, err := token.SignedString(secretKey)
	SessionService := db.SessionService{DB: j.App.Pool}
	j.App.Logger.Info("Creating session for new user", "user_id", user.ID)
	_, err = SessionService.CreateSession(&core.Session{User: user, Token: tokenString})
	if err != nil {
		return "", err
	}
	return tokenString, nil
}
```

### JWT Extraction (Proposed)

```go
// Extract user_id from token
sub, ok := token.Get("sub")
if !ok {
    app.Logger.Warn("Admin middleware: sub (user_id) not found in token")
    render.Render(w, r, core.ErrUnauthorized("invalid token"))
    return
}

// Convert string to int
userID, err := strconv.Atoi(sub.(string))
if err != nil {
    app.Logger.Error("Admin middleware: invalid user_id in token",
        "error", err,
        "sub", sub)
    render.Render(w, r, core.ErrUnauthorized("invalid token"))
    return
}

// Look up user from database (primary key lookup - very fast)
userService := &db.UserService{DB: app.Pool}
user, err := userService.GetUserByID(userID)
if err != nil {
    app.Logger.Error("Admin middleware: failed to find user",
        "error", err,
        "user_id", userID)
    render.Render(w, r, core.ErrUnauthorized("user not found"))
    return
}
```

## Code Changes Required

### 1. Backend: JWT Service

**File**: `backend/pkg/auth/jwt.go`

**Changes**:
- Line 34: Change `"username": user.Username` → `"sub": strconv.Itoa(user.ID)`
- Line 42: Update log message from `"username", user.Username` → `"user_id", user.ID`
- Import `strconv` package

**Testing**:
- Unit test: Verify JWT contains `sub` claim with user ID
- Unit test: Verify JWT does NOT contain `username` claim
- Unit test: Verify `sub` claim is a string representation of integer

### 2. Backend: Authentication Middleware

**Files to Update**:
1. `backend/pkg/http/middleware/admin.go` - Admin middleware
2. `backend/pkg/http/middleware/auth.go` - General auth middleware (if exists)
3. Any other middleware that extracts user from JWT

**Pattern to Search**: `token.Get("username")`

**Changes**:
- Replace `username, ok := token.Get("username")` → `sub, ok := token.Get("sub")`
- Add conversion: `userID, err := strconv.Atoi(sub.(string))`
- Replace `UserByUsername(username)` → `GetUserByID(userID)`
- Update log messages to reference `user_id` instead of `username`

**Testing**:
- Unit test: Verify middleware extracts user ID correctly
- Unit test: Verify middleware rejects tokens without `sub` claim
- Unit test: Verify middleware rejects tokens with invalid `sub` format
- Integration test: Verify authenticated requests work with new JWT format

### 3. Backend: User Service

**File**: `backend/pkg/db/services/users.go`

**Verify Existence**: Ensure `GetUserByID(userID int)` method exists
- If missing, implement it using existing `UserByUsername` pattern
- Should use SQL query: `SELECT * FROM users WHERE id = $1`

**Testing**:
- Unit test: Verify `GetUserByID` returns correct user
- Unit test: Verify `GetUserByID` returns error for non-existent ID

### 4. Backend: Session Management

**File**: Review session-related code to ensure compatibility

**Verify**:
- Session table stores token correctly (no changes needed)
- Session lookup works with new JWT format
- Session invalidation still functions

### 5. Frontend: No Changes Required

The frontend only stores and sends the JWT token. It doesn't parse or validate the claims, so no frontend changes are necessary.

**Verification**:
- Existing frontend should work without modification
- Test login flow after backend changes
- Test authenticated API requests

## Migration Strategy

### Option A: Hard Cutover (Recommended for Development)

**Pros**: Simple, clean break
**Cons**: Logs out all existing users

**Steps**:
1. Deploy backend changes
2. All existing JWTs become invalid (contain `username` not `sub`)
3. Users are forced to log in again
4. New JWTs use `user_id` in `sub` claim

**Impact**: All users logged out, must re-authenticate

### Option B: Gradual Migration (Production-Ready)

**Pros**: No forced logout, smoother transition
**Cons**: More complex, requires dual-mode middleware

**Steps**:
1. Deploy Phase 1: Middleware supports BOTH formats
   - Try extracting `sub` first (new format)
   - Fall back to `username` if `sub` not found (old format)
   - Log which format was used for monitoring
2. Deploy Phase 2: JWT creation uses new format (`sub`)
   - New logins get new format
   - Old tokens still work until expiration (7 days)
3. Wait 7+ days for old tokens to expire
4. Deploy Phase 3: Remove old format support from middleware
   - Only accept `sub` claim
   - Reject tokens with `username` claim

**Implementation Example (Phase 1)**:
```go
// Try new format first
if sub, ok := token.Get("sub"); ok {
    userID, err := strconv.Atoi(sub.(string))
    if err == nil {
        user, err = userService.GetUserByID(userID)
        app.Logger.Info("Auth: using new JWT format (sub)", "user_id", userID)
    }
}

// Fall back to old format
if user == nil {
    if username, ok := token.Get("username"); ok {
        user, err = userService.UserByUsername(username.(string))
        app.Logger.Warn("Auth: using old JWT format (username)", "username", username)
    }
}

if user == nil {
    render.Render(w, r, core.ErrUnauthorized("invalid token"))
    return
}
```

## Testing Plan

### Before Migration

1. **Verify Current Tests Pass**:
   ```bash
   just test                    # Backend tests
   just test-frontend           # Frontend tests
   npx playwright test          # E2E tests (with skipped tests)
   ```

2. **Document Current Behavior**:
   - Login as test user
   - Capture JWT token from browser DevTools
   - Decode token and verify it contains `username` claim

### During Migration

1. **Unit Tests** (TDD - Write First):
   - JWT creation includes `sub` claim with user ID
   - JWT creation does NOT include `username` claim
   - Middleware extracts `sub` claim correctly
   - Middleware converts `sub` string to integer
   - Middleware looks up user by ID
   - Middleware rejects tokens without `sub`
   - Middleware rejects tokens with invalid `sub` format

2. **Integration Tests**:
   - Login endpoint returns JWT with `sub` claim
   - Authenticated requests work with new JWT format
   - Multiple authenticated requests with same token succeed

3. **Manual API Testing**:
   ```bash
   # Login and get new token
   ./scripts/api-test.sh login-player

   # Decode token to verify structure
   cat /tmp/api-token.txt | cut -d. -f2 | base64 -d | jq .

   # Verify 'sub' claim exists and contains user ID
   # Verify 'username' claim does NOT exist

   # Test authenticated endpoints
   curl -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
        http://localhost:3000/api/v1/auth/me | jq .
   ```

4. **E2E Tests**:
   - Un-skip the 6 skipped tests in `frontend/e2e/settings/account-security.spec.ts`
   - Run full E2E suite: `npx playwright test`
   - Verify username change tests pass
   - Verify email change tests pass
   - Verify delete account tests pass

### After Migration

1. **Smoke Testing**:
   - Login as multiple test users
   - Change username for test user
   - Verify user stays logged in after username change
   - Verify subsequent authenticated requests succeed
   - Change email for test user
   - Delete account for test user

2. **Performance Verification**:
   - Compare database query performance: `UserByUsername()` vs `GetUserByID()`
   - Verify primary key lookup is faster (should be)

3. **Security Audit**:
   - Verify tokens don't leak sensitive information
   - Verify token expiration still works (7 days)
   - Verify session management still functions

## Rollout Plan

### Development Environment

**Recommended**: Option A (Hard Cutover)

**Timeline**: Immediate
1. Make code changes
2. Run test suite
3. Deploy to local development
4. Manual testing
5. Un-skip E2E tests
6. Full E2E suite passes

**Impact**: All developers logged out, must re-login

### Staging Environment

**Recommended**: Option A (Hard Cutover)

**Timeline**: After development testing complete
1. Deploy backend changes
2. Notify team of forced logout
3. Run automated test suite
4. Manual smoke testing
5. Monitor logs for errors

**Impact**: All staging users logged out

### Production Environment

**Recommended**: Option B (Gradual Migration)

**Timeline**: 2-3 week rollout
1. **Week 1**: Deploy Phase 1 (dual-mode middleware)
   - Monitor logs for ratio of old vs new format
   - Verify no errors from old tokens
2. **Week 2**: Deploy Phase 2 (new JWT format)
   - All new logins get new format
   - Monitor error rates
   - Old tokens still work
3. **Week 3**: Deploy Phase 3 (remove old format)
   - After 7+ days (token expiration period)
   - Only new format accepted
   - Monitor for any remaining old tokens

**Impact**: Zero downtime, no forced logouts

## Risks and Mitigation

### Risk 1: User Service Missing GetUserByID Method

**Likelihood**: Low
**Impact**: High (blocks migration)

**Mitigation**:
- Check for method existence before starting
- If missing, implement using existing patterns
- Add comprehensive unit tests

**Pre-Flight Check**:
```bash
grep -r "GetUserByID" backend/pkg/db/services/users.go
```

### Risk 2: Database Performance Degradation

**Likelihood**: Very Low
**Impact**: Medium

**Analysis**: Primary key lookups are faster than string column lookups. Performance should improve, not degrade.

**Mitigation**:
- Benchmark before/after migration
- Monitor database query times
- If issues arise, verify `id` column has primary key index

### Risk 3: Session Management Issues

**Likelihood**: Low
**Impact**: Medium

**Mitigation**:
- Review session table schema before migration
- Verify session creation/lookup/deletion still works
- Add integration tests for session management

### Risk 4: Third-Party JWT Validation

**Likelihood**: Low
**Impact**: Low

**Analysis**: If any external services validate JWTs, they may expect `username` claim.

**Mitigation**:
- Audit codebase for external JWT validation
- Search for: `token.Get("username")` or similar patterns
- Update any external integrations

**Pre-Flight Check**:
```bash
grep -r 'token.Get("username")' backend/
```

### Risk 5: Incomplete Middleware Updates

**Likelihood**: Medium
**Impact**: High (some routes remain broken)

**Mitigation**:
- Search entire codebase for `token.Get("username")`
- Create checklist of all files to update
- Comprehensive integration test coverage
- Code review focuses on JWT extraction patterns

**Pre-Flight Checklist**:
```bash
# Find all middleware that extracts username from JWT
grep -r 'token.Get("username")' backend/pkg/http/middleware/

# Find any other JWT username usage
grep -r '"username".*token' backend/
grep -r 'token.*"username"' backend/
```

## Success Criteria

### Must Have (Blocking)
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] JWT contains `sub` claim with user ID
- [ ] JWT does NOT contain `username` claim
- [ ] Middleware extracts user ID from `sub` correctly
- [ ] Authenticated requests succeed with new JWT
- [ ] Username change works without logout
- [ ] All 6 skipped E2E tests pass

### Should Have (Important)
- [ ] Email change works without logout
- [ ] Account deletion works correctly
- [ ] Session management functions properly
- [ ] Database performance equals or exceeds baseline
- [ ] No error spikes in production logs
- [ ] Documentation updated

### Nice to Have (Optional)
- [ ] Performance improvement measured and documented
- [ ] Migration monitoring dashboard
- [ ] Rollback procedure documented

## Implementation Phases

### Phase 1: Investigation & Planning (COMPLETE)
- [x] Identify root cause (JWT uses username)
- [x] Analyze architecture tradeoffs
- [x] Create migration plan
- [x] Skip failing E2E tests

### Phase 2: Backend Implementation (TDD)
**Estimated Time**: 4-6 hours

**Tasks**:
1. Create `GetUserByID` method (if missing)
2. Write unit tests for JWT creation with `sub` claim
3. Update `CreateToken` to use `user_id` in `sub`
4. Write unit tests for middleware with `sub` extraction
5. Update all middleware to extract `sub` instead of `username`
6. Run backend test suite: `just test`
7. Fix any failing tests

**Definition of Done**:
- All backend unit tests pass
- JWT contains `sub` claim
- Middleware uses `GetUserByID`

### Phase 3: Integration Testing
**Estimated Time**: 2-3 hours

**Tasks**:
1. Start backend: `just dev`
2. Test login API endpoint
3. Decode JWT and verify structure
4. Test authenticated API endpoints
5. Test username change endpoint
6. Test email change endpoint
7. Verify session management

**Definition of Done**:
- Manual API tests pass
- Username change works
- User stays logged in after username change

### Phase 4: E2E Testing
**Estimated Time**: 2-3 hours

**Tasks**:
1. Un-skip 6 E2E tests in `account-security.spec.ts`
2. Run E2E suite: `npx playwright test e2e/settings/account-security.spec.ts`
3. Debug and fix any E2E failures
4. Run full E2E suite: `npx playwright test`
5. Verify all tests pass

**Definition of Done**:
- All 8 account security E2E tests pass
- Full E2E suite passes (no regressions)

### Phase 5: Documentation & Cleanup
**Estimated Time**: 1-2 hours

**Tasks**:
1. Update ADR for authentication strategy
2. Update API documentation
3. Update developer onboarding docs
4. Remove `UserByUsername` if no longer used
5. Remove outdated comments about "stale user_id"
6. Update this plan with "COMPLETE" status

**Definition of Done**:
- Documentation reflects new JWT structure
- Code comments accurate
- No misleading comments remain

## Rollback Plan

### If Issues Arise During Development

**Simple Rollback**:
```bash
git checkout HEAD -- backend/pkg/auth/jwt.go
git checkout HEAD -- backend/pkg/http/middleware/
just dev
```

### If Issues Arise in Staging

**Rollback Steps**:
1. Revert code changes
2. Redeploy previous version
3. All users forced to re-login (acceptable in staging)

### If Issues Arise in Production (Using Option B)

**Phase 1 Rollback** (dual-mode deployed):
- Revert to previous version
- Old tokens continue working
- No user impact

**Phase 2 Rollback** (new format deployed):
- Revert to Phase 1 (dual-mode)
- New tokens work, old tokens work
- No user impact

**Phase 3 Rollback** (old format removed):
- Revert to Phase 2
- Re-enable old format support
- Minimal user impact (recent logins continue working)

## References

### Related Files
- `backend/pkg/auth/jwt.go` - JWT creation logic
- `backend/pkg/http/middleware/admin.go` - Admin middleware (JWT extraction)
- `backend/pkg/db/services/users.go` - User service
- `frontend/e2e/settings/account-security.spec.ts` - E2E tests (6 skipped)
- `frontend/src/components/ChangeUsernameForm.tsx` - Username change UI
- `frontend/src/components/ChangeEmailForm.tsx` - Email change UI

### Related Tests
- `frontend/src/components/ChangeUsernameForm.test.tsx` - Username form tests (some skipped due to MSW issue)
- `frontend/src/components/ChangeEmailForm.test.tsx` - Email form tests (some skipped due to MSW issue)
- `frontend/src/pages/VerifyEmailPage.test.tsx` - Email verification tests

### Standards
- [RFC 7519: JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519)
  - Section 4.1.2: "sub" (Subject) Claim
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

## Appendix: JWT Claim Comparison

### Current (Username-Based)
```json
{
  "username": "TestPlayer1",
  "exp": 1730851272
}
```

**Decoded Token**:
```bash
# Header
{
  "alg": "HS256",
  "typ": "JWT"
}

# Payload
{
  "username": "TestPlayer1",
  "exp": 1730851272
}
```

### Proposed (User ID-Based)
```json
{
  "sub": "42",
  "exp": 1730851272
}
```

**Decoded Token**:
```bash
# Header
{
  "alg": "HS256",
  "typ": "JWT"
}

# Payload
{
  "sub": "42",
  "exp": 1730851272
}
```

### Why `sub` is Standard

From RFC 7519:
> The "sub" (subject) claim identifies the principal that is the subject of the JWT. The claims in a JWT are normally statements about the subject. The subject value MUST either be scoped to be locally unique in the context of the issuer or be globally unique. The processing of this claim is generally application specific.

**Key Points**:
- `sub` is a registered claim name (standard)
- Should contain an identifier that uniquely identifies the user
- User ID is immutable and unique → perfect for `sub`
- Username can change → should NOT be in `sub`

## Notes

### Why the "Stale User ID" Comment is Wrong

The comment in `jwt.go` claims:
> This prevents stale user_id from being used for authorization

**Analysis**: This concern is misguided because:
1. User IDs are **immutable** - they never change in the database
2. There's no such thing as a "stale" user ID
3. The middleware looks up the user from the database on EVERY request anyway
4. If a user is deleted, the database lookup fails regardless of whether we store username or user_id
5. The real security comes from the database lookup, not from what's in the JWT

**Actual Security Flow**:
1. Extract identifier from JWT (whether username or user_id)
2. Look up user in database using that identifier
3. If user doesn't exist → 401 Unauthorized
4. If user is suspended/banned → check user.status
5. If user is valid → continue request

The identifier in the JWT is just a **key for the database lookup**. User IDs are better keys because:
- Faster (primary key index)
- Immutable (supports username changes)
- Standard (JWT `sub` claim convention)
