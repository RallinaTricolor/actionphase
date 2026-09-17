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
# ON_ERROR_STOP=1 is what makes a fixture error an actual failure. Without it
# psql prints the error to stderr and still exits 0, so `set -e` sees success and
# the script runs to completion announcing "applied successfully" over a database
# that is missing rows. That is how the games.is_public drop went unnoticed: 93
# failed INSERTs, exit code 0.
run_psql() {
    if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
            -v ON_ERROR_STOP=1 -f "$1" --quiet; then
        echo "" >&2
        echo "❌ FIXTURE FAILED: $1" >&2
        echo "   The database is now incomplete. Fix the error above and re-run;" >&2
        echo "   do not run tests against this database." >&2
        exit 1
    fi
}

# Reset and load common data
echo "  Resetting database..."
run_psql "$SCRIPT_DIR/common/00_reset.sql"

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
