#!/bin/bash

# Migrate existing S3 objects to have proper Cache-Control headers
#
# This script updates all objects in the S3 bucket by copying them in-place
# with new Cache-Control metadata.
#
# Usage:
#   ./scripts/migrate-s3-cache-control.sh
#
# Environment variables (or use .env file):
#   - S3_BUCKET: S3 bucket name
#   - S3_REGION: AWS region (optional, defaults to us-east-1)
#   - S3_ENDPOINT: S3-compatible endpoint URL (optional, for DigitalOcean Spaces, MinIO, etc.)
#
# Requirements:
#   - AWS CLI (aws command)
#   - jq (for JSON parsing)
#
# The script will:
# 1. List all objects in the bucket with 'avatars/' prefix
# 2. For each object, copy it in-place with new Cache-Control metadata
# 3. Print progress and summary

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CACHE_CONTROL="public, max-age=31536000, immutable"
OBJECT_PREFIX="avatars/"

# Load .env file if it exists
if [ -f .env ]; then
    echo -e "${BLUE}Loading configuration from .env file...${NC}"
    # Filter out comment lines and inline comments, then export
    export $(grep -v '^#' .env | sed 's/#.*$//' | xargs)
fi

# Check required environment variables
if [ -z "${S3_BUCKET:-}" ]; then
    echo -e "${RED}Error: S3_BUCKET environment variable is required${NC}"
    exit 1
fi

S3_REGION="${S3_REGION:-us-east-1}"

# Check for required commands
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI (aws) is not installed${NC}"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed${NC}"
    echo "Install it with: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
fi

# Build AWS CLI options
AWS_OPTS="--region $S3_REGION"
if [ -n "${S3_ENDPOINT:-}" ]; then
    AWS_OPTS="$AWS_OPTS --endpoint-url $S3_ENDPOINT"
fi

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}S3 Cache-Control Migration${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo "Bucket:        $S3_BUCKET"
echo "Region:        $S3_REGION"
if [ -n "${S3_ENDPOINT:-}" ]; then
    echo "Endpoint:      $S3_ENDPOINT"
fi
echo "Prefix:        $OBJECT_PREFIX"
echo "Cache-Control: $CACHE_CONTROL"
echo ""

# Confirm before proceeding
echo -e "${YELLOW}This will update Cache-Control metadata for all objects with prefix '${OBJECT_PREFIX}'${NC}"
read -p "Continue? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo -e "${BLUE}Starting migration...${NC}"
echo ""

# Counter for progress
total_count=0
updated_count=0
skipped_count=0
error_count=0

# Start time for duration calculation
start_time=$(date +%s)

# List all objects with the prefix
# Using --output json and jq for better parsing
continuation_token=""
has_more=true

while [ "$has_more" = true ]; do
    # Build list command
    list_cmd="aws s3api list-objects-v2 $AWS_OPTS --bucket $S3_BUCKET --prefix $OBJECT_PREFIX"

    if [ -n "$continuation_token" ]; then
        list_cmd="$list_cmd --continuation-token $continuation_token"
    fi

    # Execute list command
    response=$(eval "$list_cmd")

    # Parse objects
    objects=$(echo "$response" | jq -r '.Contents[]? | .Key')

    if [ -z "$objects" ]; then
        echo -e "${YELLOW}No objects found with prefix '${OBJECT_PREFIX}'${NC}"
        break
    fi

    # Process each object
    while IFS= read -r key; do
        if [ -z "$key" ]; then
            continue
        fi

        total_count=$((total_count + 1))

        # Get current metadata
        metadata=$(aws s3api head-object $AWS_OPTS --bucket "$S3_BUCKET" --key "$key" 2>/dev/null || echo "{}")
        current_cache_control=$(echo "$metadata" | jq -r '.CacheControl // ""')
        content_type=$(echo "$metadata" | jq -r '.ContentType // "application/octet-stream"')

        # Check if already has correct Cache-Control
        if [ "$current_cache_control" = "$CACHE_CONTROL" ]; then
            echo -e "${GREEN}✓${NC} Skipped (already correct): $key"
            skipped_count=$((skipped_count + 1))
            continue
        fi

        # Copy object in-place with new metadata
        # This updates metadata without re-uploading the file
        if aws s3api copy-object $AWS_OPTS \
            --bucket "$S3_BUCKET" \
            --key "$key" \
            --copy-source "$S3_BUCKET/$key" \
            --cache-control "$CACHE_CONTROL" \
            --content-type "$content_type" \
            --metadata-directive REPLACE \
            > /dev/null 2>&1; then

            echo -e "${GREEN}✓${NC} Updated: $key (Content-Type: $content_type)"
            updated_count=$((updated_count + 1))
        else
            echo -e "${RED}✗${NC} Failed to update: $key"
            error_count=$((error_count + 1))
        fi

        # Progress indicator every 100 objects
        if [ $((total_count % 100)) -eq 0 ]; then
            echo -e "${BLUE}Progress: $total_count objects processed...${NC}"
        fi
    done <<< "$objects"

    # Check for more objects
    is_truncated=$(echo "$response" | jq -r '.IsTruncated')
    if [ "$is_truncated" = "true" ]; then
        continuation_token=$(echo "$response" | jq -r '.NextContinuationToken')
    else
        has_more=false
    fi
done

# Calculate duration
end_time=$(date +%s)
duration=$((end_time - start_time))

# Print summary
echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}✅ Migration complete!${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo "Total objects processed: $total_count"
echo -e "${GREEN}Updated:                 $updated_count${NC}"
echo -e "${YELLOW}Skipped (already set):   $skipped_count${NC}"
if [ $error_count -gt 0 ]; then
    echo -e "${RED}Errors:                  $error_count${NC}"
fi
echo "Duration:                ${duration}s"
echo ""

if [ $error_count -gt 0 ]; then
    exit 1
fi
