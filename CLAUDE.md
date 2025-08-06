# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

ActionPhase is a multi-language gaming platform with three backend implementations:

- **Go Backend** (primary, active development): Modern JWT-based API using Chi router, PostgreSQL with sqlc for type-safe queries
- **Python Backend** (legacy): Django-based REST API with MySQL
- **Modern Frontend** (new): React/TypeScript SPA with Vite, Tailwind CSS, and React Query
- **Legacy Frontend**: React/Redux SPA with custom webpack configuration

The current active development is focused on the Go backend rewrite, which uses:
- Chi router for HTTP routing
- JWT authentication with refresh tokens
- PostgreSQL database with migration support
- sqlc for generating type-safe Go code from SQL queries

## Development Commands

### Quick Start
```bash
# Complete development environment setup
just dev-setup

# Start both backend and frontend servers
just dev

# Check project status (git, db, dependencies)
just status
```

### Go Backend (Primary)
```bash
# Database Management
just db_up                    # Start database
just db_down                  # Stop database
just db_reset                 # Reset database
just migrate_status           # Check migration status

# Code Generation & Dependencies
just sqlgen                   # Generate SQL code from queries
just tidy                     # Clean up Go modules

# Development & Building
just run                      # Run Go server
just build                    # Build all Go packages
just lint                     # Format and vet Go code

# Database Migrations
just make_migration <name>    # Create new migration
just migrate                  # Run database migrations
just rollback                 # Rollback migrations

# Testing
just test                     # Run all backend tests
just test-verbose             # Run tests with verbose output
just test-coverage            # Generate test coverage report
just test-race                # Run tests with race detection
just test-bench               # Run benchmark tests
just test-service <service>   # Test specific service (e.g., games, sessions)
just quick-test               # Run fast tests only
just ci-test                  # Full CI test suite
```

### Modern Frontend (Recommended)
```bash
# Setup & Dependencies
just install-frontend         # Install npm dependencies
just setup-frontend-tests     # Setup testing infrastructure

# Development & Building
just run-frontend             # Development server
just build-frontend           # Build for production
just preview-frontend         # Preview production build
just lint-frontend            # Run ESLint

# Testing
just test-frontend            # Run frontend tests
just test-frontend-watch      # Run tests in watch mode
just test-frontend-coverage   # Generate test coverage
```

### Development Workflows
```bash
# Testing
just ci-test                  # Backend CI test suite (lint + test + race)
just full-test               # All tests (backend + frontend)
just clean                   # Clean build artifacts

# Building
just ci-build                # Build both backend and frontend
```

### Legacy Frontend
```bash
cd frontend

# Development server
npm start

# Build for production
npm run build

# Run tests
npm test
```

### Python Backend (Legacy)
```bash
cd python-backend

# Install dependencies
pip install -r requirements.txt

# Run Django server
python manage.py runserver

# Run tests
./local_tests.sh
```

### Docker Development
```bash
# Full environment setup
docker-compose build
./start_server.sh

# Or if already built
docker-compose up -d
```

## Database Management

The Go backend uses PostgreSQL with golang-migrate for schema management:
- Migrations located in `backend/pkg/db/migrations/`
- Use `just make_migration <name>` to create new migrations
- Database queries in `backend/pkg/db/queries/` generate type-safe Go code via sqlc

## Authentication Architecture

The Go backend implements JWT-based authentication with:
- Access tokens for API requests
- Refresh tokens stored in database sessions
- Automatic token refresh mechanism
- Session management for security

Key files:
- `backend/pkg/auth/jwt.go` - JWT token handling
- `backend/pkg/auth/refresh_token.go` - Token refresh logic
- `backend/pkg/db/services/sessions.go` - Session management

## API Endpoints (Go Backend)

Current available endpoints:
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/refresh` - Refresh JWT token (protected)
- `GET /ping` - Health check

## Frontend Architecture

The modern frontend (`new-frontend/`) uses:
- **Vite** for fast development and building
- **React Router** for client-side routing
- **React Query** for server state management with automatic caching and refetching
- **Axios** with interceptors for JWT token management
- **Tailwind CSS** for utility-first styling
- **TypeScript** for type safety

Key features:
- Automatic JWT token refresh
- Protected routes
- API health monitoring
- Modern responsive UI

## Testing

- Modern Frontend: TypeScript + Vite (testing setup pending)
- Legacy Frontend: Jest with Enzyme for React component testing
- Python Backend: Django test framework with coverage reporting
- Go Backend: Standard Go testing patterns (in development)

## Project Structure Notes

- `justfile` provides common development commands
- Each backend has its own dependency management (go.mod, requirements.txt, package.json)
- Database migrations are environment-specific (Go uses postgres, Python uses MySQL)
- Frontend communicates with backend via REST API with JWT authentication

## AI-Friendly Coding Standards

To maintain AI comprehensibility as the codebase scales, follow these patterns:

### Go Backend Standards

#### Interface-First Development
- **ALWAYS** define service interfaces in `backend/pkg/core/interfaces.go` before implementation
- Use compile-time interface verification: `var _ InterfaceName = (*ImplementationType)(nil)`
- Request/response types belong in `core` package for reuse across layers

Example:
```go
// In backend/pkg/core/interfaces.go
type UserServiceInterface interface {
    CreateUser(ctx context.Context, user *User) (*User, error)
    GetUser(ctx context.Context, id int) (*User, error)
}

// In backend/pkg/db/services/users.go
var _ core.UserServiceInterface = (*UserService)(nil)

type UserService struct {
    DB *pgxpool.Pool
}
```

#### Documentation Requirements
- All public functions MUST have Go doc comments
- Complex business logic MUST be documented inline
- Package-level comments required for all packages

#### Error Handling
- Use typed errors with context information
- Consistent error response formats via `core.APIError`
- Return meaningful error messages for API consumers

#### Testing Standards (Implementation Pending)
- All services MUST have unit tests with interface mocks
- Integration tests for database operations
- API endpoint tests for all handlers

### Frontend Standards

#### TypeScript Requirements
- Strict mode MUST be enabled
- All components MUST have proper type definitions
- API client methods MUST be type-safe

#### Component Organization
- One component per file
- Props interfaces defined inline or in types file
- Custom hooks in dedicated `hooks/` directory

#### Testing Standards (Implementation Pending)
- All components MUST have tests using React Testing Library
- Custom hooks MUST have dedicated tests
- API integration tests for critical flows

### General Standards

#### Naming Conventions
- Use descriptive, unambiguous names
- Follow language idioms (camelCase for TS/JS, PascalCase for Go exported)
- Database columns use snake_case, Go structs use PascalCase

#### File Organization
- Group related functionality in packages/directories
- Keep files focused on single responsibility
- Use consistent import ordering

#### Configuration Management
- Environment variables MUST be validated at startup
- No hardcoded secrets or configuration values
- Configuration structs with proper defaults

### Progress Tracking

See `AI_FRIENDLY_IMPROVEMENTS.md` for current improvement status and roadmap.
