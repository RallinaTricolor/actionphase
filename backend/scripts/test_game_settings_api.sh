#!/bin/bash
# Integration tests for game settings API endpoints
# Tests Issues 2.1 & 2.2 - Game creation and update with is_anonymous and auto_accept_audience

set -e

BASE_URL="http://localhost:3000/api/v1"
TOKEN_FILE="/tmp/api-token.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================="
echo "Game Settings API Integration Tests"
echo "=================================="
echo

# Step 1: Login to get token
echo -e "${YELLOW}Step 1: Logging in as test_gm@example.com...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "TestGM",
    "password": "testpassword123"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.Token')
echo "$TOKEN" > "$TOKEN_FILE"

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed${NC}"
  echo "$LOGIN_RESPONSE" | jq
  exit 1
fi

echo -e "${GREEN}✅ Login successful${NC}"
echo "Token saved to $TOKEN_FILE"
echo

# Step 2: Create game with both settings enabled
echo -e "${YELLOW}Step 2: Creating game with is_anonymous=true and auto_accept_audience=true...${NC}"
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/games" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Game - Settings Enabled",
    "description": "Testing game creation with both settings enabled",
    "is_anonymous": true,
    "auto_accept_audience": true
  }')

GAME_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')
IS_ANONYMOUS=$(echo "$CREATE_RESPONSE" | jq -r '.is_anonymous')
AUTO_ACCEPT=$(echo "$CREATE_RESPONSE" | jq -r '.auto_accept_audience')

echo "Response:"
echo "$CREATE_RESPONSE" | jq

if [ "$GAME_ID" == "null" ] || [ -z "$GAME_ID" ]; then
  echo -e "${RED}❌ Game creation failed${NC}"
  exit 1
fi

if [ "$IS_ANONYMOUS" != "true" ]; then
  echo -e "${RED}❌ is_anonymous not set correctly in response (expected: true, got: $IS_ANONYMOUS)${NC}"
  exit 1
fi

if [ "$AUTO_ACCEPT" != "true" ]; then
  echo -e "${RED}❌ auto_accept_audience not set correctly in response (expected: true, got: $AUTO_ACCEPT)${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Game created successfully with ID: $GAME_ID${NC}"
echo -e "${GREEN}✅ is_anonymous: $IS_ANONYMOUS${NC}"
echo -e "${GREEN}✅ auto_accept_audience: $AUTO_ACCEPT${NC}"
echo

# Step 3: Retrieve game to verify persistence
echo -e "${YELLOW}Step 3: Retrieving game to verify settings persisted...${NC}"
GET_RESPONSE=$(curl -s -X GET "$BASE_URL/games/$GAME_ID" \
  -H "Authorization: Bearer $TOKEN")

IS_ANONYMOUS_PERSISTED=$(echo "$GET_RESPONSE" | jq -r '.is_anonymous')
AUTO_ACCEPT_PERSISTED=$(echo "$GET_RESPONSE" | jq -r '.auto_accept_audience')

echo "Response:"
echo "$GET_RESPONSE" | jq

if [ "$IS_ANONYMOUS_PERSISTED" != "true" ]; then
  echo -e "${RED}❌ is_anonymous not persisted (expected: true, got: $IS_ANONYMOUS_PERSISTED)${NC}"
  exit 1
fi

if [ "$AUTO_ACCEPT_PERSISTED" != "true" ]; then
  echo -e "${RED}❌ auto_accept_audience not persisted (expected: true, got: $AUTO_ACCEPT_PERSISTED)${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Settings persisted correctly${NC}"
echo -e "${GREEN}✅ is_anonymous: $IS_ANONYMOUS_PERSISTED${NC}"
echo -e "${GREEN}✅ auto_accept_audience: $AUTO_ACCEPT_PERSISTED${NC}"
echo

# Step 3b: Also test the /details endpoint (used by frontend)
echo -e "${YELLOW}Step 3b: Testing /details endpoint (used by frontend)...${NC}"
GET_DETAILS_RESPONSE=$(curl -s -X GET "$BASE_URL/games/$GAME_ID/details" \
  -H "Authorization: Bearer $TOKEN")

IS_ANONYMOUS_DETAILS=$(echo "$GET_DETAILS_RESPONSE" | jq -r '.is_anonymous')
AUTO_ACCEPT_DETAILS=$(echo "$GET_DETAILS_RESPONSE" | jq -r '.auto_accept_audience')

echo "Response:"
echo "$GET_DETAILS_RESPONSE" | jq

if [ "$IS_ANONYMOUS_DETAILS" != "true" ]; then
  echo -e "${RED}❌ /details: is_anonymous not persisted (expected: true, got: $IS_ANONYMOUS_DETAILS)${NC}"
  exit 1
fi

if [ "$AUTO_ACCEPT_DETAILS" != "true" ]; then
  echo -e "${RED}❌ /details: auto_accept_audience not persisted (expected: true, got: $AUTO_ACCEPT_DETAILS)${NC}"
  exit 1
fi

echo -e "${GREEN}✅ /details endpoint returns correct settings${NC}"
echo -e "${GREEN}✅ is_anonymous: $IS_ANONYMOUS_DETAILS${NC}"
echo -e "${GREEN}✅ auto_accept_audience: $AUTO_ACCEPT_DETAILS${NC}"
echo

# Step 4: Update game to disable both settings
echo -e "${YELLOW}Step 4: Updating game to disable both settings...${NC}"
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/games/$GAME_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Game - Settings Disabled",
    "description": "Testing game update with settings disabled",
    "is_public": true,
    "is_anonymous": false,
    "auto_accept_audience": false
  }')

IS_ANONYMOUS_UPDATED=$(echo "$UPDATE_RESPONSE" | jq -r '.is_anonymous')
AUTO_ACCEPT_UPDATED=$(echo "$UPDATE_RESPONSE" | jq -r '.auto_accept_audience')

echo "Response:"
echo "$UPDATE_RESPONSE" | jq

if [ "$IS_ANONYMOUS_UPDATED" != "false" ]; then
  echo -e "${RED}❌ is_anonymous not updated correctly (expected: false, got: $IS_ANONYMOUS_UPDATED)${NC}"
  exit 1
fi

if [ "$AUTO_ACCEPT_UPDATED" != "false" ]; then
  echo -e "${RED}❌ auto_accept_audience not updated correctly (expected: false, got: $AUTO_ACCEPT_UPDATED)${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Settings updated correctly${NC}"
echo -e "${GREEN}✅ is_anonymous: $IS_ANONYMOUS_UPDATED${NC}"
echo -e "${GREEN}✅ auto_accept_audience: $AUTO_ACCEPT_UPDATED${NC}"
echo

# Step 5: Verify updated settings persist
echo -e "${YELLOW}Step 5: Retrieving game again to verify updated settings persisted...${NC}"
GET_FINAL_RESPONSE=$(curl -s -X GET "$BASE_URL/games/$GAME_ID" \
  -H "Authorization: Bearer $TOKEN")

IS_ANONYMOUS_FINAL=$(echo "$GET_FINAL_RESPONSE" | jq -r '.is_anonymous')
AUTO_ACCEPT_FINAL=$(echo "$GET_FINAL_RESPONSE" | jq -r '.auto_accept_audience')

echo "Response:"
echo "$GET_FINAL_RESPONSE" | jq

if [ "$IS_ANONYMOUS_FINAL" != "false" ]; then
  echo -e "${RED}❌ Updated is_anonymous not persisted (expected: false, got: $IS_ANONYMOUS_FINAL)${NC}"
  exit 1
fi

if [ "$AUTO_ACCEPT_FINAL" != "false" ]; then
  echo -e "${RED}❌ Updated auto_accept_audience not persisted (expected: false, got: $AUTO_ACCEPT_FINAL)${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Updated settings persisted correctly${NC}"
echo -e "${GREEN}✅ is_anonymous: $IS_ANONYMOUS_FINAL${NC}"
echo -e "${GREEN}✅ auto_accept_audience: $AUTO_ACCEPT_FINAL${NC}"
echo

# Step 6: Test game creation with settings disabled
echo -e "${YELLOW}Step 6: Creating game with both settings disabled...${NC}"
CREATE_DISABLED_RESPONSE=$(curl -s -X POST "$BASE_URL/games" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Game - Settings Disabled from Start",
    "description": "Testing game creation with both settings disabled",
    "is_anonymous": false,
    "auto_accept_audience": false
  }')

GAME_ID_2=$(echo "$CREATE_DISABLED_RESPONSE" | jq -r '.id')
IS_ANONYMOUS_2=$(echo "$CREATE_DISABLED_RESPONSE" | jq -r '.is_anonymous')
AUTO_ACCEPT_2=$(echo "$CREATE_DISABLED_RESPONSE" | jq -r '.auto_accept_audience')

echo "Response:"
echo "$CREATE_DISABLED_RESPONSE" | jq

if [ "$IS_ANONYMOUS_2" != "false" ]; then
  echo -e "${RED}❌ is_anonymous not set correctly (expected: false, got: $IS_ANONYMOUS_2)${NC}"
  exit 1
fi

if [ "$AUTO_ACCEPT_2" != "false" ]; then
  echo -e "${RED}❌ auto_accept_audience not set correctly (expected: false, got: $AUTO_ACCEPT_2)${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Game created with disabled settings${NC}"
echo -e "${GREEN}✅ Game ID: $GAME_ID_2${NC}"
echo -e "${GREEN}✅ is_anonymous: $IS_ANONYMOUS_2${NC}"
echo -e "${GREEN}✅ auto_accept_audience: $AUTO_ACCEPT_2${NC}"
echo

echo "=================================="
echo -e "${GREEN}✅ All API integration tests passed!${NC}"
echo "=================================="
echo
echo "Summary:"
echo "  - Game creation with settings enabled: ✅"
echo "  - Settings persistence after creation: ✅"
echo "  - Game update with settings: ✅"
echo "  - Updated settings persistence: ✅"
echo "  - Game creation with settings disabled: ✅"
echo
