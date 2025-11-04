package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	models "actionphase/pkg/db/models"
)

type CharacterService struct {
	DB *pgxpool.Pool
}

type CreateCharacterRequest struct {
	GameID        int32
	UserID        *int32 // nil for GM-controlled NPCs
	Name          string
	CharacterType string // "player_character", "npc"
}

type CharacterDataRequest struct {
	CharacterID int32
	ModuleType  string
	FieldName   string
	FieldValue  string
	FieldType   string
	IsPublic    bool
}

func (cs *CharacterService) CreateCharacter(ctx context.Context, req CreateCharacterRequest) (*models.Character, error) {
	queries := models.New(cs.DB)

	// Validate character type
	if !isValidCharacterType(req.CharacterType) {
		return nil, fmt.Errorf("invalid character type: %s", req.CharacterType)
	}

	// For player characters, user ID is required
	if req.CharacterType == "player_character" && req.UserID == nil {
		return nil, fmt.Errorf("user ID required for player characters")
	}

	var userID pgtype.Int4
	if req.UserID != nil {
		userID = pgtype.Int4{Int32: *req.UserID, Valid: true}
	}

	character, err := queries.CreateCharacter(ctx, models.CreateCharacterParams{
		GameID:        req.GameID,
		UserID:        userID,
		Name:          req.Name,
		CharacterType: req.CharacterType,
		Status:        pgtype.Text{String: "pending", Valid: true}, // Default status
	})

	return &character, err
}

func (cs *CharacterService) GetCharacter(ctx context.Context, characterID int32) (*models.Character, error) {
	queries := models.New(cs.DB)
	character, err := queries.GetCharacter(ctx, characterID)
	return &character, err
}

func (cs *CharacterService) GetCharactersByGame(ctx context.Context, gameID int32) ([]models.GetCharactersByGameRow, error) {
	queries := models.New(cs.DB)
	return queries.GetCharactersByGame(ctx, gameID)
}

func (cs *CharacterService) GetPlayerCharacters(ctx context.Context, gameID int32) ([]models.GetPlayerCharactersByGameRow, error) {
	queries := models.New(cs.DB)
	return queries.GetPlayerCharactersByGame(ctx, gameID)
}

func (cs *CharacterService) GetNPCs(ctx context.Context, gameID int32) ([]models.GetNPCsByGameRow, error) {
	queries := models.New(cs.DB)
	return queries.GetNPCsByGame(ctx, gameID)
}

func (cs *CharacterService) GetUserControllableCharacters(ctx context.Context, gameID, userID int32) ([]models.GetUserControllableCharactersRow, error) {
	queries := models.New(cs.DB)
	return queries.GetUserControllableCharacters(ctx, models.GetUserControllableCharactersParams{
		GameID: gameID,
		UserID: userID,
	})
}

func (cs *CharacterService) ApproveCharacter(ctx context.Context, characterID int32) (*models.Character, error) {
	queries := models.New(cs.DB)
	character, err := queries.UpdateCharacterStatus(ctx, models.UpdateCharacterStatusParams{
		ID:     characterID,
		Status: pgtype.Text{String: "approved", Valid: true},
	})
	return &character, err
}

func (cs *CharacterService) RejectCharacter(ctx context.Context, characterID int32) (*models.Character, error) {
	queries := models.New(cs.DB)
	character, err := queries.UpdateCharacterStatus(ctx, models.UpdateCharacterStatusParams{
		ID:     characterID,
		Status: pgtype.Text{String: "rejected", Valid: true},
	})
	return &character, err
}

func (cs *CharacterService) AssignNPCToUser(ctx context.Context, characterID, assignedUserID, assignedByUserID int32) error {
	queries := models.New(cs.DB)

	// Verify this is an NPC
	character, err := queries.GetCharacter(ctx, characterID)
	if err != nil {
		return err
	}

	if character.CharacterType != "npc" {
		return fmt.Errorf("character is not an NPC")
	}

	_, err = queries.AssignNPCToUser(ctx, models.AssignNPCToUserParams{
		CharacterID:      characterID,
		AssignedUserID:   assignedUserID,
		AssignedByUserID: assignedByUserID,
	})

	return err
}

func (cs *CharacterService) SetCharacterData(ctx context.Context, req CharacterDataRequest) error {
	queries := models.New(cs.DB)

	var fieldValue pgtype.Text
	if req.FieldValue != "" {
		fieldValue = pgtype.Text{String: req.FieldValue, Valid: true}
	}

	_, err := queries.CreateCharacterData(ctx, models.CreateCharacterDataParams{
		CharacterID: req.CharacterID,
		ModuleType:  req.ModuleType,
		FieldName:   req.FieldName,
		FieldValue:  fieldValue,
		FieldType:   pgtype.Text{String: req.FieldType, Valid: true},
		IsPublic:    pgtype.Bool{Bool: req.IsPublic, Valid: true},
	})

	return err
}

func (cs *CharacterService) GetCharacterData(ctx context.Context, characterID int32) ([]models.CharacterDatum, error) {
	queries := models.New(cs.DB)
	return queries.GetCharacterData(ctx, characterID)
}

func (cs *CharacterService) GetCharacterDataByModule(ctx context.Context, characterID int32, moduleType string) ([]models.CharacterDatum, error) {
	queries := models.New(cs.DB)
	return queries.GetCharacterDataByModule(ctx, models.GetCharacterDataByModuleParams{
		CharacterID: characterID,
		ModuleType:  moduleType,
	})
}

func (cs *CharacterService) GetPublicCharacterData(ctx context.Context, characterID int32) ([]models.CharacterDatum, error) {
	queries := models.New(cs.DB)
	return queries.GetPublicCharacterData(ctx, characterID)
}

func (cs *CharacterService) CanUserEditCharacter(ctx context.Context, characterID, userID int32) (bool, error) {
	queries := models.New(cs.DB)

	character, err := queries.GetCharacter(ctx, characterID)
	if err != nil {
		return false, err
	}

	// Character owner can edit
	if character.UserID.Valid && character.UserID.Int32 == userID {
		return true, nil
	}

	// GM can edit any character in their game
	game, err := queries.GetGame(ctx, character.GameID)
	if err != nil {
		return false, err
	}

	if game.GmUserID == userID {
		return true, nil
	}

	// Check if user is assigned to this NPC
	if character.CharacterType == "npc" {
		assignment, err := queries.GetNPCAssignment(ctx, characterID)
		// Ignore "no rows" error - just means NPC is not assigned
		if err == nil && assignment.AssignedUserID == userID {
			return true, nil
		}
		// If there's an error other than "no rows", it's a real problem
		// But we should still allow GM and owner permissions to work
		// So we don't return the error here, just continue to return false
	}

	return false, nil
}

func isValidCharacterType(characterType string) bool {
	validTypes := []string{"player_character", "npc"}
	for _, validType := range validTypes {
		if characterType == validType {
			return true
		}
	}
	return false
}

// Player Management Methods

// ReassignCharacter reassigns a character to a new owner (used when removing players)
func (cs *CharacterService) ReassignCharacter(ctx context.Context, characterID, newOwnerUserID int32) (*models.Character, error) {
	queries := models.New(cs.DB)

	character, err := queries.ReassignCharacter(ctx, models.ReassignCharacterParams{
		ID:     characterID,
		UserID: pgtype.Int4{Int32: newOwnerUserID, Valid: true},
	})

	return &character, err
}

// ListInactiveCharacters returns all inactive characters for a game
func (cs *CharacterService) ListInactiveCharacters(ctx context.Context, gameID int32) ([]models.ListInactiveCharactersRow, error) {
	queries := models.New(cs.DB)
	return queries.ListInactiveCharacters(ctx, gameID)
}

// DeactivatePlayerCharacters marks all player characters for a user as inactive
func (cs *CharacterService) DeactivatePlayerCharacters(ctx context.Context, gameID, userID int32) error {
	queries := models.New(cs.DB)
	return queries.DeactivatePlayerCharacters(ctx, models.DeactivatePlayerCharactersParams{
		GameID: gameID,
		UserID: pgtype.Int4{Int32: userID, Valid: true},
	})
}

// DeleteCharacter deletes a character if it has no activity (messages or actions)
// Returns error if character has messages or action submissions
func (cs *CharacterService) DeleteCharacter(ctx context.Context, characterID int32) error {
	queries := models.New(cs.DB)

	// Verify character exists
	character, err := queries.GetCharacter(ctx, characterID)
	if err != nil {
		return fmt.Errorf("failed to get character: %w", err)
	}

	// Check if character has any messages
	hasMessages, err := cs.characterHasMessages(ctx, characterID)
	if err != nil {
		return fmt.Errorf("failed to check character messages: %w", err)
	}

	if hasMessages {
		return fmt.Errorf("cannot delete character with existing messages")
	}

	// Check if character has any action submissions
	hasActions, err := cs.characterHasActionSubmissions(ctx, characterID)
	if err != nil {
		return fmt.Errorf("failed to check character actions: %w", err)
	}

	if hasActions {
		return fmt.Errorf("cannot delete character with existing action submissions")
	}

	// All checks passed - delete character
	// Note: character_data and npc_assignments will CASCADE delete
	err = queries.DeleteCharacter(ctx, character.ID)
	if err != nil {
		return fmt.Errorf("failed to delete character: %w", err)
	}

	return nil
}

// characterHasMessages checks if a character has any messages (posts or comments)
func (cs *CharacterService) characterHasMessages(ctx context.Context, characterID int32) (bool, error) {
	queries := models.New(cs.DB)

	// Count messages by this character
	count, err := queries.CountMessagesByCharacter(ctx, characterID)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

// characterHasActionSubmissions checks if a character has any action submissions
func (cs *CharacterService) characterHasActionSubmissions(ctx context.Context, characterID int32) (bool, error) {
	queries := models.New(cs.DB)

	// Count action submissions for this character
	count, err := queries.CountActionSubmissionsByCharacter(ctx, pgtype.Int4{Int32: characterID, Valid: true})
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

// ============================================================================
// Audience Participation Methods (NPC Assignment)
// ============================================================================

// ListAudienceNPCs retrieves all audience NPCs for a game with assignment information
// Returns NPCs with owner information and current assignment status
func (cs *CharacterService) ListAudienceNPCs(ctx context.Context, gameID int32) ([]models.ListAudienceNPCsRow, error) {
	queries := models.New(cs.DB)

	npcs, err := queries.ListAudienceNPCs(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to list audience NPCs: %w", err)
	}

	return npcs, nil
}

// AssignNPCToAudience assigns an NPC character to an audience member
// Creates or updates the NPC assignment record
func (cs *CharacterService) AssignNPCToAudience(ctx context.Context, characterID, assignedUserID, assignedByUserID int32) (*models.NpcAssignment, error) {
	queries := models.New(cs.DB)

	// Verify this is an NPC
	character, err := queries.GetCharacter(ctx, characterID)
	if err != nil {
		return nil, fmt.Errorf("failed to get character: %w", err)
	}

	if character.CharacterType != "npc" {
		return nil, fmt.Errorf("character is not an NPC (type: %s)", character.CharacterType)
	}

	// Create or update the assignment
	assignment, err := queries.AssignNPCToAudience(ctx, models.AssignNPCToAudienceParams{
		CharacterID:      characterID,
		AssignedUserID:   assignedUserID,
		AssignedByUserID: assignedByUserID,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to assign NPC to audience: %w", err)
	}

	return &assignment, nil
}
