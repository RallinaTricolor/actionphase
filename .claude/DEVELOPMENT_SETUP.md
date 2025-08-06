# ActionPhase Development Setup Guide

This guide will help you set up a complete ActionPhase development environment with Docker database integration and proper environment variable management.

## Quick Start (5 minutes)

```bash
# 1. Clone and navigate to project
git clone <repository-url>
cd actionphase

# 2. Complete development setup (includes database)
just dev-setup

# 3. Run migrations
just migrate

# 4. Start development server
just dev
```

Your backend will be running at `http://localhost:3000` 🚀

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Tools

- **Docker & Docker Compose** - For PostgreSQL database
  ```bash
  # macOS (with Homebrew)
  brew install docker docker-compose

  # Ubuntu/Debian
  sudo apt install docker.io docker-compose

  # Windows: Download Docker Desktop from docker.com
  ```

- **Go 1.21+** - For backend development
  ```bash
  # macOS (with Homebrew)
  brew install go

  # Ubuntu/Debian
  sudo apt install golang-go

  # Windows: Download from golang.org
  ```

- **PostgreSQL Client Tools** - For database management
  ```bash
  # macOS (with Homebrew)
  brew install postgresql

  # Ubuntu/Debian
  sudo apt install postgresql-client

  # Windows: Include with PostgreSQL installation
  ```

- **Just** - Task runner (like Make but better)
  ```bash
  # macOS (with Homebrew)
  brew install just

  # Other platforms: See https://github.com/casey/just#installation
  ```

- **golang-migrate** - Database migrations
  ```bash
  # macOS (with Homebrew)
  brew install golang-migrate

  # Other platforms: See https://github.com/golang-migrate/migrate#installation
  ```

### Optional (but recommended)

- **Node.js & npm** - For frontend development
- **Git** - Version control

## Environment Setup

### 1. Environment Variables (.env file)

ActionPhase uses environment variables for configuration. A working `.env` file is included in the repository with secure defaults for local development.

#### Default .env Configuration

The provided `.env` file includes:
```bash
# Database (works with docker-compose.yml)
DATABASE_URL="postgres://postgres:example@localhost:5432/actionphase?sslmode=disable"
TEST_DATABASE_URL="postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable"

# JWT Authentication
JWT_SECRET="dev-jwt-secret-key-not-for-production-use-only-12345"

# Application Settings
ENVIRONMENT=development
LOG_LEVEL=info
PORT=3000
```

#### Customizing Environment Variables

1. **For different database credentials:**
   ```bash
   # Edit .env file
   DATABASE_URL="postgres://your-user:your-password@localhost:5432/your-database"
   ```

2. **For production deployment:**
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production values
   # Use strong JWT_SECRET, set ENVIRONMENT=production, etc.
   ```

3. **For different ports/hosts:**
   ```bash
   PORT=8080
   HOST=127.0.0.1
   ```

#### Environment Variable Reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | *See .env* | Main database connection string |
| `TEST_DATABASE_URL` | *See .env* | Test database connection string |
| `JWT_SECRET` | *Dev key* | JWT token signing key (change for production!) |
| `ENVIRONMENT` | `development` | Deployment environment (development/staging/production) |
| `LOG_LEVEL` | `info` | Logging verbosity (debug/info/warn/error) |
| `PORT` | `3000` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server bind address |
| `RUN_MIGRATIONS` | `true` | Auto-run migrations on startup |
| `SKIP_DB_TESTS` | `false` | Skip database-dependent tests |

## Database Setup

### Docker-Based Database (Recommended)

ActionPhase uses PostgreSQL in Docker for local development, making setup consistent across all platforms.

#### 1. Start Database

```bash
# Start PostgreSQL container
just db_up

# Container will be available at localhost:5432
# Default credentials: postgres/example (defined in docker-compose.yml)
```

#### 2. Create Databases

```bash
# Create both main and test databases
just db_create

# Or create them manually:
createdb -h localhost -U postgres actionphase
createdb -h localhost -U postgres actionphase_test
# Password: example
```

#### 3. Apply Migrations

```bash
# Apply to main database
just migrate

# Apply to test database
just migrate_test
```

#### 4. Verify Setup

```bash
# Check migration status
just migrate_status

# Should show all migrations applied
```

### Database Commands Reference

| Command | Purpose |
|---------|---------|
| `just db_up` | Start PostgreSQL Docker container |
| `just db_down` | Stop PostgreSQL Docker container |
| `just db_reset` | Restart PostgreSQL (keeps data) |
| `just db_create` | Create actionphase and actionphase_test databases |
| `just db_setup` | Complete database setup (start + create databases) |
| `just migrate` | Apply migrations to main database |
| `just migrate_test` | Apply migrations to test database |
| `just migrate_status` | Check migration status |
| `just rollback` | Rollback last migration |

## Development Workflow

### Starting Development

#### Option 1: Full Automated Setup (recommended for new developers)
```bash
# This does everything: database, env setup, dependencies
just dev-setup

# Then run migrations
just migrate

# Start development server
just dev
```

#### Option 2: Manual Setup (if you prefer step-by-step)
```bash
# 1. Start database
just db_up

# 2. Create databases (if not exists)
just db_create

# 3. Apply migrations
just migrate

# 4. Start backend server
just dev
```

#### Option 3: Quick Restart (after initial setup)
```bash
# Just start everything (assumes database is already set up)
just dev
```

### Development Commands

| Command | Purpose |
|---------|---------|
| `just dev-setup` | Complete setup for new developers |
| `just dev` | Start backend development server |
| `just dev-full` | Start backend + frontend together |
| `just build` | Build Go project |
| `just run` | Run backend without auto-restart |
| `just tidy` | Clean up Go dependencies |

## Testing

ActionPhase has a comprehensive testing strategy with both mock-based unit tests and database integration tests.

### Test Types

#### 1. Mock Tests (Fast - ~0.3 seconds)
```bash
# Run only mock-based unit tests (no database required)
just test-mocks

# Perfect for TDD and rapid development
# Uses in-memory mocks, works without any dependencies
```

#### 2. Integration Tests (Slower - several seconds)
```bash
# Run tests with real database
just test-integration

# Requires PostgreSQL and test database setup
# Tests full request/response flows
```

#### 3. All Tests
```bash
# Run complete test suite
just test

# Automatically skips database tests if DB unavailable
# Run in parallel for speed: just test-parallel
```

### Test Setup

#### Database Tests Setup
```bash
# One-time setup for database tests
just test-db-setup

# This creates test database and applies migrations
# Run this before your first integration test
```

#### Environment Variables for Testing

```bash
# Skip database tests entirely
SKIP_DB_TESTS=true just test

# Use different test database
TEST_DATABASE_URL="postgres://localhost/my_test_db" just test

# Run with debug logging
TEST_LOG_LEVEL=debug just test
```

### Test Commands Reference

| Command | Speed | Database Required | Purpose |
|---------|-------|-------------------|---------|
| `just test-mocks` | ⚡ Fastest | ❌ No | Unit tests with mocks |
| `just test-integration` | 🐢 Slow | ✅ Yes | Integration tests |
| `just test` | 🐢 Slow | ⚠️ Optional | All tests |
| `just test-parallel` | ⚡ Fast | ⚠️ Optional | All tests in parallel |
| `just test-coverage` | 🐢 Slow | ⚠️ Optional | Tests with coverage report |
| `just test-db-setup` | - | ✅ Yes | Setup test database |

## Code Quality

### Linting & Formatting

```bash
# Format Go code
just fmt

# Run Go vet
just vet

# Run both formatting and vetting
just lint

# Build project (includes compile-time checks)
just build
```

### Database Code Generation

ActionPhase uses SQLC for type-safe database queries:

```bash
# Generate Go code from SQL queries
just sqlgen

# Run after modifying files in backend/pkg/db/queries/
# Generated files go to backend/pkg/db/models/
```

### Migration Management

```bash
# Create new migration
just make_migration add_user_preferences

# Apply migrations
just migrate

# Check status
just migrate_status

# Rollback (careful!)
just rollback
```

## Troubleshooting

### Common Issues

#### Database Connection Errors

**Problem:** `connection refused` or `database does not exist`

**Solution:**
```bash
# 1. Ensure Docker is running
docker ps

# 2. Start database
just db_up

# 3. Wait a moment, then create databases
just db_create

# 4. Apply migrations
just migrate
```

#### Tests Failing

**Problem:** Database test failures

**Solution:**
```bash
# Use mock tests during development
just test-mocks

# Or skip database tests
SKIP_DB_TESTS=true just test

# For integration tests, ensure test DB is set up
just test-db-setup
```

#### Environment Variables Not Loading

**Problem:** Application not finding configuration

**Solution:**
```bash
# 1. Ensure .env file exists
ls -la .env

# 2. If missing, copy from example
cp .env.example .env

# 3. Check environment loading
go run main.go
# Should see: "✓ Loaded environment from: /path/to/.env"
```

#### Port Already in Use

**Problem:** `address already in use` error

**Solution:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process (replace PID)
kill <PID>

# Or use different port in .env
PORT=3001
```

### Getting Help

#### Check Application Status
```bash
just status
# Shows git status, database status, and Go modules
```

#### View All Available Commands
```bash
just --list
# Or just: just help
```

#### Log Levels
```bash
# Debug mode (verbose logging)
LOG_LEVEL=debug just dev

# Quiet mode (errors only)
LOG_LEVEL=error just dev
```

### Database Utilities

#### Connect to Database Directly
```bash
# Connect to main database
psql -h localhost -U postgres actionphase
# Password: example

# Connect to test database
psql -h localhost -U postgres actionphase_test
```

#### Reset Database (Nuclear Option)
```bash
# Stop database, remove data, start fresh
just db_down
docker volume rm actionphase_pgdata  # WARNING: Destroys all data
just db_setup
just migrate
```

## Production Considerations

### Environment Variables for Production

1. **Create production .env**:
   ```bash
   cp .env.example .env.production
   ```

2. **Update critical settings**:
   ```bash
   # Strong JWT secret (32+ characters)
   JWT_SECRET="$(openssl rand -base64 32)"

   # Production database URL
   DATABASE_URL="postgres://user:pass@db-host:5432/prod_db?sslmode=require"

   # Production environment
   ENVIRONMENT=production

   # Disable auto-migrations in production
   RUN_MIGRATIONS=false
   ```

3. **Security considerations**:
   - Use strong, unique JWT secret
   - Enable SSL for database connections (`sslmode=require`)
   - Set appropriate CORS origins
   - Use appropriate log levels (`warn` or `error`)

### Deployment Notes

- **Migrations**: Run manually in production (`RUN_MIGRATIONS=false`)
- **Environment**: Never commit real `.env` files to version control
- **Secrets**: Use proper secret management systems
- **Database**: Use managed PostgreSQL services (AWS RDS, etc.)

## Next Steps

After successful setup:

1. **Explore the API**: Backend runs at `http://localhost:3000`
2. **Check health**: Visit `http://localhost:3000/ping`
3. **Review code**: Start with `backend/pkg/core/` for domain models
4. **Run tests**: `just test-mocks` for fast feedback loop
5. **Database management**: Use `just migrate` for schema changes
6. **Frontend**: Set up frontend development (see frontend documentation)

## Architecture Overview

- **Backend**: Go with Chi router, PostgreSQL, JWT auth
- **Database**: PostgreSQL with SQLC for type-safe queries
- **Configuration**: Environment-based with .env support
- **Testing**: Mock-based unit tests + database integration tests
- **Development**: Docker-based database, auto-reload server

For more details, see [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md).

---

## Quick Reference Card

```bash
# Setup (one-time)
just dev-setup && just migrate

# Daily development
just dev                    # Start backend
just test-mocks            # Run fast tests
just db_up                 # Start database
just migrate              # Apply new migrations

# Troubleshooting
just status               # Check everything
just --list              # See all commands
SKIP_DB_TESTS=true just test  # Skip DB tests
```

**Happy coding! 🚀**
