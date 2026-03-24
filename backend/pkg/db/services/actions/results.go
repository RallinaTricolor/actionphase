package actions

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	"actionphase/pkg/validation"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// CreateActionResult creates a new action result (GM response to player action)
func (as *ActionSubmissionService) CreateActionResult(ctx context.Context, req core.CreateActionResultRequest) (*models.ActionResult, error) {
	queries := models.New(as.DB)

	// Get the game to find the GM user ID
	game, err := queries.GetGame(ctx, req.GameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game: %w", err)
	}

	// Convert content to string
	contentStr := fmt.Sprintf("%v", req.Content)

	// Validate content length
	if err := validation.ValidateActionResult(contentStr); err != nil {
		return nil, err
	}

	// Convert character_id to pgtype.Int4
	var characterID pgtype.Int4
	if req.CharacterID != nil {
		characterID = pgtype.Int4{Int32: *req.CharacterID, Valid: true}
	}

	// Convert action_submission_id to pgtype.Int4
	var actionSubmissionID pgtype.Int4
	if req.ActionSubmissionID != nil {
		actionSubmissionID = pgtype.Int4{Int32: *req.ActionSubmissionID, Valid: true}
	}

	params := models.CreateActionResultParams{
		GameID:             req.GameID,
		UserID:             req.UserID,
		PhaseID:            req.PhaseID,
		CharacterID:        characterID,
		ActionSubmissionID: actionSubmissionID,
		GmUserID:           game.GmUserID,
		Content:            contentStr,
		IsPublished:        pgtype.Bool{Bool: req.IsPublished, Valid: true},
	}

	result, err := queries.CreateActionResult(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create action result: %w", err)
	}

	return &result, nil
}

// GetActionResult retrieves a specific action result by ID
func (as *ActionSubmissionService) GetActionResult(ctx context.Context, resultID int32) (*models.ActionResult, error) {
	queries := models.New(as.DB)

	result, err := queries.GetActionResult(ctx, resultID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("action result not found")
		}
		return nil, fmt.Errorf("failed to get action result: %w", err)
	}

	return &result, nil
}

// GetUserPhaseResults retrieves all action results for a user in a specific phase
func (as *ActionSubmissionService) GetUserPhaseResults(ctx context.Context, phaseID, userID int32) ([]models.ActionResult, error) {
	queries := models.New(as.DB)

	results, err := queries.GetUserPhaseResults(ctx, models.GetUserPhaseResultsParams{
		PhaseID: phaseID,
		UserID:  userID,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user phase results: %w", err)
	}

	return results, nil
}

// mergeAndPublishDraftUpdates merges individual draft updates into array format and publishes them.
// This handles the mismatch between how drafts are stored (individual rows per item/ability/skill)
// and how character sheets expect data (single rows with JSON arrays).
func (as *ActionSubmissionService) mergeAndPublishDraftUpdates(ctx context.Context, queries *models.Queries, resultID int32) error {
	// Get all draft updates for this result
	drafts, err := queries.GetDraftCharacterUpdates(ctx, resultID)
	if err != nil {
		return fmt.Errorf("failed to get draft updates: %w", err)
	}

	if len(drafts) == 0 {
		return nil // Nothing to publish
	}

	// Define which module_types need array aggregation and their target field names
	// Map structure: module_type -> target_field_name
	arrayModules := map[string]string{
		"inventory": "items",     // Inventory items stored individually, need to merge into 'items' array
		"currency":  "currency",  // Currency entries stored individually, need to merge into 'currency' array
		"abilities": "abilities", // Abilities stored individually, need to merge into 'abilities' array
		"skills":    "skills",    // Skills stored individually, need to merge into 'skills' array
	}

	// Group drafts by (character_id, module_type)
	type groupKey struct {
		characterID int32
		moduleType  string
	}
	groups := make(map[groupKey][]models.ActionResultCharacterUpdate)
	for _, draft := range drafts {
		if draft.Operation != "upsert" {
			continue // Only handle upsert operations
		}
		key := groupKey{characterID: draft.CharacterID, moduleType: draft.ModuleType}
		groups[key] = append(groups[key], draft)
	}

	// Process each group
	for key, groupDrafts := range groups {
		targetFieldName, needsAggregation := arrayModules[key.moduleType]

		if !needsAggregation {
			// For non-array modules, use simple upsert (old behavior)
			for _, draft := range groupDrafts {
				_, err := queries.CreateCharacterData(ctx, models.CreateCharacterDataParams{
					CharacterID: draft.CharacterID,
					ModuleType:  draft.ModuleType,
					FieldName:   draft.FieldName,
					FieldValue:  draft.FieldValue,
					FieldType:   pgtype.Text{String: draft.FieldType, Valid: true},
					IsPublic:    pgtype.Bool{Bool: false, Valid: true}, // Default to private
				})
				if err != nil {
					return fmt.Errorf("failed to upsert non-array field: %w", err)
				}
			}
			continue
		}

		// For array modules, merge all drafts into a single array
		// 1. Fetch existing array data (if any)
		existingData, err := queries.GetCharacterDataByModule(ctx, models.GetCharacterDataByModuleParams{
			CharacterID: key.characterID,
			ModuleType:  key.moduleType,
		})
		if err != nil {
			return fmt.Errorf("failed to get existing character data: %w", err)
		}

		// 2. Parse existing array or initialize empty
		var existingArray []map[string]interface{}
		for _, data := range existingData {
			if data.FieldName == targetFieldName && data.FieldValue.Valid {
				if err := json.Unmarshal([]byte(data.FieldValue.String), &existingArray); err != nil {
					// If parse fails, start with empty array
					existingArray = []map[string]interface{}{}
				}
				break
			}
		}
		if existingArray == nil {
			existingArray = []map[string]interface{}{}
		}

		// 3. Merge draft items into existing array
		// Use appropriate field as unique key based on module type
		itemMap := make(map[string]map[string]interface{})

		// Determine which field to use as the unique key
		// Currency uses "type" field, others use "name" field
		var keyField string
		switch key.moduleType {
		case "currency":
			keyField = "type" // Currency entries: {"type":"Gold","amount":10}
		default:
			keyField = "name" // Items/abilities/skills: {"name":"Sword","quantity":1}
		}

		// Add existing items to map using the appropriate key field
		for _, item := range existingArray {
			if keyValue, ok := item[keyField].(string); ok {
				itemMap[keyValue] = item
			}
		}

		// Upsert draft items (overwrite if same name exists)
		for _, draft := range groupDrafts {
			if !draft.FieldValue.Valid {
				continue
			}

			var draftItem map[string]interface{}

			// Try to unmarshal as JSON first
			if err := json.Unmarshal([]byte(draft.FieldValue.String), &draftItem); err != nil {
				// If unmarshal fails and this is currency, it might be in the old format (plain number)
				// Handle legacy format for currency: convert plain number to proper currency object
				if key.moduleType == "currency" {
					// Try parsing as a plain number (old format)
					var amount float64
					if numErr := json.Unmarshal([]byte(draft.FieldValue.String), &amount); numErr == nil {
						// Successfully parsed as number - construct proper currency object
						draftItem = map[string]interface{}{
							"type":   draft.FieldName,
							"amount": amount,
						}
					} else {
						// Not JSON and not a number - fail
						return fmt.Errorf("failed to parse draft item JSON: %w (also not a valid number)", err)
					}
				} else {
					// For non-currency modules, JSON parse failure is an error
					return fmt.Errorf("failed to parse draft item JSON: %w", err)
				}
			}

			// Use the appropriate field from the draft item as the key
			// For currency, extract from draftItem["type"], for others use draftItem["name"]
			// If not present in the item, fall back to draft.FieldName
			var itemKey string
			if keyValue, ok := draftItem[keyField].(string); ok {
				itemKey = keyValue
			} else {
				// Fallback to field_name if key field not present in draft item
				itemKey = draft.FieldName
			}
			// CRITICAL: Merge draft fields into existing item, don't replace entire object
			// This preserves the "id" field and any other fields not in the draft
			if existingItem, exists := itemMap[itemKey]; exists {
				// Item exists - merge draft fields into existing item
				for k, v := range draftItem {
					existingItem[k] = v
				}
				// No need to reassign - maps are reference types in Go
			} else {
				// New item - generate ID if missing
				if _, hasID := draftItem["id"]; !hasID {
					draftItem["id"] = uuid.New().String()
				}
				itemMap[itemKey] = draftItem
			}
		}

		// 4. Convert map back to array
		mergedArray := make([]map[string]interface{}, 0, len(itemMap))
		for _, item := range itemMap {
			mergedArray = append(mergedArray, item)
		}

		// Observability: Detect if items are missing ID field after merge
		missingIDs := 0
		for _, item := range mergedArray {
			if _, hasID := item["id"]; !hasID {
				missingIDs++
			}
		}
		if missingIDs > 0 {
			as.Logger.Warn(ctx, "Character data merge produced items without ID field - deletion may fail",
				"actionResultID", resultID,
				"characterID", key.characterID,
				"moduleType", key.moduleType,
				"fieldName", targetFieldName,
				"totalItems", len(mergedArray),
				"missingIDCount", missingIDs,
			)
		}

		// 5. Marshal to JSON and save
		mergedJSON, err := json.Marshal(mergedArray)
		if err != nil {
			return fmt.Errorf("failed to marshal merged array: %w", err)
		}

		_, err = queries.CreateCharacterData(ctx, models.CreateCharacterDataParams{
			CharacterID: key.characterID,
			ModuleType:  key.moduleType,
			FieldName:   targetFieldName, // Use the target field name (e.g., 'items', 'abilities')
			FieldValue:  pgtype.Text{String: string(mergedJSON), Valid: true},
			FieldType:   pgtype.Text{String: "json", Valid: true},
			IsPublic:    pgtype.Bool{Bool: false, Valid: true},
		})
		if err != nil {
			return fmt.Errorf("failed to save merged array: %w", err)
		}
	}

	return nil
}

// publishSingleResultWithDrafts is a helper that publishes a single result and its draft updates.
// This is called by both PublishActionResult and PublishAllPhaseResults to ensure consistent behavior.
// The queries parameter must be from a transaction context to ensure atomicity.
func (as *ActionSubmissionService) publishSingleResultWithDrafts(ctx context.Context, queries *models.Queries, resultID int32) error {
	// Step 1: Publish the action result (marks it as published)
	result, err := queries.PublishActionResult(ctx, resultID)
	if err != nil {
		return fmt.Errorf("failed to publish action result %d: %w", resultID, err)
	}

	// Step 1.5: Create notification for the player
	content := "Your action result has been published by the GM"
	linkURL := fmt.Sprintf("/games/%d?tab=actions", result.GameID)
	relatedType := "action_result"
	_, notifErr := as.NotificationService.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      result.UserID,
		GameID:      &result.GameID,
		Type:        core.NotificationTypeActionResult,
		Title:       "Action Result Published",
		Content:     &content,
		RelatedType: &relatedType,
		RelatedID:   &result.ID,
		LinkURL:     &linkURL,
	})
	if notifErr != nil {
		// Log error but don't fail the publish operation
		as.Logger.LogError(ctx, notifErr, "Failed to create notification for published result",
			"result_id", resultID,
			"user_id", result.UserID,
		)
	}

	// Step 2: Merge and publish draft character updates
	// This aggregates individual draft rows into array format expected by character sheets
	err = as.mergeAndPublishDraftUpdates(ctx, queries, resultID)
	if err != nil {
		return fmt.Errorf("failed to merge and publish draft character updates for result %d: %w", resultID, err)
	}

	// Step 3: Delete the published drafts (cleanup)
	err = queries.DeletePublishedDrafts(ctx, resultID)
	if err != nil {
		return fmt.Errorf("failed to delete published drafts for result %d: %w", resultID, err)
	}

	return nil
}

// PublishActionResult publishes a single action result, making it visible to the player.
// This includes publishing any draft character updates associated with the result.
// All operations are performed in a transaction to ensure atomicity.
func (as *ActionSubmissionService) PublishActionResult(ctx context.Context, resultID, userID int32) error {
	return pgx.BeginFunc(ctx, as.DB, func(tx pgx.Tx) error {
		queries := models.New(tx)
		return as.publishSingleResultWithDrafts(ctx, queries, resultID)
	})
}

// PublishAllPhaseResults publishes all unpublished results for a phase.
// This includes publishing draft character updates for each result.
// All operations are performed in a single transaction to ensure atomicity.
func (as *ActionSubmissionService) PublishAllPhaseResults(ctx context.Context, phaseID int32) error {
	return pgx.BeginFunc(ctx, as.DB, func(tx pgx.Tx) error {
		queries := models.New(tx)

		// Get all unpublished result IDs for this phase
		resultIDs, err := queries.GetUnpublishedResultIDs(ctx, phaseID)
		if err != nil {
			return fmt.Errorf("failed to get unpublished result IDs: %w", err)
		}

		// Publish each result and its draft character updates using shared logic
		for _, resultID := range resultIDs {
			if err := as.publishSingleResultWithDrafts(ctx, queries, resultID); err != nil {
				return err // Error already has context from helper
			}
		}

		return nil
	})
}

// GetUnpublishedResultsCount retrieves the count of unpublished results for a phase
func (as *ActionSubmissionService) GetUnpublishedResultsCount(ctx context.Context, phaseID int32) (int64, error) {
	queries := models.New(as.DB)

	count, err := queries.GetUnpublishedResultsCount(ctx, phaseID)
	if err != nil {
		return 0, fmt.Errorf("failed to get unpublished results count: %w", err)
	}

	return count, nil
}

// UpdateActionResult updates the content of an unpublished action result
func (as *ActionSubmissionService) UpdateActionResult(ctx context.Context, resultID int32, content string) (*models.ActionResult, error) {
	queries := models.New(as.DB)

	result, err := queries.UpdateActionResult(ctx, models.UpdateActionResultParams{
		ID:      resultID,
		Content: content,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("result not found or already published")
		}
		return nil, fmt.Errorf("failed to update action result: %w", err)
	}

	return &result, nil
}
