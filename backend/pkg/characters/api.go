package characters

import (
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	services "actionphase/pkg/db/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/jwtauth/v5"
	"github.com/go-chi/render"
)

type Handler struct {
	App *core.App
}

// Request/Response types

type CreateCharacterRequest struct {
	Name          string `json:"name" validate:"required,min=1,max=255"`
	CharacterType string `json:"character_type" validate:"required"`
}

func (r *CreateCharacterRequest) Bind(req *http.Request) error {
	return nil
}

type CharacterResponse struct {
	ID            int32     `json:"id"`
	GameID        int32     `json:"game_id"`
	UserID        *int32    `json:"user_id,omitempty"`
	Name          string    `json:"name"`
	CharacterType string    `json:"character_type"`
	Status        string    `json:"status"`
	AvatarURL     *string   `json:"avatar_url,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (rd *CharacterResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

type CharacterWithUserResponse struct {
	ID            int32     `json:"id"`
	GameID        int32     `json:"game_id"`
	UserID        *int32    `json:"user_id,omitempty"`
	Username      *string   `json:"username,omitempty"`
	Name          string    `json:"name"`
	CharacterType string    `json:"character_type"`
	Status        string    `json:"status"`
	AvatarURL     *string   `json:"avatar_url,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (rd *CharacterWithUserResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

type CharacterDataRequest struct {
	ModuleType string `json:"module_type" validate:"required"`
	FieldName  string `json:"field_name" validate:"required"`
	FieldValue string `json:"field_value"`
	FieldType  string `json:"field_type" validate:"required"`
	IsPublic   bool   `json:"is_public"`
}

func (r *CharacterDataRequest) Bind(req *http.Request) error {
	return nil
}

type CharacterDataResponse struct {
	ID          int32     `json:"id"`
	CharacterID int32     `json:"character_id"`
	ModuleType  string    `json:"module_type"`
	FieldName   string    `json:"field_name"`
	FieldValue  string    `json:"field_value,omitempty"`
	FieldType   string    `json:"field_type"`
	IsPublic    bool      `json:"is_public"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (rd *CharacterDataResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

type ApproveCharacterRequest struct {
	Status string `json:"status" validate:"required"` // "approved" or "rejected"
}

func (r *ApproveCharacterRequest) Bind(req *http.Request) error {
	return nil
}

type AssignNPCRequest struct {
	AssignedUserID int32 `json:"assigned_user_id" validate:"required"`
}

func (r *AssignNPCRequest) Bind(req *http.Request) error {
	return nil
}

// Helper functions

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

// API Handlers

// CreateCharacter - Create a new character for a game
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
	validTypes := []string{"player_character", "npc_gm", "npc_audience"}
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

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	userID := int32(user.ID)

	// Verify user can create characters for this game
	gameService := &services.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), int32(gameID))
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err, "game_id", gameID)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// For player characters: user must be a participant
	// For NPCs: user must be GM
	if data.CharacterType == "player_character" {
		participants, err := gameService.GetGameParticipants(r.Context(), int32(gameID))
		if err != nil {
			h.App.Logger.Error("Failed to get game participants", "error", err)
			render.Render(w, r, core.ErrInternalError(err))
			return
		}

		isParticipant := false
		for _, participant := range participants {
			if participant.UserID == userID && participant.Role == "player" {
				isParticipant = true
				break
			}
		}

		if !isParticipant {
			render.Render(w, r, core.ErrForbidden("only game participants can create player characters"))
			return
		}
	} else {
		// For NPCs, only GM can create them
		if game.GmUserID != userID {
			render.Render(w, r, core.ErrForbidden("only the GM can create NPCs"))
			return
		}
	}

	// Create character
	characterService := &services.CharacterService{DB: h.App.Pool}

	var reqUserID *int32
	if data.CharacterType == "player_character" {
		reqUserID = &userID
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

// GetCharacter - Get character details
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

// GetGameCharacters - Get all characters for a game
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

		response = append(response, charData)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetUserControllableCharacters - Get all characters the current user can control in a game
func (h *Handler) GetUserControllableCharacters(w http.ResponseWriter, r *http.Request) {
	gameIDStr := chi.URLParam(r, "gameId")
	gameID, err := strconv.ParseInt(gameIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid game ID")))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	userID := int32(user.ID)

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

// ApproveCharacter - Approve or reject a character (GM only)
func (h *Handler) ApproveCharacter(w http.ResponseWriter, r *http.Request) {
	characterIDStr := chi.URLParam(r, "id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid character ID")))
		return
	}

	data := &ApproveCharacterRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Validate status
	if data.Status != "approved" && data.Status != "rejected" {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("status must be 'approved' or 'rejected'")))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	userID := int32(user.ID)

	// Verify user is GM of this game
	characterService := &services.CharacterService{DB: h.App.Pool}
	character, err := characterService.GetCharacter(r.Context(), int32(characterID))
	if err != nil {
		h.App.Logger.Error("Failed to get character", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	gameService := &services.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), character.GameID)
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if game.GmUserID != userID {
		render.Render(w, r, core.ErrForbidden("only the GM can approve characters"))
		return
	}

	// Update character status
	var updatedCharacter *models.Character
	if data.Status == "approved" {
		updatedCharacter, err = characterService.ApproveCharacter(r.Context(), int32(characterID))
	} else {
		updatedCharacter, err = characterService.RejectCharacter(r.Context(), int32(characterID))
	}

	if err != nil {
		h.App.Logger.Error("Failed to update character status", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	// Convert to response format
	response := &CharacterResponse{
		ID:            updatedCharacter.ID,
		GameID:        updatedCharacter.GameID,
		Name:          updatedCharacter.Name,
		CharacterType: updatedCharacter.CharacterType,
		Status:        updatedCharacter.Status.String,
		CreatedAt:     updatedCharacter.CreatedAt.Time,
		UpdatedAt:     updatedCharacter.UpdatedAt.Time,
	}

	if updatedCharacter.UserID.Valid {
		response.UserID = &updatedCharacter.UserID.Int32
	}

	render.Render(w, r, response)
}

// AssignNPC - Assign an NPC to a user (GM only)
func (h *Handler) AssignNPC(w http.ResponseWriter, r *http.Request) {
	characterIDStr := chi.URLParam(r, "id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid character ID")))
		return
	}

	data := &AssignNPCRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	userID := int32(user.ID)

	// Verify user is GM
	characterService := &services.CharacterService{DB: h.App.Pool}
	character, err := characterService.GetCharacter(r.Context(), int32(characterID))
	if err != nil {
		h.App.Logger.Error("Failed to get character", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	gameService := &services.GameService{DB: h.App.Pool}
	game, err := gameService.GetGame(r.Context(), character.GameID)
	if err != nil {
		h.App.Logger.Error("Failed to get game", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if game.GmUserID != userID {
		render.Render(w, r, core.ErrForbidden("only the GM can assign NPCs"))
		return
	}

	// Assign NPC
	err = characterService.AssignNPCToUser(r.Context(), int32(characterID), data.AssignedUserID, userID)
	if err != nil {
		h.App.Logger.Error("Failed to assign NPC", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// SetCharacterData - Set character data field
func (h *Handler) SetCharacterData(w http.ResponseWriter, r *http.Request) {
	characterIDStr := chi.URLParam(r, "id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid character ID")))
		return
	}

	data := &CharacterDataRequest{}
	if err := render.Bind(r, data); err != nil {
		render.Render(w, r, core.ErrInvalidRequest(err))
		return
	}

	// Get user from token
	user, err := h.getUserFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	userID := int32(user.ID)

	// Verify user can edit this character
	characterService := &services.CharacterService{DB: h.App.Pool}
	canEdit, err := characterService.CanUserEditCharacter(r.Context(), int32(characterID), userID)
	if err != nil {
		h.App.Logger.Error("Failed to check character edit permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canEdit {
		render.Render(w, r, core.ErrForbidden("you cannot edit this character"))
		return
	}

	// Set character data
	err = characterService.SetCharacterData(r.Context(), services.CharacterDataRequest{
		CharacterID: int32(characterID),
		ModuleType:  data.ModuleType,
		FieldName:   data.FieldName,
		FieldValue:  data.FieldValue,
		FieldType:   data.FieldType,
		IsPublic:    data.IsPublic,
	})

	if err != nil {
		h.App.Logger.Error("Failed to set character data", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetCharacterData - Get character data
func (h *Handler) GetCharacterData(w http.ResponseWriter, r *http.Request) {
	characterIDStr := chi.URLParam(r, "id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid character ID")))
		return
	}

	// Get user from token (optional for public data)
	var userID *int32
	user, err := h.getUserFromToken(r)
	if err == nil {
		id := int32(user.ID)
		userID = &id
	}

	characterService := &services.CharacterService{DB: h.App.Pool}

	// Check if user can view private data
	var characterData []models.CharacterDatum
	if userID != nil {
		canEdit, err := characterService.CanUserEditCharacter(r.Context(), int32(characterID), *userID)
		if err == nil && canEdit {
			// User can edit, so they can see all data
			data, err := characterService.GetCharacterData(r.Context(), int32(characterID))
			if err != nil {
				h.App.Logger.Error("Failed to get character data", "error", err)
				render.Render(w, r, core.ErrInternalError(err))
				return
			}
			characterData = data
		} else {
			// User cannot edit, only show public data
			data, err := characterService.GetPublicCharacterData(r.Context(), int32(characterID))
			if err != nil {
				h.App.Logger.Error("Failed to get public character data", "error", err)
				render.Render(w, r, core.ErrInternalError(err))
				return
			}
			characterData = data
		}
	} else {
		// No user token, only show public data
		data, err := characterService.GetPublicCharacterData(r.Context(), int32(characterID))
		if err != nil {
			h.App.Logger.Error("Failed to get public character data", "error", err)
			render.Render(w, r, core.ErrInternalError(err))
			return
		}
		characterData = data
	}

	// Convert to response format
	// Initialize as empty slice to ensure JSON encodes as [] not null
	response := make([]map[string]interface{}, 0)
	for _, data := range characterData {
		dataItem := map[string]interface{}{
			"id":           data.ID,
			"character_id": data.CharacterID,
			"module_type":  data.ModuleType,
			"field_name":   data.FieldName,
			"field_type":   data.FieldType,
			"created_at":   data.CreatedAt.Time,
			"updated_at":   data.UpdatedAt.Time,
		}

		if data.FieldValue.Valid {
			dataItem["field_value"] = data.FieldValue.String
		}
		if data.IsPublic.Valid {
			dataItem["is_public"] = data.IsPublic.Bool
		}

		response = append(response, dataItem)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
