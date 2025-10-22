package core

import (
	models "actionphase/pkg/db/models"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestIsUserGameMaster(t *testing.T) {
	// Create a test game
	game := models.Game{
		ID:       1,
		GmUserID: 100, // GM is user 100
		Title:    "Test Game",
		State:    pgtype.Text{String: "in_progress", Valid: true},
	}

	tests := []struct {
		name            string
		userID          int32
		isAdmin         bool
		adminModeHeader string
		expectedResult  bool
		description     string
	}{
		{
			name:            "actual GM user",
			userID:          100,
			isAdmin:         false,
			adminModeHeader: "",
			expectedResult:  true,
			description:     "The actual GM should always have GM permissions",
		},
		{
			name:            "regular user not GM",
			userID:          200,
			isAdmin:         false,
			adminModeHeader: "",
			expectedResult:  false,
			description:     "Regular users who are not GM should not have GM permissions",
		},
		{
			name:            "admin without admin mode",
			userID:          300,
			isAdmin:         true,
			adminModeHeader: "",
			expectedResult:  false,
			description:     "Admin users without admin mode enabled should not have GM permissions",
		},
		{
			name:            "admin with admin mode disabled",
			userID:          300,
			isAdmin:         true,
			adminModeHeader: "false",
			expectedResult:  false,
			description:     "Admin users with admin mode explicitly disabled should not have GM permissions",
		},
		{
			name:            "admin with admin mode enabled",
			userID:          300,
			isAdmin:         true,
			adminModeHeader: "true",
			expectedResult:  true,
			description:     "Admin users with admin mode enabled should have GM permissions for all games",
		},
		{
			name:            "non-admin with admin mode header",
			userID:          200,
			isAdmin:         false,
			adminModeHeader: "true",
			expectedResult:  false,
			description:     "Non-admin users cannot gain GM permissions by setting admin mode header",
		},
		{
			name:            "actual GM who is also admin",
			userID:          100,
			isAdmin:         true,
			adminModeHeader: "",
			expectedResult:  true,
			description:     "A user who is both the actual GM and an admin should have GM permissions",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create a test request with the admin mode header
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if tc.adminModeHeader != "" {
				req.Header.Set("X-Admin-Mode", tc.adminModeHeader)
			}

			result := IsUserGameMaster(req, tc.userID, tc.isAdmin, game)

			if result != tc.expectedResult {
				t.Errorf("%s: expected %v, got %v", tc.description, tc.expectedResult, result)
			}
		})
	}
}

func TestIsUserGameMasterCtx(t *testing.T) {
	// Create a test game
	game := models.Game{
		ID:       1,
		GmUserID: 100, // GM is user 100
		Title:    "Test Game",
		State:    pgtype.Text{String: "in_progress", Valid: true},
	}

	tests := []struct {
		name           string
		userID         int32
		isAdmin        bool
		adminModeInCtx bool
		expectedResult bool
		description    string
	}{
		{
			name:           "actual GM user",
			userID:         100,
			isAdmin:        false,
			adminModeInCtx: false,
			expectedResult: true,
			description:    "The actual GM should always have GM permissions",
		},
		{
			name:           "regular user not GM",
			userID:         200,
			isAdmin:        false,
			adminModeInCtx: false,
			expectedResult: false,
			description:    "Regular users who are not GM should not have GM permissions",
		},
		{
			name:           "admin without admin mode in context",
			userID:         300,
			isAdmin:        true,
			adminModeInCtx: false,
			expectedResult: false,
			description:    "Admin users without admin mode in context should not have GM permissions",
		},
		{
			name:           "admin with admin mode in context",
			userID:         300,
			isAdmin:        true,
			adminModeInCtx: true,
			expectedResult: true,
			description:    "Admin users with admin mode in context should have GM permissions for all games",
		},
		{
			name:           "non-admin with admin mode in context",
			userID:         200,
			isAdmin:        false,
			adminModeInCtx: true,
			expectedResult: false,
			description:    "Non-admin users cannot gain GM permissions even with admin mode in context",
		},
		{
			name:           "actual GM who is also admin",
			userID:         100,
			isAdmin:        true,
			adminModeInCtx: false,
			expectedResult: true,
			description:    "A user who is both the actual GM and an admin should have GM permissions",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Create a context with admin mode state
			ctx := context.Background()
			if tc.adminModeInCtx {
				ctx = WithAdminMode(ctx, true)
			}

			result := IsUserGameMasterCtx(ctx, tc.userID, tc.isAdmin, game)

			if result != tc.expectedResult {
				t.Errorf("%s: expected %v, got %v", tc.description, tc.expectedResult, result)
			}
		})
	}
}

func TestAdminModeContext(t *testing.T) {
	t.Run("WithAdminMode and GetAdminMode", func(t *testing.T) {
		ctx := context.Background()

		// Initially, admin mode should be false
		if GetAdminMode(ctx) != false {
			t.Error("Admin mode should be false in empty context")
		}

		// Add admin mode to context
		ctx = WithAdminMode(ctx, true)

		// Now admin mode should be true
		if GetAdminMode(ctx) != true {
			t.Error("Admin mode should be true after WithAdminMode(ctx, true)")
		}
	})

	t.Run("GetAdminMode with no admin mode in context", func(t *testing.T) {
		ctx := context.Background()
		result := GetAdminMode(ctx)

		if result != false {
			t.Error("GetAdminMode should return false when admin mode is not in context")
		}
	})

	t.Run("WithAdminMode setting false", func(t *testing.T) {
		ctx := context.Background()
		ctx = WithAdminMode(ctx, false)

		if GetAdminMode(ctx) != false {
			t.Error("Admin mode should be false after WithAdminMode(ctx, false)")
		}
	})
}
