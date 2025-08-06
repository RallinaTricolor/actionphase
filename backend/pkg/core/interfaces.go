package core

import (
	models "actionphase/pkg/db/models"
	"context"
	"time"
)

// SessionServiceInterface defines the contract for session management operations.
// Sessions are used to manage JWT refresh tokens and provide secure token renewal.
//
// Usage Example:
//
//	sessionService := &services.SessionService{DB: pool}
//
//	// Create a new session for user login
//	session := &Session{
//	    User:  user,
//	    Token: "refresh_token_string",
//	}
//	createdSession, err := sessionService.CreateSession(session)
//
//	// Retrieve session by refresh token
//	session, err := sessionService.SessionByToken("refresh_token")
//
//	// Clean up expired sessions
//	err := sessionService.DeleteSessionByToken("old_token")
type SessionServiceInterface interface {
	// Session retrieves a session by ID
	Session(id int) (*Session, error)

	// SessionByToken retrieves a session by its token
	SessionByToken(token string) (*Session, error)

	// Sessions retrieves all sessions (primarily for admin operations)
	Sessions() ([]*Session, error)

	// CreateSession creates a new session for a user
	CreateSession(session *Session) (*Session, error)

	// DeleteSessionByToken removes a session by its token
	DeleteSessionByToken(token string) error
}

// UserServiceInterface defines the contract for user management operations.
// Handles user account lifecycle including registration, authentication, and profile management.
//
// Usage Example:
//
//	userService := &services.UserService{DB: pool}
//
//	// Create a new user account
//	user := &User{
//	    Username: "player1",
//	    Email:    "player1@example.com",
//	    Password: "plaintext_password",
//	}
//	user.HashPassword() // Hash password before storage
//	createdUser, err := userService.CreateUser(user)
//
//	// Authenticate user login
//	user, err := userService.UserByUsername("player1")
//	if user != nil && user.CheckPasswordHash("attempted_password") {
//	    // User authenticated successfully
//	}
//
//	// Retrieve user for authorization
//	user, err := userService.User(userID)
type UserServiceInterface interface {
	// User retrieves a user by ID
	User(id int) (*User, error)

	// UserByUsername retrieves a user by username
	UserByUsername(username string) (*User, error)

	// Users retrieves all users (primarily for admin operations)
	Users() ([]*User, error)

	// CreateUser creates a new user account
	CreateUser(user *User) (*User, error)

	// DeleteUser removes a user account
	DeleteUser(id int) error
}

// GameServiceInterface defines the contract for game management operations.
// Handles complete game lifecycle from creation through completion, including
// participant management and state transitions.
//
// Usage Example:
//
//	gameService := &services.GameService{DB: pool}
//
//	// Create a new game
//	game, err := gameService.CreateGame(ctx, CreateGameRequest{
//	    Title:       "Epic D&D Campaign",
//	    Description: "A thrilling adventure in the Forgotten Realms",
//	    GMUserID:    int32(gmUser.ID),
//	    Genre:       "Fantasy RPG",
//	    MaxPlayers:  6,
//	    IsPublic:    true,
//	})
//
//	// Transition game to accept players
//	game, err = gameService.UpdateGameState(ctx, game.ID, "recruitment")
//
//	// Player joins the game
//	err = gameService.JoinGame(ctx, game.ID, int32(player.ID), "player")
//
//	// Check if user can perform actions
//	role, err := gameService.GetUserRole(ctx, game.ID, int32(user.ID))
//	if role == "gm" {
//	    // User is Game Master, allow game management
//	}
//
//	// Start the game when ready
//	game, err = gameService.UpdateGameState(ctx, game.ID, "in_progress")
type GameServiceInterface interface {
	// CreateGame creates a new game with the given parameters
	CreateGame(ctx context.Context, req CreateGameRequest) (*models.Game, error)

	// GetGame retrieves a game by its ID
	GetGame(ctx context.Context, gameID int32) (*models.Game, error)

	// GetGamesByUser retrieves all games associated with a user
	GetGamesByUser(ctx context.Context, userID int32) ([]models.GetGamesByUserRow, error)

	// GetAllGames retrieves all games in the system
	GetAllGames(ctx context.Context) ([]models.GetAllGamesRow, error)

	// UpdateGameState updates the state of a game (setup, recruitment, in_progress, etc.)
	UpdateGameState(ctx context.Context, gameID int32, newState string) (*models.Game, error)

	// UpdateGame updates game details
	UpdateGame(ctx context.Context, req UpdateGameRequest) (*models.Game, error)

	// DeleteGame removes a game from the system
	DeleteGame(ctx context.Context, gameID int32) error

	// JoinGame allows a user to join a game with a specific role
	JoinGame(ctx context.Context, gameID, userID int32, role string) error

	// LeaveGame allows a user to leave a game
	LeaveGame(ctx context.Context, gameID, userID int32) error

	// GetUserRole determines a user's role in a specific game
	GetUserRole(ctx context.Context, gameID, userID int32) (string, error)

	// IsUserInGame checks if a user is participating in a game
	IsUserInGame(ctx context.Context, gameID, userID int32) (bool, error)

	// GetGameWithDetails retrieves a game with additional metadata
	GetGameWithDetails(ctx context.Context, gameID int32) (*models.GetGameWithDetailsRow, error)

	// GetRecruitingGames retrieves all games currently accepting new players
	GetRecruitingGames(ctx context.Context) ([]models.GetRecruitingGamesRow, error)

	// CanUserJoinGame checks if a user is eligible to join a specific game
	CanUserJoinGame(ctx context.Context, gameID, userID int32) (string, error)

	// AddGameParticipant adds a user as a participant to a game
	AddGameParticipant(ctx context.Context, gameID, userID int32, role string) (*models.GameParticipant, error)

	// RemoveGameParticipant removes a user from game participants
	RemoveGameParticipant(ctx context.Context, gameID, userID int32) error

	// GetGameParticipants retrieves all participants for a game
	GetGameParticipants(ctx context.Context, gameID int32) ([]models.GetGameParticipantsRow, error)
}

// CreateGameRequest represents the parameters needed to create a new game
type CreateGameRequest struct {
	Title               string
	Description         string
	GMUserID            int32
	Genre               string
	StartDate           *time.Time
	EndDate             *time.Time
	RecruitmentDeadline *time.Time
	MaxPlayers          int32
	IsPublic            bool
}

// UpdateGameRequest represents the parameters needed to update an existing game
type UpdateGameRequest struct {
	ID                  int32
	Title               string
	Description         string
	Genre               string
	StartDate           *time.Time
	EndDate             *time.Time
	RecruitmentDeadline *time.Time
	MaxPlayers          int32
	IsPublic            bool
}
