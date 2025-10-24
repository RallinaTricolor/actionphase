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
run_psql() {
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$1" --quiet
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
