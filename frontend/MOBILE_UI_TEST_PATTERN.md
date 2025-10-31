# Mobile UI Testing Pattern - Tailwind + Playwright

## The Problem

Our responsive design uses Tailwind's utility classes (`md:hidden`, `hidden md:flex`) to show/hide mobile vs desktop layouts. This creates a dual-DOM pattern where **both layouts exist in the DOM simultaneously**, with CSS controlling visibility.

This breaks Playwright's strict mode, which counts DOM elements regardless of CSS visibility.

## Standard Practice

**This is the CORRECT and standard approach for Tailwind responsive designs.**

Playwright best practices for responsive layouts:
1. Tests run at a specific viewport (default: 1280x720 = desktop)
2. At desktop width, desktop layout is visible, mobile layout is hidden by CSS
3. Both layouts exist in DOM, only one is visible
4. Use `.first()` to bypass strict mode violations
5. **STILL validate `.toBeVisible()` to ensure proper UX**

## The Fix Pattern

### ❌ Wrong Approach (what I was doing)
```typescript
// DON'T use .toBeAttached() - this doesn't validate UX
const button = page.getByTestId('approve-button').first();
await expect(button).toBeAttached(); // ❌ Element might be hidden!
await button.click({ force: true }); // ❌ Bypasses visibility checks
```

### ✅ Correct Approach
```typescript
// DO use .first() + .toBeVisible() - validates actual UX
const button = page.getByTestId('approve-button').first();
await expect(button).toBeVisible(); // ✅ Ensures button is actually visible
await button.click(); // ✅ Normal click, validates clickability
```

## When to Use .first()

### Components with Duplicate testids
When a component has mobile AND desktop layouts with the same testid:

```tsx
// CharactersList.tsx
<div className="md:hidden"> {/* Mobile layout */}
  <Button>
    <span data-testid="approve-button">Approve</span>
  </Button>
</div>

<div className="hidden md:flex"> {/* Desktop layout */}
  <Button>
    <span data-testid="approve-button">Approve</span>
  </Button>
</div>
```

**Test Pattern:**
```typescript
// Use .first() to handle duplicates, but validate visibility
const approveButton = page.getByTestId('approve-button').first();
await expect(approveButton).toBeVisible(); // Validates correct layout is shown
await approveButton.click();
```

### Components with Unique Wrapper testids
When testid is on a stable wrapper (exists once):

```tsx
<div data-testid="character-card"> {/* Exists once */}
  <div className="md:hidden">Mobile content</div>
  <div className="hidden md:flex">Desktop content</div>
</div>
```

**Test Pattern:**
```typescript
// Find stable wrapper, then use semantic selectors
const card = page.getByTestId('character-card');
const name = card.locator('h4').first(); // .first() for semantic selectors too
```

## Playwright Viewport Behavior

- Default viewport: **1280x720** (desktop)
- Tailwind `md:` breakpoint: **768px**
- At 1280px width:
  - `md:hidden` elements are **hidden** (mobile)
  - `hidden md:flex` elements are **visible** (desktop)
- `.first()` will select the **first in DOM order**, which should be the visible one

## Common Mistakes to Avoid

### ❌ Don't use .toBeAttached() instead of .toBeVisible()
```typescript
// This passes even if element is hidden!
await expect(element).toBeAttached(); // ❌
```

### ❌ Don't use force: true on clicks
```typescript
// This bypasses Playwright's actionability checks
await element.click({ force: true }); // ❌
```

### ❌ Don't remove duplicate testids when they're intentional
```typescript
// Both layouts need the same testid for responsive design
<span data-testid="approve-button">Approve</span> // Both ✅
```

## What We Fixed

### 1. CharacterWorkflowPage.ts
- Added `.first()` to all testid selectors
- **Kept** `.toBeVisible()` and normal `.click()`
- Changed semantic selectors to use `.first()`

### 2. MessagingPage.ts
- Fixed character select to use specific filter (placeholder text)
- Added `.first()` for duplicate select elements

### 3. Page Objects Pattern
```typescript
// Standard pattern for dual-DOM components
async approveCharacter(characterName: string) {
  const card = await this.findCharacterCard(characterName);

  // Use .first() because button exists in both mobile and desktop layouts
  const approveButton = card.getByTestId('approve-character-button').first();
  await approveButton.waitFor({ state: 'visible', timeout: 3000 });
  await approveButton.click(); // Normal click - validates clickability
}
```

## Testing Mobile Layouts

To test mobile layouts specifically, set viewport in test:

```typescript
test('mobile layout test', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 }); // iPhone size

  // Now mobile layout is visible, desktop is hidden
  const button = page.getByTestId('approve-button').first();
  await expect(button).toBeVisible(); // Mobile button is visible
});
```

## Summary

- **Tailwind responsive pattern with dual-DOM is standard and correct**
- **Use `.first()` to handle strict mode with duplicate testids**
- **Always validate `.toBeVisible()` to ensure proper UX**
- **Never use `force: true` or `.toBeAttached()` to bypass visibility**
- **E2E tests validate the actual user experience, including visibility**
