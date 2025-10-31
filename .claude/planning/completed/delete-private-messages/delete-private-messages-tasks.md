# Delete Private Messages - Task Checklist

**Last Updated**: 2025-10-30 16:53 PST

## Pre-Implementation Setup
- [x] Read `.claude/context/ARCHITECTURE.md`
- [x] Read `.claude/context/TESTING.md`
- [x] Review `backend/pkg/db/queries/communications.sql` (soft delete pattern)
- [x] Ensure development environment running (backend + frontend)
- [x] Verify test database accessible
- [ ] Create feature branch: `git checkout -b feature/delete-private-messages` (NOT NEEDED - implemented in main session)

---

## Phase 1: Database Schema Changes ✅ COMPLETE

### Migration Creation
- [x] Create migration file: `20251030231220_add_soft_delete_to_private_messages`
- [x] Write `.up.sql`: Add `deleted_at TIMESTAMP WITH TIME ZONE` column
- [x] Write `.up.sql`: Add `is_deleted BOOLEAN DEFAULT FALSE` column
- [x] Write `.up.sql`: Add index `idx_private_messages_deleted`
- [x] Write `.down.sql`: Drop index and columns for rollback
- [x] Apply migration: `just migrate`
- [x] Verify schema: Migration applied to both dev and test databases

### SQL Queries
- [x] Add `GetPrivateMessage` query to `communications.sql`
- [x] Add `SoftDeletePrivateMessage` query to `communications.sql`
- [x] Update `GetConversationMessages` to include `deleted_at` and `is_deleted` in SELECT
- [x] Update `schema.sql` with new columns
- [x] Run `just sqlgen` to regenerate Go models
- [x] Verify no compilation errors: Backend builds successfully

**Phase 1 Complete**: ✅ Schema updated, queries added, models generated

---

## Phase 2: Backend API Implementation ✅ COMPLETE (except unit tests)

### Service Layer
- [x] Open `backend/pkg/db/services/conversations.go`
- [x] Add `DeletePrivateMessage` method (lines 213-229)
- [x] Implement ownership verification with GetPrivateMessage query
- [x] Check sender: Returns 403 if sender_user_id != userID
- [x] Call SoftDeletePrivateMessage query
- [x] Return appropriate errors (NotFound, Forbidden, Internal)

### API Handler
- [x] Open `backend/pkg/conversations/api.go`
- [x] Add DELETE route in `RegisterRoutes` (line 52)
- [x] Implement `DeleteMessage` handler (lines 205-253):
  - [x] Extract messageId from URL params
  - [x] Extract conversationId from URL params
  - [x] Get userID from JWT token (getUserIDFromToken)
  - [x] Call conversationService.DeletePrivateMessage
  - [x] Return 200 OK with success message
  - [x] Handle errors: 404 (not found), 403 (forbidden), 401 (unauthorized)

### Update Message Retrieval
- [x] Modified `GetConversationMessages` service method (lines 156-211):
  - [x] Query includes `deleted_at` and `is_deleted` fields
  - [x] Transform response: Replace content with "[Message deleted]" when is_deleted = true
  - [x] Preserve all other fields (id, sender, timestamp, etc.)

### Backend Unit Tests ⏸️ PENDING
- [ ] Create `conversations_delete_test.go` (or add to existing test file)
- [ ] Test `DeletePrivateMessage` success
- [ ] Test unauthorized deletion (non-owner)
- [ ] Test non-existent message
- [ ] Test already-deleted message (idempotency)
- [ ] Run tests: `just test`

**Phase 2 Status**: ✅ API implementation complete, ⏸️ Unit tests pending

---

## Phase 3: Frontend API Client ✅ COMPLETE

### API Client Method
- [x] Open `frontend/src/lib/api/conversations.ts`
- [x] Add `deleteMessage` method to `ConversationsApi` class

### Type Updates
- [x] Open `frontend/src/types/conversations.ts`
- [x] Add fields to `PrivateMessage` interface:
  - `deleted_at?: string`
  - `is_deleted?: boolean`
- [x] Run TypeScript check: Frontend builds successfully
- [x] Verify no compilation errors

**Phase 3 Complete**: ✅ API client method added, types updated

---

## Phase 4: Frontend UI Implementation (5-7 hours)

### Component Discovery
- [ ] Find component that renders individual messages:
  - [ ] Search for `MessageThread`, `MessageItem`, `ConversationMessage`, etc.
  - [ ] Check imports in `PrivateMessages.tsx`
  - [ ] Identify exact component file path: `_________________`

### Delete Button UI
- [ ] Open message component file
- [ ] Import icons: `import { MoreVertical, Trash2 } from 'lucide-react';`
- [ ] Add state for delete menu/modal:
  ```typescript
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);
  ```
- [ ] Add three-dot menu button (right side of message):
  - [ ] Only show for messages where `message.sender_user_id === currentUserId`
  - [ ] Use IconButton or similar component
  - [ ] Position with `absolute right-2` or similar
  - [ ] Show on hover: `group-hover:opacity-100 opacity-0`
- [ ] Add click handler to open confirmation modal

### Confirmation Modal
- [ ] Import or create Modal component
- [ ] Add modal JSX:
  ```tsx
  <Modal
    isOpen={showDeleteModal}
    onClose={() => setShowDeleteModal(false)}
    title="Delete Message?"
  >
    <p>Are you sure you want to delete this message? It will be replaced with "[Message deleted]" for all participants. This action cannot be undone.</p>
    <div className="flex gap-2 mt-4">
      <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
        Cancel
      </Button>
      <Button variant="danger" onClick={handleDeleteConfirm}>
        Delete
      </Button>
    </div>
  </Modal>
  ```

### Delete Handler
- [ ] Import `useMutation` from React Query
- [ ] Import `apiClient` from `../lib/api`
- [ ] Create mutation:
  ```typescript
  const { mutate: deleteMessage, isPending } = useMutation({
    mutationFn: (messageId: number) =>
      apiClient.conversations.deleteMessage(gameId, conversationId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries(['conversationMessages', conversationId]);
      setShowDeleteModal(false);
      // Optional: Show success toast
    },
    onError: (error) => {
      console.error('Failed to delete message:', error);
      // Optional: Show error toast
    },
  });
  ```
- [ ] Implement `handleDeleteConfirm`:
  ```typescript
  const handleDeleteConfirm = () => {
    if (messageToDelete) {
      deleteMessage(messageToDelete);
    }
  };
  ```

### Deleted Message Rendering
- [ ] Update message content rendering:
  ```tsx
  {message.is_deleted ? (
    <span className="italic text-content-tertiary">
      [Message deleted]
    </span>
  ) : (
    <MarkdownPreview content={message.content} />
  )}
  ```
- [ ] Disable delete button for already-deleted messages:
  ```tsx
  {!message.is_deleted && message.sender_user_id === currentUserId && (
    <IconButton icon={MoreVertical} onClick={handleDeleteClick} />
  )}
  ```

### Styling & Polish
- [ ] Test in light mode and dark mode
- [ ] Verify responsive design (mobile and desktop)
- [ ] Add loading state to delete button during `isPending`
- [ ] Add subtle animation/transition for deletion

### Frontend Component Tests
- [ ] Create or update test file: `MessageItem.test.tsx` (or similar)
- [ ] Test delete button visibility:
  ```typescript
  test('delete button appears for own messages', () => {
    render(<MessageItem message={ownMessage} currentUserId={1} />);
    expect(screen.getByLabelText('Delete message')).toBeInTheDocument();
  });
  ```
- [ ] Test delete button hidden for others:
  ```typescript
  test('delete button hidden for other users messages', () => {
    render(<MessageItem message={otherMessage} currentUserId={1} />);
    expect(screen.queryByLabelText('Delete message')).not.toBeInTheDocument();
  });
  ```
- [ ] Test confirmation modal flow
- [ ] Test deleted message rendering
- [ ] Run tests: `just test-frontend`
- [ ] Verify all tests pass

**Phase 4 Complete**: ✅ UI working, component tests passing

---

## Phase 5: Testing & Quality Assurance (4-6 hours)

### API Testing with curl
- [ ] Start backend server: `just dev`
- [ ] Login as TestPlayer1: `./backend/scripts/api-test.sh login-player`
- [ ] Token saved to `/tmp/api-token.txt`
- [ ] Find a conversation ID and message ID from database:
  ```bash
  psql -d actionphase -c "SELECT id, conversation_id FROM private_messages WHERE sender_user_id = 1 LIMIT 1;"
  ```
- [ ] Test successful deletion (own message):
  ```bash
  curl -X DELETE \
    -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    http://localhost:3000/api/v1/games/2/conversations/1/messages/5
  ```
- [ ] Expected response: `{"message": "Message deleted successfully", "id": 5}`
- [ ] Verify message is deleted:
  ```bash
  curl -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    http://localhost:3000/api/v1/games/2/conversations/1/messages | jq '.messages[] | select(.id==5)'
  ```
- [ ] Expected: `content: "[Message deleted]"`, `is_deleted: true`

- [ ] Login as TestPlayer2: `./backend/scripts/api-test.sh login-player` (Player2 credentials)
- [ ] Test unauthorized deletion (Player2 tries to delete Player1's message):
  ```bash
  curl -X DELETE \
    -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    http://localhost:3000/api/v1/games/2/conversations/1/messages/6
  ```
- [ ] Expected response: `403 Forbidden` with error message

### Manual UI Testing
- [ ] Start both servers: `just dev` (backend) and `just run-frontend` (frontend)
- [ ] Login as TestPlayer1
- [ ] Navigate to a conversation with messages
- [ ] Verify delete button appears on own messages
- [ ] Verify delete button does NOT appear on other users' messages
- [ ] Click delete button, verify confirmation modal appears
- [ ] Cancel deletion, verify message not deleted
- [ ] Click delete button again, confirm deletion
- [ ] Verify message content changes to "[Message deleted]" immediately
- [ ] Verify message still shows sender and timestamp
- [ ] Open browser DevTools, check for console errors (should be none)

### Multi-User Testing
- [ ] Open incognito window, login as TestPlayer2
- [ ] Navigate to same conversation
- [ ] Verify TestPlayer2 sees TestPlayer1's deleted message as "[Message deleted]"
- [ ] Verify TestPlayer2 cannot delete TestPlayer1's messages

### Backend Integration Tests
- [ ] Write integration test with test database:
  ```go
  func TestDeleteMessageAPI_Integration(t *testing.T) {
    // Test full request/response cycle through handler
    // Use httptest.NewRecorder
  }
  ```
- [ ] Run integration tests: `SKIP_DB_TESTS=false just test`

### E2E Tests (ONLY after all above pass)

**Pre-E2E Checklist** (MANDATORY):
- [ ] Backend unit test passes: `go test ./pkg/db/services -run TestDeletePrivateMessage -v`
- [ ] API curl test passes: Successfully deleted message via curl
- [ ] Frontend component test passes: `npm test -- MessageItem.test.tsx`
- [ ] Manual UI test passes: Successfully deleted message in browser
- [ ] Both servers running without errors

**E2E Test Implementation**:
- [ ] Create or update E2E test fixture:
  - [ ] Add private message conversation to `07_common_room.sql` or similar
  - [ ] Game #170 or next available ID
  - [ ] Include messages from Player1 and Player2
  - [ ] Document in `.claude/context/TEST_DATA.md`
- [ ] Apply E2E fixtures: `./backend/pkg/db/test_fixtures/apply_e2e.sh`
- [ ] Create `e2e/messaging/private-message-deletion.spec.ts`:
  ```typescript
  test('user can delete their own private message', async ({ page }) => {
    await loginAsPlayer1(page);
    const gameId = await getFixtureGameId(page, 'PRIVATE_MESSAGES');
    await page.goto(`http://localhost:5173/games/${gameId}/messages`);

    // Find a message from Player1
    const message = page.locator('[data-testid="message-item"]').first();
    await message.hover();

    // Click delete button
    await page.locator('[data-testid="delete-message-button"]').click();

    // Confirm deletion
    await page.locator('[data-testid="confirm-delete"]').click();

    // Verify message shows "[Message deleted]"
    await expect(message.locator('.message-content'))
      .toContainText('[Message deleted]');
  });
  ```
- [ ] Test unauthorized deletion attempt:
  ```typescript
  test('user cannot delete other users messages', async ({ page }) => {
    await loginAsPlayer1(page);
    // Navigate to conversation
    // Verify no delete button on Player2's messages
    await expect(page.locator('[data-testid="delete-message-button"]'))
      .toHaveCount(0);  // Or only count matches user's own messages
  });
  ```
- [ ] Run E2E tests: `npx playwright test --grep "private.*message.*delet"`
- [ ] Verify tests pass on first run (no flakiness)

**Phase 5 Complete**: ✅ All tests passing, feature verified

---

## Phase 6: Documentation & Polish (1-2 hours)

### API Documentation
- [ ] Open `.claude/reference/API_DOCUMENTATION.md`
- [ ] Add DELETE endpoint documentation:
  ```markdown
  ### DELETE /api/v1/games/{gameId}/conversations/{conversationId}/messages/{messageId}

  Delete a private message (soft delete).

  **Authorization**: Required (JWT)
  **Permission**: User must be message sender

  **Response 200**:
  ```json
  {
    "message": "Message deleted successfully",
    "id": 123
  }
  ```

  **Errors**:
  - 403 Forbidden: User is not message sender
  - 404 Not Found: Message does not exist
  - 500 Internal Server Error
  ```

### Test Fixture Documentation
- [ ] Open `.claude/context/TEST_DATA.md`
- [ ] Add E2E fixture documentation:
  ```markdown
  ### Game #170: E2E Private Message Deletion
  - **Purpose**: Testing private message deletion flow
  - **Participants**: TestPlayer1, TestPlayer2
  - **Messages**: Multiple messages from both users for deletion testing
  - **Test File**: `e2e/messaging/private-message-deletion.spec.ts`
  ```

### User Documentation (if applicable)
- [ ] Update user guide or help documentation (if exists)
- [ ] Add to changelog/release notes
- [ ] Screenshot delete confirmation modal for documentation

### Code Cleanup
- [ ] Remove any console.log debugging statements
- [ ] Remove commented-out code
- [ ] Verify all TODOs addressed or documented
- [ ] Format code: `cd backend && go fmt ./...` and `cd frontend && npm run format`
- [ ] Lint check: `cd frontend && npm run lint`

**Phase 6 Complete**: ✅ Documentation updated, code polished

---

## Final Verification

### Pre-Merge Checklist
- [ ] All backend tests pass: `just test`
- [ ] All frontend tests pass: `just test-frontend`
- [ ] All E2E tests pass: `npx playwright test`
- [ ] No console errors in browser
- [ ] No TypeScript compilation errors
- [ ] API responds correctly to curl tests
- [ ] Migration is reversible (tested `.down.sql`)
- [ ] Code formatted and linted
- [ ] Documentation updated
- [ ] Test fixtures documented

### Functionality Verification
- [ ] User can delete their own messages ✅
- [ ] User cannot delete others' messages ✅
- [ ] Deleted messages show "[Message deleted]" ✅
- [ ] Confirmation modal prevents accidental deletion ✅
- [ ] All participants see deletion immediately ✅
- [ ] No performance degradation (<500ms delete action) ✅

### Code Review Preparation
- [ ] Self-review all changes
- [ ] Check for authorization vulnerabilities
- [ ] Verify error handling is comprehensive
- [ ] Ensure consistent code style
- [ ] Add meaningful commit messages

---

## Ready for Review

**Total Progress**: ____ / ____ tasks complete

**Estimated Completion**: _______________

**Blockers**: None / _______________

**Next Steps**:
1. Self-review
2. Create pull request
3. Request code review
4. Address feedback
5. Merge to main

---

**Last Updated**: 2025-10-30
**Feature Branch**: `feature/delete-private-messages`
