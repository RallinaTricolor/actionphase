# Refactor Plan 04: Error Handling & Code Simplification
**Status**: Ready for Execution
**Executor**: Sonnet Model Compatible
**Estimated Effort**: 3-4 days

## Problem Statement
- 281+ instances of repetitive error handling patterns (JWT extraction, DB errors)
- 66 justfile commands causing cognitive overload
- JWT extraction duplicated ~30 times (29 lines each)
- Database error handling duplicated ~50 times (8 lines each)
- Validation logic scattered across handlers

## Success Criteria
✅ Utility functions for common patterns
✅ < 30 justfile commands at root level
✅ JWT extraction: 29 lines → 7 lines (76% reduction)
✅ Reduced code duplication by 30% (~850 lines)
✅ Gradual migration path for existing code

## ⚠️ IMPORTANT: Existing Error System Analysis

**ActionPhase already has a well-designed error system** in `backend/pkg/core/api_errors.go`:
- Structured `ErrResponse` with proper HTTP status codes
- `render.Renderer` interface integration
- Comprehensive error types: `ErrInvalidRequest`, `ErrUnauthorized`, `ErrForbidden`, etc.
- Application-specific error codes

**DO NOT create a new error package.** Instead, create utilities that work WITH the existing system.

---

## Part A: Handler Utility Functions (✅ COMPLETED)

### Step 1: Create Database Error Utilities

**Created file**: `backend/pkg/core/db_utils.go`
```go
package errors

import (
    "fmt"
    "net/http"
)

// Standard error types
type ErrorType string

const (
    ErrorTypeValidation   ErrorType = "VALIDATION_ERROR"
    ErrorTypeNotFound     ErrorType = "NOT_FOUND"
    ErrorTypeUnauthorized ErrorType = "UNAUTHORIZED"
    ErrorTypeForbidden    ErrorType = "FORBIDDEN"
    ErrorTypeConflict     ErrorType = "CONFLICT"
    ErrorTypeInternal     ErrorType = "INTERNAL_ERROR"
)

type AppError struct {
    Type    ErrorType              `json:"type"`
    Message string                 `json:"message"`
    Field   string                 `json:"field,omitempty"`
    Details map[string]interface{} `json:"details,omitempty"`
}

func (e AppError) Error() string {
    return e.Message
}

func (e AppError) StatusCode() int {
    switch e.Type {
    case ErrorTypeValidation:
        return http.StatusBadRequest
    case ErrorTypeNotFound:
        return http.StatusNotFound
    case ErrorTypeUnauthorized:
        return http.StatusUnauthorized
    case ErrorTypeForbidden:
        return http.StatusForbidden
    case ErrorTypeConflict:
        return http.StatusConflict
    default:
        return http.StatusInternalServerError
    }
}
```

### Step 2: Create Error Builders

**Create file**: `backend/pkg/core/errors/builders.go`
```go
package errors

import (
    "fmt"
    "database/sql"
)

// Validation error
func ValidationError(field, message string) AppError {
    return AppError{
        Type:    ErrorTypeValidation,
        Field:   field,
        Message: fmt.Sprintf("Validation failed for %s: %s", field, message),
    }
}

// Not found error
func NotFound(resource string, id interface{}) AppError {
    return AppError{
        Type:    ErrorTypeNotFound,
        Message: fmt.Sprintf("%s with ID %v not found", resource, id),
    }
}

// Unauthorized error
func Unauthorized(message string) AppError {
    return AppError{
        Type:    ErrorTypeUnauthorized,
        Message: message,
    }
}

// Forbidden error
func Forbidden(action, resource string) AppError {
    return AppError{
        Type:    ErrorTypeForbidden,
        Message: fmt.Sprintf("You don't have permission to %s this %s", action, resource),
    }
}

// Database error handler
func HandleDBError(err error, operation string) AppError {
    if err == sql.ErrNoRows {
        return NotFound(operation, "requested")
    }

    return AppError{
        Type:    ErrorTypeInternal,
        Message: "Database operation failed",
        Details: map[string]interface{}{
            "operation": operation,
            "error":     err.Error(),
        },
    }
}
```

### Step 3: Create HTTP Error Handler

**Create file**: `backend/pkg/core/errors/http.go`
```go
package errors

import (
    "net/http"
    "encoding/json"
    "log/slog"
)

type ErrorResponse struct {
    Error   AppError `json:"error"`
    TraceID string   `json:"trace_id,omitempty"`
}

func HandleHTTPError(w http.ResponseWriter, err error, logger *slog.Logger) {
    var appErr AppError

    switch e := err.(type) {
    case AppError:
        appErr = e
    default:
        // Log unexpected errors
        logger.Error("unexpected error", "error", err)
        appErr = AppError{
            Type:    ErrorTypeInternal,
            Message: "An unexpected error occurred",
        }
    }

    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(appErr.StatusCode())

    json.NewEncoder(w).Encode(ErrorResponse{
        Error:   appErr,
        TraceID: GetTraceID(r.Context()),
    })
}
```

### Step 4: Replace Error Handling Patterns

**Find and replace across codebase:**

```go
// BEFORE: Repetitive pattern (125+ instances)
if err != nil {
    http.Error(w, "Failed to create game", http.StatusInternalServerError)
    h.App.Logger.Error("failed to create game", "error", err)
    return
}

// AFTER: Standardized
if err != nil {
    errors.HandleHTTPError(w, errors.HandleDBError(err, "create game"), h.App.Logger)
    return
}
```

**Service layer refactor:**
```go
// BEFORE: Mixed error handling
func (s *GameService) GetGame(ctx context.Context, id int32) (*models.Game, error) {
    game, err := s.queries.GetGame(ctx, id)
    if err != nil {
        if err == sql.ErrNoRows {
            return nil, fmt.Errorf("game not found")
        }
        return nil, err
    }
    return game, nil
}

// AFTER: Consistent errors
func (s *GameService) GetGame(ctx context.Context, id int32) (*models.Game, error) {
    game, err := s.queries.GetGame(ctx, id)
    if err != nil {
        return nil, errors.HandleDBError(err, "game")
    }
    return game, nil
}
```

---

## Part B: Justfile Simplification

### Step 1: Analyze Current Commands
```bash
# Current: 66 commands
# Group by category:
grep "^[a-z-]*:" justfile | cut -d: -f1 | \
  awk '{
    if ($0 ~ /^test/) category="test"
    else if ($0 ~ /^db|migrate|sql/) category="database"
    else if ($0 ~ /^run|dev|start/) category="run"
    else if ($0 ~ /^build/) category="build"
    else category="other"
    count[category]++
  }
  END { for (c in count) print c ": " count[c] }'
```

### Step 2: Create Hierarchical Structure

**New justfile structure:**
```makefile
# ========== PRIMARY COMMANDS (10) ==========
# These are the main commands developers use daily

# Start everything
dev:
    @just db-up
    @just backend-run &
    @just frontend-run

# Run all tests
test:
    @just test-unit
    @just test-integration

# Build everything
build:
    @just backend-build
    @just frontend-build

# Quick setup
setup:
    @just deps-install
    @just db-setup
    @just env-setup

# Database migration
migrate:
    @just db-migrate

# ========== SECONDARY COMMANDS (20) ==========
# Specific commands grouped by category

# Backend commands (prefix: backend-)
backend-run:
    go run ./backend/cmd/server

backend-build:
    go build -o bin/server ./backend/cmd/server

backend-test:
    go test ./backend/...

# Frontend commands (prefix: frontend-)
frontend-run:
    cd frontend && npm run dev

frontend-build:
    cd frontend && npm run build

frontend-test:
    cd frontend && npm test

# Database commands (prefix: db-)
db-up:
    docker-compose up -d postgres

db-migrate:
    migrate -path backend/pkg/db/migrations -database "$(DATABASE_URL)" up

db-rollback:
    migrate -path backend/pkg/db/migrations -database "$(DATABASE_URL)" down 1

db-reset:
    @just db-rollback-all
    @just db-migrate
    @just db-fixtures

# Test commands (prefix: test-)
test-unit:
    go test ./... -short

test-integration:
    go test ./... -run Integration

test-e2e:
    cd frontend && npm run test:e2e

# ========== REMOVED/COMBINED COMMANDS ==========
# These commands were redundant or rarely used:
# - test-verbose (use: just test-unit -v)
# - test-race (use: go test -race ./...)
# - test-bench (use: go test -bench ./...)
# - kill-backend (use: pkill -f "go run")
# - restart-backend (just use Ctrl+C and just dev)
```

### Step 3: Create Aliases for Common Workflows

**Add to justfile:**
```makefile
# Aliases for common workflows
alias t := test
alias m := migrate
alias d := dev
alias b := build

# Composite commands
fresh: db-reset dev
    @echo "Fresh environment started!"

ci: lint test build
    @echo "CI checks passed!"

lint: backend-lint frontend-lint
    @echo "Linting complete!"
```

### Step 4: Document Command Structure

**Create**: `JUSTFILE.md`
```markdown
# Justfile Command Reference

## Primary Commands (Use These!)
- `just dev` - Start development environment
- `just test` - Run all tests
- `just build` - Build production binaries
- `just setup` - Initial project setup
- `just migrate` - Run database migrations

## Command Prefixes
- `backend-*` - Backend-specific commands
- `frontend-*` - Frontend-specific commands
- `db-*` - Database commands
- `test-*` - Test variants

## Quick Aliases
- `just t` = `just test`
- `just m` = `just migrate`
- `just d` = `just dev`

## Advanced Usage
```bash
# Run specific backend tests
just backend-test ./pkg/services/...

# Run with verbose output
just test-unit -v

# Fresh start
just fresh
```
```

---

## Part C: Code Duplication Reduction

### Step 1: Identify Duplicate Patterns

**Run duplication analysis:**
```bash
# Find duplicate Go code
duplo -t 50 backend/pkg/**/*.go

# Find duplicate TypeScript code
jscpd frontend/src --min-lines 10 --reporters "console"
```

### Step 2: Create Shared Utilities

**Create**: `backend/pkg/utils/database.go`
```go
package utils

import (
    "database/sql"
    "fmt"
)

// Transaction wrapper - used in 15+ places
func WithTransaction(db *sql.DB, fn func(*sql.Tx) error) error {
    tx, err := db.Begin()
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }

    if err := fn(tx); err != nil {
        tx.Rollback()
        return err
    }

    return tx.Commit()
}

// Null string helper - used in 20+ places
func NullString(s string) sql.NullString {
    return sql.NullString{
        String: s,
        Valid:  s != "",
    }
}

// Pagination helper - used in 10+ places
type Pagination struct {
    Limit  int32
    Offset int32
}

func (p Pagination) Apply(query string) string {
    return fmt.Sprintf("%s LIMIT %d OFFSET %d", query, p.Limit, p.Offset)
}
```

**Create**: `backend/pkg/utils/validation.go`
```go
package utils

import (
    "regexp"
    "strings"
)

var (
    emailRegex = regexp.MustCompile(`^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$`)
    uuidRegex  = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
)

// Email validation - used in 5+ places
func IsValidEmail(email string) bool {
    return emailRegex.MatchString(strings.ToLower(email))
}

// UUID validation - used in 8+ places
func IsValidUUID(uuid string) bool {
    return uuidRegex.MatchString(uuid)
}

// String length validation - used in 12+ places
func ValidateLength(s string, min, max int) error {
    length := len(s)
    if length < min {
        return fmt.Errorf("must be at least %d characters", min)
    }
    if length > max {
        return fmt.Errorf("must be at most %d characters", max)
    }
    return nil
}
```

### Step 3: Replace Duplicate Code

**Example replacements:**

```go
// BEFORE: Duplicate transaction handling
func (s *Service) CreateWithTransaction(ctx context.Context) error {
    tx, err := s.db.Begin()
    if err != nil {
        return err
    }

    if err := s.doCreate(tx); err != nil {
        tx.Rollback()
        return err
    }

    return tx.Commit()
}

// AFTER: Use utility
func (s *Service) CreateWithTransaction(ctx context.Context) error {
    return utils.WithTransaction(s.db, func(tx *sql.Tx) error {
        return s.doCreate(tx)
    })
}
```

---

## Part D: Comment System Direct Linking

### Step 1: Database Migration

**Create migration**: `backend/pkg/db/migrations/XXX_add_comment_anchors.up.sql`
```sql
-- Add anchor IDs for direct linking
ALTER TABLE messages
ADD COLUMN anchor_id VARCHAR(36) DEFAULT gen_random_uuid();

CREATE INDEX idx_messages_anchor ON messages(anchor_id);

-- Backfill existing records
UPDATE messages SET anchor_id = gen_random_uuid() WHERE anchor_id IS NULL;

-- Make non-nullable
ALTER TABLE messages ALTER COLUMN anchor_id SET NOT NULL;
```

### Step 2: Update API Response

**Update**: `backend/pkg/messages/api.go`
```go
type CommentResponse struct {
    ID        int32     `json:"id"`
    Content   string    `json:"content"`
    AnchorID  string    `json:"anchor_id"`  // Add this
    CreatedAt time.Time `json:"created_at"`
    // ... other fields
}

// Update notification links
type NotificationData struct {
    CommentAnchorID string `json:"comment_anchor_id,omitempty"`
    // ... other fields
}
```

### Step 3: Frontend Deep Linking

**Update**: `frontend/src/components/Comment.tsx`
```typescript
interface CommentProps {
    comment: Comment;
    highlighted?: boolean;
}

export const Comment: React.FC<CommentProps> = ({ comment, highlighted }) => {
    const elementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Check if this comment should be highlighted
        const anchor = window.location.hash;
        if (anchor === `#comment-${comment.anchor_id}`) {
            elementRef.current?.scrollIntoView({ behavior: 'smooth' });
            // Add highlight effect
        }
    }, [comment.anchor_id]);

    return (
        <div
            id={`comment-${comment.anchor_id}`}
            ref={elementRef}
            className={cn(
                "comment",
                highlighted && "bg-yellow-100"
            )}
        >
            {comment.content}
        </div>
    );
};
```

**Update notification navigation**:
```typescript
// In NotificationItem.tsx
const handleNotificationClick = (notification: Notification) => {
    if (notification.comment_anchor_id) {
        navigate(`/games/${notification.game_id}/posts/${notification.post_id}#comment-${notification.comment_anchor_id}`);
    }
    markAsRead(notification.id);
};
```

---

## Execution Checklist

### Day 1: Error Handling
- [ ] Create error package structure
- [ ] Implement error types and builders
- [ ] Create HTTP error handler
- [ ] Replace 10 error handling instances
- [ ] Test error responses

### Day 2: Error Migration
- [ ] Replace remaining error handling patterns
- [ ] Update all services to use new errors
- [ ] Update API handlers
- [ ] Verify error response format
- [ ] Update API documentation

### Day 3: Justfile Simplification
- [ ] Backup current justfile
- [ ] Implement new hierarchical structure
- [ ] Test all primary commands
- [ ] Remove redundant commands
- [ ] Create documentation

### Day 4: Code Deduplication & Comments
- [ ] Run duplication analysis
- [ ] Create shared utilities
- [ ] Replace duplicate patterns
- [ ] Add comment anchors to database
- [ ] Implement comment deep linking
- [ ] Test notification navigation

---

## Validation Checklist

After implementation:
```bash
# Error handling verification
grep -r "http.Error" backend/pkg --include="*.go" | wc -l
# Should be near 0

# Check new error usage
grep -r "errors.HandleHTTPError" backend/pkg --include="*.go" | wc -l
# Should be 50+

# Justfile command count
grep "^[a-z-]*:" justfile | wc -l
# Should be < 30

# Test all primary commands
just dev
just test
just build

# Check for code duplication
duplo -t 50 backend/pkg/**/*.go
# Should show reduction in duplicates

# Test comment linking
curl -X GET "http://localhost:3000/api/v1/messages/123"
# Should include anchor_id field
```

---

## Benefits Summary

### Error Handling
- **Before**: 125+ repetitive error blocks
- **After**: Single error handler, consistent responses
- **Saved**: ~500 lines of code

### Justfile
- **Before**: 66 commands, cognitive overload
- **After**: 30 commands, clear hierarchy
- **Improved**: Developer experience

### Code Duplication
- **Before**: Same patterns repeated 10-20 times
- **After**: Shared utilities
- **Saved**: ~300 lines of code

### Comment Linking
- **Before**: Can't link directly to comments
- **After**: Deep linking from notifications
- **Improved**: User navigation experience
