# Content Length Limits - Task Checklist

**Last Updated**: 2025-10-31
**Status**: Not Started
**Estimated Effort**: 8-12 hours

---

## Phase 1: Backend Validation Infrastructure (2-3 hours)

### 1.1 Create Content Validation Package (Effort: S, ~30 min)
- [ ] Create file `backend/pkg/validation/content.go`
- [ ] Define constant `MaxActionSubmissionLength = 100_000`
- [ ] Define constant `MaxActionResultLength = 100_000`
- [ ] Define constant `MaxPostLength = 50_000`
- [ ] Define constant `MaxCommentLength = 10_000`
- [ ] Define constant `MaxPrivateMessageLength = 50_000`
- [ ] Create function `ValidateActionSubmission(content string) error`
- [ ] Create function `ValidateActionResult(content string) error`
- [ ] Create function `ValidatePost(content string) error`
- [ ] Create function `ValidateComment(content string) error`
- [ ] Create function `ValidatePrivateMessage(content string) error`
- [ ] Use `utf8.RuneCountInString()` for character counting (not `len()`)
- [ ] Return clear error messages: "Content exceeds maximum length of X characters (got Y)"
- [ ] Add godoc comments to all exported functions

**Acceptance Criteria**:
- [ ] All 5 validation functions exported and documented
- [ ] Error messages include both max and actual length
- [ ] Code compiles without errors

---

### 1.2 Write Unit Tests (Effort: S, ~30 min)
- [ ] Create file `backend/pkg/validation/content_test.go`
- [ ] Test action submission validation:
  - [ ] Empty content (0 chars) - should pass
  - [ ] Exactly 100,000 chars - should pass
  - [ ] 100,001 chars - should fail with correct error
  - [ ] 200,000 chars - should fail
- [ ] Test action result validation (same test cases)
- [ ] Test post validation (50,000 char limit)
- [ ] Test comment validation (10,000 char limit)
- [ ] Test private message validation (50,000 char limit)
- [ ] Test UTF-8 multi-byte characters (emoji: "🎮🎯🎪")
- [ ] Use table-driven tests for each validation function
- [ ] Run tests: `go test ./pkg/validation/...`

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] 100% test coverage on validation functions
- [ ] Edge cases covered (empty, exact limit, over limit, emoji)

---

### 1.3 Integrate into Action Submission Service (Effort: S, ~30 min)
- [ ] Open file `backend/pkg/db/services/actions/submissions.go`
- [ ] Import `actionphase/pkg/validation`
- [ ] Find `SubmitAction` method
- [ ] Add validation call BEFORE database operations:
  ```go
  if err := validation.ValidateActionSubmission(req.Content); err != nil {
      return nil, err
  }
  ```
- [ ] Update error handling to return HTTP 413 status
- [ ] Update integration tests in `submissions_test.go`:
  - [ ] Add test for oversized content (100,001+ chars)
  - [ ] Verify HTTP 413 response
  - [ ] Verify error message format

**Acceptance Criteria**:
- [ ] Validation runs before any database writes
- [ ] Oversized submissions return HTTP 413
- [ ] All existing tests still pass
- [ ] New integration test passes

---

### 1.4 Integrate into Action Results Service (Effort: S, ~20 min)
- [ ] Open file `backend/pkg/db/services/actions/results.go`
- [ ] Import `actionphase/pkg/validation`
- [ ] Find `CreateActionResult` method
- [ ] Add validation call before database write
- [ ] Update integration tests in `results_test.go`:
  - [ ] Add test for oversized result content
  - [ ] Verify HTTP 413 response

**Acceptance Criteria**:
- [ ] Validation integrated into result creation
- [ ] Oversized results rejected with HTTP 413
- [ ] Integration tests pass

---

### 1.5 Integrate into Message Service (Effort: M, ~45 min)
- [ ] Open file `backend/pkg/db/services/messages/creation.go`
- [ ] Import `actionphase/pkg/validation`
- [ ] Find `CreatePost` method - add `ValidatePost()` call
- [ ] Find `CreateComment` method - add `ValidateComment()` call
- [ ] Find `CreatePrivateMessage` method - add `ValidatePrivateMessage()` call
- [ ] Each validation must run before database writes
- [ ] Update integration tests in `creation_test.go`:
  - [ ] Test oversized post (50,001+ chars)
  - [ ] Test oversized comment (10,001+ chars)
  - [ ] Test oversized private message (50,001+ chars)
  - [ ] Verify HTTP 413 for each

**Acceptance Criteria**:
- [ ] Posts limited to 50,000 characters
- [ ] Comments limited to 10,000 characters
- [ ] Private messages limited to 50,000 characters
- [ ] All message types return HTTP 413 when exceeded
- [ ] Integration tests pass

---

## Phase 2: Frontend Validation & UX (3-4 hours)

### 2.1 Enhance Textarea UI Component (Effort: M, ~60 min)
- [ ] Open file `frontend/src/components/ui/Textarea.tsx`
- [ ] Add new prop `maxLength?: number` (optional)
- [ ] Add new prop `showCharacterCount?: boolean` (optional, default false)
- [ ] When `showCharacterCount` is true:
  - [ ] Display character counter below textarea: "X / Y characters"
  - [ ] Use `content.length` for character count
  - [ ] Show "X characters" if no maxLength provided
- [ ] When count > 90% of maxLength:
  - [ ] Change counter text color to red (`text-semantic-danger`)
- [ ] When `maxLength` provided:
  - [ ] Add `maxLength` attribute to textarea HTML element
  - [ ] Browser blocks typing beyond limit
- [ ] Update TypeScript interface to include new props
- [ ] Create component test file `Textarea.test.tsx`:
  - [ ] Test character counter displays correctly
  - [ ] Test maxLength blocks further typing
  - [ ] Test red warning at 90%+ usage
  - [ ] Test counter updates on input change

**Acceptance Criteria**:
- [ ] `maxLength` prop enforces hard limit
- [ ] Character counter displays "X / Y characters"
- [ ] Counter turns red at 90%+ of limit
- [ ] Component tests pass
- [ ] No TypeScript errors

---

### 2.2 Update ActionSubmission Component (Effort: S, ~20 min)
- [ ] Open file `frontend/src/components/ActionSubmission.tsx`
- [ ] Find action submission Textarea (around line 211)
- [ ] Add props:
  ```tsx
  maxLength={100000}
  showCharacterCount={true}
  ```
- [ ] Update `helperText` to mention character limit
- [ ] Update component test `ActionSubmission.test.tsx`:
  - [ ] Test character counter visible
  - [ ] Test 100,000 character limit enforced
  - [ ] Test typing stops at limit

**Acceptance Criteria**:
- [ ] 100,000 character limit on action submissions
- [ ] Character counter visible to users
- [ ] Cannot type beyond 100,000 characters
- [ ] Component tests pass

---

### 2.3 Update GameResultsManager Component (Effort: S, ~20 min)
- [ ] Open file `frontend/src/components/GameResultsManager.tsx`
- [ ] Find result content Textarea
- [ ] Add props:
  ```tsx
  maxLength={100000}
  showCharacterCount={true}
  ```
- [ ] Update component test `GameResultsManager.test.tsx`:
  - [ ] Test character counter visible
  - [ ] Test 100,000 character limit

**Acceptance Criteria**:
- [ ] 100,000 character limit on GM results
- [ ] Character counter displays correctly
- [ ] Tests pass

---

### 2.4 Update Post Creation Forms (Effort: S, ~30 min)
- [ ] Search for post creation Textarea:
  - [ ] Check `frontend/src/components/CreatePostForm.tsx` (if exists)
  - [ ] Check `frontend/src/pages/CommonRoom.tsx` for inline form
- [ ] Add to post Textarea:
  ```tsx
  maxLength={50000}
  showCharacterCount={true}
  ```
- [ ] Update related component tests
- [ ] Test character counter and limit enforcement

**Acceptance Criteria**:
- [ ] 50,000 character limit on posts
- [ ] Character counter visible
- [ ] Tests pass

---

### 2.5 Update CommentEditor Component (Effort: S, ~20 min)
- [ ] Open file `frontend/src/components/CommentEditor.tsx`
- [ ] Find comment Textarea
- [ ] Add props:
  ```tsx
  maxLength={10000}
  showCharacterCount={true}
  ```
- [ ] Update `CommentEditor.test.tsx`
- [ ] Test 10,000 character limit

**Acceptance Criteria**:
- [ ] 10,000 character limit on comments
- [ ] Character counter displays
- [ ] Tests pass

---

### 2.6 Update Private Message Forms (Effort: S, ~20 min)
- [ ] Open file `frontend/src/components/MessageThread.tsx`
- [ ] Find private message Textarea
- [ ] Add props:
  ```tsx
  maxLength={50000}
  showCharacterCount={true}
  ```
- [ ] Update component tests
- [ ] Test character counter and limit

**Acceptance Criteria**:
- [ ] 50,000 character limit on private messages
- [ ] Character counter visible
- [ ] Tests pass

---

## Phase 3: Error Handling & User Feedback (1-2 hours)

### 3.1 Backend Error Responses (Effort: S, ~20 min)
- [ ] Review all API handlers modified in Phase 1
- [ ] Ensure HTTP 413 status code returned for oversized content
- [ ] Verify error response format:
  ```json
  {
    "error": "Content exceeds maximum length of 100000 characters (submitted: 105432)"
  }
  ```
- [ ] Include both max length and submitted length in message
- [ ] Test with curl:
  ```bash
  echo '{"content": "'$(printf 'a%.0s' {1..100001})'"}' | \
    curl -X POST -H "Content-Type: application/json" \
    -d @- http://localhost:3000/api/v1/games/1/phases/actions
  ```

**Acceptance Criteria**:
- [ ] All endpoints return HTTP 413 for oversized content
- [ ] Error messages are user-friendly and informative
- [ ] Frontend can parse error response

---

### 3.2 Frontend Error Display (Effort: S, ~30 min)
- [ ] Update all components from Phase 2
- [ ] Add error handling for 413 responses in mutation hooks
- [ ] Display Alert component with error message
- [ ] Example error display:
  ```tsx
  {submitMutation.error && (
    <Alert variant="danger">
      {submitMutation.error.message || "Failed to submit content"}
    </Alert>
  )}
  ```
- [ ] Extract error message from 413 response
- [ ] Test error display manually in browser

**Acceptance Criteria**:
- [ ] 413 errors caught and displayed
- [ ] Alert shows user-friendly message
- [ ] Error persists until user dismisses or retries

---

### 3.3 Integration Testing (Effort: M, ~45 min)
- [ ] Test action submission flow:
  - [ ] Submit action with 100,000 chars - should succeed
  - [ ] Submit action with 100,001 chars - should fail with 413
  - [ ] Verify error message displayed in UI
- [ ] Test post creation flow:
  - [ ] Submit post with 50,000 chars - succeed
  - [ ] Submit post with 50,001 chars - fail with 413
- [ ] Test comment creation flow:
  - [ ] Submit comment with 10,000 chars - succeed
  - [ ] Submit comment with 10,001 chars - fail with 413
- [ ] Verify character counter prevents typing beyond limit
- [ ] Verify backend rejection if frontend bypassed

**Acceptance Criteria**:
- [ ] All content types enforce correct limits
- [ ] Frontend prevents typing beyond limit
- [ ] Backend rejects oversized content
- [ ] Error messages display correctly
- [ ] No false positives (valid content rejected)

---

## Phase 4: Documentation & Testing (2-3 hours)

### 4.1 Backend Integration Tests (Effort: M, ~45 min)
- [ ] File: `backend/pkg/db/services/actions/submissions_test.go`
  - [ ] Add `TestSubmitActionWithOversizedContent`
  - [ ] Verify HTTP 413 response
  - [ ] Verify error message format
- [ ] File: `backend/pkg/db/services/actions/results_test.go`
  - [ ] Add `TestCreateActionResultWithOversizedContent`
- [ ] File: `backend/pkg/db/services/messages/creation_test.go`
  - [ ] Add `TestCreatePostWithOversizedContent`
  - [ ] Add `TestCreateCommentWithOversizedContent`
  - [ ] Add `TestCreatePrivateMessageWithOversizedContent`
- [ ] Run all backend tests: `just test`

**Acceptance Criteria**:
- [ ] Each service has oversized content test
- [ ] All tests verify HTTP 413 status
- [ ] All tests verify error message format
- [ ] All tests pass

---

### 4.2 Frontend Component Tests (Effort: M, ~45 min)
- [ ] Test `Textarea.tsx` character counter:
  - [ ] Counter displays correctly
  - [ ] Counter updates on input
  - [ ] Counter turns red at 90%+
  - [ ] maxLength blocks typing
- [ ] Test all updated components:
  - [ ] `ActionSubmission.test.tsx`
  - [ ] `GameResultsManager.test.tsx`
  - [ ] `CommentEditor.test.tsx`
  - [ ] Post creation component tests
  - [ ] `MessageThread.test.tsx`
- [ ] Verify character counter visible
- [ ] Verify maxLength enforced
- [ ] Run frontend tests: `just test-frontend`

**Acceptance Criteria**:
- [ ] All component tests pass
- [ ] Character counter behavior verified
- [ ] maxLength enforcement tested
- [ ] No test failures

---

### 4.3 E2E Tests (Effort: L, ~60 min)
- [ ] Create file `frontend/e2e/content/content-length-limits.spec.ts`
- [ ] Test: Action submission with oversized content
  - [ ] Login as player
  - [ ] Navigate to game with active action phase
  - [ ] Paste 100,001 characters into action textarea
  - [ ] Attempt submit
  - [ ] Verify error message appears
- [ ] Test: Post creation with oversized content
  - [ ] Navigate to common room
  - [ ] Paste 50,001 characters into post textarea
  - [ ] Attempt submit
  - [ ] Verify error message
- [ ] Test: Comment with oversized content
  - [ ] Reply to existing post
  - [ ] Paste 10,001 characters
  - [ ] Verify error message
- [ ] Run E2E tests: `npx playwright test e2e/content/content-length-limits.spec.ts`

**Acceptance Criteria**:
- [ ] E2E test for action submission limit
- [ ] E2E test for post limit
- [ ] E2E test for comment limit
- [ ] All E2E tests pass
- [ ] Tests run in CI pipeline

---

### 4.4 Update User Documentation (Effort: S, ~20 min)
- [ ] Create file `docs/features/CONTENT_LIMITS.md`
- [ ] Document all content type limits:
  - [ ] Action submissions: 100,000 characters
  - [ ] Action results: 100,000 characters
  - [ ] Posts: 50,000 characters
  - [ ] Comments: 10,000 characters
  - [ ] Private messages: 50,000 characters
- [ ] Explain rationale for limits
- [ ] Provide workaround: "Compose content in external editor, then paste"
- [ ] Include character count guidance (e.g., "100K chars ≈ 20,000 words")

**Acceptance Criteria**:
- [ ] Documentation clearly lists all limits
- [ ] Rationale explained
- [ ] Workarounds provided
- [ ] Examples included

---

### 4.5 Update API Documentation (Effort: S, ~15 min)
- [ ] Open file `.claude/reference/API_DOCUMENTATION.md`
- [ ] For each content creation endpoint, add:
  - [ ] HTTP 413 error response
  - [ ] Error response schema
  - [ ] Character limit in request body description
- [ ] Example:
  ```markdown
  #### POST /api/v1/games/:id/phases/actions

  **Request Body**:
  - `content` (string, required, max 100,000 characters)

  **Responses**:
  - 201: Action created successfully
  - 413: Content exceeds maximum length
    ```json
    {
      "error": "Content exceeds maximum length of 100000 characters (submitted: 105432)"
    }
    ```
  ```

**Acceptance Criteria**:
- [ ] All content endpoints documented
- [ ] 413 responses documented
- [ ] Error schema included
- [ ] Character limits specified

---

## Post-Implementation Checklist

### Code Quality
- [ ] All code follows ActionPhase coding standards
- [ ] No hardcoded magic numbers (use constants)
- [ ] All functions have godoc/JSDoc comments
- [ ] TypeScript strict mode passes
- [ ] No linter warnings

### Testing
- [ ] Unit tests: 100% coverage on validation functions
- [ ] Integration tests: All backend services tested
- [ ] Component tests: All UI components tested
- [ ] E2E tests: Critical user flows tested
- [ ] All tests pass in CI pipeline

### Documentation
- [ ] Feature documentation created
- [ ] API documentation updated
- [ ] Code comments added
- [ ] Context file updated (this file)

### Deployment
- [ ] Create feature branch: `feature/content-length-limits`
- [ ] Backend changes committed
- [ ] Frontend changes committed
- [ ] Tests committed
- [ ] Documentation committed
- [ ] PR created for review
- [ ] CI pipeline passes
- [ ] Code review approved
- [ ] Merged to main branch

---

## Progress Tracking

**Started**: YYYY-MM-DD
**Phase 1 Complete**: YYYY-MM-DD
**Phase 2 Complete**: YYYY-MM-DD
**Phase 3 Complete**: YYYY-MM-DD
**Phase 4 Complete**: YYYY-MM-DD
**Finished**: YYYY-MM-DD

**Total Time**: X hours

---

## Notes

Use this section to track issues, decisions, or observations during implementation.

-

---

## Completion Criteria

This feature is considered complete when:
- [ ] All 4 phases completed
- [ ] All checklist items marked done
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Code merged to main branch
- [ ] Feature verified in production (if applicable)
