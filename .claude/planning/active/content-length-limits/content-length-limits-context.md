# Content Length Limits - Context & Key Information

**Last Updated**: 2025-10-31

---

## Feature Overview

Implement hard character limits on all user-generated content to prevent abuse and provide clear boundaries. Users are migrating from a system where 30,000+ character submissions were common and had to be split across multiple messages.

**Decision**: Hard limits (not soft warnings)
**Reason**: User explicitly requested hard enforcement
**Auto-save**: Not needed (users compose elsewhere and paste in)

---

## Key Files

### Backend Files

#### New Files to Create
- `backend/pkg/validation/content.go` - Content validation constants and functions
- `backend/pkg/validation/content_test.go` - Comprehensive validation tests

#### Existing Files to Modify
- `backend/pkg/db/services/actions/submissions.go` - Action submission validation
  - Location: `/Users/jhouser/Personal/actionphase/backend/pkg/db/services/actions/submissions.go`
  - Method: `SubmitAction()` - add validation before database write

- `backend/pkg/db/services/actions/results.go` - Action result validation
  - Location: `/Users/jhouser/Personal/actionphase/backend/pkg/db/services/actions/results.go`
  - Method: `CreateActionResult()` - add validation

- `backend/pkg/db/services/messages/creation.go` - Message validation
  - Location: `/Users/jhouser/Personal/actionphase/backend/pkg/db/services/messages/creation.go`
  - Methods: `CreatePost()`, `CreateComment()`, `CreatePrivateMessage()`
  - Different limits based on message type

#### Related Test Files
- `backend/pkg/db/services/actions/submissions_test.go` - Add oversized content tests
- `backend/pkg/db/services/actions/results_test.go` - Add oversized content tests
- `backend/pkg/db/services/messages/creation_test.go` - Add oversized content tests

### Frontend Files

#### Core Component to Enhance
- `frontend/src/components/ui/Textarea.tsx`
  - Location: `/Users/jhouser/Personal/actionphase/frontend/src/components/ui/Textarea.tsx`
  - Add: `maxLength` prop (hard limit)
  - Add: `showCharacterCount` boolean prop
  - Add: Character counter display "X / Y characters"
  - Add: Red warning styling at 90%+ usage

#### Components Using Textarea
1. **ActionSubmission.tsx** (100K limit)
   - Location: `/Users/jhouser/Personal/actionphase/frontend/src/components/ActionSubmission.tsx`
   - Line: ~211 (action textarea)
   - Add: `maxLength={100000}` and `showCharacterCount={true}`

2. **GameResultsManager.tsx** (100K limit)
   - Location: `/Users/jhouser/Personal/actionphase/frontend/src/components/GameResultsManager.tsx`
   - Find textarea for result content
   - Add: `maxLength={100000}` and `showCharacterCount={true}`

3. **CommentEditor.tsx** (10K limit)
   - Location: `/Users/jhouser/Personal/actionphase/frontend/src/components/CommentEditor.tsx`
   - Add: `maxLength={10000}` and `showCharacterCount={true}`

4. **MessageThread.tsx** (50K limit)
   - Location: `/Users/jhouser/Personal/actionphase/frontend/src/components/MessageThread.tsx`
   - Private message textarea
   - Add: `maxLength={50000}` and `showCharacterCount={true}`

5. **Post Creation Forms** (50K limit)
   - Search for: Post creation in CommonRoom or CreatePostForm
   - Add: `maxLength={50000}` and `showCharacterCount={true}`

#### Related Test Files
- `frontend/src/components/ui/Textarea.test.tsx` - Test character counter
- `frontend/src/components/ActionSubmission.test.tsx` - Verify 100K limit
- `frontend/src/components/GameResultsManager.test.tsx` - Verify 100K limit
- `frontend/src/components/CommentEditor.test.tsx` - Verify 10K limit

### E2E Test File (New)
- `frontend/e2e/content/content-length-limits.spec.ts`
  - Test oversized action submission (reject 100K+)
  - Test oversized post (reject 50K+)
  - Test oversized comment (reject 10K+)
  - Verify error messages display correctly

---

## Architecture Decisions

### Why PostgreSQL TEXT (Not MongoDB)?

**Decision**: Keep PostgreSQL TEXT columns, add validation at application layer

**Rationale**:
1. PostgreSQL TEXT supports up to ~1GB (far exceeds needs)
2. TOAST compression handles large content efficiently
3. No migration complexity
4. Maintains relational integrity
5. Team already familiar with PostgreSQL
6. MongoDB offers no advantages for this use case

### Why Hard Limits (Not Soft)?

**Decision**: Hard limits that block submission

**Rationale**:
1. User explicitly requested hard limits
2. Simpler UX (no ambiguity about whether content will be accepted)
3. Clear feedback via character counter
4. Users compose elsewhere and paste in (no auto-save needed)

### Why These Specific Limits?

| Content Type | Limit | Reasoning |
|--------------|-------|-----------|
| Action Submissions | 100,000 | ~20,000 words; accommodate detailed RPG narratives |
| Action Results | 100,000 | GMs need equivalent space for comprehensive outcomes |
| Posts | 50,000 | ~10,000 words; sufficient for discussions |
| Comments | 10,000 | ~2,000 words; keep threads focused |
| Private Messages | 50,000 | Player communication needs |

### UTF-8 Character Counting

**Backend (Go)**:
```go
import "unicode/utf8"

// Use this for validation
charCount := utf8.RuneCountInString(content)

// NOT this (counts bytes)
byteCount := len(content)
```

**Frontend (JavaScript)**:
```typescript
// string.length counts UTF-16 code units (good enough for most cases)
const charCount = content.length;

// For perfect Unicode accuracy (if needed):
const charCount = Array.from(content).length;
```

**Decision**: Use `utf8.RuneCountInString()` in Go, `string.length` in TypeScript
**Rationale**: Counts actual characters, handles emoji and multi-byte Unicode properly

---

## Database Schema (No Changes)

### Current Schema
```sql
-- messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,  -- No length constraint
    -- ... other fields
);

-- action_submissions table
CREATE TABLE action_submissions (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,  -- No length constraint
    -- ... other fields
);

-- action_results table
CREATE TABLE action_results (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,  -- No length constraint
    -- ... other fields
);
```

**No migrations needed** - validation enforced at application layer only.

---

## API Changes

### New HTTP Status Code: 413 Payload Too Large

All content creation endpoints will return 413 when content exceeds limits:

```json
{
  "error": "Content exceeds maximum length of 100000 characters (submitted: 105432)",
  "max_length": 100000,
  "submitted_length": 105432,
  "content_type": "action_submission"
}
```

### Affected Endpoints

1. **POST /api/v1/games/:id/phases/actions** (Action submissions)
   - Current: No validation
   - After: Max 100,000 characters

2. **POST /api/v1/games/:id/phases/results** (Action results)
   - Current: No validation
   - After: Max 100,000 characters

3. **POST /api/v1/games/:id/messages** (Posts)
   - Current: No validation
   - After: Max 50,000 characters (posts)
   - After: Max 10,000 characters (comments)

4. **POST /api/v1/games/:id/messages/private** (Private messages)
   - Current: No validation
   - After: Max 50,000 characters

---

## Testing Strategy

### Test Pyramid

```
         E2E Tests (Playwright)
         - Full user flows
         - Error message display
         - 3 scenarios (action, post, comment)
                ▲
               / \
              /   \
             /     \
    Integration Tests (Go)
    - Backend API validation
    - HTTP 413 responses
    - 5 content types
           ▲
          / \
         /   \
        /     \
  Component Tests (React Testing Library)
  - Character counter display
  - maxLength enforcement
  - 6 components
       ▲
      / \
     /   \
    /     \
Unit Tests (Go + TypeScript)
- Validation functions
- Edge cases (empty, exact limit, over)
- 100% coverage on validation logic
```

### Test Data

**Edge Cases to Test**:
1. Empty content: `""` (should pass required validation)
2. Exactly at limit: 100,000 characters (should pass)
3. One over limit: 100,001 characters (should fail)
4. Far over limit: 200,000 characters (should fail)
5. Emoji and multi-byte characters: "🎮🎯🎪" (verify correct counting)

### Test Fixtures

**Generate large content**:
```go
// Go
func generateLargeContent(size int) string {
    return strings.Repeat("a", size)
}

// Test exactly at limit
content := generateLargeContent(100_000) // Should pass

// Test over limit
content := generateLargeContent(100_001) // Should fail
```

```typescript
// TypeScript
const generateLargeContent = (size: number) => 'a'.repeat(size);

// Test exactly at limit
const content = generateLargeContent(100000); // Should pass
```

---

## Dependencies

### Backend
- Go 1.21+ (already in use)
- `unicode/utf8` package (standard library)
- No new external dependencies

### Frontend
- React 18+ (already in use)
- React Testing Library (already in use)
- No new external dependencies

### Testing
- Playwright (already in use for E2E)
- Go testing framework (already in use)
- Jest/Vitest (already in use for frontend)

---

## Migration & Rollout Strategy

### Phase 1: Backend Deployment (Feature Flag OFF)
1. Deploy backend with validation code
2. Validation disabled by environment variable
3. Monitor for errors (should be none, code not active)

### Phase 2: Frontend Deployment
1. Deploy frontend with character counters
2. Users see counters but backend doesn't enforce yet
3. Collect feedback on UX

### Phase 3: Enable Validation (Feature Flag ON)
1. Enable backend validation via environment variable
2. Monitor error rates
3. Verify 413 responses handled correctly

### Phase 4: Cleanup (Remove Feature Flag)
1. After 1-2 weeks of stable operation
2. Remove feature flag code
3. Validation always enabled

### Rollback Plan
- **Immediate**: Disable validation via environment variable
- **No data loss**: TEXT columns remain unchanged
- **Frontend**: Character counters remain (harmless)
- **Recovery time**: < 5 minutes

---

## Known Issues & Edge Cases

### Issue 1: Existing Long Content
**Scenario**: What if database already contains content >100K characters?
**Resolution**: Existing content grandfathered in, only NEW submissions validated
**Edit behavior**: TBD (allow editing existing long content?)

### Issue 2: UTF-8 vs UTF-16 Counting Mismatch
**Scenario**: Backend counts Unicode characters, frontend counts UTF-16 code units
**Impact**: Emoji may count differently (rare edge case)
**Mitigation**: Limits set generously to accommodate minor differences
**Example**: "👍" counts as 1 in backend (Go), 2 in frontend (JavaScript)

### Issue 3: Character Counter Performance
**Scenario**: Updating character count on every keystroke
**Impact**: Potential lag with very large content
**Mitigation**: 100K characters is well within browser capabilities
**Optimization**: Not needed for MVP

---

## Performance Considerations

### Backend Validation Overhead
- `utf8.RuneCountInString()` is O(n) where n = string length
- For 100K characters: ~0.1-0.5ms (negligible)
- Validation adds <10ms total to request processing

### Frontend Character Counter
- `string.length` is O(1) (JavaScript optimization)
- Updates on every keystroke
- No performance concerns for 100K characters

### Database Storage (TOAST)
- Content >2KB automatically compressed
- Stored in separate TOAST table
- No performance penalty for retrieval
- Efficient compression reduces storage cost

---

## References

### Related Documentation
- PostgreSQL TEXT type: https://www.postgresql.org/docs/current/datatype-character.html
- TOAST (The Oversized-Attribute Storage Technique): https://www.postgresql.org/docs/current/storage-toast.html
- HTTP 413 Payload Too Large: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413
- UTF-8 in Go: https://go.dev/blog/strings

### Project Documentation
- `.claude/context/ARCHITECTURE.md` - Backend architecture patterns
- `.claude/context/TESTING.md` - Testing requirements
- `CLAUDE.md` - Project overview and development patterns

---

## Open Questions

1. **Edit existing long content**: Should users be allowed to edit content that exceeds new limits?
   - **Recommendation**: Allow viewing/editing but enforce limits on save
   - **Alternative**: Grandfather existing content, no limits on edits

2. **Admin/GM overrides**: Should GMs have higher limits?
   - **Current**: No, same limits for all users
   - **Future**: Consider higher limits for GM results (200K?)

3. **Mobile limits**: Different limits on mobile devices?
   - **Current**: No, consistent across all devices
   - **Rationale**: Users compose elsewhere and paste in

4. **Markdown content**: Does markdown syntax count toward limit?
   - **Yes**: Raw markdown text counts (not rendered HTML)
   - **Example**: `**bold**` counts as 8 characters

---

## Contact & Questions

For questions about this feature, reference:
- This planning document
- `content-length-limits-plan.md` (implementation details)
- `content-length-limits-tasks.md` (progress tracking)
