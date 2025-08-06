/*
Package core provides the foundational types, interfaces, and utilities for ActionPhase.

This package serves as the central hub for:
  - Domain models (User, Session, Game-related types)
  - Service interfaces for dependency injection and testing
  - Mock implementations for testing
  - Common utilities and test helpers
  - API error handling types

Key Components:

Domain Models:

	User represents a user account with authentication capabilities
	Session manages user authentication sessions with JWT tokens
	APIError provides structured error responses

Service Interfaces:

	UserServiceInterface defines user management operations
	SessionServiceInterface defines session management operations
	GameServiceInterface defines game management operations

Testing Support:

	Mock* types provide configurable mock implementations
	TestDatabase provides database testing utilities
	Test helper functions for assertions and data generation

Usage Example:

	// Using service interfaces with dependency injection
	type GameHandler struct {
		GameService core.GameServiceInterface
		UserService core.UserServiceInterface
	}

	// Creating test doubles
	mockGameService := &core.MockGameService{
		CreateGameFunc: func(ctx context.Context, req core.CreateGameRequest) (*models.Game, error) {
			// Test implementation
			return &models.Game{ID: 123}, nil
		},
	}

	// Setting up test database
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	fixtures := testDB.SetupFixtures(t)

Design Principles:
  - Interface-first development for testability
  - Clear separation of concerns
  - Type safety with compile-time interface verification
  - Comprehensive error handling
  - Testing utilities integrated from the start
*/
package core
