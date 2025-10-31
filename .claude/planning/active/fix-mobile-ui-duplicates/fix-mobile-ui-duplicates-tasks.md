# Fix Mobile UI Duplicates - Task Checklist

**Last Updated**: 2025-10-31
**Current Phase**: Phase 1 - Critical Path Fixes

---

## Phase 1: Critical Path Fixes ⏳

### 1.1 Complete CharactersList.tsx Fix
- [x] Identify duplicate testids in mobile layout (Line 416)
- [x] Fix mobile badge with span wrapper
- [ ] Fix desktop badge with span wrapper (Line 501)
- [ ] Test mobile layout (375px width)
- [ ] Test desktop layout (1920px width)
- [ ] Run character approval workflow tests
- [ ] Verify 5 character approval tests pass
- [ ] Commit: "Fix mobile UI duplicates in CharactersList.tsx"

**Files**: `/src/components/CharactersList.tsx:501`

---

### 1.2 Fix ThreadedComment.tsx Duplicates
- [ ] Read ThreadedComment.tsx mobile/desktop split (Lines 302-340)
- [ ] Identify all duplicate testids
- [ ] Design fix strategy (wrapper vs span vs refactor)
- [ ] Implement fix for mobile layout
- [ ] Implement fix for desktop layout
- [ ] Test comment display in mobile view
- [ ] Test comment display in desktop view
- [ ] Run common room nested reply tests
- [ ] Verify 2 common room tests pass
- [ ] Commit: "Fix mobile UI duplicates in ThreadedComment.tsx"

**Files**: `/src/components/ThreadedComment.tsx`
**Note**: User mentioned existing duplicate comments issue - investigate history

---

### 1.3 Fix ConversationList.tsx Duplicates
- [ ] Read ConversationList.tsx for mobile/desktop splits
- [ ] Grep for duplicate testids: `conversation-item`, etc.
- [ ] Identify affected elements (titles, metadata)
- [ ] Design fix strategy
- [ ] Implement mobile layout fix
- [ ] Implement desktop layout fix
- [ ] Test conversation list in mobile view
- [ ] Test conversation list in desktop view
- [ ] Run private messaging flow tests
- [ ] Verify 4 private messaging tests pass
- [ ] Commit: "Fix mobile UI duplicates in ConversationList.tsx"

**Files**: `/src/components/ConversationList.tsx`

---

### 1.4 Fix AllPrivateMessagesView.tsx
- [ ] Read AllPrivateMessagesView.tsx
- [ ] Identify mobile/desktop splits
- [ ] Check for duplicate testids
- [ ] Implement fixes
- [ ] Test message view rendering
- [ ] Verify tests pass
- [ ] Commit: "Fix mobile UI duplicates in AllPrivateMessagesView.tsx"

**Files**: `/src/components/AllPrivateMessagesView.tsx`

---

## Phase 2: Phase Management & Actions ⏸️

### 2.1 Fix PhaseCard.tsx Duplicates
- [ ] Read PhaseCard.tsx for mobile/desktop splits
- [ ] Identify duplicate testids (phase-card, phase-status, etc.)
- [ ] Design fix strategy
- [ ] Implement mobile layout fix
- [ ] Implement desktop layout fix
- [ ] Test phase card in mobile view
- [ ] Test phase card in desktop view
- [ ] Run phase management tests
- [ ] Verify 4 phase management tests pass
- [ ] Commit: "Fix mobile UI duplicates in PhaseCard.tsx"

**Files**: `/src/components/PhaseCard.tsx`

---

### 2.2 Fix ActionsList.tsx Duplicates
- [ ] Read ActionsList.tsx for mobile/desktop splits
- [ ] Identify duplicate testids
- [ ] Implement fixes
- [ ] Test actions list rendering
- [ ] Run action submission test
- [ ] Verify 1 action submission test passes
- [ ] Commit: "Fix mobile UI duplicates in ActionsList.tsx"

**Files**: `/src/components/ActionsList.tsx`

---

### 2.3 Fix AllActionSubmissionsView.tsx
- [ ] Read AllActionSubmissionsView.tsx
- [ ] Check for duplicate testids
- [ ] Implement fixes if needed
- [ ] Test GM action view
- [ ] Verify functionality
- [ ] Commit: "Fix mobile UI duplicates in AllActionSubmissionsView.tsx"

**Files**: `/src/components/AllActionSubmissionsView.tsx`

---

## Phase 3: Remaining Components ⏸️

### 3.1 Audit and Fix HistoryView.tsx
- [ ] Read HistoryView.tsx
- [ ] Check for mobile/desktop splits with duplicate testids
- [ ] Implement fixes if found
- [ ] Test history view in mobile
- [ ] Test history view in desktop
- [ ] Run history tests
- [ ] Verify tests still pass
- [ ] Commit: "Fix mobile UI duplicates in HistoryView.tsx" (if changes made)

**Files**: `/src/components/HistoryView.tsx`

---

### 3.2 Verify TabNavigation.tsx
- [ ] Read TabNavigation.tsx
- [ ] Check for duplicate testids
- [ ] Document findings
- [ ] Fix if needed (likely low risk)
- [ ] Test tab navigation
- [ ] Commit if changes needed

**Files**: `/src/components/TabNavigation.tsx`

---

### 3.3 Verify Layout.tsx
- [ ] Read Layout.tsx
- [ ] Check for duplicate testids
- [ ] Document findings
- [ ] Fix if needed (likely low risk)
- [ ] Test layout rendering
- [ ] Commit if changes needed

**Files**: `/src/components/Layout.tsx`

---

## Phase 4: Validation & Documentation ⏸️

### 4.1 Run Complete E2E Test Suite
- [ ] Ensure all fixes from Phases 1-3 are complete
- [ ] Run full E2E suite: `npx playwright test --reporter=list`
- [ ] Capture test results
- [ ] Analyze failures (target: <10 failures, <5%)
- [ ] Fix any remaining failures
- [ ] Re-run until >95% pass rate achieved
- [ ] Document final test results
- [ ] Create summary of improvements

**Success Criteria**:
- [ ] >202/213 tests passing (>95%)
- [ ] No Playwright strict mode violations
- [ ] All character tests pass (19 tests)
- [ ] All messaging tests pass (7 tests)
- [ ] All phase tests pass (6 tests)

**Commands**:
```bash
npx playwright test --reporter=list > test-results-after-fix.txt
grep "passed\|failed" test-results-after-fix.txt
```

---

### 4.2 Create Mobile UI Testing Guidelines
- [ ] Create file: `.claude/reference/MOBILE_UI_PATTERNS.md`
- [ ] Section 1: The Duplicate Testid Problem
  - [ ] Explain the issue with examples
  - [ ] Show browser evaluation of duplicates
- [ ] Section 2: Approved Patterns
  - [ ] Pattern 1: Testid on wrapper
  - [ ] Pattern 2: Content span wrapper
  - [ ] Pattern 3: Single source rendering
  - [ ] Include code examples for each
- [ ] Section 3: Anti-Patterns
  - [ ] Show what NOT to do
  - [ ] Explain why it fails
- [ ] Section 4: Testing Strategy
  - [ ] How to test responsive components
  - [ ] E2E considerations
- [ ] Section 5: Pre-Commit Checklist
  - [ ] Visual test mobile (375px)
  - [ ] Visual test desktop (1920px)
  - [ ] Run component tests
  - [ ] Check for duplicate testids
  - [ ] Run affected E2E tests
- [ ] Review document for completeness
- [ ] Commit: "Add mobile UI testing guidelines"

**File**: `.claude/reference/MOBILE_UI_PATTERNS.md`

---

### 4.3 Update TESTING.md Context
- [ ] Open `.claude/context/TESTING.md`
- [ ] Find E2E testing section
- [ ] Add subsection: "Mobile/Responsive Component Testing"
- [ ] Include:
  - [ ] Reference to MOBILE_UI_PATTERNS.md
  - [ ] Quick checklist for responsive components
  - [ ] Common pitfalls
- [ ] Update "Anti-Patterns" section with duplicate testid example
- [ ] Commit: "Update TESTING.md with mobile UI guidance"

**File**: `.claude/context/TESTING.md`

---

### 4.4 Add Automated Duplicate Detection (Optional)
- [ ] Create script: `scripts/check-duplicate-testids.sh`
- [ ] Script logic:
  - [ ] Find all files with `md:hidden` or `md:flex` or `md:block`
  - [ ] Extract data-testid attributes
  - [ ] Check for duplicates within same file
  - [ ] Report violations
- [ ] Test script on current codebase (should find none after fixes)
- [ ] Add to package.json scripts: `"check-testids": "bash scripts/check-duplicate-testids.sh"`
- [ ] Document usage in README or CONTRIBUTING.md
- [ ] Optional: Add to pre-commit hook
- [ ] Optional: Add to CI pipeline
- [ ] Commit: "Add duplicate testid detection script"

**File**: `scripts/check-duplicate-testids.sh`

---

## Progress Tracking

### Overall Progress
- **Phase 1**: ⏳ In Progress (Task 1.1 started)
- **Phase 2**: ⏸️ Not Started
- **Phase 3**: ⏸️ Not Started
- **Phase 4**: ⏸️ Not Started

### Test Metrics
- **Baseline**: 110/213 passing (51.6%)
- **Current**: TBD (run after Phase 1)
- **Target**: >202/213 passing (>95%)

### Time Tracking
- **Estimated Total**: 10-14 hours
- **Time Spent**: ~2 hours (investigation + planning)
- **Remaining**: ~8-12 hours

---

## Quick Reference Commands

### Testing
```bash
# Visual testing (browser)
just run-frontend

# Component tests
npm test -- CharactersList.test.tsx

# Specific E2E test
npx playwright test e2e/characters/character-approval-workflow.spec.ts

# Full E2E suite
npx playwright test --reporter=list

# E2E with specific worker
TEST_PARALLEL_INDEX=0 npx playwright test
```

### Finding Duplicates
```bash
# Find all files with responsive layouts
grep -r "md:hidden\|md:flex\|md:block" src/**/*.tsx

# Find duplicate testids in a file
grep -n "data-testid=" src/components/CharactersList.tsx

# Check specific component
cat src/components/CharactersList.tsx | grep -A 5 -B 5 "data-testid="
```

### Git Workflow
```bash
# Commit after each component
git add src/components/CharactersList.tsx
git commit -m "Fix mobile UI duplicates in CharactersList.tsx

- Wrap status badge content in span with testid
- Prevents duplicate testids in mobile/desktop layouts
- Fixes character approval workflow tests (5 tests)"

# View recent commits
git log --oneline | head -10

# Rollback if needed
git revert HEAD  # Revert last commit
```

---

## Notes & Observations

### Completed Items
- [x] Initial investigation with Playwright MCP
- [x] Root cause identified (duplicate testids)
- [x] Test infrastructure improvements (MessagingPage, PhaseManagementPage)
- [x] Auth helpers refactor (private-messages-delete tests)
- [x] Planning documents created
- [x] Mobile badge fix implemented (CharactersList.tsx Line 416)

### Blockers
- None currently

### Questions
- Should we consider refactoring to single-source rendering? (Decision: No, span wrapper is sufficient)
- How to prevent regression? (Decision: Create guidelines + optional automation)

### Discoveries
- Worker-specific game IDs use offset of `worker_index × 10000`
- Playwright's `toBeAttached()` works better than `toBeVisible()` for collapsed elements
- React component deduplication could be leveraged for Pattern 3

---

## When Complete

- [ ] Move directory to `.claude/planning/completed/fix-mobile-ui-duplicates/`
- [ ] Update main planning README if exists
- [ ] Share learnings with team
- [ ] Consider blog post or internal doc about the experience
