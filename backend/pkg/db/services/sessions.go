package db

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	"context"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"time"
)

type SessionService struct {
	DB *pgxpool.Pool
}

// Ensure SessionService implements the interface
var _ core.SessionServiceInterface = (*SessionService)(nil)

func (s *SessionService) Session(id int) (*core.Session, error) {
	return nil, nil
}

func (s *SessionService) SessionByToken(token string) (*core.Session, error) {
	ctx := context.Background()
	q := db.New(s.DB)
	dbSession, err := q.GetSessionByToken(ctx, token)
	if err != nil {
		return nil, err
	}
	return &core.Session{
		ID: int(dbSession.ID),
	}, nil
}

func (s *SessionService) Sessions() ([]*core.Session, error) {
	return nil, nil
}

// GetUserSessions returns all active sessions for a specific user
func (s *SessionService) GetUserSessions(ctx context.Context, userID int32) ([]db.Session, error) {
	q := db.New(s.DB)
	sessions, err := q.GetSessionsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	return sessions, nil
}

// DeleteSession deletes a session by ID
func (s *SessionService) DeleteSession(ctx context.Context, sessionID int32) error {
	q := db.New(s.DB)
	return q.DeleteSession(ctx, sessionID)
}

func (s *SessionService) CreateSession(us *core.Session) (*core.Session, error) {
	ctx := context.Background()
	q := db.New(s.DB)
	dbSession, err := q.CreateSession(ctx, db.CreateSessionParams{
		UserID:  int32(us.User.ID),
		Data:    us.Token,
		Expires: pgtype.Timestamptz{Time: time.Now().Add(time.Hour * 24 * 7), Valid: true},
	})
	return &core.Session{
		ID: int(dbSession.ID),
	}, err
}

func (s *SessionService) DeleteSessionByToken(token string) error {
	ctx := context.Background()
	q := db.New(s.DB)
	err := q.DeleteSessionByToken(ctx, token)
	return err
}

// InvalidateAllUserSessions deletes all sessions for a user (used when banning)
func (s *SessionService) InvalidateAllUserSessions(ctx context.Context, userID int32) error {
	q := db.New(s.DB)
	return q.DeleteUserSessions(ctx, userID)
}

// UpdateSessionToken updates the token for an existing session
func (s *SessionService) UpdateSessionToken(sessionID int32, token string) error {
	ctx := context.Background()
	q := db.New(s.DB)
	return q.UpdateSessionToken(ctx, db.UpdateSessionTokenParams{
		ID:   sessionID,
		Data: token,
	})
}
