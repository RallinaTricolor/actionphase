/*
Package services provides database service implementations for ActionPhase.

This package contains the data access layer implementations that interact with
PostgreSQL database using sqlc-generated code and pgx connection pools.
All services implement interfaces defined in the core package for testability.

Service Implementations:

UserService:
  - User account management (create, retrieve, delete)
  - Username and email uniqueness validation
  - Password hashing and verification integration
  - User lookup by ID or username

SessionService:
  - JWT refresh token session management
  - Session creation with configurable expiration
  - Session retrieval and validation
  - Session cleanup and revocation

GameService:
  - Complete game lifecycle management
  - Game state validation and transitions
  - Player recruitment and participation
  - Complex game queries with joins and aggregations

Architecture:

All services follow these patterns:
  - Accept pgx connection pool in constructor
  - Implement core package interfaces
  - Use sqlc-generated models and queries
  - Handle database errors consistently
  - Support transactions where needed

Database Integration:
  - Uses sqlc for type-safe SQL query generation
  - PostgreSQL with pgx/v5 driver for performance
  - Connection pooling for concurrent access
  - Migration-driven schema management
  - Foreign key constraints for data integrity

Error Handling:
  - Database constraint violations mapped to business errors
  - Connection errors handled gracefully
  - Transaction rollback on failures
  - Detailed error context for debugging

Testing:
  - All services have comprehensive test suites
  - Integration tests with real database
  - Mock implementations available in core package
  - Test fixtures and utilities for consistent setup

Usage Example:

	// Service initialization
	pool := pgxpool.New(ctx, connectionString)

	userService := &services.UserService{DB: pool}
	sessionService := &services.SessionService{DB: pool}
	gameService := &services.GameService{DB: pool}

	// Dependency injection with interfaces
	authHandler := &auth.Handler{
		UserService:    userService,
		SessionService: sessionService,
	}

	gameHandler := &games.Handler{
		GameService: gameService,
		UserService: userService,
	}

	// Business logic usage
	user, err := userService.CreateUser(&core.User{
		Username: "player1",
		Email:    "player1@example.com",
		Password: "hashed_password",
	})

	game, err := gameService.CreateGame(ctx, core.CreateGameRequest{
		Title:       "Epic Adventure",
		Description: "A thrilling D&D campaign",
		GMUserID:    int32(user.ID),
		MaxPlayers:  6,
		IsPublic:    true,
	})

Performance Considerations:
  - Connection pooling minimizes connection overhead
  - Prepared statements cache for repeated queries
  - Bulk operations for multiple record updates
  - Efficient pagination for large result sets
  - Index usage optimized through query analysis
*/
package db
