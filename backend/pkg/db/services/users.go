package db

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserService struct {
	DB *pgxpool.Pool
}

func (s *UserService) User(id int) (*core.User, error) {
	return nil, nil
}

func (s *UserService) Users() ([]*core.User, error) {
	return nil, nil
}

func (s *UserService) CreateUser(u *core.User) error {
	ctx := context.Background()
	u.HashPassword()
	q := db.New(s.DB)
	_, err := q.CreateUser(ctx, db.CreateUserParams{
		Username: u.Username,
		Password: u.Password,
		Email:    u.Email,
	})
	return err
}

func (s *UserService) DeleteUser(id int) error {
	return nil
}
