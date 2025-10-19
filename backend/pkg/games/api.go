package games

import (
	"actionphase/pkg/core"
)

// Handler handles HTTP requests for game-related endpoints
type Handler struct {
	App *core.App
}

// All handler methods are organized into separate files:
// - api_crud.go: CRUD operations (Create, Get, Update, Delete, etc.)
// - api_participants.go: Participant management (Leave, GetParticipants)
// - api_applications.go: Application management (Apply, Review, Withdraw, etc.)
