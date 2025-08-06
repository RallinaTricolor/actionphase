package core

import (
	models "actionphase/pkg/db/models"
	"context"
)

// MockSessionService provides a mock implementation of SessionServiceInterface for testing
type MockSessionService struct {
	SessionFunc              func(id int) (*Session, error)
	SessionByTokenFunc       func(token string) (*Session, error)
	SessionsFunc             func() ([]*Session, error)
	CreateSessionFunc        func(session *Session) (*Session, error)
	DeleteSessionByTokenFunc func(token string) error
}

func (m *MockSessionService) Session(id int) (*Session, error) {
	if m.SessionFunc != nil {
		return m.SessionFunc(id)
	}
	return nil, nil
}

func (m *MockSessionService) SessionByToken(token string) (*Session, error) {
	if m.SessionByTokenFunc != nil {
		return m.SessionByTokenFunc(token)
	}
	return nil, nil
}

func (m *MockSessionService) Sessions() ([]*Session, error) {
	if m.SessionsFunc != nil {
		return m.SessionsFunc()
	}
	return nil, nil
}

func (m *MockSessionService) CreateSession(session *Session) (*Session, error) {
	if m.CreateSessionFunc != nil {
		return m.CreateSessionFunc(session)
	}
	return nil, nil
}

func (m *MockSessionService) DeleteSessionByToken(token string) error {
	if m.DeleteSessionByTokenFunc != nil {
		return m.DeleteSessionByTokenFunc(token)
	}
	return nil
}

// MockUserService provides a mock implementation of UserServiceInterface for testing
type MockUserService struct {
	UserFunc           func(id int) (*User, error)
	UserByUsernameFunc func(username string) (*User, error)
	UsersFunc          func() ([]*User, error)
	CreateUserFunc     func(user *User) (*User, error)
	DeleteUserFunc     func(id int) error
}

func (m *MockUserService) User(id int) (*User, error) {
	if m.UserFunc != nil {
		return m.UserFunc(id)
	}
	return nil, nil
}

func (m *MockUserService) UserByUsername(username string) (*User, error) {
	if m.UserByUsernameFunc != nil {
		return m.UserByUsernameFunc(username)
	}
	return nil, nil
}

func (m *MockUserService) Users() ([]*User, error) {
	if m.UsersFunc != nil {
		return m.UsersFunc()
	}
	return nil, nil
}

func (m *MockUserService) CreateUser(user *User) (*User, error) {
	if m.CreateUserFunc != nil {
		return m.CreateUserFunc(user)
	}
	return nil, nil
}

func (m *MockUserService) DeleteUser(id int) error {
	if m.DeleteUserFunc != nil {
		return m.DeleteUserFunc(id)
	}
	return nil
}

// MockGameService provides a mock implementation of GameServiceInterface for testing
type MockGameService struct {
	CreateGameFunc            func(ctx context.Context, req CreateGameRequest) (*models.Game, error)
	GetGameFunc               func(ctx context.Context, gameID int32) (*models.Game, error)
	GetGamesByUserFunc        func(ctx context.Context, userID int32) ([]models.GetGamesByUserRow, error)
	GetAllGamesFunc           func(ctx context.Context) ([]models.GetAllGamesRow, error)
	UpdateGameStateFunc       func(ctx context.Context, gameID int32, newState string) (*models.Game, error)
	UpdateGameFunc            func(ctx context.Context, req UpdateGameRequest) (*models.Game, error)
	DeleteGameFunc            func(ctx context.Context, gameID int32) error
	JoinGameFunc              func(ctx context.Context, gameID, userID int32, role string) error
	LeaveGameFunc             func(ctx context.Context, gameID, userID int32) error
	GetUserRoleFunc           func(ctx context.Context, gameID, userID int32) (string, error)
	IsUserInGameFunc          func(ctx context.Context, gameID, userID int32) (bool, error)
	GetGameWithDetailsFunc    func(ctx context.Context, gameID int32) (*models.GetGameWithDetailsRow, error)
	GetRecruitingGamesFunc    func(ctx context.Context) ([]models.GetRecruitingGamesRow, error)
	CanUserJoinGameFunc       func(ctx context.Context, gameID, userID int32) (string, error)
	AddGameParticipantFunc    func(ctx context.Context, gameID, userID int32, role string) (*models.GameParticipant, error)
	RemoveGameParticipantFunc func(ctx context.Context, gameID, userID int32) error
	GetGameParticipantsFunc   func(ctx context.Context, gameID int32) ([]models.GetGameParticipantsRow, error)
}

func (m *MockGameService) CreateGame(ctx context.Context, req CreateGameRequest) (*models.Game, error) {
	if m.CreateGameFunc != nil {
		return m.CreateGameFunc(ctx, req)
	}
	return nil, nil
}

func (m *MockGameService) GetGame(ctx context.Context, gameID int32) (*models.Game, error) {
	if m.GetGameFunc != nil {
		return m.GetGameFunc(ctx, gameID)
	}
	return nil, nil
}

func (m *MockGameService) GetGamesByUser(ctx context.Context, userID int32) ([]models.GetGamesByUserRow, error) {
	if m.GetGamesByUserFunc != nil {
		return m.GetGamesByUserFunc(ctx, userID)
	}
	return nil, nil
}

func (m *MockGameService) GetAllGames(ctx context.Context) ([]models.GetAllGamesRow, error) {
	if m.GetAllGamesFunc != nil {
		return m.GetAllGamesFunc(ctx)
	}
	return nil, nil
}

func (m *MockGameService) UpdateGameState(ctx context.Context, gameID int32, newState string) (*models.Game, error) {
	if m.UpdateGameStateFunc != nil {
		return m.UpdateGameStateFunc(ctx, gameID, newState)
	}
	return nil, nil
}

func (m *MockGameService) UpdateGame(ctx context.Context, req UpdateGameRequest) (*models.Game, error) {
	if m.UpdateGameFunc != nil {
		return m.UpdateGameFunc(ctx, req)
	}
	return nil, nil
}

func (m *MockGameService) DeleteGame(ctx context.Context, gameID int32) error {
	if m.DeleteGameFunc != nil {
		return m.DeleteGameFunc(ctx, gameID)
	}
	return nil
}

func (m *MockGameService) JoinGame(ctx context.Context, gameID, userID int32, role string) error {
	if m.JoinGameFunc != nil {
		return m.JoinGameFunc(ctx, gameID, userID, role)
	}
	return nil
}

func (m *MockGameService) LeaveGame(ctx context.Context, gameID, userID int32) error {
	if m.LeaveGameFunc != nil {
		return m.LeaveGameFunc(ctx, gameID, userID)
	}
	return nil
}

func (m *MockGameService) GetUserRole(ctx context.Context, gameID, userID int32) (string, error) {
	if m.GetUserRoleFunc != nil {
		return m.GetUserRoleFunc(ctx, gameID, userID)
	}
	return "", nil
}

func (m *MockGameService) IsUserInGame(ctx context.Context, gameID, userID int32) (bool, error) {
	if m.IsUserInGameFunc != nil {
		return m.IsUserInGameFunc(ctx, gameID, userID)
	}
	return false, nil
}

func (m *MockGameService) GetGameWithDetails(ctx context.Context, gameID int32) (*models.GetGameWithDetailsRow, error) {
	if m.GetGameWithDetailsFunc != nil {
		return m.GetGameWithDetailsFunc(ctx, gameID)
	}
	return nil, nil
}

func (m *MockGameService) GetRecruitingGames(ctx context.Context) ([]models.GetRecruitingGamesRow, error) {
	if m.GetRecruitingGamesFunc != nil {
		return m.GetRecruitingGamesFunc(ctx)
	}
	return nil, nil
}

func (m *MockGameService) CanUserJoinGame(ctx context.Context, gameID, userID int32) (string, error) {
	if m.CanUserJoinGameFunc != nil {
		return m.CanUserJoinGameFunc(ctx, gameID, userID)
	}
	return "", nil
}

func (m *MockGameService) AddGameParticipant(ctx context.Context, gameID, userID int32, role string) (*models.GameParticipant, error) {
	if m.AddGameParticipantFunc != nil {
		return m.AddGameParticipantFunc(ctx, gameID, userID, role)
	}
	return nil, nil
}

func (m *MockGameService) RemoveGameParticipant(ctx context.Context, gameID, userID int32) error {
	if m.RemoveGameParticipantFunc != nil {
		return m.RemoveGameParticipantFunc(ctx, gameID, userID)
	}
	return nil
}

func (m *MockGameService) GetGameParticipants(ctx context.Context, gameID int32) ([]models.GetGameParticipantsRow, error) {
	if m.GetGameParticipantsFunc != nil {
		return m.GetGameParticipantsFunc(ctx, gameID)
	}
	return nil, nil
}
