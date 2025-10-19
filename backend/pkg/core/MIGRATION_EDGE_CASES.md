# Migration Edge Cases & Learnings

**Date**: 2025-01-20
**During**: Week 1, Days 2-3 utility migration

## Edge Cases Discovered

### 1. Optional Authentication Pattern (characters/api.go:592-597)

**Situation**: Handler needs to check if user is authenticated but authentication is optional.

**Pattern**:
```go
// Get user ID from token (optional for public data)
var userID *int32
id, err := h.getUserIDFromToken(r)
if err == nil {
    userID = &id
}

// Later: use userID (may be nil for unauthenticated requests)
if userID != nil {
    // Authorized data access
} else {
    // Public data only
}
```

**Why it works**:
- Utility returns error if auth fails
- Handler ignores error for optional auth
- Uses pointer to distinguish between "not authenticated" (nil) and "authenticated" (valid ID)

**When to use**:
- Endpoints that provide different data based on auth status
- Public endpoints with enhanced features for authenticated users

### 2. Local Helper Functions vs Direct Utility Usage

**Three patterns observed**:

**Pattern A: Local Helper Wrapper (characters/api.go)**
```go
func (h *Handler) getUserIDFromToken(r *http.Request) (int32, error) {
    userService := &services.UserService{DB: h.App.Pool}
    userID, errResp := core.GetUserIDFromJWT(r.Context(), userService)
    if errResp != nil {
        return 0, fmt.Errorf("authentication failed")
    }
    return userID, nil
}
```

**Pros**:
- Single point to change if utility API changes
- Can customize error messages for specific handler file
- Reduces repetition if utility needs handler-specific setup

**Cons**:
- Extra layer of indirection
- Still need to update all call sites if signature changes

**Pattern B: Local Helper with Extra Return Values (messages/api.go - before migration)**
```go
func getUserIDFromToken(r *http.Request, app *core.App) (int32, string, error) {
    // Returned userID AND username
}
```

**Issue**: Returned username for logging, but logging doesn't need username
**Solution**: Changed to return only userID, updated logging to use user_id instead

**Learning**: Don't add return values "just in case" - check actual usage first

**Pattern C: Direct Utility Usage (games/api.go)**
```go
userService := &db.UserService{DB: h.App.Pool}
userID, errResp := core.GetUserIDFromJWT(ctx, userService)
if errResp != nil {
    h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
    render.Render(w, r, errResp)
    return
}
```

**Pros**:
- No extra layers
- Clear what's happening
- Easy to see utility is being used

**Cons**:
- Slightly more verbose at each call site
- Harder to customize error handling per file

**Recommendation**:
- Use Pattern C (direct) for new code
- Use Pattern A (local helper) if file has 3+ handlers using the utility
- Refactor Pattern B away (extra return values that aren't needed)

### 3. Logging Username vs User ID

**Issue**: Several handlers logged `username` from JWT for debugging

**Old Pattern**:
```go
username, ok := token.Get("username")
// ... later
h.App.Logger.Info("Action performed", "username", username)
```

**New Pattern**:
```go
userID, errResp := core.GetUserIDFromJWT(ctx, userService)
// ... later
h.App.Logger.Info("Action performed", "user_id", userID)
```

**Why it's okay**:
- User ID is sufficient for tracking/debugging
- Can look up username from user_id if needed
- Reduces what we extract from JWT
- More consistent (IDs are used throughout the rest of the logs)

**Edge case**: If you truly need username for business logic (not just logging), use `core.GetUsernameFromJWT()` instead

### 4. Import Cleanup

**Pattern**: After migrating away from jwtauth.FromContext, remove unused imports

**Check**:
```bash
go build ./pkg/[package]/...
# Will error if unused imports exist
```

**Files that needed cleanup**:
- characters/api.go - removed `"github.com/go-chi/jwtauth/v5"`
- messages/api.go - removed `"github.com/go-chi/jwtauth/v5"`

**Tip**: Run build after each file migration to catch unused imports immediately

## Patterns That Worked Well

### Replace All Feature

**Situation**: Multiple handlers in same file use identical JWT extraction pattern

**Solution**: Use `replace_all=true` in Edit tool

**Results**:
- games/api.go: Replaced 4 identical patterns at once
- characters/api.go: Replaced 5 identical patterns at once
- Massive time savings

**Caution**: Check for slight variations in pattern before using replace_all

### Helper Function Modernization

**Situation**: File already has helper function that does JWT extraction

**Approach**:
1. Update helper function to use utility internally
2. Update helper function signature if needed
3. Update all call sites to match new signature
4. Test build

**Benefits**:
- Minimal disruption to existing code structure
- Clear migration path
- Easy to review (function-scoped change)

## Common Mistakes to Avoid

### 1. Don't Keep Unused Return Values

**Bad**:
```go
func helper() (int32, string, error) {
    userID, _ := core.GetUserIDFromJWT(...)
    return userID, "", nil  // Empty string is never used!
}
```

**Good**:
```go
func helper() (int32, error) {
    userID, errResp := core.GetUserIDFromJWT(...)
    if errResp != nil {
        return 0, fmt.Errorf("auth failed")
    }
    return userID, nil
}
```

### 2. Don't Forget Error Response Handling

**Bad**:
```go
userID, _ := core.GetUserIDFromJWT(ctx, userService)  // Ignoring error!
```

**Good**:
```go
userID, errResp := core.GetUserIDFromJWT(ctx, userService)
if errResp != nil {
    render.Render(w, r, errResp)  // Proper error response
    return
}
```

### 3. Don't Assume Username is Needed

Check if username is actually used for business logic or just logging.
If just logging, user_id is sufficient.

## Migration Checklist

When migrating a handler file:

- [ ] Find all JWT extraction patterns (`grep -n "jwtauth.FromContext"`)
- [ ] Check if file has helper function (reuse if possible)
- [ ] Update helper function OR use utility directly
- [ ] Replace all call sites
- [ ] Update any logging that used username → use user_id
- [ ] Remove unused jwtauth import
- [ ] Run `go build ./pkg/[package]/...`
- [ ] Check `git diff --stat` for line reduction
- [ ] Update REFACTOR_PROGRESS.md

## Files Migrated Successfully

1. ✅ games/api.go - 76 lines reduced (5 JWT patterns)
2. ✅ characters/api.go - 23 lines reduced (6 JWT patterns + 1 optional auth)
3. ✅ messages/api.go - 12 lines reduced (2 JWT patterns)

**Total**: 111 lines eliminated, 0 breaking changes
