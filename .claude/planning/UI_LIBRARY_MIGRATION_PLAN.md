# UI Component Library Migration Plan

**Created:** 2025-10-21
**Status:** In Progress
**Goal:** Migrate all frontend components from native HTML + semantic tokens to UI Component Library

---

## Migration Progress

### ✅ Completed (30 files - 37% of total)

#### Pre-Priority Work (5 files)
1. **MessageThread.tsx** - Alert, Button, Select, Textarea
2. **PhaseManagement.tsx** - Button
3. **PhaseCard.tsx** - Button, DateTimeInput
4. **CommentEditor.tsx** - Button, Textarea
5. **Documentation** - CLAUDE.md, .claude/context/FRONTEND_STYLING.md

#### Priority 1 - High Traffic Components ✅ COMPLETE (10 files)
1. **ActionSubmission.tsx** - Button, Select, Textarea, Alert (4 components)
2. **ActionsList.tsx** - Button, Select (5 buttons, 1 select)
3. **CommonRoom.tsx** - Button, Alert, Spinner
4. **PostCard.tsx** - Button, Select (5 buttons, 1 select)
5. **ThreadedComment.tsx** - Button, Select (7 buttons, 1 select)
6. **CreatePostForm.tsx** - Button, Select, Alert (3 types)
7. **CurrentPhaseDisplay.tsx** - Button (2 buttons)
8. **GameTabContent.tsx** - ✓ No migration needed (layout component)
9. **PrivateMessages.tsx** - Button (4 buttons)
10. **DashboardGameCard.tsx** - ✓ No migration needed (display component)

#### Priority 2 - Forms & Modals ✅ COMPLETE (15 files)
1. **CreatePhaseModal.tsx** - Button, Select, Input, Textarea, DateTimeInput
2. **EditPhaseModal.tsx** - Button, Input, Textarea, DateTimeInput
3. **NewConversationModal.tsx** - ✓ Already using UI components
4. **CreateActionResultForm.tsx** - Button, Textarea, Checkbox, Alert
5. **AvatarUploadModal.tsx** - Button, Alert
6. **AddAbilityModal.tsx** - Button, Input, Select, Textarea
7. **AddItemModal.tsx** - Button, Input, Textarea
8. **AddSkillModal.tsx** - Button, Input, Textarea
9. **AddCurrencyModal.tsx** - Button, Input
10. **FilterBar.tsx** - Button (toggle filters), Select, Checkbox
11. **PhaseActivationDialog.tsx** - Button (multiple variants)
12. **ThreadViewModal.tsx** - Button + semantic token cleanup (surface-base, text-content-*)
13. **ConversationList.tsx** - Button (list items with conditional styling)
14. **CharacterAutocomplete.tsx** - ✓ No migration needed (semantic HTML for accessibility)
15. **CharacterSheet.tsx** - Button (6 buttons across tabs + editing), Textarea

### 🎯 Already Using UI Library (15 files)
These components already use the UI library and don't need migration:
1. ApplyToGameModal.tsx
2. CharactersList.tsx
3. CreateCharacterModal.tsx
4. CreateGameForm.tsx
5. EditGameModal.tsx
6. EnhancedGameCard.tsx
7. ErrorDisplay.tsx
8. GameApplicationsList.tsx
9. GamesList.tsx
10. LoginForm.tsx
11. RegisterForm.tsx
12. TabNavigation.tsx
13. Layout.tsx
14. Modal.tsx
15. TestConnection.tsx

### 📋 Pending Migration (37 files)

Prioritized by usage frequency and impact:

#### **Priority 1 - High Traffic Components** ✅ COMPLETE (10/10)
All high-traffic components have been migrated!

#### **Priority 2 - Forms & Modals** ✅ COMPLETE (15/15)
All forms and modals have been migrated!

#### **Priority 3 - Display Components** (20 files)
Read-only or mostly display components:
- [ ] **GameResultsManager.tsx** - Results display
- [ ] **ActionResultsList.tsx** - Action results list
- [ ] **PhaseHistoryView.tsx** - Phase history
- [ ] **GameApplicationCard.tsx** - Application cards
- [ ] **CommentThread.tsx** - Comment threads
- [ ] **NotificationDropdown.tsx** - Notifications dropdown
- [ ] **NotificationItem.tsx** - Individual notification
- [ ] **NotificationBell.tsx** - Notification bell icon
- [ ] **RecentActivityCard.tsx** - Activity feed
- [ ] **UpcomingDeadlinesCard.tsx** - Deadlines display
- [ ] **UrgentActionsCard.tsx** - Urgent actions display
- [ ] **CurrentPhaseCard.tsx** - Current phase info
- [ ] **GameActions.tsx** - Game action buttons
- [ ] **GameHeader.tsx** - Game header display
- [ ] **GameInfoGrid.tsx** - Game information grid
- [ ] **GameApplicationStatus.tsx** - Application status badge
- [ ] **BackendStatus.tsx** - Backend status indicator
- [ ] **ErrorBoundary.tsx** - Error boundary component
- [ ] **ProtectedRoute.tsx** - Route protection wrapper
- [ ] **MarkdownPreview.tsx** - Markdown rendering (keep as-is)

#### **Priority 4 - Character Management** (9 files)
Character-related components:
- [ ] **AbilitiesManager.tsx** - Abilities management
- [ ] **AbilityCard.tsx** - Ability card display
- [ ] **CurrencyCard.tsx** - Currency display
- [ ] **ItemCard.tsx** - Item card display
- [ ] **InventoryManager.tsx** - Inventory management
- [ ] **SkillCard.tsx** - Skill card display
- [ ] **CharacterAvatar.tsx** - Avatar display
- [ ] **CreateCharacterModal.tsx** - Character creation (already migrated)

#### **Priority 5 - Utility Components** (8 files)
Low-priority or specialized components:
- [ ] **CountdownTimer.tsx** - Timer display (mostly text)
- [ ] **SimpleCountdown** (within CountdownTimer) - Simple timer
- [ ] **Modal.tsx** - Base modal (already migrated)
- [ ] **TestConnection.tsx** - Connection testing (already migrated)
- [ ] **Layout.tsx** - App layout (already migrated)

---

## Migration Guidelines

### Component Replacement Map

**Buttons:**
```tsx
// Before
<button className="bg-interactive-primary hover:bg-interactive-primary-hover text-white px-4 py-2 rounded">
  Save
</button>

// After
import { Button } from '@/components/ui';
<Button variant="primary" onClick={handleSave}>
  Save
</Button>
```

**Inputs:**
```tsx
// Before
<input
  type="text"
  className="border border-theme-default surface-base text-content-primary px-3 py-2 rounded"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>

// After
import { Input } from '@/components/ui';
<Input
  type="text"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

**Textareas:**
```tsx
// Before
<textarea
  className="border border-theme-default surface-base text-content-primary px-3 py-2 rounded"
  rows={4}
/>

// After
import { Textarea } from '@/components/ui';
<Textarea rows={4} />
```

**Selects:**
```tsx
// Before
<select className="border border-theme-default surface-base text-content-primary px-3 py-2 rounded">
  <option value="1">Option 1</option>
</select>

// After
import { Select } from '@/components/ui';
<Select>
  <option value="1">Option 1</option>
</Select>
```

**Cards:**
```tsx
// Before
<div className="surface-base border border-theme-default rounded-lg p-4">
  <h3 className="text-content-primary">Title</h3>
  <p className="text-content-secondary">Content</p>
</div>

// After
import { Card, CardBody } from '@/components/ui';
<Card variant="default" padding="md">
  <CardBody>
    <h3 className="text-text-heading">Title</h3>
    <p className="text-text-secondary">Content</p>
  </CardBody>
</Card>
```

**Alerts:**
```tsx
// Before
<div className="bg-semantic-danger-subtle border border-semantic-danger rounded-lg p-4">
  Error message
</div>

// After
import { Alert } from '@/components/ui';
<Alert variant="danger">
  Error message
</Alert>
```

**Badges:**
```tsx
// Before
<span className="bg-interactive-primary-subtle text-interactive-primary px-2 py-1 rounded text-xs">
  Active
</span>

// After
import { Badge } from '@/components/ui';
<Badge variant="primary">Active</Badge>
```

---

## Migration Process (Per Component)

### Step 1: Analysis
1. Open component file
2. Search for:
   - `<button` → Replace with `<Button>`
   - `<input` → Replace with `<Input>`
   - `<textarea` → Replace with `<Textarea>`
   - `<select` → Replace with `<Select>`
   - Container `<div>` with `surface-base` → Consider `<Card>`
   - Status indicators → Consider `<Badge>`
   - Alert/error boxes → Consider `<Alert>`

### Step 2: Import UI Components
```tsx
import { Button, Input, Textarea, Select, Card, Badge, Alert } from '@/components/ui';
```

### Step 3: Replace Elements
- One element type at a time (all buttons first, then all inputs, etc.)
- Preserve all event handlers (onClick, onChange, etc.)
- Preserve disabled states
- Preserve refs (UI components support forwardRef)
- Remove manual className styling
- Use variant props instead

### Step 4: Test
1. Visual inspection in light mode
2. Visual inspection in dark mode
3. Test interactive elements (clicks, inputs)
4. Test form submissions
5. Test edge cases (disabled states, errors, validation)

### Step 5: Commit
- Commit message: `refactor: migrate [ComponentName] to UI library`
- Include before/after screenshots if visual changes

---

## Testing Checklist

For each migrated component:

**Visual:**
- [ ] Looks correct in light mode
- [ ] Looks correct in dark mode
- [ ] Hover states work
- [ ] Focus states visible
- [ ] Disabled states styled correctly

**Functional:**
- [ ] All buttons clickable
- [ ] All inputs editable
- [ ] All forms submittable
- [ ] All dropdowns selectable
- [ ] No console errors

**Regression:**
- [ ] No layout shifts
- [ ] No broken functionality
- [ ] No performance degradation

---

## Special Cases

### MarkdownPreview.tsx
**Do NOT migrate** - This component has custom prose styling and dark mode support already integrated. Leave as-is.

### CountdownTimer.tsx
**Minimal migration** - This is mostly text display with minimal interactive elements. Only migrate if there are buttons.

### CharacterAutocomplete.tsx
**Careful migration** - This has complex dropdown logic. Test autocomplete thoroughly after migration.

### ErrorBoundary.tsx
**Test thoroughly** - Error boundaries are critical. Ensure migration doesn't break error handling.

---

## Benefits After Migration

**Code Quality:**
- 70% less styling code (no manual `dark:` classes)
- Consistent UI across all components
- Type-safe component props
- Better autocomplete in IDE

**Maintainability:**
- Centralized theme management
- Easy to update styles globally
- No duplicated styling logic
- Self-documenting component APIs

**User Experience:**
- Consistent button sizes and spacing
- Consistent form field styling
- Automatic dark mode support
- Better accessibility (built into UI components)

---

## Known Technical Debt: Semantic Token Cleanup

**Issue Identified:** ~25 files still use hardcoded color classes (`text-gray-*`, `bg-white`, `bg-gray-*`, `border-gray-*`) instead of semantic tokens.

**Impact:** These components won't properly adapt to dark mode or theme changes.

**Files Affected:**
- AbilitiesManager, AbilityCard, ActionResultsList, ActionsList, ActionSubmission
- AvatarUploadModal, CharacterAutocomplete, CharacterSheet, CommentThread
- CreatePhaseModal, CurrencyCard, CurrentPhaseDisplay, EditPhaseModal
- EnhancedGameCard, ErrorBoundary, GameApplicationCard, GameResultsManager
- InventoryManager, ItemCard, NewConversationModal, PhaseActivationDialog
- PhaseHistoryView, RecentActivityCard, SkillCard, UrgentActionsCard

**Semantic Token Mapping:**
```tsx
// Old (hardcoded gray colors)
bg-white → surface-base
bg-gray-50 → surface-raised or surface-sunken
text-gray-900 → text-content-primary
text-gray-600 → text-content-secondary
text-gray-400 → text-content-tertiary
border-gray-200 → border-theme-default
border-gray-300 → border-theme-subtle
```

**Priority:** Medium (after Priority 3-5 component migrations)
**Estimated Time:** ~3-4 hours (10-15 min per file)

**Note:** ThreadViewModal already updated as part of Priority 2 migration.

---

## Next Steps

1. ✅ ~~Complete Priority 1 (High Traffic Components)~~ - **DONE**
2. ✅ ~~Complete Priority 2 (Forms & Modals)~~ - **DONE**
3. **Complete Priority 3 (Display Components)** - **Next priority** (20 files)
4. Complete Priority 4 (Character Management) (9 files)
5. Complete Priority 5 (Utility Components) (8 files)
6. **Semantic Token Cleanup** - Replace remaining `text-gray-*`, `bg-white`, `bg-gray-*` with semantic tokens (~25 files)
7. Final audit - grep for remaining native elements
8. Update test coverage for migrated components

---

## Resources

- **UI Library Docs:** `/frontend/src/components/ui/README.md`
- **Styling Guide:** `/.claude/context/FRONTEND_STYLING.md`
- **Theme Test Page:** `http://localhost:5173/theme-test`
- **Migration Examples:**
  - MessageThread.tsx (src/components/MessageThread.tsx:1-354)
  - PhaseCard.tsx (src/components/PhaseCard.tsx:1-189)
  - CommentEditor.tsx (src/components/CommentEditor.tsx:1-330)

---

## Progress Tracking

**Total Components:** 82
**Already Using UI Library:** 16 (20%)
**Migrated:** 30 (37%) - ✅ All Priority 1 + All Priority 2 complete!
**Remaining:** 36 (44%)

### Completed Work Summary
- ✅ **Priority 1:** 10/10 components (100%) - ~5 hours completed
- ✅ **Priority 2:** 15/15 components (100%) - ~7.5 hours completed
- **Priority 3:** 0/20 components (0%)
- **Priority 4:** 0/9 components (0%)
- **Priority 5:** 0/8 components (0%)

**Time Invested:** ~12.5 hours
**Estimated Remaining:**
- Priority 3: ~10 hours (20 components × 30 min each)
- Priority 4: ~4.5 hours (9 components × 30 min each)
- Priority 5: ~4 hours (8 components × 30 min each)
- **Total Remaining: ~18.5 hours**
