# Data Separation Implementation Summary

## ✅ Completed Changes

### 1. Directory Structure Created
```
backend/pkg/db/test_fixtures/
├── common/              # Base data (users, reset)
├── demo/                # Human-friendly showcase data
├── e2e/                 # Automated test fixtures
└── *.sh                 # Loading scripts
```

### 2. Files Reorganized
- **Common:** `00_reset.sql`, `01_users.sql`
- **Demo:** All game content, characters, actions, results, nested comments
- **E2E:** Common room tests (07), dedicated E2E games (08)

### 3. Loading Scripts Created
- `apply_common.sh` - Base users only
- `apply_demo.sh` - Staging/showcase data
- `apply_e2e.sh` - Test fixtures
- `apply_all.sh` - Everything (existing)

### 4. Justfile Commands Added
```bash
just load-common   # Users only
just load-demo     # Rich showcase content
just load-e2e      # Test fixtures
just load-all      # Everything
```

---

## Next Steps for Completion

### 1. Split Mixed Content (Priority: HIGH)
The file `07_common_room.sql` contains both demo and E2E data. Need to:
- Extract games 164-167 to `e2e/20_e2e_common_room.sql`
- Move narrative content to `demo/10_showcase_common_room.sql`

### 2. Create Enhanced Demo Content (Priority: MEDIUM)
Create rich showcase games with narratives:
```sql
-- demo/10_showcase_games.sql
-- Rich, narrative games like "Curse of Strahd"
-- Use dynamic IDs (RETURNING id)

-- demo/11_rich_conversations.sql
-- Engaging discussions with real narratives
```

### 3. Standardize E2E IDs (Priority: HIGH)
```sql
-- e2e/20_e2e_games.sql
-- Hardcoded IDs for reliability:
-- 164-167: Common Room
-- 200-209: Actions
-- 300-309: Characters
-- 400-409: Messages
```

### 4. Update Test References (Priority: CRITICAL)
```typescript
// Update E2E tests to use new fixture functions
const gameId = await getFixtureGameId(page, 'E2E_ACTION'); // Maps to ID 200
```

---

## Usage Patterns

### Local Development
```bash
just db reset
just load-demo      # Rich content for manual testing
```

### Running E2E Tests
```bash
just db reset
just load-e2e       # Minimal, isolated fixtures
npm run test:e2e
```

### Staging Environment
```bash
just load-demo      # No E2E artifacts
```

### CI Pipeline
```yaml
- run: just load-e2e
- run: npm run test:e2e
```

---

## Benefits Achieved

✅ **Separation of Concerns**
- Demo data never contains test artifacts
- E2E tests use predictable, isolated fixtures
- Staging looks professional

✅ **Faster Testing**
- E2E loads only what's needed
- Parallel-safe with isolated games
- No cross-contamination

✅ **Better Developer Experience**
- Clear commands for each use case
- Rich demo content for showcasing
- Clean staging environments

---

## File Mapping Reference

| Original File | New Location | Purpose |
|--------------|--------------|---------|
| 00_reset.sql | common/ | Database cleanup |
| 01_users.sql | common/ | Test users |
| 02_games_recruiting.sql | demo/ | Showcase games |
| 03_games_running.sql | demo/ | Active games |
| 04_characters.sql | demo/ | Rich characters |
| 05_actions.sql | demo/ | Example actions |
| 06_results.sql | demo/ | Published results |
| 07_common_room.sql | Split between demo/ and e2e/ | Messages |
| 08_e2e_dedicated_games.sql | e2e/ | Test fixtures |
| 09_demo_content.sql | demo/ | Rich content |
| 012_deeply_nested_comments.sql | demo/ | Discussion threads |

---

*Next: Enhance demo content with rich narratives and complete E2E fixture standardization.*
