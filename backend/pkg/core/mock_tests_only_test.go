//go:build !integration
// +build !integration

package core

import (
	db "actionphase/pkg/db/models"
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

// This file contains only mock-based tests that don't require a database
// Run with: go test -tags="!integration" ./pkg/core/

func TestMocks_UserService_CreateUser_WithSimpleMock(t *testing.T) {
	t.Parallel()

	mockRepo := CreateMockDatabaseRepo()

	userParams := db.CreateUserParams{
		Username: "testuser",
		Email:    "test@example.com",
		Password: "hashedpassword",
	}

	user, err := mockRepo.User.CreateUser(context.Background(), userParams)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if user.Username != userParams.Username {
		t.Errorf("Expected username %s, got %s", userParams.Username, user.Username)
	}

	if user.ID == 0 {
		t.Error("Expected user to have a valid ID")
	}

	retrievedUser, err := mockRepo.User.GetUser(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("Expected no error retrieving user, got %v", err)
	}

	if retrievedUser.Username != user.Username {
		t.Errorf("Expected retrieved username %s, got %s", user.Username, retrievedUser.Username)
	}
}

func TestMocks_UserService_CreateUser_WithFunctionMock(t *testing.T) {
	t.Parallel()

	mockUserRepo := &MockUserRepository{
		CreateUserFn: func(ctx context.Context, params db.CreateUserParams) (db.User, error) {
			return db.User{
				ID:       999,
				Username: params.Username,
				Email:    params.Email,
				Password: params.Password,
			}, nil
		},
	}

	userParams := db.CreateUserParams{
		Username: "functiontest",
		Email:    "functiontest@example.com",
		Password: "hashedpassword",
	}

	user, err := mockUserRepo.CreateUser(context.Background(), userParams)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if user.ID != 999 {
		t.Errorf("Expected user ID to be 999 (from mock), got %d", user.ID)
	}

	if user.Username != userParams.Username {
		t.Errorf("Expected username %s, got %s", userParams.Username, user.Username)
	}
}

func TestMocks_GameService_CreateAndRetrieveGame(t *testing.T) {
	t.Parallel()

	mockRepo := CreateMockDatabaseRepo()

	gameParams := db.CreateGameParams{
		Title:       "Test Adventure",
		Description: pgtype.Text{String: "A test RPG game", Valid: true},
		GmUserID:    1,
	}

	game, err := mockRepo.Game.CreateGame(context.Background(), gameParams)
	if err != nil {
		t.Fatalf("Expected no error creating game, got %v", err)
	}

	if game.Title != gameParams.Title {
		t.Errorf("Expected game title %s, got %s", gameParams.Title, game.Title)
	}

	retrievedGame, err := mockRepo.Game.GetGame(context.Background(), game.ID)
	if err != nil {
		t.Fatalf("Expected no error retrieving game, got %v", err)
	}

	if retrievedGame.Title != game.Title {
		t.Errorf("Expected retrieved game title %s, got %s", game.Title, retrievedGame.Title)
	}
}

func TestMocks_UserService_HandleErrors(t *testing.T) {
	t.Parallel()

	mockUserRepo := &MockUserRepository{
		GetUserFn: func(ctx context.Context, id int32) (db.User, error) {
			if id == 999 {
				return db.User{}, errors.New("user not found")
			}
			return db.User{ID: id, Username: "testuser"}, nil
		},
	}

	// Test successful case
	user, err := mockUserRepo.GetUser(context.Background(), 1)
	if err != nil {
		t.Fatalf("Expected no error for valid user, got %v", err)
	}
	if user.ID != 1 {
		t.Errorf("Expected user ID 1, got %d", user.ID)
	}

	// Test error case
	_, err = mockUserRepo.GetUser(context.Background(), 999)
	if err == nil {
		t.Fatal("Expected error for non-existent user, got nil")
	}

	expectedMsg := "user not found"
	if err.Error() != expectedMsg {
		t.Errorf("Expected error message '%s', got '%s'", expectedMsg, err.Error())
	}
}

func TestMocks_SessionService_CreateAndRetrieve(t *testing.T) {
	t.Parallel()

	mockRepo := CreateMockDatabaseRepo()

	sessionParams := db.CreateSessionParams{
		UserID: 1,
		Data:   "test_session_token",
	}

	session, err := mockRepo.Session.CreateSession(context.Background(), sessionParams)
	if err != nil {
		t.Fatalf("Expected no error creating session, got %v", err)
	}

	if session.Data != sessionParams.Data {
		t.Errorf("Expected session token %s, got %s", sessionParams.Data, session.Data)
	}

	retrievedSession, err := mockRepo.Session.GetSessionByToken(context.Background(), sessionParams.Data)
	if err != nil {
		t.Fatalf("Expected no error retrieving session by token, got %v", err)
	}

	if retrievedSession.ID != session.ID {
		t.Errorf("Expected retrieved session ID %d, got %d", session.ID, retrievedSession.ID)
	}
}

func TestMocks_GameParticipantService_AddAndCheckParticipant(t *testing.T) {
	t.Parallel()

	mockRepo := CreateMockDatabaseRepo()

	participantParams := db.AddGameParticipantParams{
		GameID: 1,
		UserID: 2,
		Role:   "player",
	}

	participant, err := mockRepo.GameParticipant.AddGameParticipant(context.Background(), participantParams)
	if err != nil {
		t.Fatalf("Expected no error adding participant, got %v", err)
	}

	if participant.Role != participantParams.Role {
		t.Errorf("Expected participant role %s, got %s", participantParams.Role, participant.Role)
	}

	isInGameParams := db.IsUserInGameParams{
		GameID: participantParams.GameID,
		UserID: participantParams.UserID,
	}

	isInGame, err := mockRepo.GameParticipant.IsUserInGame(context.Background(), isInGameParams)
	if err != nil {
		t.Fatalf("Expected no error checking if user is in game, got %v", err)
	}

	if !isInGame {
		t.Error("Expected user to be in game after being added as participant")
	}
}
