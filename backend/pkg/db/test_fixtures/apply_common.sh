#!/bin/bash
set -euo pipefail

# Load common base data only (users and system config)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-actionphase}"

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-example}"

echo "🧹 Loading common base data for database: $DB_NAME"

# Helper function for psql commands
run_psql() {
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$1" --quiet
}

# Reset and load common data
echo "  Resetting database..."
run_psql "$SCRIPT_DIR/common/00_reset.sql" 2>/dev/null || true

echo "  Creating test users..."
run_psql "$SCRIPT_DIR/common/01_users.sql"

echo ""
echo "✅ Common data loaded successfully!"
echo ""
echo "Test Accounts:"
echo "  GM: test_gm@example.com / testpassword123"
echo "  Players: test_player1-5@example.com / testpassword123"
echo "  Audience: test_audience@example.com / testpassword123"
echo ""
echo "No games or content loaded - use 'just load-demo' or 'just load-e2e' for that."
