package core

import (
	"golang.org/x/crypto/bcrypt"
	"time"
)

type User struct {
	ID        int        `json:"id"`
	Username  string     `json:"name"`
	Email     string     `json:"email"`
	Password  Password   `json:"-"`
	CreatedAt *time.Time `json:"createdAt"`
}

type Password struct {
	Plaintext *string
	Hash      string
}

func (p *Password) GeneratePasswordHash(plaintext string) error {
	bytes, err := bcrypt.GenerateFromPassword([]byte(plaintext), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	p.Plaintext = &plaintext
	p.Hash = string(bytes)
	return nil
}

func (p *Password) CheckPasswordHash(plaintext string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(p.Hash), []byte(plaintext))
	return err == nil
}

type UserService interface {
	User(id int) (*User, error)
	Users() ([]*User, error)
	CreateUser(u *User) error
	DeleteUser(id int) error
}
