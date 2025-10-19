# Refactor Plan 04: Code Simplification with Utilities (REVISED)
**Status**: Day 1 Complete, Ongoing
**Executor**: Sonnet Model Compatible
**Estimated Effort**: 1-2 weeks (gradual migration)
**Last Updated**: 2025-01-20

## Problem Statement
- **281 instances** of repetitive error handling patterns in API handlers
- **JWT extraction** duplicated ~30 times (29 lines each = 870 lines total)
- **Database error handling** duplicated ~50 times (8 lines each = 400 lines total)
- **Validation logic** scattered across handlers (~20 instances)
- **66 justfile commands** causing cognitive overload

## Revised Success Criteria
✅ **Day 1 Complete**: Utility functions created and documented
🎯 **Week 1**: 5-10 handlers migrated to use utilities
🎯 **Week 2**: Justfile simplified to < 30 commands
🎯 **Week 3**: Comment deep linking implemented
🎯 **Final**: ~850 lines of code eliminated (30% reduction in handler code)

## ⚠️ Key Learning from Day 1

**ActionPhase already has excellent error handling** in `backend/pkg/core/api_errors.go`:
- Well-designed `ErrResponse` structure
- Proper HTTP status codes
- Application-specific error codes
- Integration with `render.Renderer`

**Strategy Change**: DO NOT replace the error system. CREATE utilities that work WITH it.

---

## Part A: Handler Utility Functions ✅ COMPLETED (Day 1)

### What Was Created

**Files Created**:
1. `backend/pkg/core/db_utils.go` - Database error conversion
2. `backend/pkg/core/handler_utils.go` - JWT extraction & validation
3. `backend/pkg/core/UTILITIES_GUIDE.md` - Complete documentation

### 1. Database Error Utilities

**Function**: `HandleDBError(err error, resourceName string) render.Renderer`

Converts database errors (sql.ErrNoRows, pgx.ErrNoRows) to appropriate API responses.

**Before** (8 lines):
```go
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

**After** (5 lines):
```go
game, err := gameService.GetGame(ctx, gameID)
if err != nil {
    render.Render(w, r, core.HandleDBError(err, "game"))
    return
}
```

**Impact**: 37% reduction per database query error check

---

**Function**: `HandleDBErrorWithID(err error, resourceName string, id interface{}) render.Renderer`

Same but includes the ID in the error message for better debugging.

**Usage**:
```go
user, err := userService.GetUser(ctx, userID)
if err != nil {
    render.Render(w, r, core.HandleDBErrorWithID(err, "user", userID))
    return
}
```

### 2. JWT Extraction Utilities

**Function**: `GetUserIDFromJWT(ctx context.Context, userService UserServiceInterface) (int32, render.Renderer)`

Extracts user ID from JWT token with complete error handling.

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

**After** (7 lines):
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

**Impact**: 76% reduction per JWT extraction

---

**Function**: `GetUsernameFromJWT(ctx context.Context) (string, render.Renderer)`

Extracts just the username without looking up the user.

**Before** (11 lines):
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

**After** (5 lines):
```go
username, errResp := core.GetUsernameFromJWT(ctx)
if errResp != nil {
    render.Render(w, r, errResp)
    return
}
```

**Impact**: 55% reduction

### 3. Validation Utilities

**Function**: `ValidateRequired(value string, fieldName string) render.Renderer`

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

---

**Function**: `ValidateStringLength(value, fieldName string, min, max int) render.Renderer`

**Usage**:
```go
if errResp := core.ValidateStringLength(title, "title", 3, 255); errResp != nil {
    render.Render(w, r, errResp)
    return
}
```

### Measured Impact

| Pattern | Before | After | Reduction | Instances | Total Saved |
|---------|--------|-------|-----------|-----------|-------------|
| JWT extraction | 29 lines | 7 lines | 76% | ~30 | ~660 lines |
| DB error handling | 8 lines | 5 lines | 37% | ~50 | ~150 lines |
| Validation | 5 lines | 3 lines | 40% | ~20 | ~40 lines |
| **TOTAL** | | | | | **~850 lines** |

---

## Part B: Migration Strategy (IN PROGRESS)

### Phase 1: Pilot Migration (Week 1)

**Goal**: Migrate 5-10 handlers to prove value

**Priority handlers to migrate**:
1. `backend/pkg/games/api.go` - CreateGame, GetGame (JWT + DB errors)
2. `backend/pkg/characters/api.go` - CreateCharacter (JWT + validation)
3. `backend/pkg/messages/api.go` - CreatePost (JWT + DB errors)
4. `backend/pkg/phases/api.go` - TransitionPhase (JWT + DB errors)
5. `backend/pkg/notifications/api.go` - GetNotifications (JWT + DB errors)

**Steps for each handler**:
1. Identify patterns (JWT extraction, DB errors, validation)
2. Replace with utility functions
3. Test endpoint functionality
4. Measure line reduction
5. Update handler documentation

**Success metric**: 100-200 lines eliminated in Week 1

### Phase 2: Team Adoption (Week 2-3)

**Create adoption checklist**:
- [ ] Add to PR template: "Did you use core utilities for JWT/DB/validation?"
- [ ] Update contributor guide with utility examples
- [ ] Create pre-commit hook reminder for repetitive patterns
- [ ] Track adoption rate in code reviews

**Gradual rollout**:
- New handlers: MUST use utilities
- Existing handlers: Migrate when touching the code
- No big-bang refactor required

### Phase 3: Measurement (Ongoing)

**Track these metrics**:
```bash
# JWT extraction patterns remaining
grep -r "jwtauth.FromContext" backend/pkg --include="*.go" | wc -l

# DB error patterns remaining
grep -r "if err == sql.ErrNoRows" backend/pkg --include="*.go" | wc -l

# Validation patterns remaining
grep -r "ErrInvalidRequest.*required" backend/pkg --include="*.go" | wc -l
```

**Goal**: Reduce each by 50% over 3 weeks

---

## Part C: Justfile Simplification (WEEK 2)

### Current State: 66 Commands

**Analysis**:
```bash
# Count commands by category
grep "^[a-z-]*:" justfile | wc -l  # Returns: 66
```

### Target Structure: < 30 Commands

**New hierarchy**:
```makefile
# ========== PRIMARY COMMANDS (10) ==========
dev          # Start everything
test         # Run all tests
build        # Build all
setup        # Initial setup
migrate      # Database migration
lint         # Lint all
clean        # Clean all
ci           # Run CI checks
docs         # Generate documentation
deploy       # Deploy (future)

# ========== NAMESPACED COMMANDS (< 20) ==========
backend-*    # Backend operations
frontend-*   # Frontend operations
db-*         # Database operations
test-*       # Test variants

# ========== REMOVED ==========
# Redundant commands combined or aliased
```

**Implementation**:
1. Audit current commands: `just --list > old-commands.txt`
2. Group by category
3. Identify redundant commands
4. Create composite commands
5. Add aliases for common workflows
6. Document all changes

**Estimated effort**: 1 day

---

## Part D: Comment Deep Linking (WEEK 3)

### Database Migration

**Create**: `backend/pkg/db/migrations/XXX_add_comment_anchors.up.sql`
```sql
ALTER TABLE messages ADD COLUMN anchor_id VARCHAR(36) DEFAULT gen_random_uuid();
CREATE INDEX idx_messages_anchor ON messages(anchor_id);
UPDATE messages SET anchor_id = gen_random_uuid() WHERE anchor_id IS NULL;
ALTER TABLE messages ALTER COLUMN anchor_id SET NOT NULL;
```

### API Updates

**Update notification responses** to include anchor_id:
```go
type NotificationData struct {
    CommentAnchorID string `json:"comment_anchor_id,omitempty"`
    // ... other fields
}
```

### Frontend Deep Linking

**Update Comment component**:
```typescript
useEffect(() => {
    if (window.location.hash === `#comment-${comment.anchor_id}`) {
        elementRef.current?.scrollIntoView({ behavior: 'smooth' });
        // Highlight effect
    }
}, [comment.anchor_id]);
```

**Estimated effort**: 1-2 days

---

## Execution Checklist

### Week 1: Utility Adoption ✅ Day 1 DONE, Continue Days 2-5
- [x] **Day 1**: Create utilities and documentation
- [ ] **Day 2**: Migrate games/api.go handler
- [ ] **Day 3**: Migrate characters/api.go handler
- [ ] **Day 4**: Migrate messages/api.go handler
- [ ] **Day 5**: Measure impact, update documentation

### Week 2: Justfile & More Migration
- [ ] **Day 1-2**: Simplify justfile
- [ ] **Day 3-5**: Migrate 5 more handlers

### Week 3: Comment Linking & Finalize
- [ ] **Day 1-2**: Implement comment anchors
- [ ] **Day 3**: Test deep linking
- [ ] **Day 4-5**: Final migrations, documentation

---

## Validation Commands

**Check utility adoption**:
```bash
# How many handlers use GetUserIDFromJWT?
grep -r "GetUserIDFromJWT" backend/pkg --include="*.go" | wc -l

# How many still use old pattern?
grep -r "jwtauth.FromContext" backend/pkg --include="*.go" | wc -l

# Calculate adoption rate
# adoption_rate = new_pattern / (new_pattern + old_pattern)
```

**Measure line reduction**:
```bash
# Compare file sizes before/after
git diff main..feature-branch --stat

# Look for handlers that got smaller
git diff main..feature-branch -- backend/pkg/*/api.go | grep "^@@"
```

---

## Success Metrics (Final)

### Code Quality
- **Before**: 281 error handling patterns
- **Target**: ~100 patterns (remaining are unique cases)
- **Reduction**: ~850 lines of repetitive code

### Developer Experience
- **Before**: Copy-paste JWT extraction (29 lines)
- **After**: One function call (7 lines)
- **Impact**: Faster development, fewer bugs

### Justfile
- **Before**: 66 commands
- **After**: < 30 commands
- **Impact**: Clearer interface, easier onboarding

### Comment Linking
- **Before**: Can't link to specific comments
- **After**: Direct navigation from notifications
- **Impact**: Better UX, faster navigation

---

## References

- **Utilities Guide**: `backend/pkg/core/UTILITIES_GUIDE.md`
- **Progress Tracker**: `.claude/planning/REFACTOR_PROGRESS.md`
- **Master Plan**: `.claude/planning/REFACTOR_00_MASTER_PLAN.md`
