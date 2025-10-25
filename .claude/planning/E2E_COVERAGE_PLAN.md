# E2E Test Coverage Plan

**Status**: In Progress
**Last Updated**: 2025-01-25
**Current Coverage**: 101 passing tests across 9 feature areas (includes 12 security tests)

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
| Phase Management | 3 | ✅ Basic |
| Game Lifecycle | 6 | ✅ Complete |
| Phase History | 3 | ✅ Complete |
| Smoke Tests | 4 | ✅ Complete |
| **Permissions & Security** | **12** | ✅ **Complete** |
| **Total** | **101** | **101 passing** |

### 🚧 Planned E2E Test Journeys

## Sprint 1: Core Gameplay (High Priority)

### 1. Action Results Flow ⭐⭐⭐ CRITICAL
**Status**: 🔴 Not Started
**Estimated Effort**: 4-6 hours
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
- [ ] Create and publish action result
- [ ] Player receives notification for result
- [ ] Player can view result content
- [ ] Multiple results for same player
- [ ] Results with character mentions
- [ ] Results navigation from history

**Fixture Requirements**:
- Game with action phase in "completed" state
- Multiple submitted actions from different players
- Characters for mention testing

**Files to Create**:
- `e2e/gameplay/action-results-flow.spec.ts`
- Add to `backend/pkg/db/test_fixtures/e2e/09_action_results.sql`

---

### 2. Complete Phase Lifecycle ⭐⭐⭐ CRITICAL
**Status**: 🔴 Not Started
**Estimated Effort**: 6-8 hours
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
- [ ] Full cycle: common → action → results → common
- [ ] Multiple players submit actions in same phase
- [ ] Phase transitions update game state correctly
- [ ] Phase history shows complete timeline
- [ ] Notifications sent at each phase transition
- [ ] Late submissions (after deadline)

**Fixture Requirements**:
- Dedicated game for full lifecycle testing
- Multiple player characters
- Clean starting state (initial common room)

**Files to Create**:
- `e2e/gameplay/complete-phase-lifecycle.spec.ts`
- Add to `backend/pkg/db/test_fixtures/e2e/10_lifecycle_game.sql`

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
**Status**: 🔴 Not Started
**Estimated Effort**: 5-6 hours
**Priority**: P1 - Core player feature

**Journey Steps**:
```
1. Player opens character sheet
2. Player adds ability to character
3. Player adds item to inventory
4. Player adds skill/proficiency
5. Player updates currency/resources
6. GM views character sheet updates
7. Character sheet displays in various contexts
```

**Test Scenarios**:
- [ ] Add ability with description
- [ ] Add multiple items to inventory
- [ ] Add skill with proficiency level
- [ ] Update currency values
- [ ] Remove ability/item/skill
- [ ] Character sheet shows in posts/comments
- [ ] GM can view all character sheets

**Fixture Requirements**:
- Character with some existing abilities/items
- Empty character for fresh additions

**Files to Create**:
- `e2e/characters/character-sheet-management.spec.ts`

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
- [ ] Action Results Flow (0/6 scenarios)
- [ ] Complete Phase Lifecycle (0/6 scenarios)
- [x] Permissions & Access Control (12/12 scenarios) ✅ **COMPLETE**

**Sprint 1 Total**: 12/26 scenarios complete (46%)

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
| Passing Tests | 101 | 109 | 130 | 153 |
| Coverage Areas | 9 | 13 | 16 | 20 |
| Critical Journeys | 1/3 ✅ | 3 | 3 | 3 |

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
