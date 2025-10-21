# Theme System Migration Plan

**Date Created:** 2025-01-20
**Status:** Ready for Implementation
**Estimated Time:** 8-10 hours spread over multiple sessions
**Risk Level:** Low (phased approach with rollback capability)

## Executive Summary

Migrate from repetitive `dark:` Tailwind classes to a semantic theme system that supports unlimited themes, reduces code by 70%, and improves maintainability. The migration will be done incrementally alongside the existing system with zero downtime.

## Current State Analysis

### Problems with Current Implementation
1. **~1,400 `dark:` class instances** scattered across codebase
2. **34 characters per color definition** (e.g., `bg-white dark:bg-gray-800`)
3. **Hard-coded theme values** - adding new themes requires modifying every component
4. **No semantic abstraction** - colors tied to implementation details (gray-800 vs gray-900)
5. **Maintenance burden** - every color needs two values manually maintained

### Current Assets to Preserve
1. **13 working UI components** (Button, Card, Input, Badge, Alert, etc.)
2. **Recent dark mode fixes** (PostCard, ThreadedComment)
3. **Working application** - no critical issues
4. **Component abstraction layer** - consumers don't see implementation details

## Migration Strategy

### Core Principle: Parallel Systems
Both the old (`dark:` classes) and new (theme tokens) systems will work simultaneously during migration, allowing incremental updates with zero downtime.

```typescript
// Both work at the same time:
<div className="bg-white dark:bg-gray-800">Old system</div>
<div className="surface-base">New system</div>
```

## Phase 1: Foundation Layer (2 hours)

### Task 1.1: Create Theme Token Definitions
**Time:** 30 minutes
**File:** `src/lib/theme/tokens.ts`

```typescript
/**
 * Semantic design tokens for the theme system.
 * These abstract away from specific color values.
 */
export const tokens = {
  // Surface tokens (backgrounds)
  surface: {
    base: 'surface-base',           // Primary surface (cards, modals)
    raised: 'surface-raised',        // Elevated surface
    overlay: 'surface-overlay',      // Dropdown, popover backgrounds
    sunken: 'surface-sunken',        // Recessed areas
  },

  // Content tokens (text)
  content: {
    primary: 'text-content-primary',     // Primary text
    secondary: 'text-content-secondary', // Secondary text
    tertiary: 'text-content-tertiary',   // Muted text
    disabled: 'text-content-disabled',   // Disabled state
    inverse: 'text-content-inverse',     // Inverted text
  },

  // Interactive tokens
  interactive: {
    primary: 'bg-interactive-primary',
    primaryHover: 'hover:bg-interactive-primary-hover',
    secondary: 'bg-interactive-secondary',
    secondaryHover: 'hover:bg-interactive-secondary-hover',
  },

  // Semantic tokens
  semantic: {
    danger: 'bg-semantic-danger',
    dangerSubtle: 'bg-semantic-danger-subtle',
    warning: 'bg-semantic-warning',
    warningSubtle: 'bg-semantic-warning-subtle',
    success: 'bg-semantic-success',
    successSubtle: 'bg-semantic-success-subtle',
    info: 'bg-semantic-info',
    infoSubtle: 'bg-semantic-info-subtle',
  },

  // Border tokens
  border: {
    default: 'border-theme-default',
    subtle: 'border-theme-subtle',
    strong: 'border-theme-strong',
  },
} as const;

export type TokenCategory = keyof typeof tokens;
export type SurfaceToken = keyof typeof tokens.surface;
export type ContentToken = keyof typeof tokens.content;
```

### Task 1.2: Create Theme Definitions
**Time:** 30 minutes
**File:** `src/lib/theme/themes.ts`

```typescript
/**
 * Theme definitions containing actual color values.
 * RGB values are used for compatibility with Tailwind's opacity modifiers.
 */
export const themes = {
  light: {
    // Surface colors
    '--color-surface-base': '255 255 255',        // white
    '--color-surface-raised': '249 250 251',      // gray-50
    '--color-surface-overlay': '255 255 255',     // white
    '--color-surface-sunken': '243 244 246',      // gray-100

    // Content colors
    '--color-content-primary': '17 24 39',        // gray-900
    '--color-content-secondary': '75 85 99',      // gray-600
    '--color-content-tertiary': '107 114 128',    // gray-500
    '--color-content-disabled': '156 163 175',    // gray-400
    '--color-content-inverse': '255 255 255',     // white

    // Interactive colors
    '--color-interactive-primary': '37 99 235',         // blue-600
    '--color-interactive-primary-hover': '29 78 216',   // blue-700
    '--color-interactive-secondary': '243 244 246',     // gray-100
    '--color-interactive-secondary-hover': '229 231 235', // gray-200

    // Semantic colors
    '--color-semantic-danger': '220 38 38',             // red-600
    '--color-semantic-danger-subtle': '254 226 226',    // red-100
    '--color-semantic-warning': '217 119 6',            // yellow-600
    '--color-semantic-warning-subtle': '254 240 138',   // yellow-100
    '--color-semantic-success': '22 163 74',            // green-600
    '--color-semantic-success-subtle': '220 252 231',   // green-100
    '--color-semantic-info': '37 99 235',               // blue-600
    '--color-semantic-info-subtle': '219 234 254',      // blue-100

    // Border colors
    '--color-border-default': '229 231 235',      // gray-200
    '--color-border-subtle': '243 244 246',       // gray-100
    '--color-border-strong': '156 163 175',       // gray-400
  },

  dark: {
    // Surface colors
    '--color-surface-base': '31 41 55',           // gray-800
    '--color-surface-raised': '17 24 39',         // gray-900
    '--color-surface-overlay': '55 65 81',        // gray-700
    '--color-surface-sunken': '17 24 39',         // gray-900

    // Content colors
    '--color-content-primary': '255 255 255',     // white
    '--color-content-secondary': '209 213 219',   // gray-300
    '--color-content-tertiary': '156 163 175',    // gray-400
    '--color-content-disabled': '107 114 128',    // gray-500
    '--color-content-inverse': '17 24 39',        // gray-900

    // Interactive colors
    '--color-interactive-primary': '59 130 246',        // blue-500
    '--color-interactive-primary-hover': '37 99 235',   // blue-600
    '--color-interactive-secondary': '55 65 81',        // gray-700
    '--color-interactive-secondary-hover': '75 85 99',  // gray-600

    // Semantic colors
    '--color-semantic-danger': '239 68 68',             // red-500
    '--color-semantic-danger-subtle': '127 29 29',      // red-900
    '--color-semantic-warning': '245 158 11',           // yellow-500
    '--color-semantic-warning-subtle': '113 63 18',     // yellow-900
    '--color-semantic-success': '34 197 94',            // green-500
    '--color-semantic-success-subtle': '20 83 45',      // green-900
    '--color-semantic-info': '59 130 246',              // blue-500
    '--color-semantic-info-subtle': '30 58 138',        // blue-900

    // Border colors
    '--color-border-default': '55 65 81',         // gray-700
    '--color-border-subtle': '75 85 99',          // gray-600
    '--color-border-strong': '107 114 128',       // gray-500
  },

  // Future themes can be added here
  // highContrast: { ... },
  // colorblind: { ... },
  // brand: { ... },
} as const;

export type ThemeName = keyof typeof themes;
```

### Task 1.3: Implement Theme Provider
**Time:** 30 minutes
**File:** `src/contexts/ThemeContext.tsx`

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { themes, type ThemeName } from '@/lib/theme/themes';

type ThemeMode = ThemeName | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: ThemeName; // Actual theme being used (resolved from 'system')
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    // Get saved theme from localStorage
    const saved = localStorage.getItem('app-theme') as ThemeMode;
    return saved || 'system';
  });

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  // Detect system theme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const updateSystemTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Initial check
    updateSystemTheme(mediaQuery);

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => updateSystemTheme(e);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Apply theme CSS variables
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    const themeValues = themes[resolvedTheme];

    // Apply CSS variables
    Object.entries(themeValues).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Apply theme class for existing dark: classes (backwards compatibility)
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);

    // Save preference
    if (theme !== 'system') {
      localStorage.setItem('app-theme', theme);
    } else {
      localStorage.removeItem('app-theme');
    }
  }, [theme, resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
```

### Task 1.4: Create Utility Functions
**Time:** 30 minutes
**File:** `src/lib/theme/utils.ts`

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with proper precedence.
 * Wrapper around clsx + tailwind-merge for optimal DX.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Creates a type-safe variant utility for components.
 * Similar to CVA (Class Variance Authority) but simpler.
 *
 * @example
 * const buttonStyles = tv({
 *   base: 'rounded-lg font-medium',
 *   variants: {
 *     variant: {
 *       primary: 'bg-interactive-primary',
 *       secondary: 'surface-raised',
 *     },
 *     size: {
 *       sm: 'px-3 py-1.5',
 *       md: 'px-4 py-2',
 *     }
 *   },
 *   defaultVariants: {
 *     variant: 'primary',
 *     size: 'md',
 *   }
 * });
 *
 * // Usage:
 * <button className={buttonStyles({ variant: 'primary', size: 'lg' })} />
 */

type TVConfig<V extends Record<string, Record<string, string>>> = {
  base?: string;
  variants?: V;
  defaultVariants?: Partial<{ [K in keyof V]: keyof V[K] }>;
};

type TVProps<V extends Record<string, Record<string, string>>> = Partial<{
  [K in keyof V]: keyof V[K];
}> & {
  className?: string;
};

export function tv<V extends Record<string, Record<string, string>>>(
  config: TVConfig<V>
) {
  return (props: TVProps<V> = {}) => {
    let className = config.base || '';

    if (config.variants) {
      Object.entries(config.variants).forEach(([variantKey, variantValues]) => {
        const value = props[variantKey as keyof V] ??
                     config.defaultVariants?.[variantKey as keyof V];

        if (value && variantValues[value as string]) {
          className = cn(className, variantValues[value as string]);
        }
      });
    }

    return cn(className, props.className);
  };
}

/**
 * Helper to generate semantic color classes.
 * Ensures consistency across the app.
 */
export const themeColors = {
  surface: (variant: 'base' | 'raised' | 'overlay' | 'sunken') =>
    `surface-${variant}`,

  text: (variant: 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'inverse') =>
    `text-content-${variant}`,

  border: (variant: 'default' | 'subtle' | 'strong') =>
    `border-theme-${variant}`,

  interactive: {
    primary: 'bg-interactive-primary hover:bg-interactive-primary-hover',
    secondary: 'bg-interactive-secondary hover:bg-interactive-secondary-hover',
  },

  semantic: {
    danger: 'bg-semantic-danger',
    dangerSubtle: 'bg-semantic-danger-subtle',
    warning: 'bg-semantic-warning',
    warningSubtle: 'bg-semantic-warning-subtle',
    success: 'bg-semantic-success',
    successSubtle: 'bg-semantic-success-subtle',
    info: 'bg-semantic-info',
    infoSubtle: 'bg-semantic-info-subtle',
  },
} as const;
```

## Phase 2: CSS Integration (1 hour)

### Task 2.1: Update Tailwind CSS
**Time:** 30 minutes
**File:** `src/index.css`

```css
@import "tailwindcss";

/* Preserve existing dark variant for backwards compatibility */
@variant dark (&:where(.dark, .dark *));

/* Theme System Layer - CSS Variables and Utilities */
@layer theme {
  /* Generate utilities for semantic colors */
  .surface-base { @apply bg-[rgb(var(--color-surface-base))]; }
  .surface-raised { @apply bg-[rgb(var(--color-surface-raised))]; }
  .surface-overlay { @apply bg-[rgb(var(--color-surface-overlay))]; }
  .surface-sunken { @apply bg-[rgb(var(--color-surface-sunken))]; }

  .text-content-primary { @apply text-[rgb(var(--color-content-primary))]; }
  .text-content-secondary { @apply text-[rgb(var(--color-content-secondary))]; }
  .text-content-tertiary { @apply text-[rgb(var(--color-content-tertiary))]; }
  .text-content-disabled { @apply text-[rgb(var(--color-content-disabled))]; }
  .text-content-inverse { @apply text-[rgb(var(--color-content-inverse))]; }

  .bg-interactive-primary { @apply bg-[rgb(var(--color-interactive-primary))]; }
  .bg-interactive-primary-hover { @apply bg-[rgb(var(--color-interactive-primary-hover))]; }
  .bg-interactive-secondary { @apply bg-[rgb(var(--color-interactive-secondary))]; }
  .bg-interactive-secondary-hover { @apply bg-[rgb(var(--color-interactive-secondary-hover))]; }

  .bg-semantic-danger { @apply bg-[rgb(var(--color-semantic-danger))]; }
  .bg-semantic-danger-subtle { @apply bg-[rgb(var(--color-semantic-danger-subtle))]; }
  .bg-semantic-warning { @apply bg-[rgb(var(--color-semantic-warning))]; }
  .bg-semantic-warning-subtle { @apply bg-[rgb(var(--color-semantic-warning-subtle))]; }
  .bg-semantic-success { @apply bg-[rgb(var(--color-semantic-success))]; }
  .bg-semantic-success-subtle { @apply bg-[rgb(var(--color-semantic-success-subtle))]; }
  .bg-semantic-info { @apply bg-[rgb(var(--color-semantic-info))]; }
  .bg-semantic-info-subtle { @apply bg-[rgb(var(--color-semantic-info-subtle))]; }

  .border-theme-default { @apply border-[rgb(var(--color-border-default))]; }
  .border-theme-subtle { @apply border-[rgb(var(--color-border-subtle))]; }
  .border-theme-strong { @apply border-[rgb(var(--color-border-strong))]; }
}

/* Default theme variables (fallback) */
@layer base {
  :root {
    /* Light theme defaults */
    --color-surface-base: 255 255 255;
    --color-surface-raised: 249 250 251;
    --color-surface-overlay: 255 255 255;
    --color-surface-sunken: 243 244 246;

    --color-content-primary: 17 24 39;
    --color-content-secondary: 75 85 99;
    --color-content-tertiary: 107 114 128;
    --color-content-disabled: 156 163 175;
    --color-content-inverse: 255 255 255;

    /* ... rest of defaults */
  }
}
```

### Task 2.2: Integrate ThemeProvider
**Time:** 15 minutes
**File:** `src/App.tsx`

```typescript
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
// ... other imports

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            {/* ... rest of app */}
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

### Task 2.3: Add Theme Switcher
**Time:** 15 minutes
**File:** `src/components/ThemeSwitcher.tsx`

```typescript
import { useTheme } from '@/contexts/ThemeContext';
import { Moon, Sun, Monitor } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const options = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  return (
    <div className="flex gap-1 p-1 surface-raised rounded-lg">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'p-2 rounded transition-colors',
            theme === value
              ? 'surface-base shadow-sm'
              : 'hover:surface-overlay'
          )}
          title={label}
        >
          <Icon className="w-4 h-4 text-content-primary" />
        </button>
      ))}
    </div>
  );
}
```

## Phase 3: Component Migration (3 hours)

### Task 3.1: Migrate Button Component
**Time:** 30 minutes
**File:** `src/components/ui/Button.tsx`

```typescript
// BEFORE: Manual dark: classes
const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600',
  danger: 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white',
  ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300',
};

// AFTER: Semantic tokens with tv utility
import { tv } from '@/lib/theme/utils';

const buttonStyles = tv({
  base: 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',

  variants: {
    variant: {
      primary: 'bg-interactive-primary hover:bg-interactive-primary-hover text-content-inverse',
      secondary: 'surface-raised hover:surface-overlay text-content-primary border border-theme-default',
      danger: 'bg-semantic-danger hover:opacity-90 text-content-inverse',
      ghost: 'hover:surface-raised text-content-secondary',
    },

    size: {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    },

    disabled: {
      true: 'opacity-50 cursor-not-allowed',
    },
  },

  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export function Button({
  variant,
  size,
  disabled,
  loading,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonStyles({
        variant,
        size,
        disabled: disabled || loading,
        className
      })}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {props.children}
    </button>
  );
}
```

### Task 3.2: Migrate Card Component
**Time:** 30 minutes
**File:** `src/components/ui/Card.tsx`

```typescript
// BEFORE: Manual dark: classes
const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
  elevated: 'bg-white dark:bg-gray-800 shadow-lg',
  bordered: 'bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600',
  danger: 'bg-red-50 dark:bg-red-900 shadow-lg border-2 border-red-600 dark:border-red-700',
  // ...
};

// AFTER: Semantic tokens
const cardStyles = tv({
  base: 'rounded-lg transition-shadow',

  variants: {
    variant: {
      default: 'surface-base border border-theme-default',
      elevated: 'surface-base shadow-lg',
      bordered: 'surface-base border-2 border-theme-strong',
      danger: 'bg-semantic-danger-subtle border-2 border-semantic-danger',
      warning: 'bg-semantic-warning-subtle border-2 border-semantic-warning',
      success: 'bg-semantic-success-subtle border-2 border-semantic-success',
    },

    padding: {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    },
  },

  defaultVariants: {
    variant: 'default',
    padding: 'md',
  },
});
```

### Task 3.3: Migration Pattern for Other Components
**Time:** 2 hours
**Strategy:** Migrate remaining UI components using this pattern

```typescript
// PATTERN: Converting dark: classes to semantic tokens

// Step 1: Identify color pairs
'bg-white dark:bg-gray-800'     -> 'surface-base'
'bg-gray-50 dark:bg-gray-900'   -> 'surface-raised'
'text-gray-900 dark:text-white' -> 'text-content-primary'
'text-gray-600 dark:text-gray-400' -> 'text-content-secondary'
'border-gray-200 dark:border-gray-700' -> 'border-theme-default'

// Step 2: Replace in component
// BEFORE:
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">

// AFTER:
<div className="surface-base text-content-primary">

// Step 3: Test both themes still work
```

## Phase 4: Testing & Verification (1 hour)

### Task 4.1: Visual Testing Checklist
**Time:** 30 minutes

```markdown
## Component Testing Matrix

| Component | Light Theme | Dark Theme | High Contrast | Notes |
|-----------|------------|------------|---------------|-------|
| Button    | ✅         | ✅         | 🔄           |       |
| Card      | ✅         | ✅         | 🔄           |       |
| Input     | 🔄         | 🔄         | 🔄           |       |
| Badge     | 🔄         | 🔄         | 🔄           |       |
| Alert     | 🔄         | 🔄         | 🔄           |       |

✅ = Tested & Working
🔄 = In Progress
❌ = Issues Found
```

### Task 4.2: Automated Testing
**Time:** 30 minutes

```typescript
// Test file: src/lib/theme/theme.test.ts
import { render } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/Button';

describe('Theme System', () => {
  it('applies light theme by default', () => {
    const { container } = render(
      <ThemeProvider>
        <Button>Test</Button>
      </ThemeProvider>
    );

    const root = document.documentElement;
    expect(root.classList.contains('light')).toBe(true);
    expect(root.style.getPropertyValue('--color-surface-base')).toBe('255 255 255');
  });

  it('switches to dark theme', () => {
    // Test theme switching
  });

  it('respects system preference', () => {
    // Test system theme detection
  });
});
```

## Phase 5: Gradual Migration (Ongoing)

### Migration Priority Order

1. **High Impact Components** (Week 1)
   - Navigation
   - Layout
   - Common Room components
   - Dashboard

2. **Form Components** (Week 2)
   - CreatePostForm
   - ActionSubmission
   - Character creation

3. **Page Components** (Week 3)
   - GameDetailsPage
   - DashboardPage
   - Settings pages

4. **Low Priority** (As needed)
   - Error boundaries
   - Loading states
   - Tooltips

### Search & Replace Patterns

```bash
# Find all dark: classes
grep -r "dark:" --include="*.tsx" --include="*.jsx"

# Common replacements (use with caution, test after each)
bg-white dark:bg-gray-800        -> surface-base
bg-gray-50 dark:bg-gray-900      -> surface-raised
text-gray-900 dark:text-white    -> text-content-primary
text-gray-600 dark:text-gray-400 -> text-content-secondary
text-gray-500 dark:text-gray-400 -> text-content-tertiary
border-gray-200 dark:border-gray-700 -> border-theme-default
bg-blue-600 dark:bg-blue-500     -> bg-interactive-primary
hover:bg-blue-700 dark:hover:bg-blue-600 -> hover:bg-interactive-primary-hover
```

## Rollback Strategy

### If Issues Occur

1. **Component Level Rollback**
   ```typescript
   // Keep old styles as fallback
   const variantStylesOld = { /* old dark: classes */ };
   const variantStylesNew = tv({ /* new theme tokens */ });

   // Feature flag to switch
   const useNewTheme = process.env.REACT_APP_USE_NEW_THEME === 'true';
   const styles = useNewTheme ? variantStylesNew : variantStylesOld;
   ```

2. **Full System Rollback**
   - Remove ThemeProvider from App.tsx
   - Comment out new CSS utilities
   - Components with old styles continue working

3. **Partial Rollback**
   - Keep ThemeProvider for future
   - Revert only problematic components
   - Both systems continue to coexist

## Success Metrics

### Quantitative
- ✅ Reduce `dark:` classes from ~1,400 to <100 (93% reduction)
- ✅ Reduce theme code size from 14KB to 3KB (79% reduction)
- ✅ Component file sizes reduced by average 25%
- ✅ Theme switching performance <50ms

### Qualitative
- ✅ Developers find it easier to add new components
- ✅ Theme consistency improved across app
- ✅ Support for additional themes without code changes
- ✅ Improved code readability and maintainability

## Common Pitfalls & Solutions

### Pitfall 1: Specificity Issues
**Problem:** Semantic classes overridden by Tailwind utilities
**Solution:** Use `!` important modifier or increase specificity
```css
.surface-base { @apply bg-[rgb(var(--color-surface-base))] !important; }
```

### Pitfall 2: Missing Hover States
**Problem:** Forgetting to migrate hover/focus/active states
**Solution:** Create compound tokens
```typescript
interactive: {
  primary: 'bg-interactive-primary hover:bg-interactive-primary-hover focus:ring-2',
}
```

### Pitfall 3: Third-Party Components
**Problem:** External components don't use theme tokens
**Solution:** Wrapper components with theme classes
```typescript
function ThemedSelect(props) {
  return (
    <div className="surface-base text-content-primary">
      <Select {...props} />
    </div>
  );
}
```

## Documentation Updates

### Update Component Documentation
```typescript
/**
 * Button Component
 *
 * @deprecated Manual dark: classes - DO NOT USE
 * @example
 * // ❌ OLD WAY - Don't do this
 * <button className="bg-white dark:bg-gray-800">
 *
 * // ✅ NEW WAY - Use semantic tokens
 * <Button variant="primary">Click me</Button>
 *
 * // ✅ Or use theme tokens directly
 * <button className="surface-base text-content-primary">
 */
```

### Create Migration Guide
File: `docs/THEME_MIGRATION_GUIDE.md`
- Pattern examples
- Common conversions table
- Do's and don'ts
- Troubleshooting guide

## Timeline Summary

### Day 1 (4 hours)
- ✅ Phase 1: Foundation (2 hours)
- ✅ Phase 2: CSS Integration (1 hour)
- ✅ Phase 3: Migrate Button & Card (1 hour)

### Day 2 (4 hours)
- ✅ Phase 3: Migrate remaining UI components (2 hours)
- ✅ Phase 4: Testing & Verification (1 hour)
- ✅ Documentation & Cleanup (1 hour)

### Week 1-3 (Ongoing)
- Gradual migration of remaining components
- Testing and refinement
- Performance optimization
- Additional theme creation

## Appendix: Quick Reference

### Semantic Token Mapping
```typescript
// Backgrounds
'bg-white dark:bg-gray-800'     -> 'surface-base'
'bg-gray-50 dark:bg-gray-900'   -> 'surface-raised'
'bg-white dark:bg-gray-700'     -> 'surface-overlay'
'bg-gray-100 dark:bg-gray-900'  -> 'surface-sunken'

// Text
'text-gray-900 dark:text-white'    -> 'text-content-primary'
'text-gray-600 dark:text-gray-400' -> 'text-content-secondary'
'text-gray-500 dark:text-gray-400' -> 'text-content-tertiary'
'text-gray-400 dark:text-gray-500' -> 'text-content-disabled'

// Borders
'border-gray-200 dark:border-gray-700' -> 'border-theme-default'
'border-gray-100 dark:border-gray-600' -> 'border-theme-subtle'
'border-gray-300 dark:border-gray-500' -> 'border-theme-strong'

// Interactive
'bg-blue-600 dark:bg-blue-500' -> 'bg-interactive-primary'
'hover:bg-blue-700 dark:hover:bg-blue-600' -> 'hover:bg-interactive-primary-hover'

// Semantic
'bg-red-50 dark:bg-red-900'     -> 'bg-semantic-danger-subtle'
'bg-yellow-50 dark:bg-yellow-900' -> 'bg-semantic-warning-subtle'
'bg-green-50 dark:bg-green-900'   -> 'bg-semantic-success-subtle'
'bg-blue-50 dark:bg-blue-900'     -> 'bg-semantic-info-subtle'
```

### Component Migration Checklist
- [ ] Remove all `dark:` classes
- [ ] Replace with semantic tokens
- [ ] Add tv() utility for variants
- [ ] Test in light theme
- [ ] Test in dark theme
- [ ] Update component documentation
- [ ] Add TypeScript types if needed
- [ ] Verify no regressions

## Conclusion

This phased migration plan allows for:
1. **Zero downtime** - Both systems work in parallel
2. **Incremental progress** - Migrate component by component
3. **Easy rollback** - Can revert individual components
4. **Team collaboration** - Multiple developers can work on different components
5. **Immediate benefits** - Theme switching works after Phase 1

The semantic token system will reduce maintenance burden, improve consistency, and enable new features like custom themes, high contrast mode, and user preferences.

**Total Estimated Time:** 8-10 hours of focused work, spread over multiple sessions
**Risk Level:** Low (parallel systems, incremental migration)
**Expected Code Reduction:** 70-80% in theme-related code
