package db

import (
	"context"
	"errors"
	"fmt"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DeadlineService implements the DeadlineServiceInterface
type DeadlineService struct {
	DB *pgxpool.Pool
}

// Compile-time verification that DeadlineService implements DeadlineServiceInterface
var _ core.DeadlineServiceInterface = (*DeadlineService)(nil)

// NewDeadlineService creates a new deadline service
func NewDeadlineService(dbPool *pgxpool.Pool) *DeadlineService {
	return &DeadlineService{DB: dbPool}
}

// CreateDeadline creates a new deadline for a game
func (s *DeadlineService) CreateDeadline(ctx context.Context, req core.CreateDeadlineRequest) (*db.GameDeadline, error) {
	queries := db.New(s.DB)

	// Convert time.Time to pgtype.Timestamptz
	deadline := pgtype.Timestamptz{}
	if err := deadline.Scan(req.Deadline); err != nil {
		return nil, fmt.Errorf("invalid deadline timestamp: %w", err)
	}

	description := pgtype.Text{}
	if req.Description != "" {
		description.String = req.Description
		description.Valid = true
	}

	params := db.CreateDeadlineParams{
		GameID:          req.GameID,
		Title:           req.Title,
		Description:     description,
		Deadline:        deadline,
		CreatedByUserID: req.CreatedBy,
	}

	createdDeadline, err := queries.CreateDeadline(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to create deadline: %w", err)
	}

	return &createdDeadline, nil
}

// GetDeadline retrieves a specific deadline by ID
func (s *DeadlineService) GetDeadline(ctx context.Context, deadlineID int32) (*db.GameDeadline, error) {
	queries := db.New(s.DB)

	deadline, err := queries.GetDeadline(ctx, deadlineID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("deadline not found: %d", deadlineID)
		}
		return nil, fmt.Errorf("failed to get deadline: %w", err)
	}

	return &deadline, nil
}

// GetGameDeadlines retrieves all active deadlines for a game
func (s *DeadlineService) GetGameDeadlines(ctx context.Context, gameID int32, includeExpired bool) ([]db.GameDeadline, error) {
	queries := db.New(s.DB)

	params := db.GetGameDeadlinesParams{
		GameID:  gameID,
		Column2: includeExpired,
	}

	deadlines, err := queries.GetGameDeadlines(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get game deadlines: %w", err)
	}

	if deadlines == nil {
		return []db.GameDeadline{}, nil
	}

	return deadlines, nil
}

// GetUpcomingDeadlines retrieves upcoming deadlines across all user's games
func (s *DeadlineService) GetUpcomingDeadlines(ctx context.Context, userID int32, limit int32) ([]core.DeadlineWithGame, error) {
	queries := db.New(s.DB)

	params := db.GetUpcomingDeadlinesForUserParams{
		UserID: userID,
		Limit:  limit,
	}

	rows, err := queries.GetUpcomingDeadlinesForUser(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("failed to get upcoming deadlines: %w", err)
	}

	// Convert query results to DeadlineWithGame structs
	result := make([]core.DeadlineWithGame, 0, len(rows))
	for _, row := range rows {
		deadline := core.DeadlineWithGame{
			GameDeadline: db.GameDeadline{
				ID:              row.ID,
				GameID:          row.GameID,
				Title:           row.Title,
				Description:     row.Description,
				Deadline:        row.Deadline,
				CreatedByUserID: row.CreatedByUserID,
				CreatedAt:       row.CreatedAt,
				UpdatedAt:       row.UpdatedAt,
				DeletedAt:       row.DeletedAt,
			},
			GameTitle: row.GameTitle,
			GameID:    row.GameID_2, // The query returns game_id twice - once from deadline, once from join
		}
		result = append(result, deadline)
	}

	return result, nil
}

// UpdateDeadline updates deadline details (title, description, timestamp)
func (s *DeadlineService) UpdateDeadline(ctx context.Context, deadlineID int32, req core.UpdateDeadlineRequest) (*db.GameDeadline, error) {
	queries := db.New(s.DB)

	// Convert time.Time to pgtype.Timestamptz
	deadline := pgtype.Timestamptz{}
	if err := deadline.Scan(req.Deadline); err != nil {
		return nil, fmt.Errorf("invalid deadline timestamp: %w", err)
	}

	description := pgtype.Text{}
	if req.Description != "" {
		description.String = req.Description
		description.Valid = true
	}

	params := db.UpdateDeadlineParams{
		ID:          deadlineID,
		Title:       req.Title,
		Description: description,
		Deadline:    deadline,
	}

	updatedDeadline, err := queries.UpdateDeadline(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("deadline not found: %d", deadlineID)
		}
		return nil, fmt.Errorf("failed to update deadline: %w", err)
	}

	return &updatedDeadline, nil
}

// DeleteDeadline soft-deletes a deadline by setting deleted_at timestamp
// Authorization check (GM verification) should be performed at the handler layer before calling this method
func (s *DeadlineService) DeleteDeadline(ctx context.Context, deadlineID int32, userID int32) error {
	queries := db.New(s.DB)

	// First verify the deadline exists
	_, err := queries.GetDeadline(ctx, deadlineID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("deadline not found: %d", deadlineID)
		}
		return fmt.Errorf("failed to verify deadline: %w", err)
	}

	// Perform soft delete
	// Note: Authorization (GM verification) is handled at the handler layer
	if err := queries.DeleteDeadline(ctx, deadlineID); err != nil {
		return fmt.Errorf("failed to delete deadline: %w", err)
	}

	return nil
}
