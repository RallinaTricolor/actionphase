# Testing Guide

This guide explains how to run the different types of tests in the ActionPhase backend.

## Quick Start

### Fast Unit Tests (No Database Required)
```bash
# Run only mock-based tests - fastest option
just test-mocks

# Alternative: Run mock tests only
just test-no-db
```

### Full Test Suite (Requires Database)
```bash
# Set up test database (one-time setup)
just test-db-setup

# Run all tests
just test

# Run tests in parallel for speed
just test-parallel
```

## Test Types

### 1. Mock Tests 🚀 **FASTEST**
- **Runtime**: < 1 second
- **Requirements**: None
- **Purpose**: Unit testing service logic with mocked dependencies

```bash
just test-mocks
```

These tests use in-memory mocks and don't require any external dependencies. Perfect for:
- TDD/rapid development
- CI/CD environments
- Local development without database setup

### 2. Integration Tests 🐢 **COMPREHENSIVE**
- **Runtime**: Several seconds
- **Requirements**: PostgreSQL database
- **Purpose**: Testing full request/response flows

```bash
# Setup (one time)
just test-db-setup

# Run integration tests
just test-integration
```

These tests use a real database and test the full stack including:
- HTTP endpoints
- Database operations
- Authentication flows
- Data persistence

### 3. All Tests 🔄 **COMPLETE**
- **Runtime**: Varies based on database setup
- **Requirements**: PostgreSQL database (optional - skips DB tests if unavailable)
- **Purpose**: Complete test coverage

```bash
just test              # All tests (sequential)
just test-parallel     # All tests (parallel - faster)
```

## Database Setup

### Option 1: Local PostgreSQL
```bash
# Install PostgreSQL (if not installed)
brew install postgresql  # macOS
sudo apt install postgresql  # Ubuntu

# Create test database
just test-db-setup
```

### Option 2: Docker PostgreSQL
```bash
# Start database container
just db_up

# Create test database
createdb actionphase_test
```

### Option 3: Skip Database Tests
```bash
# Set environment variable to skip all database tests
export SKIP_DB_TESTS=true
just test
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `SKIP_DB_TESTS` | `false` | Skip all tests requiring database |
| `TEST_DATABASE_URL` | `postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable` | Database connection string |

## Test Commands Reference

| Command | Description | Speed | Database Required |
|---------|-------------|-------|-------------------|
| `just test-mocks` | Mock-based unit tests only | ⚡ Fastest | ❌ No |
| `just test-no-db` | Alternative mock-only tests | ⚡ Fastest | ❌ No |
| `just test-integration` | Integration tests only | 🐢 Slow | ✅ Yes |
| `just test` | All tests (sequential) | 🐢 Slow | ⚠️ Optional |
| `just test-parallel` | All tests (parallel) | ⚡ Fast | ⚠️ Optional |
| `just test-verbose` | All tests with verbose output | 🐢 Slow | ⚠️ Optional |
| `just test-coverage` | Tests with coverage report | 🐢 Slow | ⚠️ Optional |
| `just test-race` | Tests with race condition detection | 🐢 Slow | ⚠️ Optional |

## Continuous Integration

For CI/CD environments, we recommend:

### Fast CI (PR checks)
```bash
just test-mocks  # Run in ~1 second
```

### Full CI (pre-merge)
```bash
just test-db-setup
just test-parallel
```

## Troubleshooting

### Tests Failing with Database Errors
```
ERROR: database "actionphase_test" does not exist
```

**Solutions:**
1. Create the database: `just test-db-setup`
2. Skip database tests: `export SKIP_DB_TESTS=true`
3. Use mock tests only: `just test-mocks`

### Tests Hanging or Running Slowly
```bash
# Use parallel execution
just test-parallel

# Or run only fast tests
just test-mocks
```

### Connection Refused Errors
```bash
# Check if PostgreSQL is running
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux

# Or use Docker
just db_up
```

## Writing Tests

### Mock-Based Unit Tests
```go
func TestMyService_WithMocks(t *testing.T) {
    t.Parallel() // Always enable parallel execution

    // Use in-memory mocks
    mockRepo := CreateMockDatabaseRepo()

    // Test your service logic
    // ...
}
```

### Integration Tests
```go
func TestMyService_Integration(t *testing.T) {
    t.Parallel() // Always enable parallel execution

    // Use real database (automatically skipped if unavailable)
    testDB := NewTestDatabase(t)
    defer testDB.Close()
    defer testDB.CleanupTables(t)

    // Use test data factories
    factory := NewTestDataFactory(testDB, t)
    user := factory.NewUser().WithUsername("testuser").Create()

    // Test with real database
    // ...
}
```

## Best Practices

1. **Always add `t.Parallel()`** to enable concurrent test execution
2. **Use mocks for unit tests** - faster and more reliable
3. **Use real database for integration tests** - catches real issues
4. **Clean up after tests** - use `defer testDB.CleanupTables(t)`
5. **Make tests independent** - don't rely on execution order
6. **Use factories for test data** - reduces boilerplate and ensures consistency
