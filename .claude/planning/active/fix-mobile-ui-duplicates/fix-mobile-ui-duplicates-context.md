# Fix Mobile UI Duplicates - Context & Decisions

**Last Updated**: 2025-10-31

---

## Problem Discovery

### Timeline
1. **Yesterday**: Mobile UI refactor implemented responsive layouts
2. **Today**: E2E test suite run revealed 46/213 failures (21% failure rate)
3. **Root Cause Found**: Duplicate DOM elements with identical `data-testid` attributes

### Initial Investigation
- Used Playwright MCP to debug failing character approval test
- Navigated to game 10604 (worker 1 offset)
- Found character "Approved Test Character" with status "approved"
- Discovered 2 status badges in DOM (one visible, one hidden)

### Browser Evaluation Results
```javascript
{
  "totalCards": 2,
  "cards": [
    {
      "name": "Approved Test Character",
      "statusBadgeCount": 2,  // ← THE PROBLEM
      "statusBadges": [
        { "text": "approved", "visible": false },  // Mobile (hidden on desktop)
        { "text": "approved", "visible": true }    // Desktop (visible)
      ]
    }
  ]
}
```

---

## Key Files & Components

### Affected Files (11 total)
Located via: `grep -r "md:hidden\|md:flex\|md:block" src/**/*.tsx`

1. `/src/components/CharactersList.tsx` (Lines 401-582)
   - **Status**: Partially fixed
   - **Pattern**: Mobile (403-488) vs Desktop (491-579) layouts
   - **Testids**: `character-card`, `character-name`, `character-status-badge`
   - **Fix Applied**: Mobile badge uses `<span data-testid>` wrapper
   - **Remaining**: Desktop badge still uses direct testid on Badge component

2. `/src/components/ThreadedComment.tsx` (Lines 302-340+)
   - **Status**: Not fixed
   - **Pattern**: Desktop (303-319) vs Mobile (321-340) metadata
   - **Risk**: High - affects common room tests
   - **User Note**: "We already had one issue with duplicate comments"

3. `/src/components/ConversationList.tsx`
   - **Status**: Unknown severity
   - **Impact**: 6 private messaging test failures

4. `/src/components/PhaseCard.tsx`
   - **Impact**: 4 phase management test failures

5. `/src/components/ActionsList.tsx`
   - **Impact**: 1 action submission test failure

6-11. Other files to audit

### Test Files Requiring Updates
None identified - test infrastructure already improved:
- `MessagingPage.createConversation()` - uses `toBeAttached()` instead of `toBeVisible()`
- `PhaseManagementPage.createPhase()` - same fix applied
- `private-messages-delete.spec.ts` - refactored to use auth helpers

---

## Technical Decisions

### Decision 1: Testid Placement Strategy
**Options Considered**:
1. Keep testids on both mobile/desktop, make them unique
2. Move testids to parent wrapper elements
3. Use child span elements with testids
4. Refactor to single-source rendering

**Decision**: Use approach #3 (child span wrapper) for CharactersList.tsx
**Rationale**:
- Minimal visual impact
- Works with existing Badge component
- Tests can still access content
- Doesn't require component refactor

**Pattern**:
```tsx
// Before (WRONG)
<Badge data-testid="character-status-badge">{character.status}</Badge>

// After (CORRECT)
<Badge>
  <span data-testid="character-status-badge">{character.status}</span>
</Badge>
```

### Decision 2: Component-by-Component Approach
**Rationale**:
- Each component has unique testid requirements
- Allows incremental progress
- Easy to test and verify
- Single-commit rollback per component

**Alternative Considered**: Bulk find/replace
**Rejected Because**: Too risky, each component needs custom solution

### Decision 3: Documentation First
**Decision**: Create comprehensive mobile UI testing guidelines
**Timing**: After fixes complete (Phase 4.2)
**Rationale**:
- Prevents regression
- Establishes team patterns
- Helps onboarding
- Can reference in PR reviews

---

## Dependencies & Constraints

### Technical Constraints
1. **Cannot remove mobile layouts** - Required for responsive design
2. **Must preserve visual appearance** - No UX regressions
3. **Tailwind utilities stay** - `md:hidden`, `md:flex`, etc. are correct approach
4. **Test infrastructure is sound** - E2E helpers (loginAs, getFixtureGameId) work correctly

### Process Constraints
1. **No database changes** - Frontend-only fixes
2. **No API changes** - Component rendering only
3. **Must pass E2E tests** - Target >95% pass rate
4. **Git commits per component** - For easy rollback

---

## Patterns & Examples

### Anti-Pattern: Duplicate Testids
```tsx
// ❌ WRONG - Creates 2 elements with same testid
<div className="md:hidden">
  <Badge data-testid="status">{status}</Badge>
</div>
<div className="hidden md:block">
  <Badge data-testid="status">{status}</Badge>
</div>

// Playwright query result:
// Found 2 elements, selects first (hidden), test fails
```

### Pattern 1: Testid on Wrapper
```tsx
// ✅ GOOD - Single testid on parent
<div data-testid="character-card" className="...">
  <div className="md:hidden">{/* Mobile */}</div>
  <div className="hidden md:block">{/* Desktop */}</div>
</div>

// Playwright: Gets wrapper, works on any viewport
```

### Pattern 2: Content Wrapper (CharactersList approach)
```tsx
// ✅ GOOD - Testid on content span
<div className="md:hidden">
  <Badge>
    <span data-testid="status">{status}</span>
  </Badge>
</div>
<div className="hidden md:block">
  <Badge>
    <span data-testid="status">{status}</span>
  </Badge>
</div>

// Both spans visible, only one per layout, test succeeds
```

### Pattern 3: Single Source Rendering
```tsx
// ✅ BEST - Component instance deduplication
const StatusDisplay = ({ status }: { status: string }) => (
  <Badge data-testid="status">{status}</Badge>
);

<div className="md:hidden">
  <StatusDisplay status={character.status} />
</div>
<div className="hidden md:block">
  <StatusDisplay status={character.status} />
</div>

// React only creates one instance, appears in both places
```

---

## Testing Strategy

### Per-Component Testing
After each fix:
1. **Visual Test**: Check mobile and desktop layouts in browser
2. **Component Test**: Run related component tests
3. **E2E Test**: Run affected E2E tests
4. **Regression Check**: Ensure no new failures

### Commands
```bash
# Visual testing
just run-frontend  # Then use browser dev tools responsive mode

# Component tests
npm test -- CharactersList.test.tsx

# Specific E2E tests
npx playwright test e2e/characters/character-approval-workflow.spec.ts

# Full E2E suite (end of day)
npx playwright test --reporter=list
```

### Success Criteria Per Component
- [ ] No duplicate testids in component
- [ ] Mobile layout visually correct (iPhone SE width: 375px)
- [ ] Desktop layout visually correct (1920px)
- [ ] Component tests pass
- [ ] Related E2E tests pass
- [ ] No new E2E failures introduced

---

## Known Issues & Workarounds

### Issue 1: Worker-Specific Game IDs
- Test was looking for game 10604 (worker 1), not game 604 (worker 0)
- Worker IDs offset by `worker_index × 10000`
- Tests use `getFixtureGameId()` helper - this is correct
- No fix needed, understanding documented

### Issue 2: Collapsed Sidebar Elements
- Some elements technically visible but in collapsed state
- Tests previously used `toBeVisible()` which failed
- **Fixed**: Changed to `toBeAttached()` for DOM presence check
- Applies to MessagingPage and PhaseManagementPage

### Issue 3: Character Selection Dropdown Strict Mode
- Multiple `<select>` elements on page (tab select + character select)
- Playwright couldn't disambiguate
- **Fixed**: Filter select by presence of character name in options
- File: `MessagingPage.ts:84-102`

---

## Reference Links

### Codebase References
- **Testing Guide**: `.claude/context/TESTING.md`
- **E2E Patterns**: `.claude/skills/testing-patterns/resources/e2e-patterns-reference.md`
- **Architecture**: `.claude/context/ARCHITECTURE.md`
- **Project Instructions**: `CLAUDE.md`

### External Resources
- Playwright Strict Mode: https://playwright.dev/docs/locators#strictness
- Tailwind Responsive Design: https://tailwindcss.com/docs/responsive-design
- React Testing Best Practices: https://testing-library.com/docs/queries/about/

---

## Lessons Learned

### What Went Well
1. Playwright MCP debugging effectively identified root cause
2. Test infrastructure improvements (toBeAttached, auth helpers) working
3. Worker-specific fixtures isolate parallel test execution

### What Needs Improvement
1. Mobile UI implementation should have included testid review
2. E2E tests should have run during mobile UI development
3. Need automated duplicate testid detection

### Action Items for Future
1. Add pre-commit hook for duplicate testid detection
2. Include E2E test run in PR checklist
3. Document mobile UI patterns before implementation
4. Consider mob programming for large UI refactors

---

## Communication & Coordination

### Stakeholders
- **Development Team**: Needs to understand new patterns
- **QA/Testing**: Needs to validate fixes
- **Future Contributors**: Needs documentation

### Status Updates
- Update planning document after each phase
- Commit messages follow pattern: "Fix mobile UI duplicates in [Component]"
- Final PR includes link to planning docs

### Handoff Documentation
All patterns and decisions captured in:
- This context document
- Main plan document
- Future: `.claude/reference/MOBILE_UI_PATTERNS.md`
