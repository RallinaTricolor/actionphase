# Test Data Separation Strategy

## Overview

This document defines the separation of test fixtures into three distinct categories: **Common** (shared base data), **Demo** (human-friendly showcase data), and **E2E** (automated test data).

---

## Directory Structure

```
backend/pkg/db/test_fixtures/
├── common/                     # Shared base data
│   ├── 00_reset.sql            # Database cleanup
│   ├── 01_users.sql            # Test users (GM, Players, etc)
│   └── 02_base_setup.sql       # Essential system config
│
├── demo/                        # Human-friendly showcase data
│   ├── 10_showcase_games.sql   # "Curse of Strahd", "Lost Mine", etc
│   ├── 11_rich_characters.sql  # Detailed character sheets
│   ├── 12_game_history.sql     # Complete game with full history
│   ├── 13_conversations.sql    # Interesting message threads
│   └── 14_nested_comments.sql  # Deep discussion threads
│
├── e2e/                         # Automated test fixtures
│   ├── 20_e2e_games.sql       # Games 164-167 (isolated test games)
│   ├── 21_e2e_characters.sql  # Predictable test characters
│   ├── 22_e2e_phases.sql      # Phases in specific states
│   ├── 23_e2e_actions.sql     # Draft/submitted actions
│   └── 24_e2e_messages.sql    # Test posts and comments
│
├── apply_common.sh             # Load only common data
├── apply_demo.sh               # Load common + demo
├── apply_e2e.sh                # Load common + E2E
└── apply_all.sh                # Load everything (dev only)
```

---

## Data Categories

### 1. Common Data (Always Loaded)

**Purpose:** Base users and configuration needed by both demo and E2E

**Contents:**
- Test users (TestGM, TestPlayer1-5, TestAudience)
- System configuration
- Empty/reset state

**Characteristics:**
- Minimal data
- No games or content
- Just authentication and base setup

### 2. Demo Data (Staging/Showcase)

**Purpose:** Rich, realistic data for manual testing and demos

**Contents:**
- **"Curse of Strahd"** - Horror campaign with 5 players, rich phase history
- **"The Lost Mine of Phandelver"** - Classic D&D starter, recruiting phase
- **"Cyberpunk 2077: Night City"** - Modern setting, character creation phase
- **"Star Wars: Edge of Empire"** - Space opera, mid-campaign
- **"Call of Cthulhu: Innsmouth"** - Investigation heavy, completed game

**Characteristics:**
- Human-readable names and content
- Realistic scenarios and narratives
- Rich media (avatars, detailed descriptions)
- Complete game histories
- Engaging conversations
- NO hardcoded IDs (uses sequences)

**Example:**
```sql
-- demo/10_showcase_games.sql
INSERT INTO games (title, description, genre, status, gm_user_id)
VALUES
  ('Curse of Strahd',
   'A gothic horror campaign where brave adventurers face the vampire Count Strahd...',
   'Horror/Fantasy',
   'active',
   (SELECT id FROM users WHERE username = 'TestGM'))
RETURNING id AS strahd_game_id;
```

### 3. E2E Data (Automated Testing)

**Purpose:** Predictable, isolated fixtures for automated tests

**Contents:**
- Games with IDs 164-167 (E2E Common Room series)
- Games with IDs 200-210 (E2E Action/Phase testing)
- Games with IDs 300-305 (E2E Character management)
- Specific test scenarios with known states

**Characteristics:**
- Hardcoded IDs for reliability
- Minimal narrative content
- Isolated from each other
- State-specific (e.g., "game in recruiting", "game with pending action")
- Fast to load
- Deterministic

**Example:**
```sql
-- e2e/20_e2e_games.sql
INSERT INTO games (id, title, description, status, gm_user_id)
VALUES
  (164, 'E2E Common Room - Posts', 'Isolated for post testing', 'active', 1),
  (165, 'E2E Common Room - Mentions', 'Isolated for mention testing', 'active', 1),
  (200, 'E2E Action - Submission', 'Has active action phase', 'active', 1),
  (201, 'E2E Action - Resolution', 'Ready for GM resolution', 'active', 1);
```

---

## Loading Commands

### Development Environment

```bash
# Clean slate with demo data (for local development)
just db reset
just load-demo

# E2E testing mode
just db reset
just load-e2e

# Everything (only for checking compatibility)
just load-all
```

### CI/CD Pipeline

```bash
# GitHub Actions E2E tests
- name: Load E2E fixtures
  run: just load-e2e

# Staging deployment
- name: Load demo data
  run: just load-demo

# Production (no test data!)
- name: Run migrations only
  run: just migrate
```

### Justfile Additions

```makefile
# Load only common base data (users, config)
load-common:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🧹 Loading common base data..."
  DB_NAME={{db_name}} ./backend/pkg/db/test_fixtures/apply_common.sh
  echo "✅ Common data loaded (users only, no games)"

# Load demo data for staging/showcase
load-demo:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🎭 Loading demo showcase data..."
  DB_NAME={{db_name}} ./backend/pkg/db/test_fixtures/apply_demo.sh
  echo "✅ Demo data loaded (rich, human-friendly content)"

# Load E2E test fixtures
load-e2e:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "🤖 Loading E2E test fixtures..."
  DB_NAME={{db_name}} ./backend/pkg/db/test_fixtures/apply_e2e.sh
  echo "✅ E2E fixtures loaded (isolated test games)"

# Load all data (dev only)
load-all:
  #!/usr/bin/env bash
  set -euo pipefail
  echo "⚠️  Loading ALL data (demo + E2E)..."
  DB_NAME={{db_name}} ./backend/pkg/db/test_fixtures/apply_all.sh
  echo "✅ All data loaded (not recommended for staging)"

# Alias old command for backwards compatibility
test-fixtures: load-all
  @echo "⚠️  Deprecated: Use 'just load-demo' or 'just load-e2e' instead"
```

---

## Migration Plan

### Phase 1: Reorganize Files (Week 1)
1. Create new directory structure
2. Split existing fixtures into categories:
   - `01_users.sql` → `common/`
   - `02-03_games*.sql` → `demo/` (rewrite with rich content)
   - `07_common_room.sql` → Split (demos to `demo/`, E2E games to `e2e/`)
   - `08_e2e_dedicated_games.sql` → `e2e/`
   - `09_demo_content.sql` → `demo/`
   - `012_deeply_nested_comments.sql` → `demo/`

### Phase 2: Enhance Demo Data (Week 2)
1. Add narrative descriptions to all demo games
2. Create realistic character backgrounds
3. Add engaging conversation threads
4. Include variety of game states and genres
5. Add rich media URLs (avatars, handouts)

### Phase 3: Standardize E2E Data (Week 3)
1. Assign ID ranges:
   - 100-199: Common room testing
   - 200-299: Action/phase testing
   - 300-399: Character testing
   - 400-499: Messaging testing
2. Document each E2E game's purpose
3. Ensure complete isolation (no shared data)
4. Minimize data size for speed

### Phase 4: Update Documentation (Week 4)
1. Update E2E test files to reference new IDs
2. Update `.claude/context/TEST_DATA.md`
3. Update developer onboarding docs
4. Create fixture reference guide

---

## Benefits

### For Developers
- Clear separation of concerns
- Faster E2E test execution (less data)
- No accidental test data in demos
- Easy to reset specific data types

### For Testing
- Predictable E2E fixtures
- Isolated test scenarios
- No contamination between test runs
- Parallel-safe test execution

### For Staging/Demo
- Rich, engaging content
- Realistic user scenarios
- No test artifacts
- Professional presentation

### For Production
- No risk of test data deployment
- Clean migration path
- Separate data pipeline

---

## Example Scripts

### apply_demo.sh
```bash
#!/bin/bash
set -euo pipefail

DB_NAME="${DB_NAME:-actionphase}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Loading demo data for database: $DB_NAME"

# Load common first
psql $DATABASE_URL -f "$SCRIPT_DIR/common/00_reset.sql"
psql $DATABASE_URL -f "$SCRIPT_DIR/common/01_users.sql"

# Load all demo files in order
for file in "$SCRIPT_DIR"/demo/*.sql; do
  echo "Applying $(basename $file)..."
  psql $DATABASE_URL -f "$file"
done

echo "Demo data loaded successfully!"
```

### apply_e2e.sh
```bash
#!/bin/bash
set -euo pipefail

DB_NAME="${DB_NAME:-actionphase}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Loading E2E fixtures for database: $DB_NAME"

# Load common first
psql $DATABASE_URL -f "$SCRIPT_DIR/common/00_reset.sql"
psql $DATABASE_URL -f "$SCRIPT_DIR/common/01_users.sql"

# Load all E2E files in order
for file in "$SCRIPT_DIR"/e2e/*.sql; do
  echo "Applying $(basename $file)..."
  psql $DATABASE_URL -f "$file"
done

echo "E2E fixtures loaded successfully!"
```

---

## Quick Reference

| Command | Purpose | Contents | Use Case |
|---------|---------|----------|----------|
| `just load-common` | Base only | Users, config | Fresh start |
| `just load-demo` | Showcase | Rich narratives | Staging, demos |
| `just load-e2e` | Testing | Isolated fixtures | E2E tests |
| `just load-all` | Everything | Demo + E2E | Development only |

---

*This separation ensures clean, purposeful test data management across all environments.*
