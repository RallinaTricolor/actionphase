# Journey Test Fixture Requirements

This document maps each journey test to its required fixture game state.

## Fixture Games Needed

### 1. Action Phase Journey Game
**Purpose**: `action-phase-workflow.spec.ts`
**Required State**:
- Game ID: 200 (E2E dedicated)
- State: `in_progress`
- Active phase: `action` type
- Phase deadline: 24 hours in future
- Characters: 4 player characters (one per test player)
- Pre-existing submissions: Player 1 has submitted action, Player 2 has draft

**Tests Using This**:
- Player can view action submission form
- Form shows validation states
- Player can view existing action
- Phase deadline is displayed
- Character selection available

---

### 2. Messaging Journey Game
**Purpose**: `messaging.spec.ts`
**Required State**:
- Game ID: 400 (E2E dedicated)
- State: `in_progress`
- Features: Conversations enabled, Posts enabled
- Pre-existing data:
  - 3 posts in common room (from GM and players)
  - 2 existing conversations (GM-Player1, Player1-Player2)
  - Notifications enabled

**Tests Using This**:
- Player sends private message to GM
- GM broadcasts message to all players
- Player creates new conversation thread
- Player replies to existing thread
- Notification on new message

---

### 3. Multi-User Collaboration Game
**Purpose**: `critical/multi-user-collaboration.spec.ts`
**Required State**:
- Game ID: 300 (E2E dedicated)
- State: `in_progress`
- Participants: GM + 3 players (all active)
- Features: All tabs enabled (Overview, Common Room, Characters, etc.)
- Permissions: Different for GM vs Players
- Pre-existing: Posts, characters, conversations

**Tests Using This**:
- Multiple users can view and interact
- Multiple users can view conversations

---

### 4. User Onboarding (No Specific Fixture)
**Purpose**: `critical/user-onboarding.spec.ts`
**Required State**:
- Uses any available games from fixtures
- Requires at least 1 game in listing
- Tests registration/login flow (no game-specific data)

---

## Implementation Plan

1. **Create new fixture file**: `backend/pkg/db/test_fixtures/e2e/09_journey_games.sql`
2. **Define games 200, 300, 400** with specific states above
3. **Update `game-helpers.ts`** to add constants:
   ```typescript
   E2E_ACTION_JOURNEY: 'E2E Journey: Action Phase',  // Game 200
   E2E_COLLAB_JOURNEY: 'E2E Journey: Collaboration', // Game 300
   E2E_MESSAGE_JOURNEY: 'E2E Journey: Messaging',    // Game 400
   ```

## Test Rewrite Rules

### ❌ NEVER Do This:
```typescript
if (await element.isVisible().catch(() => false)) {
  // test something
} else {
  console.log('⚠ Skipped - element not found');
}
```

### ✅ ALWAYS Do This:
```typescript
// Assert element must exist
await expect(element).toBeVisible({ timeout: 5000 });

// Then test it
await element.click();
```

### ❌ NEVER Do This:
```typescript
const hasFeature = await feature.isVisible().catch(() => false);
expect(hasFeature || somethingElse).toBeTruthy(); // Permissive
```

### ✅ ALWAYS Do This:
```typescript
// Be specific about what must exist
await expect(feature).toBeVisible();
```

### ❌ NEVER Do This:
```typescript
if (count > 0) {
  // test
} // No else - test passes if empty
```

### ✅ ALWAYS Do This:
```typescript
// Assert count must be > 0
expect(count).toBeGreaterThan(0);
// Then test
```

## Verification Strategy

Each test file should have a `beforeEach` that verifies fixture state:

```typescript
test.beforeEach(async ({ page }) => {
  // Login
  await loginAs(page, 'PLAYER_1');

  // Get the dedicated journey game
  const gameId = await getFixtureGameId(page, 'E2E_ACTION_JOURNEY');

  // Navigate to game
  await page.goto(`/games/${gameId}`);

  // CRITICAL: Verify expected state exists
  await expect(page.locator('[data-testid="action-phase-container"]')).toBeVisible();
});
```

This ensures:
1. Fixture data is loaded
2. Game is in correct state
3. Test fails immediately if prerequisites missing
4. No silent passes
