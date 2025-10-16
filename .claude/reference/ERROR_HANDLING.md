# Error Handling Guide for ActionPhase

This document outlines the error handling patterns and conventions used throughout the ActionPhase Go backend.

## Overview

ActionPhase follows a structured approach to error handling that separates internal errors from client-facing responses, provides consistent HTTP status codes, and maintains security by not leaking sensitive information.

## Error Handling Layers

### 1. Service Layer Errors
Services return Go errors with descriptive messages for business logic failures:

```go
// Database constraint violation
if err := db.CreateUser(user); err != nil {
    if isDuplicateKeyError(err) {
        return nil, errors.New("username already exists")
    }
    return nil, fmt.Errorf("failed to create user: %w", err)
}

// Business rule violation
if game.State != "recruitment" {
    return fmt.Errorf("game is not accepting new participants (current state: %s)", game.State)
}
```

### 2. HTTP Handler Error Responses
Handlers convert service errors into structured HTTP responses using `core.ErrResponse`:

```go
func (h *GameHandler) JoinGame(w http.ResponseWriter, r *http.Request) {
    err := h.GameService.JoinGame(ctx, gameID, userID, "player")
    if err != nil {
        if strings.Contains(err.Error(), "not accepting") {
            render.Render(w, r, core.ErrBadRequest(err))
            return
        }
        render.Render(w, r, core.ErrInternalError(err))
        return
    }

    render.Status(r, http.StatusOK)
    render.JSON(w, r, map[string]string{"status": "joined"})
}
```

### 3. Client Error Responses
Clients receive structured JSON error responses:

```json
{
  "status": "Bad request.",
  "error": "game is not accepting new participants (current state: in_progress)"
}
```

## Standard HTTP Error Types

### Authentication & Authorization

```go
// 401 Unauthorized - Invalid or missing credentials
if !isValidToken(token) {
    render.Render(w, r, core.ErrUnauthorized("Invalid or expired token"))
    return
}

// 403 Forbidden - Valid user but insufficient permissions
if !isGameMaster(userID, gameID) {
    render.Render(w, r, core.ErrForbidden("Only game master can update game settings"))
    return
}
```

### Client Request Errors

```go
// 400 Bad Request - Invalid request data or business rule violation
if req.Title == "" {
    render.Render(w, r, core.ErrInvalidRequest(errors.New("title is required")))
    return
}

if game.State == "completed" {
    render.Render(w, r, core.ErrBadRequest(errors.New("cannot join completed game")))
    return
}
```

### Server Errors

```go
// 500 Internal Server Error - System failures
if err := db.SaveGame(game); err != nil {
    log.Error("Database error", "operation", "save_game", "error", err)
    render.Render(w, r, core.ErrInternalError(err))
    return
}
```

## Error Message Guidelines

### User-Facing Messages
- Clear and actionable
- No technical jargon
- Safe to display in UI
- Consistent tone and format

```go
// Good
"Username already exists"
"Game is full (6/6 players)"
"Password must be at least 8 characters"

// Avoid
"UNIQUE constraint violation on users.username"
"Database connection failed"
"Internal server error occurred"
```

### Debug Messages
- Include context for troubleshooting
- Technical details are acceptable
- Never include sensitive data (passwords, tokens)

```go
// Good
"failed to join game: game not in recruitment state (current: in_progress)"
"user authentication failed: invalid username or password"

// Avoid
"user password: secret123 does not match hash: $2a$10$..."
"database connection string: postgres://user:pass@host:5432/db"
```

## Common Error Patterns

### Database Errors

```go
func (s *UserService) CreateUser(user *User) (*User, error) {
    dbUser, err := s.queries.CreateUser(ctx, params)
    if err != nil {
        // Handle specific constraint violations
        if strings.Contains(err.Error(), "users_username_key") {
            return nil, errors.New("username already exists")
        }
        if strings.Contains(err.Error(), "users_email_key") {
            return nil, errors.New("email already registered")
        }

        // Generic database error (don't expose internal details)
        return nil, fmt.Errorf("failed to create user: %w", err)
    }
    return convertUser(dbUser), nil
}
```

### Validation Errors

```go
func validateGameRequest(req CreateGameRequest) error {
    if req.Title == "" {
        return errors.New("title is required")
    }
    if req.MaxPlayers < 1 || req.MaxPlayers > 20 {
        return errors.New("max players must be between 1 and 20")
    }
    if req.StartDate != nil && req.EndDate != nil {
        if req.StartDate.After(*req.EndDate) {
            return errors.New("start date must be before end date")
        }
    }
    return nil
}
```

### Authorization Checks

```go
func (s *GameService) UpdateGame(ctx context.Context, userID int32, req UpdateGameRequest) error {
    game, err := s.GetGame(ctx, req.ID)
    if err != nil {
        return fmt.Errorf("game not found: %w", err)
    }

    // Authorization check
    if game.GmUserID != userID {
        return errors.New("only game master can update game settings")
    }

    // Proceed with update...
    return nil
}
```

## Testing Error Conditions

Always test error paths in your service tests:

```go
func TestGameService_JoinGame_GameNotRecruiting(t *testing.T) {
    // Setup game in non-recruiting state
    game := createTestGame(t, "in_progress")

    // Attempt to join should fail
    err := gameService.JoinGame(ctx, game.ID, userID, "player")

    core.AssertError(t, err, "Should not allow joining non-recruiting game")
    core.AssertEqual(t, true, strings.Contains(err.Error(), "not accepting"), "Error should indicate game state issue")
}
```

## Security Considerations

1. **Never expose internal errors to clients**
   - Database connection strings
   - File paths or system information
   - Stack traces in production

2. **Sanitize error messages**
   - Remove sensitive data before logging
   - Use generic messages for authentication failures
   - Don't reveal whether users/resources exist

3. **Log appropriately**
   - Log internal errors with full context
   - Log security events (failed auth, etc.)
   - Use structured logging for analysis

```go
// Good logging pattern
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
    user, err := h.UserService.UserByUsername(req.Username)
    if err != nil || !user.CheckPasswordHash(req.Password) {
        // Generic error message to client
        render.Render(w, r, core.ErrUnauthorized("Invalid username or password"))

        // Detailed logging for security monitoring
        log.Warn("Login attempt failed",
            "username", req.Username,
            "ip", r.RemoteAddr,
            "user_agent", r.UserAgent(),
            "reason", getFailureReason(err, user))
        return
    }
    // Success path...
}
```

## Migration from Legacy Error Handling

When updating existing handlers to use structured error responses:

1. Replace direct HTTP status writes with `core.ErrResponse`
2. Categorize errors by HTTP status code appropriateness
3. Separate user-facing messages from debug information
4. Add comprehensive error testing
5. Update API documentation with error response schemas

This approach ensures consistent, secure, and maintainable error handling across the entire ActionPhase backend.
