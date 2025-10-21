# Dark Mode Implementation Guide

## Overview

ActionPhase supports dark mode using **CSS Custom Properties** and a **UI Component Library**. This guide helps developers add dark mode support to components.

**Status**: Production Ready ✅
- **Approach**: CSS Variables + UI Components
- **Migrations**: 7 core components complete
- **Remaining**: ~20 optional components

## ⚠️ UPDATED APPROACH (2025-01-XX)

**DO NOT use manual `dark:` classes for new components!**

Instead:
1. **Use CSS variables** from `src/index.css` (e.g., `bg-bg-primary`, `text-text-heading`)
2. **Use UI components** from `src/components/ui/` (Button, Input, Card, Badge, Alert, etc.)

See "Phase 3 Migration Guide" below for migration patterns.

## Quick Reference

### Color Palette

```css
/* Backgrounds */
bg-white → bg-white dark:bg-gray-800
bg-gray-50 → bg-gray-50 dark:bg-gray-900
bg-gray-100 → bg-gray-100 dark:bg-gray-800

/* Text */
text-gray-900 → text-gray-900 dark:text-white
text-gray-700 → text-gray-700 dark:text-gray-300
text-gray-600 → text-gray-600 dark:text-gray-400
text-gray-500 → text-gray-500 dark:text-gray-500

/* Borders */
border-gray-200 → border-gray-200 dark:border-gray-700
border-gray-300 → border-gray-300 dark:border-gray-600

/* Buttons - Primary */
bg-blue-600 hover:bg-blue-700 →
  bg-blue-600 dark:bg-blue-700
  hover:bg-blue-700 dark:hover:bg-blue-600

/* Buttons - Secondary */
border-gray-300 hover:bg-gray-50 →
  border-gray-300 dark:border-gray-600
  hover:bg-gray-50 dark:hover:bg-gray-700
```

### Common Patterns

#### Card/Panel Component
```tsx
<div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
    Title
  </h2>
  <p className="text-gray-600 dark:text-gray-400">
    Content text
  </p>
</div>
```

#### Button - Primary
```tsx
<button className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
  Action
</button>
```

#### Button - Secondary
```tsx
<button className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
  Cancel
</button>
```

#### Input Field
```tsx
<input
  type="text"
  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
  placeholder="Enter value..."
/>
```

#### Link
```tsx
<Link to="/path" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline">
  Link Text
</Link>
```

## Systematic Approach

### Step 1: Identify Color Classes
Find all instances of:
- `bg-{color}`
- `text-{color}`
- `border-{color}`
- `hover:bg-{color}`
- etc.

### Step 2: Add Dark Mode Variants
For each color class, add the `dark:` variant immediately after:

**Before:**
```tsx
<div className="bg-white text-gray-900 border-gray-200">
```

**After:**
```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700">
```

### Step 3: Test Both Themes
1. Switch to dark mode in Settings
2. Verify all text is readable
3. Check contrast ratios
4. Look for white flashes or unstyled elements

## Component Checklist

When adding dark mode to a component:

- [ ] Background colors have dark variants
- [ ] Text colors have dark variants
- [ ] Border colors have dark variants
- [ ] Hover states work in dark mode
- [ ] Focus states work in dark mode
- [ ] Icons/images look good in dark mode
- [ ] No white flashes during transitions
- [ ] Contrast ratio meets WCAG 2.1 AA (4.5:1 for text)

## Special Cases

### Colored Backgrounds (Blue, Green, Red, etc.)
Use darker variants with lighter text:

```tsx
{/* Light blue background */}
<div className="bg-blue-50 dark:bg-blue-900/30">
  <h4 className="text-blue-900 dark:text-blue-300">Title</h4>
  <p className="text-blue-800 dark:text-blue-200">Content</p>
</div>
```

### Focus Ring Offsets
When using focus rings on dark backgrounds:

```tsx
focus:ring-offset-2 dark:focus:ring-offset-gray-900
```

### Shadows
Shadows are less visible in dark mode. Borders often work better:

```tsx
{/* Use both shadow and border for depth */}
className="shadow-md border border-gray-200 dark:border-gray-700"
```

## Testing Dark Mode

### Manual Testing
1. Go to http://localhost:5173/settings
2. Toggle between Light, Dark, and Auto
3. Navigate through all pages
4. Check for:
   - Readable text
   - Visible borders
   - Consistent colors
   - No white flashes

### Browser DevTools
Use Chrome DevTools to force dark mode:
1. Open DevTools (F12)
2. Click ... menu → More tools → Rendering
3. Find "Emulate CSS media feature prefers-color-scheme"
4. Select "prefers-color-scheme: dark"

## Phase 3 Migration Guide

### CSS Variables Available

**Backgrounds:**
- `bg-bg-primary` - Main background (white → dark gray)
- `bg-bg-secondary` - Secondary background (light gray → darker gray)
- `bg-bg-tertiary` - Tertiary background (lighter gray → dark gray)
- `bg-bg-input` - Input backgrounds (white → dark)
- `bg-bg-hover` - Hover states (gray → lighter gray)

**Text:**
- `text-text-heading` - Headings (black → white)
- `text-text-primary` - Body text (dark gray → light gray)
- `text-text-secondary` - Secondary text (gray → gray)
- `text-text-muted` - Muted text (light gray → darker gray)
- `text-placeholder` - Placeholder text

**Borders:**
- `border-border-primary` - Primary borders
- `border-border-secondary` - Secondary borders
- `border-border-input` - Input borders

**Semantic Colors:**
- `bg-primary`, `bg-primary-hover`, `bg-primary-light`, `text-primary-text`
- `bg-success`, `bg-success-hover`, `bg-success-light`, `text-success-text`
- `bg-warning`, `bg-warning-hover`, `bg-warning-light`, `text-warning-text`
- `bg-danger`, `bg-danger-hover`, `bg-danger-light`, `text-danger-text`

### UI Components Available

**Tier 1:**
- `Button` - 4 variants (primary, secondary, danger, ghost), 3 sizes, loading state
- `Input` - Labels, validation, helper text, error states, 3 sizes
- `Card` / `CardHeader` / `CardBody` / `CardFooter` - 3 variants, 4 padding options

**Tier 2:**
- `Badge` - 6 variants, 3 sizes, dot indicator
- `Alert` - 4 variants (info, success, warning, danger), dismissible, icons
- `Spinner` - 4 sizes, 3 variants, labels
- `Label` - Required/optional indicators
- `Checkbox` - Labels, helper text, error states
- `Radio` - Labels, helper text, error states

**Import:**
```tsx
import { Button, Input, Card, CardHeader, CardBody, CardFooter, Badge, Alert, Spinner, Label, Checkbox, Radio } from './components/ui';
```

### Migration Pattern

**Before (manual dark: classes):**
```tsx
<div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email *</label>
  <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
  <button className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600">
    Submit
  </button>
</div>
```

**After (UI components + CSS variables):**
```tsx
<Card variant="elevated" padding="md">
  <Input label="Email" type="email" required value={email} onChange={handleChange} />
  <Button variant="primary" onClick={handleSubmit}>Submit</Button>
</Card>
```

**Benefits:**
- ✅ No manual dark: class pairs
- ✅ Automatic dark mode support
- ✅ Consistent styling
- ✅ Less code (typically 5-15% reduction)

### Advanced Pattern: Card Semantic Color Variants

**Problem**: Tailwind v4's `@theme` block can't generate utility classes for CSS variables that reference themselves.

**Solution**: Use Card variants with inline styles for semantic color backgrounds.

**Card Variants Available:**
- `default` - White background, subtle border
- `elevated` - White background, shadow
- `bordered` - White background, prominent border
- `danger` - **Red background** (for urgent/error cards)
- `warning` - **Yellow background** (for warning cards)
- `success` - **Green background** (for success cards)

**Example - Urgent Actions Card:**
```tsx
// ✅ CORRECT: Use variant prop
<Card variant="danger" padding="lg">
  <h2>Urgent Actions Required</h2>
  <p>These actions need immediate attention!</p>
</Card>

// ❌ WRONG: Don't try to override with className
<Card className="bg-danger-light border-danger">
  {/* This won't work - Card's bg-bg-primary wins */}
</Card>
```

**How It Works:**
The Card component uses inline styles for semantic color variants:
```tsx
// In Card.tsx
const variantInlineStyles = {
  danger: {
    backgroundColor: 'rgb(var(--color-danger-light))',  // Wraps raw RGB values
    borderColor: 'rgb(var(--color-danger))',
  },
};
```

**Why `rgb(var(--color-name))`?**
- CSS variables store **raw RGB values** (e.g., `"127 29 29"` or `"254 242 242"`)
- Inline styles need the full color format: `rgb(127 29 29)`
- So we wrap: `rgb(var(--color-danger-light))` → `rgb(127 29 29)` → ✅ valid CSS color

**Result**: Works perfectly in both light and dark modes!

See `frontend/src/components/ui/README.md` for complete component documentation.

## Current Coverage Status

### ✅ Fully Migrated Components (21 total)

**Phase 3 - UI Component Migrations (14 components - no dark: classes remaining):**
1. **Modal** - Generic modal wrapper
2. **GameHeader** - Game title display
3. **TabNavigation** - Tab interface
4. **GamesList** - Card, Spinner, Alert
5. **CharactersList** - Card, Button, Badge, Spinner
6. **UrgentActionsCard** - Card variant="danger" ✨
7. **UpcomingDeadlinesCard** - Card, Badge (CSS variables for urgency colors)
8. **RecentActivityCard** - Card
9. **CreateCharacterModal** - Input, Button, Alert, Label
10. **ApplyToGameModal** - Button, Alert, Label
11. **EditGameModal** - Input, Button, Alert, Label, Checkbox
12. **GameApplicationsList** - Card, Spinner, Alert, Button, Badge
13. **DashboardGameCard** - CSS variables
14. **EnhancedGameCard** - CSS variables, complex badges

**Earlier Phases (7 components):**
15. LoginForm - Input, Button, Card
16. RegisterForm - Input, Button, Card, Alert
17. ErrorDisplay - Alert, Button
18. NotificationBell - Badge
19. CreateGameForm - Input, Label, Button, Alert
20. NotificationItem - Badge, CSS variables
21. Layout - CSS variables (brand-specific indigo preserved)

**Statistics:**
- **Total migrated**: 21 components
- **Dark classes eliminated**: ~250+ manual dark: class pairs
- **Code reduction**: 5-15% per component
- **Success rate**: 67% of attempted migrations complete

### ⏳ Remaining Components (~11)

**Utility Components:**
- BackendStatus, TestConnection, FilterBar, Modal, EnhancedGameCard, etc.

### Legacy (Old Approach - Do Not Use)
The following components use the old manual `dark:` approach:
- Layout (nav + footer)
- HomePage
- SettingsPage

These work but should be migrated to CSS variables + UI components when time permits.

## Tips for Fast Implementation

1. **Use Find & Replace**: Search for `className="bg-white` and add dark variants
2. **Copy patterns**: Reuse the patterns from this guide
3. **Start with layout**: Background and text colors first, then borders
4. **Test frequently**: Check both themes after every few components
5. **Focus on visibility**: Ensure text is always readable

## Common Mistakes to Avoid

❌ **Forgetting hover states**
```tsx
{/* Bad - hover only works in light mode */}
hover:bg-gray-100

{/* Good */}
hover:bg-gray-100 dark:hover:bg-gray-700
```

❌ **Inconsistent grays**
```tsx
{/* Bad - mixing different gray shades */}
bg-gray-50 dark:bg-gray-700  {/* Too bright */}

{/* Good */}
bg-gray-50 dark:bg-gray-900  {/* Consistent darkness */}
```

❌ **Missing text colors**
```tsx
{/* Bad - text invisible in dark mode */}
<div className="bg-white dark:bg-gray-800">
  <p>Text</p>  {/* Will be black on dark background! */}
</div>

{/* Good */}
<div className="bg-white dark:bg-gray-800">
  <p className="text-gray-900 dark:text-white">Text</p>
</div>
```

## Resources

- **Tailwind Dark Mode Docs**: https://tailwindcss.com/docs/dark-mode
- **WCAG Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Theme Context**: `/frontend/src/contexts/ThemeContext.tsx`
- **Settings Page**: `/frontend/src/pages/SettingsPage.tsx`
- **Example Components**: Layout.tsx, HomePage.tsx

## Questions?

See existing implementations in:
- `/frontend/src/components/Layout.tsx`
- `/frontend/src/pages/HomePage.tsx`
- `/frontend/src/pages/SettingsPage.tsx`
