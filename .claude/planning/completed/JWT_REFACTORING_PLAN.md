# JWT Authentication Refactoring Plan

## Summary

After migrating JWT from localStorage to HTTP-only cookies, we discovered that many handlers bypass the middleware and directly extract `username` from JWT claims. The JWT tokens now only contain `sub` (user ID) and `exp` (expiration), so all these handlers need to be refactored to use the middleware-provided authentication context instead.

## Completed

✅ **JWT Token Generation** (`backend/pkg/auth/jwt.go`)
- Removed `username` claim from JWT
- Tokens now only contain `sub` (user ID) and `exp`

✅ **Middleware** (`backend/pkg/core/middleware.go`)
- Added `strconv` import
- Updated `MiddlewareUserService` interface to use `GetUserByID(userID int)`
- Middleware now extracts `sub` claim and looks up users by ID
- Stores `AuthenticatedUser` in request context

✅ **Password Handlers** (`backend/pkg/auth/password_handlers.go`)
- V1ChangePassword now uses `core.GetAuthenticatedUser(r.Context())`

## Remaining Work

### Files to Refactor (24 locations)

#### 1. `backend/pkg/auth/session_handlers.go` (2 functions)
**Locations**: Lines 34-56, 92-114

**V1ListSessions** (line 34):
```go
// OLD
token, _, err := jwtauth.FromContext(r.Context())
username, ok := token.Get("username")
userService := &db.UserService{DB: h.App.Pool}
user, err := userService.UserByUsername(username.(string))

// NEW
authUser := core.GetAuthenticatedUser(r.Context())
if authUser == nil {
    h.App.Logger.Error("No authenticated user in context")
    render.Render(w, r, core.ErrUnauthorized("authentication required"))
    return
}
```

**V1RevokeSession** (line 92):
- Same pattern as above

---

#### 2. `backend/pkg/auth/account_handlers.go` (4 functions)
**Locations**: Lines 111-132, 177-198, 298-319, 348-369

Functions to update:
- V1ChangeUsername
- V1ChangeEmail
- V1DeleteAccount
- V1GetSessions

All follow the same pattern - replace JWT extraction with `core.GetAuthenticatedUser(r.Context())`

---

#### 3. `backend/pkg/admin/api.go` (1 helper function)
**Location**: Line 20-31

**getUserIDFromToken helper**:
```go
// OLD
func getUserIDFromToken(r *http.Request) (int, error) {
    token, _, err := jwtauth.FromContext(r.Context())
    if err != nil {
        return 0, errors.New("failed to get token from context")
    }
    username, ok := token.Get("username")
    if !ok {
        return 0, errors.New("username not found in token")
    }
    // ... lookup user by username ...
}

// NEW
func getUserIDFromContext(r *http.Request) (int, error) {
    authUser := core.GetAuthenticatedUser(r.Context())
    if authUser == nil {
        return 0, errors.New("authentication required")
    }
    return int(authUser.ID), nil
}
```

---

#### 4. `backend/pkg/conversations/api.go` (1 helper function)
**Location**: Line 21-37

**getUsernameFromToken helper**:
```go
// OLD - returns (userID int, username string, error)
func getUsernameFromToken(r *http.Request) (int, string, error) {
    token, _, err := jwtauth.FromContext(r.Context())
    username, ok := token.Get("username")
    // ... lookup ...
}

// NEW
func getUserFromContext(r *http.Request) (int, string, error) {
    authUser := core.GetAuthenticatedUser(r.Context())
    if authUser == nil {
        return 0, "", fmt.Errorf("authentication required")
    }
    return int(authUser.ID), authUser.Username, nil
}
```

---

#### 5. `backend/pkg/phases/api.go` (1 helper function)
**Location**: Line 16-32

**getUserFromRequest helper**:
```go
// OLD - returns (*core.User, error)
func getUserFromRequest(r *http.Request, userService core.UserServiceInterface) (*core.User, error) {
    token, _, err := jwtauth.FromContext(r.Context())
    username, ok := token.Get("username")
    return userService.UserByUsername(username.(string))
}

// NEW
func getUserFromContext(r *http.Request) (*core.AuthenticatedUser, error) {
    authUser := core.GetAuthenticatedUser(r.Context())
    if authUser == nil {
        return nil, fmt.Errorf("authentication required")
    }
    return authUser, nil
}
```

---

#### 6. `backend/pkg/games/api_audience.go` (5 handlers)
**Locations**: Lines 77-98, 189-210, 273-294, 341-362, 401-422

Functions to update:
- V1JoinAudience
- V1PromoteToCoGM
- V1DemoteFromCoGM
- V1RemoveFromAudience
- V1LeaveAudience

All follow the same pattern.

---

#### 7. `backend/pkg/games/api_applications.go` (3 handlers)
**Locations**: Lines 36-57, 308-329, 436-457

Functions to update:
- V1SubmitApplication
- V1ApproveApplication
- V1RejectApplication

All follow the same pattern.

---

#### 8. `backend/pkg/notifications/api.go` (1 helper function)
**Location**: Line 70-86

**getUsernameFromToken helper**:
Similar to #4 above - returns (userID, username, error).

---

## Refactoring Pattern

### For HTTP Handlers

**Before**:
```go
token, _, err := jwtauth.FromContext(r.Context())
if err != nil {
    h.App.Logger.Error("Failed to get token from context", "error", err)
    render.Render(w, r, core.ErrUnauthorized("invalid token"))
    return
}

username, ok := token.Get("username")
if !ok {
    h.App.Logger.Error("username not found in token")
    render.Render(w, r, core.ErrUnauthorized("username not found in token"))
    return
}

userService := &db.UserService{DB: h.App.Pool}
user, err := userService.UserByUsername(username.(string))
if err != nil {
    h.App.Logger.Error("Failed to find user", "error", err, "username", username)
    render.Render(w, r, core.ErrUnauthorized("user not found"))
    return
}

userID := int(user.ID)
```

**After**:
```go
authUser := core.GetAuthenticatedUser(r.Context())
if authUser == nil {
    h.App.Logger.Error("No authenticated user in context")
    render.Render(w, r, core.ErrUnauthorized("authentication required"))
    return
}

userID := int(authUser.ID)
username := authUser.Username
```

### For Helper Functions Returning (int, error)

```go
func getUserIDFromContext(r *http.Request) (int, error) {
    authUser := core.GetAuthenticatedUser(r.Context())
    if authUser == nil {
        return 0, errors.New("authentication required")
    }
    return int(authUser.ID), nil
}
```

### For Helper Functions Returning (int, string, error)

```go
func getUserFromContext(r *http.Request) (int, string, error) {
    authUser := core.GetAuthenticatedUser(r.Context())
    if authUser == nil {
        return 0, "", fmt.Errorf("authentication required")
    }
    return int(authUser.ID), authUser.Username, nil
}
```

---

## Testing After Refactoring

1. Restart backend: `lsof -ti:3000 | xargs kill && just dev`
2. Run backend tests: `SKIP_DB_TESTS=false just test`
3. Test authentication manually with curl
4. Run E2E tests: `cd frontend && npx playwright test`

---

## Benefits of This Refactoring

1. ✅ **Enables username changes** - Tokens use immutable user ID
2. ✅ **Consistent authentication** - All handlers use the same middleware
3. ✅ **Better testability** - Middleware is easily mockable
4. ✅ **Cleaner code** - No duplicate token extraction logic
5. ✅ **Security** - Single point of JWT validation

---

## Notes

- The middleware (`RequireAuthenticationMiddleware`) must be applied to all protected routes
- Helper functions should be renamed from `getUsernameFromToken` to `getUserFromContext` for clarity
- Some files may have unused `jwtauth` imports after refactoring - these can be removed
