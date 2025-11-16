# Developer Onboarding Guide

## Welcome to ActionPhase! 🎲

This guide will get you up and running with the ActionPhase codebase in under 30 minutes. ActionPhase is a modern web application for hosting play-by-post RPG games with a cyclical phase-based gameplay system.

## Quick Start (5 minutes)

### Prerequisites
- **Go 1.21+** - [Install Go](https://golang.org/doc/install)
- **Node.js 18+** - [Install Node.js](https://nodejs.org/)
- **Docker & Docker Compose** - [Install Docker](https://docs.docker.com/get-docker/)
- **git** - For version control

### Get Running Immediately

```bash
# 1. Clone the repository
git clone https://github.com/yourorg/actionphase
cd actionphase

# 2. Set up the complete development environment (database + dependencies)
cd backend
just dev-setup

# 3. Start the development servers (opens two terminals)
just dev          # Backend server (http://localhost:3000)
just run-frontend # Frontend server (http://localhost:5173)
```

**That's it!** 🎉 You should now have:
- Backend API running on http://localhost:3000
- Frontend app running on http://localhost:5173
- PostgreSQL database running in Docker
- All dependencies installed

### Verify Everything Works

```bash
# Test the API
curl http://localhost:3000/ping
# Should return: {"message": "pong", "status": "healthy"}

# Test frontend
open http://localhost:5173
# Should show the ActionPhase login/registration page
```

## Architecture Overview (10 minutes)

### High-Level System Design

ActionPhase follows Clean Architecture principles with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   React/TS      │◄──►│   Go/Chi        │◄──►│   PostgreSQL    │
│   + React Query │    │   + JWT Auth    │    │   + Migrations  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Tech Stack at a Glance

**Backend (Go)**:
- **Chi Router**: HTTP routing and middleware
- **PostgreSQL**: Primary database with JSONB for flexible game data
- **sqlc**: Type-safe SQL query generation
- **JWT**: Authentication with refresh tokens
- **Structured Logging**: Context-aware logging with correlation IDs

**Frontend (React)**:
- **React 18**: Modern React with hooks
- **TypeScript**: Type safety throughout
- **React Query**: Server state management and caching
- **Tailwind CSS**: Utility-first styling
- **Vite**: Fast development and building

**Key Concepts**:
- **Games**: RPG campaigns managed by Game Masters (GMs)
- **Characters**: Player characters within games
- **Phases**: Cyclical gameplay phases (Planning → Action → Resolution)
- **Users**: Players and GMs with JWT-based authentication

### Project Structure

```
actionphase/
├── backend/                    # Go backend service
│   ├── pkg/                   # Go packages (main code)
│   │   ├── core/             # Domain models and interfaces
│   │   ├── auth/             # Authentication logic
│   │   ├── games/            # Game management
│   │   ├── db/               # Database layer (repositories)
│   │   ├── http/             # HTTP handlers and routing
│   │   └── observability/    # Logging, metrics, tracing
│   ├── main.go              # Application entry point
│   └── justfile             # Development commands
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # Reusable React components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # Utilities and API client
│   └── package.json
└── docs/                    # Architecture and API documentation
    ├── architecture/        # System design docs
    └── adrs/               # Architecture Decision Records
```

## Core Development Concepts (10 minutes)

### 1. Backend Patterns

**Interface-First Development**: All services are defined as interfaces in `pkg/core/interfaces.go`:

```go
// Define the contract first
type GameServiceInterface interface {
    CreateGame(ctx context.Context, game *Game) (*Game, error)
    GetGame(ctx context.Context, id int) (*Game, error)
}

// Implement in service layer
type GameService struct {
    repository GameRepositoryInterface
}

func (s *GameService) CreateGame(ctx context.Context, game *Game) (*Game, error) {
    // Business logic here
    return s.repository.CreateGame(ctx, game)
}
```

**Request Processing Flow**:
```
HTTP Request → Middleware → Handler → Service → Repository → Database
     ↓              ↓         ↓         ↓          ↓           ↓
Correlation ID  Auth/CORS  Validate  Business   SQL         PostgreSQL
Metrics         Rate Limit  Bind      Logic      Queries     ACID Ops
```

**Database Integration**: We use `sqlc` for type-safe SQL:
```sql
-- In backend/pkg/db/queries/games.sql
-- name: CreateGame :one
INSERT INTO games (title, gm_user_id, max_players, game_config)
VALUES ($1, $2, $3, $4)
RETURNING *;
```

This generates type-safe Go code:
```go
// Auto-generated by sqlc
func (q *Queries) CreateGame(ctx context.Context, arg CreateGameParams) (Game, error) {
    // Implementation generated automatically
}
```

### 2. Frontend Patterns

**Server State with React Query**: All API interactions use React Query for caching and synchronization:

```typescript
// Custom hook for games
export function useGames() {
  return useQuery({
    queryKey: ['games'],
    queryFn: () => api.games.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// In components
function GamesList() {
  const { data: games, isLoading, error } = useGames();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="grid gap-4">
      {games?.map(game => <GameCard key={game.id} game={game} />)}
    </div>
  );
}
```

**Authentication Context**: Global auth state managed via React Context:
```typescript
const { user, login, logout, isAuthenticated } = useAuth();

// Automatic token refresh via axios interceptors
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await refreshToken(); // Automatic refresh
      return axios(error.config); // Retry request
    }
    return Promise.reject(error);
  }
);
```

### 3. Database Patterns

**Hybrid Relational-Document Design**: Core entities are relational, flexible data uses JSONB:

```sql
-- Structured data
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    gm_user_id INTEGER REFERENCES users(id),
    max_players INTEGER NOT NULL,
    game_config JSONB DEFAULT '{}',  -- Flexible game rules
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query JSONB data
SELECT game_config->>'system' as game_system,
       game_config->'rules'->>'dice_type' as dice_type
FROM games
WHERE game_config->>'system' = 'D&D5e';
```

**Migration Management**: Database schema changes are versioned:
```bash
just make_migration add_character_approval_system
just migrate           # Apply to development
just migrate_test      # Apply to test database
```

## Development Workflow (5 minutes)

### Common Development Tasks

```bash
# Backend Development
just dev                 # Start backend with auto-reload
just test-mocks         # Run fast unit tests (~0.3s)
just test-integration   # Run database integration tests
just test               # Run all tests
just lint               # Format and lint Go code
just sqlgen             # Regenerate sqlc queries after SQL changes

# Frontend Development
just run-frontend       # Start React dev server
just test-frontend      # Run React component tests
just lint-frontend      # Run ESLint
just build-frontend     # Build for production

# Database Management
just db_up              # Start PostgreSQL container
just db_down            # Stop PostgreSQL container
just make_migration add_new_feature  # Create new migration
just migrate            # Apply pending migrations
```

### Typical Feature Development Flow

1. **Plan**: Create/update Architecture Decision Records if needed
2. **Backend**:
   - Add interface to `core/interfaces.go`
   - Implement service logic
   - Add database queries in `db/queries/`
   - Create HTTP handlers
   - Write tests (unit + integration)
3. **Frontend**:
   - Create API client methods
   - Build React components
   - Add custom hooks for state management
   - Write component tests
4. **Integration**: Test end-to-end functionality
5. **Documentation**: Update relevant docs

### Code Review Checklist

- [ ] **Tests**: Unit tests for business logic, integration tests for database operations
- [ ] **Error Handling**: Proper error messages and HTTP status codes
- [ ] **Logging**: Structured logs with correlation IDs for debugging
- [ ] **Types**: Strong typing in both Go and TypeScript
- [ ] **Security**: No hardcoded secrets, proper input validation
- [ ] **Performance**: Efficient database queries, proper React Query usage

## Key Files to Understand

### Backend Entry Points
- `main.go` - Application startup and dependency injection
- `pkg/http/root.go` - HTTP routing and middleware setup
- `pkg/core/interfaces.go` - All service interfaces (your API contracts)
- `pkg/core/models.go` - Domain models and business entities

### Frontend Entry Points
- `src/main.tsx` - React app initialization with providers
- `src/lib/api.ts` - API client configuration and methods
- `src/contexts/AuthContext.tsx` - Authentication state management
- `src/hooks/` - Custom hooks for server state management

### Configuration & Setup
- `backend/.env` - Environment variables (copy from `.env.example`)
- `frontend/package.json` - Frontend dependencies and scripts
- `backend/justfile` - All development commands in one place
- `docker-compose.yml` - Development database setup

## Testing Philosophy

ActionPhase uses a multi-layered testing approach:

**Fast Unit Tests** (`just test-mocks`):
- Test business logic with mocked dependencies
- Interface-based mocking for clean isolation
- Run in ~300ms for rapid feedback

**Integration Tests** (`just test-integration`):
- Test database interactions with real PostgreSQL
- Use transactions for test isolation
- Comprehensive API endpoint testing

**Frontend Tests** (`just test-frontend`):
- Component testing with React Testing Library
- Custom hook testing for complex state logic
- Mock API responses for predictable testing

```bash
# Test pyramid in practice
just test-mocks      # 🟢 Fast feedback (300ms)
just test-integration # 🟡 Comprehensive coverage (2-3s)
just test-e2e        # 🔴 Full user journeys (30s+)
```

## Common Gotchas & Solutions

### 1. Database Connection Issues
```bash
# If database tests fail
just db_reset        # Restart database container
just migrate         # Ensure migrations are applied
just migrate_test    # Apply to test database too
```

### 2. JWT Token Expiry in Development
```bash
# If API returns 401 errors unexpectedly
# Frontend will auto-refresh tokens, but you might need to clear storage
localStorage.clear() # In browser console
```

### 3. React Query Cache Confusion
```typescript
// If UI doesn't update after mutations
const queryClient = useQueryClient();
queryClient.invalidateQueries(['games']); // Force refetch

// Or check React Query DevTools (enabled in development)
```

### 4. Go Module Issues
```bash
# If Go dependencies are problematic
go mod tidy          # Clean up dependencies
go mod download      # Re-download modules
```

## Debugging Tools

### Backend Debugging
- **Structured Logs**: Every request has a correlation ID for tracing
- **Metrics Endpoint**: http://localhost:3000/metrics - real-time performance data
- **Health Endpoint**: http://localhost:3000/health - service status
- **Database Logs**: Check Docker logs for SQL queries

### Frontend Debugging
- **React Query DevTools**: Inspect cache, queries, and mutations
- **React DevTools**: Component state and props inspection
- **Network Tab**: API request/response inspection
- **Redux DevTools**: If using Redux (currently we use React Query)

### Example Debugging Session
```bash
# Backend issue: Find requests by correlation ID
docker logs actionphase_db_1 | grep "corr_abc123"

# Frontend issue: Check React Query cache
# Open React Query DevTools in browser (bottom left toggle)

# Database issue: Connect directly to investigate
just db_exec "SELECT * FROM games WHERE created_at > NOW() - INTERVAL '1 hour';"
```

## Getting Help

### Documentation
- **Architecture**: `/docs/architecture/` - System design and patterns
- **ADRs**: `/docs/adrs/` - Architectural decisions and rationale
- **API Documentation**: Generate with `just docs` (future)
- **Database Schema**: Check migrations in `pkg/db/migrations/`

### Code Navigation Tips
- **Find Interface**: All contracts in `pkg/core/interfaces.go`
- **Find Implementation**: Look in corresponding service/repository packages
- **Find API Endpoint**: Check `pkg/http/routes.go` for URL mapping
- **Find React Component**: Components are in `src/components/` or `src/pages/`

### Common Questions

**Q: How do I add a new API endpoint?**
1. Add interface method to `core/interfaces.go`
2. Implement in service layer
3. Add handler in `pkg/http/`
4. Add route in `pkg/http/routes.go`
5. Add frontend API client method

**Q: How do I modify the database schema?**
```bash
just make_migration add_new_column
# Edit the generated migration files
just migrate
```

**Q: How do I add a new React component?**
1. Create component in `src/components/`
2. Add to appropriate page in `src/pages/`
3. Create custom hooks if complex state needed
4. Add tests in `.test.tsx` file

**Q: How do I debug a failing test?**
```bash
# Run specific test with verbose output
go test -v ./pkg/games -run TestCreateGame
npm test -- --verbose GameForm.test.tsx
```

---

## Next Steps

Now that you're set up:

1. **Explore the Codebase**: Browse `pkg/games/` and `src/pages/GamesPage.tsx` to see a complete feature
2. **Run Tests**: `just test-mocks && just test-frontend` to verify everything works
3. **Make a Small Change**: Try adding a field to the game creation form
4. **Read Architecture Docs**: Check `/docs/architecture/` for deeper system understanding
5. **Check Out Issues**: Look for "good first issue" labels in the repository

Welcome to the team! 🎉 The codebase is designed to be approachable, and this onboarding guide should have you productive quickly. Don't hesitate to ask questions or suggest improvements to this guide.

**Happy coding!** 🚀
