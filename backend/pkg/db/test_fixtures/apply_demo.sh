#!/bin/bash
set -euo pipefail

# Load demo showcase data (human-friendly content for staging/demos)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-actionphase}"

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-example}"

echo "🎭 Loading demo showcase data for database: $DB_NAME"
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

# First load common data
echo "📦 Loading common base data..."
"$SCRIPT_DIR/apply_common.sh"

echo ""
echo "🎮 Loading demo games and content..."

# Load all demo files in order
for file in "$SCRIPT_DIR"/demo/*.sql; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "  Applying $filename..."
        run_psql "$file"
    fi
done

echo ""
echo "✅ Demo data loaded successfully!"
echo ""
echo "Demo Games Available:"
echo "  • Curse of Strahd (Horror/Fantasy - Active)"
echo "  • The Lost Mine of Phandelver (D&D Classic - Recruiting)"
echo "  • Cyberpunk 2077: Night City (Sci-Fi - Character Creation)"
echo "  • Star Wars: Edge of Empire (Space Opera - Mid-Campaign)"
echo "  • Call of Cthulhu: Innsmouth (Investigation - Completed)"
echo ""
echo "Rich content includes:"
echo "  • Complete phase histories"
echo "  • Detailed character sheets"
echo "  • Engaging conversations"
echo "  • Nested discussion threads"
echo ""
echo "Perfect for staging environments and demonstrations!"
