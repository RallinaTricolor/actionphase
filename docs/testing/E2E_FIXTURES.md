# E2E Test Fixtures Documentation

**Comprehensive guide to E2E test fixtures and their usage**

**Last Updated**: October 27, 2025
**Last Verified**: October 27, 2025

## Overview

E2E test fixtures provide pre-configured game states for Playwright tests. These fixtures are SQL files that create consistent test data, allowing tests to run in parallel without interference.

## Fixture Files

Located in: `backend/pkg/db/test_fixtures/e2e/`

| File | Purpose | Game IDs | Test Files |
|------|---------|----------|------------|
| **00_worker_setup.sql** | Worker-specific setup | - | All parallel tests |
| **07_common_room.sql** | Common room testing | 164-168, 605-610 | common-room.spec.ts |
| **08_e2e_dedicated_games.sql** | Dedicated test games | 350-355 | Various isolated tests |
| **09_action_results.sql** | Action result testing | 326 | action-results.spec.ts |
| **10_lifecycle_game.sql** | Phase lifecycle | 327 | phase-lifecycle.spec.ts |
| **11_character_sheets.sql** | Character management | 328 | character-sheets.spec.ts |
| **12_game_applications.sql** | Game applications | 329-333 | game-application.spec.ts |
| **13_game_lifecycle.sql** | Game state transitions | 334-338 | game-lifecycle.spec.ts |
| **14_character_workflows.sql** | Character approval | 300-304, 600-604 | character-approval.spec.ts |
| **15_deep_thread.sql** | Deep comment threading | 700 | deep-threading.spec.ts |

## Test Users

All fixtures use these standard test accounts:

| User | Email | Password | Role |
|------|-------|----------|------|
| TestGM | test_gm@example.com | testpassword123 | Game Master |
| TestPlayer1 | test_player1@example.com | testpassword123 | Player |
| TestPlayer2 | test_player2@example.com | testpassword123 | Player |
| TestPlayer3 | test_player3@example.com | testpassword123 | Player |
| TestPlayer4 | test_player4@example.com | testpassword123 | Player |
| TestPlayer5 | test_player5@example.com | testpassword123 | Player |
| TestAudience | test_audience@example.com | testpassword123 | Audience |

## Game ID Ranges

Games are organized in specific ID ranges to prevent conflicts:

| Range | Purpose | Description |
|-------|---------|-------------|
| 164-168 | Framework tests | Common room, mentions, notifications |
| 300-338 | Workflow tests | Applications, lifecycle, character management |
| 350-355 | Dedicated worker games | Isolated per-worker test games |
| 600-610 | Common room tests | Parallel common-room.spec.ts tests |
| 700 | Deep threading | Continue thread button testing |

## Parallel Testing Support

### Worker Isolation
Each parallel test worker (0-5) gets its own set of games with offsets:
- Worker 0: Base game IDs
- Worker 1: Base + 1000
- Worker 2: Base + 2000
- Worker 3: Base + 3000
- Worker 4: Base + 4000
- Worker 5: Base + 5000

### Example
```javascript
// In test file
const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
// Returns 605 for worker 0, 1605 for worker 1, etc.
```

## Loading Fixtures

### Manual Loading
```bash
# Load all E2E fixtures
just load-e2e

# Load specific worker fixtures
DB_NAME=actionphase ./backend/pkg/db/test_fixtures/apply_e2e_worker.sh 0
```

### Automatic Loading
E2E tests automatically load fixtures before running:
```bash
npx playwright test  # Loads fixtures automatically
```

## Common Test Scenarios

### 1. Common Room Testing (Game #608)
- Pre-configured with Discussion phase
- TestGM and 2 players joined
- Used for: Post creation, commenting, nested replies

### 2. Character Approval (Games #600-604)
- Different approval states per game
- #600: Pending approval
- #601: Approved character
- #602: Rejected character
- #603: Resubmission after rejection
- #604: In-game approved character

### 3. Game Lifecycle (Games #334-338)
- #334: Character creation state (ready to start)
- #335: In progress (can be paused)
- #336: Paused (can be resumed)
- #337: Active (ready to complete)
- #338: Recruitment (can be cancelled)

### 4. Action Results (Game #326)
- Multiple phases with actions
- Pre-created action submissions
- Result visibility testing

## Writing Tests with Fixtures

### 1. Import Helper Functions
```typescript
import { loginAs, getFixtureGameId } from '../fixtures/auth-helpers';
import { CommonRoomPage } from '../pages/CommonRoomPage';
```

### 2. Get Game ID for Your Test
```typescript
const gameId = await getFixtureGameId(page, 'COMMON_ROOM_NESTED_REPLIES');
```

### 3. Login as Test User
```typescript
await loginAs(page, 'GM');  // or 'PLAYER_1', 'PLAYER_2', etc.
```

### 4. Navigate and Test
```typescript
const commonRoom = new CommonRoomPage(page);
await commonRoom.goto(gameId);
// Your test logic here
```

## Fixture Constants

Define these in `fixtures/game-helpers.ts`:

```typescript
export const FIXTURE_GAMES = {
  // Common Room Tests
  COMMON_ROOM_POSTS: 605,
  COMMON_ROOM_VIEW: 606,
  COMMON_ROOM_COMMENT: 607,
  COMMON_ROOM_NESTED_REPLIES: 608,
  COMMON_ROOM_MULTIPLE_REPLIES: 609,
  COMMON_ROOM_DEEP_NESTING: 610,

  // Character Workflows
  CHARACTER_PENDING: 600,
  CHARACTER_APPROVED: 601,
  CHARACTER_REJECTED: 602,

  // Game Lifecycle
  GAME_TO_START: 334,
  GAME_TO_PAUSE: 335,
  GAME_TO_RESUME: 336,
  GAME_TO_COMPLETE: 337,
  GAME_TO_CANCEL: 338,
};
```

## Troubleshooting

### Tests Failing with "Game Not Found"
- Ensure fixtures are loaded: `just load-e2e`
- Check worker offset calculations
- Verify database name is `actionphase`

### Parallel Tests Interfering
- Each test should use its own game ID
- Check for hardcoded game IDs (should use constants)
- Ensure cleanup in test teardown

### Data Not Matching Expectations
- Fixtures may be outdated - reload with `just load-e2e`
- Check if another test modified the data
- Verify you're using the correct test user

## Maintenance

### Adding New Fixtures
1. Create SQL file in `backend/pkg/db/test_fixtures/e2e/`
2. Use unique game IDs (check existing ranges)
3. Update `apply_e2e_worker.sh` to include new file
4. Document in this file

### Updating Existing Fixtures
1. Modify SQL file
2. Test locally with single worker
3. Verify parallel execution still works
4. Update documentation if IDs change

---

*For more E2E testing information, see [E2E_QUICK_START.md](./E2E_QUICK_START.md)*
