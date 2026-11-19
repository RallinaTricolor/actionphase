# E2E Test Fixtures Documentation

**Comprehensive guide to E2E test fixtures and their usage**

**Last Updated**: October 27, 2025
**Last Verified**: October 27, 2025

## Overview

E2E test fixtures provide pre-configured game states for Playwright tests. These fixtures are SQL files that create consistent test data, allowing tests to run in parallel without interference.

## Fixture Files

Located in: `backend/pkg/db/test_fixtures/e2e/`

Files suffixed `_w0`–`_w5` are per-worker variants, applied without
transformation; every other file is applied once per worker with its game IDs
offset.

`apply_e2e_worker.sh` applies **every** `e2e/*.sql` file in filename order, so
the directory is the list. Read it for the current set:

```bash
ls backend/pkg/db/test_fixtures/e2e/
```

> **Do not hardcode fixture game IDs in tests.** IDs shift by worker offset and
> drift as fixtures change. Resolve them by title through
> `getFixtureGameId(page, KEY)` using the `FIXTURE_GAMES` constants in
> `frontend/e2e/fixtures/game-helpers.ts`.

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
| 700-727 | Single-feature specs | One game (or a few) per spec, from deep threading (700) to the scoreboard (722-727). `FIXTURE_GAMES` names each |

## Parallel Testing Support

### Worker Isolation
Each parallel test worker (0–5) gets its own games. `apply_e2e_worker.sh`
computes the offset as `WORKER_INDEX * 10000`:

| Worker | Game ID offset |
|---|---|
| 0 | +0 (base) |
| 1 | +10000 |
| 2 | +20000 |
| 3 | +30000 |
| 4 | +40000 |
| 5 | +50000 |

Worker 0 is applied verbatim; workers 1–5 additionally get user references
suffixed (`TestGM` → `TestGM_N`). After every file, the loader re-runs `setval`
on `games_id_seq` and `messages_id_seq` so a low-offset file applied after a
high-offset one cannot rewind the sequence into existing IDs.

### Example
```typescript
import { getFixtureGameId } from '../fixtures/game-helpers';

// Resolves by game TITLE via the API, so it is worker-agnostic.
const gameId = await getFixtureGameId(page, 'COMMON_ROOM_POSTS');
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
The `just e2e-*` recipes call `just load-e2e` before starting Playwright:
```bash
just e2e-desktop   # loads fixtures, then runs
```

## Common Test Scenarios

Fixture games are referenced by **title-keyed constants**, never by raw ID.
`FIXTURE_GAMES` in `frontend/e2e/fixtures/game-helpers.ts` is the source of
truth; `getFixtureGameId()` resolves a key to the worker's actual ID at runtime.

```typescript
import { getFixtureGameId, FIXTURE_GAMES } from '../fixtures/game-helpers';

const gameId = await getFixtureGameId(page, 'PLAYER_MULTIPLE_CHARACTERS');
```

Representative keys (read `game-helpers.ts` for the full, current set):

| Area | Example keys |
|---|---|
| Common room | `COMMON_ROOM_POSTS`, `COMMON_ROOM_COMMENT`, `COMMON_ROOM_NESTED_REPLIES`, `COMMON_ROOM_DEEP_NESTING`, `COMMON_ROOM_POLLS` |
| Co-GM | `CO_GM_MANAGEMENT`, `CO_GM_ACTION_RESULTS` |
| Notifications | `NOTIFICATION_FLOW`, `NOTIFICATION_PHASE`, `UNREAD_INBOX`, `UNREAD_TRACKING`, `MANUAL_READ_TRACKING` |
| Characters | `PLAYER_MULTIPLE_CHARACTERS`, `CHARACTER_AVATARS` |
| Messaging | `PLAYER_TO_AUDIENCE`, `DEEP_LINKING_TEST`, `INFINITE_SCROLL` |
| Named games | `HEIST`, `WESTMARCH`, `SHADOWS`, `DRAGON`, `MANOR` |

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
1. Create the SQL file in `backend/pkg/db/test_fixtures/e2e/`
2. Use unique game IDs (check existing files for ranges in use)
3. Add a `FIXTURE_GAMES` entry in `frontend/e2e/fixtures/game-helpers.ts` so
   tests can resolve it by title
4. **No loader change needed** — `apply_e2e_worker.sh` globs `e2e/*.sql` and
   applies everything in filename order. Only per-worker (`_wN`) files need a
   filter, which is already generic per family.

### Updating Existing Fixtures
1. Modify SQL file
2. Test locally with single worker
3. Verify parallel execution still works
4. Update documentation if IDs change

---

*For more E2E testing information, see [E2E_QUICK_START.md](./E2E_QUICK_START.md)*
