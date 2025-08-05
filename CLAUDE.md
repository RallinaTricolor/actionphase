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

### Go Backend (Primary)
```bash
# Start database
just db_up

# Generate SQL code from queries
just sqlgen

# Run database migrations
just migrate

# Rollback migrations
just rollback

# Create new migration
just make_migration <name>

# Run Go server
just run

# Clean up Go modules
just tidy
```

### Modern Frontend (Recommended)
```bash
cd new-frontend

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build
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
