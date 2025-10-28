#!/bin/bash
set -euo pipefail

# Apply E2E fixtures for a specific worker
# Usage: ./apply_e2e_worker.sh <worker_index>
#
# This script takes existing E2E fixture files and adapts them for a specific worker by:
# 1. Replacing user references (TestGM -> TestGM_N for worker N)
# 2. Offsetting game IDs (game 300 -> 10300 for worker 1, 20300 for worker 2, etc.)

WORKER_INDEX="${1:-0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-actionphase}"

# Database connection
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-example}"

# Calculate game ID offset (worker 0: +0, worker 1: +10000, worker 2: +20000, etc.)
GAME_ID_OFFSET=$((WORKER_INDEX * 10000))

echo "🔧 Applying E2E fixtures for Worker #$WORKER_INDEX (game ID offset: +$GAME_ID_OFFSET)"

# Helper function to apply SQL with worker-specific replacements
apply_worker_sql() {
    local sql_file="$1"
    local filename=$(basename "$sql_file")

    echo "  📄 Processing $filename for worker $WORKER_INDEX..."

    # Create temporary file with worker-specific replacements
    local temp_file=$(mktemp)

    if [ "$WORKER_INDEX" -eq 0 ]; then
        # Worker 0: Keep original users and keep DELETE with IDs (Python will offset them)
        # Only remove DELETE statements that use title matching (can't be offset)
        sed -E -e "/^DELETE FROM games WHERE title IN/,/;$/d" "$sql_file" > "$temp_file"
    else
        # Other workers: Need user suffix and game ID offset
        # Step 1: Replace user references with worker-specific versions
        # Only remove title-based DELETE statements (ID-based ones will be offset by Python)
        sed -E \
            -e "s/'Test(GM|Player[0-9]|Audience)@/'Test\1_${WORKER_INDEX}@/g" \
            -e "s/test_(gm|player[0-9]|audience)@/test_\1_${WORKER_INDEX}@/g" \
            -e "s/'Test(GM|Player[0-9]|Audience)'/'Test\1_${WORKER_INDEX}'/g" \
            -e "/^DELETE FROM games WHERE title IN/,/;$/d" \
            "$sql_file" > "$temp_file.step1"

        # Step 2: Offset game IDs using Python for reliable arithmetic
        python3 -c "
import sys
import re

offset = $GAME_ID_OFFSET

with open('$temp_file.step1', 'r') as f:
    content = f.read()

# Helper to offset a game ID value
def offset_id(id_str):
    return str(int(id_str) + offset)

# 1. Offset game IDs in INSERT INTO games statements (handles both inline and multi-line)
# Only match 1-3 digit game IDs (original range) to avoid double-offsetting
content = re.sub(
    r'(INSERT INTO games \([^)]*\bid\b[^)]*\)\s+VALUES\s*\(\s*)(\d{1,3})(\s*,)',
    lambda m: m.group(1) + offset_id(m.group(2)) + m.group(3),
    content, flags=re.IGNORECASE)

# 1b. Offset game IDs in INSERT INTO games ... SELECT statements
# Handles pattern: INSERT INTO games (...) SELECT 700, ...
content = re.sub(
    r'(INSERT INTO games \([^)]*\)\s+SELECT\s+)(\d{1,3})(\s*,)',
    lambda m: m.group(1) + offset_id(m.group(2)) + m.group(3),
    content, flags=re.IGNORECASE)

# 2. Offset game_id in related table INSERTs (game_participants, game_phases, characters, etc.)
# This pattern matches: INSERT INTO table (...game_id...) VALUES (164, ...)
# Only match 1-3 digit game IDs to avoid double-offsetting
content = re.sub(
    r'(INSERT INTO (?!games\b)\w+\s*\([^)]*\bgame_id\b[^)]*\)\s+VALUES\s*\(\s*)(\d{1,3})(\s*,)',
    lambda m: m.group(1) + offset_id(m.group(2)) + m.group(3),
    content, flags=re.IGNORECASE)

# 2b. Offset subsequent rows in multi-row INSERTs
# Matches BOTH newline-separated AND inline comma-separated rows
# Pattern: , (164, user_id, ...) OR newline (164, user_id, ...)
content = re.sub(
    r'([,\n]\s*\()(\d{1,3})(\s*,\s*\w+_id)',
    lambda m: m.group(1) + offset_id(m.group(2)) + m.group(3),
    content)

# 3. Offset game_id variable assignments: game_xxx_id := NNN; OR game_xxx_id INT := NNN;
# Handles both with and without type declaration (INT or INTEGER)
# Matches: game_id, game1_id, game_complete_id, etc.
content = re.sub(
    r'\b(game_?\w*_id(?:\s+(?:INT|INTEGER))?)\s*:=\s*(\d{1,3});',
    lambda m: f'{m.group(1)} := {offset_id(m.group(2))};',
    content)

# 4. Offset DELETE FROM games WHERE id IN (...) statements
# Only offset 1-3 digit game IDs in the list
content = re.sub(
    r'(DELETE FROM games WHERE id IN \()([\d,\s]+)(\))',
    lambda m: m.group(1) + ','.join(offset_id(id.strip()) if len(id.strip()) <= 3 else id.strip() for id in m.group(2).split(',') if id.strip()) + m.group(3),
    content)

# 4b. Offset DELETE FROM games WHERE id = NNN statements
# Handles single-ID DELETE statements like: DELETE FROM games WHERE id = 700;
content = re.sub(
    r'(DELETE FROM games WHERE id\s*=\s*)(\d{1,3})(;)',
    lambda m: m.group(1) + offset_id(m.group(2)) + m.group(3),
    content)

# 5. Offset comments with game numbers: -- GAME #164:
# Only match 1-3 digit game IDs
content = re.sub(
    r'(-- GAME #)(\d{1,3})(:)',
    lambda m: m.group(1) + offset_id(m.group(2)) + m.group(3),
    content)

# 6. Offset RAISE NOTICE messages with game IDs
# Only match 1-3 digit game IDs
content = re.sub(
    r\"(RAISE NOTICE 'Created Game #)(\d{1,3})(:)\",
    lambda m: m.group(1) + offset_id(m.group(2)) + m.group(3),
    content)

with open('$temp_file', 'w') as f:
    f.write(content)
" || {
    echo "ERROR: Python script failed"
    rm -f "$temp_file" "$temp_file.step1"
    return 1
}

        # Clean up intermediate file
        rm -f "$temp_file.step1"
    fi

    # Apply the modified SQL (with error checking)
    if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$temp_file"; then
        echo "❌ ERROR: Failed to apply $filename for worker $WORKER_INDEX"
        # Keep temp file for debugging
        echo "   Temp file saved at: $temp_file"
        return 1
    fi

    # Clean up
    rm "$temp_file"
}

# Apply all E2E fixture files in order
for file in "$SCRIPT_DIR"/e2e/*.sql; do
    if [ -f "$file" ] && [ "$(basename "$file")" != "00_worker_setup.sql" ]; then
        apply_worker_sql "$file"
    fi
done

echo "✅ Worker #$WORKER_INDEX E2E fixtures applied successfully!"
