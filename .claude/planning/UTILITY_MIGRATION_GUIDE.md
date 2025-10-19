# Utility Migration Guide
**For**: Gradual adoption of core handler utilities
**Created**: 2025-01-20
**Target**: Reduce ~850 lines of repetitive code

## Quick Start

### 1. Identify Patterns in Your Handler

Look for these repetitive patterns in API handlers:

**Pattern A: JWT Extraction** (29 lines → 7 lines)
```go
// OLD PATTERN - 29 lines
token, _, err := jwtauth.FromContext(ctx)
if err != nil {
    h.App.ObsLogger.LogError(ctx, err, "No valid JWT token found")
    render.Render(w, r, core.ErrUnauthorized("no valid token found"))
    return
}
username, ok := token.Get("username")
// ... 20 more lines
```

**Pattern B: Database Error Handling** (8 lines → 5 lines)
```go
// OLD PATTERN - 8 lines
game, err := gameService.GetGame(ctx, gameID)
if err != nil {
    if err == sql.ErrNoRows {
        render.Render(w, r, core.ErrNotFound("game not found"))
        return
    }
    render.Render(w, r, core.ErrInternalError(err))
    return
}
```

**Pattern C: Validation** (5 lines → 3 lines)
```go
// OLD PATTERN - 5 lines
if data.Title == "" {
    h.App.ObsLogger.Warn(ctx, "Validation failed: missing title")
    render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("title is required")))
    return
}
```

### 2. Replace with Utilities

**Pattern A → GetUserIDFromJWT**
```go
// NEW - 7 lines
userService := &db.UserService{DB: h.App.Pool}
userID, errResp := core.GetUserIDFromJWT(ctx, userService)
if errResp != nil {
    h.App.ObsLogger.Error(ctx, "Failed to authenticate user from JWT")
    render.Render(w, r, errResp)
    return
}
```

**Pattern B → HandleDBError**
```go
// NEW - 5 lines
game, err := gameService.GetGame(ctx, gameID)
if err != nil {
    render.Render(w, r, core.HandleDBError(err, "game"))
    return
}
```

**Pattern C → ValidateRequired**
```go
// NEW - 3 lines
if errResp := core.ValidateRequired(data.Title, "title"); errResp != nil {
    render.Render(w, r, errResp)
    return
}
```

## Complete Handler Migration Example

### Before: CreateGame Handler (130 lines)

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

    // OLD: Validation (5 lines)
    if data.Title == "" {
        h.App.ObsLogger.Warn(ctx, "Validation failed: missing title")
        render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("title is required")))
        return
    }

    // OLD: JWT extraction (29 lines)
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

    userService := &db.UserService{DB: h.App.Pool}
    user, err := userService.UserByUsername(username.(string))
    if err != nil {
        h.App.ObsLogger.LogError(ctx, err, "Failed to get user by username",
            "username", username)
        render.Render(w, r, core.ErrUnauthorized("user not found"))
        return
    }

    h.App.ObsLogger.Info(ctx, "Found user for game creation",
        "username", username,
        "user_id", user.ID)
    userID := int32(user.ID)

    // Create game
    gameService := &db.GameService{DB: h.App.Pool}
    game, err := gameService.CreateGame(ctx, core.CreateGameRequest{
        Title:       data.Title,
        Description: data.Description,
        GMUserID:    userID,
        // ... other fields
    })

    // OLD: DB error handling (8 lines)
    if err != nil {
        h.App.ObsLogger.LogError(ctx, err, "Failed to create game")
        if err == sql.ErrNoRows {
            render.Render(w, r, core.ErrNotFound("game not found"))
            return
        }
        render.Render(w, r, core.ErrInternalError(err))
        return
    }

    // Success response
    render.Status(r, http.StatusCreated)
    render.Render(w, r, newGameResponse(game))
}
```

### After: CreateGame Handler (~100 lines)

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

    // NEW: Validation (3 lines)
    if errResp := core.ValidateRequired(data.Title, "title"); errResp != nil {
        render.Render(w, r, errResp)
        return
    }

    // NEW: JWT extraction (7 lines)
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

    // NEW: DB error handling (5 lines)
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

**Lines saved**: ~30 lines in this handler alone

## Step-by-Step Migration Process

### For Each Handler File

1. **Read the handler file**
2. **Count patterns**:
   ```bash
   # JWT extractions
   grep -c "jwtauth.FromContext" backend/pkg/games/api.go

   # DB error checks
   grep -c "sql.ErrNoRows" backend/pkg/games/api.go

   # Validation checks
   grep -c "ErrInvalidRequest.*required" backend/pkg/games/api.go
   ```

3. **Start with JWT extraction** (biggest impact):
   - Find all `jwtauth.FromContext` calls
   - Replace with `core.GetUserIDFromJWT` or `core.GetUsernameFromJWT`
   - Test the endpoint

4. **Move to DB error handling**:
   - Find all database query error checks
   - Replace with `core.HandleDBError`
   - Test the endpoint

5. **Finish with validation**:
   - Find validation checks
   - Replace with `core.ValidateRequired` or `core.ValidateStringLength`
   - Test the endpoint

6. **Measure impact**:
   ```bash
   # Compare file sizes
   git diff --stat backend/pkg/games/api.go

   # Should show something like:
   # backend/pkg/games/api.go | 45 +++++++-------------
   # 1 file changed, 15 insertions(+), 30 deletions(-)
   ```

## Priority Order for Migration

### High Priority (Week 1)
1. `backend/pkg/games/api.go` - Multiple JWT + DB patterns
2. `backend/pkg/characters/api.go` - JWT + validation
3. `backend/pkg/messages/api.go` - JWT + DB errors
4. `backend/pkg/phases/api.go` - Complex handlers
5. `backend/pkg/notifications/api.go` - JWT extraction

**Expected impact**: 100-200 lines eliminated

### Medium Priority (Week 2)
6. `backend/pkg/conversations/api.go`
7. `backend/pkg/auth/api.go`
8. Other smaller handlers

**Expected impact**: 100-150 lines eliminated

### Low Priority (Week 3+)
- Handlers with unique patterns
- Edge cases that don't fit utilities
- Handlers rarely modified

## Testing Checklist

After migrating each handler:

- [ ] Run unit tests: `go test ./backend/pkg/[package]/...`
- [ ] Test endpoint with curl:
  ```bash
  # Example for CreateGame
  curl -X POST http://localhost:3000/api/v1/games \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"Test Game","description":"Test"}'
  ```
- [ ] Check error responses:
  ```bash
  # Test invalid token
  curl -X POST http://localhost:3000/api/v1/games \
    -H "Authorization: Bearer invalid"

  # Test missing field
  curl -X POST http://localhost:3000/api/v1/games \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"description":"Test"}'
  ```
- [ ] Verify logging still works
- [ ] Run integration tests if they exist

## Common Edge Cases

### When NOT to use utilities

**1. Custom error messages**:
```go
// DON'T use utility if you need specific error
if game.State != "recruiting" {
    render.Render(w, r, core.ErrGameNotRecruiting())  // Custom error
    return
}
```

**2. Complex validation**:
```go
// DON'T use ValidateStringLength for complex rules
if len(data.Players) > int(data.MaxPlayers) {
    render.Render(w, r, core.ErrGameFull())  // Custom logic
    return
}
```

**3. Multiple error types**:
```go
// HandleDBError only handles NotFound and Internal
// Use existing error helpers for other cases
```

### When to extend utilities

If you find yourself writing the same pattern 3+ times:
1. Add it to `backend/pkg/core/handler_utils.go`
2. Document it in `backend/pkg/core/UTILITIES_GUIDE.md`
3. Update this migration guide

## Tracking Progress

### Automated Metrics

Create a script: `scripts/track-utility-adoption.sh`
```bash
#!/bin/bash

echo "=== Utility Adoption Metrics ==="

# JWT patterns
old_jwt=$(grep -r "jwtauth.FromContext" backend/pkg --include="*.go" | wc -l)
new_jwt=$(grep -r "GetUserIDFromJWT\|GetUsernameFromJWT" backend/pkg --include="*.go" | wc -l)
echo "JWT Extraction:"
echo "  Old pattern: $old_jwt instances"
echo "  New utility: $new_jwt instances"
echo "  Adoption: $(echo "scale=1; $new_jwt * 100 / ($new_jwt + $old_jwt)" | bc)%"

# DB error patterns
old_db=$(grep -r "sql.ErrNoRows" backend/pkg --include="*.go" | wc -l)
new_db=$(grep -r "HandleDBError" backend/pkg --include="*.go" | wc -l)
echo "DB Error Handling:"
echo "  Old pattern: $old_db instances"
echo "  New utility: $new_db instances"
echo "  Adoption: $(echo "scale=1; $new_db * 100 / ($new_db + $old_db)" | bc)%"
```

### Manual Tracking

Update `.claude/planning/REFACTOR_PROGRESS.md` weekly:
- Handlers migrated
- Lines eliminated
- Patterns remaining
- Issues encountered

## PR Checklist

When submitting a handler migration PR:

- [ ] Title: "refactor: migrate [package] handlers to core utilities"
- [ ] Description includes:
  - Which patterns were replaced
  - How many lines were eliminated
  - Test results (endpoints still work)
- [ ] All tests passing
- [ ] No change in API behavior
- [ ] Updated handler documentation if needed

## Questions?

- **Utilities Guide**: `backend/pkg/core/UTILITIES_GUIDE.md`
- **Progress Tracker**: `.claude/planning/REFACTOR_PROGRESS.md`
- **Original Plan**: `.claude/planning/REFACTOR_04_REVISED.md`
