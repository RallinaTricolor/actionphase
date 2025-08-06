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

// Ensure UserService implements the interface
var _ core.UserServiceInterface = (*UserService)(nil)

func (s *UserService) User(id int) (*core.User, error) {
	return nil, nil
}

func (s *UserService) UserByUsername(username string) (*core.User, error) {
	ctx := context.Background()
	q := db.New(s.DB)
	dbUser, err := q.GetUserByUsername(ctx, username)
	if err != nil {
		return nil, err
	}
	return &core.User{
		ID:        int(dbUser.ID),
		Username:  dbUser.Username,
		Password:  dbUser.Password,
		Email:     dbUser.Email,
		CreatedAt: &dbUser.CreatedAt.Time,
	}, nil
}

func (s *UserService) Users() ([]*core.User, error) {
	return nil, nil
}

func (s *UserService) CreateUser(u *core.User) (*core.User, error) {
	ctx := context.Background()
	u.HashPassword()
	q := db.New(s.DB)
	dbUser, err := q.CreateUser(ctx, db.CreateUserParams{
		Username: u.Username,
		Password: u.Password,
		Email:    u.Email,
	})
	return &core.User{
		ID:        int(dbUser.ID),
		Username:  dbUser.Username,
		Email:     dbUser.Email,
		CreatedAt: &dbUser.CreatedAt.Time,
	}, err
}

func (s *UserService) DeleteUser(id int) error {
	return nil
}
