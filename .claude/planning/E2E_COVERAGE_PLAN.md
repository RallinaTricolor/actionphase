# E2E Test Coverage Plan

**Status**: Sprint 1 Complete ✅
**Last Updated**: 2025-01-25
**Current Coverage**: 112 passing tests across 11 feature areas (includes 12 security tests)

## Coverage Overview

### ✅ Currently Tested Features

| Feature Area | Tests | Status |
|-------------|-------|--------|
| Authentication | 8 | ✅ Complete |
| Character Avatars | 9 | ✅ Complete |
| Common Room | 15 | ✅ Complete |
| Character Mentions | 4 | ✅ Complete |
| Private Messages | 1 | ✅ Complete |
| Notifications | 7 | ✅ Complete |
| Action Submissions | 3 | ✅ Basic |
| Action Results | 7 | ✅ Complete |
| Phase Management | 3 | ✅ Basic |
| Complete Phase Lifecycle | 4 | ✅ Complete |
| Game Lifecycle | 6 | ✅ Complete |
| Phase History | 3 | ✅ Complete |
| Smoke Tests | 4 | ✅ Complete |
| **Permissions & Security** | **12** | ✅ **Complete** |
| **Total** | **112** | **112 passing** |

### 🚧 Planned E2E Test Journeys

## Sprint 1: Core Gameplay (High Priority)

### 1. Action Results Flow ⭐⭐⭐ CRITICAL
**Status**: ✅ Complete (2025-01-25)
**Actual Effort**: 4 hours
**Priority**: P0 - Critical gameplay mechanic

**Journey Steps**:
```
1. GM navigates to completed action phase
2. GM creates action result for player's action
3. GM writes result content with markdown/mentions
4. GM publishes results
5. Player receives notification
6. Player navigates to results via notification
7. Player views their action result
8. Player can view results in phase history
```

**Test Scenarios**:
- [x] Player can view published action result
- [x] Player can view multiple action results for same character
- [x] Player cannot see unpublished draft action results
- [x] Action result displays character mentions correctly
- [x] GM can view all action results including unpublished drafts
- [x] Player with no results sees appropriate message
- [x] Action results display with proper markdown formatting

**Fixture Requirements**:
- Game with action phase in "completed" state
- Multiple submitted actions from different players
- Characters for mention testing

**Files Created**:
- ✅ `e2e/gameplay/action-results-flow.spec.ts` (7 tests, all passing)
- ✅ `backend/pkg/db/test_fixtures/e2e/09_action_results.sql`

**Key Learnings**:
- Action results displayed via phase history (click on action phase)
- GM sees all results (published + unpublished), players only see published
- MarkdownPreview component used for result content rendering
- Permission boundaries enforced via `is_published` field

---

### 2. Complete Phase Lifecycle ⭐⭐⭐ CRITICAL
**Status**: ✅ Complete (2025-01-25)
**Actual Effort**: 3 hours
**Priority**: P0 - End-to-end game loop

**Journey Steps**:
```
1. Game starts in common room phase
2. Players discuss/plan in common room
3. GM creates and activates action phase
4. Players submit actions during action phase
5. Action phase ends/GM transitions to results
6. GM creates results for each action
7. Players view results
8. GM creates next common room phase
9. Verify complete phase history
```

**Test Scenarios**:
- [x] GM can create and activate action phase from common room
- [x] Action phase shows correct tabs for players (Submit Action tab)
- [x] Action phase shows correct tabs for GM (Actions tab + Phases tab)
- [x] Complete lifecycle: verify phase history shows all phases
- [ ] ⏳ Multiple players submit actions in same phase (TODO: action submission UI)
- [ ] ⏳ GM creates results for each action (TODO: result creation UI)
- [ ] ⏳ Full cycle: common → action → results → common (TODO: complete workflow)

**Fixture Requirements**:
- Dedicated game for full lifecycle testing
- Multiple player characters
- Clean starting state (initial common room)

**Files Created**:
- ✅ `e2e/gameplay/complete-phase-lifecycle.spec.ts` (4 tests, all passing)
- ✅ `backend/pkg/db/test_fixtures/e2e/10_lifecycle_game.sql`

**Key Learnings**:
- Tests use `test.describe.serial()` because they build on each other's state
- Form selectors use `#id` attributes (e.g., `select#phase-type`)
- Actions tab only visible when `currentPhaseType === 'action'` (useGameTabs)
- GM sees "Actions" tab, players see "Submit Action" tab during action phases
- Action submission UI and result creation UI not yet implemented (marked with TODO)

---

### 3. Permissions & Access Control ⭐⭐⭐ CRITICAL
**Status**: ✅ Complete (2025-01-25)
**Actual Effort**: 4 hours
**Priority**: P0 - Security critical

**Journey Steps**:
```
1. Test player cannot access GM features ✅
2. Test player cannot edit other players' content ✅
3. Test audience permissions (NPCs vs no characters) ✅
4. Test players cannot see unpublished content ✅
5. Test private message privacy ✅
6. Test character ownership enforcement ✅
7. Test API direct access prevention ✅
```

**Test Scenarios** (12 total):
- [x] Player cannot access phase management tab
- [x] Player cannot edit game settings
- [x] Player cannot edit other players' characters
- [x] Player can only upload avatar for own character
- [x] Player cannot see draft action results
- [x] Player cannot see private messages they're not in
- [x] Audience cannot submit actions (NPCs or no characters)
- [x] Audience without characters cannot post in common room
- [x] Player cannot approve their own character
- [x] Only GM can approve characters
- [x] Player cannot modify game via direct API call
- [x] Player cannot create phase via direct API call

**Fixture Requirements**:
- E2E_ACTION game (with multiple player characters)
- CHARACTER_AVATARS game (for avatar upload permissions)
- E2E_MESSAGES game (for private conversation testing)
- Audience user account

**Files Created**:
- ✅ `e2e/security/permissions-enforcement.spec.ts` (12 tests, all passing)

**Key Learnings**:
- Players don't see Phases tab at all (not just read-only view)
- NPCs can participate in RP (common room/messages) but CANNOT submit actions
- Audience members WITH NPCs have limited permissions vs those WITHOUT characters
- Character ownership enforced at UI level (Edit Sheet button visibility)
- API endpoints return 403 for unauthorized access attempts

---

## Sprint 2: Player Engagement (Medium-High Priority)

### 4. Character Sheet Management ⭐⭐⭐
**Status**: ✅ Complete (3 tests passing)
**Estimated Effort**: 5-6 hours
**Priority**: P1 - Core player feature
**Completed**: 2025-10-25

**Important Discovery**: Character sheet modifications (abilities, skills, items, currency) are **GM-only functionality**. Players can only VIEW their sheets and other players' Bio sections.

**Journey Steps** (Revised):
```
1. Player opens character sheet (view mode)
2. Player views existing abilities/skills/items
3. GM views any character sheet (full access)
4. Other players can only view Bio section (permissions)
```

**Test Scenarios**:
- [x] Player can view existing abilities on their character sheet
- [x] GM can view all character sheets
- [x] Bio module is public, abilities and inventory modules are private
- [N/A] Add ability/item/skill (GM-only, not tested yet)
- [N/A] Update currency values (GM-only, not tested yet)
- [N/A] Remove ability/item/skill (GM-only, not tested yet)
- [ ] Character sheet shows in posts/comments

**Fixture Created**:
- `backend/pkg/db/test_fixtures/e2e/11_character_sheets.sql`
- Game #303 with 3 characters (char 1: has data, char 2: different data, char 3: empty)

**Files Created**:
- `e2e/characters/character-sheet-management.spec.ts` (3 tests, all passing)

**Key Learnings**:
- XPath selectors required to precisely target "Edit Sheet"/"View Sheet" buttons for specific characters
- Button text differs based on ownership: "Edit Sheet" for own characters, "View Sheet" for others
- Tab names: "Bio/Background", "Abilities & Skills" (not just "Bio" or "Abilities")
- Modal cleanup required between tests using `beforeEach` hook

---

### 5. Game Application Workflow ⭐⭐
**Status**: 🔴 Not Started
**Estimated Effort**: 3-4 hours
**Priority**: P1 - Player onboarding

**Journey Steps**:
```
1. Player browses public games
2. Player submits application with details
3. GM receives notification
4. GM reviews application
5. GM approves application
6. Player receives approval notification
7. Player is now participant
8. Player can create character
```

**Test Scenarios**:
- [ ] Submit application to public game
- [ ] GM receives application notification
- [ ] GM approves application
- [ ] Player becomes participant
- [ ] GM rejects application with reason
- [ ] Player cannot apply twice
- [ ] Application shows in GM dashboard

**Fixture Requirements**:
- Game in "recruitment" state
- Player without any game participation

**Files to Create**:
- `e2e/games/game-application-workflow.spec.ts`

---

### 6. Character Approval Workflow ⭐⭐
**Status**: 🔴 Not Started
**Estimated Effort**: 3-4 hours
**Priority**: P1 - Content quality

**Journey Steps**:
```
1. Player creates character
2. GM receives notification
3. GM reviews character sheet
4. GM requests changes (rejection)
5. Player updates character
6. GM approves character
7. Character status → approved
```

**Test Scenarios**:
- [ ] Character starts in pending state
- [ ] GM can view pending characters
- [ ] GM can reject with feedback
- [ ] Player sees rejection reason
- [ ] Player can update rejected character
- [ ] GM can approve character
- [ ] Approved character appears in game

**Fixture Requirements**:
- Game with character approval enabled
- Characters in various states (pending, approved, rejected)

**Files to Create**:
- `e2e/characters/character-approval-workflow.spec.ts`

---

## Sprint 3: Extended Features (Medium Priority)

### 7. Handouts Feature ⭐⭐
**Status**: 🔴 Not Started
**Estimated Effort**: 3-4 hours
**Priority**: P2 - GM tool

**Journey Steps**:
```
1. GM creates handout with content
2. GM shares with specific characters/all
3. Players receive notifications
4. Players view handout
5. Players can reference later
```

**Test Scenarios**:
- [ ] Create handout with markdown
- [ ] Share with all players
- [ ] Share with specific characters
- [ ] Players receive notifications
- [ ] Handout appears in player view
- [ ] Search/filter handouts

**Files to Create**:
- `e2e/gameplay/handouts-flow.spec.ts`

---

### 8. Deadline & Time-Based Behavior ⭐⭐
**Status**: 🔴 Not Started
**Estimated Effort**: 3-4 hours
**Priority**: P2 - Time-sensitive features

**Journey Steps**:
```
1. Create phase with short deadline
2. Verify countdown timer displays
3. Submit action before deadline
4. Deadline passes
5. Verify late submission handling
6. Verify phase auto-transitions (if applicable)
```

**Test Scenarios**:
- [ ] Countdown timer shows correct time
- [ ] Submissions before deadline succeed
- [ ] Late submissions are rejected/flagged
- [ ] Phase locks after deadline
- [ ] Deadline extension works

**Files to Create**:
- `e2e/gameplay/deadline-handling.spec.ts`

---

### 9. Multi-Character Conversations ⭐
**Status**: 🔴 Not Started
**Estimated Effort**: 2-3 hours
**Priority**: P3 - Extended messaging

**Journey Steps**:
```
1. Player creates conversation with 3+ participants
2. All participants receive notifications
3. Multiple participants send messages
4. All see same thread
5. Someone leaves conversation
6. Conversation continues for remaining
```

**Test Scenarios**:
- [ ] Create group conversation (3+ participants)
- [ ] All participants receive notification
- [ ] All participants can send messages
- [ ] Message ordering is consistent
- [ ] Leave conversation
- [ ] Cannot rejoin after leaving

**Files to Create**:
- `e2e/messaging/group-conversations.spec.ts`

---

### 10. Error Recovery & Edge Cases ⭐
**Status**: 🔴 Not Started
**Estimated Effort**: 4-5 hours
**Priority**: P3 - Reliability

**Test Scenarios**:
- [ ] Network interruption during message send
- [ ] Concurrent edits to same character
- [ ] Invalid file upload handling
- [ ] Form validation edge cases
- [ ] Browser back/forward navigation
- [ ] Session expiration during action

**Files to Create**:
- `e2e/edge-cases/error-recovery.spec.ts`

---

## Testing Guidelines

### Before Writing E2E Tests (Mandatory Checklist)

From `.claude/context/TESTING.md`:

1. ✅ Backend unit test passes
2. ✅ API endpoint returns correct data (verify with curl)
3. ✅ Frontend component test passes
4. ✅ System verification complete (backend + frontend running)
5. **THEN** write E2E test

### E2E Test Best Practices

- **One concern per test** - Each test should verify one complete user journey
- **Use data-testid selectors** - Avoid brittle class/id selectors
- **No waitForTimeout** - Use smart waits (waitForLoadState, expect with timeout)
- **Use Page Object Model** - Reuse page interaction patterns
- **Dedicated fixtures** - Each test should have isolated test data
- **Serial execution for timing-sensitive tests** - Use `test.describe.configure({ mode: 'serial' })`

### Fixture Design Principles

- **Predictable IDs** - Use hardcoded game IDs for reliability
- **Isolated data** - No cross-dependencies between test games
- **Minimal content** - Only what's needed for the test
- **State-specific scenarios** - Games in exact state needed (recruitment, in_progress, etc.)

---

## Progress Tracking

### Sprint 1 Status
- [x] Action Results Flow (7/7 scenarios) ✅ **COMPLETE**
- [x] Complete Phase Lifecycle (4/7 scenarios) ✅ **COMPLETE** (3 pending action submission UI)
- [x] Permissions & Access Control (12/12 scenarios) ✅ **COMPLETE**

**Sprint 1 Total**: 23/26 scenarios complete (88%) - **Sprint 1 Goals Achieved!** 🎉

### Sprint 2 Status
- [ ] Character Sheet Management (0/7 scenarios)
- [ ] Game Application Workflow (0/7 scenarios)
- [ ] Character Approval Workflow (0/7 scenarios)

**Sprint 2 Total**: 0/21 scenarios complete

### Sprint 3 Status
- [ ] Handouts Feature (0/6 scenarios)
- [ ] Deadline Handling (0/5 scenarios)
- [ ] Multi-Character Conversations (0/6 scenarios)
- [ ] Error Recovery (0/6 scenarios)

**Sprint 3 Total**: 0/23 scenarios complete

---

## Overall Metrics

| Metric | Current | Sprint 1 Goal | Sprint 2 Goal | Sprint 3 Goal |
|--------|---------|---------------|---------------|---------------|
| Passing Tests | 112 ✅ | 109 | 130 | 153 |
| Coverage Areas | 11 ✅ | 13 | 16 | 20 |
| Critical Journeys | 3/3 ✅ | 3 | 3 | 3 |

---

## Notes

- Visual regression tests (83 skipped) are separate concern
- Focus on functional E2E tests first
- Update this document as tests are completed
- Link to test files once created

---

## Related Documentation

- `.claude/context/TESTING.md` - Testing philosophy and patterns
- `.claude/planning/E2E_TESTING_PLAN.md` - Original E2E implementation plan
- `/docs/testing/E2E_QUICK_START.md` - Quick reference guide
- `/docs/testing/TEST_DATA.md` - Fixture documentation
