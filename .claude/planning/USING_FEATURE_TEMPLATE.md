# How to Use the Feature Planning Template

This guide explains how to effectively use `FEATURE_PLAN_TEMPLATE.md` when designing new features.

## Quick Start

```bash
# 1. Copy template
cp .claude/planning/FEATURE_PLAN_TEMPLATE.md .claude/planning/FEATURE_notifications.md

# 2. Fill in sections (see guidance below)
# 3. Review with team/AI
# 4. Start implementation following the plan
# 5. Update session log as you progress
# 6. Archive when complete
```

---

## Section-by-Section Guide

### Section 1: Overview

**Purpose**: Define the problem and goals clearly

**Fill this out by:**
1. Describe the user pain point (not the solution)
2. List 3-5 specific, measurable goals
3. Explicitly state what's NOT in scope (prevents scope creep)
4. Define success criteria (how you'll know it works)

**Example:**
```markdown
### Problem Statement
Players struggle to know when it's their turn to submit actions, leading to
missed deadlines and game delays. Currently, they must manually check the
website every few hours.

### Goals
- [ ] Players receive real-time notifications when phase transitions occur
- [ ] GMs get notified when all players have submitted actions
- [ ] System reduces average action submission time by 30%

### Non-Goals
- Push notifications to mobile devices (post-MVP)
- Email digests of multiple notifications (future enhancement)
```

---

### Section 2: User Stories

**Purpose**: Define feature behavior from user perspective

**Fill this out by:**
1. Write user stories in Gherkin format (Given/When/Then)
2. Cover primary happy path
3. Document edge cases
4. Define error scenarios

**Example:**
```gherkin
As a Player
I want to be notified when a new phase starts
So that I can submit my action before the deadline

Acceptance Criteria:
- Given I am a participant in an active game
  When the GM activates a new action phase
  Then I receive a notification within 5 seconds
- Given I have already submitted my action
  When the phase ends
  Then I do NOT receive a notification
```

---

### Section 3: Technical Design

**Purpose**: Plan all architectural layers

#### 3.1 Database Schema

**When to fill this out:**
- New tables needed: Define full schema with indexes, constraints
- Modify existing tables: Write ALTER statements
- No database changes: DELETE this section

**Example:**
```sql
-- Always include:
-- 1. All columns with proper types
-- 2. Foreign keys with ON DELETE behavior
-- 3. Unique constraints
-- 4. Check constraints for validation
-- 5. Indexes for query performance

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Add index for common queries
    CHECK (notification_type IN ('phase_start', 'action_submitted', 'phase_end'))
);

CREATE INDEX idx_notifications_user_unread
    ON notifications(user_id, is_read, created_at DESC);
```

#### 3.2 Database Queries (sqlc)

**When to fill this out:**
- Always (if you have database changes)

**Write queries for:**
- Creating records (`:one` returns single record)
- Reading records (`:one` or `:many`)
- Updating records (`:exec` or `:one`)
- Deleting records (`:exec`)
- Complex queries with joins

**Example:**
```sql
-- name: CreateNotification :one
INSERT INTO notifications (user_id, notification_type, content)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetUserNotifications :many
SELECT * FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: MarkNotificationAsRead :exec
UPDATE notifications
SET is_read = TRUE
WHERE id = $1 AND user_id = $2;
```

#### 3.3 Backend Service Layer

**When to fill this out:**
- Always (for any backend work)

**Define:**
1. Service interface in `core/interfaces.go`
2. Domain models in `core/models.go`
3. Business rules with validation logic
4. Error conditions

**Business Rules Format:**
```markdown
1. **Users can only mark their own notifications as read**
   - Validation: Check notification.user_id == current_user.id
   - Error: "Cannot mark another user's notification as read" (403 Forbidden)

2. **Notification content must be valid JSON**
   - Validation: JSON unmarshal check
   - Error: "Invalid notification content" (400 Bad Request)
```

#### 3.4 API Endpoints

**When to fill this out:**
- Always (for any API changes)

**For each endpoint, document:**
- HTTP method and path
- Authentication requirements
- Permissions needed
- Request body schema (with validation rules)
- Success response (200/201/204)
- All error responses (400/401/403/404/409/500)

**Example:**
```markdown
#### GET /api/v1/notifications
**Description**: List current user's notifications
**Auth Required**: Yes
**Permissions**: Authenticated user

**Query Parameters:**
- `limit` (int, optional): Results per page (default: 20, max: 100)
- `unread_only` (bool, optional): Filter to unread only (default: false)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "notification_type": "phase_start",
      "content": {
        "game_id": 5,
        "phase_number": 3
      },
      "is_read": false,
      "created_at": "2025-08-07T10:30:00Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: No valid auth token
```

#### 3.5-3.8 Frontend (Components, Hooks, Types)

**When to fill this out:**
- Always (for any frontend work)

**Start with component hierarchy:**
```
NotificationsPage
├── NotificationsList
│   ├── NotificationCard
│   └── EmptyState
└── NotificationSettings
    └── NotificationPreferencesForm
```

**For each component, specify:**
- Props interface
- State (local vs server state via React Query)
- API interactions (which hooks)
- User interactions (click handlers, form submissions)

**For custom hooks:**
- Query keys
- Stale time
- Cache invalidation strategy

---

### Section 4: Testing Strategy

**Purpose**: Plan tests before writing code (TDD)

#### Backend Tests

**Required test files:**
- `*_test.go` - Unit tests with mocks
- `*_integration_test.go` - Integration tests with database
- `api_test.go` - HTTP handler tests

**Coverage goals:**
- Service layer: >85%
- Business logic: 100% critical paths
- API handlers: >80%

**Table-driven test format:**
```go
tests := []struct {
    name    string
    input   *Request
    want    *Response
    wantErr bool
}{
    {
        name:  "valid notification",
        input: &CreateNotificationRequest{...},
        want:  &Notification{...},
        wantErr: false,
    },
    {
        name:  "missing required field",
        input: &CreateNotificationRequest{UserID: 0},
        wantErr: true,
    },
}
```

#### Frontend Tests

**Required test files:**
- `ComponentName.test.tsx` - Component tests
- `useHook.test.ts` - Hook tests
- `api.feature.test.ts` - API client tests

**Test user interactions, not implementation:**
```typescript
// GOOD - Test user behavior
it('marks notification as read when clicked', async () => {
  const user = userEvent.setup();
  render(<NotificationCard notification={mockNotification} />);

  await user.click(screen.getByRole('button', { name: /mark as read/i }));

  await waitFor(() => {
    expect(screen.getByText(/read/i)).toBeInTheDocument();
  });
});

// BAD - Test implementation details
it('updates local state when button clicked', () => {
  // Don't test React internals
});
```

---

### Section 5: Implementation Plan

**Purpose**: Break work into manageable phases

**4 Standard Phases:**

1. **Database & Backend Foundation**
   - Migrations, SQL queries, service layer
   - Run unit tests first (TDD)

2. **API Endpoints**
   - HTTP handlers, validation, routes
   - Integration tests with database

3. **Frontend Implementation**
   - API client, hooks, components
   - Component and hook tests

4. **Integration & Testing**
   - End-to-end manual testing
   - Performance testing
   - Security review

**Each phase should have:**
- Estimated time
- Checklist of tasks
- Acceptance criteria
- Command to verify completion

---

### Section 6-8: Rollout, Monitoring, Documentation

**Purpose**: Ensure safe deployment and observability

**Key items to define:**

**Rollout Strategy:**
- Feature flags if applicable
- Staging deployment first
- Rollback plan with specific steps

**Monitoring:**
- Metrics to track (latency, errors, adoption)
- Alerts to configure (error rate thresholds)
- Logging requirements (correlation IDs)

**Documentation:**
- User guides
- API documentation updates
- Code comments

---

### Section 9: Open Questions

**Purpose**: Track decisions that need to be made

**Format:**
```markdown
- [ ] Should notifications expire after 30 days? → **DECIDED: Yes, add cleanup job**
- [ ] Real-time updates via WebSocket or polling? → **DECIDED: Polling (MVP), WebSocket (post-MVP)**
- [ ] Maximum notifications per user? → **PENDING: Need product input**
```

**Update as decisions are made!**

---

### Section 10: Risks & Mitigations

**Purpose**: Identify and plan for potential problems

**Table format:**

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Database migration fails | Low | High | Test in staging, have rollback script |
| High notification volume | Medium | Medium | Rate limiting, batching |
| WebSocket scaling | Low | High | Start with polling, plan WebSocket for v2 |

---

### Section 12: Session Log

**Purpose**: Track progress across multiple coding sessions

**Update after EVERY session:**

```markdown
### Session 1 - 2025-08-07
**Accomplished:**
- Created database migration
- Implemented NotificationService with tests
- Added API endpoints for CRUD operations

**Blockers:**
- Need clarification on notification expiration policy

**Next Steps:**
- Implement frontend NotificationsList component
- Add real-time polling mechanism
```

**This is critical for AI context across sessions!**

---

## Tips for Effective Planning

### 1. Fill Out Systematically
**Work top-to-bottom through the template.** Each section builds on the previous:
- Problem → Goals → User Stories → Technical Design → Tests → Implementation

### 2. Delete Irrelevant Sections
**Not all sections apply to every feature:**
- No database changes? Delete section 3.1
- No new API endpoints? Delete section 3.4
- Backend-only feature? Delete sections 3.5-3.8

### 3. Be Specific
**Avoid vague descriptions:**
- ❌ "Handle errors properly"
- ✅ "Return 400 Bad Request with field-specific validation errors"

### 4. Define Business Rules Clearly
**Use this format:**
```markdown
1. **Rule name in plain English**
   - Validation: Exactly what to check
   - Error: Exact error message and status code
```

### 5. Plan Tests First
**TDD approach:**
- Write test scenarios BEFORE implementation
- Define edge cases and error scenarios
- Set coverage goals (>80%)

### 6. Keep It Updated
**Living document:**
- Mark tasks complete as you go
- Update session log after every coding session
- Add new insights to "Open Questions"

---

## When to Use vs. Not Use

### ✅ USE the template for:
- New features with backend + frontend changes
- Features spanning multiple sessions
- Complex features with business logic
- Features requiring database changes
- Features with API changes

### ❌ DON'T use the template for:
- Simple bug fixes (use bug fix workflow instead)
- Documentation-only changes
- Refactoring existing code (unless major refactor)
- Single-file changes
- Trivial UI tweaks

---

## Example: Filled Template Sections

See `.claude/reference/GAME_APPLICATIONS_DESIGN.md` for a real example of feature design (simplified format).

A complete filled template would include:
- All API endpoints fully specified
- Complete SQL schema and queries
- Component hierarchy with props
- Comprehensive test scenarios
- Phase-by-phase implementation checklist

---

## Integration with Development Workflow

### Before Coding
1. Create feature plan from template
2. Review plan (get feedback if needed)
3. Ensure all technical questions answered

### During Implementation
1. Follow implementation phases in order
2. Check off tasks as completed
3. Update session log after each session
4. Add new insights to "Open Questions"

### After Completion
1. Verify completion checklist
2. Update documentation
3. Archive plan to `.claude/planning/archive/`

---

## Questions?

See:
- **`.claude/planning/README.md`** - Planning directory overview
- **`.claude/context/ARCHITECTURE.md`** - Architectural patterns
- **`.claude/context/TESTING.md`** - Testing requirements
- **`CLAUDE.md`** - Main developer guide
