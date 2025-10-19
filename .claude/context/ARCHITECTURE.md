# Architecture Context - Read Before Implementing Features

**IMPORTANT: Read this file before implementing new features or making architectural changes.**

## Recent Changes (2025-10-19)

### Backend Service Decomposition
As part of the Week 1-3 refactoring initiative, large monolithic service files have been decomposed into focused, single-responsibility modules:

- **Phase Service**: 1056-line `phases.go` → `phases/` package (6 files: crud, transitions, validation, history, converters, service)
- **Action Service**: Extracted from phases → `actions/` package (5 files: submissions, results, validation, queries, service)
- **Message Service**: 699-line `messages.go` → `messages/` package (6 files: posts, comments, reactions, validation, service, tests)

**Impact**: All service files now < 500 lines, improved testability, clearer separation of concerns.

**Import paths updated**:
```go
// OLD
import "actionphase/pkg/db/services"
phaseService := &services.PhaseService{DB: pool}

// NEW
import phasesvc "actionphase/pkg/db/services/phases"
phaseService := &phasesvc.PhaseService{DB: pool}
```

**See**: `.claude/planning/REFACTOR_00_MASTER_PLAN.md` for complete refactoring details.

## Core Architectural Principles

ActionPhase follows **Clean Architecture** with clear separation of concerns:

1. **Interface-First Development** - Define interfaces before implementation
2. **Domain-Driven Design** - Clear bounded contexts (auth, games, characters, phases)
3. **Dependency Inversion** - Business logic isolated from infrastructure
4. **Observability-First** - Structured logging, correlation IDs, metrics
5. **API-First** - RESTful design with comprehensive validation

## Technology Stack

### Backend
- **Language**: Go 1.21+
- **Router**: Chi (HTTP routing and middleware)
- **Database**: PostgreSQL with JSONB for flexible game data
- **Query Builder**: sqlc (type-safe SQL → Go code generation)
- **Authentication**: JWT + Refresh Tokens
- **Migrations**: golang-migrate

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query + Context API (see STATE_MANAGEMENT.md)
- **HTTP Client**: Axios with JWT interceptors

**See**: `/docs/adrs/001-technology-stack-selection.md` for rationale

## Request Processing Flow

```
HTTP Request → Middleware Stack → Handler → Service → Repository → Database
     ↓              ↓               ↓         ↓          ↓           ↓
Correlation ID  Auth/CORS       Validate  Business   SQL Queries  PostgreSQL
Request Trace   Rate Limit      Bind      Logic      Type-Safe    ACID Ops
Metrics         Recovery        Error     Domain     Connection   Constraints
                                Handling   Rules      Pooling
```

## Backend Architecture Patterns

### 1. Interface-First Service Definition

**All services MUST be defined as interfaces in**: `backend/pkg/core/interfaces.go`

```go
// Define interface first
type GameServiceInterface interface {
    CreateGame(ctx context.Context, req *CreateGameRequest) (*Game, error)
    GetGame(ctx context.Context, id int) (*Game, error)
}

// Implement with compile-time verification
var _ GameServiceInterface = (*GameService)(nil)

type GameService struct {
    DB *pgxpool.Pool
}

func (s *GameService) CreateGame(ctx context.Context, req *CreateGameRequest) (*Game, error) {
    // Implementation
}
```

**Benefits**:
- Enables easy mocking for tests
- Clear contracts between layers
- Compile-time interface verification
- Supports dependency injection

### 2. Domain Models in Core

**Location**: `backend/pkg/core/models.go`

- Define business entities here
- Keep separate from database models
- Use for API requests/responses
- Shared across all layers

### 3. Database Layer with sqlc

**Location**: `backend/pkg/db/`

```
db/
├── queries/        # SQL query files (*.sql)
├── models/         # Generated Go types (from sqlc)
├── migrations/     # Database schema migrations
└── services/       # Service implementations using queries
```

**Pattern**:
1. Write SQL in `queries/*.sql` with sqlc annotations
2. Run `just sqlgen` to generate type-safe Go code
3. Use generated queries in service implementations

**Example SQL** (`queries/games.sql`):
```sql
-- name: GetGame :one
SELECT id, title, description, gm_user_id, state, created_at
FROM games WHERE id = $1;

-- name: CreateGame :one
INSERT INTO games (title, description, gm_user_id)
VALUES ($1, $2, $3)
RETURNING id, title, description, gm_user_id, state, created_at;
```

### 4. HTTP Handler Pattern

**Location**: `backend/pkg/*/api.go`

```go
func (h *Handler) CreateGame(w http.ResponseWriter, r *http.Request) {
    // 1. Get context values (user, correlation ID)
    ctx := r.Context()
    user := middleware.GetUserFromContext(ctx)
    correlationID := middleware.GetCorrelationID(ctx)

    // 2. Parse and validate request
    var req core.CreateGameRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        core.WriteError(w, core.ErrInvalidRequest(err, correlationID))
        return
    }

    // 3. Call service layer
    game, err := h.service.CreateGame(ctx, &req)
    if err != nil {
        core.WriteError(w, err)
        return
    }

    // 4. Return success response
    core.WriteJSON(w, http.StatusCreated, game)
}
```

### 5. Authentication Pattern

**JWT Access Tokens** (15 minutes) + **Refresh Tokens** (7 days)

- Access tokens for API requests
- Refresh tokens stored in database sessions
- Automatic refresh via axios interceptors
- User ID **NOT in JWT** - fetched from `/api/v1/auth/me`

**See**: `/docs/adrs/003-authentication-strategy.md`

**Security Note**: JWT payload only contains `sub` (username), `exp`, `iat`, `jti`. User ID fetched server-side after token validation to prevent client-side manipulation.

### 6. Error Handling Pattern

**Use typed errors with context**:

```go
// In core/errors.go
type APIError struct {
    Code          string `json:"code"`
    Message       string `json:"message"`
    CorrelationID string `json:"correlation_id,omitempty"`
    Details       any    `json:"details,omitempty"`
}

// Usage in services
if err != nil {
    return nil, core.ErrNotFound("game", gameID, correlationID)
}
```

**Consistent error responses across API**

## Frontend Architecture Patterns

### 1. State Management Strategy

**See**: `.claude/context/STATE_MANAGEMENT.md` for details

- **Server State**: React Query (TanStack Query)
- **Auth State**: Custom AuthContext + React Query
- **UI State**: Component-local useState/useReducer
- **Global Settings**: React Context (sparingly)

**Key Pattern**: Centralized AuthContext eliminates duplicate user fetching

### 2. Component Organization

```
components/
├── ComponentName.tsx          # Component implementation
├── ComponentName.test.tsx     # Component tests
└── ...

hooks/
├── useCustomHook.ts          # Custom hooks
└── ...

pages/
├── PageName.tsx              # Page components
└── ...

types/
├── domain.ts                 # Type definitions
└── ...
```

### 3. API Client Pattern

**Location**: `frontend/src/lib/api.ts`

- Axios instance with JWT interceptors
- Automatic token refresh on 401
- Type-safe API methods
- Consistent error handling

```typescript
const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Automatic JWT attachment
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatic token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```

## Database Design Pattern

**Hybrid Relational-Document Design**

- **Structured data**: Traditional relational tables with foreign keys
- **Flexible data**: JSONB columns for game-specific data (character sheets, game config)
- **Type safety**: sqlc generates Go structs from schema
- **Migrations**: Version-controlled schema evolution

**Example**: Games table
```sql
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    gm_user_id INTEGER REFERENCES users(id),
    state TEXT NOT NULL DEFAULT 'recruitment',
    game_config JSONB DEFAULT '{}'::jsonb,  -- Flexible game settings
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**See**: `/docs/adrs/002-database-design-approach.md`

## Observability Pattern

**Structured JSON logging with correlation IDs**

```go
// Generate correlation ID in middleware
correlationID := uuid.New().String()
ctx = context.WithValue(ctx, middleware.CorrelationIDKey, correlationID)

// Use in logging
log.Info().
    Str("correlation_id", correlationID).
    Str("user_id", userID).
    Str("action", "create_game").
    Msg("Game created successfully")
```

**See**: `/docs/adrs/006-observability-approach.md`

## API Design Principles

**RESTful design with `/api/v1/` versioning**

- **Standard HTTP status codes** (200, 201, 400, 401, 404, 500)
- **Structured error responses** with correlation IDs
- **Input validation** at handler layer
- **Rate limiting** on sensitive endpoints

**See**: `/docs/adrs/004-api-design-principles.md`

## Key Implementation Files

**Backend Core**:
- `backend/pkg/core/interfaces.go` - All service contracts
- `backend/pkg/core/models.go` - Business entities
- `backend/pkg/core/errors.go` - Error types
- `backend/pkg/http/root.go` - API routing and middleware

**Backend Services**:
- `backend/pkg/db/services/` - Service implementations
  - `phases/` - Phase service (decomposed: crud, transitions, validation, history)
  - `actions/` - Action submission service (decomposed: submissions, results, validation, queries)
  - `messages/` - Message service (decomposed: posts, comments, reactions, validation)
  - `*.go` - Other services (games, characters, users, sessions, notifications)
- `backend/pkg/db/queries/*.sql` - SQL queries (generates models/)
- `backend/pkg/db/migrations/*.sql` - Database migrations

**Frontend Core**:
- `frontend/src/lib/api.ts` - API client
- `frontend/src/contexts/AuthContext.tsx` - Authentication state
- `frontend/src/App.tsx` - Application setup

## Development Workflow

### Integrated Feature Development

**Implement BOTH backend and frontend together before moving to next feature**

1. **Backend**:
   - Database migration (if needed)
   - SQL queries (sqlc)
   - Service interface definition
   - Write unit tests first (TDD)
   - Service implementation
   - Handler implementation
   - Write API endpoint tests
   - Run tests: `just test`

2. **Frontend**:
   - API client method
   - Custom hooks
   - Write hook tests
   - Components
   - Write component tests
   - Run tests: `just test-frontend`

3. **Manual Testing**: Test complete feature in UI before moving on

4. **Documentation**: Update API docs and relevant guides

### Bug Fix Workflow

**MANDATORY**: Add regression test before fixing

1. Write test that reproduces bug (should fail)
2. Fix the bug
3. Verify test passes
4. Commit test and fix together

## Configuration Management

**Environment variables in `.env`**:
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing secret
- `ENVIRONMENT` - development/staging/production
- `LOG_LEVEL` - debug/info/warn/error
- `SKIP_DB_TESTS` - Skip database tests if "true"

**Validation**: All env vars validated at startup

## References

### Architecture Decision Records
- `/docs/adrs/001-technology-stack-selection.md`
- `/docs/adrs/002-database-design-approach.md`
- `/docs/adrs/003-authentication-strategy.md`
- `/docs/adrs/004-api-design-principles.md`
- `/docs/adrs/005-frontend-state-management.md`
- `/docs/adrs/006-observability-approach.md`
- `/docs/adrs/007-testing-strategy.md`

### System Design
- `/docs/architecture/SYSTEM_ARCHITECTURE.md`
- `/docs/architecture/COMPONENT_INTERACTIONS.md`
- `/docs/architecture/SEQUENCE_DIAGRAMS.md`

### Detailed Guides
- `.claude/reference/BACKEND_ARCHITECTURE.md`
- `.claude/reference/API_DOCUMENTATION.md`
- `.claude/reference/ERROR_HANDLING.md`
- `.claude/reference/LOGGING_STANDARDS.md`

## Quick Checklist Before Implementation

- [ ] Read relevant ADRs for architectural context
- [ ] Define service interface in `core/interfaces.go`
- [ ] Write tests first (TDD approach)
- [ ] Follow established patterns (see examples above)
- [ ] Add correlation IDs for observability
- [ ] Validate inputs at handler layer
- [ ] Handle errors with typed error responses
- [ ] Update documentation
