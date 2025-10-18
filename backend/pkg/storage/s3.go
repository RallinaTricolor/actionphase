package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"strings"

	"actionphase/pkg/core"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

// S3Storage implements file storage using AWS S3 or S3-compatible services.
// Supports AWS S3, DigitalOcean Spaces, MinIO, and other S3-compatible storage.
//
// Files are stored at: s3://{bucket}/{relativePath}
// Public URLs are: {publicURL}/{relativePath} or S3 URL if publicURL not configured
type S3Storage struct {
	client    *s3.S3
	bucket    string
	region    string
	publicURL string // Optional: CDN URL or custom domain
}

// Compile-time verification that S3Storage implements StorageBackendInterface
var _ core.StorageBackendInterface = (*S3Storage)(nil)

// NewS3Storage creates a new S3 storage backend.
//
// Parameters:
//   - bucket: S3 bucket name
//   - region: AWS region (e.g., "us-east-1")
//   - publicURL: Optional CDN URL for public access (if empty, uses S3 URL)
//   - endpoint: Optional S3-compatible endpoint (for MinIO, DigitalOcean Spaces, etc.)
//
// Example (AWS S3):
//
//	storage := NewS3Storage("my-bucket", "us-east-1", "https://cdn.example.com", "")
//
// Example (DigitalOcean Spaces):
//
//	storage := NewS3Storage("my-space", "nyc3", "https://cdn.example.com", "https://nyc3.digitaloceanspaces.com")
func NewS3Storage(bucket, region, publicURL, endpoint string) (*S3Storage, error) {
	// Create AWS session
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(region),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create AWS session: %w", err)
	}

	// Override endpoint for S3-compatible services
	if endpoint != "" {
		sess.Config.Endpoint = aws.String(endpoint)
	}

	return &S3Storage{
		client:    s3.New(sess),
		bucket:    bucket,
		region:    region,
		publicURL: publicURL,
	}, nil
}

// Upload saves a file to S3.
//
// Security notes:
//   - Files are uploaded with public-read ACL
//   - Content-Type is set based on provided contentType parameter
//   - Overwrites existing objects at the same key
func (s *S3Storage) Upload(ctx context.Context, path string, file io.Reader, contentType string) (string, error) {
	// Read file content into memory
	// Note: For large files, consider multipart upload
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, file); err != nil {
		return "", fmt.Errorf("failed to read file: %w", err)
	}

	// Upload to S3
	_, err := s.client.PutObjectWithContext(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(path),
		Body:        bytes.NewReader(buf.Bytes()),
		ContentType: aws.String(contentType),
		ACL:         aws.String("public-read"),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload to S3: %w", err)
	}

	// Return public URL
	return s.GetURL(path), nil
}

// Delete removes a file from S3.
//
// Returns nil if object doesn't exist (idempotent)
func (s *S3Storage) Delete(ctx context.Context, path string) error {
	_, err := s.client.DeleteObjectWithContext(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(path),
	})
	if err != nil {
		return fmt.Errorf("failed to delete from S3: %w", err)
	}

	return nil
}

// GetURL returns the public URL for a file.
//
// If publicURL is configured (CDN), returns: {publicURL}/{path}
// Otherwise returns S3 URL: https://{bucket}.s3.{region}.amazonaws.com/{path}
func (s *S3Storage) GetURL(path string) string {
	cleanPath := strings.TrimLeft(path, "/")

	if s.publicURL != "" {
		baseURL := strings.TrimRight(s.publicURL, "/")
		return fmt.Sprintf("%s/%s", baseURL, cleanPath)
	}

	// Default S3 URL format
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucket, s.region, cleanPath)
}
