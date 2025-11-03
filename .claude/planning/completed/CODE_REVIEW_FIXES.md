# Code Review Implementation Plan: Account Security Fixes

**Created**: 2025-11-03
**Status**: Ready for Implementation
**Estimated Effort**: 4-6 hours
**Priority**: HIGH (blocks merge of account security features)

---

## Overview

This document outlines all fixes identified in the comprehensive code review of the account security features and JWT refactoring. Issues are prioritized by severity and grouped for efficient implementation.

---

## 🔴 CRITICAL ISSUES (Fix Before Merge)

### Issue 1: Missing `session_id` in JWT Claims

**Priority**: 🔴 **CRITICAL**
**Effort**: 30 minutes
**Impact**: The `/api/v1/auth/revoke-all-sessions` endpoint currently ALWAYS fails

#### Problem

The `V1RevokeAllSessions` handler expects a `session_id` claim in the JWT token, but the token is created without it.

**Failing Code** (`backend/pkg/auth/account_handlers.go:311-318`):
```go
sessionIDFloat, ok := token.Get("session_id")
if !ok {
    h.App.Logger.Error("session_id not found in token")
    render.Render(w, r, core.ErrUnauthorized("session_id not found in token"))
    return
}
```

**Token Creation** (`backend/pkg/auth/jwt.go:48-56`):
```go
token := jwt.NewWithClaims(jwt.SigningMethodHS256,
    jwt.MapClaims{
        "sub": strconv.Itoa(user.ID),
        "exp": time.Now().Add(time.Hour * 24 * 7).Unix(),
        // ⚠️ Missing: "session_id": sessionID
    })
```

#### Solution

**File**: `backend/pkg/auth/jwt.go`

1. Modify `CreateToken` to include `session_id` in JWT claims:

```go
func (j *JWTHandler) CreateToken(user *core.User) (string, error) {
	// First, create a temporary token to get the session created
	tempToken := jwt.NewWithClaims(jwt.SigningMethodHS256,
		jwt.MapClaims{
			"sub": strconv.Itoa(user.ID),
			"exp": time.Now().Add(time.Hour * 24 * 7).Unix(),
		})

	secretKey := []byte(j.App.Config.JWT.Secret)
	tempTokenString, err := tempToken.SignedString(secretKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign temporary token: %w", err)
	}

	// Create session with temporary token
	SessionService := db.SessionService{DB: j.App.Pool}
	j.App.Logger.Info("Creating session for user", "user_id", user.ID, "username", user.Username)
	session, err := SessionService.CreateSession(&core.Session{User: user, Token: tempTokenString})
	if err != nil {
		return "", fmt.Errorf("failed to create session for user %d: %w", user.ID, err)
	}

	// Create final token with session_id
	finalToken := jwt.NewWithClaims(jwt.SigningMethodHS256,
		jwt.MapClaims{
			"sub":        strconv.Itoa(user.ID),
			"session_id": session.ID,  // ✅ Add session_id
			"exp":        time.Now().Add(time.Hour * 24 * 7).Unix(),
		})

	finalTokenString, err := finalToken.SignedString(secretKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign final token: %w", err)
	}

	// Update session with final token
	err = SessionService.UpdateSessionToken(session.ID, finalTokenString)
	if err != nil {
		return "", fmt.Errorf("failed to update session token: %w", err)
	}

	return finalTokenString, nil
}
```

2. Add `UpdateSessionToken` method to `SessionService`:

**File**: `backend/pkg/db/services/sessions.go`

```go
// UpdateSessionToken updates the token for an existing session
func (s *SessionService) UpdateSessionToken(sessionID int32, token string) error {
	queries := db.New(s.DB)
	return queries.UpdateSessionToken(context.Background(), db.UpdateSessionTokenParams{
		ID:    sessionID,
		Token: token,
	})
}
```

3. Add SQL query:

**File**: `backend/pkg/db/queries/sessions.sql`

```sql
-- name: UpdateSessionToken :exec
UPDATE sessions
SET token = $2
WHERE id = $1;
```

4. Run `just sqlgen` to generate code

5. Update JWT tests to verify `session_id` claim:

**File**: `backend/pkg/auth/jwt_test.go`

```go
t.Run("token_contains_session_id", func(t *testing.T) {
	token, err := handler.CreateToken(user)
	core.AssertNoError(t, err, "Token creation should succeed")

	claims, err := handler.DecodeToken(token)
	core.AssertNoError(t, err, "Token decode should succeed")

	// Verify session_id exists in claims
	sessionID, ok := claims["session_id"]
	core.AssertTrue(t, ok, "Token should contain session_id claim")
	core.AssertTrue(t, sessionID != nil, "session_id should not be nil")

	// Verify it's a valid number
	sessionIDFloat, ok := sessionID.(float64)
	core.AssertTrue(t, ok, "session_id should be a number")
	core.AssertTrue(t, sessionIDFloat > 0, "session_id should be positive")
})
```

#### Testing

1. Run unit tests: `just test backend/pkg/auth`
2. Test the endpoint manually:
   ```bash
   # Login
   ./backend/scripts/api-test.sh login-player

   # Revoke all sessions
   curl -X POST http://localhost:3000/api/v1/auth/revoke-all-sessions \
     -H "Authorization: Bearer $(cat /tmp/api-token.txt)"

   # Should return: {"message": "All other sessions revoked successfully"}
   ```
3. Add E2E test for session revocation

---

### Issue 2: Cookie-Based Auth Detection Broken

**Priority**: 🔴 **CRITICAL**
**Effort**: 20 minutes
**Impact**: AuthContext may incorrectly show users as logged out when using cookie-based authentication

#### Problem

The `AuthContext` checks `!!apiClient.getAuthToken()` to determine if a user is authenticated, but `getAuthToken()` returns `null` for cookie-based auth (the new standard). This means users with valid JWT cookies will appear logged out.

**Problematic Code** (`frontend/src/contexts/AuthContext.tsx:35-45`):
```typescript
const { data: isAuthenticated, isLoading: isCheckingAuth } = useQuery({
  queryKey: ['auth'],
  queryFn: () => {
    const hasToken = !!apiClient.getAuthToken();  // ⚠️ Returns false for cookie auth
    console.log('[AuthContext] Checking authentication:', hasToken);
    return hasToken;
  },
  initialData: () => !!apiClient.getAuthToken(),
});
```

**Root Cause** (`frontend/src/lib/api/client.ts:108-121`):
```typescript
getAuthToken(): string | null {
  const legacyToken = localStorage.getItem('auth_token');
  if (legacyToken) {
    return legacyToken;  // Only returns token for legacy localStorage
  }
  // No localStorage token, but cookies might be present
  return null;  // ⚠️ Returns null even if JWT cookie exists
}
```

#### Solution

**File**: `frontend/src/contexts/AuthContext.tsx`

Replace token presence check with API health check:

```typescript
// Check if user is authenticated by attempting to fetch current user
const {
  data: currentUser,
  isLoading: isCheckingAuth,
  error: userError,
  isError: hasAuthError,
} = useQuery({
  queryKey: ['currentUser'],
  queryFn: async () => {
    console.log('[AuthContext] Checking authentication via /auth/me');
    try {
      const response = await apiClient.auth.getCurrentUser();
      console.log('[AuthContext] Authentication successful:', response.data);
      return response.data;
    } catch (error) {
      console.log('[AuthContext] Not authenticated');
      throw error;
    }
  },
  retry: false,
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  refetchOnWindowFocus: true,
});

// Derive authentication state from currentUser query
const isAuthenticated = !hasAuthError && currentUser !== undefined;

// Log user error if it occurs
useEffect(() => {
  if (userError) {
    console.error('[AuthContext] Failed to load user data:', userError);
    setAuthError(userError as Error);
  }
}, [userError]);
```

Update mutations to invalidate the `currentUser` query:

```typescript
// Login mutation
const loginMutation = useMutation({
  mutationFn: async (data: LoginRequest) => {
    console.log('[AuthContext] Attempting login');
    const response = await apiClient.auth.login(data);
    return response;
  },
  onSuccess: (response) => {
    const token = response.data.Token || response.data.token;
    console.log('[AuthContext] Login successful, token received:', !!token);

    if (token) {
      apiClient.setAuthToken(token);
      // Invalidate currentUser query to trigger authentication check
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      setAuthError(null);
    }
  },
});

// Logout function
const logout = async () => {
  console.log('[AuthContext] Logging out');
  try {
    await apiClient.auth.logout();
    console.log('[AuthContext] Backend logout successful');
  } catch (error) {
    console.error('[AuthContext] Backend logout failed:', error);
  } finally {
    apiClient.removeAuthToken();
    queryClient.setQueryData(['currentUser'], null);
    queryClient.clear();
    setAuthError(null);
  }
};

// Update context value
const value: AuthContextValue = {
  currentUser: currentUser || null,
  isAuthenticated,
  isLoading: loginMutation.isPending || registerMutation.isPending,
  isCheckingAuth: isCheckingAuth,
  login: async (data: LoginRequest) => {
    await loginMutation.mutateAsync(data);
  },
  register: async (data: RegisterRequest) => {
    await registerMutation.mutateAsync(data);
  },
  logout,
  error: authError || loginMutation.error || registerMutation.error,
};
```

#### Testing

1. Clear localStorage and cookies
2. Login via `/login` page
3. Verify AuthContext shows `isAuthenticated: true`
4. Refresh page
5. Verify user remains authenticated (JWT cookie persists)
6. Check console for "[AuthContext] Authentication successful"

---

## 🟡 HIGH Priority (Fix in This Sprint)

### Issue 3: Inconsistent Logging with fmt.Printf

**Priority**: 🟡 **HIGH**
**Effort**: 15 minutes
**Impact**: Makes production debugging difficult

#### Problem

`AccountService` uses `fmt.Printf` for logging instead of the structured logger.

**Locations**:
- `backend/pkg/auth/account_service.go:93`
- `backend/pkg/auth/account_service.go:123`
- `backend/pkg/auth/account_service.go:308`
- `backend/pkg/auth/account_service.go:368`
- `backend/pkg/auth/account_service.go:454`

#### Solution

**File**: `backend/pkg/auth/account_service.go`

1. Add Logger to AccountService struct:

```go
// AccountService handles account management operations
type AccountService struct {
	DB           *pgxpool.Pool
	EmailService *email.EmailService
	Logger       core.Logger  // ✅ Add logger
}
```

2. Replace all `fmt.Printf` calls:

**Before**:
```go
fmt.Printf("Failed to send verification email: %v\n", err)
```

**After**:
```go
if s.Logger != nil {
	s.Logger.Warn("Failed to send verification email", "error", err)
}
```

3. Update all handler instantiations:

**File**: `backend/pkg/auth/account_handlers.go`

```go
accountService := &AccountService{
	DB:           h.App.Pool,
	EmailService: emailService,
	Logger:       h.App.Logger,  // ✅ Pass logger
}
```

#### All Replacements

| Line | Old | New |
|------|-----|-----|
| 93 | `fmt.Printf("Failed to send verification email: %v\n", err)` | `s.Logger.Warn("Failed to send verification email", "error", err)` |
| 123 | `fmt.Printf("Failed to mark verification token as used: %v\n", err)` | `s.Logger.Warn("Failed to mark verification token as used", "error", err, "token_id", verificationToken.ID)` |
| 308 | `fmt.Printf("Failed to mark verification token as used: %v\n", err)` | `s.Logger.Warn("Failed to mark email verification token as used", "error", err, "token_id", verificationToken.ID)` |
| 368 | `fmt.Printf("Failed to invalidate user sessions: %v\n", err)` | `s.Logger.Warn("Failed to invalidate user sessions after account deletion", "error", err, "user_id", userID)` |
| 454 | `fmt.Printf("Failed to revoke session %d: %v\n", session.ID, err)` | `s.Logger.Warn("Failed to revoke session", "error", err, "session_id", session.ID, "user_id", userID)` |

#### Testing

1. Run tests: `just test backend/pkg/auth`
2. Trigger error conditions and verify structured logs appear
3. Check logs contain proper fields (error, user_id, session_id, etc.)

---

### Issue 4: Missing Transaction for Email Change

**Priority**: 🟡 **HIGH**
**Effort**: 15 minutes
**Impact**: Edge case allowing token reuse if token marking fails

#### Problem

Email change updates two tables without a transaction. If `MarkEmailVerificationTokenUsed` fails, the email is changed but the token isn't marked as used.

**Location**: `backend/pkg/auth/account_service.go:296-309`

#### Solution

**File**: `backend/pkg/auth/account_service.go`

Wrap operations in transaction:

```go
// CompleteEmailChange completes the email change after verification
func (s *AccountService) CompleteEmailChange(ctx context.Context, req *VerifyEmailRequest) error {
	// Start transaction
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)  // Rollback if not committed

	queries := db.New(tx)

	// Get and validate token (now using transaction)
	verificationToken, err := queries.GetEmailVerificationToken(ctx, req.Token)
	if err != nil {
		return &PasswordValidationError{
			Field:  "token",
			Reason: "invalid or expired verification token",
		}
	}

	// Get user to check pending email change (using transaction)
	user, err := queries.GetUser(ctx, verificationToken.UserID)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Verify the token email matches the pending email change
	if !user.EmailChangePending.Valid || user.EmailChangePending.String != verificationToken.Email {
		return &PasswordValidationError{
			Field:  "token",
			Reason: "no matching pending email change",
		}
	}

	// Update email (clears email_change_pending and sets email_verified = true)
	err = queries.UpdateUserEmail(ctx, db.UpdateUserEmailParams{
		ID:    verificationToken.UserID,
		Email: verificationToken.Email,
	})
	if err != nil {
		return fmt.Errorf("failed to update email: %w", err)
	}

	// Mark token as used
	err = queries.MarkEmailVerificationTokenUsed(ctx, verificationToken.ID)
	if err != nil {
		return fmt.Errorf("failed to mark verification token as used: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit email change transaction: %w", err)
	}

	if s.Logger != nil {
		s.Logger.Info("Email change completed successfully",
			"user_id", verificationToken.UserID,
			"new_email", verificationToken.Email)
	}

	return nil
}
```

Apply same pattern to `VerifyEmail` method (lines 101-127):

```go
// VerifyEmail verifies a user's email using a valid verification token
func (s *AccountService) VerifyEmail(ctx context.Context, req *VerifyEmailRequest) error {
	// Start transaction
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	queries := db.New(tx)

	// Get and validate token
	verificationToken, err := queries.GetEmailVerificationToken(ctx, req.Token)
	if err != nil {
		return &PasswordValidationError{
			Field:  "token",
			Reason: "invalid or expired verification token",
		}
	}

	// Mark user's email as verified
	err = queries.MarkUserEmailVerified(ctx, verificationToken.UserID)
	if err != nil {
		return fmt.Errorf("failed to mark email as verified: %w", err)
	}

	// Mark token as used
	err = queries.MarkEmailVerificationTokenUsed(ctx, verificationToken.ID)
	if err != nil {
		return fmt.Errorf("failed to mark verification token as used: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit email verification transaction: %w", err)
	}

	if s.Logger != nil {
		s.Logger.Info("Email verified successfully", "user_id", verificationToken.UserID)
	}

	return nil
}
```

#### Testing

1. Add test case for transaction rollback:

```go
func TestAccountService_CompleteEmailChange_TransactionRollback(t *testing.T) {
	// Test that if MarkEmailVerificationTokenUsed fails,
	// the email update is also rolled back

	// This requires creating a scenario where UpdateUserEmail succeeds
	// but MarkEmailVerificationTokenUsed fails
	// Could use a mock database or test database with constraints
}
```

2. Manual testing:
   - Request email change
   - Complete verification
   - Verify both operations succeeded
   - Try to reuse token (should fail)

---

### Issue 5: Admin Middleware Redundant Database Lookup

**Priority**: 🟡 **HIGH**
**Effort**: 5 minutes
**Impact**: Extra database query on every admin request

#### Problem

`RequireAdmin` middleware fetches the user from database even though `RequireAuthenticationMiddleware` already fetched it and stored it in context.

**Location**: `backend/pkg/http/middleware/admin.go:44-53`

#### Solution

**File**: `backend/pkg/http/middleware/admin.go`

Replace database lookup with context access:

```go
// RequireAdmin is a middleware that checks if the authenticated user has admin privileges
// This middleware must be used AFTER RequireAuthenticationMiddleware
func RequireAdmin(app *core.App) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get authenticated user from context (set by RequireAuthenticationMiddleware)
			authUser := core.GetAuthenticatedUser(r.Context())
			if authUser == nil {
				app.Logger.Warn("Admin middleware: no authenticated user in context")
				render.Render(w, r, core.ErrUnauthorized("authentication required"))
				return
			}

			// Check if user is admin (no database lookup needed!)
			if !authUser.IsAdmin {
				app.Logger.Warn("Admin middleware: user is not admin",
					"user_id", authUser.ID,
					"username", authUser.Username)
				render.Render(w, r, core.ErrForbidden("admin privileges required"))
				return
			}

			// User is admin, allow request to proceed
			app.Logger.Debug("Admin middleware: access granted",
				"user_id", authUser.ID,
				"username", authUser.Username)
			next.ServeHTTP(w, r)
		})
	}
}
```

#### Testing

**File**: `backend/pkg/http/middleware/admin_test.go`

Update tests to use `RequireAuthenticationMiddleware`:

```go
func TestRequireAdmin(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	app := core.NewTestApp(testDB.Pool)
	userService := &db.UserService{DB: testDB.Pool}

	// Create admin user
	adminUser, _ := userService.CreateUser(&core.User{
		Username: "admin",
		Email:    "admin@example.com",
		Password: "password123",
		IsAdmin:  true,
	})

	// Create non-admin user
	normalUser, _ := userService.CreateUser(&core.User{
		Username: "user",
		Email:    "user@example.com",
		Password: "password123",
		IsAdmin:  false,
	})

	t.Run("allows_admin_user", func(t *testing.T) {
		// Create JWT token for admin
		jwtHandler := &auth.JWTHandler{App: app}
		token, _ := jwtHandler.CreateToken(adminUser)

		// Create request with token
		req := httptest.NewRequest("GET", "/admin/users", nil)
		req.Header.Set("Authorization", "Bearer "+token)

		// Apply both middlewares (authentication + admin)
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		// Chain middlewares: JWT verification -> Authentication -> Admin
		tokenAuth := jwtauth.New("HS256", []byte(app.Config.JWT.Secret), nil)
		middlewareChain := jwtauth.Verifier(tokenAuth)(
			core.RequireAuthenticationMiddleware(userService)(
				middleware.RequireAdmin(app)(handler),
			),
		)

		rec := httptest.NewRecorder()
		middlewareChain.ServeHTTP(rec, req)

		core.AssertEqual(t, http.StatusOK, rec.Code, "Admin user should be allowed")
	})

	t.Run("blocks_non_admin_user", func(t *testing.T) {
		// Similar test with normalUser - should return 403
	})
}
```

---

## 🟢 MEDIUM Priority (Next Sprint)

### Issue 6: Missing Error Wrapping in JWT Creation

**Priority**: 🟢 **MEDIUM**
**Effort**: 5 minutes
**Impact**: Harder to debug session creation failures

#### Solution

**File**: `backend/pkg/auth/jwt.go`

Already addressed in Issue 1 solution (see line with `fmt.Errorf`).

---

### Issue 7: Username Character Validation

**Priority**: 🟢 **MEDIUM**
**Effort**: 10 minutes
**Impact**: Prevents confusing usernames with special characters

#### Problem

Username validation only checks length, not allowed characters.

**Location**: `backend/pkg/auth/account_service.go:140-152`

#### Solution

**File**: `backend/pkg/auth/account_service.go`

1. Add regex validation at package level:

```go
import "regexp"

// Username validation regex: letters, numbers, underscores, hyphens only
var usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

const (
	MinUsernameLength = 3
	MaxUsernameLength = 50
)
```

2. Create validation function:

```go
// validateUsername validates username format and length
func validateUsername(username string) error {
	username = strings.TrimSpace(username)

	if len(username) < MinUsernameLength {
		return &PasswordValidationError{
			Field:  "username",
			Reason: fmt.Sprintf("username must be at least %d characters long", MinUsernameLength),
		}
	}

	if len(username) > MaxUsernameLength {
		return &PasswordValidationError{
			Field:  "username",
			Reason: fmt.Sprintf("username must be at most %d characters long", MaxUsernameLength),
		}
	}

	if !usernameRegex.MatchString(username) {
		return &PasswordValidationError{
			Field:  "username",
			Reason: "username can only contain letters, numbers, underscores, and hyphens",
		}
	}

	return nil
}
```

3. Use in `ChangeUsername`:

```go
func (s *AccountService) ChangeUsername(ctx context.Context, userID int, req *ChangeUsernameRequest) error {
	// Validate current password
	if req.CurrentPassword == "" {
		return &PasswordValidationError{
			Field:  "current_password",
			Reason: "Current password is required",
		}
	}

	// Validate username format
	if err := validateUsername(req.NewUsername); err != nil {
		return err
	}

	// ... rest of function
}
```

4. Also apply to registration handler (`backend/pkg/auth/api.go`):

```go
func (h *Handler) V1Register(w http.ResponseWriter, r *http.Request) {
	// ... parse request ...

	// Validate username
	if err := validateUsername(data.Username); err != nil {
		render.Render(w, r, &core.ErrResponse{
			Err:            err,
			HTTPStatusCode: http.StatusBadRequest,
			StatusText:     "Validation Error",
			ErrorText:      err.Error(),
		})
		return
	}

	// ... rest of handler
}
```

#### Testing

Add test cases:

```go
func TestValidateUsername(t *testing.T) {
	tests := []struct {
		name      string
		username  string
		shouldErr bool
		errReason string
	}{
		{"valid_username", "TestUser123", false, ""},
		{"valid_with_underscore", "test_user", false, ""},
		{"valid_with_hyphen", "test-user", false, ""},
		{"too_short", "ab", true, "at least 3 characters"},
		{"too_long", strings.Repeat("a", 51), true, "at most 50 characters"},
		{"invalid_spaces", "test user", true, "only contain letters"},
		{"invalid_special_chars", "test@user", true, "only contain letters"},
		{"invalid_emoji", "test😀", true, "only contain letters"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateUsername(tt.username)
			if tt.shouldErr {
				core.AssertTrue(t, err != nil, "Should return error")
				core.AssertTrue(t, strings.Contains(err.Error(), tt.errReason),
					"Error should mention: "+tt.errReason)
			} else {
				core.AssertNoError(t, err, "Should not return error")
			}
		})
	}
}
```

---

### Issue 8: Token Refresh Race Condition

**Priority**: 🟢 **MEDIUM**
**Effort**: 15 minutes
**Impact**: Multiple concurrent 401s could trigger multiple refresh requests

#### Problem

Multiple concurrent requests receiving 401 could all trigger token refresh simultaneously.

**Location**: `frontend/src/lib/api/client.ts:49-90`

#### Solution

**File**: `frontend/src/lib/api/client.ts`

Add refresh promise queuing:

```typescript
export class BaseApiClient {
  protected client: ReturnType<typeof axios.create>;
  protected refreshClient: ReturnType<typeof axios.create>;
  private refreshTokenPromise: Promise<any> | null = null;  // ✅ Add queue

  constructor() {
    // ... existing setup ...

    // Add response interceptor with queuing
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Don't try to refresh for auth endpoints
        const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
                               originalRequest.url?.includes('/auth/register');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;

          try {
            // ✅ Queue refresh requests - only one refresh at a time
            if (!this.refreshTokenPromise) {
              console.log('[API Client] Starting token refresh');
              this.refreshTokenPromise = this.refreshClient
                .get('/api/v1/auth/refresh')
                .finally(() => {
                  console.log('[API Client] Token refresh completed');
                  this.refreshTokenPromise = null;
                });
            } else {
              console.log('[API Client] Token refresh already in progress, waiting...');
            }

            // Wait for refresh to complete
            await this.refreshTokenPromise;

            // Retry original request with new cookie
            console.log('[API Client] Retrying original request after refresh');
            return this.client(originalRequest);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);

            // Clear refresh promise on failure
            this.refreshTokenPromise = null;

            // Clear legacy tokens
            localStorage.removeItem('auth_token');

            // Redirect to login (unless already there)
            if (!window.location.pathname.includes('/login') &&
                !window.location.pathname.includes('/games') &&
                window.location.pathname !== '/') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // ... rest of class
}
```

#### Testing

1. Simulate multiple concurrent 401s:

```typescript
// In browser console or test
const promises = [];
for (let i = 0; i < 5; i++) {
  promises.push(fetch('/api/v1/protected-endpoint'));
}
await Promise.all(promises);

// Check network tab - should only see ONE refresh request
```

---

### Issue 9: Magic Numbers in Cooldown Period

**Priority**: 🟢 **MEDIUM**
**Effort**: 5 minutes
**Impact**: Code maintainability

#### Solution

**File**: `backend/pkg/auth/account_service.go`

Add constants at package level:

```go
const (
	// User account constraints
	MinUsernameLength = 3
	MaxUsernameLength = 50

	// Cooldown periods
	UsernameCooldownPeriod = 30 * 24 * time.Hour  // 30 days

	// Token expiration
	EmailVerificationTokenExpiry = 24 * time.Hour  // 24 hours
)
```

Replace magic numbers:

```go
// Line 73: Email verification token expiry
expiresAt := time.Now().Add(EmailVerificationTokenExpiry)

// Line 173: Username change cooldown
cooldownEnd := user.UsernameChangedAt.Time.Add(UsernameCooldownPeriod)
```

---

## 🟢 LOW Priority (Future Enhancements)

### Issue 10: E2E Test - Email Verification Flow

**Priority**: 🟢 **LOW**
**Effort**: 30 minutes
**Impact**: Missing test coverage for complete email verification flow

#### Solution

**File**: `frontend/e2e/settings/account-security.spec.ts`

Add comprehensive email verification test:

```typescript
test('should complete full email verification flow', async ({ page, context }) => {
  // Login as test user
  await loginAs(page, 'PLAYER_5');

  const settingsPage = new SettingsPage(page);
  await settingsPage.goto();
  await settingsPage.clickAccountInformation();

  const newEmail = 'player5_verified@example.com';

  // Step 1: Request email change
  await settingsPage.requestEmailChange(newEmail, 'testpassword123');
  await expect(page.locator('text=/Verification email sent/i')).toBeVisible();

  // Step 2: Get verification token from database
  // (In real scenario, this would come from email link)
  const token = await page.evaluate(async (email) => {
    const response = await fetch('/api/v1/test/get-verification-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    return data.token;
  }, newEmail);

  // Step 3: Navigate to verification URL
  await page.goto(`/verify-email?token=${token}`);

  // Step 4: Verify success message
  await expect(page.locator('text=/Email verified successfully/i')).toBeVisible({ timeout: 5000 });

  // Step 5: Navigate back to settings and verify email changed
  await settingsPage.goto();
  await settingsPage.clickAccountInformation();
  await expect(settingsPage.getCurrentEmailDisplay()).toContainText(newEmail);

  // Step 6: Verify user data updated (AuthContext refetch)
  await page.goto('/dashboard');
  const userEmail = await page.evaluate(() => {
    return window.localStorage.getItem('auth_user_email');
  });
  expect(userEmail).toBe(newEmail);
});
```

**Note**: This requires adding a test-only endpoint to retrieve verification tokens in development mode.

---

### Issue 11: Hardcoded E2E Timeouts

**Priority**: 🟢 **LOW**
**Effort**: 10 minutes
**Impact**: Test flakiness

#### Solution

**File**: `frontend/e2e/fixtures/auth-helpers.ts`

Replace arbitrary timeouts with explicit waits:

```typescript
// Line 93: Before
await page.waitForTimeout(200);  // ⚠️ Arbitrary

// After
await page.locator('button:has-text("Logout")').waitFor({
  state: 'visible',
  timeout: 3000
});
```

**File**: `frontend/e2e/pages/LoginPage.ts`

```typescript
// Line 84: Before
await page.waitForTimeout(500);  // ⚠️ Arbitrary

// After
await page.locator('[data-testid="register-form"]').waitFor({
  state: 'visible',
  timeout: 2000
});
```

---

### Issue 12: Verbose Console Logging in Production

**Priority**: 🟢 **LOW**
**Effort**: 10 minutes
**Impact**: Production console pollution

#### Solution

**File**: `frontend/src/contexts/AuthContext.tsx`

Replace all `console.log` with environment-aware logging:

```typescript
// At top of file
const isDev = import.meta.env.DEV;
const logger = {
  log: isDev ? console.log.bind(console) : () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

// Usage
logger.log('[AuthContext] Checking authentication:', hasToken);
logger.log('[AuthContext] Login successful, token received:', !!token);
logger.error('[AuthContext] Login failed:', error);
```

Or use a proper logging library:

```typescript
import { createLogger } from '@/lib/logger';

const logger = createLogger('AuthContext');

logger.debug('Checking authentication:', hasToken);
logger.info('Login successful');
logger.error('Login failed:', error);
```

---

## 🔵 SECURITY Enhancements (Future Sprint)

### Security 1: Rate Limiting for Sensitive Endpoints

**Priority**: 🔵 **SECURITY**
**Effort**: 20 minutes
**Impact**: Prevents brute force attacks

#### Solution

**File**: `backend/pkg/http/root.go`

Add rate limiting to sensitive endpoints:

```go
import (
	"github.com/didip/tollbooth/v7"
	"github.com/didip/tollbooth/v7/limiter"
)

// Create rate limiters
loginLimiter := tollbooth.NewLimiter(5, &limiter.ExpirableOptions{
	DefaultExpirationTTL: time.Minute,
}).SetIPLookups([]string{"X-Real-IP", "X-Forwarded-For", "RemoteAddr"})

passwordResetLimiter := tollbooth.NewLimiter(3, &limiter.ExpirableOptions{
	DefaultExpirationTTL: time.Hour,
}).SetIPLookups([]string{"X-Real-IP", "X-Forwarded-For", "RemoteAddr"})

// Apply to routes
r.Route("/auth", func(r chi.Router) {
	// Login: 5 attempts per minute per IP
	r.With(middleware.RateLimitMiddleware(loginLimiter)).
		Post("/login", authHandler.V1Login)

	// Password reset: 3 attempts per hour per IP
	r.With(middleware.RateLimitMiddleware(passwordResetLimiter)).
		Post("/request-password-reset", authHandler.V1RequestPasswordReset)

	// Password change: 5 attempts per minute per IP
	r.With(middleware.RateLimitMiddleware(loginLimiter)).
		Post("/change-password", authHandler.V1ChangePassword)

	// Username change: 5 attempts per minute per IP
	r.With(middleware.RateLimitMiddleware(loginLimiter)).
		Post("/change-username", authHandler.V1ChangeUsername)
})
```

Create middleware wrapper:

**File**: `backend/pkg/middleware/ratelimit.go`

```go
// RateLimitMiddleware wraps tollbooth limiter
func RateLimitMiddleware(limiter *limiter.Limiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			httpError := tollbooth.LimitByRequest(limiter, w, r)
			if httpError != nil {
				render.Render(w, r, &core.ErrResponse{
					Err:            fmt.Errorf("rate limit exceeded"),
					HTTPStatusCode: http.StatusTooManyRequests,
					StatusText:     "Too Many Requests",
					ErrorText:      "Rate limit exceeded. Please try again later.",
				})
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

---

### Security 2: CSRF Protection

**Priority**: 🔵 **SECURITY**
**Effort**: 45 minutes
**Impact**: Prevents cross-site request forgery

#### Solution

**File**: `backend/pkg/http/root.go`

Add CSRF middleware (using `gorilla/csrf`):

```go
import "github.com/gorilla/csrf"

// CSRF protection for state-changing endpoints
csrfMiddleware := csrf.Protect(
	[]byte(app.Config.JWT.Secret),
	csrf.Secure(app.Config.Environment == "production"),
	csrf.Path("/"),
	csrf.SameSite(csrf.SameSiteLaxMode),
)

// Apply to authenticated routes
r.Group(func(r chi.Router) {
	r.Use(jwtauth.Verifier(tokenAuth))
	r.Use(core.RequireAuthenticationMiddleware(userService))
	r.Use(csrfMiddleware)  // ✅ Add CSRF protection

	// Protected routes
	r.Post("/auth/change-password", authHandler.V1ChangePassword)
	r.Post("/auth/change-username", authHandler.V1ChangeUsername)
	r.Post("/auth/change-email", authHandler.V1RequestEmailChange)
	r.Delete("/auth/account", authHandler.V1DeleteAccount)
	r.Post("/auth/revoke-all-sessions", authHandler.V1RevokeAllSessions)
})
```

**Frontend**: Add CSRF token to requests

```typescript
// In BaseApiClient
this.client.interceptors.request.use((config) => {
  // Get CSRF token from meta tag (set by backend)
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});
```

---

## Missing Tests

### Backend Unit Tests

**File**: `backend/pkg/auth/account_service_test.go` (NEW)

```go
package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"context"
	"testing"
)

func TestAccountService_ChangeUsername(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "users")
	defer testDB.CleanupTables(t, "users")

	userService := &db.UserService{DB: testDB.Pool}
	accountService := &AccountService{
		DB:     testDB.Pool,
		Logger: core.NewTestLogger(),
	}

	// Create test user
	user, _ := userService.CreateUser(&core.User{
		Username: "testuser",
		Password: "password123",
		Email:    "test@example.com",
	})

	t.Run("successfully_changes_username", func(t *testing.T) {
		err := accountService.ChangeUsername(context.Background(), user.ID, &ChangeUsernameRequest{
			NewUsername:     "newusername",
			CurrentPassword: "password123",
		})
		core.AssertNoError(t, err, "Username change should succeed")

		// Verify username changed
		updatedUser, _ := userService.GetUserByID(user.ID)
		core.AssertEqual(t, "newusername", updatedUser.Username, "Username should be updated")
	})

	t.Run("rejects_incorrect_password", func(t *testing.T) {
		err := accountService.ChangeUsername(context.Background(), user.ID, &ChangeUsernameRequest{
			NewUsername:     "anotherusername",
			CurrentPassword: "wrongpassword",
		})
		core.AssertTrue(t, err != nil, "Should reject incorrect password")
	})

	t.Run("enforces_cooldown_period", func(t *testing.T) {
		// First change succeeds
		err := accountService.ChangeUsername(context.Background(), user.ID, &ChangeUsernameRequest{
			NewUsername:     "username1",
			CurrentPassword: "password123",
		})
		core.AssertNoError(t, err, "First change should succeed")

		// Immediate second change should fail
		err = accountService.ChangeUsername(context.Background(), user.ID, &ChangeUsernameRequest{
			NewUsername:     "username2",
			CurrentPassword: "password123",
		})
		core.AssertTrue(t, err != nil, "Should enforce cooldown period")
		pwdErr, ok := err.(*PasswordValidationError)
		core.AssertTrue(t, ok, "Should be PasswordValidationError")
		core.AssertTrue(t, strings.Contains(pwdErr.Reason, "30 days"), "Should mention cooldown")
	})
}

func TestAccountService_SoftDeleteAccount(t *testing.T) {
	// Test account soft delete
	// Verify sessions invalidated
	// Verify deleted_at timestamp set
}

func TestAccountService_RevokeAllSessions(t *testing.T) {
	// Test session revocation
	// Verify all sessions except current are deleted
}
```

**Estimated Effort**: 2 hours

---

### Frontend Component Tests

**File**: `frontend/src/components/ChangeUsernameForm.test.tsx` (NEW)

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangeUsernameForm } from './ChangeUsernameForm';
import { renderWithProviders } from '../test/test-utils';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';

describe('ChangeUsernameForm', () => {
  it('successfully changes username', async () => {
    const user = userEvent.setup();

    // Mock successful response
    server.use(
      http.post('/api/v1/auth/change-username', () => {
        return HttpResponse.json({ message: 'Username changed successfully' });
      })
    );

    renderWithProviders(<ChangeUsernameForm currentUsername="OldUsername" />);

    // Fill form
    await user.type(screen.getByLabelText(/new username/i), 'NewUsername');
    await user.type(screen.getByLabelText(/current password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /change username/i }));

    // Verify success message
    await waitFor(() => {
      expect(screen.getByText(/username changed successfully/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for incorrect password', async () => {
    const user = userEvent.setup();

    // Mock error response
    server.use(
      http.post('/api/v1/auth/change-username', () => {
        return HttpResponse.json(
          { error: 'incorrect password' },
          { status: 400 }
        );
      })
    );

    renderWithProviders(<ChangeUsernameForm currentUsername="OldUsername" />);

    await user.type(screen.getByLabelText(/new username/i), 'NewUsername');
    await user.type(screen.getByLabelText(/current password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /change username/i }));

    await waitFor(() => {
      expect(screen.getByText(/incorrect password/i)).toBeInTheDocument();
    });
  });
});
```

**Estimated Effort**: 1 hour for both forms

---

## Implementation Order

### Phase 1: Critical Fixes (Day 1)
1. ✅ Issue 1: Add `session_id` to JWT claims (30 min)
2. ✅ Issue 2: Fix cookie-based auth detection (20 min)
3. ✅ Test both fixes thoroughly (30 min)

**Total**: 1.5 hours

### Phase 2: High Priority (Day 1-2)
4. ✅ Issue 3: Replace fmt.Printf with logger (15 min)
5. ✅ Issue 4: Add transactions for email change (15 min)
6. ✅ Issue 5: Optimize admin middleware (5 min)
7. ✅ Add backend unit tests (2 hours)

**Total**: 2.5 hours

### Phase 3: Medium Priority (Day 2-3)
8. ✅ Issue 7: Username character validation (10 min)
9. ✅ Issue 8: Token refresh race condition fix (15 min)
10. ✅ Issue 9: Replace magic numbers with constants (5 min)
11. ✅ Add frontend component tests (1 hour)

**Total**: 1.5 hours

### Phase 4: Low Priority (Day 3-4)
12. ✅ Issue 10: E2E email verification test (30 min)
13. ✅ Issue 11: Remove hardcoded timeouts (10 min)
14. ✅ Issue 12: Environment-aware logging (10 min)

**Total**: 1 hour

### Phase 5: Security Enhancements (Future Sprint)
15. ✅ Security 1: Rate limiting (20 min)
16. ✅ Security 2: CSRF protection (45 min)

**Total**: 1 hour

---

## Testing Checklist

### Unit Tests
- [ ] `backend/pkg/auth/jwt_test.go` - JWT with session_id
- [ ] `backend/pkg/auth/account_service_test.go` - All service methods
- [ ] `backend/pkg/http/middleware/admin_test.go` - Admin middleware

### Integration Tests
- [ ] `/api/v1/auth/change-username` - Success and error cases
- [ ] `/api/v1/auth/request-email-change` - Success and error cases
- [ ] `/api/v1/auth/revoke-all-sessions` - Session revocation

### Component Tests
- [ ] `ChangeUsernameForm.test.tsx` - Form validation and submission
- [ ] `ChangeEmailForm.test.tsx` - Form validation and submission

### E2E Tests
- [ ] `account-security.spec.ts` - All existing tests still pass
- [ ] Email verification flow - Complete flow with token

### Manual Testing
- [ ] Login with cookie-based auth
- [ ] Refresh page, verify still authenticated
- [ ] Change username successfully
- [ ] Change email successfully
- [ ] Revoke all sessions
- [ ] Test rate limiting on login endpoint

---

## Success Criteria

### Functionality
- ✅ All endpoints return expected responses
- ✅ JWT tokens contain session_id claim
- ✅ Cookie-based authentication works correctly
- ✅ Session revocation works as expected
- ✅ Username validation prevents invalid characters

### Testing
- ✅ All unit tests pass (467+ tests)
- ✅ All frontend tests pass (1,022+ tests)
- ✅ All E2E tests pass (30+ tests)
- ✅ New tests cover critical paths

### Code Quality
- ✅ No `fmt.Printf` in service layer
- ✅ Consistent structured logging
- ✅ Transactions for multi-step operations
- ✅ Named constants instead of magic numbers

### Security
- ✅ No security regressions
- ✅ JWT tokens properly validated
- ✅ Sessions properly invalidated on logout
- ✅ Rate limiting on sensitive endpoints (future)

---

## Notes for Implementation

### Database Migrations
None required - all fixes work with existing schema.

### Breaking Changes
None - all changes are backwards compatible.

### Rollback Plan
If issues arise:
1. Revert to previous commit
2. All changes are additive, no schema changes
3. Frontend changes are isolated to AuthContext

### Deployment Considerations
1. Deploy backend first (supports both legacy and new auth)
2. Deploy frontend second (uses new auth check)
3. Monitor error rates for 24 hours
4. Clear user sessions if auth issues persist

---

## Additional Resources

- **Testing Guide**: `.claude/context/TESTING.md`
- **Backend Patterns**: `.claude/context/ARCHITECTURE.md`
- **Frontend Patterns**: `.claude/context/STATE_MANAGEMENT.md`
- **Security Best Practices**: `/docs/adrs/003-authentication-strategy.md`

---

**End of Implementation Plan**
