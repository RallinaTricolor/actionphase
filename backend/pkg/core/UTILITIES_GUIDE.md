# Core Utilities Guide

This document explains the new utility functions in the `core` package that reduce code duplication across API handlers.

## Database Error Handling

### HandleDBError

Converts database errors to appropriate API error responses.

**Before:**
```go
game, err := gameService.GetGame(ctx, gameID)
if err != nil {
    if err == sql.ErrNoRows {
        h.App.ObsLogger.Error(ctx, "Game not found", "game_id", gameID)
        render.Render(w, r, core.ErrNotFound("game not found"))
        return
    }
    h.App.ObsLogger.LogError(ctx, err, "Failed to get game")
    render.Render(w, r, core.ErrInternalError(err))
    return
}
```

**After:**
```go
game, err := gameService.GetGame(ctx, gameID)
if err != nil {
    h.App.ObsLogger.LogError(ctx, err, "Failed to get game", "game_id", gameID)
    render.Render(w, r, core.HandleDBError(err, "game"))
    return
}
```

**Reduction**: 8 lines → 5 lines (37% reduction)

### HandleDBErrorWithID

Same as HandleDBError but includes the ID in the error message.

**Usage:**
```go
user, err := userService.GetUser(ctx, userID)
if err != nil {
    render.Render(w, r, core.HandleDBErrorWithID(err, "user", userID))
    return
}
```

## JWT Token Handling

### GetUserIDFromJWT

Extracts user ID from JWT token with full error handling.

**Before** (29 lines):
```go
// Get user ID from JWT token
token, _, err := jwtauth.FromContext(ctx)
if err != nil {
    h.App.ObsLogger.LogError(ctx, err, "No valid JWT token found")
    render.Render(w, r, core.ErrUnauthorized("no valid token found"))
    return
}

username, ok := token.Get("username")
if !ok {
    h.App.ObsLogger.Error(ctx, "Username not found in JWT token")
    render.Render(w, r, core.ErrUnauthorized("username not found in token"))
    return
}

// Look up user by username to get user ID
userService := &db.UserService{DB: h.App.Pool}
user, err := userService.UserByUsername(username.(string))
if err != nil {
    h.App.ObsLogger.LogError(ctx, err, "Failed to get user by username",
        "username", username)
    render.Render(w, r, core.ErrUnauthorized("user not found"))
    return
}

h.App.ObsLogger.Info(ctx, "Found user for operation",
    "username", username,
    "user_id", user.ID)
userID := int32(user.ID)
```

**After** (5 lines):
```go
// Get user ID from JWT token
userService := &db.UserService{DB: h.App.Pool}
userID, errResp := core.GetUserIDFromJWT(ctx, userService)
if errResp != nil {
    h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
    render.Render(w, r, errResp)
    return
}
```

**Reduction**: 29 lines → 7 lines (76% reduction)

### GetUsernameFromJWT

Extracts just the username from JWT token.

**Before**:
```go
token, _, err := jwtauth.FromContext(ctx)
if err != nil {
    render.Render(w, r, core.ErrUnauthorized("no valid token found"))
    return
}

username, ok := token.Get("username")
if !ok {
    render.Render(w, r, core.ErrUnauthorized("username not found in token"))
    return
}
```

**After**:
```go
username, errResp := core.GetUsernameFromJWT(ctx)
if errResp != nil {
    render.Render(w, r, errResp)
    return
}
```

**Reduction**: 11 lines → 5 lines (55% reduction)

## Validation Helpers

### ValidateRequired

Checks if a required field is empty.

**Before**:
```go
if data.Title == "" {
    h.App.ObsLogger.Warn(ctx, "Validation failed: missing title")
    render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("title is required")))
    return
}
```

**After**:
```go
if errResp := core.ValidateRequired(data.Title, "title"); errResp != nil {
    render.Render(w, r, errResp)
    return
}
```

### ValidateStringLength

Checks string length requirements.

**Usage**:
```go
if errResp := core.ValidateStringLength(title, "title", 3, 255); errResp != nil {
    render.Render(w, r, errResp)
    return
}
```

## Complete Example: CreateGame Handler

### Before Refactoring (130 lines total)

Key sections with duplication:
- Lines 78-106: JWT extraction and user lookup (29 lines)
- Lines 123-133: Database error handling (11 lines)
- Lines 72-76: Validation (5 lines)

### After Refactoring (Estimated ~100 lines)

```go
func (h *Handler) CreateGame(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    defer h.App.ObsLogger.LogOperation(ctx, "api_create_game")()
    h.App.Observability.Metrics.IncrementCounter("games_create_requests")

    // Bind request
    data := &CreateGameRequest{}
    if err := render.Bind(r, data); err != nil {
        h.App.ObsLogger.LogError(ctx, err, "Failed to bind request")
        render.Render(w, r, core.ErrInvalidRequest(err))
        return
    }

    // Validate required fields (REFACTORED)
    if errResp := core.ValidateRequired(data.Title, "title"); errResp != nil {
        render.Render(w, r, errResp)
        return
    }

    // Get user ID from JWT (REFACTORED)
    userService := &db.UserService{DB: h.App.Pool}
    userID, errResp := core.GetUserIDFromJWT(ctx, userService)
    if errResp != nil {
        h.App.ObsLogger.Error(ctx, "Failed to authenticate user")
        render.Render(w, r, errResp)
        return
    }

    // Create game
    gameService := &db.GameService{DB: h.App.Pool}
    game, err := gameService.CreateGame(ctx, core.CreateGameRequest{
        Title:       data.Title,
        Description: data.Description,
        GMUserID:    userID,
        // ... other fields
    })

    // Handle database errors (REFACTORED)
    if err != nil {
        h.App.ObsLogger.LogError(ctx, err, "Failed to create game")
        render.Render(w, r, core.HandleDBError(err, "game"))
        return
    }

    // Success response
    render.Status(r, http.StatusCreated)
    render.Render(w, r, newGameResponse(game))
}
```

**Overall Reduction**: ~30 lines removed from this handler alone
**Across codebase**: Estimated 200-300 lines reduction when applied to all handlers

## Migration Strategy

1. **Start with JWT extraction** - Biggest impact (29 lines → 7 lines per handler)
2. **Add database error handling** - Simple wins (8 lines → 5 lines per query)
3. **Apply validation helpers** - Consistent error messages

## Estimated Impact

Based on codebase analysis:
- **9 API handler files** with JWT extraction patterns
- **~30 handlers** total with JWT extraction
- **~50 database queries** with error handling
- **~20 validation checks**

**Total estimated reduction**:
- JWT extraction: 30 handlers × 22 lines saved = **660 lines**
- DB error handling: 50 queries × 3 lines saved = **150 lines**
- Validation: 20 checks × 2 lines saved = **40 lines**
- **Total: ~850 lines of code eliminated**
- **~25% reduction in API handler code**

## Next Steps

1. Refactor one handler completely as proof of concept
2. Create PR template checklist for using new utilities
3. Gradually migrate existing handlers
4. Update `.claude/context/ARCHITECTURE.md` with patterns
