package db

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SessionService struct {
	DB *pgxpool.Pool
}

func (s *SessionService) Session(id int) (*core.Session, error) {
	return nil, nil
}

func (s *SessionService) Sessions() ([]*core.Session, error) {
	return nil, nil
}

func (s *SessionService) CreateSession(us *core.Session) (*core.Session, error) {
	ctx := context.Background()
	q := db.New(s.DB)
	dbSession, err := q.CreateSession(ctx, db.CreateSessionParams{
		UserID: int32(us.User.ID),
		Data:   us.Token,
	})
	return &core.Session{
		ID: int(dbSession.ID),
	}, err
}
