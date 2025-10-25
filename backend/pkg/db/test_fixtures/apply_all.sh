#!/bin/bash
# Apply all test fixtures to the database (common + demo + e2e)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-actionphase}"

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-example}"

echo "📦 Loading ALL fixtures (common + demo + e2e) for database: $DB_NAME"
echo ""

# Helper function for psql commands
run_psql() {
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$1" --quiet
}

# 1. Reset and load common data
echo "🧹 Resetting database..."
run_psql "$SCRIPT_DIR/common/00_reset.sql" 2>/dev/null || true

echo "👥 Creating test users..."
run_psql "$SCRIPT_DIR/common/01_users.sql"

# 2. Load demo fixtures
echo ""
echo "📖 Loading demo fixtures..."
for file in "$SCRIPT_DIR"/demo/*.sql; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "  Applying $filename..."
        run_psql "$file"
    fi
done

# 3. Load E2E fixtures
echo ""
echo "🧪 Loading E2E test fixtures..."
for file in "$SCRIPT_DIR"/e2e/*.sql; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "  Applying $filename..."
        run_psql "$file"
    fi
done

echo ""
echo "✅ All fixtures applied successfully!"
echo ""
echo "Test Accounts:"
echo "  GM: test_gm@example.com / testpassword123"
echo "  Players: test_player1-5@example.com / testpassword123"
echo "  Audience: test_audience@example.com / testpassword123"
echo ""
echo "Loaded: Common data + Demo games + E2E test games"
