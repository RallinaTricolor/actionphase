# Justfile Simplification Plan

**Date**: 2025-10-19
**Current State**: 93 commands, 633 lines
**Target**: ~30 commands, ~400 lines
**Priority**: P1 - High

## Executive Summary

The justfile has grown to 93 commands through organic growth. This analysis proposes consolidating to ~30 well-organized commands using parameters and consistent naming patterns.

## Current Command Analysis

### Command Categories (93 total)

**1. Development Workflow (7 commands)**
- `dev` - Start backend with env validation
- `dev-full` - Start backend + frontend
- `dev-setup` - Complete setup for new developers
- `run` - Basic backend start
- `run-frontend` - Start frontend dev server
- `build` - Build backend
- `build-frontend` - Build frontend

**2. Database Management (10 commands)**
- `db_up` - Start database container
- `db_down` - Stop database container
- `db_reset` - Reset database
- `db_create` - Create databases
- `db_setup` - Full database setup
- `migrate` - Apply migrations
- `migrate_test` - Apply migrations to test DB
- `migrate_status` - Check migration status
- `rollback` - Rollback migration
- `make_migration` - Create new migration

**3. Backend Testing (15+ commands)**
- `test` - Default backend tests
- `test-mocks` - Fast unit tests
- `test-integration` - Integration tests
- `test-race` - Race condition tests
- `test-coverage` - Coverage report
- `test-bench` - Benchmarks
- `test-verbose` - Verbose output
- `test-parallel` - Parallel tests
- `test-all` - All tests
- `test-clean` - Clean test cache
- `test-no-db` - Tests without DB
- `test-service` - Specific service tests
- `test-db-setup` - Test DB setup
- `full-test` - Full test suite
- `quick-test` - Quick tests

**4. Frontend Testing (6 commands)**
- `test-frontend` - Run frontend tests
- `test-frontend-watch` - Watch mode
- `test-frontend-coverage` - Coverage report
- `test-frontend-ui` - Interactive UI
- `test-frontend-file` - Specific file
- `setup-frontend-tests` - Verify setup

**5. E2E Testing (6 commands)**
- `e2e` - Run E2E tests (headless)
- `e2e-headed` - Run with browser visible
- `e2e-ui` - Interactive mode
- `e2e-debug` - Debug mode
- `e2e-report` - Show report
- `e2e-test` - Specific test file

**6. Process Management (10 commands)**
- `kill-all` - Kill all processes
- `kill-backend` - Kill backend
- `kill-frontend` - Kill frontend
- `kill-port` - Kill specific port
- `restart-all` - Restart all
- `restart-backend` - Restart backend
- `restart-frontend` - Restart frontend
- `restart-backend-dev` - Quick restart
- `ps-backend` - Check backend status
- `ps-frontend` - Check frontend status

**7. Logging (5 commands)**
- `logs-all` - View all logs
- `logs-backend` - View backend logs
- `logs-backend-follow` - Follow backend logs
- `logs-frontend` - View frontend logs
- `logs-frontend-follow` - Follow frontend logs

**8. Code Quality (5 commands)**
- `lint` - Run linters
- `lint-frontend` - Frontend linter
- `fmt` - Format code
- `vet` - Go vet
- `tidy` - Go mod tidy

**9. Status & Health (4 commands)**
- `status` - System status
- `health` - Health check
- `api-status` - API status
- Various ps-* commands (counted above)

**10. Test Data (3 commands)**
- `test-fixtures` - Apply test fixtures
- `reset-test-data` - Reset test data
- `reload-test-data` - Full reload

**11. Build Commands (4 commands)**
- `build` - Build backend
- `build-binary` - Build to binary
- `build-frontend` - Build frontend
- `ci-build` - CI build

**12. API Testing Commands (13+ commands)**
- `api-health` - API health check
- `api-status` - API status
- `api-login`, `api-login-gm`, `api-login-player` - Login commands
- `api-test-token` - Test token
- `api-games`, `api-game` - Game API
- `api-characters` - Characters API
- `api-posts`, `api-comments` - Posts/comments
- `api-create-post`, `api-create-comment` - Create operations
- `api-test-mentions` - Test mentions

**13. Miscellaneous (5 commands)**
- `help` - Show commands
- `claude` - Launch Claude Code
- `clean` - Cleanup
- `sqlgen` - Generate SQL code
- `preview-frontend` - Preview frontend build

## Consolidation Strategy

### Keep As-Is (15 core commands)

Essential daily commands that are clear and well-named:

1. `dev` - Primary development command
2. `dev-setup` - Onboarding
3. `build` - Primary build
4. `sqlgen` - Code generation
5. `test` - Default backend test
6. `test-frontend` - Default frontend test
7. `e2e` - Default E2E test
8. `migrate` - Default migration
9. `lint` - Code quality
10. `fmt` - Formatting
11. `status` - System status
12. `clean` - Cleanup
13. `help` - Show help
14. `test-fixtures` - Load test data
15. `tidy` - Go dependencies

### Consolidate with Parameters (10 new commands)

#### 1. `db` - Database operations
```bash
just db [up|down|reset|create|setup]
```
Consolidates 5 commands: db_up, db_down, db_reset, db_create, db_setup

#### 2. `migration` - Migration management
```bash
just migration [create <name>|status|rollback|test]
```
Consolidates 4 commands: make_migration, migrate_status, rollback, migrate_test

#### 3. `test-backend` - Backend testing with options
```bash
just test-backend [--mocks|--integration|--race|--coverage|--bench|--verbose|--all|--clean]
```
Consolidates 9 commands: test-mocks, test-integration, test-race, test-coverage, test-bench, test-verbose, test-all, test-clean, quick-test

#### 4. `test-fe` - Frontend testing with options
```bash
just test-fe [--watch|--coverage|--ui|file]
```
Consolidates 4 commands: test-frontend-watch, test-frontend-coverage, test-frontend-ui, test-frontend-file

#### 5. `e2e-test` - E2E testing with options
```bash
just e2e-test [--headed|--ui|--debug|--report|file]
```
Consolidates 4 commands: e2e-headed, e2e-ui, e2e-debug, e2e-report

#### 6. `logs` - Log viewing
```bash
just logs [backend|frontend|all] [--follow]
```
Consolidates 5 commands: logs-backend, logs-frontend, logs-all, logs-backend-follow, logs-frontend-follow

#### 7. `kill` - Process management
```bash
just kill [backend|frontend|all|port <number>]
```
Consolidates 4 commands: kill-backend, kill-frontend, kill-all, kill-port

#### 8. `restart` - Restart services
```bash
just restart [backend|frontend|all] [--dev]
```
Consolidates 4 commands: restart-backend, restart-frontend, restart-all, restart-backend-dev

#### 9. `start` - Start services
```bash
just start [backend|frontend|all]
```
Consolidates 3 commands: run, run-frontend, dev-full

#### 10. `build-all` - Build with options
```bash
just build-all [backend|frontend|all] [--ci]
```
Consolidates 3 commands: build-frontend, build-binary, ci-build

### Remove/Archive (API Testing Commands)

Move to separate script: `scripts/api-test.sh`

These are development utilities, not core workflow commands:
- All `api-*` commands (13 commands)
- Move to: `backend/scripts/api-test.sh` with subcommands

### Remove Redundant (Process Status)

Remove these as `status` covers it:
- `ps-backend` - use `status` instead
- `ps-frontend` - use `status` instead
- `health` - redundant with `status`
- `api-status` - move to api-test script

### Final Command Count

**Core Commands (15)**: Keep as-is
**Consolidated Commands (10)**: New parameterized commands
**Removed**: 68 commands (moved to scripts or consolidated)

**Total: 25 commands** (meets target of ~30)

## Implementation Plan

### Phase 1: Analysis & Documentation (30 min)
- [x] Analyze all 93 commands
- [x] Categorize by function
- [x] Create consolidation mapping
- [ ] Get user approval

### Phase 2: API Testing Extraction (30 min)
- [ ] Create `backend/scripts/api-test.sh`
- [ ] Move all API testing logic
- [ ] Document usage in script
- [ ] Test extraction

### Phase 3: Create Consolidated Commands (1 hour)
- [ ] Implement `db` command with subcommands
- [ ] Implement `migration` command
- [ ] Implement `test-backend` with flags
- [ ] Implement `test-fe` with flags
- [ ] Implement `e2e-test` with flags
- [ ] Implement `logs` command
- [ ] Implement `kill` command
- [ ] Implement `restart` command
- [ ] Implement `start` command
- [ ] Implement `build-all` command

### Phase 4: Remove Old Commands (15 min)
- [ ] Comment out old commands (don't delete yet)
- [ ] Add deprecation notices
- [ ] Test new commands

### Phase 5: Documentation & Testing (30 min)
- [ ] Update README.md with new commands
- [ ] Create migration guide
- [ ] Test all consolidated commands
- [ ] Verify CI still works

### Phase 6: Cleanup (15 min)
- [ ] Remove commented old commands
- [ ] Update docs
- [ ] Commit changes

## Migration Guide

### Before → After Mapping

**Database:**
```bash
# Before
just db_up
just db_down
just db_reset
just db_create
just db_setup

# After
just db up
just db down
just db reset
just db create
just db setup
```

**Migrations:**
```bash
# Before
just make_migration add_users
just migrate_status
just migrate_test
just rollback

# After
just migration create add_users
just migration status
just migration test
just migration rollback
```

**Backend Testing:**
```bash
# Before
just test-mocks
just test-integration
just test-race
just test-coverage

# After
just test-backend --mocks
just test-backend --integration
just test-backend --race
just test-backend --coverage
```

**Frontend Testing:**
```bash
# Before
just test-frontend-watch
just test-frontend-coverage
just test-frontend-ui

# After
just test-fe --watch
just test-fe --coverage
just test-fe --ui
```

**E2E Testing:**
```bash
# Before
just e2e-headed
just e2e-ui
just e2e-debug

# After
just e2e-test --headed
just e2e-test --ui
just e2e-test --debug
```

**Logs:**
```bash
# Before
just logs-backend
just logs-frontend
just logs-backend-follow

# After
just logs backend
just logs frontend
just logs backend --follow
```

**Process Management:**
```bash
# Before
just kill-backend
just kill-frontend
just restart-all

# After
just kill backend
just kill frontend
just restart all
```

**API Testing (moved to script):**
```bash
# Before
just api-login
just api-games
just api-test-mentions

# After
./backend/scripts/api-test.sh login
./backend/scripts/api-test.sh games
./backend/scripts/api-test.sh test-mentions
```

## Success Criteria

- [x] Commands reduced from 93 to ~25-30
- [ ] All essential workflows still supported
- [ ] Consistent naming patterns
- [ ] Clear command hierarchy
- [ ] Easier command discovery
- [ ] Better onboarding experience
- [ ] CI/CD still works
- [ ] No breaking changes for core workflows

## Risks & Mitigation

**Risk**: Breaking existing workflows
**Mitigation**: Keep old commands as aliases for 1 release, show deprecation warnings

**Risk**: CI/CD pipelines break
**Mitigation**: Update CI scripts in same commit, test thoroughly

**Risk**: Team resistance to change
**Mitigation**: Provide clear migration guide, keep common patterns

**Risk**: Lost functionality
**Mitigation**: Comprehensive testing before removing old commands

## Next Steps

1. Get approval for consolidation plan
2. Create backup branch
3. Implement Phase 2 (API testing extraction)
4. Implement Phase 3 (consolidated commands)
5. Test thoroughly
6. Update documentation
7. Merge and announce changes

---

**Status**: Planning Complete - Awaiting Approval
**Estimated Time**: 3-4 hours total
**Risk Level**: Low (can roll back easily)
