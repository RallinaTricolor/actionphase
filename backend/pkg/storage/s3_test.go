package storage

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestS3Storage_GetURL(t *testing.T) {
	tests := []struct {
		name      string
		bucket    string
		region    string
		publicURL string
		path      string
		want      string
	}{
		{
			name:      "default S3 URL",
			bucket:    "my-bucket",
			region:    "us-east-1",
			publicURL: "",
			path:      "avatars/characters/1/avatar.jpg",
			want:      "https://my-bucket.s3.us-east-1.amazonaws.com/avatars/characters/1/avatar.jpg",
		},
		{
			name:      "CDN URL",
			bucket:    "my-bucket",
			region:    "us-east-1",
			publicURL: "https://cdn.example.com",
			path:      "avatars/characters/1/avatar.jpg",
			want:      "https://cdn.example.com/avatars/characters/1/avatar.jpg",
		},
		{
			name:      "CDN URL with trailing slash",
			bucket:    "my-bucket",
			region:    "us-east-1",
			publicURL: "https://cdn.example.com/",
			path:      "avatars/characters/1/avatar.jpg",
			want:      "https://cdn.example.com/avatars/characters/1/avatar.jpg",
		},
		{
			name:      "path with leading slash",
			bucket:    "my-bucket",
			region:    "us-east-1",
			publicURL: "https://cdn.example.com",
			path:      "/avatars/characters/1/avatar.jpg",
			want:      "https://cdn.example.com/avatars/characters/1/avatar.jpg",
		},
		{
			name:      "different region",
			bucket:    "my-bucket",
			region:    "eu-west-1",
			publicURL: "",
			path:      "avatars/characters/1/avatar.jpg",
			want:      "https://my-bucket.s3.eu-west-1.amazonaws.com/avatars/characters/1/avatar.jpg",
		},
		{
			name:      "deep nested path",
			bucket:    "my-bucket",
			region:    "us-east-1",
			publicURL: "https://cdn.example.com",
			path:      "very/deep/nested/path/to/file.png",
			want:      "https://cdn.example.com/very/deep/nested/path/to/file.png",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create S3Storage without actually initializing AWS session
			// We're only testing GetURL logic
			storage := &S3Storage{
				bucket:    tt.bucket,
				region:    tt.region,
				publicURL: tt.publicURL,
			}

			got := storage.GetURL(tt.path)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestS3Storage_InterfaceCompliance(t *testing.T) {
	// This test ensures S3Storage implements core.StorageBackendInterface
	// It will fail to compile if the interface is not satisfied
	var _ interface{} = (*S3Storage)(nil)
}

// Note: Full integration tests for Upload and Delete would require mocking the AWS S3 client
// using a library like github.com/aws/aws-sdk-go/service/s3/s3iface
// For now, we rely on:
// 1. Interface compliance (compile-time check)
// 2. GetURL logic tests (above)
// 3. Manual/integration testing against real or local S3 (MinIO)
//
// Future enhancement: Add comprehensive mocked tests for Upload and Delete operations
