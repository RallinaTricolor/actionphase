package db

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func setupTestDB() (*pgxpool.Pool, error) {
	// Use the same connection string as the main app for testing
	connectionString := "postgres://postgres:example@localhost:5432/database?sslmode=disable"
	return pgxpool.New(context.Background(), connectionString)
}

func TestGameService_CreateGame(t *testing.T) {
	pool, err := setupTestDB()
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}
	defer pool.Close()

	gameService := &GameService{DB: pool}

	// First, we need a user to be the GM
	// For now, let's assume user with ID 1 exists from the existing system
	req := CreateGameRequest{
		Title:       "Test Game",
		Description: "A test game for our new system",
		GMUserID:    1, // Assuming this user exists
		Genre:       "Fantasy",
		StartDate:   timePtr(time.Now().Add(24 * time.Hour)),
		EndDate:     timePtr(time.Now().Add(7 * 24 * time.Hour)),
		MaxPlayers:  6,
		IsPublic:    true,
	}

	game, err := gameService.CreateGame(context.Background(), req)
	if err != nil {
		t.Fatalf("Failed to create game: %v", err)
	}

	if game.Title != req.Title {
		t.Errorf("Expected title %s, got %s", req.Title, game.Title)
	}

	if game.State != "setup" {
		t.Errorf("Expected initial state 'setup', got %s", game.State)
	}

	t.Logf("Successfully created game with ID: %d", game.ID)
}

func TestGameService_UpdateGameState(t *testing.T) {
	pool, err := setupTestDB()
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}
	defer pool.Close()

	gameService := &GameService{DB: pool}

	// Create a test game first
	req := CreateGameRequest{
		Title:       "State Test Game",
		Description: "Testing state transitions",
		GMUserID:    1,
		IsPublic:    false,
	}

	game, err := gameService.CreateGame(context.Background(), req)
	if err != nil {
		t.Fatalf("Failed to create game: %v", err)
	}

	// Test state transition from setup to recruitment
	updatedGame, err := gameService.UpdateGameState(context.Background(), game.ID, "recruitment")
	if err != nil {
		t.Fatalf("Failed to update game state: %v", err)
	}

	if updatedGame.State != "recruitment" {
		t.Errorf("Expected state 'recruitment', got %s", updatedGame.State)
	}

	t.Logf("Successfully updated game state to: %s", updatedGame.State)
}

func timePtr(t time.Time) *time.Time {
	return &t
}
