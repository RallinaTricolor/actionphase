package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"fmt"
	"github.com/go-chi/jwtauth/v5"
	"github.com/golang-jwt/jwt/v5"
	"net/http"
	"time"
)

// tokenAuth is the global JWT authentication instance used throughout the application.
// It uses HMAC-SHA256 algorithm for token signing and verification.
// TODO: Get secret key from environment variable for production security.
var tokenAuth *jwtauth.JWTAuth

func init() {
	// Initialize JWT auth with HMAC-SHA256 algorithm and secret key
	// TODO: Get this from env var for production deployment
	tokenAuth = jwtauth.New("HS256", []byte("SECRET"), nil)
}

// MakeToken creates a new JWT access token for the specified username.
// The token contains the username claim and is signed with the application secret.
//
// Parameters:
//   - name: Username to encode in the token
//
// Returns:
//   - string: The encoded JWT token string
//   - error: Encoding error if token creation fails
//
// Security Notes:
//   - Tokens are signed with HMAC-SHA256
//   - Default expiration is handled by jwtauth library
//   - Secret key should be from environment variable in production
func MakeToken(name string) (string, error) {
	_, tokenString, err := tokenAuth.Encode(map[string]interface{}{"username": name})
	return tokenString, err
}

func SetJWTCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		HttpOnly: true,
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		SameSite: http.SameSiteLaxMode,
		// Uncomment below for HTTPS:
		// Secure: true,
		Name:  "jwt", // Must be named "jwt" or else the token cannot be searched for by jwtauth.Verifier.
		Value: token,
		Path:  "/",
	})
}

// TODO: Read this from environment variable
var secretKey = []byte("SECRET")

type JWTHandler struct {
	App *core.App
}

func (j *JWTHandler) CreateToken(user *core.User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256,
		jwt.MapClaims{
			"username": user.Username,
			"exp":      time.Now().Add(time.Hour * 24 * 7).Unix(),
		})
	tokenString, err := token.SignedString(secretKey)
	SessionService := db.SessionService{DB: j.App.Pool}
	j.App.Logger.Info("Creating session for new user", "username", user.Username)
	_, err = SessionService.CreateSession(&core.Session{User: user, Token: tokenString})
	if err != nil {
		return "", err
	}
	return tokenString, nil
}

func (j *JWTHandler) VerifyToken(tokenString string) error {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return secretKey, nil
	})

	if err != nil {
		return err
	}

	if !token.Valid {
		return fmt.Errorf("invalid token")
	}
	s := db.SessionService{DB: j.App.Pool}
	_, err = s.SessionByToken(tokenString)
	if err != nil {
		return err
	}

	return nil
}

func (j *JWTHandler) DecodeToken(tokenString string) (map[string]interface{}, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return secretKey, nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}
