package users

import (
	"bytes"
	"context"
	"strings"
	"testing"
	"time"

	"actionphase/pkg/core"
	"actionphase/pkg/storage"
)

// TestUploadUserAvatar tests avatar upload functionality
func TestUploadUserAvatar(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	fixtures := testDB.SetupFixtures(t)
	localStorage := storage.NewLocalStorage("./test_uploads", "http://localhost:3000/uploads")
	service := &UserAvatarService{
		DB:      testDB.Pool,
		Storage: localStorage,
	}
	ctx := context.Background()

	tests := []struct {
		name        string
		userID      int32
		fileContent string
		filename    string
		contentType string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "upload valid JPEG",
			userID:      int32(fixtures.TestUser.ID),
			fileContent: "fake jpeg content",
			filename:    "avatar.jpg",
			contentType: MimeTypeJPEG,
			expectError: false,
		},
		{
			name:        "upload valid PNG",
			userID:      int32(fixtures.TestUser.ID),
			fileContent: "fake png content",
			filename:    "avatar.png",
			contentType: MimeTypePNG,
			expectError: false,
		},
		{
			name:        "upload valid WebP",
			userID:      int32(fixtures.TestUser.ID),
			fileContent: "fake webp content",
			filename:    "avatar.webp",
			contentType: MimeTypeWebP,
			expectError: false,
		},
		{
			name:        "reject invalid file type",
			userID:      int32(fixtures.TestUser.ID),
			fileContent: "fake pdf content",
			filename:    "document.pdf",
			contentType: "application/pdf",
			expectError: true,
			errorMsg:    "invalid file type",
		},
		{
			name:        "reject GIF file",
			userID:      int32(fixtures.TestUser.ID),
			fileContent: "fake gif content",
			filename:    "animation.gif",
			contentType: "image/gif",
			expectError: true,
			errorMsg:    "invalid file type",
		},
		{
			name:        "reject file too large",
			userID:      int32(fixtures.TestUser.ID),
			fileContent: strings.Repeat("x", MaxAvatarSize+1), // Exceed 5MB
			filename:    "large.jpg",
			contentType: MimeTypeJPEG,
			expectError: true,
			errorMsg:    "too large",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader := bytes.NewReader([]byte(tt.fileContent))

			avatarURL, err := service.UploadUserAvatar(
				ctx,
				tt.userID,
				reader,
				tt.filename,
				tt.contentType,
			)

			if tt.expectError {
				core.AssertNotEqual(t, nil, err, "Expected an error")
				if tt.errorMsg != "" {
					if !contains(err.Error(), tt.errorMsg) {
						t.Errorf("Error message should contain '%s', got: %s", tt.errorMsg, err.Error())
					}
				}
				return
			}

			core.AssertNoError(t, err, "Should not return error")
			core.AssertNotEqual(t, "", avatarURL, "Avatar URL should not be empty")

			// Verify avatar URL was saved to database
			savedURL, err := service.GetUserAvatarURL(ctx, tt.userID)
			core.AssertNoError(t, err, "Should retrieve avatar URL")
			core.AssertNotEqual(t, (*string)(nil), savedURL, "Avatar URL should exist")
			if savedURL != nil {
				core.AssertEqual(t, avatarURL, *savedURL, "Saved URL should match returned URL")
			}
		})
	}
}

// TestUploadUserAvatar_ReplacesOldAvatar tests that uploading a new avatar deletes the old one
func TestUploadUserAvatar_ReplacesOldAvatar(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	fixtures := testDB.SetupFixtures(t)
	localStorage := storage.NewLocalStorage("./test_uploads", "http://localhost:3000/uploads")
	service := &UserAvatarService{
		DB:      testDB.Pool,
		Storage: localStorage,
	}
	ctx := context.Background()

	// Upload first avatar
	reader1 := bytes.NewReader([]byte("first avatar"))
	firstURL, err := service.UploadUserAvatar(
		ctx,
		int32(fixtures.TestUser.ID),
		reader1,
		"first.jpg",
		MimeTypeJPEG,
	)
	core.AssertNoError(t, err, "First upload should succeed")
	core.AssertNotEqual(t, "", firstURL, "First avatar URL should not be empty")

	// Wait 1 second to ensure different timestamp in filename
	time.Sleep(1 * time.Second)

	// Upload second avatar (should replace first)
	reader2 := bytes.NewReader([]byte("second avatar"))
	secondURL, err := service.UploadUserAvatar(
		ctx,
		int32(fixtures.TestUser.ID),
		reader2,
		"second.jpg",
		MimeTypeJPEG,
	)
	core.AssertNoError(t, err, "Second upload should succeed")
	core.AssertNotEqual(t, "", secondURL, "Second avatar URL should not be empty")
	core.AssertNotEqual(t, firstURL, secondURL, "URLs should be different")

	// Verify only second URL is in database
	savedURL, err := service.GetUserAvatarURL(ctx, int32(fixtures.TestUser.ID))
	core.AssertNoError(t, err, "Should retrieve avatar URL")
	core.AssertNotEqual(t, (*string)(nil), savedURL, "Avatar URL should exist")
	if savedURL != nil {
		core.AssertEqual(t, secondURL, *savedURL, "Should have second avatar URL")
	}
}

// TestDeleteUserAvatar tests avatar deletion
func TestDeleteUserAvatar(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	fixtures := testDB.SetupFixtures(t)
	localStorage := storage.NewLocalStorage("./test_uploads", "http://localhost:3000/uploads")
	service := &UserAvatarService{
		DB:      testDB.Pool,
		Storage: localStorage,
	}
	ctx := context.Background()

	tests := []struct {
		name        string
		setupAvatar bool
		userID      int32
		expectError bool
	}{
		{
			name:        "delete existing avatar",
			setupAvatar: true,
			userID:      int32(fixtures.TestUser.ID),
			expectError: false,
		},
		{
			name:        "delete when no avatar exists (should succeed gracefully)",
			setupAvatar: false,
			userID:      int32(fixtures.TestUser.ID),
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup: Upload avatar if needed
			if tt.setupAvatar {
				reader := bytes.NewReader([]byte("test avatar"))
				_, err := service.UploadUserAvatar(
					ctx,
					tt.userID,
					reader,
					"test.jpg",
					MimeTypeJPEG,
				)
				core.AssertNoError(t, err, "Setup: avatar upload should succeed")
			}

			// Delete avatar
			err := service.DeleteUserAvatar(ctx, tt.userID)

			if tt.expectError {
				core.AssertNotEqual(t, nil, err, "Expected an error")
				return
			}

			core.AssertNoError(t, err, "Should not return error")

			// Verify avatar was removed from database
			avatarURL, err := service.GetUserAvatarURL(ctx, tt.userID)
			core.AssertNoError(t, err, "Should retrieve avatar URL (or nil)")
			core.AssertEqual(t, (*string)(nil), avatarURL, "Avatar URL should be nil after deletion")
		})
	}
}

// TestGetUserAvatarURL tests avatar URL retrieval
func TestGetUserAvatarURL(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "users")

	fixtures := testDB.SetupFixtures(t)
	localStorage := storage.NewLocalStorage("./test_uploads", "http://localhost:3000/uploads")
	service := &UserAvatarService{
		DB:      testDB.Pool,
		Storage: localStorage,
	}
	ctx := context.Background()

	tests := []struct {
		name        string
		setupAvatar bool
		userID      int32
		expectNil   bool
	}{
		{
			name:        "get existing avatar URL",
			setupAvatar: true,
			userID:      int32(fixtures.TestUser.ID),
			expectNil:   false,
		},
		{
			name:        "get avatar URL when none exists",
			setupAvatar: false,
			userID:      int32(fixtures.TestUser.ID),
			expectNil:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup: Upload avatar if needed, or ensure no avatar exists
			var expectedURL string
			if tt.setupAvatar {
				reader := bytes.NewReader([]byte("test avatar"))
				url, err := service.UploadUserAvatar(
					ctx,
					tt.userID,
					reader,
					"test.jpg",
					MimeTypeJPEG,
				)
				core.AssertNoError(t, err, "Setup: avatar upload should succeed")
				expectedURL = url
			} else {
				// Ensure no avatar exists for this test case
				_ = service.DeleteUserAvatar(ctx, tt.userID)
			}

			// Get avatar URL
			avatarURL, err := service.GetUserAvatarURL(ctx, tt.userID)
			core.AssertNoError(t, err, "Should not return error")

			if tt.expectNil {
				core.AssertEqual(t, (*string)(nil), avatarURL, "Avatar URL should be nil")
			} else {
				core.AssertNotEqual(t, (*string)(nil), avatarURL, "Avatar URL should not be nil")
				if avatarURL != nil {
					core.AssertEqual(t, expectedURL, *avatarURL, "Avatar URL should match")
				}
			}
		})
	}
}

// TestMimeTypeToExtension tests MIME type to extension conversion
func TestMimeTypeToExtension(t *testing.T) {
	tests := []struct {
		mimeType string
		expected string
	}{
		{MimeTypeJPEG, ".jpg"},
		{MimeTypePNG, ".png"},
		{MimeTypeWebP, ".webp"},
		{"application/pdf", ""},
		{"unknown", ""},
	}

	for _, tt := range tests {
		t.Run(tt.mimeType, func(t *testing.T) {
			result := mimeTypeToExtension(tt.mimeType)
			core.AssertEqual(t, tt.expected, result, "Extension should match")
		})
	}
}

// TestExtractPathFromURL tests path extraction from URLs
func TestExtractPathFromURL(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		expected string
	}{
		{
			name:     "local storage URL",
			url:      "http://localhost:3000/uploads/avatars/users/1/avatar.jpg",
			expected: "avatars/users/1/avatar.jpg",
		},
		{
			name:     "S3 URL",
			url:      "https://s3.amazonaws.com/bucket/avatars/users/1/avatar.jpg",
			expected: "avatars/users/1/avatar.jpg",
		},
		{
			name:     "URL without avatars path",
			url:      "http://localhost:3000/uploads/other/file.jpg",
			expected: "file.jpg",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractPathFromURL(tt.url)
			core.AssertEqual(t, tt.expected, result, "Extracted path should match")
		})
	}
}

// Helper function to check if string contains substring
func contains(s, substr string) bool {
	return strings.Contains(s, substr)
}
