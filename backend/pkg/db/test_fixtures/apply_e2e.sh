#!/bin/bash
set -euo pipefail

# Load E2E test fixtures (predictable data for automated testing)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-actionphase}"

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-example}"

echo "🤖 Loading E2E test fixtures for database: $DB_NAME"
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

# Pre-flight: fail fast if two fixtures claim the same game ID. Cheap to run and
# catches the "Fixture game not found" class of failure at its source instead of
# in whichever unrelated spec loses the race.
echo "🔎 Checking fixture game ID uniqueness..."
if ! python3 "$SCRIPT_DIR/check_fixture_ids.py"; then
    echo "❌ Aborting: fix the duplicate game IDs above before applying fixtures."
    exit 1
fi

# First load common data
echo "📦 Loading common base data..."
"$SCRIPT_DIR/apply_common.sh"

echo ""
echo "🧪 Loading E2E test fixtures..."

# Load all E2E files in order
for file in "$SCRIPT_DIR"/e2e/*.sql; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "  Applying $filename..."
        run_psql "$file"
    fi
done

echo ""
echo "✅ E2E fixtures loaded successfully!"
echo ""
echo "E2E Test Games (with hardcoded IDs):"
echo "  • Games 164-168: Common Room testing (posts, mentions, notifications)"
echo "  • Games 200-210: Action/Phase testing"
echo "  • Games 300-310: Character management testing"
echo "  • Games 335-345: Game lifecycle testing"
echo "  • Games 400-410: Messaging testing"
echo "  • Games 600-610: Character workflows
  • Game 710: Infinite scroll (post with 20 top-level comments)"
echo ""
echo "Characteristics:"
echo "  • Predictable IDs for reliable tests"
echo "  • Shared across all parallel workers"
echo "  • Minimal content (fast loading)"
echo "  • State-specific scenarios"
echo ""
echo "Ready for automated E2E test execution!"
