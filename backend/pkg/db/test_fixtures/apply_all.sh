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

# 1. Reset and load common data
#
# Not `|| true`: silencing this step is what let a stale reset path go unnoticed
# (the file had moved to common/ and psql was failing with "No such file"), so
# every reload layered fresh fixtures on top of the previous run's rows.
echo "🧹 Resetting database..."
run_psql "$SCRIPT_DIR/common/00_reset.sql"

echo "👥 Creating test users..."
run_psql "$SCRIPT_DIR/common/01_users.sql"

# Worker users (1-5). This script loads every e2e/*.sql below, including the
# per-worker _w1.._w5 fixtures, which resolve users like test_gm_1@example.com.
# Without these rows those lookups return NULL and the fixtures fail on the
# games.gm_user_id NOT NULL constraint.
echo "👥 Creating E2E worker users..."
run_psql "$SCRIPT_DIR/common/01_users_e2e_workers.sql"

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
