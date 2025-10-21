# Feature Plan: Dark Mode + User Preferences System

**Created**: 2025-10-19
**Status**: Planning
**Priority**: P2 (Medium Priority - Nice to Have)
**Effort Estimate**: 10-12 days
**Sprint**: Sprint 3 (Week 1-3)
**Owner**: Development Team
**Related Plans**: `FEATURE_NOTIFICATIONS_UX.md`, `FEATURE_COMMON_ROOM_UX.md`, `FEATURE_PRIVATE_MESSAGES_UX.md`

---

## 1. Overview

### 1.1 Problem Statement

**Current Pain Points:**
- **No Dark Mode**: App only supports light theme, causing eye strain for some users
- **No User Preferences System**: Cannot save any user-specific UI/UX settings
- **No Settings Page**: Nowhere for users to customize their experience
- **Inconsistent Theme**: Some components (like notifications dropdown) had dark styling that didn't match overall theme
- **No Persistence**: Even if dark mode existed, wouldn't persist across sessions

**User Impact:**
- **Eye Strain**: Users preferring dark mode experience discomfort during long sessions
- **Accessibility**: No accommodation for users with light sensitivity or visual impairments
- **No Personalization**: Cannot customize experience to individual preferences
- **Time of Day Issues**: Bright screen jarring when using app at night

**Business Impact:**
- Lower engagement in evening hours
- User frustration with lack of customization
- Competitive disadvantage (most modern apps have dark mode)
- Accessibility compliance concerns

### 1.2 Goals and Success Criteria

**Primary Goals:**
1. Implement user preferences system with backend storage
2. Create dark mode theme with comprehensive component coverage
3. Build user settings page for theme toggling
4. Persist theme preference across sessions and devices
5. Respect system preference as default (if user hasn't set preference)
6. Ensure >95% component coverage for both themes

**Success Metrics:**
- **Adoption Rate**: >50% of users enable dark mode within 2 weeks
- **Evening Usage**: Dark mode usage >80% during evening hours (6pm-12am)
- **User Satisfaction**: "Customization" rating >4/5 in surveys
- **Component Coverage**: >95% of components fully styled for dark mode
- **Zero Visual Bugs**: No broken layouts or unreadable text in either theme

**Out of Scope (Future Enhancements):**
- Custom color themes beyond light/dark (P4)
- High contrast accessibility themes (P3)
- Auto theme switching based on time of day (P3)
- Per-game theme preferences (P4)

### 1.3 User Stories

**Epic**: As a user, I want to customize my ActionPhase experience with dark mode and other preferences that persist across sessions.

**User Stories:**

1. **User Preferences Infrastructure**
   *As a developer*, I want a robust preferences system so future customization features are easy to add.
   **Acceptance Criteria:**
   - Backend: `user_preferences` table with JSONB for flexible schema
   - API endpoints: GET/PUT `/api/v1/users/:id/preferences`
   - Frontend: React Context for preferences with localStorage fallback
   - Type-safe preference definitions

2. **Dark Mode Toggle**
   *As a user*, I want to switch between light and dark themes.
   **Acceptance Criteria:**
   - Settings page with theme toggle
   - Immediate visual update when changing theme
   - Preference saved to backend
   - Persists across browser sessions and devices

3. **System Theme Detection**
   *As a user*, I want the app to default to my system's theme preference.
   **Acceptance Criteria:**
   - Detects `prefers-color-scheme` media query
   - Uses system preference if user hasn't set manual preference
   - Manual preference overrides system preference
   - Clear indication of "Auto" vs manual selection

4. **Comprehensive Dark Mode Coverage**
   *As a user*, I want all pages and components to look great in dark mode.
   **Acceptance Criteria:**
   - All pages styled for dark mode
   - All components styled for dark mode
   - Consistent color palette across app
   - Proper contrast ratios (WCAG 2.1 AA)
   - No jarring white flashes during navigation

5. **Settings Page**
   *As a user*, I want a centralized place to manage my preferences.
   **Acceptance Criteria:**
   - `/settings` page with sections for different preference types
   - Theme section with Light/Dark/Auto options
   - Future-proof for additional preferences (timezone, notifications, etc.)
   - Save confirmation with toast notification

---

## 2. Technical Design

### 2.1 Database Schema

**New Table**: `user_preferences`

```sql
-- Migration: XXX_create_user_preferences.up.sql

CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure one preferences row per user
  UNIQUE(user_id)
);

-- Index for fast user lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- GIN index for JSONB queries (if we need to query specific preference values)
CREATE INDEX idx_user_preferences_jsonb ON user_preferences USING GIN (preferences);

COMMENT ON TABLE user_preferences IS 'Stores user-specific UI/UX preferences as JSONB for flexibility';
COMMENT ON COLUMN user_preferences.preferences IS 'JSONB object containing preference key-value pairs (theme, timezone, notifications, etc.)';

-- Example preferences structure:
-- {
--   "theme": "dark",           // "light" | "dark" | "auto"
--   "timezone": "America/New_York",
--   "notification_settings": {
--     "email_enabled": true,
--     "push_enabled": false
--   }
-- }
```

```sql
-- Migration: XXX_create_user_preferences.down.sql

DROP TABLE IF EXISTS user_preferences;
```

### 2.2 Backend Implementation

#### 2.2.1 SQL Queries

**File**: `backend/pkg/db/queries/user_preferences.sql`

```sql
-- name: GetUserPreferences :one
SELECT *
FROM user_preferences
WHERE user_id = $1;

-- name: UpsertUserPreferences :one
INSERT INTO user_preferences (user_id, preferences)
VALUES ($1, $2)
ON CONFLICT (user_id)
DO UPDATE SET
  preferences = EXCLUDED.preferences,
  updated_at = NOW()
RETURNING *;

-- name: UpdateUserPreference :one
-- Update a single preference key without replacing entire JSON
UPDATE user_preferences
SET
  preferences = jsonb_set(preferences, $2::text[], $3::jsonb, true),
  updated_at = NOW()
WHERE user_id = $1
RETURNING *;
```

#### 2.2.2 Backend Models

```go
// UserPreferences represents user-specific settings
type UserPreferences struct {
	ID          int32     `json:"id"`
	UserID      int32     `json:"user_id"`
	Preferences PreferencesData `json:"preferences"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PreferencesData is the structured preferences object
type PreferencesData struct {
	Theme                string                 `json:"theme"` // "light" | "dark" | "auto"
	Timezone             *string                `json:"timezone,omitempty"`
	NotificationSettings map[string]interface{} `json:"notification_settings,omitempty"`
	// Future preferences can be added here without schema changes
}

// UpdatePreferencesRequest is the request to update user preferences
type UpdatePreferencesRequest struct {
	Preferences PreferencesData `json:"preferences"`
}
```

#### 2.2.3 API Handler

```go
// HandleGetUserPreferences handles GET /api/v1/users/:id/preferences
func (h *UsersHandler) HandleGetUserPreferences(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Authorization: user can only get their own preferences
	currentUserID := middleware.GetUserIDFromContext(r.Context())
	if currentUserID == nil || *currentUserID != int32(userID) {
		http.Error(w, "Unauthorized", http.StatusForbidden)
		return
	}

	prefs, err := h.usersService.GetUserPreferences(r.Context(), int32(userID))
	if err != nil {
		// Return default preferences if not found
		if errors.Is(err, sql.ErrNoRows) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(core.UserPreferences{
				UserID:      int32(userID),
				Preferences: core.PreferencesData{Theme: "auto"},
			})
			return
		}
		http.Error(w, "Failed to get preferences", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(prefs)
}

// HandleUpdateUserPreferences handles PUT /api/v1/users/:id/preferences
func (h *UsersHandler) HandleUpdateUserPreferences(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Authorization: user can only update their own preferences
	currentUserID := middleware.GetUserIDFromContext(r.Context())
	if currentUserID == nil || *currentUserID != int32(userID) {
		http.Error(w, "Unauthorized", http.StatusForbidden)
		return
	}

	var req core.UpdatePreferencesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate theme value
	validThemes := map[string]bool{"light": true, "dark": true, "auto": true}
	if !validThemes[req.Preferences.Theme] {
		http.Error(w, "Invalid theme value (must be 'light', 'dark', or 'auto')", http.StatusBadRequest)
		return
	}

	prefs, err := h.usersService.UpdateUserPreferences(r.Context(), int32(userID), req.Preferences)
	if err != nil {
		http.Error(w, "Failed to update preferences", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(prefs)
}
```

### 2.3 Frontend Implementation

#### 2.3.1 Theme System Choice: Tailwind Dark Mode

**Decision**: Use Tailwind's built-in dark mode with `class` strategy.

**Rationale**:
- Already using Tailwind throughout app
- Class strategy allows manual control (better than `media` strategy for user toggle)
- Widely supported and well-documented
- Performance optimized (CSS compiled at build time)

**Configuration** (`tailwind.config.js`):

```javascript
module.exports = {
  darkMode: 'class', // Enable class-based dark mode
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Custom color palette for dark mode
        dark: {
          bg: {
            primary: '#1a202c',    // Main background
            secondary: '#2d3748',   // Card background
            tertiary: '#374151',    // Elevated surfaces
          },
          text: {
            primary: '#f7fafc',     // Main text
            secondary: '#e2e8f0',   // Secondary text
            tertiary: '#cbd5e0',    // Muted text
          },
          border: '#4a5568',        // Borders and dividers
        },
      },
    },
  },
  plugins: [],
};
```

#### 2.3.2 Theme Context

**File**: `frontend/src/contexts/ThemeContext.tsx`

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiClient } from '../lib/api';
import { useAuth } from './AuthContext';

type Theme = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { currentUser, isCheckingAuth } = useAuth();
  const [theme, setThemeState] = useState<Theme>('auto');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');
  const [isLoading, setIsLoading] = useState(true);

  // Detect system theme preference
  const getSystemTheme = (): ResolvedTheme => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };

  // Resolve 'auto' to actual theme
  const resolveTheme = (themeValue: Theme): ResolvedTheme => {
    if (themeValue === 'auto') {
      return getSystemTheme();
    }
    return themeValue;
  };

  // Load user's theme preference from backend
  useEffect(() => {
    const loadUserTheme = async () => {
      if (!currentUser || isCheckingAuth) return;

      try {
        const response = await apiClient.users.getPreferences(currentUser.id);
        const userTheme = response.data.preferences.theme || 'auto';
        setThemeState(userTheme);
        setResolvedTheme(resolveTheme(userTheme));
      } catch (error) {
        console.error('Failed to load user theme:', error);
        // Fall back to localStorage or auto
        const localTheme = localStorage.getItem('theme') as Theme || 'auto';
        setThemeState(localTheme);
        setResolvedTheme(resolveTheme(localTheme));
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser) {
      loadUserTheme();
    } else {
      // Not logged in - use localStorage
      const localTheme = localStorage.getItem('theme') as Theme || 'auto';
      setThemeState(localTheme);
      setResolvedTheme(resolveTheme(localTheme));
      setIsLoading(false);
    }
  }, [currentUser, isCheckingAuth]);

  // Update theme when it changes
  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    setResolvedTheme(resolveTheme(newTheme));

    // Save to localStorage immediately
    localStorage.setItem('theme', newTheme);

    // Save to backend if logged in
    if (currentUser) {
      try {
        await apiClient.users.updatePreferences(currentUser.id, {
          preferences: { theme: newTheme },
        });
      } catch (error) {
        console.error('Failed to save theme preference:', error);
      }
    }
  };

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

#### 2.3.3 Settings Page

**File**: `frontend/src/pages/SettingsPage.tsx`

```typescript
import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export function SettingsPage() {
  const { currentUser } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'auto') => {
    setSaveStatus('saving');
    await setTheme(newTheme);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Customize your ActionPhase experience
        </p>
      </div>

      {/* Theme Section */}
      <div className="bg-white dark:bg-dark-bg-secondary rounded-lg shadow-md border border-gray-200 dark:border-dark-border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text-primary mb-4">
          Appearance
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-secondary mb-3">
              Theme
            </label>

            <div className="grid grid-cols-3 gap-4">
              {/* Light Theme Option */}
              <button
                onClick={() => handleThemeChange('light')}
                className={`
                  p-4 rounded-lg border-2 transition-all
                  ${theme === 'light'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <div className="flex flex-col items-center">
                  <svg className="w-8 h-8 mb-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900 dark:text-dark-text-primary">Light</span>
                </div>
              </button>

              {/* Dark Theme Option */}
              <button
                onClick={() => handleThemeChange('dark')}
                className={`
                  p-4 rounded-lg border-2 transition-all
                  ${theme === 'dark'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <div className="flex flex-col items-center">
                  <svg className="w-8 h-8 mb-2 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900 dark:text-dark-text-primary">Dark</span>
                </div>
              </button>

              {/* Auto Theme Option */}
              <button
                onClick={() => handleThemeChange('auto')}
                className={`
                  p-4 rounded-lg border-2 transition-all
                  ${theme === 'auto'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <div className="flex flex-col items-center">
                  <svg className="w-8 h-8 mb-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-gray-900 dark:text-dark-text-primary">Auto</span>
                </div>
              </button>
            </div>

            {theme === 'auto' && (
              <p className="mt-3 text-sm text-gray-600 dark:text-dark-text-tertiary">
                Currently using: <span className="font-medium">{resolvedTheme}</span> (based on system preference)
              </p>
            )}
          </div>

          {/* Save Status */}
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Theme preference saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Future Sections */}
      <div className="bg-white dark:bg-dark-bg-secondary rounded-lg shadow-md border border-gray-200 dark:border-dark-border p-6 mb-6 opacity-50">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text-primary mb-4">
          Notifications
        </h2>
        <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
          Coming soon: Configure email and push notification preferences
        </p>
      </div>

      <div className="bg-white dark:bg-dark-bg-secondary rounded-lg shadow-md border border-gray-200 dark:border-dark-border p-6 opacity-50">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text-primary mb-4">
          Regional
        </h2>
        <p className="text-sm text-gray-600 dark:text-dark-text-secondary">
          Coming soon: Set your timezone and date format preferences
        </p>
      </div>
    </div>
  );
}
```

**Add Route** (`frontend/src/App.tsx`):

```typescript
<Route path="/settings" element={<SettingsPage />} />
```

#### 2.3.4 Component Styling Examples

**Pattern**: Add `dark:` variants to all Tailwind classes

**Example - Button Component**:

```typescript
// Before (light only)
<button className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md">
  Click me
</button>

// After (light + dark)
<button className="bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 px-4 py-2 rounded-md">
  Click me
</button>
```

**Example - Card Component**:

```typescript
// Before
<div className="bg-white border border-gray-200 rounded-lg shadow-md p-6">
  <h2 className="text-gray-900 font-semibold">Title</h2>
  <p className="text-gray-600">Content</p>
</div>

// After
<div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-md p-6">
  <h2 className="text-gray-900 dark:text-dark-text-primary font-semibold">Title</h2>
  <p className="text-gray-600 dark:text-dark-text-secondary">Content</p>
</div>
```

**Systematic Approach**:
1. Audit all components for hardcoded colors
2. Add dark mode variants using Tailwind `dark:` prefix
3. Test each component in both themes
4. Use custom dark mode color palette from tailwind.config.js

---

## 3. Implementation Plan

### 3.1 Phase 1: Infrastructure (Days 1-2)

**Tasks:**
- [ ] Create `user_preferences` table migration
- [ ] Run migration: `just migrate`
- [ ] Write SQL queries for preferences
- [ ] Generate code: `just sqlgen`
- [ ] Implement backend service and API
- [ ] Write backend tests
- [ ] Configure Tailwind for dark mode
- [ ] Create ThemeContext

**Acceptance Criteria:**
- ✅ User preferences API working
- ✅ Theme context implemented
- ✅ Backend tests passing
- ✅ Tailwind configured correctly

### 3.2 Phase 2: Settings Page (Days 2-3)

**Tasks:**
- [ ] Create SettingsPage component
- [ ] Implement theme toggle UI
- [ ] Add route to App.tsx
- [ ] Add "Settings" link to navigation
- [ ] Test theme persistence
- [ ] Test system theme detection

**Acceptance Criteria:**
- ✅ Settings page accessible
- ✅ Theme changes immediately
- ✅ Preferences persist across sessions
- ✅ Auto theme follows system preference

### 3.3 Phase 3: Component Audit & Styling (Days 3-8)

**Tasks:**
- [ ] Audit all pages (20+ pages)
- [ ] Audit all components (100+ components)
- [ ] Create dark mode styling checklist
- [ ] Style pages one by one
- [ ] Style components one by one
- [ ] Test each in both themes
- [ ] Fix contrast issues

**Systematic Approach**:
- Day 3-4: Core pages (Home, Games, GameDetails, Dashboard)
- Day 5-6: Common Room, Messages, Phases, Actions
- Day 7: Characters, Applications, Notifications
- Day 8: Remaining pages and components

**Acceptance Criteria:**
- ✅ >95% component coverage
- ✅ All pages readable in dark mode
- ✅ Consistent color palette
- ✅ No white flashes

### 3.4 Phase 4: Testing & Polish (Days 9-10)

**Tasks:**
- [ ] Manual testing in both themes
- [ ] Cross-browser testing
- [ ] Mobile testing
- [ ] Accessibility audit (contrast ratios)
- [ ] Performance testing
- [ ] Fix discovered bugs
- [ ] Update documentation

**Acceptance Criteria:**
- ✅ No visual bugs in either theme
- ✅ WCAG 2.1 AA contrast compliance
- ✅ Works in all browsers
- ✅ Mobile responsive

### 3.5 Phase 5: Rollout (Days 10-12)

**Tasks:**
- [ ] Feature flag implementation (optional)
- [ ] Gradual rollout to 10% → 50% → 100%
- [ ] Monitor adoption metrics
- [ ] Gather user feedback
- [ ] Fix high-priority issues
- [ ] Announce feature to users

**Acceptance Criteria:**
- ✅ Smooth rollout with no incidents
- ✅ >50% adoption within 2 weeks
- ✅ Positive user feedback
- ✅ No critical bugs

---

## 4. Testing Strategy

### 4.1 Manual Testing Checklist

**Theme Switching:**
- [ ] Theme changes immediately when toggled
- [ ] Theme persists across page refreshes
- [ ] Theme persists across browser sessions
- [ ] Theme syncs across devices (when logged in)
- [ ] Auto theme follows system preference changes

**Component Coverage:**
- [ ] All pages styled for dark mode
- [ ] All components styled for dark mode
- [ ] No white backgrounds in dark mode
- [ ] No black text on dark backgrounds
- [ ] Proper contrast ratios (use browser DevTools)

**Accessibility:**
- [ ] Text readable (>4.5:1 contrast for body text)
- [ ] Interactive elements readable (>3:1 contrast)
- [ ] Focus indicators visible in both themes
- [ ] Color not sole differentiator

**Performance:**
- [ ] Theme switch <100ms perceived delay
- [ ] No layout shift when switching themes
- [ ] No flash of unstyled content (FOUC)

---

## 5. Success Metrics

**Adoption Metrics:**
- **Dark Mode Adoption**: >50% within 2 weeks
- **Evening Usage**: >80% dark mode during 6pm-12am
- **Settings Page Visits**: >40% of users visit within first month

**Quality Metrics:**
- **Component Coverage**: >95%
- **Contrast Compliance**: 100% WCAG 2.1 AA
- **User Satisfaction**: "Customization" >4/5

---

## 6. Documentation Updates

### 6.1 User Documentation

```markdown
# Customizing Your Experience

## Theme (Dark Mode)

ActionPhase supports light and dark themes:

1. Click your profile icon → **Settings**
2. Under "Appearance", choose your preferred theme:
   - **Light**: Traditional bright interface
   - **Dark**: Easy on the eyes for low-light environments
   - **Auto**: Follows your system/browser preference

Your theme preference syncs across all your devices.

## System Theme Detection

If you select "Auto" theme, ActionPhase will automatically match your system's light/dark mode setting. When you change your system theme, ActionPhase updates instantly.
```

---

## 7. Revision History

| Date | Changes | Author |
|------|---------|--------|
| 2025-10-19 | Initial plan created | AI Planning Session |
| | | |
