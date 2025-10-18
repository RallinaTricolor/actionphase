#!/bin/bash
# Apply all test fixtures to the database

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Database connection details
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-example}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-actionphase}"

FIXTURES_DIR="backend/pkg/db/test_fixtures"

echo "🧹 Resetting test data..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$FIXTURES_DIR/00_reset.sql"

echo "👥 Creating test users..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$FIXTURES_DIR/01_users.sql"

echo "🎲 Creating recruiting games..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$FIXTURES_DIR/02_games_recruiting.sql"

echo "🎮 Creating running games with phases..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$FIXTURES_DIR/03_games_running.sql"

echo "🧙 Creating characters and NPCs..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$FIXTURES_DIR/04_characters.sql"

echo "⚔️  Creating action submissions..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$FIXTURES_DIR/05_actions.sql"

echo "📜 Creating action results..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$FIXTURES_DIR/06_results.sql"

echo "💬 Creating Common Room test game..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$FIXTURES_DIR/07_common_room.sql"

echo "✅ Test data fixtures applied successfully!"
echo ""
echo "Test Accounts:"
echo "  GM: test_gm@example.com / testpassword123"
echo "  Player 1-5: test_player1@example.com through test_player5@example.com / testpassword123"
echo "  Audience: test_audience@example.com / testpassword123"
