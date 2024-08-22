package core

import (
	"github.com/go-playground/validator/v10"
	"golang.org/x/crypto/bcrypt"
	"time"
)

type User struct {
	ID        int        `json:"id"`
	Username  string     `json:"username" validate:"required"`
	Email     string     `json:"email" validate:"required,email"`
	Password  string     `json:"password" validate:"required,min=8,max=64"`
	CreatedAt *time.Time `json:"createdAt"`
}

var validate *validator.Validate

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
	UserByUsername(username string) (*User, error)
	Users() ([]*User, error)
	CreateUser(u *User) error
	DeleteUser(id int) error
}

func (u *User) Validate() error {
	validate = validator.New(validator.WithRequiredStructEnabled())
	err := validate.Struct(u)
	if err != nil {
		return err
	}
	return nil
}

type Session struct {
	ID      int `json:"id"`
	User    *User
	Token   string     `json:"token"`
	Expires *time.Time `json:"expires"`
}

type SessionService interface {
	Session(id int) (*Session, error)
	SessionByToken(token string) (*Session, error)
	Sessions() ([]*Session, error)
	SessionsByUser() ([]*Session, error)
	CreateSession(us *Session) (*Session, error)
	DeleteSession(id int) error
}
