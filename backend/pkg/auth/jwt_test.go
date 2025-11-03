package auth

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
	"strconv"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestJWTHandler_CreateToken(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "sessions", "users")
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	handler := &JWTHandler{App: app}

	// Create a test user
	userService := &db.UserService{DB: testDB.Pool}
	user, err := userService.CreateUser(&core.User{
		Username: "testuser",
		Password: "password123",
		Email:    "test@example.com",
	})
	core.AssertNoError(t, err, "User creation should succeed")

	t.Run("creates_valid_token", func(t *testing.T) {
		token, err := handler.CreateToken(user)
		core.AssertNoError(t, err, "Token creation should succeed")
		core.AssertTrue(t, len(token) > 0, "Token should not be empty")

		// Verify token contains user ID in sub claim
		claims, err := handler.DecodeToken(token)
		core.AssertNoError(t, err, "Token decode should succeed")
		core.AssertEqual(t, strconv.Itoa(user.ID), claims["sub"].(string), "Token should contain user_id in sub claim")
	})

	t.Run("creates_session", func(t *testing.T) {
		token, err := handler.CreateToken(user)
		core.AssertNoError(t, err, "Token creation should succeed")

		// Verify session was created
		sessionService := &db.SessionService{DB: testDB.Pool}
		session, err := sessionService.SessionByToken(token)
		core.AssertNoError(t, err, "Session should exist")
		core.AssertNotEqual(t, nil, session, "Session should not be nil")
		core.AssertTrue(t, session.ID > 0, "Session should have valid ID")
	})

	t.Run("token_contains_session_id", func(t *testing.T) {
		token, err := handler.CreateToken(user)
		core.AssertNoError(t, err, "Token creation should succeed")

		claims, err := handler.DecodeToken(token)
		core.AssertNoError(t, err, "Token decode should succeed")

		// Verify session_id exists in claims
		sessionID, ok := claims["session_id"]
		core.AssertTrue(t, ok, "Token should contain session_id claim")
		core.AssertTrue(t, sessionID != nil, "session_id should not be nil")

		// Verify it's a valid number
		sessionIDFloat, ok := sessionID.(float64)
		core.AssertTrue(t, ok, "session_id should be a number")
		core.AssertTrue(t, sessionIDFloat > 0, "session_id should be positive")
	})
}

func TestJWTHandler_VerifyToken(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "sessions", "users")
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	handler := &JWTHandler{App: app}

	// Create a test user and token
	userService := &db.UserService{DB: testDB.Pool}
	user, err := userService.CreateUser(&core.User{
		Username: "testuser",
		Password: "password123",
		Email:    "test@example.com",
	})
	core.AssertNoError(t, err, "User creation should succeed")

	validToken, err := handler.CreateToken(user)
	core.AssertNoError(t, err, "Token creation should succeed")

	t.Run("verifies_valid_token", func(t *testing.T) {
		err := handler.VerifyToken(validToken)
		core.AssertNoError(t, err, "Valid token should verify successfully")
	})

	t.Run("rejects_invalid_token", func(t *testing.T) {
		err := handler.VerifyToken("invalid.token.here")
		core.AssertTrue(t, err != nil, "Invalid token should fail verification")
	})

	t.Run("rejects_token_with_wrong_secret", func(t *testing.T) {
		// Create a token with a different secret
		wrongSecretToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": strconv.Itoa(user.ID),
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := wrongSecretToken.SignedString([]byte("wrong-secret"))

		err := handler.VerifyToken(tokenString)
		core.AssertTrue(t, err != nil, "Token with wrong secret should fail verification")
	})

	t.Run("rejects_expired_token", func(t *testing.T) {
		// Create an expired token
		expiredToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": strconv.Itoa(user.ID),
			"exp": time.Now().Add(-time.Hour).Unix(), // Expired 1 hour ago
		})
		tokenString, _ := expiredToken.SignedString([]byte(app.Config.JWT.Secret))

		err := handler.VerifyToken(tokenString)
		core.AssertTrue(t, err != nil, "Expired token should fail verification")
	})

	t.Run("rejects_token_without_session", func(t *testing.T) {
		// Create a valid token but don't create a session for it
		orphanToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": strconv.Itoa(user.ID),
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := orphanToken.SignedString([]byte(app.Config.JWT.Secret))

		err := handler.VerifyToken(tokenString)
		core.AssertTrue(t, err != nil, "Token without session should fail verification")
	})
}

func TestJWTHandler_DecodeToken(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	testDB.CleanupTables(t, "sessions", "users")
	defer testDB.CleanupTables(t, "sessions", "users")

	app := core.NewTestApp(testDB.Pool)
	handler := &JWTHandler{App: app}

	// Create a test user and token
	userService := &db.UserService{DB: testDB.Pool}
	user, err := userService.CreateUser(&core.User{
		Username: "testuser",
		Password: "password123",
		Email:    "test@example.com",
	})
	core.AssertNoError(t, err, "User creation should succeed")

	validToken, err := handler.CreateToken(user)
	core.AssertNoError(t, err, "Token creation should succeed")

	t.Run("decodes_valid_token", func(t *testing.T) {
		claims, err := handler.DecodeToken(validToken)
		core.AssertNoError(t, err, "Token decode should succeed")
		core.AssertEqual(t, strconv.Itoa(user.ID), claims["sub"].(string), "Claims should contain user_id in sub")
		core.AssertNotEqual(t, nil, claims["exp"], "Claims should contain exp")
	})

	t.Run("rejects_invalid_token", func(t *testing.T) {
		_, err := handler.DecodeToken("invalid.token.here")
		core.AssertTrue(t, err != nil, "Invalid token should fail to decode")
	})

	t.Run("rejects_token_with_wrong_secret", func(t *testing.T) {
		wrongSecretToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": strconv.Itoa(user.ID),
			"exp": time.Now().Add(time.Hour).Unix(),
		})
		tokenString, _ := wrongSecretToken.SignedString([]byte("wrong-secret"))

		_, err := handler.DecodeToken(tokenString)
		core.AssertTrue(t, err != nil, "Token with wrong secret should fail to decode")
	})
}
