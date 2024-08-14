package db

import (
	"actionphase/pkg/core"
	"database/sql"
)

type UserService struct {
	DB *sql.DB
}

func (s *UserService) User(id int) (*core.User, error) {
	return nil, nil
}
