package db

import (
	"context"
	"testing"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserPreferencesService_GetUserPreferences_Default(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database test in short mode")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "user_preferences", "users")

	service := NewUserPreferencesService(testDB.Pool)
	ctx := context.Background()

	// Test getting preferences for user that has never set any
	prefs, err := service.GetUserPreferences(ctx, 99999) // Non-existent user ID
	require.NoError(t, err)
	assert.Equal(t, "auto", prefs.Theme, "should return default theme")
}

func TestUserPreferencesService_UpdateUserPreferences_Create(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database test in short mode")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "user_preferences", "users")

	service := NewUserPreferencesService(testDB.Pool)
	ctx := context.Background()

	// Create a test user
	queries := models.New(testDB.Pool)
	user, err := queries.CreateUser(ctx, models.CreateUserParams{
		Username: "prefs_test_user",
		Email:    "prefs@example.com",
		Password: "testpass",
	})
	require.NoError(t, err)

	// Update preferences (should create new record)
	prefs := PreferencesData{Theme: "dark"}
	updated, err := service.UpdateUserPreferences(ctx, user.ID, prefs)
	require.NoError(t, err)
	assert.Equal(t, "dark", updated.Theme)

	// Verify preferences were saved
	retrieved, err := service.GetUserPreferences(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, "dark", retrieved.Theme)
}

func TestUserPreferencesService_UpdateUserPreferences_Update(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database test in short mode")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "user_preferences", "users")

	service := NewUserPreferencesService(testDB.Pool)
	ctx := context.Background()

	// Create a test user
	queries := models.New(testDB.Pool)
	user, err := queries.CreateUser(ctx, models.CreateUserParams{
		Username: "prefs_update_user",
		Email:    "prefs_update@example.com",
		Password: "testpass",
	})
	require.NoError(t, err)

	// Set initial preferences
	_, err = service.UpdateUserPreferences(ctx, user.ID, PreferencesData{Theme: "light"})
	require.NoError(t, err)

	// Update to dark mode
	updated, err := service.UpdateUserPreferences(ctx, user.ID, PreferencesData{Theme: "dark"})
	require.NoError(t, err)
	assert.Equal(t, "dark", updated.Theme)

	// Verify update persisted
	retrieved, err := service.GetUserPreferences(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, "dark", retrieved.Theme)
}

func TestUserPreferencesService_UpdateUserPreferences_InvalidTheme(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database test in short mode")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "user_preferences", "users")

	service := NewUserPreferencesService(testDB.Pool)
	ctx := context.Background()

	// Test validation for invalid theme values
	invalidThemes := []string{"invalid", "DARK", "Light", "system", ""}

	for _, theme := range invalidThemes {
		t.Run(theme, func(t *testing.T) {
			prefs := PreferencesData{Theme: theme}
			_, err := service.UpdateUserPreferences(ctx, 1, prefs)
			assert.Error(t, err, "should reject invalid theme: %s", theme)
			assert.Contains(t, err.Error(), "invalid theme value", "error should mention invalid theme")
		})
	}
}

func TestUserPreferencesService_UpdateUserPreferences_ValidThemes(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping database test in short mode")
	}

	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "user_preferences", "users")

	service := NewUserPreferencesService(testDB.Pool)
	ctx := context.Background()

	// Create a test user
	queries := models.New(testDB.Pool)
	user, err := queries.CreateUser(ctx, models.CreateUserParams{
		Username: "prefs_valid_user",
		Email:    "prefs_valid@example.com",
		Password: "testpass",
	})
	require.NoError(t, err)

	// Test all valid theme values
	validThemes := []string{"light", "dark", "auto"}

	for _, theme := range validThemes {
		t.Run(theme, func(t *testing.T) {
			prefs := PreferencesData{Theme: theme}
			updated, err := service.UpdateUserPreferences(ctx, user.ID, prefs)
			require.NoError(t, err, "should accept valid theme: %s", theme)
			assert.Equal(t, theme, updated.Theme)

			// Verify it persisted
			retrieved, err := service.GetUserPreferences(ctx, user.ID)
			require.NoError(t, err)
			assert.Equal(t, theme, retrieved.Theme)
		})
	}
}
