# API Testing with curl

Quick reference for testing the ActionPhase backend API using curl.

## Quick Start (Using API Test Script)

**Recommended**: Use the `api-test.sh` script for easier API testing:

```bash
# Login as TestPlayer1 (saves token to /tmp/api-token.txt)
./backend/scripts/api-test.sh login-player

# Login as TestGM
./backend/scripts/api-test.sh login-gm

# Use saved token for authenticated requests
curl -s -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
  "http://localhost:3000/api/v1/games" | jq '.'

# Check API health (no auth needed)
curl -s http://localhost:3000/health | jq '.'

# Get metrics (no auth needed)
curl -s http://localhost:3000/metrics
```

See `./backend/scripts/api-test.sh` for usage examples.

## Prerequisites

- Backend running on `http://localhost:3000`
- Test fixtures applied: `./backend/pkg/db/test_fixtures/apply_all.sh` or `just test-fixtures`
- `jq` installed for JSON parsing: `brew install jq`

## Authentication

### 1. Login and Get Token

```bash
# Login as TestGM
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestGM","password":"testpassword123"}' \
  | jq -r '.Token'

# Login as TestPlayer1
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer1","password":"testpassword123"}' \
  | jq -r '.Token'

# Save token to environment variable for reuse
export TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer1","password":"testpassword123"}' \
  | jq -r '.Token')

# Or save to file for multiple commands
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer1","password":"testpassword123"}' \
  | jq -r '.Token' > /tmp/api-token.txt
```

### 2. Test Users (from fixtures)

| Username | Email | Password | Role |
|----------|-------|----------|------|
| `TestGM` | `test_gm@example.com` | `testpassword123` | GM |
| `TestPlayer1` | `test_player1@example.com` | `testpassword123` | Player |
| `TestPlayer2` | `test_player2@example.com` | `testpassword123` | Player |
| `TestPlayer3` | `test_player3@example.com` | `testpassword123` | Player |
| `TestPlayer4` | `test_player4@example.com` | `testpassword123` | Player |
| `TestPlayer5` | `test_player5@example.com` | `testpassword123` | Player |
| `TestAudience` | `test_audience@example.com` | `testpassword123` | Audience |

**Important**: Login uses `username`, not `email`.

## Common API Calls

### Get Current User Info

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/auth/me | jq '.'
```

### List Games

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games | jq '.'
```

### Get Game Details

```bash
# Get game by ID (e.g., Game #164 - E2E Common Room Test Game)
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164 | jq '.'
```

### Get Characters in Game

```bash
# Get all characters in game 164
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/characters | jq '.'

# Get specific character by ID
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/characters/1319 | jq '.'
```

### Get Posts (Common Room)

```bash
# Get all posts for game 164
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/posts | jq '.'

# Get first post with pretty formatting
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/posts | jq '.[0]'

# Check if posts have mentioned_character_ids
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/posts | jq '.[0] | {id, content, mentioned_character_ids}'
```

### Create a Post

```bash
# Create a post with a mention
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/games/164/posts \
  -d '{
    "character_id": 1319,
    "content": "Hey @Test Player 2 Character, what do you think about this?"
  }' | jq '.'
```

### Get Comments for a Post

```bash
# Get comments for post ID 123
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/posts/123/comments | jq '.'
```

### Create a Comment

```bash
# Create comment on post 123
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/games/164/posts/123/comments \
  -d '{
    "character_id": 1319,
    "content": "This is a test comment with @Test Player 2 Character mention"
  }' | jq '.'

# Check if the response includes mentioned_character_ids
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/games/164/posts/123/comments \
  -d '{
    "character_id": 1319,
    "content": "@Test Player 2 Character I agree!"
  }' | jq '{id, content, mentioned_character_ids}'
```

## Testing Workflow for Character Mentions

### Step-by-step verification of mention feature:

```bash
# 1. Login and save token
export TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer1","password":"testpassword123"}' \
  | jq -r '.Token')

# 2. Get game characters to see available names
echo "=== Available Characters ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/characters \
  | jq '.[] | {id, name}'

# 3. Get existing posts
echo "=== Existing Posts ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/posts \
  | jq '.[0] | {id, content}'

# 4. Create a comment with mention (replace POST_ID with actual post ID from step 3)
POST_ID=123  # Replace with actual post ID
echo "=== Creating Comment with Mention ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/games/164/posts/${POST_ID}/comments \
  -d '{
    "character_id": 1319,
    "content": "Hey @Test Player 2 Character, check this out!"
  }' | jq '.'

# 5. Verify mentioned_character_ids is in response
echo "=== Verifying mentioned_character_ids field ==="
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/games/164/posts/${POST_ID}/comments \
  -d '{
    "character_id": 1319,
    "content": "Another test with @Test Player 2 Character"
  }' | jq '.mentioned_character_ids'

# 6. Get comments to verify they're stored with mentioned_character_ids
echo "=== Fetching Comments to Verify Storage ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/posts/${POST_ID}/comments \
  | jq '.[] | {id, content, mentioned_character_ids}'
```

## Debugging Tips

### Check if backend is running
```bash
curl -sf http://localhost:3000/health && echo "✅ Backend is running" || echo "❌ Backend is down"
```

### Validate token
```bash
# Get token
export TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer1","password":"testpassword123"}' \
  | jq -r '.Token')

# Test token with /me endpoint
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/auth/me | jq '.'

# If you get "token is unauthorized", the token may have expired or be invalid
```

### Pretty print JSON responses
```bash
# Use jq '.' to format JSON
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/posts | jq '.'

# Use jq to filter specific fields
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/posts | jq '.[0] | {id, content, author_username}'
```

### View full HTTP response including headers
```bash
# Use -i flag to include HTTP headers
curl -i -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/posts

# Use -v flag for verbose output (includes request headers too)
curl -v -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games/164/posts
```

## Common Issues

### Issue: "token is unauthorized"
**Solution**: Token may have expired. Re-login to get a new token.

### Issue: "Invalid username or password"
**Cause**: Using `email` instead of `username` in login request.
**Solution**: Use `{"username":"TestPlayer1","password":"..."}`, not email.

### Issue: Empty response or parse error
**Cause**: API endpoint may not exist or return non-JSON.
**Solution**: Check endpoint URL and use `-v` flag to see full response.

### Issue: 404 Not Found
**Cause**: Game ID, post ID, or character ID doesn't exist in test fixtures.
**Solution**: Run `./backend/pkg/db/test_fixtures/apply_all.sh` to reset test data.

## Quick Reference: One-liner Test Commands

```bash
# Quick health check
curl -sf http://localhost:3000/health

# Quick login test
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestGM","password":"testpassword123"}' | jq -r '.Token'

# Quick API test (replace $TOKEN with actual token)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/games | jq '. | length'

# Test character mentions in one command (creates comment and shows mentioned_character_ids)
POST_ID=123 && curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/v1/games/164/posts/${POST_ID}/comments \
  -d '{"character_id":1319,"content":"@Test Player 2 Character hi!"}' \
  | jq '.mentioned_character_ids'
```

## Saving This for Reuse

Create an alias in your `.zshrc` or `.bashrc`:

```bash
# Add to ~/.zshrc
alias ap-login='export TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d "{\"username\":\"TestPlayer1\",\"password\":\"testpassword123\"}" | jq -r ".Token") && echo "Logged in as TestPlayer1"'

alias ap-test='curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/games | jq "." '

# Then use:
# ap-login
# ap-test
```

Or create a shell script in `backend/scripts/api-test.sh`:

```bash
#!/bin/bash
# Quick API testing script

# Login
export TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"TestPlayer1","password":"testpassword123"}' \
  | jq -r '.Token')

echo "Token: $TOKEN"

# Use the token for subsequent requests
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/games | jq '.'
```
