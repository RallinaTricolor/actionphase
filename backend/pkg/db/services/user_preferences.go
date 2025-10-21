package db

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	models "actionphase/pkg/db/models"
)

// UserPreferencesService handles user preferences operations
type UserPreferencesService struct {
	DB      *pgxpool.Pool
	Queries *models.Queries
}

// NewUserPreferencesService creates a new user preferences service
func NewUserPreferencesService(db *pgxpool.Pool) *UserPreferencesService {
	return &UserPreferencesService{
		DB:      db,
		Queries: models.New(db),
	}
}

// PreferencesData represents the structured preferences object
type PreferencesData struct {
	Theme string `json:"theme"` // "light" | "dark" | "auto"
	// Future preferences can be added here
}

// GetUserPreferences gets user preferences, returning defaults if not found
func (s *UserPreferencesService) GetUserPreferences(ctx context.Context, userID int32) (*PreferencesData, error) {
	prefs, err := s.Queries.GetUserPreferences(ctx, userID)
	if err != nil {
		// Return default preferences if not found
		return &PreferencesData{
			Theme: "auto",
		}, nil
	}

	// Parse JSONB into PreferencesData
	var data PreferencesData
	if err := json.Unmarshal(prefs.Preferences, &data); err != nil {
		return nil, fmt.Errorf("failed to parse preferences: %w", err)
	}

	// Apply defaults for any missing fields
	if data.Theme == "" {
		data.Theme = "auto"
	}

	return &data, nil
}

// UpdateUserPreferences updates or creates user preferences
func (s *UserPreferencesService) UpdateUserPreferences(ctx context.Context, userID int32, prefs PreferencesData) (*PreferencesData, error) {
	// Validate theme value
	validThemes := map[string]bool{"light": true, "dark": true, "auto": true}
	if !validThemes[prefs.Theme] {
		return nil, fmt.Errorf("invalid theme value: must be 'light', 'dark', or 'auto'")
	}

	// Marshal preferences to JSONB
	jsonData, err := json.Marshal(prefs)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal preferences: %w", err)
	}

	// Upsert preferences
	_, err = s.Queries.UpsertUserPreferences(ctx, models.UpsertUserPreferencesParams{
		UserID:      userID,
		Preferences: jsonData,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upsert preferences: %w", err)
	}

	return &prefs, nil
}
