package characters

import (
	"actionphase/pkg/core"
)

// Handler handles character-related HTTP requests
type Handler struct {
	App                 *core.App
	UserService         core.UserServiceInterface
	CharacterService    core.CharacterServiceInterface
	GameService         core.GameServiceInterface
	NotificationService core.NotificationServiceInterface
	// MessageService resolves the caller's viewer scope, so public message
	// counts leave out restricted threads the caller can't see.
	MessageService core.MessageServiceInterface
}

// The operations live in huma_api.go (type-first handlers plus their
// registration); authz_stats.go holds the private-stats visibility rules they
// share, and requests.go / responses.go the request and response bodies.
