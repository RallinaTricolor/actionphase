package characters

import (
	"actionphase/pkg/core"
	services "actionphase/pkg/db/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// CreateCharacter creates a new character for a game
func (h *Handler) CreateCharacter(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	data := &CreateCharacterRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Validate required fields
	if data.Name == "" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("character name is required")))
		return
	}

	// Validate character type
	validTypes := []string{"player_character", "npc"}
	isValid := false
	for _, validType := range validTypes {
		if data.CharacterType == validType {
			isValid = true
			break
		}
	}
	if !isValid {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid character type")))
		return
	}

	// Get authenticated user
	authUser := core.GetAuthenticatedUser(r.Context())
	if authUser == nil {
		h.App.Logger.Error("No authenticated user found")
		render.Render(w, r, core.ErrUnauthorized("authentication required"))
		return
	}

	// Verify user can create characters for this game
	gameService := &services.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Check permissions based on character type
	isGM := core.IsUserGameMaster(r, authUser.ID, authUser.IsAdmin, *game)

	if data.CharacterType == "player_character" {
		// GMs can create player characters for any player
		// Regular players can only create characters for themselves
		if !isGM {
			participants, err := gameService.GetGameParticipants(r.Context(), int32(gameID))
			if err != nil {
				h.App.Logger.Error("Failed to get game participants", "error", err)
				render.Render(w, r, core.ErrInternalError(err))
				return
			}

			isParticipant := false
			for _, participant := range participants {
				if participant.UserID == authUser.ID && participant.Role == "player" {
					isParticipant = true
					break
				}
			}

			if !isParticipant {
				render.Render(w, r, core.ErrForbidden("only game participants can create player characters"))
				return
			}
		}

		// If GM is creating the character, they must specify which player
		if isGM && data.UserID == nil {
			render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("user_id is required when GM creates player characters")))
			return
		}
	} else {
		// For NPCs, only GM can create them (considers admin mode)
		if !isGM {
			render.Render(w, r, core.ErrForbidden("only the GM can create NPCs"))
			return
		}
	}

	// Create character
	characterService := &services.CharacterService{DB: h.App.Pool}

	var reqUserID *int32
	if data.CharacterType == "player_character" {
		if isGM {
			// GM creating player character - use provided UserID (already validated as required above)
			reqUserID = data.UserID
		} else {
			// Regular player creating their own character - use authenticated user's ID
			reqUserID = &authUser.ID
		}
	}
	// For NPCs, UserID can be nil (GM-controlled) or assigned later

	character, err := characterService.CreateCharacter(r.Context(), services.CreateCharacterRequest{
		GameID:        int32(gameID),
		UserID:        reqUserID,
		Name:          data.Name,
		CharacterType: data.CharacterType,
	})

	if err != nil {
		h.App.Logger.Error("Failed to create character", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &CharacterResponse{
		ID:            character.ID,
		GameID:        character.GameID,
		Name:          character.Name,
		CharacterType: character.CharacterType,
		Status:        character.Status.String,
		CreatedAt:     character.CreatedAt.Time,
		UpdatedAt:     character.UpdatedAt.Time,
	}

	if character.UserID.Valid {
		response.UserID = &character.UserID.Int32
	}

	render.Status(r, http.StatusCreated)
	render.Render(w, r, response)
}

// GetCharacter retrieves character details
func (h *Handler) GetCharacter(w http.ResponseWriter, r *http.Request) {
	characterIDStr := chi.URLParam(r, "id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid character ID")))
		return
	}

	characterService := &services.CharacterService{DB: h.App.Pool}
	character, err := characterService.GetCharacter(r.Context(), int32(characterID))
	if err != nil {
		h.App.Logger.Error("Failed to get character", "error", err, "character_id", characterID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &CharacterResponse{
		ID:            character.ID,
		GameID:        character.GameID,
		Name:          character.Name,
		CharacterType: character.CharacterType,
		Status:        character.Status.String,
		CreatedAt:     character.CreatedAt.Time,
		UpdatedAt:     character.UpdatedAt.Time,
	}

	if character.UserID.Valid {
		response.UserID = &character.UserID.Int32
	}

	if character.AvatarUrl.Valid {
		response.AvatarURL = &character.AvatarUrl.String
	}

	render.Render(w, r, response)
}

// GetGameCharacters retrieves all characters for a game
func (h *Handler) GetGameCharacters(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	characterService := &services.CharacterService{DB: h.App.Pool}
	characters, err := characterService.GetCharactersByGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game characters", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	// Initialize as empty slice to ensure JSON encodes as [] not null
	response := make([]map[string]interface{}, 0)
	for _, char := range characters {
		charData := map[string]interface{}{
			"id":             char.ID,
			"game_id":        char.GameID,
			"name":           char.Name,
			"character_type": char.CharacterType,
			"status":         char.Status,
			"created_at":     char.CreatedAt.Time,
			"updated_at":     char.UpdatedAt.Time,
		}

		if char.UserID.Valid {
			charData["user_id"] = char.UserID.Int32
		}
		if char.OwnerUsername.Valid {
			charData["username"] = char.OwnerUsername.String
		}
		if char.AvatarUrl.Valid {
			charData["avatar_url"] = char.AvatarUrl.String
		}
		if char.AssignedUserID.Valid {
			charData["assigned_user_id"] = char.AssignedUserID.Int32
		}
		if char.AssignedUsername.Valid {
			charData["assigned_username"] = char.AssignedUsername.String
		}

		response = append(response, charData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetUserControllableCharacters retrieves all characters the current user can control in a game
func (h *Handler) GetUserControllableCharacters(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user ID from token
	userID, err := h.getUserIDFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	characterService := &services.CharacterService{DB: h.App.Pool}
	characters, err := characterService.GetUserControllableCharacters(r.Context(), int32(gameID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to get user controllable characters", "error", err, "game_id", gameID, "user_id", userID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	// Initialize as empty slice to ensure JSON encodes as [] not null
	response := make([]map[string]interface{}, 0)
	for _, char := range characters {
		charData := map[string]interface{}{
			"id":             char.ID,
			"game_id":        char.GameID,
			"name":           char.Name,
			"character_type": char.CharacterType,
			"created_at":     char.CreatedAt.Time,
			"updated_at":     char.UpdatedAt.Time,
		}

		if char.UserID.Valid {
			charData["user_id"] = char.UserID.Int32
		}
		if char.Status.Valid {
			charData["status"] = char.Status.String
		}
		if char.AvatarUrl.Valid {
			charData["avatar_url"] = char.AvatarUrl.String
		}

		response = append(response, charData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
