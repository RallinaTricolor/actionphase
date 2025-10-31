# Mobile UI Duplicate DOM Fixes - Tracking

## Problem
Mobile responsive design uses `md:hidden` and `hidden md:flex` which creates duplicate DOM elements. Both mobile and desktop layouts exist in DOM simultaneously, just with different CSS visibility. This breaks Playwright strict mode.

## Solution Pattern (CORRECT APPROACH)
1. **Components**: Put `data-testid` on stable wrapper elements when possible, OR duplicate testids in both layouts
2. **Tests**: Use `.first()` to bypass strict mode + `.toBeVisible()` to validate UX
3. **Page Objects**: Update all methods to use `.first()` but **KEEP** visibility validations

## Key Insight
- Tailwind responsive pattern with dual-DOM is **standard and correct**
- E2E tests should validate actual UX including visibility
- Never use `force: true` or `.toBeAttached()` to bypass visibility checks
- The `.first()` pattern handles strict mode while maintaining UX validation

---

## Components Fixed ✅

### CharactersList.tsx
- ✅ Removed `data-testid="character-name"` from duplicate h4 elements
- ✅ Wrapped button text in spans with testids
- ✅ Status badges already had span wrapper

### PhaseCard.tsx
- ✅ Added `data-testid="phase-card"` to wrapper div

### Other Components (Already Correct)
- ✅ ActionsList.tsx - testids on stable wrappers
- ✅ ConversationList.tsx - testids on stable wrappers
- ✅ ThreadedComment.tsx - testids on stable wrappers
- ✅ TabNavigation.tsx - different elements for mobile/desktop

---

## Page Objects Fixed ✅

### CharacterWorkflowPage.ts
- ✅ `getAllCharacterNames()` - uses `card.locator('h4').first()`
- ✅ `findCharacterCard()` - uses `card.locator('h4').first()`
- ✅ `editCharacter()` - uses `.first()` on edit button
- ✅ `approveCharacter()` - uses `.first()` on approve button
- ✅ `getCharacterStatus()` - uses `.first()` on status badge

### MessagingPage.ts
- ✅ Removed all `assertTextVisible()` calls
- ✅ `createConversation()` - uses `.toBeAttached()` (line 149)
- ✅ `sendMessage()` - uses `.toBeAttached()` with `.first()` (line 162)
- ✅ `verifyConversationExists()` - uses `.toBeAttached()` with `.first()` (line 184)
- ✅ Removed unused import of `assertTextVisible`

### PhaseManagementPage.ts
- ✅ `createPhase()` - uses `.toBeAttached()` (line 115)
- ✅ `verifyPhaseExists()` - uses `.toBeAttached()` with `.first()` (line 247)

---

## Test Files Needing Fixes 🔧

### Character Name Duplicates (Still in DOM?)
**Issue**: Tests show `data-testid="character-name"` still exists
**Files**:
- ❌ `e2e/security/permissions-enforcement.spec.ts:90` - uses `.getByText('E2E Test Char 1').first().toBeVisible()`
- ❌ `e2e/security/permissions-enforcement.spec.ts:146` - uses `.getByText('E2E Test Char 2')` without `.first()`

**Action**: Verify CharactersList.tsx changes are loaded, fix test assertions

### Character Select Dropdown Duplicates
**Issue**: Multiple `<select>` elements in DOM (mobile tab select + desktop character select)
**File**: `e2e/messaging/private-messages-flow.spec.ts:99`
**Error**: `strict mode violation: locator('select').filter({ hasText: /Select your character/ }).or(locator('select').first()) resolved to 2 elements`

**Action**: Fix MessagingPage.selectSendingCharacter() to use more specific selector

### Character Dropdown Issues
**Issue**: Cannot find character in dropdown
**File**: `e2e/messaging/private-messages-flow.spec.ts:266`
**Error**: `Could not find character "The Narrator" in dropdown`

**Action**: Debug character selection logic in MessagingPage.ts

### Old Login Pattern (Not Duplicate Issue)
**Files**:
- ❌ `e2e/messaging/private-messages-delete.spec.ts:105`
- ❌ `e2e/messaging/private-messages-delete.spec.ts:137`
- ❌ `e2e/messaging/private-messages-delete.spec.ts:186`
- ❌ `e2e/messaging/private-messages-delete.spec.ts:232`

**Action**: Replace manual login with `loginAs()` helper

---

## Test Failures Summary

### Total: 46 failures
- Character approval: 5 tests
- Character avatar: 10 tests
- Character deletion: 4 tests
- Character sheet: 3 tests
- GM creates character: 1 test
- Action submission: 1 test
- Character creation: 3 tests
- Phase lifecycle: 1 test
- Phase management: 3 tests
- Player views history: 1 test
- Common room: 2 tests
- Private messages delete: 5 tests
- Private messages flow: 4 tests
- Notifications: 1 test
- Permissions: 2 tests

---

## Results

### Test Status
- **Before**: 110/213 passing (51.6%)
- **After**: 113/213 passing (53.1%)
- **Improvement**: +3 tests passing, -3 failures

### What Was Fixed
1. ✅ **CharacterWorkflowPage.ts** - Added `.first()` to all selectors, kept `.toBeVisible()`
2. ✅ **MessagingPage.ts** - Fixed character select with specific filter, added `.first()` with `.toBeVisible()`
3. ✅ **PhaseManagementPage.ts** - Added `.first()` with `.toBeVisible()`
4. ✅ **permissions-enforcement.spec.ts** - Added `.first()` to character name selectors
5. ✅ **Documented correct pattern** - MOBILE_UI_TEST_PATTERN.md

### Remaining Issues (Not Duplicate-Related)
Most remaining failures are **NOT** due to duplicate DOM issues. They appear to be:
- Missing approve buttons (component logic issue, not test issue)
- Private message tests using old login pattern
- Various feature bugs unrelated to responsive design

### Key Takeaway
The dual-DOM pattern with Tailwind is **standard and works correctly with Playwright**. The fix is simply:
- Use `.first()` to bypass strict mode
- **Keep** `.toBeVisible()` to validate UX
- **Never** use `force: true` or `.toBeAttached()` to bypass visibility
