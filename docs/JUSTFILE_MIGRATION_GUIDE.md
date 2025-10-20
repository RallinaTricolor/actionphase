# Justfile Simplification - Migration Guide

**Date**: 2025-10-19
**Change**: Reduced from 93 → 34 commands
**Impact**: Breaking changes - command syntax has changed

## Summary

The justfile has been significantly simplified to improve discoverability and consistency. Commands are now organized with subcommands and flags rather than having many individual commands.

### Key Changes

- **93 → 34 commands** (63% reduction)
- **Consolidated commands** using subcommands (e.g., `just db up` instead of `just db_up`)
- **API testing moved** to `backend/scripts/api-test.sh`
- **Consistent patterns** across all commands

---

## Quick Migration Reference

### Database Commands

```bash
# Before              →  After
just db_up            →  just db up
just db_down          →  just db down
just db_reset         →  just db reset
just db_create        →  just db create
just db_setup         →  just db setup
```

### Migration Commands

```bash
# Before                          →  After
just make_migration add_users     →  just migration create add_users
just migrate_status               →  just migration status
just migrate_test                 →  just migration test
just rollback                     →  just migration rollback

# Unchanged
just migrate                      →  just migrate
```

### Backend Testing

```bash
# Before                 →  After
just test-mocks         →  just test-backend --mocks
just test-integration   →  just test-backend --integration
just test-race          →  just test-backend --race
just test-coverage      →  just test-backend --coverage
just test-bench         →  just test-backend --bench
just test-verbose       →  just test-backend --verbose
just test-all           →  just test-backend --all
just test-clean         →  just test-backend --clean
just test-no-db         →  just test-backend --mocks (same thing)
just test-service NAME  →  just test-backend --service=NAME
just quick-test         →  just test-backend --mocks
just full-test          →  just test-all

# Unchanged (default behavior)
just test               →  just test (runs mocks only)
```

### Frontend Testing

```bash
# Before                      →  After
just test-frontend           →  just test-frontend  (or: just test-fe run)
just test-frontend-watch     →  just test-fe watch
just test-frontend-coverage  →  just test-fe coverage
just test-frontend-ui        →  just test-fe ui
just test-frontend-file PATH →  just test-fe file PATH
just setup-frontend-tests    →  (removed - no longer needed)
```

### E2E Testing

```bash
# Before              →  After
just e2e             →  just e2e  (or: just e2e-test headless)
just e2e-headed      →  just e2e-test headed
just e2e-ui          →  just e2e-test ui
just e2e-debug       →  just e2e-test debug
just e2e-report      →  just e2e-test report
just e2e-test FILE   →  just e2e-test file FILE
```

### Process Management

```bash
# Before               →  After
just kill-backend     →  just kill backend
just kill-frontend    →  just kill frontend
just kill-all         →  just kill all
just kill-port 3000   →  just kill port 3000

just restart-backend  →  just restart backend
just restart-frontend →  just restart frontend
just restart-all      →  just restart all
just restart-backend-dev  →  just restart backend
```

### Logging

```bash
# Before                    →  After
just logs-backend           →  just logs backend
just logs-backend 100       →  just logs backend 100
just logs-backend-follow    →  just logs backend 50 --follow
just logs-frontend          →  just logs frontend
just logs-frontend-follow   →  just logs frontend 50 --follow
just logs-all               →  just logs all
```

### Build Commands

```bash
# Before              →  After
just build           →  just build (backend only, unchanged)
just build-frontend  →  just build-all frontend
just build-binary    →  just build-all binary
just ci-build        →  just build-all ci
```

### Test Data

```bash
# Before              →  After
just test-fixtures   →  just test-fixtures (unchanged)
just reset-test-data →  just test-data reset
just reload-test-data→  just test-data reload (or just: just test-data)
```

### Development Workflow

```bash
# Before       →  After
just dev      →  just dev (backend only, unchanged)
just dev-full →  just start all
just run      →  just start backend (or just: just dev)
just run-frontend  →  just start frontend
```

### API Testing (Moved to Script)

```bash
# Before                →  After
just api-login         →  ./backend/scripts/api-test.sh login
just api-login-gm      →  ./backend/scripts/api-test.sh login-gm
just api-login-player  →  ./backend/scripts/api-test.sh login-player
just api-health        →  ./backend/scripts/api-test.sh health
just api-test-token    →  ./backend/scripts/api-test.sh test-token
just api-games         →  ./backend/scripts/api-test.sh games
just api-game 164      →  ./backend/scripts/api-test.sh game 164
just api-characters 164→  ./backend/scripts/api-test.sh characters 164
just api-posts 164     →  ./backend/scripts/api-test.sh posts 164
just api-comments POST →  ./backend/scripts/api-test.sh comments POST
just api-create-post   →  ./backend/scripts/api-test.sh create-post
just api-create-comment→  ./backend/scripts/api-test.sh create-comment
just api-test-mentions →  ./backend/scripts/api-test.sh test-mentions
just api-status        →  ./backend/scripts/api-test.sh status
```

### Status & Health

```bash
# Before      →  After
just status  →  just status (unchanged)
just health  →  (removed - use: just status)
just ps-backend  →  (removed - use: just status)
just ps-frontend →  (removed - use: just status)
```

### Code Quality

```bash
# Before            →  After
just lint          →  just lint (unchanged)
just lint-frontend →  just lint-frontend (unchanged)
just fmt           →  just fmt (unchanged)
just vet           →  just vet (unchanged)
just tidy          →  just tidy (unchanged)
```

### Miscellaneous

```bash
# Before               →  After
just help             →  just help (or just: just --list)
just clean            →  just clean (unchanged)
just sqlgen           →  just sqlgen (unchanged)
just install-frontend →  just install-frontend (unchanged)
just preview-frontend →  just preview-frontend (unchanged)
just claude           →  just claude (unchanged)
```

---

## New Command Patterns

### Getting Help

All commands with subcommands provide help:

```bash
just db help              # Show database command options
just migration help       # Show migration command options
just test-backend --help  # Show test options (will show usage error)
just logs help            # Show logging options
```

### Command Flags

Some commands now use flags instead of separate commands:

```bash
# Testing flags
just test-backend --mocks
just test-backend --integration
just test-backend --race
just test-backend --coverage
just test-backend --bench
just test-backend --all

# Multiple flags can be combined
just test-backend --integration --race --coverage
```

### Subcommands

Many commands now use subcommands for better organization:

```bash
# Database operations
just db [up|down|reset|create|setup]

# Migrations
just migration [create|status|rollback|test]

# Testing
just test-fe [run|watch|coverage|ui|file]
just e2e-test [headless|headed|ui|debug|report|file]

# Process management
just kill [backend|frontend|all|port]
just restart [backend|frontend|all]
just start [backend|frontend|all]
just logs [backend|frontend|all]

# Test data
just test-data [reset|reload]

# Build
just build-all [backend|frontend|all|binary|ci]
```

---

## Common Workflows

### Daily Development

```bash
# Start development
just dev-setup          # First time only
just migrate            # Apply migrations
just dev                # Start backend

# Or start everything
just db up
just start all          # Backend + frontend
```

### Running Tests

```bash
# Backend tests
just test                        # Quick unit tests (default)
just test-backend --integration  # Integration tests
just test-backend --all          # All tests
just test-backend --coverage     # With coverage

# Frontend tests
just test-frontend               # Run once
just test-fe watch               # Watch mode
just test-fe coverage            # With coverage

# E2E tests
just e2e                         # Headless
just e2e-test headed             # With browser
just e2e-test ui                 # Interactive
```

### Database Management

```bash
# Setup
just db setup                    # Create databases

# Migrations
just migrate                     # Apply to dev
just migration test              # Apply to test DB
just migration create add_users  # Create new
just migration status            # Check status

# Test data
just test-fixtures               # Load fixtures
just test-data reload            # Reset and reload
```

### Debugging

```bash
# Check status
just status                      # Full system status

# View logs
just logs backend                # Last 50 lines
just logs backend 100            # Last 100 lines
just logs backend 50 --follow    # Follow in real-time

# Restart services
just restart backend             # Restart backend
just restart all                 # Restart everything

# Kill stuck processes
just kill all                    # Kill all
just kill port 3000              # Kill specific port
```

---

## Breaking Changes

### Removed Commands

These commands have been removed (use alternatives):

- `ps-backend` → Use `just status` instead
- `ps-frontend` → Use `just status` instead
- `health` → Use `just status` instead
- `test-db-setup` → Database setup is automatic
- `test-parallel` → Use `just test-backend --all` instead
- `setup-frontend-tests` → No longer needed
- All `api-*` commands → Use `./backend/scripts/api-test.sh` instead

### Syntax Changes

- Database commands use spaces: `just db up` not `just db_up`
- Test commands use flags: `just test-backend --mocks` not `just test-mocks`
- Logging uses spaces: `just logs backend` not `just logs-backend`

---

## CI/CD Updates

If you have CI/CD pipelines using the old commands, update them:

### GitHub Actions Example

```yaml
# Before
- run: just test-race
- run: just test-coverage
- run: just test-frontend
- run: just e2e-headed

# After
- run: just test-backend --race
- run: just test-backend --coverage
- run: just test-frontend
- run: just e2e-test headed
```

---

## Tips

### Discover Commands

```bash
just --list              # Show all commands
just help                # Same as --list
just db help             # Help for specific command
```

### Shell Completion

Add to your `.bashrc` or `.zshrc`:

```bash
# Bash
eval "$(just --completions bash)"

# Zsh
eval "$(just --completions zsh)"
```

### Aliases

Create shell aliases for frequently used commands:

```bash
alias jt="just test"
alias jti="just test-backend --integration"
alias jtf="just test-fe watch"
alias je="just e2e"
alias jd="just dev"
```

---

## Getting Help

- **Full command list**: `just --list`
- **Specific command help**: Most commands show usage when called incorrectly
- **API testing help**: `./backend/scripts/api-test.sh help`
- **Documentation**: `/docs/JUSTFILE_MIGRATION_GUIDE.md`

---

## Rollback

If you need to revert to the old justfile:

```bash
cp justfile.backup justfile
```

The backup is located at: `justfile.backup`

---

## Feedback

If you encounter issues or have suggestions, please:
1. Check this migration guide
2. Try `just --list` to see available commands
3. Report issues with the new command structure

---

**Last Updated**: 2025-10-19
**Version**: 2.0 (Consolidated)
