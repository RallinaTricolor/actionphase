package storage

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"actionphase/pkg/core"
)

// LocalStorage implements file storage using the local filesystem.
// Suitable for development and staging environments.
//
// Files are stored at: {basePath}/{relativePath}
// Public URLs are: {publicURL}/{relativePath}
type LocalStorage struct {
	basePath  string // Filesystem path where files are stored (e.g., "./uploads")
	publicURL string // Base URL for accessing files (e.g., "http://localhost:3000/uploads")
}

// Compile-time verification that LocalStorage implements StorageBackendInterface
var _ core.StorageBackendInterface = (*LocalStorage)(nil)

// NewLocalStorage creates a new local filesystem storage backend.
//
// Parameters:
//   - basePath: The filesystem directory where files will be stored (e.g., "./uploads")
//   - publicURL: The base URL for accessing uploaded files (e.g., "http://localhost:3000/uploads")
//
// Example:
//
//	storage := NewLocalStorage("./uploads", "http://localhost:3000/uploads")
func NewLocalStorage(basePath, publicURL string) *LocalStorage {
	return &LocalStorage{
		basePath:  basePath,
		publicURL: publicURL,
	}
}

// Upload saves a file to the local filesystem.
//
// Path structure: {basePath}/{path}
// Example: ./uploads/avatars/characters/1/avatar.jpg
//
// Security notes:
//   - Sanitizes path to prevent directory traversal attacks
//   - Creates intermediate directories automatically
//   - Overwrites existing files at the same path
func (s *LocalStorage) Upload(ctx context.Context, path string, file io.Reader, contentType string) (string, error) {
	// Sanitize path to prevent directory traversal
	cleanPath := filepath.Clean(path)
	if strings.HasPrefix(cleanPath, "..") || strings.HasPrefix(cleanPath, "/") {
		return "", fmt.Errorf("invalid file path: path traversal detected")
	}

	// Construct full filesystem path
	fullPath := filepath.Join(s.basePath, cleanPath)

	// Create parent directories if they don't exist
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}

	// Create the file
	outFile, err := os.Create(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer outFile.Close()

	// Copy data from reader to file
	if _, err := io.Copy(outFile, file); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	// Return public URL
	return s.GetURL(cleanPath), nil
}

// Delete removes a file from the local filesystem.
//
// Security notes:
//   - Sanitizes path to prevent directory traversal
//   - Returns nil if file doesn't exist (idempotent)
func (s *LocalStorage) Delete(ctx context.Context, path string) error {
	// Sanitize path
	cleanPath := filepath.Clean(path)
	if strings.HasPrefix(cleanPath, "..") || strings.HasPrefix(cleanPath, "/") {
		return fmt.Errorf("invalid file path: path traversal detected")
	}

	// Construct full filesystem path
	fullPath := filepath.Join(s.basePath, cleanPath)

	// Remove file (ignore "not exists" errors)
	if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete file: %w", err)
	}

	return nil
}

// GetURL returns the public URL for a file path.
//
// Example:
//
//	path: "avatars/characters/1/avatar.jpg"
//	returns: "http://localhost:3000/uploads/avatars/characters/1/avatar.jpg"
func (s *LocalStorage) GetURL(path string) string {
	// Ensure publicURL doesn't end with slash and path doesn't start with slash
	baseURL := strings.TrimRight(s.publicURL, "/")
	cleanPath := strings.TrimLeft(path, "/")
	return fmt.Sprintf("%s/%s", baseURL, cleanPath)
}
