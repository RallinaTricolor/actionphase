package core

import (
	"github.com/go-playground/validator/v10"
	"golang.org/x/crypto/bcrypt"
	"time"
)

// User represents a user account in the ActionPhase system.
// It includes authentication credentials, contact information, and metadata.
// The struct supports JSON serialization and validation tags for API usage.
type User struct {
	ID             int        `json:"id"`                                        // Unique user identifier
	Username       string     `json:"username" validate:"required"`              // Unique username for login
	Email          string     `json:"email" validate:"required,email"`           // User's email address
	Password       string     `json:"password" validate:"required,min=8,max=64"` // Hashed password (bcrypt)
	IsAdmin        bool       `json:"is_admin"`                                  // Whether user has admin privileges
	IsBanned       bool       `json:"is_banned"`                                 // Whether user is banned from platform
	BannedAt       *time.Time `json:"banned_at,omitempty"`                       // When user was banned
	BannedByUserID *int32     `json:"banned_by_user_id,omitempty"`               // ID of admin who banned user
	CreatedAt      *time.Time `json:"createdAt"`                                 // Account creation timestamp
}

// BannedUser represents a banned user with additional ban information.
// Used for admin listing of banned users.
type BannedUser struct {
	ID               int       `json:"id"`
	Username         string    `json:"username"`
	Email            string    `json:"email"`
	BannedAt         time.Time `json:"banned_at"`
	BannedByUserID   int32     `json:"banned_by_user_id"`
	BannedByUsername string    `json:"banned_by_username"`
	CreatedAt        time.Time `json:"created_at"`
}

// validate is the shared validator instance for user validation
var validate *validator.Validate

// HashPassword hashes the user's plaintext password using bcrypt.
// This method modifies the User struct by replacing the plaintext password
// with its bcrypt hash. It should be called before storing the user in the database.
//
// Security Features:
//   - Uses bcrypt.DefaultCost (currently 10) for appropriate security/performance balance
//   - Salt is automatically generated and included in the hash
//   - Resistant to rainbow table and brute force attacks
//
// Returns:
//   - error: bcrypt hashing error, or nil if successful
//
// Usage:
//
//	user := &User{Password: "plaintext_password"}
//	err := user.HashPassword()  // user.Password is now hashed
func (u *User) HashPassword() error {
	bytes, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(bytes)
	return nil
}

// CheckPasswordHash verifies a plaintext password against the user's stored hash.
// This method is used during login to authenticate users.
//
// Parameters:
//   - plaintext: The plaintext password to verify
//
// Returns:
//   - bool: true if password matches, false otherwise
//
// Security Notes:
//   - Uses constant-time comparison to prevent timing attacks
//   - No error information is exposed to prevent enumeration attacks
//   - Hash comparison includes salt verification
//
// Usage:
//
//	if user.CheckPasswordHash("attempted_password") {
//	    // Password is correct, user is authenticated
//	}
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
	DeleteSessionByToken(token string) error
}
