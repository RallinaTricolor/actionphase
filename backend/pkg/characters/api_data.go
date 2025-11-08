package characters

import (
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	services "actionphase/pkg/db/services"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// SetCharacterData sets character data field
func (h *Handler) SetCharacterData(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_set_character_data")()

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

	// Get user ID from token
	userID, err := h.getUserIDFromToken(r)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

	// Verify user can edit this character
	characterService := &services.CharacterService{DB: h.App.Pool}
	canEdit, err := characterService.CanUserEditCharacter(ctx, int32(characterID), userID)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to check character edit permission", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	if !canEdit {
		render.Render(w, r, core.ErrForbidden("you cannot edit this character"))
		return
	}

	// Additional check: only GMs can edit character stats (abilities, skills, items, currency)
	isStatField := (data.ModuleType == "abilities" && (data.FieldName == "abilities" || data.FieldName == "skills")) ||
		(data.ModuleType == "inventory" && (data.FieldName == "items" || data.FieldName == "currency"))

	if isStatField {
		// Verify user is the GM of this character's game
		queries := models.New(h.App.Pool)
		character, err := queries.GetCharacter(ctx, int32(characterID))
		if err != nil {
			h.App.ObsLogger.Error(ctx, "Failed to get character for GM check", "error", err)
			render.Render(w, r, core.ErrInternalError(err))
			return
		}

		game, err := queries.GetGame(ctx, character.GameID)
		if err != nil {
			h.App.ObsLogger.Error(ctx, "Failed to get game for GM check", "error", err)
			render.Render(w, r, core.ErrInternalError(err))
			return
		}

		if game.GmUserID != userID {
			render.Render(w, r, core.ErrForbidden("only GMs can edit character stats (abilities, skills, items, currency)"))
			return
		}
	}

	// Set character data
	err = characterService.SetCharacterData(ctx, services.CharacterDataRequest{
		CharacterID: int32(characterID),
		ModuleType:  data.ModuleType,
		FieldName:   data.FieldName,
		FieldValue:  data.FieldValue,
		FieldType:   data.FieldType,
		IsPublic:    data.IsPublic,
	})

	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to set character data", "error", err)
		render.Render(w, r, core.ErrInternalError(err))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetCharacterData retrieves character data
func (h *Handler) GetCharacterData(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_character_data")()

	characterIDStr := chi.URLParam(r, "id")
	characterID, err := strconv.ParseInt(characterIDStr, 10, 32)
	if err != nil {
		render.Render(w, r, core.ErrInvalidRequest(fmt.Errorf("invalid character ID")))
		return
	}

	// Get user ID from token (optional for public data)
	var userID *int32
	id, err := h.getUserIDFromToken(r)
	if err == nil {
		userID = &id
	}

	characterService := &services.CharacterService{DB: h.App.Pool}

	// Check if user can view private data
	var characterData []models.CharacterDatum
	if userID != nil {
		canEdit, err := characterService.CanUserEditCharacter(ctx, int32(characterID), *userID)
		if err == nil && canEdit {
			// User can edit, so they can see all data
			data, err := characterService.GetCharacterData(ctx, int32(characterID))
			if err != nil {
				h.App.ObsLogger.Error(ctx, "Failed to get character data", "error", err)
				render.Render(w, r, core.ErrInternalError(err))
				return
			}
			characterData = data
		} else {
			// User cannot edit, only show public data
			data, err := characterService.GetPublicCharacterData(ctx, int32(characterID))
			if err != nil {
				h.App.ObsLogger.Error(ctx, "Failed to get public character data", "error", err)
				render.Render(w, r, core.ErrInternalError(err))
				return
			}
			characterData = data
		}
	} else {
		// No user token, only show public data
		data, err := characterService.GetPublicCharacterData(ctx, int32(characterID))
		if err != nil {
			h.App.ObsLogger.Error(ctx, "Failed to get public character data", "error", err)
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
