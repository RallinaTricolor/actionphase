# Justfile Quick Reference

Quick reference for the actual justfile commands available in ActionPhase.

**Last Updated**: October 27, 2025
**Last Verified**: October 27, 2025

## 🚀 Quick Start

```bash
just help           # Show all available commands
just dev-setup      # Complete setup (database + environment + dependencies)
just dev            # Start backend development server
just status         # Check system status
```

## 📦 Development Commands

### Environment Setup
```bash
just dev-setup      # Complete development environment setup
just dev            # Start backend server with .env loading
just claude         # Open Claude Code in browser
```

### Code Quality
```bash
just fmt            # Format Go code
just vet            # Run Go vet
just lint           # Format and vet code
just tidy           # Clean up go.mod
just build          # Build backend packages
```

### Frontend
```bash
just install-frontend    # Install frontend dependencies
just test-frontend       # Run frontend tests
just lint-frontend       # Lint frontend code
just preview-frontend    # Preview production build
```

## 🗄️ Database Commands

### Migrations
```bash
just migrate        # Apply database migrations to actionphase database
just sqlgen         # Generate Go code from SQL queries
```

### Test Data
```bash
just test-fixtures  # Load standard test fixtures
just load-common    # Load common test data
just load-demo      # Load demo data
just load-e2e       # Load E2E test fixtures
just load-all       # Load all test data
```

## 🧪 Testing Commands

### Backend Testing
```bash
just test           # Run all backend tests
just test-mocks     # Fast unit tests (no database required)
just test-integration  # Integration tests (requires database)
just test-coverage  # Generate coverage report
just test-race      # Run tests with race detection
just test-clean     # Clean test cache
```

### Frontend Testing
```bash
just test-frontend  # Run frontend tests
```

### E2E Testing
```bash
just e2e            # Run Playwright E2E tests
```

### Complete Test Suite
```bash
just test-all       # Run all tests (backend + frontend + E2E)
just ci-test        # Full CI test suite (lint + test + race)
```

## 🛠️ Utility Commands

```bash
just status         # Check system status
just clean          # Clean build artifacts
just help           # Show all available commands
```

## 📊 Common Workflows

### Starting Development

```bash
# First time setup
just dev-setup

# Daily development
just migrate        # Apply any new migrations
just dev            # Start backend
# In another terminal:
cd frontend && npm run dev  # Start frontend
```

### Running Tests

```bash
# Quick feedback during development
just test-mocks     # < 1 second

# Before committing
just test           # Full backend tests
just test-frontend  # Frontend tests

# Before merging
just ci-test        # Complete CI suite
```

### Working with Database

```bash
# Apply migrations
just migrate

# Load test data
just test-fixtures  # Standard test data
just load-e2e       # E2E test data

# After schema changes
just sqlgen         # Regenerate Go code
```

### API Testing

The justfile doesn't include API testing commands. Use the script directly:

```bash
# Login and save token
./backend/scripts/api-test.sh login-player

# Use saved token
curl -s -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
  "http://localhost:3000/api/v1/games" | jq '.'
```

## 📝 Notes

- Database name is `actionphase` (not `database`)
- Backend runs on port 3000
- Frontend runs on port 5173
- Test fixtures use password: `testpassword123`

## Available Commands (from `just --list`)

```
build              # Build backend packages
ci-test            # Full CI test suite
claude             # Open Claude Code
clean              # Clean artifacts
dev                # Start backend development server
dev-setup          # Complete setup
e2e                # Run E2E tests
fmt                # Format code
help               # Show help
install-frontend   # Install frontend dependencies
lint               # Lint backend code
lint-frontend      # Lint frontend code
load-all           # Load all fixtures
load-common        # Load common fixtures
load-demo          # Load demo data
load-e2e           # Load E2E fixtures
migrate            # Run migrations
preview-frontend   # Preview frontend build
sqlgen             # Generate from SQL
status             # System status
test               # Run backend tests
test-all           # Run all tests
test-clean         # Clean test cache
test-coverage      # Coverage report
test-fixtures      # Load test fixtures
test-frontend      # Run frontend tests
test-integration   # Integration tests
test-mocks         # Mock tests (fast)
test-race          # Race detection
tidy               # Clean go.mod
vet                # Run go vet
```
