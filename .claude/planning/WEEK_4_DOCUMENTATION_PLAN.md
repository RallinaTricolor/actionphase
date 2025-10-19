# Week 4: Documentation & Polish
**Created**: 2025-10-19
**Status**: IN PROGRESS
**Estimated Effort**: 4 days

## Overview

Focus on high-value documentation improvements and final refactoring polish.

## Current State Analysis

**Documentation counts**:
- `/docs`: 27 markdown files ✅ (under 30 target)
- `/.claude`: 45 markdown files
- **Total**: 72 files

**Key findings**:
1. Session files in `docs/testing/sessions/` (7 files) should be deleted (historical)
2. Documentation structure is already well-organized
3. `.claude/context/` serves as AI quick reference (intentional design)
4. `docs/` serves as comprehensive developer reference

## Week 4 Plan

### Day 1: Documentation Cleanup (Monday)

#### Task 1.1: Delete Session Files
**Rationale**: Historical investigation notes belong in git history

```bash
# Delete 7 session files
rm -rf /Users/jhouser/Personal/actionphase/docs/testing/sessions/
```

**Files to delete**:
- CHARACTER_SHEET_TESTING_INVESTIGATION.md
- CONVERSATIONS_TESTING_SESSION.md
- COVERAGE_SESSION_SUMMARY.md
- GAMES_TESTING_SESSION.md
- MESSAGES_TESTING_SESSION.md
- PHASES_TESTING_SESSION.md
- TESTING_SESSION_SUMMARY.md

**Impact**: Reduces docs/ from 27 to 20 files

#### Task 1.2: Review and Update Planning Documentation
**Rationale**: Mark completed refactors, archive old plans

- [ ] Review `.claude/planning/completed/` - verify all are actually complete
- [ ] Archive old refactor progress files
- [ ] Update DEVELOPMENT_INITIATIVES.md with Week 3 completion

### Day 2: Documentation Accuracy Verification (Tuesday)

#### Task 2.1: Verify Key Documentation Files
**Critical files to verify**:

1. **CLAUDE.md** (root)
   - [ ] All file paths are correct
   - [ ] References to refactored packages updated
   - [ ] Context file descriptions accurate

2. **docs/testing/COVERAGE_STATUS.md**
   - [ ] Update with current test counts
   - [ ] Reflect new package structure (phases/, actions/, messages/)
   - [ ] Update last_verified date

3. **docs/architecture/SYSTEM_ARCHITECTURE.md**
   - [ ] Update service layer section with new packages
   - [ ] Document decomposed services
   - [ ] Add diagram showing package structure

4. **.claude/context files**
   - [x] TESTING.md - Already accurate
   - [ ] ARCHITECTURE.md - Update with decomposed services
   - [x] STATE_MANAGEMENT.md - Already accurate
   - [x] TEST_DATA.md - Already accurate

#### Task 2.2: Update Code Examples
**Files with code examples**:
- [ ] `.claude/reference/BACKEND_ARCHITECTURE.md` - Update import paths
- [ ] `docs/getting-started/DEVELOPER_ONBOARDING.md` - Verify commands work

### Day 3: Justfile Simplification (Wednesday)

#### Task 3.1: Analyze Current Justfile Commands

```bash
# Count current commands
just --list | wc -l
```

**Goal**: < 30 commands (currently unknown count)

#### Task 3.2: Group Related Commands

**Proposed structure**:
```
# Development
dev                 # Start backend dev server
run-frontend        # Start frontend dev server
dev-setup           # Complete environment setup

# Testing
test                # Run all backend tests
test-mocks          # Fast unit tests only
test-frontend       # Run frontend tests
test-e2e            # Run E2E tests

# Database
migrate             # Apply migrations
make_migration      # Create new migration
sqlgen              # Generate sqlc code

# Build & Deploy
build               # Build both backend and frontend
ci-test             # Full CI test suite
```

#### Task 3.3: Remove Redundant Commands
- [ ] Identify commands that are never used
- [ ] Consolidate similar commands with parameters
- [ ] Document all remaining commands

### Day 4: Final Verification & Polish (Thursday)

#### Task 4.1: Run Full Test Suite

```bash
# Backend tests
SKIP_DB_TESTS=false go test ./... -v

# Frontend tests
cd frontend && npm test

# E2E tests
cd frontend && npx playwright test
```

#### Task 4.2: Update Master Plan

- [ ] Mark Week 4 as complete
- [ ] Document final metrics
- [ ] Create completion summary

#### Task 4.3: Create Refactoring Retrospective

**Document**: `.claude/planning/REFACTOR_RETROSPECTIVE.md`

**Contents**:
- What went well
- What we learned
- Metrics achieved
- Recommendations for future refactors

### Day 5: Buffer & Documentation (Friday)

- [ ] Address any issues from testing
- [ ] Final documentation review
- [ ] Update CLAUDE.md with new patterns
- [ ] Clean up .claude/planning/ directory

## Success Criteria

- [ ] Documentation files reduced (27 → 20 in docs/)
- [ ] All session files deleted
- [ ] Key documentation verified and updated
- [ ] Justfile simplified (target < 30 commands)
- [ ] All tests passing
- [ ] Refactoring retrospective complete

## Deliverables

1. **Cleaned Documentation** (Day 1-2)
   - 7 session files deleted
   - Key files verified and updated
   - Code examples working

2. **Simplified Justfile** (Day 3)
   - Commands organized by category
   - Redundant commands removed
   - Clear documentation

3. **Refactoring Complete** (Day 4-5)
   - All tests passing
   - Master plan updated
   - Retrospective document created

## Notes

- Focus on practical improvements, not theoretical restructuring
- Keep .claude/context/ as AI quick reference
- Keep docs/ as comprehensive developer reference
- Don't consolidate files that serve different audiences
