package core

import (
	"golang.org/x/crypto/bcrypt"
	"time"
)

type User struct {
	ID        int        `json:"id"`
	Username  string     `json:"username"`
	Email     string     `json:"email"`
	Password  string     `json:"-"`
	CreatedAt *time.Time `json:"createdAt"`
}

func (u *User) HashPassword() error {
	bytes, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(bytes)
	return nil
}

func (u *User) CheckPasswordHash(plaintext string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(plaintext))
	return err == nil
}

type UserService interface {
	User(id int) (*User, error)
	Users() ([]*User, error)
	CreateUser(u *User) error
	DeleteUser(id int) error
}
