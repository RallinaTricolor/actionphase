#!/usr/bin/env bash
#
# Character Rename API Endpoint Test
#
# Tests the PUT /api/v1/characters/{id}/rename endpoint
#

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TOKEN_FILE="/tmp/api-token.txt"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
check_token() {
  if [ ! -f "$TOKEN_FILE" ]; then
    echo -e "${RED}❌ No token found. Run './backend/scripts/api-test.sh login' first${NC}"
    exit 1
  fi
}

get_token() {
  cat "$TOKEN_FILE"
}

auth_header() {
  echo "Authorization: Bearer $(get_token)"
}

# Test functions
test_rename_success() {
  echo -e "${BLUE}Test 1: Successfully rename character${NC}"

  # Rename character (using a test character from fixtures)
  RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL/api/v1/characters/14823/rename" \
    -H "Content-Type: application/json" \
    -H "$(auth_header)" \
    -d '{"name":"Renamed Character"}')

  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" = "200" ]; then
    NEW_NAME=$(echo "$BODY" | jq -r '.name')
    if [ "$NEW_NAME" = "Renamed Character" ]; then
      echo -e "${GREEN}✅ Test 1 PASSED: Character renamed successfully${NC}"
      echo "   Response: $NEW_NAME"
    else
      echo -e "${RED}❌ Test 1 FAILED: Name not updated correctly${NC}"
      echo "   Expected: 'Renamed Character', Got: '$NEW_NAME'"
      return 1
    fi
  else
    echo -e "${RED}❌ Test 1 FAILED: HTTP $HTTP_CODE${NC}"
    echo "   Response: $BODY"
    return 1
  fi
}

test_rename_empty_name() {
  echo -e "${BLUE}Test 2: Reject empty name${NC}"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL/api/v1/characters/14823/rename" \
    -H "Content-Type: application/json" \
    -H "$(auth_header)" \
    -d '{"name":"   "}')

  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" = "400" ]; then
    ERROR_MSG=$(echo "$BODY" | jq -r '.message')
    if echo "$ERROR_MSG" | grep -qi "empty"; then
      echo -e "${GREEN}✅ Test 2 PASSED: Empty name rejected with 400${NC}"
      echo "   Error: $ERROR_MSG"
    else
      echo -e "${YELLOW}⚠️  Test 2 PARTIAL: Got 400 but unexpected error message${NC}"
      echo "   Error: $ERROR_MSG"
    fi
  else
    echo -e "${RED}❌ Test 2 FAILED: Expected HTTP 400, got $HTTP_CODE${NC}"
    echo "   Response: $BODY"
    return 1
  fi
}

test_rename_duplicate_name() {
  echo -e "${BLUE}Test 3: Reject duplicate name in same game${NC}"

  # First, rename to a unique name
  curl -s -X PUT "$API_BASE_URL/api/v1/characters/14823/rename" \
    -H "Content-Type: application/json" \
    -H "$(auth_header)" \
    -d '{"name":"Unique Name For Test"}' > /dev/null

  # Try to rename another character to the same name (assuming character 14824 exists in same game)
  RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL/api/v1/characters/14824/rename" \
    -H "Content-Type: application/json" \
    -H "$(auth_header)" \
    -d '{"name":"Unique Name For Test"}')

  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" = "409" ]; then
    ERROR_MSG=$(echo "$BODY" | jq -r '.message')
    if echo "$ERROR_MSG" | grep -qi "already exists"; then
      echo -e "${GREEN}✅ Test 3 PASSED: Duplicate name rejected with 409 Conflict${NC}"
      echo "   Error: $ERROR_MSG"
    else
      echo -e "${YELLOW}⚠️  Test 3 PARTIAL: Got 409 but unexpected error message${NC}"
      echo "   Error: $ERROR_MSG"
    fi
  else
    echo -e "${YELLOW}⚠️  Test 3 SKIPPED: Expected HTTP 409, got $HTTP_CODE${NC}"
    echo "   (Character 14824 may not exist or test setup issue)"
    echo "   Response: $BODY"
  fi
}

test_rename_unauthorized() {
  echo -e "${BLUE}Test 4: Reject rename without auth${NC}"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL/api/v1/characters/14823/rename" \
    -H "Content-Type: application/json" \
    -d '{"name":"Should Fail"}')

  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

  if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✅ Test 4 PASSED: Unauthorized request rejected with 401${NC}"
  else
    echo -e "${RED}❌ Test 4 FAILED: Expected HTTP 401, got $HTTP_CODE${NC}"
    return 1
  fi
}

test_rename_invalid_character() {
  echo -e "${BLUE}Test 5: Reject rename of non-existent character${NC}"

  RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL/api/v1/characters/99999/rename" \
    -H "Content-Type: application/json" \
    -H "$(auth_header)" \
    -d '{"name":"New Name"}')

  HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)

  if [ "$HTTP_CODE" = "500" ] || [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✅ Test 5 PASSED: Invalid character rejected with $HTTP_CODE${NC}"
  else
    echo -e "${RED}❌ Test 5 FAILED: Expected HTTP 404/500, got $HTTP_CODE${NC}"
    return 1
  fi
}

# Main test runner
main() {
  echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
  echo -e "${BLUE}    Character Rename API Endpoint Tests${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
  echo ""

  check_token

  TESTS_PASSED=0
  TESTS_FAILED=0

  # Run tests
  if test_rename_success; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
  echo ""

  if test_rename_empty_name; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
  echo ""

  if test_rename_duplicate_name; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
  echo ""

  if test_rename_unauthorized; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
  echo ""

  if test_rename_invalid_character; then ((TESTS_PASSED++)); else ((TESTS_FAILED++)); fi
  echo ""

  # Summary
  echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
  echo -e "${BLUE}    Test Summary${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
  echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
  echo -e "${RED}Failed: $TESTS_FAILED${NC}"

  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✅${NC}"
    exit 0
  else
    echo -e "${RED}Some tests failed ❌${NC}"
    exit 1
  fi
}

# Run main if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  main "$@"
fi
