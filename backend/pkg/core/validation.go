package core

import (
	"context"
	"fmt"

	db "actionphase/pkg/db/models"
)

// ValidateGameNotCompleted checks if a game is in a completed or cancelled state
// and returns an error if write operations are not allowed.
//
// Completed and cancelled games are read-only archives. This validation should be
// called before any write operation (create/update/delete) on game content such as:
//   - Posts and comments (MessageService)
//   - Actions and action results (ActionService)
//   - Phases (PhaseService)
//   - Game settings (GameService)
//   - Characters (CharacterService)
//
// Parameters:
//   - ctx: Request context (not currently used but available for future enhancements)
//   - game: The game to validate (must contain State field)
//
// Returns:
//   - error: ErrGameArchived if game is completed/cancelled, nil if writable
//
// Example Usage:
//
//	game, err := gs.GetGame(ctx, gameID)
//	if err != nil {
//	    return nil, err
//	}
//
//	if err := ValidateGameNotCompleted(ctx, &game); err != nil {
//	    return nil, err
//	}
//
//	// Proceed with write operation...
func ValidateGameNotCompleted(ctx context.Context, game *db.Game) error {
	// Check if game is in a terminal/archived state
	if game.State.String == GameStateCompleted || game.State.String == GameStateCancelled {
		return fmt.Errorf("game %d is archived (state: %s) and read-only", game.ID, game.State.String)
	}

	return nil
}
