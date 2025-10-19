package characters

import (
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	services "actionphase/pkg/db/services"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/render"
)

// ApproveCharacter approves or rejects a character (GM only)
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

	// Get user ID from token
	userID, err := h.getUserIDFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

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

// AssignNPC assigns an NPC to a user (GM only)
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

	// Get user ID from token
	userID, err := h.getUserIDFromToken(r)
	if err != nil {
		h.App.Logger.Error("Failed to get user from token", "error", err)
		render.Render(w, r, core.ErrUnauthorized(err.Error()))
		return
	}

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
