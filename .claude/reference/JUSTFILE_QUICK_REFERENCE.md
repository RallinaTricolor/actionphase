# Justfile Quick Reference

Quick reference for the most commonly used justfile commands during development.

## 🚀 Quick Start

```bash
just status          # Check status of all services
just health          # Quick health check
just restart-all     # Restart backend + frontend
```

## 🔧 Backend Commands

### Process Management
```bash
just build-binary           # Build backend binary to /tmp
just restart-backend        # Kill, rebuild, and restart backend
just restart-backend-dev    # Restart using go run (slower)
just kill-backend           # Stop backend process
just ps-backend             # Check backend status
```

### Logs
```bash
just logs-backend           # View last 50 lines
just logs-backend 100       # View last 100 lines
just logs-backend-follow    # Follow logs in real-time
```

### Development
```bash
just run                    # Start backend with go run
just build                  # Build backend packages
just lint                   # Format and vet code
```

## 🎨 Frontend Commands

### Process Management
```bash
just restart-frontend       # Kill and restart frontend
just kill-frontend          # Stop frontend dev server
just ps-frontend            # Check frontend status
```

### Logs
```bash
just logs-frontend          # View last 50 lines
just logs-frontend 100      # View last 100 lines
just logs-frontend-follow   # Follow logs in real-time
```

### Development
```bash
just run-frontend           # Start frontend dev server
just build-frontend         # Build frontend for production
```

## 🧪 Testing Commands

### Backend Testing
```bash
just test                   # Run all backend tests
just test-mocks             # Fast unit tests (no DB)
just test-race              # Run with race detection
just test-coverage          # Generate coverage report
```

### Frontend Testing
```bash
just test-frontend          # Run frontend tests
just test-frontend-watch    # Watch mode
just test-frontend-coverage # Coverage report
```

### E2E Testing
```bash
just e2e                    # Run E2E tests (headless)
just e2e-ui                 # Run with Playwright UI
just e2e-report             # Show test report
```

## 🗄️ Database Commands

```bash
just db_up                  # Start database container
just migrate                # Run migrations
just test-fixtures          # Load test data
just reload-test-data       # Reset and reload test data
```

## 🌐 API Testing Commands

### Authentication
```bash
just api-login-player       # Login as TestPlayer1
just api-login-gm           # Login as TestGM
just api-test-token         # Check if token is valid
```

### API Calls
```bash
just api-health             # Check backend health
just api-games              # List games
just api-characters 164     # Get characters in game 164
just api-posts 164          # Get posts for game 164
just api-comments 183       # Get comments for post 183
```

### Testing
```bash
just api-test-mentions      # Test mentions feature end-to-end
just api-status             # Quick API status check
```

## 🛠️ Utility Commands

### System Management
```bash
just status                 # Comprehensive system status
just health                 # Quick health check (all services)
just restart-all            # Restart backend + frontend
just kill-all               # Stop all services
just kill-port 3000         # Kill process on specific port
```

### Logs
```bash
just logs-all               # View logs from all services
```

### Cleanup
```bash
just clean                  # Clean build artifacts
```

## 📊 Common Workflows

### Starting Development

```bash
# Option 1: Start everything
just db_up
just restart-backend
just restart-frontend

# Option 2: Use dev-full (starts backend + frontend together)
just dev-full
```

### After Making Backend Changes

```bash
just restart-backend        # Fast restart with binary
just logs-backend-follow    # Watch logs for errors
```

### After Making Frontend Changes

The frontend dev server auto-reloads, but if needed:
```bash
just restart-frontend       # Restart frontend
just logs-frontend-follow   # Watch for errors
```

### Debugging Issues

```bash
# Check what's running
just status

# Check specific service
just ps-backend
just ps-frontend

# View logs
just logs-backend 100
just logs-frontend 100

# Kill stuck processes
just kill-port 3000         # Backend
just kill-port 5173         # Frontend
```

### Testing Workflow

```bash
# Backend: Run tests before committing
just test

# Frontend: Run tests in watch mode while developing
just test-frontend-watch

# E2E: Run after backend + frontend changes
just e2e
```

### API Testing Workflow

```bash
# 1. Login
just api-login-player

# 2. Test endpoint
just api-games

# 3. Test specific feature
just api-test-mentions

# 4. Check logs if issues
just logs-backend
```

## 🔍 Troubleshooting

### Backend won't start

```bash
# Check what's using port 3000
just ps-backend

# Kill it
just kill-port 3000

# Restart
just restart-backend

# Check logs
just logs-backend
```

### Frontend won't start

```bash
# Check what's using port 5173
just ps-frontend

# Kill it
just kill-port 5173

# Restart
just restart-frontend

# Check logs
just logs-frontend
```

### Database connection issues

```bash
# Check if database is running
docker ps | grep actionphase-db

# Start database
just db_up

# Check migration status
just migrate_status
```

### Token expired for API testing

```bash
# Get new token
just api-login-player

# Verify it works
just api-test-token
```

## 💡 Tips

1. **Use `just --list`** to see all available commands
2. **Logs are saved to `/tmp/`** - backend.log and frontend.log
3. **Binaries are built to `/tmp/`** - actionphase-backend
4. **Use `just status`** when starting a session to see what's running
5. **Use `just health`** for a quick sanity check
6. **Use `just restart-all`** when switching git branches with schema changes
7. **API token is saved to `/tmp/api-token.txt`** - reused across commands
8. **Add ` 2>&1 | tee /tmp/output.log`** to any command to save output

## 🎯 Most Used Commands (Top 10)

Based on common development workflows:

1. `just restart-backend` - After backend code changes
2. `just logs-backend-follow` - Debugging backend
3. `just test` - Before committing
4. `just api-login-player` - API testing
5. `just status` - Check system state
6. `just test-frontend-watch` - Frontend TDD
7. `just e2e` - Integration testing
8. `just reload-test-data` - Reset test data
9. `just health` - Quick sanity check
10. `just kill-all` - Clean slate restart

## 📝 Command Naming Convention

- `just COMMAND` - Simple action (build, test, run)
- `just COMMAND-SERVICE` - Service-specific action (logs-backend, kill-frontend)
- `just COMMAND-all` - Apply to all services (restart-all, logs-all)
- `just api-COMMAND` - API testing commands (api-login, api-games)
- `just ps-SERVICE` - Check process status (ps-backend, ps-frontend)
