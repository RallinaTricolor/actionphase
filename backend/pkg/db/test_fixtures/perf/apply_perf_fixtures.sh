#!/bin/bash
set -e

# Apply performance test fixtures
# These fixtures create large datasets for performance testing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_URL="${DATABASE_URL:-postgres://postgres:example@localhost:5432/actionphase}"

echo "📊 Applying performance test fixtures..."
echo "🗄️  Database: $DB_URL"

# Generate large comment set (500 comments)
echo "   → Generating 500 comments for typing lag testing..."
psql "$DB_URL" -f "$SCRIPT_DIR/generate_large_comment_set.sql"

echo "✅ Performance fixtures applied successfully"
echo ""
echo "🎯 Testing Instructions:"
echo "   1. Navigate to Shadows Over Innsmouth game"
echo "   2. Go to Common Room"
echo "   3. Find the 'Performance Test: Large Comment Thread' post"
echo "   4. Click to expand comments (will load 500 comments)"
echo "   5. Try typing in comment boxes - test for lag"
