# Content Length Limits Implementation Plan

**Last Updated**: 2025-10-31

---

## Executive Summary

Implement hard character limits on all user-generated text content (action submissions, results, posts, comments, messages) to prevent abuse and ensure consistent UX. Users are migrating from a system where they regularly hit 30,000 characters and had to split content across multiple messages. This feature adds validation at both frontend (immediate feedback) and backend (security) layers while keeping PostgreSQL TEXT columns unchanged.

**Timeline**: 8-12 hours total effort
**Complexity**: Medium
**Impact**: High - affects all content creation flows

---

## Current State Analysis

### Database Layer
- All content columns use PostgreSQL `TEXT` type (no constraints)
- Tables affected:
  - `messages.content` - Posts, comments, private messages
  - `action_submissions.content` - Player action submissions
  - `action_results.content` - GM results
- PostgreSQL TEXT theoretical limit: ~1GB
- Storage: TOAST compression for content >2KB

### Application Layer
- **Backend**: No content length validation in any service
- **Frontend**: No `maxLength` attributes on Textarea components
- **Current behavior**: Users can submit unlimited text
- **Problem**: Users from previous system expect to split 30,000+ character submissions

### Affected Components
- `ActionSubmission.tsx` - Action submission form
- `GameResultsManager.tsx` - GM results creation
- `CreatePostForm` (in CommonRoom) - Common room posts
- `CommentEditor.tsx` - Comment creation/editing
- `MessageThread.tsx` - Private message creation
- Backend validation services for all content types

---

## Proposed Future State

### Hard Limits (Based on User Requirements)

| Content Type | Character Limit | Reasoning |
|--------------|----------------|-----------|
| **Action Submissions** | 100,000 chars | ~20,000 words; detailed RPG narratives |
| **Action Results** | 100,000 chars | GM needs space for comprehensive results |
| **Common Room Posts** | 50,000 chars | ~10,000 words; detailed discussions |
| **Comments** | 10,000 chars | ~2,000 words; focused responses |
| **Private Messages** | 50,000 chars | Player-to-player communication |

### Architecture Changes

**Frontend**:
- Enhance `Textarea.tsx` UI component with character counter
- Add `maxLength` prop (hard limit, blocks further typing)
- Display character count: "X / Y characters"
- Red warning when approaching limit (90%+)
- Apply consistently across all content forms

**Backend**:
- Create `backend/pkg/validation/content.go` with validation constants
- Add validation to all content creation/update endpoints
- Return HTTP 413 (Payload Too Large) with clear error messages
- Add tests for each validation function

**No Database Changes**:
- Keep TEXT columns as-is (no migrations needed)
- Hard limits enforced at application layer only

---

## Implementation Phases

### Phase 1: Backend Validation Infrastructure
**Goal**: Create centralized validation with comprehensive tests

#### Tasks

**1.1 Create Content Validation Package** (Effort: S)
- File: `backend/pkg/validation/content.go`
- Define constants for all content type limits
- Create validation functions for each content type
- **Acceptance Criteria**:
  - [ ] Constants defined for all 5 content types
  - [ ] Validation functions return clear error messages
  - [ ] Functions are exported and documented

**1.2 Write Unit Tests** (Effort: S)
- File: `backend/pkg/validation/content_test.go`
- Table-driven tests for each validation function
- Test exact limit, over limit, under limit, empty content
- **Acceptance Criteria**:
  - [ ] 100% test coverage on validation functions
  - [ ] Tests verify error messages are user-friendly
  - [ ] Edge cases tested (empty, nil, exactly at limit)

**1.3 Integrate into Action Submission Service** (Effort: S)
- File: `backend/pkg/db/services/actions/submissions.go`
- Add validation call in `SubmitAction` method
- Return validation errors before database write
- **Acceptance Criteria**:
  - [ ] Validation runs before any database operations
  - [ ] Errors returned with HTTP 413 status
  - [ ] Integration tests pass

**1.4 Integrate into Action Results Service** (Effort: S)
- File: `backend/pkg/db/services/actions/results.go`
- Add validation in result creation methods
- **Acceptance Criteria**:
  - [ ] Validation integrated into `CreateActionResult`
  - [ ] Tests verify limits enforced

**1.5 Integrate into Message Service** (Effort: M)
- File: `backend/pkg/db/services/messages/creation.go`
- Add validation for posts, comments, private messages
- Different limits based on message type
- **Acceptance Criteria**:
  - [ ] Posts limited to 50,000 characters
  - [ ] Comments limited to 10,000 characters
  - [ ] Private messages limited to 50,000 characters
  - [ ] Message type correctly determines limit

---

### Phase 2: Frontend Validation & UX
**Goal**: Add character counters and hard limits to all text inputs

#### Tasks

**2.1 Enhance Textarea UI Component** (Effort: M)
- File: `frontend/src/components/ui/Textarea.tsx`
- Add `maxLength` prop with hard enforcement
- Add `showCharacterCount` boolean prop
- Display "X / Y characters" below textarea
- Red text when >90% of limit
- **Acceptance Criteria**:
  - [ ] `maxLength` prop blocks typing beyond limit
  - [ ] Character counter displays correctly
  - [ ] Counter turns red at 90% threshold
  - [ ] Component tests verify new behavior

**2.2 Update ActionSubmission Component** (Effort: S)
- File: `frontend/src/components/ActionSubmission.tsx`
- Add `maxLength={100000}` to action Textarea
- Add `showCharacterCount={true}`
- Update placeholder text to mention limit
- **Acceptance Criteria**:
  - [ ] 100,000 character limit enforced
  - [ ] Character counter visible
  - [ ] User cannot type beyond limit
  - [ ] Component tests updated

**2.3 Update GameResultsManager Component** (Effort: S)
- File: `frontend/src/components/GameResultsManager.tsx`
- Add `maxLength={100000}` to results Textarea
- Add character counter
- **Acceptance Criteria**:
  - [ ] 100,000 character limit on GM results
  - [ ] Character counter displays
  - [ ] Tests verify behavior

**2.4 Update Post Creation Forms** (Effort: S)
- Files:
  - `frontend/src/components/CreatePostForm.tsx` (if exists)
  - `frontend/src/pages/CommonRoom.tsx` (inline form)
- Add `maxLength={50000}` to post Textarea
- Add character counter
- **Acceptance Criteria**:
  - [ ] 50,000 character limit on posts
  - [ ] Character counter visible
  - [ ] Tests updated

**2.5 Update CommentEditor Component** (Effort: S)
- File: `frontend/src/components/CommentEditor.tsx`
- Add `maxLength={10000}` to comment Textarea
- Add character counter
- **Acceptance Criteria**:
  - [ ] 10,000 character limit on comments
  - [ ] Character counter displays
  - [ ] Tests verify limit

**2.6 Update Private Message Forms** (Effort: S)
- File: `frontend/src/components/MessageThread.tsx`
- Add `maxLength={50000}` to message Textarea
- Add character counter
- **Acceptance Criteria**:
  - [ ] 50,000 character limit on private messages
  - [ ] Character counter visible
  - [ ] Tests updated

---

### Phase 3: Error Handling & User Feedback
**Goal**: Ensure clear error messages and graceful handling

#### Tasks

**3.1 Backend Error Responses** (Effort: S)
- Files: All API handlers modified in Phase 1
- Return HTTP 413 with structured error message
- Include current length and maximum allowed in response
- **Acceptance Criteria**:
  - [ ] HTTP 413 status code returned
  - [ ] Error message format: "Content exceeds maximum length of X characters (submitted: Y)"
  - [ ] Frontend can parse error for display

**3.2 Frontend Error Display** (Effort: S)
- Files: All components updated in Phase 2
- Catch 413 errors from mutation hooks
- Display Alert component with user-friendly message
- **Acceptance Criteria**:
  - [ ] Alert shows clear error message
  - [ ] User understands why submission failed
  - [ ] Error persists until dismissed

**3.3 Integration Testing** (Effort: M)
- Test all content creation flows end-to-end
- Submit content at exactly the limit
- Submit content over the limit
- Verify backend rejection
- Verify frontend displays error
- **Acceptance Criteria**:
  - [ ] All content types tested
  - [ ] Limits correctly enforced
  - [ ] Errors displayed properly
  - [ ] No false positives (valid content rejected)

---

### Phase 4: Documentation & Testing
**Goal**: Comprehensive test coverage and user documentation

#### Tasks

**4.1 Backend Integration Tests** (Effort: M)
- Files:
  - `backend/pkg/db/services/actions/submissions_test.go`
  - `backend/pkg/db/services/actions/results_test.go`
  - `backend/pkg/db/services/messages/creation_test.go`
- Add test cases for oversized content
- Verify HTTP 413 responses
- **Acceptance Criteria**:
  - [ ] Each service has oversized content tests
  - [ ] Tests verify correct error messages
  - [ ] All tests pass

**4.2 Frontend Component Tests** (Effort: M)
- Files: Component test files for all updated components
- Test character counter display
- Test maxLength enforcement
- Test error display on 413 responses
- **Acceptance Criteria**:
  - [ ] Character counter tests pass
  - [ ] maxLength blocking verified
  - [ ] Error handling tested
  - [ ] All component tests pass

**4.3 E2E Tests** (Effort: L)
- File: `frontend/e2e/content/content-length-limits.spec.ts`
- Test submitting oversized action
- Test submitting oversized post
- Test submitting oversized comment
- Verify error messages appear
- **Acceptance Criteria**:
  - [ ] E2E test for action submission limit
  - [ ] E2E test for post limit
  - [ ] E2E test for comment limit
  - [ ] All tests pass in CI

**4.4 Update User Documentation** (Effort: S)
- File: Create `docs/features/CONTENT_LIMITS.md`
- Document all content type limits
- Explain why limits exist
- Provide guidance for long content (write elsewhere, paste in)
- **Acceptance Criteria**:
  - [ ] Documentation clearly lists all limits
  - [ ] Rationale explained
  - [ ] Workarounds documented

**4.5 Update API Documentation** (Effort: S)
- File: `.claude/reference/API_DOCUMENTATION.md`
- Document HTTP 413 responses for content endpoints
- Include error response schema
- **Acceptance Criteria**:
  - [ ] All content creation endpoints documented
  - [ ] 413 error responses documented
  - [ ] Error schema included

---

## Risk Assessment and Mitigation Strategies

### Risk 1: Existing Long Content in Database
**Probability**: Medium
**Impact**: Low
**Mitigation**:
- Limits only apply to NEW content submissions
- Existing content remains unchanged
- Users can edit existing long content (enforce limit on update? TBD)

### Risk 2: Users Frustrated by Hard Limits
**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Limits set generously (100K chars = ~40 pages)
- Character counter provides real-time feedback
- User requirement specifies hard limits (not soft)
- Documentation explains workarounds

### Risk 3: Frontend/Backend Limit Mismatch
**Probability**: Low
**Impact**: High
**Mitigation**:
- Use shared constants or configuration
- Consider creating `shared/constants.ts` exported from backend
- Comprehensive integration tests catch mismatches
- Code review checklist includes verification

### Risk 4: UTF-8 Character Counting Issues
**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Go `len()` counts bytes, not characters
- Use `utf8.RuneCountInString()` for character count
- JavaScript `string.length` counts UTF-16 code units
- Test with emoji and multi-byte characters

### Risk 5: Browser Performance with Large Text
**Probability**: Low
**Impact**: Low
**Mitigation**:
- 100K characters is well within browser capabilities
- Modern browsers handle large textareas efficiently
- No special optimization needed

---

## Success Metrics

### Functional Metrics
- [ ] 100% of content types have enforced limits
- [ ] 0 instances of unlimited content submission
- [ ] Backend validation tests: 100% coverage
- [ ] Frontend component tests: All passing
- [ ] E2E tests: All passing

### User Experience Metrics
- [ ] Character counter visible on all forms
- [ ] Users receive clear error messages for oversized content
- [ ] No user reports of confusion about limits
- [ ] Submission success rate remains high (>95%)

### Performance Metrics
- [ ] Validation adds <10ms to request processing
- [ ] Frontend character counter updates smoothly (no lag)
- [ ] No regression in page load times

---

## Required Resources and Dependencies

### Technical Dependencies
- **Frontend**:
  - React 18+ (already in use)
  - UI Textarea component (exists, needs enhancement)
  - React Testing Library (for component tests)

- **Backend**:
  - Go 1.21+ (already in use)
  - No new external dependencies

- **Testing**:
  - Playwright (E2E tests)
  - Go testing framework
  - Jest/Vitest (frontend tests)

### Knowledge Dependencies
- Understanding of UTF-8 character encoding
- Familiarity with HTTP 413 status code
- React Query mutation error handling
- PostgreSQL TEXT column behavior (no changes needed)

### File Dependencies

**Backend Files to Modify**:
1. NEW: `backend/pkg/validation/content.go`
2. NEW: `backend/pkg/validation/content_test.go`
3. `backend/pkg/db/services/actions/submissions.go`
4. `backend/pkg/db/services/actions/results.go`
5. `backend/pkg/db/services/messages/creation.go`
6. Integration test files for above services

**Frontend Files to Modify**:
1. `frontend/src/components/ui/Textarea.tsx`
2. `frontend/src/components/ActionSubmission.tsx`
3. `frontend/src/components/GameResultsManager.tsx`
4. `frontend/src/components/CommentEditor.tsx`
5. `frontend/src/components/MessageThread.tsx`
6. Post creation components (TBD based on codebase)
7. Component test files for above

**Documentation Files**:
1. NEW: `docs/features/CONTENT_LIMITS.md`
2. UPDATE: `.claude/reference/API_DOCUMENTATION.md`

---

## Timeline Estimates

### Phase 1: Backend Validation Infrastructure
- **Effort**: 2-3 hours
- **Tasks**: 1.1 through 1.5
- **Dependencies**: None
- **Milestone**: All backend validation in place with tests

### Phase 2: Frontend Validation & UX
- **Effort**: 3-4 hours
- **Tasks**: 2.1 through 2.6
- **Dependencies**: Phase 1 complete (for testing against backend)
- **Milestone**: All forms have character counters and hard limits

### Phase 3: Error Handling & User Feedback
- **Effort**: 1-2 hours
- **Tasks**: 3.1 through 3.3
- **Dependencies**: Phases 1 & 2 complete
- **Milestone**: Graceful error handling end-to-end

### Phase 4: Documentation & Testing
- **Effort**: 2-3 hours
- **Tasks**: 4.1 through 4.5
- **Dependencies**: All previous phases complete
- **Milestone**: Comprehensive test coverage and documentation

### Total Timeline
- **Optimistic**: 8 hours
- **Realistic**: 10 hours
- **Pessimistic**: 12 hours

### Suggested Schedule
- **Day 1 (4 hours)**: Phases 1 & 2
- **Day 2 (4 hours)**: Phases 3 & 4
- **Buffer**: 2-4 hours for unexpected issues

---

## Implementation Notes

### UTF-8 Character Counting

**Go Backend**:
```go
import "unicode/utf8"

// CORRECT: Count Unicode characters
charCount := utf8.RuneCountInString(content)

// WRONG: Counts bytes, not characters
byteCount := len(content) // Don't use for validation
```

**TypeScript Frontend**:
```typescript
// JavaScript string.length counts UTF-16 code units
// For most cases this is fine, but emoji may count as 2
const charCount = content.length;

// For accurate Unicode character count (if needed):
const charCount = Array.from(content).length;
```

### Shared Constants Strategy

**Option 1: Duplicate constants** (Recommended for simplicity)
- Define limits in both Go and TypeScript
- Use integration tests to verify they match
- Add comment linking to other definition

**Option 2: Generate TypeScript from Go**
- More complex build process
- Guarantees synchronization
- Overkill for 5 constants

**Recommendation**: Option 1 with comprehensive tests

### Testing Strategy

**Unit Tests**: Fast, isolated validation logic
**Integration Tests**: Verify backend API enforcement
**Component Tests**: Verify frontend UI behavior
**E2E Tests**: Verify complete user flows

### Migration Strategy

**No database migration needed** - TEXT columns remain unchanged.

**Rollout**:
1. Deploy backend with validation (feature flag OFF)
2. Deploy frontend with character counters
3. Enable validation via feature flag
4. Monitor for errors
5. Remove feature flag after stable period

**Rollback Plan**:
- Disable backend validation via feature flag
- Frontend character counters remain (harmless)
- No data loss risk (TEXT columns unchanged)

---

## Open Questions

1. **Edit existing long content**: Should users be allowed to edit existing content that exceeds new limits? Or enforce limits on edits too?
   - **Recommendation**: Allow editing existing long content, but enforce limits on new edits

2. **Character count vs byte count**: Should we count Unicode characters or bytes?
   - **Recommendation**: Characters (using `utf8.RuneCountInString()`)

3. **Mobile UX**: Should limits be different on mobile devices?
   - **Recommendation**: No, keep consistent across devices

4. **Admin override**: Should GMs or admins have higher limits?
   - **Recommendation**: No for MVP, consider for future enhancement

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Resolve open questions** above
3. **Create feature branch**: `feature/content-length-limits`
4. **Start with Phase 1**: Backend validation infrastructure
5. **Track progress** using `content-length-limits-tasks.md`

---

**Plan Status**: Ready for Implementation
**Assigned To**: TBD
**Target Completion**: TBD
