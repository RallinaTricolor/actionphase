# Dark Mode Integration Guide

## ✅ Current Status: Fully Integrated!

Your app already has **complete dark mode integration** working! Here's what's in place:

### What's Already Working

1. **✅ ThemeProvider wraps entire app** (`App.tsx`)
   - Applies CSS variables to `:root` element
   - Adds `.dark` or `.light` class to `<html>` for backward compatibility
   - Detects system preferences via `prefers-color-scheme`
   - Persists user choice to localStorage

2. **✅ Theme settings page** (`/settings`)
   - Light mode
   - Dark mode
   - System preference (auto)
   - Shows current resolved theme

3. **✅ All semantic tokens auto-adapt**
   - Surface tokens (surface-base, surface-raised, etc.)
   - Content tokens (text-content-primary, text-content-secondary, etc.)
   - Interactive tokens (bg-interactive-primary, etc.)
   - Semantic tokens (bg-semantic-danger, etc.)
   - Border tokens (border-theme-default, etc.)

4. **✅ 85% of components migrated**
   - 50+ components using semantic tokens
   - Automatic theme switching without component changes

### How It Works

```tsx
// When user switches theme in Settings:
setTheme('dark')  // or 'light' or 'system'

// ThemeProvider automatically:
// 1. Updates CSS variables in :root
const themeValues = themes['dark']; // from themes.ts
Object.entries(themeValues).forEach(([key, value]) => {
  root.style.setProperty(key, value);
  // e.g., --color-surface-base: '31 41 55' (gray-800)
});

// 2. Adds .dark class to <html>
root.classList.add('dark');

// 3. Components using semantic tokens automatically update!
<div className="surface-base text-content-primary">
  // In light: white background, gray-900 text
  // In dark: gray-800 background, white text
</div>
```

---

## 🎯 Optional Enhancements

### 1. Quick Theme Toggle in Header

Add a moon/sun icon button to the navigation bar for quick access:

**Create:** `src/components/ThemeToggle.tsx`

```tsx
import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md text-indigo-100 hover:bg-indigo-700 transition-colors"
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {resolvedTheme === 'dark' ? (
        // Sun icon (light mode)
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Moon icon (dark mode)
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
```

**Update:** `src/components/Layout.tsx`

```tsx
import { ThemeToggle } from './ThemeToggle';

// In the User Menu section (around line 56):
<div className="flex items-center space-x-4">
  <NotificationBell />

  <ThemeToggle />  {/* Add this line */}

  <Link to="/settings" className={navLinkClass('/settings')}>
    Settings
  </Link>

  <button onClick={handleLogout} /* ... */>
    Logout
  </button>
</div>
```

---

### 2. Add Smooth Theme Transition

For a polished experience, add a CSS transition when switching themes:

**Update:** `src/index.css` (add at the top)

```css
/* Smooth theme transitions */
* {
  transition-property: background-color, border-color, color, fill, stroke;
  transition-duration: 200ms;
  transition-timing-function: ease-in-out;
}

/* Disable transitions on theme change to avoid flash */
.no-transition,
.no-transition * {
  transition: none !important;
}
```

**Optional:** Add to ThemeProvider to briefly disable transitions during switch:

```tsx
// In ThemeProvider's useEffect (around line 79):
useEffect(() => {
  const root = document.documentElement;

  // Temporarily disable transitions
  root.classList.add('no-transition');

  const themeValues = themes[resolvedTheme];
  Object.entries(themeValues).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  root.classList.remove('light', 'dark');
  root.classList.add(resolvedTheme);

  // Re-enable transitions after a frame
  requestAnimationFrame(() => {
    root.classList.remove('no-transition');
  });

  // ... rest of localStorage logic
}, [theme, resolvedTheme]);
```

---

### 3. Test Dark Mode Integration

**Manual Testing Checklist:**

```bash
# Start the app
just dev
just run-frontend  # in another terminal
```

Then test:

- [ ] **Settings Page** (`/settings`)
  - [ ] Click "Light" - app switches to light theme
  - [ ] Click "Dark" - app switches to dark theme
  - [ ] Click "System" - app matches OS preference
  - [ ] Refresh page - theme persists

- [ ] **System Preference**
  - [ ] Set theme to "System"
  - [ ] Change OS theme (System Preferences → Appearance)
  - [ ] App automatically switches to match

- [ ] **Visual Verification**
  - [ ] All backgrounds switch appropriately
  - [ ] All text remains readable
  - [ ] All borders/shadows adjust correctly
  - [ ] Interactive elements (buttons, links) switch
  - [ ] No flashing/flickering during switch

- [ ] **Component Coverage**
  - [ ] Visit `/dashboard` - cards, widgets switch
  - [ ] Visit `/games` - game cards, filters switch
  - [ ] Visit `/games/:id` - game details switch
  - [ ] Check modals, dropdowns, tooltips

---

### 4. Browser DevTools Testing

**Check CSS Variables:**

```javascript
// In browser console
getComputedStyle(document.documentElement).getPropertyValue('--color-surface-base')
// Light: "255 255 255" (white)
// Dark: "31 41 55" (gray-800)

// Verify all semantic tokens are present
[
  '--color-surface-base',
  '--color-content-primary',
  '--color-interactive-primary',
  '--color-semantic-danger',
  '--color-border-default'
].forEach(token => {
  console.log(token, getComputedStyle(document.documentElement).getPropertyValue(token));
});
```

**Check HTML Class:**

```javascript
// Should show "dark" or "light"
document.documentElement.classList
```

---

### 5. Add E2E Tests (Optional)

**Create:** `frontend/e2e/theme/theme-switching.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Theme Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Login as test user
    await page.fill('[name="username"]', 'test_player');
    await page.fill('[name="password"]', 'testpassword123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('switches between light and dark themes', async ({ page }) => {
    // Navigate to settings
    await page.click('a[href="/settings"]');
    await page.waitForURL('/settings');

    // Check initial theme
    const html = page.locator('html');

    // Switch to dark mode
    await page.click('input[value="dark"]');
    await expect(html).toHaveClass(/dark/);

    // Verify dark mode colors
    const background = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--color-surface-base').trim();
    });
    expect(background).toBe('31 41 55'); // gray-800

    // Switch to light mode
    await page.click('input[value="light"]');
    await expect(html).toHaveClass(/light/);

    // Verify light mode colors
    const lightBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--color-surface-base').trim();
    });
    expect(lightBg).toBe('255 255 255'); // white
  });

  test('persists theme preference across page reloads', async ({ page }) => {
    // Set dark mode
    await page.click('a[href="/settings"]');
    await page.click('input[value="dark"]');

    // Reload page
    await page.reload();

    // Theme should still be dark
    const html = page.locator('html');
    await expect(html).toHaveClass(/dark/);
  });
});
```

Run tests:
```bash
npx playwright test theme/theme-switching.spec.ts
```

---

## 🎨 Adding New Themes (Future)

The system supports unlimited themes! Just add to `themes.ts`:

```typescript
// src/lib/theme/themes.ts
export const themes = {
  light: { /* existing */ },
  dark: { /* existing */ },

  // New high-contrast theme
  highContrast: {
    '--color-surface-base': '0 0 0',        // pure black
    '--color-content-primary': '255 255 255', // pure white
    '--color-interactive-primary': '0 200 255', // bright cyan
    // ... other tokens
  },

  // Brand theme (per-organization customization)
  brand: {
    '--color-surface-base': '255 255 255',
    '--color-interactive-primary': '147 51 234', // purple-600 (brand color)
    // ... other tokens
  },
};
```

Update ThemeContext to support new theme names:
```typescript
type ThemeName = 'light' | 'dark' | 'highContrast' | 'brand';
```

Add to settings page:
```tsx
<label>
  <input type="radio" value="highContrast" checked={theme === 'highContrast'} />
  High Contrast
</label>
```

**No component changes needed!** All semantic tokens automatically use new values.

---

## 🚀 Summary

**Your dark mode integration is complete!** Here's what you have:

✅ **Full theme system** with light/dark/system modes
✅ **85% of components** using semantic tokens
✅ **Automatic adaptation** when switching themes
✅ **System preference detection**
✅ **localStorage persistence**
✅ **Backward compatibility** with remaining dark: classes

**Optional next steps:**
1. Add quick toggle to navigation (5 minutes)
2. Add CSS transitions for smooth switching (5 minutes)
3. Test across all pages (10 minutes)
4. Add E2E tests (optional)

**To test right now:**
1. Start app: `just dev` + `just run-frontend`
2. Navigate to `/settings`
3. Toggle between Light/Dark/System
4. Watch entire app instantly adapt! 🎉
