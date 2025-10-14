# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

ActionPhase is a modern gaming platform with Clean Architecture principles:

- **Go Backend**: Modern JWT-based API using Chi router, PostgreSQL with sqlc for type-safe queries
- **React Frontend**: Modern React/TypeScript SPA with Vite, Tailwind CSS, and React Query
- **Database**: PostgreSQL with hybrid relational-document design using JSONB for game data

### Core Architecture Principles
- **Interface-First Development**: All services defined as interfaces in `pkg/core/interfaces.go`
- **Domain-Driven Design**: Clear bounded contexts (auth, games, characters, phases)
- **Clean Architecture**: Dependency inversion with business logic isolated from infrastructure
- **Observability-First**: Structured logging with correlation IDs and metrics collection
- **API-First**: RESTful design with comprehensive validation and error handling

### Key Technologies & Decisions
- **Chi Router**: HTTP routing and composable middleware
- **JWT + Refresh Tokens**: Stateless auth with server-side session management
- **PostgreSQL + JSONB**: ACID compliance with flexible game data storage
- **sqlc**: Type-safe SQL query generation at compile time
- **React Query**: Server state management with intelligent caching
- **Structured Logging**: JSON logs with correlation ID tracing

## Development Commands

### Quick Start for New Developers
```bash
# Complete setup (database + environment + dependencies)
just dev-setup

# Apply database migrations
just migrate

# Start development server with environment loading
just dev
```

### Environment & Configuration
ActionPhase uses `.env` files for configuration. The repository includes:
- `.env` - Working defaults for local Docker development
- `.env.example` - Template with all available options

Key environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (change for production!)
- `ENVIRONMENT` - development/staging/production
- `LOG_LEVEL` - debug/info/warn/error
- `SKIP_DB_TESTS` - Skip database tests if set to "true"

### Go Backend (Primary)
```bash
# Database Management (Docker-based)
just db_up                    # Start PostgreSQL Docker container
just db_down                  # Stop PostgreSQL Docker container
just db_reset                 # Reset database (restart container)
just db_create                # Create actionphase and actionphase_test databases
just db_setup                 # Complete database setup (start + create)
just migrate_status           # Check migration status

# Database Migrations
just make_migration <name>    # Create new migration
just migrate                  # Apply migrations to main database
just migrate_test             # Apply migrations to test database
just rollback                 # Rollback migrations

# Development & Building
just dev                      # Start backend with .env loading
just run                      # Run Go server without auto-restart
just build                    # Build all Go packages
just lint                     # Format and vet Go code
just tidy                     # Clean up Go modules

# Code Generation
just sqlgen                   # Generate Go code from SQL queries

# Testing (Multiple Strategies)
just test-mocks               # Fast unit tests (no database) ~0.3s
just test-integration         # Integration tests (requires database)
just test                     # All tests (auto-skips DB if unavailable)
just test-parallel            # All tests in parallel
just test-coverage            # Generate test coverage report
just test-race                # Run tests with race detection
just test-bench               # Run benchmark tests
just test-db-setup            # Setup test database
just quick-test               # Run fast tests only
just ci-test                  # Full CI test suite
```

### React Frontend
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

The React frontend (`frontend/`) uses:
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

- React Frontend: TypeScript + Vite (testing setup pending)
- Go Backend: Comprehensive test coverage with interface mocks and database integration tests

## Project Structure Notes

- `justfile` provides common development commands
- Go backend uses `go.mod` for dependency management
- Frontend uses `package.json` and npm for dependency management
- Database migrations use golang-migrate with PostgreSQL
- Frontend communicates with backend via REST API with JWT authentication

## Key System Patterns & Best Practices

### Request Processing Flow
```
HTTP Request → Middleware Stack → Handler → Service → Repository → Database
     ↓              ↓               ↓         ↓          ↓           ↓
Correlation ID  Auth/Rate Limit  Validate  Business   SQL Queries  PostgreSQL
Request Trace   CORS/Security    Bind      Logic      Type-Safe    ACID Ops
Metrics         Error Recovery   Error     Domain     Connection   Constraints
                                Handling   Rules      Pooling
```

### Authentication Pattern
- JWT access tokens (15min) + refresh tokens (7 days)
- Automatic token refresh via axios interceptors
- Server-side session management for security
- Correlation ID propagation for request tracing

### State Management Strategy
- **Server State**: React Query for API data caching and synchronization
- **Auth State**: React Context with localStorage persistence
- **UI State**: Component-local useState/useReducer
- **Global Settings**: React Context (sparingly)

### Database Design Pattern
- **Structured Data**: Traditional relational tables with foreign keys
- **Flexible Data**: JSONB columns for game-specific data (character sheets, game config)
- **Type Safety**: sqlc generates Go structs from SQL queries
- **Migrations**: Version-controlled schema evolution with golang-migrate

### Error Handling Strategy
- **Typed Errors**: Domain-specific error types with context
- **Structured Responses**: Consistent API error format with correlation IDs
- **Graceful Degradation**: Handle failures without breaking user experience
- **Comprehensive Logging**: All errors logged with full context

### Testing Philosophy
- **Unit Tests**: Fast tests with mocked dependencies (~300ms total)
- **Integration Tests**: Database tests with transaction isolation
- **API Tests**: End-to-end HTTP endpoint testing
- **Frontend Tests**: Component and custom hook testing

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

## Documentation & Architecture References

### Core Documentation
- **[Developer Onboarding](docs/DEVELOPER_ONBOARDING.md)** - 30-minute setup guide for new developers
- **[System Architecture](docs/architecture/SYSTEM_ARCHITECTURE.md)** - Complete system design overview
- **[Component Interactions](docs/architecture/COMPONENT_INTERACTIONS.md)** - How system components communicate
- **[Sequence Diagrams](docs/architecture/SEQUENCE_DIAGRAMS.md)** - Visual flows for complex processes

### Architecture Decision Records (ADRs)
All major architectural decisions are documented in `/docs/adrs/`:
- **ADR-001**: Technology Stack Selection (Go, React, PostgreSQL)
- **ADR-002**: Database Design Approach (Hybrid relational-document)
- **ADR-003**: Authentication Strategy (JWT + refresh tokens)
- **ADR-004**: API Design Principles (RESTful with modern enhancements)
- **ADR-005**: Frontend State Management (React Query + Context hybrid)
- **ADR-006**: Observability Approach (Structured logging, metrics, tracing)
- **ADR-007**: Testing Strategy (Multi-layer testing pyramid)

### Key Implementation Files
- **Core Interfaces**: `backend/pkg/core/interfaces.go` - All service contracts
- **Domain Models**: `backend/pkg/core/models.go` - Business entities
- **HTTP Routing**: `backend/pkg/http/root.go` - API endpoints and middleware
- **Database Queries**: `backend/pkg/db/queries/` - SQL queries (sqlc generates Go code)
- **React API Client**: `frontend/src/lib/api.ts` - Frontend API integration
- **Auth Context**: `frontend/src/contexts/AuthContext.tsx` - Authentication state
- **Observability**: `backend/pkg/observability/` - Logging, metrics, and tracing

### Development Patterns to Follow

**IMPORTANT: Integrated Feature Development**
Each feature should be implemented with BOTH backend and frontend components completed together before moving to the next feature. This enables manual UI testing to validate requirements and implementation correctness.

1. **New Feature (Integrated Approach)**:
   - Backend: Database migration → SQL queries (sqlc) → Service interface → Service implementation → Handler → API tests
   - Frontend: API client → Custom hooks → Components → Component tests
   - Manual Testing: Test the complete feature in the UI before moving to next feature
   - Documentation: Update API docs and any relevant guides

2. **Database Changes**: Create migration → Update queries → Regenerate sqlc → Test
3. **Testing Strategy**: Write automated tests but rely on manual UI testing to validate feature completeness

### Progress Tracking

See `AI_FRIENDLY_IMPROVEMENTS.md` for current improvement status and roadmap.
