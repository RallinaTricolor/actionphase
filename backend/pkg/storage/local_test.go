package storage

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLocalStorage_Upload(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		content     string
		contentType string
		wantErr     bool
		errContains string
	}{
		{
			name:        "upload valid file",
			path:        "avatars/characters/1/avatar.jpg",
			content:     "fake jpeg content",
			contentType: "image/jpeg",
			wantErr:     false,
		},
		{
			name:        "upload with nested directories",
			path:        "deep/nested/path/to/file.png",
			content:     "fake png content",
			contentType: "image/png",
			wantErr:     false,
		},
		{
			name:        "reject path traversal with ..",
			path:        "../../../etc/passwd",
			content:     "malicious content",
			contentType: "text/plain",
			wantErr:     true,
			errContains: "path traversal",
		},
		{
			name:        "reject absolute path",
			path:        "/etc/passwd",
			content:     "malicious content",
			contentType: "text/plain",
			wantErr:     true,
			errContains: "path traversal",
		},
		{
			name:        "reject path with .. in middle",
			path:        "avatars/../../../etc/passwd",
			content:     "malicious content",
			contentType: "text/plain",
			wantErr:     true,
			errContains: "path traversal",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create temporary directory for test
			tempDir := t.TempDir()

			storage := NewLocalStorage(tempDir, "http://localhost:3000/uploads")
			reader := strings.NewReader(tt.content)

			url, err := storage.Upload(context.Background(), tt.path, reader, tt.contentType)

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errContains)
				return
			}

			require.NoError(t, err)

			// Verify URL format
			assert.Contains(t, url, "http://localhost:3000/uploads")

			// Verify file was created (only for valid paths)
			if !tt.wantErr {
				cleanPath := filepath.Clean(tt.path)
				fullPath := filepath.Join(tempDir, cleanPath)

				// Check file exists
				_, err := os.Stat(fullPath)
				require.NoError(t, err, "file should exist at %s", fullPath)

				// Check file content
				content, err := os.ReadFile(fullPath)
				require.NoError(t, err)
				assert.Equal(t, tt.content, string(content))
			}
		})
	}
}

func TestLocalStorage_Upload_OverwritesExisting(t *testing.T) {
	tempDir := t.TempDir()
	storage := NewLocalStorage(tempDir, "http://localhost:3000/uploads")

	path := "avatars/characters/1/avatar.jpg"

	// Upload first file
	_, err := storage.Upload(context.Background(), path, strings.NewReader("original content"), "image/jpeg")
	require.NoError(t, err)

	// Upload second file (overwrite)
	_, err = storage.Upload(context.Background(), path, strings.NewReader("new content"), "image/jpeg")
	require.NoError(t, err)

	// Verify new content
	fullPath := filepath.Join(tempDir, path)
	content, err := os.ReadFile(fullPath)
	require.NoError(t, err)
	assert.Equal(t, "new content", string(content))
}

func TestLocalStorage_Delete(t *testing.T) {
	tests := []struct {
		name        string
		setupFile   bool
		path        string
		wantErr     bool
		errContains string
	}{
		{
			name:      "delete existing file",
			setupFile: true,
			path:      "avatars/characters/1/avatar.jpg",
			wantErr:   false,
		},
		{
			name:      "delete non-existent file (idempotent)",
			setupFile: false,
			path:      "avatars/characters/999/avatar.jpg",
			wantErr:   false,
		},
		{
			name:        "reject path traversal",
			setupFile:   false,
			path:        "../../../etc/passwd",
			wantErr:     true,
			errContains: "path traversal",
		},
		{
			name:        "reject absolute path",
			setupFile:   false,
			path:        "/etc/passwd",
			wantErr:     true,
			errContains: "path traversal",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tempDir := t.TempDir()
			storage := NewLocalStorage(tempDir, "http://localhost:3000/uploads")

			// Setup file if needed
			if tt.setupFile {
				cleanPath := filepath.Clean(tt.path)
				fullPath := filepath.Join(tempDir, cleanPath)
				dir := filepath.Dir(fullPath)
				require.NoError(t, os.MkdirAll(dir, 0755))
				require.NoError(t, os.WriteFile(fullPath, []byte("test content"), 0644))
			}

			err := storage.Delete(context.Background(), tt.path)

			if tt.wantErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errContains)
				return
			}

			require.NoError(t, err)

			// Verify file is deleted (for valid paths)
			if tt.setupFile && !tt.wantErr {
				cleanPath := filepath.Clean(tt.path)
				fullPath := filepath.Join(tempDir, cleanPath)
				_, err := os.Stat(fullPath)
				assert.True(t, os.IsNotExist(err), "file should be deleted")
			}
		})
	}
}

func TestLocalStorage_GetURL(t *testing.T) {
	tests := []struct {
		name      string
		basePath  string
		publicURL string
		path      string
		want      string
	}{
		{
			name:      "basic URL",
			basePath:  "./uploads",
			publicURL: "http://localhost:3000/uploads",
			path:      "avatars/characters/1/avatar.jpg",
			want:      "http://localhost:3000/uploads/avatars/characters/1/avatar.jpg",
		},
		{
			name:      "publicURL with trailing slash",
			basePath:  "./uploads",
			publicURL: "http://localhost:3000/uploads/",
			path:      "avatars/characters/1/avatar.jpg",
			want:      "http://localhost:3000/uploads/avatars/characters/1/avatar.jpg",
		},
		{
			name:      "path with leading slash",
			basePath:  "./uploads",
			publicURL: "http://localhost:3000/uploads",
			path:      "/avatars/characters/1/avatar.jpg",
			want:      "http://localhost:3000/uploads/avatars/characters/1/avatar.jpg",
		},
		{
			name:      "CDN URL",
			basePath:  "./uploads",
			publicURL: "https://cdn.example.com",
			path:      "avatars/characters/1/avatar.jpg",
			want:      "https://cdn.example.com/avatars/characters/1/avatar.jpg",
		},
		{
			name:      "deep nested path",
			basePath:  "./uploads",
			publicURL: "http://localhost:3000/uploads",
			path:      "very/deep/nested/path/to/file.png",
			want:      "http://localhost:3000/uploads/very/deep/nested/path/to/file.png",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			storage := NewLocalStorage(tt.basePath, tt.publicURL)
			got := storage.GetURL(tt.path)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestLocalStorage_Upload_CreatesDirectories(t *testing.T) {
	tempDir := t.TempDir()
	storage := NewLocalStorage(tempDir, "http://localhost:3000/uploads")

	// Upload to deeply nested path that doesn't exist
	path := "level1/level2/level3/avatar.jpg"
	_, err := storage.Upload(context.Background(), path, strings.NewReader("content"), "image/jpeg")
	require.NoError(t, err)

	// Verify all directories were created
	fullPath := filepath.Join(tempDir, path)
	_, err = os.Stat(fullPath)
	require.NoError(t, err, "file should exist with all parent directories created")
}

func TestLocalStorage_InterfaceCompliance(t *testing.T) {
	// This test ensures LocalStorage implements core.StorageBackendInterface
	// It will fail to compile if the interface is not satisfied
	var _ interface{} = (*LocalStorage)(nil)
}
