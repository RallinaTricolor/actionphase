/*
Package auth provides authentication and authorization functionality for ActionPhase.

This package implements JWT-based authentication with refresh token support,
user registration and login flows, and HTTP middleware for protecting routes.

Key Features:

JWT Authentication:
  - Access tokens for API authentication
  - Refresh tokens for secure token renewal
  - Configurable token expiration times
  - Stateless authentication with database-backed sessions

User Registration & Login:
  - Secure password hashing using bcrypt
  - Email and username validation
  - Duplicate user detection
  - Login with username/email and password

HTTP Integration:
  - Authentication middleware for protected routes
  - Token refresh endpoints
  - Session management
  - User context injection

Architecture:

The authentication flow follows these steps:
 1. User registers or logs in with credentials
 2. System generates JWT access token and refresh token
 3. Refresh token is stored in database for security
 4. Client uses access token for API requests
 5. When access token expires, client uses refresh token to get new tokens
 6. Refresh tokens can be revoked by deleting database sessions

Security Considerations:
  - Passwords are hashed with bcrypt (cost 10)
  - Refresh tokens are stored securely in database
  - JWT tokens have configurable expiration
  - Sessions can be revoked centrally
  - Input validation on all authentication endpoints

Usage Example:

	// Setting up authentication in Chi router
	r := chi.NewRouter()

	// Public routes
	r.Post("/auth/register", authHandler.Register)
	r.Post("/auth/login", authHandler.Login)

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(jwtauth.Verifier(tokenAuth))
		r.Use(jwtauth.Authenticator)
		r.Get("/auth/refresh", authHandler.Refresh)
		r.Get("/profile", userHandler.Profile)
	})

	// In handlers
	func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
		// Parse credentials, validate user, generate tokens
		tokens, err := h.AuthService.Login(username, password)
		// Return tokens to client
	}
*/
package auth
