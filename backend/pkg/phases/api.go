package phases

import (
	"fmt"
	"net/http"

	"actionphase/pkg/core"
	services "actionphase/pkg/db/services"

	"github.com/go-chi/jwtauth/v5"
)

// Handler handles phase-related HTTP requests
type Handler struct {
	App *core.App
}

// getUserFromToken extracts user information from JWT token
func (h *Handler) getUserFromToken(r *http.Request) (*core.User, error) {
	token, _, err := jwtauth.FromContext(r.Context())
	if err != nil {
		return nil, fmt.Errorf("no valid token found")
	}

	username, ok := token.Get("username")
	if !ok {
		return nil, fmt.Errorf("username not found in token")
	}

	userService := &services.UserService{DB: h.App.Pool}
	user, err := userService.UserByUsername(username.(string))
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	return user, nil
}

// All handler methods are organized into separate files:
// - api_crud.go: Phase CRUD operations (Create, Get, Update, etc.)
// - api_lifecycle.go: Phase lifecycle (Activate, Publish, etc.)
// - api_actions.go: Action submissions (Submit, Get user/game actions)
// - api_results.go: Action results (Create, Get, Update results)
//
// Request and response types are in:
// - requests.go: All request types with Bind methods
// - responses.go: All response types with Render methods
