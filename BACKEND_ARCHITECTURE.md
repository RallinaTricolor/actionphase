# ActionPhase Backend Architecture

This document provides a comprehensive overview of the ActionPhase Go backend architecture, designed to be highly AI-friendly for development and maintenance.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Design Patterns](#design-patterns)
4. [Data Layer](#data-layer)
5. [Service Layer](#service-layer)
6. [Transport Layer](#transport-layer)
7. [Authentication & Authorization](#authentication--authorization)
8. [Error Handling](#error-handling)
9. [Configuration Management](#configuration-management)
10. [Testing Strategy](#testing-strategy)
11. [AI-Friendly Features](#ai-friendly-features)
12. [Development Guidelines](#development-guidelines)

## Architecture Overview

ActionPhase follows **Clean Architecture** principles with clear separation of concerns across layers:

```
┌─────────────────────────────────────────────────────────┐
│                   Transport Layer                        │
│                    (pkg/http, pkg/games, pkg/auth)     │
├─────────────────────────────────────────────────────────┤
│                  Application Layer                       │
│            (Business Logic & Use Cases)                 │
├─────────────────────────────────────────────────────────┤
│                    Domain Layer                         │
│                    (pkg/core)                          │
├─────────────────────────────────────────────────────────┤
│                Infrastructure Layer                      │
│                (pkg/db, External Services)             │
└─────────────────────────────────────────────────────────┘
```

### Key Principles

- **Dependency Inversion**: Higher layers depend on interfaces, not concrete implementations
- **Single Responsibility**: Each component has one clear purpose
- **Interface Segregation**: Small, focused interfaces
- **Testability**: Every component can be unit tested with mocks
- **AI-Friendly**: Clear naming, comprehensive documentation, consistent patterns

## Project Structure

```
backend/
├── main.go                          # Application entry point
├── pkg/                            # Package-based organization
│   ├── core/                       # Domain layer - business entities & interfaces
│   │   ├── doc.go                  # Package documentation
│   │   ├── interfaces.go           # Service interfaces & contracts
│   │   ├── users.go               # User domain model
│   │   ├── config.go              # Configuration management
│   │   ├── constants.go           # Application constants & enums
│   │   ├── middleware.go          # HTTP middleware components
│   │   ├── api_errors.go          # Structured error handling
│   │   ├── test_utils.go          # Testing utilities
│   │   ├── test_factories.go      # Test data factories
│   │   ├── repositories.go        # Repository interfaces
│   │   └── repository_mocks.go    # Mock implementations
│   ├── db/                        # Data access layer
│   │   ├── migrations/            # Database schema migrations
│   │   ├── models/               # Generated SQLC models
│   │   ├── queries/              # SQL query definitions
│   │   └── services/             # Repository implementations
│   ├── auth/                      # Authentication & authorization
│   │   ├── doc.go                # Package documentation
│   │   ├── api.go                # HTTP handlers
│   │   ├── jwt.go                # JWT token management
│   │   ├── registration.go       # User registration logic
│   │   ├── login.go              # Authentication logic
│   │   └── refresh_token.go      # Token refresh logic
│   ├── games/                     # Game management
│   │   ├── doc.go                # Package documentation
│   │   └── api.go                # Game HTTP handlers
│   └── http/                      # HTTP routing & middleware
│       └── root.go               # Router setup
└── go.mod                        # Go module definition
```

## Design Patterns

### 1. Repository Pattern

**Purpose**: Abstracts data access logic and enables testability.

```go
// Interface in domain layer (pkg/core/interfaces.go)
type UserServiceInterface interface {
    CreateUser(user *User) (*User, error)
    UserByUsername(username string) (*User, error)
    // ... other methods
}

// Implementation in infrastructure layer (pkg/db/services/users.go)
type UserService struct {
    DB *pgxpool.Pool
}

func (us *UserService) CreateUser(user *User) (*User, error) {
    // Database implementation
}

// Mock in domain layer for testing (pkg/core/repository_mocks.go)
type MockUserRepository struct {
    CreateUserFn func(*User) (*User, error)
    // ... other function fields
}
```

### 2. Dependency Injection

**Purpose**: Enables loose coupling and testability.

```go
// Handler depends on interface, not concrete implementation
type Handler struct {
    App         *core.App
    UserService core.UserServiceInterface
    GameService core.GameServiceInterface
}

// Easy to inject mocks for testing
func TestHandler() {
    mockUserService := &core.MockUserRepository{...}
    handler := &Handler{UserService: mockUserService}
    // Test with mocks
}
```

### 3. Builder Pattern (Test Data)

**Purpose**: Flexible test data creation with fluent interface.

```go
// Create test data with custom properties
user := factory.NewUser().
    WithUsername("testuser").
    WithEmail("test@example.com").
    WithAdmin(true).
    Create()

game := factory.NewGame().
    WithTitle("Epic Campaign").
    WithGM(user).
    WithMaxPlayers(6).
    Create()
```

### 4. Middleware Chain

**Purpose**: Reusable request processing components.

```go
r.Group(func(r chi.Router) {
    r.Use(jwtauth.Verifier(tokenAuth))
    r.Use(core.RequireAuthenticationMiddleware(userService))
    r.Use(core.LoggingMiddleware(logger))

    // Protected routes
    r.Post("/games", handler.CreateGame)
    r.Put("/games/{id}/state", handler.UpdateGameState)
})
```

## Data Layer

### SQLC Integration

ActionPhase uses [SQLC](https://sqlc.dev/) for type-safe database access:

```sql
-- queries/games.sql
-- name: CreateGame :one
INSERT INTO games (title, description, gm_user_id, genre, max_players)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetGame :one
SELECT * FROM games WHERE id = $1;
```

```go
// Generated by SQLC in pkg/db/models/
type CreateGameParams struct {
    Title       string
    Description string
    GmUserID    int32
    Genre       pgtype.Text
    MaxPlayers  pgtype.Int4
}

func (q *Queries) CreateGame(ctx context.Context, arg CreateGameParams) (Game, error) {
    // Generated implementation
}
```

### Migration Management

Database schema changes are managed through versioned migrations:

```bash
# Create new migration
just make_migration add_user_preferences

# Apply migrations
just migrate

# Check migration status
just migrate_status
```

### Repository Implementation

```go
type GameService struct {
    DB *pgxpool.Pool
}

func (gs *GameService) CreateGame(ctx context.Context, req core.CreateGameRequest) (*models.Game, error) {
    queries := models.New(gs.DB)

    game, err := queries.CreateGame(ctx, models.CreateGameParams{
        Title:       req.Title,
        Description: req.Description,
        GmUserID:    req.GMUserID,
        // ... other fields
    })

    return &game, err
}
```

## Service Layer

### Interface Definition

Service interfaces are defined in the domain layer (`pkg/core/interfaces.go`) with comprehensive documentation:

```go
// GameServiceInterface defines the contract for game management operations.
// Handles complete game lifecycle from creation through completion, including
// participant management and state transitions.
//
// Usage Example:
//
//	gameService := &services.GameService{DB: pool}
//	game, err := gameService.CreateGame(ctx, CreateGameRequest{...})
type GameServiceInterface interface {
    // CreateGame creates a new game with the given parameters
    CreateGame(ctx context.Context, req CreateGameRequest) (*models.Game, error)

    // GetGame retrieves a game by its ID
    GetGame(ctx context.Context, gameID int32) (*models.Game, error)

    // ... other methods with full documentation
}
```

### Business Logic Implementation

```go
func (gs *GameService) JoinGame(ctx context.Context, gameID, userID int32, role string) error {
    // 1. Validate input parameters
    if !core.IsValidParticipantRole(role) {
        return fmt.Errorf("invalid role: %s", role)
    }

    // 2. Check business rules
    joinStatus, err := gs.CanUserJoinGame(ctx, gameID, userID)
    if err != nil {
        return fmt.Errorf("failed to check join eligibility: %w", err)
    }

    if joinStatus != core.CanJoin {
        return fmt.Errorf("cannot join game: %s", joinStatus)
    }

    // 3. Perform the operation
    _, err = gs.AddGameParticipant(ctx, gameID, userID, role)
    return err
}
```

## Transport Layer

### HTTP Handler Structure

Handlers follow a consistent pattern for processing requests:

```go
func (h *Handler) CreateGame(w http.ResponseWriter, r *http.Request) {
    // 1. Parse and validate request
    data := &CreateGameRequest{}
    if err := render.Bind(r, data); err != nil {
        render.Render(w, r, core.ErrInvalidRequest(err))
        return
    }

    // 2. Extract authentication context
    user := core.GetAuthenticatedUser(r.Context())
    if user == nil {
        render.Render(w, r, core.ErrUnauthorized("authentication required"))
        return
    }

    // 3. Call service layer
    game, err := h.GameService.CreateGame(r.Context(), core.CreateGameRequest{
        Title:       data.Title,
        Description: data.Description,
        GMUserID:    user.ID,
        // ... other fields
    })

    // 4. Handle errors with appropriate responses
    if err != nil {
        h.App.Logger.Error("Failed to create game", "error", err)
        render.Render(w, r, core.ErrInternalError(err))
        return
    }

    // 5. Transform to response format
    response := &GameResponse{
        ID:          game.ID,
        Title:       game.Title,
        Description: game.Description,
        // ... other fields
    }

    // 6. Send response
    render.Status(r, http.StatusCreated)
    render.Render(w, r, response)
}
```

### Request/Response Types

```go
type CreateGameRequest struct {
    Title               string     `json:"title" validate:"required,min=3,max=255"`
    Description         string     `json:"description" validate:"required,min=10"`
    Genre               string     `json:"genre,omitempty"`
    StartDate           *time.Time `json:"start_date,omitempty"`
    EndDate             *time.Time `json:"end_date,omitempty"`
    RecruitmentDeadline *time.Time `json:"recruitment_deadline,omitempty"`
    MaxPlayers          int32      `json:"max_players,omitempty"`
}

type GameResponse struct {
    ID                  int32      `json:"id"`
    Title               string     `json:"title"`
    Description         string     `json:"description"`
    GMUserID            int32      `json:"gm_user_id"`
    State               string     `json:"state"`
    Genre               string     `json:"genre,omitempty"`
    StartDate           *time.Time `json:"start_date,omitempty"`
    EndDate             *time.Time `json:"end_date,omitempty"`
    RecruitmentDeadline *time.Time `json:"recruitment_deadline,omitempty"`
    MaxPlayers          int32      `json:"max_players,omitempty"`
    CreatedAt           time.Time  `json:"created_at"`
    UpdatedAt           time.Time  `json:"updated_at"`
}
```

## Authentication & Authorization

### JWT Token Management

```go
// Generate access token
token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
    "username": user.Username,
    "exp":      time.Now().Add(config.JWT.AccessTokenExpiry).Unix(),
    "iat":      time.Now().Unix(),
})

tokenString, err := token.SignedString([]byte(config.JWT.Secret))
```

### Middleware-Based Authorization

```go
// Require authentication for all routes in group
r.Group(func(r chi.Router) {
    r.Use(jwtauth.Verifier(tokenAuth))
    r.Use(core.RequireAuthenticationMiddleware(userService))

    // User must be GM of the game for these routes
    r.Route("/games/{id}", func(r chi.Router) {
        r.Use(core.RequireGameMasterMiddleware(gameService))
        r.Put("/state", handler.UpdateGameState)
        r.Delete("/", handler.DeleteGame)
    })
})
```

### Context-Based User Access

```go
func (h *Handler) MyProtectedHandler(w http.ResponseWriter, r *http.Request) {
    // Get authenticated user from context
    user := core.GetAuthenticatedUser(r.Context())
    userID := core.GetAuthenticatedUserID(r.Context())
    username := core.GetAuthenticatedUsername(r.Context())

    // Use user information for business logic
}
```

## Error Handling

### Structured Error Responses

```go
type ErrResponse struct {
    Err            error `json:"-"`              // Internal error (never exposed)
    HTTPStatusCode int   `json:"-"`              // HTTP status code
    StatusText     string `json:"status"`         // User-friendly status
    AppCode        int64  `json:"code,omitempty"` // Application error code
    ErrorText      string `json:"error,omitempty"` // Safe error message
}
```

### Application Error Codes

```go
const (
    ErrCodeValidation         = 1001
    ErrCodeGameNotRecruiting  = 1302
    ErrCodeGameFull          = 1303
    ErrCodeAlreadyParticipant = 1305
    // ... other codes
)
```

### Error Helper Functions

```go
// Generic errors
render.Render(w, r, core.ErrInvalidRequest(err))
render.Render(w, r, core.ErrUnauthorized("Invalid token"))
render.Render(w, r, core.ErrInternalError(err))

// Specific business errors
render.Render(w, r, core.ErrGameNotRecruiting())
render.Render(w, r, core.ErrGameFull())
render.Render(w, r, core.ErrWithCode(400, ErrCodeCustom, "Custom message"))
```

## Configuration Management

### Environment-Based Configuration

```go
type Config struct {
    Database DatabaseConfig `env:"DATABASE"`
    JWT      JWTConfig      `env:"JWT"`
    Server   ServerConfig   `env:"SERVER"`
    App      AppConfig      `env:"APP"`
}

// Load configuration with validation
config, err := core.LoadConfig()
if err != nil {
    log.Fatal("Configuration error", "error", err)
}
```

### Required Environment Variables

```bash
# Required
DATABASE_URL="postgres://postgres:example@localhost:5432/actionphase?sslmode=disable"
JWT_SECRET="your-super-secret-jwt-signing-key"

# Optional with defaults
ENVIRONMENT="development"  # development, staging, production
LOG_LEVEL="info"          # debug, info, warn, error
PORT="3000"               # HTTP server port
```

### Configuration Validation

```go
func (c *Config) Validate() error {
    if c.Database.URL == "" {
        return fmt.Errorf("DATABASE_URL is required")
    }

    if c.JWT.Secret == "" {
        return fmt.Errorf("JWT_SECRET is required")
    }

    if c.App.Environment == "production" && len(c.JWT.Secret) < 32 {
        return fmt.Errorf("JWT_SECRET must be at least 32 characters in production")
    }

    return nil
}
```

## Testing Strategy

### Test Categories

1. **Unit Tests**: Test individual functions/methods with mocks
2. **Integration Tests**: Test with real database
3. **API Tests**: Test HTTP endpoints end-to-end

### Mock-Based Unit Testing

```go
func TestGameService_CreateGame(t *testing.T) {
    t.Parallel()

    mockRepo := core.CreateMockDatabaseRepo()

    req := core.CreateGameRequest{
        Title:       "Test Game",
        Description: "Test Description",
        GMUserID:    1,
    }

    game, err := mockRepo.Game.CreateGame(context.Background(), req)

    core.AssertNoError(t, err, "Should create game successfully")
    core.AssertEqual(t, req.Title, game.Title, "Title should match")
}
```

### Database Integration Testing

```go
func TestGameService_CreateGame_Integration(t *testing.T) {
    t.Parallel()

    testDB := core.NewTestDatabase(t)
    defer testDB.Close()
    defer testDB.CleanupTables(t)

    gameService := &db.GameService{DB: testDB.Pool}

    // Create test user first
    factory := core.NewTestDataFactory(testDB, t)
    user := factory.NewUser().WithUsername("testgm").Create()

    req := core.CreateGameRequest{
        Title:       "Integration Test Game",
        Description: "Test with real database",
        GMUserID:    int32(user.ID),
    }

    game, err := gameService.CreateGame(context.Background(), req)

    core.AssertNoError(t, err, "Should create game in database")
    core.AssertNotEqual(t, int32(0), game.ID, "Game should have valid ID")
}
```

### Test Data Factories

```go
// Create complex test scenarios easily
user := factory.NewUser().
    WithUsername("player1").
    WithEmail("player1@example.com").
    Create()

game := factory.NewGame().
    WithTitle("Epic Campaign").
    WithGM(user).
    WithState(core.GameStateRecruitment).
    WithMaxPlayers(6).
    Create()

// Add participants
factory.NewParticipant().
    ForGame(game).
    WithUser(player2).
    WithRole(core.RolePlayer).
    Create()
```

## AI-Friendly Features

### 1. Comprehensive Documentation

Every interface, function, and package includes:
- Purpose and usage examples
- Parameter descriptions
- Return value explanations
- Error conditions
- Business rule documentation

### 2. Consistent Naming Conventions

- **Interfaces**: `UserServiceInterface`, `GameServiceInterface`
- **Implementations**: `UserService`, `GameService`
- **Requests/Responses**: `CreateGameRequest`, `GameResponse`
- **Constants**: `GameStateSetup`, `RolePlayer`
- **Errors**: `ErrGameNotFound`, `ErrInvalidRequest`

### 3. Type Safety

- SQLC generates type-safe database code
- Strong typing throughout the application
- Interface-based design enables compile-time checking
- Generic helper functions where appropriate

### 4. Self-Documenting Code

```go
// Clear, descriptive function names
func (gs *GameService) CanUserJoinGame(ctx context.Context, gameID, userID int32) (string, error)

// Descriptive variable names
joinStatus, err := gameService.CanUserJoinGame(ctx, gameID, userID)
if joinStatus != core.CanJoin {
    return fmt.Errorf("user cannot join game: %s", joinStatus)
}

// Constants instead of magic strings
if game.State != core.GameStateRecruitment {
    return core.ErrGameNotRecruiting()
}
```

### 5. Structured Error Handling

- Consistent error response format
- Application-specific error codes
- Clear separation between internal errors and user messages
- Helper functions for common error scenarios

### 6. Testing Infrastructure

- Mock implementations for all services
- Test data factories with fluent interfaces
- Database test utilities with automatic cleanup
- Parallel test execution support
- Environment-based test configuration

## Development Guidelines

### Adding New Features

1. **Define Domain Model**: Add types to `pkg/core/`
2. **Create Interface**: Define service contract in `pkg/core/interfaces.go`
3. **Implement Repository**: Add data access in `pkg/db/services/`
4. **Create Handlers**: Add HTTP handlers in appropriate package
5. **Add Tests**: Unit tests with mocks, integration tests with database
6. **Update Documentation**: Add examples and usage notes

### Code Review Checklist

- [ ] All public functions have documentation with examples
- [ ] Error handling follows established patterns
- [ ] Constants used instead of magic strings/numbers
- [ ] Interfaces defined before implementations
- [ ] Mock implementations created for testing
- [ ] Integration tests cover happy path and error cases
- [ ] Configuration externalized to environment variables
- [ ] Proper separation of concerns maintained

### Performance Considerations

- Database connection pooling configured appropriately
- Proper indexing on frequently queried columns
- Context timeout handling for long operations
- Graceful degradation for external service failures
- Efficient pagination for list endpoints

### Security Best Practices

- Password hashing with bcrypt
- JWT tokens with appropriate expiration
- Input validation and sanitization
- SQL injection prevention through parameterized queries
- Proper CORS configuration
- Rate limiting for authentication endpoints
- Secure headers in HTTP responses

## Conclusion

The ActionPhase backend architecture prioritizes:

1. **Maintainability**: Clear separation of concerns and consistent patterns
2. **Testability**: Every component can be unit tested with mocks
3. **AI-Friendliness**: Comprehensive documentation and self-documenting code
4. **Scalability**: Modular design that can grow with requirements
5. **Security**: Industry-standard security practices throughout

This architecture enables rapid development while maintaining high code quality and making it easy for AI assistants to understand, navigate, and modify the codebase safely.
