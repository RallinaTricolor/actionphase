# Test Data Context - Read Before Working with Test Data

**IMPORTANT: Read this file before working with test data and fixtures.**

**Last Updated**: October 27, 2025
**Last Verified**: October 27, 2025

## Test Fixture System

ActionPhase uses SQL-based test fixtures for comprehensive test coverage across all game states and phases.

### Fixture Location
**Location**: `/backend/pkg/db/test_fixtures/`

```
test_fixtures/
├── 00_reset.sql           # Cleans all test data
├── 01_users.sql           # Creates test users
├── 02_games_recruiting.sql # Creates recruiting games
├── 03_games_running.sql   # Creates running games with phases
├── 04_characters.sql      # Creates characters and NPCs
├── 05_actions.sql         # Creates action submissions
├── 06_results.sql         # Creates action results
└── apply_all.sh           # Bash script to apply all fixtures
```

## Quick Commands

### Apply All Fixtures
```bash
# From project root
./backend/pkg/db/test_fixtures/apply_all.sh

# Or using justfile
just test-fixtures
```

### Reset Test Data
```bash
# Reset to clean state
just reset-test-data

# Then reapply
just test-fixtures
```

## Test Users

**All passwords**: `testpassword123`

**IMPORTANT**: Usernames are **case-sensitive** and use **PascalCase** (TestGM, TestPlayer1, etc.)

### User Types
1. **Game Master**: `TestGM` / `test_gm@example.com`
   - Creates and manages games
   - Controls NPCs

2. **Players** (5 total):
   - `TestPlayer1` / `test_player1@example.com`
   - `TestPlayer2` / `test_player2@example.com`
   - `TestPlayer3` / `test_player3@example.com`
   - `TestPlayer4` / `test_player4@example.com`
   - `TestPlayer5` / `test_player5@example.com`

3. **Audience**: `TestAudience` / `test_audience@example.com`
   - Observes games without direct participation

## Test Game Coverage

### 10 Games Covering All States

| # | Name | Status | Phase Status | Purpose |
|---|------|--------|--------------|---------|
| 1 | Shadows Over Innsmouth | Running | Active Common Room | Test common room phase |
| 2 | The Heist at Goldstone Bank | Running | Active Action (with submissions) | Test action submissions |
| 3 | Starfall Station | Running | Active Results (with published results) | Test results display |
| 4 | Court of Shadows | Running | Previous CR + Active Action | Test phase transitions |
| 5 | The Dragon of Mount Krag | Running | 6 previous + Active CR | Test complex history |
| 6 | Chronicles of Westmarch | Running | 11 previous + Active Results | Test pagination |
| 7 | The Mystery of Blackwood Manor | Recruiting | No phases | Test recruitment |
| 8 | On Hold: The Frozen North | Paused | 4 previous phases | Test paused state |
| 9 | COMPLETED: Tales of the Arcane | Completed | 9 completed phases | Test completed |
| 10 | Secret Campaign | Recruiting | No phases (private) | Test private games |

### Game States Covered
- **Recruiting** - Games #7, #10
- **Running** - Games #1-6
- **Paused** - Game #8
- **Completed** - Game #9
- **Cancelled** - (add if needed)

### Phase Types Covered
- **Common Room** - Games #1, #5 (active)
- **Action** - Games #2, #4 (active, with submissions)
- **Results** - Games #3, #6 (active, with published results)

### Phase History Patterns
- **No history** - Games #1, #7, #10
- **Single previous phase** - Games #2, #4
- **Mixed history (3-6 phases)** - Games #3, #5, #8
- **Long history (10+ phases)** - Games #6, #9

## Test Characters

### Character Coverage
- **30+ characters total**
- **1 player character per player per game**
- **Multiple GM NPCs per game**
- **Character data examples** (public and private fields)

### Character Types
- `player_character` - Player-controlled characters
- `npc_gm` - GM-controlled NPCs
- `npc_player` - Player-controlled NPCs (future feature)

### Example Characters

**Game #2 (Heist)**:
- Shade (Whisper) - Player 1
- Rook (Hound) - Player 2
- Vex (Leech) - Player 3
- Silk (Spider) - Player 4
- Inspector Dalton - GM NPC

**Game #1 (Innsmouth)**:
- Detective Marcus Kane - Player 1
- Dr. Sarah Chen - Player 2
- Father O'Brien - Player 3
- Captain Obed Marsh - GM NPC

## Test Actions and Results

### Action Submissions (Game #2)
- **3 submitted actions** (finalized)
- **1 draft action** (work in progress)
- Various submission times and content lengths

### Action Results (Game #3)
- **3 published results** (visible to players)
- **1 draft result** (GM hasn't published yet)
- Demonstrates storytelling and cliffhangers

## Edge Cases Covered

### ✅ Complete Coverage

**Phase States**:
- Active phases of all three types
- Previous phases (completed)
- No phases (recruiting games)
- Mixed phase history
- Long phase history (10+ phases)

**Deadline Scenarios**:
- Deadlines in near future (< 1 day)
- Deadlines in far future (> 1 day)
- No deadlines (common room, results phases)

**Character Scenarios**:
- Standard case (1 PC per player per game)
- GM-only NPCs
- Character data (public and private)

**Action Submissions**:
- Submitted (final) actions
- Draft actions
- Various submission times

**Game States**:
- All status types covered
- Public and private visibility
- Various creation dates

**Participation**:
- Active participants
- Games with 2-6 players
- Audience members (future)

## Using Test Data in Tests

### Backend Integration Tests

```go
func TestGameService_GetGame(t *testing.T) {
    // Setup: Apply test fixtures first
    db := setupTestDB(t)

    // Game #2 has active action phase with submissions
    game, err := service.GetGame(ctx, 2)

    assert.NoError(t, err)
    assert.Equal(t, "The Heist at Goldstone Bank", game.Title)
    assert.Equal(t, "in_progress", game.State)
}
```

### Frontend Component Tests

```typescript
test('displays recruiting games', async () => {
  // Mock API response using test data structure
  server.use(
    rest.get('/api/v1/games/recruiting', (req, res, ctx) => {
      return res(ctx.json({
        data: [
          { id: 7, title: 'The Mystery of Blackwood Manor', state: 'recruitment' },
          { id: 10, title: 'Secret Campaign', state: 'recruitment', is_public: false }
        ]
      }));
    })
  );

  render(<GamesList showRecruitingOnly={true} />);
  expect(await screen.findByText('The Mystery of Blackwood Manor')).toBeInTheDocument();
});
```

## Common Testing Scenarios

### Testing Phase Transitions
Use **Game #5** (Dragon of Mount Krag):
- Has 6 previous phases (common_room, action, results pattern)
- Active common room phase
- Good for testing phase history and transitions

### Testing Action Submissions
Use **Game #2** (Heist at Goldstone Bank):
- Active action phase
- 3 submitted actions + 1 draft
- Multiple characters with actions

### Testing Results Display
Use **Game #3** (Starfall Station):
- Active results phase
- 3 published results
- 1 unpublished draft result

### Testing Pagination
Use **Game #6** (Chronicles of Westmarch):
- 12 total phases (11 previous + 1 active)
- Tests pagination for phase lists

### Testing Recruitment
Use **Game #7** (Blackwood Manor):
- Recruiting state
- No phases yet
- Public visibility

## E2E Test Fixtures - Test Isolation Strategy

**CRITICAL**: E2E fixtures are designed for **test isolation and parallel execution**.

### E2E Fixture Organization

E2E fixtures in `/backend/pkg/db/test_fixtures/e2e/` follow a **one fixture per test file** pattern:

```
e2e/
├── 07_common_room.sql       # 5 isolated Common Room games (Game #164-168)
├── 08_e2e_dedicated_games.sql # Dedicated games for state changes
```

**Each E2E fixture game has a specific purpose**:
- **Game #164**: `E2E Common Room - Posts` → for `common-room.spec.ts`
- **Game #165**: `E2E Common Room - Mentions` → for `character-mentions.spec.ts`
- **Game #166**: `E2E Common Room - Notifications` → for `notification-flow.spec.ts`
- **Game #167**: `E2E Common Room - Misc` → for miscellaneous tests
- **Game #168**: `E2E Character Avatars` → for `character-avatar.spec.ts`

### When to Create a New Fixture vs Reuse

**✅ CREATE a new dedicated fixture when:**
- Writing a new E2E test file that will run in parallel
- Test requires specific participant/character setup
- Test will modify game state (upload avatars, post comments, etc.)
- Reusing would break another test's assumptions

**❌ DO NOT reuse a fixture if:**
- The fixture was designed for a specific test file
- Your test's participant needs differ from the fixture's setup
- The fixture has a documented purpose that doesn't match your test
- You're not sure if it will cause conflicts

**Example of WRONG approach:**
```typescript
// ❌ WRONG: character-avatar.spec.ts using COMMON_ROOM_MISC
// COMMON_ROOM_MISC only has Player 5, but tests use Players 1-4
const gameId = await getFixtureGameId(page, 'COMMON_ROOM_MISC');
```

**Example of CORRECT approach:**
```typescript
// ✅ CORRECT: Created dedicated CHARACTER_AVATARS fixture
// Game #168 has Players 1-4 with characters specifically for avatar tests
const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
```

### Creating a New E2E Fixture

**Step 1**: Add fixture to SQL file (`07_common_room.sql` or create new file):
```sql
-- Game #169: My New Feature Test
INSERT INTO games (id, title, description, ...) VALUES (
  169,
  'E2E My Feature',
  'Dedicated game for my-feature.spec.ts E2E tests.',
  ...
);

-- Add participants needed for YOUR test
INSERT INTO game_participants (game_id, user_id, role, status, joined_at)
VALUES
  (169, p1_id, 'player', 'active', NOW() - INTERVAL '4 days'),
  (169, p2_id, 'player', 'active', NOW() - INTERVAL '4 days');

-- Add characters needed for YOUR test
INSERT INTO characters (game_id, user_id, name, ...) VALUES
  (169, p1_id, 'Test Character 1', ...),
  (169, p2_id, 'Test Character 2', ...);
```

**Step 2**: Add to `game-helpers.ts` mapping:
```typescript
export const FIXTURE_GAMES = {
  // ... existing fixtures ...
  MY_FEATURE: 'E2E My Feature',  // Game #169 - for my-feature.spec.ts
} as const;
```

**Step 3**: Use in your test:
```typescript
const gameId = await getFixtureGameId(page, 'MY_FEATURE');
```

**Step 4**: Document the fixture's purpose in SQL comments and this file.

### Test Isolation Principles

1. **One Purpose Per Fixture**: Each fixture game serves ONE test file
2. **Independent State**: Tests should not depend on other tests' state changes
3. **Parallel Safe**: Fixtures must support parallel test execution
4. **Documented Purpose**: Always comment WHY a fixture exists and WHAT test uses it
5. **Minimal Overlap**: Avoid "generic" fixtures that many tests share

**Why This Matters:**
- Tests run in parallel for speed
- Shared fixtures cause race conditions and flaky tests
- Clear fixture ownership makes debugging easier
- Test isolation prevents cascading failures

## Fixture Maintenance

### Updating Fixtures

1. Modify appropriate SQL file in `test_fixtures/`
2. Run: `just reset-test-data && just test-fixtures`
3. Verify changes in application
4. Update this documentation if needed

### Adding New Scenarios

1. **Think First**: Does an existing fixture serve this purpose?
2. **Check Purpose**: Read fixture comments and game-helpers.ts
3. **Create if Needed**: Make a dedicated fixture for test isolation
4. **Document**: Update SQL comments and this file

## Troubleshooting

### Common Issues

**Schema Drift**: If tests fail with "column does not exist" errors:
```bash
# Apply migrations to test database
just migrate_test

# Then reapply fixtures
just test-fixtures
```

**Connection Errors**: Verify database is running:
```bash
docker ps | grep postgres
```

**Permission Errors**: Make script executable:
```bash
chmod +x backend/pkg/db/test_fixtures/apply_all.sh
```

**Unique Constraint Errors**: Reset first:
```bash
just reset-test-data && just test-fixtures
```

## Integration with Tests

### Backend Tests
When writing integration tests that use the database:

1. **Setup**: Apply test fixtures before test suite
2. **Transaction isolation**: Use transaction rollback pattern
3. **Known IDs**: Reference fixture IDs (Game #2 = Heist, etc.)
4. **Cleanup**: Rollback transactions after each test

### Frontend Tests
When writing component tests that display data:

1. **Mock API**: Use MSW with test data structure
2. **Consistent data**: Mirror fixture structure in mocks
3. **Edge cases**: Test with various fixture scenarios
4. **Loading states**: Use fixture data to test async loading

## Quick Reference

### Login as GM
```
Username: TestGM
Email: test_gm@example.com
Password: testpassword123
```

### Login as Player
```
Username: TestPlayer1
Email: test_player1@example.com
Password: testpassword123
```

### View Active Action Phase
Game #2: "The Heist at Goldstone Bank"

### View Long Phase History
Game #6: "Chronicles of Westmarch" (12 phases)

### View Recruiting Game
Game #7: "The Mystery of Blackwood Manor"

## References

- **Detailed Documentation**: `/docs/TEST_DATA.md` (comprehensive guide)
- **Test Fixtures**: `/backend/pkg/db/test_fixtures/` (actual SQL files)
- **Test Coverage Analysis**: `/docs/TEST_COVERAGE_ANALYSIS.md` (improvement plan)
- **Testing Strategy ADR**: `/docs/adrs/007-testing-strategy.md`

## Checklist Before Writing Tests

- [ ] Test fixtures applied and current
- [ ] Know which game/phase to use for test scenario
- [ ] Understand test user credentials
- [ ] Transaction isolation set up (for integration tests)
- [ ] Mock data mirrors fixture structure (for frontend tests)
- [ ] Edge cases identified from fixture coverage
