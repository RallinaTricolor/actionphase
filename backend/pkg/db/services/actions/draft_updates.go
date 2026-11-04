package actions

import (
	"context"
	"errors"
	"fmt"

	core "actionphase/pkg/core"
	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// CreateDraftCharacterUpdate creates or updates a draft character sheet update for an action result.
// Uses upsert behavior - if draft already exists for this field, it updates the value.
func (s *ActionSubmissionService) CreateDraftCharacterUpdate(ctx context.Context, req core.CreateDraftCharacterUpdateRequest) (*models.ActionResultCharacterUpdate, error) {
	queries := models.New(s.DB)

	// Mirrors the check_module_type constraint on action_result_character_updates:
	// a built-in tab key or a well-formed custom one. Keep the two in step or
	// inserts fail at the database instead of here, where the error is
	// actionable. Whether this game actually has the tab is the handler's check,
	// since it needs the game's layout.
	if !core.IsSheetTabKey(req.ModuleType) {
		return nil, fmt.Errorf("invalid module_type: %s", req.ModuleType)
	}

	// Validate field type
	validFieldTypes := map[string]bool{"text": true, "number": true, "boolean": true, "json": true}
	if !validFieldTypes[req.FieldType] {
		return nil, fmt.Errorf("invalid field_type: %s", req.FieldType)
	}

	// Validate operation
	validOperations := map[string]bool{"upsert": true, "delete": true}
	if !validOperations[req.Operation] {
		return nil, fmt.Errorf("invalid operation: %s", req.Operation)
	}

	// Create or update the draft
	draft, err := queries.CreateDraftCharacterUpdate(ctx, models.CreateDraftCharacterUpdateParams{
		ActionResultID: req.ActionResultID,
		CharacterID:    req.CharacterID,
		ModuleType:     req.ModuleType,
		FieldName:      req.FieldName,
		FieldValue:     pgtype.Text{String: req.FieldValue, Valid: true},
		FieldType:      req.FieldType,
		Operation:      req.Operation,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create draft character update: %w", err)
	}

	return &draft, nil
}

// GetDraftCharacterUpdates retrieves all draft updates for an action result.
func (s *ActionSubmissionService) GetDraftCharacterUpdates(ctx context.Context, actionResultID int32) ([]models.ActionResultCharacterUpdate, error) {
	queries := models.New(s.DB)

	drafts, err := queries.GetDraftCharacterUpdates(ctx, actionResultID)
	if err != nil {
		return nil, fmt.Errorf("failed to get draft character updates: %w", err)
	}

	return drafts, nil
}

// UpdateDraftCharacterUpdate updates the field value of an existing draft.
func (s *ActionSubmissionService) UpdateDraftCharacterUpdate(ctx context.Context, draftID int32, fieldValue string) (*models.ActionResultCharacterUpdate, error) {
	queries := models.New(s.DB)

	draft, err := queries.UpdateDraftCharacterUpdate(ctx, models.UpdateDraftCharacterUpdateParams{
		ID:         draftID,
		FieldValue: pgtype.Text{String: fieldValue, Valid: true},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to update draft character update: %w", err)
	}

	return &draft, nil
}

// DeleteDraftCharacterUpdate removes a draft character update.
func (s *ActionSubmissionService) DeleteDraftCharacterUpdate(ctx context.Context, draftID int32) error {
	queries := models.New(s.DB)

	err := queries.DeleteDraftCharacterUpdate(ctx, draftID)
	if err != nil {
		return fmt.Errorf("failed to delete draft character update: %w", err)
	}

	return nil
}

// GetDraftUpdateCount returns the count of draft updates for an action result.
func (s *ActionSubmissionService) GetDraftUpdateCount(ctx context.Context, actionResultID int32) (int64, error) {
	queries := models.New(s.DB)

	count, err := queries.GetDraftUpdateCount(ctx, actionResultID)
	if err != nil {
		return 0, fmt.Errorf("failed to get draft update count: %w", err)
	}

	return count, nil
}

// ListPhaseDraftCharacterUpdates returns every draft sheet update on a result
// in the phase.
func (s *ActionSubmissionService) ListPhaseDraftCharacterUpdates(ctx context.Context, phaseID int32) ([]models.ActionResultCharacterUpdate, error) {
	drafts, err := models.New(s.DB).ListPhaseDraftCharacterUpdates(ctx, phaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to list phase draft character updates: %w", err)
	}
	return drafts, nil
}

// ReplaceRewardSheetUpdates replaces a character's generated sheet drafts.
//
// A draft is a whole-tab snapshot, so a character's sheet changes for a phase
// must sit on one result: this clears them from every unpublished result in
// the phase before writing the new set on the carrier. The results board works
// the values out from the reward lines and the live sheet; the server only
// keeps the one-carrier rule and refuses to drop hand-made drafts unasked.
func (s *ActionSubmissionService) ReplaceRewardSheetUpdates(ctx context.Context, req core.ReplaceRewardSheetUpdatesRequest) ([]models.ActionResultCharacterUpdate, error) {
	if req.ResultID == nil && len(req.Updates) > 0 {
		return nil, fmt.Errorf("%w: sheet changes need a result to go on", core.ErrInvalidRewardCarrier)
	}

	var written []models.ActionResultCharacterUpdate
	err := pgx.BeginFunc(ctx, s.DB, func(tx pgx.Tx) error {
		queries := models.New(tx)

		if req.ResultID != nil {
			result, err := queries.GetActionResult(ctx, *req.ResultID)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return fmt.Errorf("%w: that result no longer exists", core.ErrInvalidRewardCarrier)
				}
				return fmt.Errorf("failed to get carrier result: %w", err)
			}
			if result.GameID != req.GameID || result.PhaseID != req.PhaseID ||
				!result.CharacterID.Valid || result.CharacterID.Int32 != req.CharacterID {
				return fmt.Errorf("%w: that result isn't this character's in this phase", core.ErrInvalidRewardCarrier)
			}
			if result.IsPublished.Bool {
				return fmt.Errorf("%w: that result is already published", core.ErrInvalidRewardCarrier)
			}
			isTail, err := queries.IsChainTail(ctx, pgtype.Int4{Int32: result.ID, Valid: true})
			if err != nil {
				return fmt.Errorf("failed to check chain tail: %w", err)
			}
			if !isTail.Bool {
				return fmt.Errorf("%w: sheet changes go on the last part of a result, and a part was added after this one", core.ErrInvalidRewardCarrier)
			}
		}

		existing, err := queries.ListCharacterDraftsOnUnpublishedResults(ctx, models.ListCharacterDraftsOnUnpublishedResultsParams{
			PhaseID: req.PhaseID, CharacterID: req.CharacterID,
		})
		if err != nil {
			return fmt.Errorf("failed to list existing drafts: %w", err)
		}
		handMade := 0
		for _, d := range existing {
			if !d.FromRewards {
				handMade++
			}
		}
		if handMade > 0 && !req.ReplaceHandMade {
			return fmt.Errorf("%w: this character has %d sheet update(s) made by hand in the results list", core.ErrHandMadeSheetDrafts, handMade)
		}

		if err := queries.DeleteCharacterDraftsOnUnpublishedResults(ctx, models.DeleteCharacterDraftsOnUnpublishedResultsParams{
			PhaseID: req.PhaseID, CharacterID: req.CharacterID, IncludeHandMade: req.ReplaceHandMade,
		}); err != nil {
			return fmt.Errorf("failed to clear drafts: %w", err)
		}

		for _, u := range req.Updates {
			row, err := queries.CreateRewardCharacterUpdate(ctx, models.CreateRewardCharacterUpdateParams{
				ActionResultID: *req.ResultID,
				CharacterID:    req.CharacterID,
				ModuleType:     u.ModuleType,
				FieldName:      u.FieldName,
				FieldValue:     pgtype.Text{String: u.FieldValue, Valid: true},
			})
			if err != nil {
				return fmt.Errorf("failed to write sheet draft: %w", err)
			}
			written = append(written, row)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return written, nil
}
