package games

import (
	"actionphase/pkg/core"
	"fmt"

	"github.com/go-chi/render"
)

// ValidateGameRole validates that the role is either "player" or "audience"
func ValidateGameRole(role string) render.Renderer {
	if role != "player" && role != "audience" {
		return core.ErrInvalidRequest(fmt.Errorf("role must be 'player' or 'audience'"))
	}
	return nil
}

// ValidateApplicationAction validates that the action is either "approve" or "reject"
func ValidateApplicationAction(action string) render.Renderer {
	if action != "approve" && action != "reject" {
		return core.ErrInvalidRequest(fmt.Errorf("action must be 'approve' or 'reject'"))
	}
	return nil
}
