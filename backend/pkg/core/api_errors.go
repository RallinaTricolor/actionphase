package core

import (
	"github.com/go-chi/render"
	"net/http"
)

// ErrResponse represents a structured API error response that follows ActionPhase error handling conventions.
// It separates internal errors from user-facing messages and provides consistent JSON structure.
//
// Error Response Format:
//
//	{
//	  "status": "user-friendly status message",
//	  "code": 1001,  // optional application-specific error code
//	  "error": "detailed error for debugging"
//	}
//
// Design Principles:
//   - Internal errors (Err field) are never exposed to clients
//   - HTTP status codes follow REST conventions
//   - StatusText provides user-friendly messages
//   - ErrorText gives debugging information (safe for clients)
//   - AppCode enables application-specific error categorization
type ErrResponse struct {
	Err            error `json:"-"` // Internal runtime error (never serialized)
	HTTPStatusCode int   `json:"-"` // HTTP response status code (never serialized)

	StatusText string `json:"status"`          // User-friendly status message
	AppCode    int64  `json:"code,omitempty"`  // Application-specific error code
	ErrorText  string `json:"error,omitempty"` // Debugging error message (client-safe)
}

// Render implements the chi/render.Renderer interface for HTTP response rendering.
// It sets the HTTP status code and allows the JSON marshaling to handle the response body.
func (e *ErrResponse) Render(w http.ResponseWriter, r *http.Request) error {
	render.Status(r, e.HTTPStatusCode)
	return nil
}

// ErrInvalidRequest creates a 400 Bad Request error for invalid request data.
// Use this for validation failures, malformed JSON, missing required fields, etc.
//
// Example Usage:
//
//	if validationErr := validateUser(user); validationErr != nil {
//	    render.Render(w, r, ErrInvalidRequest(validationErr))
//	    return
//	}
func ErrInvalidRequest(err error) render.Renderer {
	return &ErrResponse{
		Err:            err,
		HTTPStatusCode: 400,
		StatusText:     "Invalid request.",
		ErrorText:      err.Error(),
	}
}

// ErrInternalError creates a 500 Internal Server Error for unexpected system errors.
// Use this for database connection failures, external service errors, etc.
// The internal error details are logged but not exposed to clients.
//
// Example Usage:
//
//	if dbErr := db.SaveUser(user); dbErr != nil {
//	    log.Error("Database save failed", "error", dbErr)
//	    render.Render(w, r, ErrInternalError(dbErr))
//	    return
//	}
func ErrInternalError(err error) render.Renderer {
	return &ErrResponse{
		Err:            err,
		HTTPStatusCode: 500,
		StatusText:     "Internal server error.",
		ErrorText:      err.Error(),
	}
}

// ErrUnauthorized creates a 401 Unauthorized error for authentication failures.
// Use this when user credentials are invalid or missing.
//
// Example Usage:
//
//	if !isValidToken(token) {
//	    render.Render(w, r, ErrUnauthorized("Invalid or expired token"))
//	    return
//	}
func ErrUnauthorized(message string) render.Renderer {
	return &ErrResponse{
		HTTPStatusCode: 401,
		StatusText:     "Unauthorized.",
		ErrorText:      message,
	}
}

// ErrForbidden creates a 403 Forbidden error for authorization failures.
// Use this when user is authenticated but lacks permission for the action.
//
// Example Usage:
//
//	if userRole != "admin" {
//	    render.Render(w, r, ErrForbidden("Admin access required"))
//	    return
//	}
func ErrForbidden(message string) render.Renderer {
	return &ErrResponse{
		HTTPStatusCode: 403,
		StatusText:     "Forbidden.",
		ErrorText:      message,
	}
}

// ErrBadRequest creates a 400 Bad Request error for client request errors.
// Similar to ErrInvalidRequest but for more general request processing failures.
//
// Example Usage:
//
//	if gameState == "completed" {
//	    render.Render(w, r, ErrBadRequest(errors.New("Cannot join completed game")))
//	    return
//	}
func ErrBadRequest(err error) render.Renderer {
	return &ErrResponse{
		Err:            err,
		HTTPStatusCode: 400,
		StatusText:     "Bad request.",
		ErrorText:      err.Error(),
	}
}
