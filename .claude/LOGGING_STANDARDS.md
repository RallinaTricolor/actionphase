# Logging Standards for ActionPhase

This document defines logging standards and best practices for the ActionPhase backend service to ensure consistent, structured, and actionable logging across the entire codebase.

## Overview

ActionPhase uses structured logging with the Go `log/slog` package, enhanced with context-aware logging, correlation IDs, and metrics collection. This approach provides:

- **Structured logs** for easy parsing and analysis
- **Context propagation** for request tracing
- **Correlation IDs** for cross-service request tracking
- **Performance metrics** for monitoring and alerting
- **Consistent formatting** across all components

## Logging Architecture

### Core Components

1. **Logger** (`pkg/observability/Logger`): Context-aware structured logger
2. **Middleware** (`pkg/observability/middleware.go`): HTTP request tracing and metrics
3. **Metrics** (`pkg/observability/Metrics`): Performance and business metrics collection
4. **Context** Helpers: Functions for managing request context

### Log Levels

| Level   | Usage | Examples |
|---------|-------|----------|
| `DEBUG` | Development debugging, detailed flow tracking | Function entry/exit, variable values, detailed SQL queries |
| `INFO`  | Normal operations, significant events | Server startup, request completion, successful operations |
| `WARN`  | Recoverable issues, degraded performance | Rate limiting, retries, fallback mechanisms |
| `ERROR` | Errors requiring attention, failures | Authentication failures, database errors, external service failures |

## Usage Guidelines

### Context-Aware Logging

Always use context-aware logging methods that automatically include correlation IDs, user IDs, and request metadata:

```go
// ✅ Good - Context-aware logging
func (h *Handler) CreateGame(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    h.App.Logger.Info(ctx, "Creating new game",
        "title", gameData.Title,
        "max_players", gameData.MaxPlayers)
}

// ❌ Bad - Direct logger usage without context
func (h *Handler) CreateGame(w http.ResponseWriter, r *http.Request) {
    h.App.Logger.Info("Creating new game") // Missing context and structured fields
}
```

### Structured Fields

Always include relevant structured fields for better log analysis:

```go
// ✅ Good - Structured fields
logger.Error(ctx, "Database query failed",
    "query", "SELECT * FROM games WHERE id = ?",
    "error", err,
    "game_id", gameID,
    "duration_ms", duration.Milliseconds())

// ❌ Bad - Unstructured message
logger.Error(ctx, fmt.Sprintf("Database query failed for game %d: %v", gameID, err))
```

### Operation Logging

Use `LogOperation()` for tracking the duration and success of important operations:

```go
func (s *GameService) CreateGame(ctx context.Context, game *Game) (*Game, error) {
    defer s.logger.LogOperation(ctx, "create_game",
        "title", game.Title,
        "user_id", game.GMUserID)()

    // Operation implementation...

    return createdGame, nil
}
```

### Error Logging

Use `LogError()` for consistent error logging with context:

```go
func (s *UserService) AuthenticateUser(ctx context.Context, username, password string) error {
    user, err := s.db.GetUserByUsername(ctx, username)
    if err != nil {
        s.logger.LogError(ctx, err, "Failed to retrieve user for authentication",
            "username", username,
            "operation", "authenticate_user")
        return err
    }

    // Continue authentication...
}
```

## Field Naming Conventions

Use consistent field names across the application:

### Standard Fields

| Field Name | Type | Purpose | Example |
|------------|------|---------|---------|
| `user_id` | int/string | Authenticated user identifier | `123` |
| `game_id` | int | Game identifier | `456` |
| `operation` | string | Operation being performed | `"create_game"` |
| `duration_ms` | int | Operation duration in milliseconds | `250` |
| `error` | string | Error message | `"connection timeout"` |
| `http_method` | string | HTTP request method | `"POST"` |
| `http_path` | string | HTTP request path | `"/api/v1/games"` |
| `http_status` | int | HTTP response status | `201` |
| `correlation_id` | string | Request correlation ID | `"corr_a1b2c3d4"` |
| `request_id` | string | Unique request identifier | `"req_e5f6g7h8"` |

### Business-Specific Fields

| Field Name | Type | Purpose | Example |
|------------|------|---------|---------|
| `title` | string | Game title | `"The Chronicles of Eldoria"` |
| `max_players` | int | Maximum players for game | `6` |
| `genre` | string | Game genre | `"Fantasy RPG"` |
| `state` | string | Game state | `"recruiting"` |
| `role` | string | User role in context | `"player"` |
| `character_id` | int | Character identifier | `789` |
| `phase_id` | int | Game phase identifier | `12` |

## Context Management

### Adding Context Information

```go
// In HTTP middleware
ctx = observability.WithCorrelationID(ctx, correlationID)
ctx = observability.WithUserID(ctx, userID)
ctx = observability.WithRequestID(ctx, requestID)

// In service operations
ctx = observability.WithOperation(ctx, "create_game")
```

### Retrieving Context Information

```go
correlationID := observability.GetCorrelationID(ctx)
userID := observability.GetUserID(ctx)
```

## HTTP Request Logging

HTTP requests are automatically logged by the `RequestTracingMiddleware` with the following information:

- Request method and path
- Response status code
- Duration
- Correlation and request IDs
- User agent and remote address
- User ID (if authenticated)

Example output:
```json
{
  "time": "2025-08-07T18:30:00Z",
  "level": "INFO",
  "msg": "HTTP request",
  "correlation_id": "corr_a1b2c3d4",
  "request_id": "req_e5f6g7h8",
  "user_id": 123,
  "http_method": "POST",
  "http_path": "/api/v1/games",
  "http_status": 201,
  "duration_ms": 245,
  "remote_addr": "192.168.1.100:54321",
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}
```

## Environment-Specific Configuration

### Development Environment
- **Format**: Human-readable text
- **Level**: DEBUG
- **Source**: Include source file and line numbers
- **Output**: stdout

### Production Environment
- **Format**: JSON (for log aggregation)
- **Level**: INFO
- **Source**: Excluded (performance)
- **Output**: stdout (collected by container runtime)

### Test Environment
- **Format**: Text
- **Level**: ERROR (minimal noise)
- **Output**: stderr

## Integration with Services

### Service Layer Logging

```go
type GameService struct {
    logger *observability.Logger
    db     GameRepositoryInterface
}

func (s *GameService) CreateGame(ctx context.Context, game *CreateGameRequest) (*Game, error) {
    // Log operation start
    defer s.logger.LogOperation(ctx, "service_create_game",
        "title", game.Title,
        "gm_user_id", game.GMUserID)()

    // Validate input
    if err := s.validateCreateGameRequest(game); err != nil {
        s.logger.LogError(ctx, err, "Game creation validation failed",
            "title", game.Title)
        return nil, err
    }

    // Create game
    createdGame, err := s.db.CreateGame(ctx, game)
    if err != nil {
        s.logger.LogError(ctx, err, "Database error creating game",
            "title", game.Title,
            "operation", "db_create_game")
        return nil, err
    }

    s.logger.Info(ctx, "Game created successfully",
        "game_id", createdGame.ID,
        "title", createdGame.Title)

    return createdGame, nil
}
```

### Database Layer Logging

```go
func (r *GameRepository) CreateGame(ctx context.Context, game *CreateGameRequest) (*Game, error) {
    defer r.logger.LogOperation(ctx, "db_create_game",
        "table", "games",
        "title", game.Title)()

    query := `
        INSERT INTO games (title, description, gm_user_id, genre, max_players)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at, updated_at
    `

    var createdGame Game
    err := r.db.QueryRow(ctx, query, game.Title, game.Description,
        game.GMUserID, game.Genre, game.MaxPlayers).Scan(
        &createdGame.ID, &createdGame.CreatedAt, &createdGame.UpdatedAt)

    if err != nil {
        r.logger.LogError(ctx, err, "SQL INSERT failed",
            "table", "games",
            "query", query)
        return nil, err
    }

    return &createdGame, nil
}
```

## Metrics Integration

The logging system automatically collects metrics for:

### HTTP Metrics
- Request count by method, path, and status
- Request duration percentiles (P50, P95, P99)
- Error rates by endpoint
- Total request and error counts

### Custom Business Metrics
```go
// Increment counters
metrics.IncrementCounter("games_created")
metrics.IncrementCounterBy("players_joined", int64(playerCount))

// Set gauges
metrics.SetGauge("active_games", float64(activeGameCount))

// Record durations
metrics.RecordHistogram("db_query_duration", duration)
```

## Monitoring and Alerting

### Metrics Endpoint
Access real-time metrics at: `GET /metrics`

```json
{
  "timestamp": "2025-08-07T18:30:00Z",
  "uptime": "2h15m30s",
  "total_requests": 1537,
  "total_errors": 23,
  "error_rate": 1.5,
  "http_requests": {
    "GET_/api/v1/games_200": 845,
    "POST_/api/v1/games_201": 156,
    "POST_/api/v1/auth/login_200": 203
  },
  "http_latencies": {
    "GET_/api/v1/games": {
      "count": 845,
      "avg_ms": 45.2,
      "p95_ms": 120.5,
      "p99_ms": 250.0
    }
  }
}
```

### Health Check Endpoint
Service health check at: `GET /health`

```json
{
  "status": "healthy",
  "timestamp": "2025-08-07T18:30:00Z",
  "uptime": "2h15m30s",
  "checks": {
    "service": {
      "status": "healthy",
      "message": "Service is running"
    },
    "error_rate": {
      "status": "healthy",
      "message": "Error rate is normal"
    }
  }
}
```

## Best Practices

### DO ✅

1. **Always use context-aware logging** with `logger.Info(ctx, ...)`
2. **Include structured fields** for better log analysis
3. **Use consistent field names** across the application
4. **Log operation start/completion** for important business operations
5. **Include correlation IDs** in all log entries
6. **Use appropriate log levels** based on message importance
7. **Log errors with context** using `LogError()` method
8. **Include timing information** for performance analysis

### DON'T ❌

1. **Don't use string formatting** in log messages
2. **Don't log sensitive information** like passwords or tokens
3. **Don't use inconsistent field names** across components
4. **Don't ignore context** when logging
5. **Don't log at inappropriate levels** (e.g., DEBUG in production)
6. **Don't create log spam** with excessive DEBUG logging
7. **Don't log without structured fields** when context is available
8. **Don't forget to propagate context** through function calls

## Migration from Existing Logging

To migrate existing code to use the new logging system:

### 1. Replace Logger Instance
```go
// Old
import "log/slog"
logger := slog.Default()

// New
import "actionphase/pkg/observability"
logger := observability.NewLogger(environment, logLevel)
```

### 2. Update Log Calls
```go
// Old
logger.Info("Starting operation", "user_id", userID)

// New
logger.Info(ctx, "Starting operation", "user_id", userID)
```

### 3. Add Context Propagation
```go
// Ensure context is passed through function calls
func (s *Service) ProcessRequest(ctx context.Context, ...) error {
    // Pass ctx to all downstream calls
    return s.repository.SaveData(ctx, data)
}
```

## Performance Considerations

- **Structured fields** are more efficient than string formatting
- **Context extraction** is optimized with early returns for empty context
- **Metrics collection** uses bounded arrays to prevent memory leaks
- **Log levels** are checked before expensive operations
- **JSON formatting** in production is optimized for log ingestion

## Troubleshooting

### Common Issues

1. **Missing correlation IDs**: Ensure middleware is properly configured
2. **Context not propagated**: Check that `ctx` is passed through function calls
3. **High memory usage**: Check that metrics arrays are bounded (automatic)
4. **Missing structured fields**: Use structured logging instead of string formatting
5. **Inconsistent field names**: Follow the field naming conventions

### Debug Steps

1. Check middleware order in HTTP router
2. Verify context is being passed correctly
3. Confirm log level configuration
4. Test metrics endpoint for data collection
5. Review health check endpoint for service status

This logging standard ensures consistent, structured, and actionable logging across the ActionPhase backend, making debugging, monitoring, and performance analysis significantly more effective.
