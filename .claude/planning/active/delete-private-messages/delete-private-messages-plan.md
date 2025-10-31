# Delete Private Messages - Implementation Plan

**Last Updated**: 2025-10-30

## Executive Summary

Implement the ability for users to soft-delete their own private messages from conversations. This feature will allow users to remove messages they've sent, with the message content being replaced by "[Message deleted]" while preserving the conversation structure and notification history.

**Scope**: Soft-delete functionality for private messages only (not common room posts/comments)
**Timeline Estimate**: 2-3 days (16-24 hours total effort)
**Complexity**: Medium - requires database migration, API implementation, frontend UI, and testing

---

## Current State Analysis

### Existing Infrastructure

**Database Schema**:
- `private_messages` table exists in `20250805170112_add_game_system_tables.up.sql`
- Current schema has: `id`, `conversation_id`, `sender_user_id`, `sender_character_id`, `content`, `created_at`, `updated_at`
- **NO soft-delete fields** (`deleted_at`, `is_deleted`) currently present

**Backend Services**:
- `ConversationService` in `backend/pkg/db/services/conversations.go` handles conversation operations
- SQL queries in `backend/pkg/db/queries/communications.sql` (includes `SendPrivateMessage`, `GetConversationMessages`)
- API handlers in `backend/pkg/conversations/api.go` (routes under `/api/v1/games/{gameId}/conversations`)

**Frontend Components**:
- `ConversationsApi` in `frontend/src/lib/api/conversations.ts` (currently NO delete method)
- `PrivateMessages.tsx` component displays conversation list and threads
- `MessageThread` component (likely) renders individual messages

**Similar Pattern - Common Room Messages**:
- Common room messages (`messages` table) already have soft-delete: `deleted_at`, `is_deleted` fields
- `SoftDeleteMessage` query exists in `communications.sql` for common room messages
- This provides a proven pattern we can follow

### Current Gaps

1. ❌ No `deleted_at` or `is_deleted` columns in `private_messages` table
2. ❌ No SQL query to soft-delete private messages
3. ❌ No backend API endpoint to delete messages
4. ❌ No frontend API client method for deletion
5. ❌ No UI controls (delete button, confirmation modal)
6. ❌ No authorization check (users can only delete their own messages)
7. ❌ No test coverage for deletion functionality

---

## Proposed Future State

### User Experience

**Actor**: Player or GM who sent a private message
**Action**: Delete a message they previously sent
**Result**:
- Message content replaced with "[Message deleted]"
- Metadata preserved (sender, timestamp, character)
- Other participants see the deletion immediately
- Original sender can still see message was deleted but not content

### Technical Implementation

**Database Layer**:
```sql
-- Migration adds soft-delete fields
ALTER TABLE private_messages
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;

-- New query for soft deletion
UPDATE private_messages
SET deleted_at = NOW(), is_deleted = true
WHERE id = $1 AND sender_user_id = $2;
```

**API Layer**:
```http
DELETE /api/v1/games/{gameId}/conversations/{conversationId}/messages/{messageId}
Authorization: Bearer {jwt_token}

Response 200:
{
  "message": "Message deleted successfully",
  "id": 123
}
```

**Frontend Layer**:
```typescript
// API client
async deleteMessage(gameId: number, conversationId: number, messageId: number)

// UI: Three-dot menu on message hover
[Message content]  [...] ← Delete option for sender only
```

---

## Implementation Phases

### Phase 1: Database Schema Changes
**Effort**: S (2-3 hours)

Add soft-delete fields to `private_messages` table and create necessary SQL queries.

**Tasks**:
1. ✅ Create migration to add `deleted_at` and `is_deleted` columns
2. ✅ Add SQL query `SoftDeletePrivateMessage` in `communications.sql`
3. ✅ Add SQL query `GetConversationMessagesWithDeleted` (include soft-deleted messages)
4. ✅ Run `just sqlgen` to regenerate models
5. ✅ Run migration with `just migrate`

**Acceptance Criteria**:
- Migration runs without errors
- `private_messages` table has new columns
- Generated Go code includes new query methods
- Migration is reversible (has `.down.sql`)

---

### Phase 2: Backend API Implementation
**Effort**: M (4-6 hours)

Implement backend service and API endpoint for deleting private messages.

**Tasks**:
1. ✅ Add `DeletePrivateMessage` method to `ConversationService`
   - Accept `ctx`, `messageID`, `userID` parameters
   - Query message to verify ownership (sender_user_id == userID)
   - Return authorization error if not owner
   - Call `SoftDeletePrivateMessage` query
   - Return success response

2. ✅ Add DELETE endpoint in `conversations/api.go`
   - Route: `r.Delete("/{conversationId}/messages/{messageId}", h.DeleteMessage)`
   - Extract messageId and conversationId from URL params
   - Get userID from JWT token
   - Verify user is participant in conversation
   - Call service method
   - Return appropriate HTTP status codes

3. ✅ Update `GetConversationMessages` to handle deleted messages
   - Include deleted messages in query results
   - Transform deleted messages: replace content with "[Message deleted]"
   - Preserve metadata (id, sender, timestamp, is_deleted flag)

4. ✅ Write backend unit tests
   - Test successful deletion by owner
   - Test authorization failure (non-owner attempts delete)
   - Test non-existent message
   - Test deleted messages appear with placeholder text

**Acceptance Criteria**:
- Endpoint returns 200 when user deletes their own message
- Endpoint returns 403 when user tries to delete someone else's message
- Endpoint returns 404 for non-existent message
- Deleted messages show "[Message deleted]" in GET responses
- All tests pass: `just test`

---

### Phase 3: Frontend API Client
**Effort**: S (1-2 hours)

Add API client method for deleting messages.

**Tasks**:
1. ✅ Add `deleteMessage` method to `ConversationsApi` class
   ```typescript
   async deleteMessage(gameId: number, conversationId: number, messageId: number) {
     return this.client.delete<{ message: string; id: number }>(
       `/api/v1/games/${gameId}/conversations/${conversationId}/messages/${messageId}`
     );
   }
   ```

2. ✅ Update `PrivateMessage` type to include `is_deleted` and `deleted_at` fields
   ```typescript
   export interface PrivateMessage {
     // ... existing fields
     deleted_at?: string;
     is_deleted?: boolean;
   }
   ```

**Acceptance Criteria**:
- TypeScript compiles without errors
- API client method has correct endpoint path
- Response type matches backend response

---

### Phase 4: Frontend UI Implementation
**Effort**: M (5-7 hours)

Add UI controls for deleting messages in the message thread component.

**Tasks**:
1. ✅ Find/Create `MessageThread.tsx` or message item component
   - Identify where individual messages are rendered
   - Add state for delete confirmation modal

2. ✅ Add three-dot menu button to each message
   - Only show for messages sent by current user
   - Position on message hover (right side)
   - Use IconButton with MoreVertical icon

3. ✅ Implement delete confirmation modal
   - Use existing Modal component or create simple confirmation
   - Text: "Are you sure you want to delete this message? This cannot be undone."
   - Actions: "Cancel" and "Delete" (danger variant)

4. ✅ Implement delete handler
   ```typescript
   const handleDelete = async (messageId: number) => {
     await apiClient.conversations.deleteMessage(gameId, conversationId, messageId);
     // Invalidate query to refetch messages
     queryClient.invalidateQueries(['conversationMessages', conversationId]);
   };
   ```

5. ✅ Style deleted messages
   - Show "[Message deleted]" in italicized gray text
   - Keep sender name and timestamp visible
   - Disable delete button for already-deleted messages

6. ✅ Add optimistic update (optional enhancement)
   - Immediately update UI when delete is clicked
   - Rollback if API call fails

**Acceptance Criteria**:
- Delete button appears on hover for user's own messages
- Delete button does NOT appear for other users' messages
- Confirmation modal prevents accidental deletion
- Deleted messages show "[Message deleted]" immediately after deletion
- React Query cache invalidates and refetches conversation messages
- UI handles errors gracefully (network failure, authorization failure)

---

### Phase 5: Testing & Quality Assurance
**Effort**: M (4-6 hours)

Comprehensive testing across all layers.

**Tasks**:
1. ✅ Backend unit tests (continuation from Phase 2)
   - Test `ConversationService.DeletePrivateMessage` with mocks
   - Test authorization logic
   - Table-driven tests for edge cases

2. ✅ Backend integration tests
   - Test full request flow through API handler
   - Test with actual test database
   - Verify transaction rollback on error

3. ✅ API endpoint testing with curl
   ```bash
   # Login and get token
   ./backend/scripts/api-test.sh login-player

   # Delete a message
   curl -X DELETE \
     -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
     http://localhost:3000/api/v1/games/2/conversations/1/messages/5

   # Verify deletion
   curl -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
     http://localhost:3000/api/v1/games/2/conversations/1/messages | jq '.messages[] | select(.id==5)'
   ```

4. ✅ Frontend component tests
   - Test delete button renders for own messages
   - Test delete button hidden for others' messages
   - Test confirmation modal flow
   - Test deleted message rendering

5. ✅ E2E tests (Playwright) - LAST STEP
   - **ONLY after all unit/API/component tests pass**
   - Test complete deletion flow in browser
   - Verify multi-user scenarios (sender sees deletion, recipient sees deletion)

**Pre-E2E Checklist** (MANDATORY):
- [ ] Backend unit test passes: `go test ./pkg/db/services -run TestDeletePrivateMessage -v`
- [ ] API returns correct data: `curl -X DELETE ... | jq '.message'`
- [ ] Frontend component test passes: `npm test -- MessageThread.test.tsx`
- [ ] System verification passes: Both servers running, can send/delete messages manually

**E2E Test Scenarios** (only after checklist passes):
```typescript
test('user can delete their own private message', async ({ page }) => {
  // Login as Player1, navigate to conversation
  // Send a message
  // Click delete button
  // Confirm deletion
  // Verify message shows "[Message deleted]"
});

test('user cannot delete other users messages', async ({ page }) => {
  // Login as Player1, navigate to conversation with Player2's messages
  // Verify no delete button appears on Player2's messages
});
```

**Acceptance Criteria**:
- All backend tests pass: `just test`
- All frontend tests pass: `just test-frontend`
- API curl tests return expected responses
- E2E tests pass: `npx playwright test --grep "delete.*private"`
- No console errors in browser during manual testing

---

### Phase 6: Documentation & Polish
**Effort**: S (1-2 hours)

Document the new feature and update related documentation.

**Tasks**:
1. ✅ Update API documentation in `.claude/reference/API_DOCUMENTATION.md`
   - Add DELETE endpoint details
   - Document request/response formats
   - Document error codes

2. ✅ Update test fixtures if needed
   - Add deleted private message examples to E2E fixtures
   - Document in `.claude/context/TEST_DATA.md`

3. ✅ Add user-facing documentation (if applicable)
   - Update feature guide or help documentation
   - Add to changelog/release notes

**Acceptance Criteria**:
- API documentation is current and accurate
- Test fixtures include deletion scenarios
- Feature is documented for users

---

## Risk Assessment and Mitigation Strategies

### Technical Risks

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|-----------|--------|---------------------|
| Schema migration fails in production | Low | High | Test migration thoroughly in development; create rollback plan; use reversible migrations |
| Authorization bypass allows deleting others' messages | Medium | Critical | Implement strict authorization checks; add comprehensive tests; code review |
| Race condition: message deleted while being read | Low | Medium | Use database transactions; handle 404 gracefully in frontend |
| Frontend cache inconsistency after deletion | Medium | Low | Use React Query's invalidation; implement optimistic updates correctly |
| E2E tests flaky due to timing issues | High | Low | Use explicit waits; verify lower-level tests pass first; follow E2E best practices |

### Product Risks

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|-----------|--------|---------------------|
| Users expect hard delete (permanent removal) | Medium | Low | Use clear messaging: "This message will be replaced with '[Message deleted]'" |
| Confusion about who can see deletion | Low | Medium | Document behavior clearly; consider UI indicators |
| Abuse: users delete messages to hide evidence | Low | Medium | Consider GM override or audit log (future enhancement) |

### Mitigation Actions

**Pre-Implementation**:
- ✅ Review common room soft-delete pattern for consistency
- ✅ Plan authorization strategy upfront
- ✅ Design clear user messaging for deletion behavior

**During Implementation**:
- ✅ Write tests BEFORE implementation (TDD)
- ✅ Test authorization edge cases thoroughly
- ✅ Verify migration is reversible
- ✅ Follow E2E checklist strictly (no E2E until lower tests pass)

**Post-Implementation**:
- ✅ Code review with focus on authorization
- ✅ Manual testing of edge cases
- ✅ Monitor for any issues in production logs

---

## Success Metrics

### Functional Metrics
- ✅ Users can delete their own messages
- ✅ Users cannot delete others' messages
- ✅ Deleted messages show placeholder text
- ✅ All participants see deletion immediately
- ✅ Zero authorization bypass incidents

### Technical Metrics
- ✅ Test coverage: >80% for new code
- ✅ API response time: <200ms for delete operation
- ✅ Zero schema migration errors
- ✅ All E2E tests pass on first run (no flakiness)

### User Experience Metrics
- ✅ Delete action completes in <500ms perceived time (with optimistic update)
- ✅ Zero user confusion about deletion behavior (based on feedback)
- ✅ Confirmation modal prevents accidental deletions

---

## Required Resources and Dependencies

### Technical Dependencies
- **Database**: PostgreSQL with migration support
- **Backend**: Go, Chi router, sqlc, pgx
- **Frontend**: React, TypeScript, React Query, Tailwind CSS
- **Testing**: Go testing, Vitest, Playwright

### Development Dependencies
- Running development environment (backend + frontend servers)
- Test database with migrations applied
- E2E test fixtures (private message conversations)

### Knowledge Dependencies
- Familiarity with sqlc query generation
- Understanding of JWT authorization in Chi middleware
- React Query cache invalidation patterns
- Playwright E2E testing best practices (see `.claude/context/TESTING.md`)

### External Dependencies
- None (feature is self-contained)

---

## Timeline Estimates

**Total Effort**: 16-24 hours (2-3 days)

| Phase | Effort | Duration |
|-------|--------|----------|
| Phase 1: Database Schema | S | 2-3 hours |
| Phase 2: Backend API | M | 4-6 hours |
| Phase 3: Frontend API Client | S | 1-2 hours |
| Phase 4: Frontend UI | M | 5-7 hours |
| Phase 5: Testing & QA | M | 4-6 hours |
| Phase 6: Documentation | S | 1-2 hours |

**Critical Path**: Database → Backend → Frontend UI → Testing → E2E

**Recommended Approach**:
1. Complete Phases 1-2 in one session (backend complete)
2. Complete Phases 3-4 in second session (frontend complete)
3. Complete Phases 5-6 in third session (testing & polish)

---

## Implementation Notes

### Following Project Patterns

**Clean Architecture**:
- Interface definition in `backend/pkg/core/interfaces.go` (if service interface changes)
- Service implementation in `backend/pkg/db/services/conversations.go`
- HTTP handlers in `backend/pkg/conversations/api.go`

**Authorization Pattern**:
```go
// Verify user owns the message
message, err := qtx.GetPrivateMessage(ctx, messageID)
if err != nil {
    return core.ErrNotFound("message", messageID)
}
if message.SenderUserID != userID {
    return core.ErrForbidden("You can only delete your own messages")
}
```

**Error Handling**:
```go
// Use typed errors with correlation IDs
if err := service.DeletePrivateMessage(ctx, req); err != nil {
    return core.ErrInternalError(err, correlationID)
}
```

**Frontend State Management**:
```typescript
// Use React Query for server state
const { mutate: deleteMessage } = useMutation({
  mutationFn: (messageId: number) =>
    apiClient.conversations.deleteMessage(gameId, conversationId, messageId),
  onSuccess: () => {
    queryClient.invalidateQueries(['conversationMessages', conversationId]);
  },
});
```

### Testing Strategy

**Test Pyramid** (follow strictly):
1. Unit tests (fast, isolated) - FIRST
2. API integration tests (curl) - SECOND
3. Component tests (React Testing Library) - THIRD
4. E2E tests (Playwright) - LAST

**Key Test Scenarios**:
- ✅ Authorization: Owner can delete, non-owner cannot
- ✅ Soft delete: Message content replaced, metadata preserved
- ✅ Display: Deleted messages render with placeholder
- ✅ Edge cases: Non-existent message, already-deleted message
- ✅ Multi-user: Both participants see deletion

---

## References

### Project Documentation
- **Architecture Patterns**: `.claude/context/ARCHITECTURE.md`
- **Testing Strategy**: `.claude/context/TESTING.md`
- **Test Data**: `.claude/context/TEST_DATA.md`
- **API Design**: `/docs/adrs/004-api-design-principles.md`

### Similar Implementations
- **Common Room Soft Delete**: `SoftDeleteMessage` in `communications.sql`
- **Comment Deletion**: `deleteComment` in `frontend/src/lib/api/messages.ts`

### Technical References
- **Chi Router**: https://github.com/go-chi/chi
- **sqlc Documentation**: https://docs.sqlc.dev/
- **React Query Mutations**: https://tanstack.com/query/latest/docs/react/guides/mutations
- **Playwright Best Practices**: https://playwright.dev/docs/best-practices

---

## Checklist Before Starting Implementation

- [ ] Read `.claude/context/ARCHITECTURE.md` for patterns
- [ ] Read `.claude/context/TESTING.md` for test requirements
- [ ] Review `communications.sql` for soft-delete pattern
- [ ] Ensure development environment is running
- [ ] Verify test database is accessible
- [ ] Plan authorization strategy
- [ ] Identify which frontend component renders messages
- [ ] Create feature branch: `git checkout -b feature/delete-private-messages`

---

**Next Steps**: Review this plan, then proceed to Phase 1 (Database Schema Changes).
