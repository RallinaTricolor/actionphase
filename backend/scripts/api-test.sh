#!/usr/bin/env bash
#
# API Testing Utility Script
# Consolidated from justfile API testing commands
#
# Usage: ./api-test.sh <command> [args]
#
# Commands:
#   login [user]          - Login and save token (default: TestPlayer1)
#   login-gm              - Login as GM
#   login-player          - Login as Player1
#   health                - Test API health endpoint
#   test-token            - Test if current token is valid
#   games                 - Get games list
#   game [id]             - Get game details (default: 164)
#   characters [game_id]  - Get characters in game (default: 164)
#   posts [game_id]       - Get posts for game (default: 164)
#   comments <post_id>    - Get comments for a post
#   create-post [game_id] [character_id] [content] - Create a test post
#   create-comment <post_id> [character_id] [content] - Create a test comment
#   test-mentions         - Test character mentions end-to-end
#   status                - Complete API status check
#

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TOKEN_FILE="/tmp/api-token.txt"
DEFAULT_PASSWORD="testpassword123"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
check_token() {
  if [ ! -f "$TOKEN_FILE" ]; then
    echo -e "${RED}❌ No token found. Run './api-test.sh login' first${NC}"
    exit 1
  fi
}

get_token() {
  cat "$TOKEN_FILE"
}

auth_header() {
  echo "Authorization: Bearer $(get_token)"
}

# Commands

cmd_login() {
  local user="${1:-TestPlayer1}"
  echo -e "${BLUE}Logging in as $user...${NC}"

  TOKEN=$(curl -s -X POST "$API_BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"password\":\"$DEFAULT_PASSWORD\"}" \
    | jq -r '.Token')

  if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo -e "${RED}❌ Login failed${NC}"
    exit 1
  fi

  echo "$TOKEN" > "$TOKEN_FILE"
  echo -e "${GREEN}✅ Logged in as $user${NC}"
  echo "Token saved to $TOKEN_FILE"
  echo "Token: ${TOKEN:0:30}..."
}

cmd_login_gm() {
  cmd_login "TestGM"
}

cmd_login_player() {
  cmd_login "TestPlayer1"
}

cmd_health() {
  echo -e "${BLUE}Checking API health...${NC}"
  if curl -sf "$API_BASE_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
  else
    echo -e "${RED}❌ Backend is down${NC}"
    exit 1
  fi
}

cmd_test_token() {
  check_token

  RESPONSE=$(curl -s -H "$(auth_header)" "$API_BASE_URL/api/v1/auth/me")

  if echo "$RESPONSE" | jq -e '.username' > /dev/null 2>&1; then
    USERNAME=$(echo "$RESPONSE" | jq -r '.username')
    echo -e "${GREEN}✅ Token is valid for user: $USERNAME${NC}"
  else
    echo -e "${RED}❌ Token is invalid or expired. Run './api-test.sh login' to get a new token${NC}"
    exit 1
  fi
}

cmd_games() {
  check_token
  curl -s -H "$(auth_header)" "$API_BASE_URL/api/v1/games" | jq '.'
}

cmd_game() {
  check_token
  local game_id="${1:-164}"
  curl -s -H "$(auth_header)" "$API_BASE_URL/api/v1/games/$game_id" | jq '.'
}

cmd_characters() {
  check_token
  local game_id="${1:-164}"
  curl -s -H "$(auth_header)" "$API_BASE_URL/api/v1/games/$game_id/characters" | jq '.'
}

cmd_posts() {
  check_token
  local game_id="${1:-164}"
  curl -s -H "$(auth_header)" "$API_BASE_URL/api/v1/games/$game_id/posts" | jq '.'
}

cmd_comments() {
  check_token
  local post_id="$1"

  if [ -z "$post_id" ]; then
    echo -e "${RED}❌ post_id is required${NC}"
    echo "Usage: ./api-test.sh comments <post_id>"
    exit 1
  fi

  curl -s -H "$(auth_header)" "$API_BASE_URL/api/v1/games/164/posts/$post_id/comments" | jq '.'
}

cmd_create_post() {
  check_token
  local game_id="${1:-164}"
  local character_id="${2:-1319}"
  local content="${3:-Test post with @Test Player 2 Character mention}"

  curl -s -X POST -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    "$API_BASE_URL/api/v1/games/$game_id/posts" \
    -d "{\"character_id\": $character_id, \"content\": \"$content\"}" | jq '.'
}

cmd_create_comment() {
  check_token
  local post_id="$1"
  local character_id="${2:-1319}"
  local content="${3:-Test comment with @Test Player 2 Character}"

  if [ -z "$post_id" ]; then
    echo -e "${RED}❌ post_id is required${NC}"
    echo "Usage: ./api-test.sh create-comment <post_id> [character_id] [content]"
    exit 1
  fi

  curl -s -X POST -H "$(auth_header)" \
    -H "Content-Type: application/json" \
    "$API_BASE_URL/api/v1/games/164/posts/$post_id/comments" \
    -d "{\"character_id\": $character_id, \"content\": \"$content\"}" | jq '.'
}

cmd_test_mentions() {
  echo -e "${BLUE}=== Testing Character Mentions Feature ===${NC}"
  echo ""

  # 1. Login
  echo -e "${YELLOW}1. Logging in as TestPlayer1...${NC}"
  cmd_login_player
  echo ""

  # 2. Get characters
  echo -e "${YELLOW}2. Getting available characters...${NC}"
  cmd_characters 164 | jq '.[] | {id, name}' | head -20
  echo ""

  # 3. Get latest post
  echo -e "${YELLOW}3. Getting latest post...${NC}"
  POST_ID=$(cmd_posts 164 | jq -r '.[0].id')
  echo "Latest post ID: $POST_ID"
  echo ""

  # 4. Create comment with mention
  echo -e "${YELLOW}4. Creating comment with mention...${NC}"
  COMMENT=$(cmd_create_comment "$POST_ID" 1319 "Hey @Test Player 2 Character, testing mentions!")
  echo "$COMMENT" | jq '.'
  echo ""

  # 5. Check if mentioned_character_ids is present
  echo -e "${YELLOW}5. Checking mentioned_character_ids field...${NC}"
  MENTIONED_IDS=$(echo "$COMMENT" | jq '.mentioned_character_ids')
  if [ "$MENTIONED_IDS" != "null" ] && [ "$MENTIONED_IDS" != "[]" ]; then
    echo -e "${GREEN}✅ mentioned_character_ids found: $MENTIONED_IDS${NC}"
  else
    echo -e "${RED}❌ mentioned_character_ids is missing or empty: $MENTIONED_IDS${NC}"
  fi
}

cmd_status() {
  echo -e "${BLUE}=== API Status Check ===${NC}"
  cmd_health
  echo ""
  echo -e "${BLUE}=== Token Status ===${NC}"
  cmd_test_token || echo -e "${YELLOW}No valid token${NC}"
}

cmd_help() {
  cat << EOF
${BLUE}API Testing Utility${NC}

${YELLOW}Usage:${NC}
  ./api-test.sh <command> [args]

${YELLOW}Authentication:${NC}
  login [user]           Login and save token (default: TestPlayer1)
  login-gm               Login as GM (TestGM)
  login-player           Login as Player1 (TestPlayer1)
  test-token             Test if current token is valid

${YELLOW}API Endpoints:${NC}
  health                 Test API health endpoint
  status                 Complete API status check
  games                  Get games list
  game [id]              Get game details (default: 164)
  characters [game_id]   Get characters in game (default: 164)
  posts [game_id]        Get posts for game (default: 164)
  comments <post_id>     Get comments for a post

${YELLOW}Create Operations:${NC}
  create-post [game_id] [character_id] [content]
                         Create a test post with mentions
  create-comment <post_id> [character_id] [content]
                         Create a test comment with mentions

${YELLOW}Testing:${NC}
  test-mentions          Test character mentions feature end-to-end

${YELLOW}Examples:${NC}
  ./api-test.sh login TestPlayer1
  ./api-test.sh games
  ./api-test.sh game 164
  ./api-test.sh characters 164
  ./api-test.sh test-mentions

${YELLOW}Environment Variables:${NC}
  API_BASE_URL          API base URL (default: http://localhost:3000)

EOF
}

# Main command dispatcher
main() {
  local command="${1:-help}"
  shift || true

  case "$command" in
    login)
      cmd_login "$@"
      ;;
    login-gm)
      cmd_login_gm
      ;;
    login-player)
      cmd_login_player
      ;;
    health)
      cmd_health
      ;;
    test-token)
      cmd_test_token
      ;;
    games)
      cmd_games
      ;;
    game)
      cmd_game "$@"
      ;;
    characters)
      cmd_characters "$@"
      ;;
    posts)
      cmd_posts "$@"
      ;;
    comments)
      cmd_comments "$@"
      ;;
    create-post)
      cmd_create_post "$@"
      ;;
    create-comment)
      cmd_create_comment "$@"
      ;;
    test-mentions)
      cmd_test_mentions
      ;;
    status)
      cmd_status
      ;;
    help|--help|-h)
      cmd_help
      ;;
    *)
      echo -e "${RED}Unknown command: $command${NC}"
      echo ""
      cmd_help
      exit 1
      ;;
  esac
}

main "$@"
