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
