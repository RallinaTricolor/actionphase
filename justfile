help:
  @just --list

claude:
    CLAUDE_CONFIG_DIR="/Users/jhouser/.claude-personal" /Users/jhouser/.npm-global/bin/claude

# === Database Commands ===
db_up:
  docker-compose up -d db

db_down:
  docker-compose down db

db_reset: db_down db_up
  @echo "Database reset complete"

# Create databases for development and testing
db_create:
  @echo "Creating ActionPhase databases..."
  @echo "Waiting for PostgreSQL to be ready..."
  @sleep 3
  -createdb -h localhost -U postgres -W actionphase
  -createdb -h localhost -U postgres -W actionphase_test
  @echo "Databases created successfully"
  @echo "Note: You may be prompted for password 'example' (from docker-compose.yml)"

# Full database setup for new development environment
db_setup: db_up db_create
  @echo "Database setup complete!"
  @echo "Next steps:"
  @echo "  1. Run migrations: just migrate"
  @echo "  2. Start the backend: just run"

# === Test Data Commands ===
# Apply all test data fixtures to development database
test-fixtures:
  @echo "Applying test data fixtures..."
  @./backend/pkg/db/test_fixtures/apply_all.sh
  @echo "✅ Test data loaded successfully!"

# Reset test data only (removes all test_*@example.com data)
reset-test-data:
  @echo "Resetting test data..."
  @PGPASSWORD=example psql -h localhost -p 5432 -U postgres -d actionphase -f backend/pkg/db/test_fixtures/00_reset.sql
  @echo "✅ Test data reset complete"

# Full reset and reload of test data
reload-test-data: reset-test-data test-fixtures
  @echo "🎉 Test data reloaded!"
  @echo ""
  @echo "Test Accounts Available:"
  @echo "  GM: test_gm@example.com / testpassword123"
  @echo "  Players: test_player1@example.com through test_player5@example.com / testpassword123"
  @echo "  Audience: test_audience@example.com / testpassword123"

# === Code Generation ===
sqlgen:
  cd backend/pkg/db && sqlc generate

# === Migration Commands ===
make_migration name:
  migrate create -ext sql -dir backend/pkg/db/migrations {{name}}

migrate:
  migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/actionphase?sslmode=disable" up

rollback:
  migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/actionphase?sslmode=disable" down

migrate_status:
  migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/actionphase?sslmode=disable" version

# Apply migrations to test database
migrate_test:
  migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable" up

# === Go Backend Commands ===
tidy:
  cd backend && go mod tidy

build:
  cd backend && go build ./...

fmt:
  cd backend && go fmt ./...

vet:
  cd backend && go vet ./...

lint: fmt vet
  @echo "Go linting complete"

run:
  cd backend && go run main.go

# Build backend binary to /tmp for faster restarts
build-binary:
  @echo "Building backend binary..."
  cd backend && go build -o /tmp/actionphase-backend main.go
  @echo "✅ Binary built: /tmp/actionphase-backend"

# Kill the backend process
kill-backend:
  @echo "Stopping backend..."
  -pkill -f "actionphase-backend" || true
  -pkill -f "go run main.go" || true
  @sleep 1
  @echo "✅ Backend stopped"

# Kill process on a specific port (default: 3000)
kill-port port="3000":
  @echo "Killing process on port {{port}}..."
  -lsof -i :{{port}} | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null || echo "No process found on port {{port}}"
  @sleep 1

# Restart backend (kill, rebuild, start)
restart-backend:
  @echo "🔄 Restarting backend..."
  @just kill-backend
  @just kill-port 3000
  @just build-binary
  @echo "Starting backend..."
  @cd backend && /tmp/actionphase-backend > /tmp/backend.log 2>&1 &
  @sleep 3
  @if curl -sf http://localhost:3000/health > /dev/null; then \
    echo "✅ Backend is running on http://localhost:3000"; \
  else \
    echo "❌ Backend failed to start. Check logs: just logs-backend"; \
    exit 1; \
  fi

# Quick restart using go run (slower but simpler)
restart-backend-dev:
  @echo "🔄 Restarting backend (dev mode)..."
  @just kill-backend
  @just kill-port 3000
  @echo "Starting backend with go run..."
  @cd backend && go run main.go > /tmp/backend.log 2>&1 &
  @sleep 4
  @if curl -sf http://localhost:3000/health > /dev/null; then \
    echo "✅ Backend is running on http://localhost:3000"; \
  else \
    echo "❌ Backend failed to start. Check logs: just logs-backend"; \
  fi

# View backend logs
logs-backend lines="50":
  @tail -{{lines}} /tmp/backend.log

# Follow backend logs (live)
logs-backend-follow:
  @tail -f /tmp/backend.log

# Check if backend is running
ps-backend:
  @echo "=== Backend Processes ==="
  @pgrep -fl "actionphase-backend|go run main.go" || echo "No backend process found"
  @echo ""
  @echo "=== Port 3000 Usage ==="
  @lsof -i :3000 | head -2 || echo "Port 3000 is free"
  @echo ""
  @echo "=== Health Check ==="
  @if curl -sf http://localhost:3000/health > /dev/null; then \
    echo "✅ Backend is healthy"; \
    curl -s http://localhost:3000/health | jq .; \
  else \
    echo "❌ Backend is not responding"; \
  fi

# === Backend Testing Commands ===
test:
  cd backend && go test -p 1 ./...

test-verbose:
  cd backend && go test -p 1 -v ./...

# Fast unit tests using mocks (no database required)
test-mocks:
  cd backend && SKIP_DB_TESTS=true go test -v -run "Mock" ./pkg/core/

# Integration tests with database (requires PostgreSQL)
test-integration:
  cd backend && go test -p 1 -v ./pkg/auth/ ./pkg/core/

# All tests in parallel for maximum speed (may fail due to database conflicts)
test-parallel:
  @echo "WARNING: Parallel tests may fail due to database conflicts. Use 'just test' for reliable results."
  cd backend && go test -parallel 4 ./...

# Run only mock tests without database dependencies
test-no-db:
  cd backend && go test -tags="!integration" ./pkg/core/

test-coverage:
  cd backend && go test -p 1 -coverprofile=coverage.out ./... && go tool cover -html=coverage.out -o coverage.html

test-race:
  cd backend && go test -p 1 -race ./...

test-bench:
  cd backend && go test -bench=. ./...

test-service service:
  cd backend && go test -v ./pkg/db/services/{{service}}_test.go ./pkg/db/services/{{service}}.go

test-clean:
  cd backend && rm -f coverage.out coverage.html

# Test database setup for integration tests
test-db-setup: db_up
  @echo "Setting up test database..."
  @sleep 2
  -createdb -h localhost -U postgres -W actionphase_test
  @echo "Applying migrations to test database..."
  @just migrate_test
  @echo "✓ Test database ready"

# === Frontend Commands ===
install-frontend:
  cd frontend && npm install

run-frontend:
  cd frontend && npm run dev

# Kill frontend dev server
kill-frontend:
  @echo "Stopping frontend..."
  -pkill -f "vite" || true
  -pkill -f "npm run dev" || true
  @sleep 1
  @echo "✅ Frontend stopped"

# Restart frontend dev server
restart-frontend:
  @echo "🔄 Restarting frontend..."
  @just kill-frontend
  @just kill-port 5173
  @echo "Starting frontend..."
  @cd frontend && npm run dev > /tmp/frontend.log 2>&1 &
  @sleep 3
  @if curl -sf http://localhost:5173 > /dev/null; then \
    echo "✅ Frontend is running on http://localhost:5173"; \
  else \
    echo "❌ Frontend failed to start. Check logs: just logs-frontend"; \
  fi

# View frontend logs
logs-frontend lines="50":
  @tail -{{lines}} /tmp/frontend.log

# Follow frontend logs (live)
logs-frontend-follow:
  @tail -f /tmp/frontend.log

# Check if frontend is running
ps-frontend:
  @echo "=== Frontend Processes ==="
  @pgrep -fl "vite|npm run dev" || echo "No frontend process found"
  @echo ""
  @echo "=== Port 5173 Usage ==="
  @lsof -i :5173 | head -2 || echo "Port 5173 is free"
  @echo ""
  @echo "=== Health Check ==="
  @if curl -sf http://localhost:5173 > /dev/null; then \
    echo "✅ Frontend is responding"; \
  else \
    echo "❌ Frontend is not responding"; \
  fi

build-frontend:
  cd frontend && npm run build

preview-frontend:
  cd frontend && npm run preview

# === Frontend Testing Commands ===
# Verify frontend testing setup (already configured)
setup-frontend-tests:
  @echo "Frontend testing is already configured with Vitest + React Testing Library"
  @echo "Available commands:"
  @echo "  just test-frontend                    - Run tests once"
  @echo "  just test-frontend-watch              - Run tests in watch mode"
  @echo "  just test-frontend-coverage           - Run tests with coverage"
  @echo "  just test-frontend-ui                 - Run tests with interactive UI"
  @echo "  just test-frontend-file <filename>    - Run specific test file"

# Run frontend tests once
test-frontend:
  cd frontend && npm run test

# Run frontend tests in watch mode
test-frontend-watch:
  cd frontend && npm run test:watch

# Run frontend tests with coverage report
test-frontend-coverage:
  cd frontend && npm run test:coverage

# Run frontend tests with UI (interactive)
test-frontend-ui:
  cd frontend && npx vitest --ui

# Run specific frontend test file
test-frontend-file file:
  cd frontend && npx vitest {{file}}

lint-frontend:
  cd frontend && npm run lint

# === E2E Testing Commands ===
# Run E2E tests (headless)
e2e:
  cd frontend && npm run test:e2e

# Run E2E tests with UI (interactive mode)
e2e-ui:
  cd frontend && npm run test:e2e:ui

# Run E2E tests with browser visible
e2e-headed:
  cd frontend && npm run test:e2e:headed

# Debug E2E tests (step-through mode)
e2e-debug:
  cd frontend && npm run test:e2e:debug

# Show E2E test report
e2e-report:
  cd frontend && npm run test:e2e:report

# Run specific E2E test file
e2e-test file:
  cd frontend && npx playwright test {{file}}

# === API Testing Commands (curl) ===
# Login and save token for API testing
api-login user="TestPlayer1":
  #!/usr/bin/env bash
  TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"{{user}}","password":"testpassword123"}' \
    | jq -r '.Token')
  echo "$TOKEN" > /tmp/api-token.txt
  echo "✅ Logged in as {{user}}"
  echo "Token saved to /tmp/api-token.txt"
  echo "Token: ${TOKEN:0:30}..."

# Login as GM and save token
api-login-gm:
  @just api-login TestGM

# Login as Player1 and save token
api-login-player:
  @just api-login TestPlayer1

# Test API health endpoint
api-health:
  @curl -sf http://localhost:3000/health && echo "✅ Backend is healthy" || echo "❌ Backend is down"

# Test if current token is valid
api-test-token:
  #!/usr/bin/env bash
  if [ ! -f /tmp/api-token.txt ]; then
    echo "❌ No token found. Run 'just api-login' first"
    exit 1
  fi
  RESPONSE=$(curl -s -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    http://localhost:3000/api/v1/auth/me)
  if echo "$RESPONSE" | jq -e '.username' > /dev/null 2>&1; then
    USERNAME=$(echo "$RESPONSE" | jq -r '.username')
    echo "✅ Token is valid for user: $USERNAME"
  else
    echo "❌ Token is invalid or expired. Run 'just api-login' to get a new token"
  fi

# Get games list
api-games:
  #!/usr/bin/env bash
  if [ ! -f /tmp/api-token.txt ]; then
    echo "❌ No token found. Run 'just api-login' first"
    exit 1
  fi
  curl -s -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    http://localhost:3000/api/v1/games | jq '.'

# Get game details by ID (default: 164 - E2E Common Room Test Game)
api-game id="164":
  #!/usr/bin/env bash
  if [ ! -f /tmp/api-token.txt ]; then
    echo "❌ No token found. Run 'just api-login' first"
    exit 1
  fi
  curl -s -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    http://localhost:3000/api/v1/games/{{id}} | jq '.'

# Get characters in game (default: 164)
api-characters game_id="164":
  #!/usr/bin/env bash
  if [ ! -f /tmp/api-token.txt ]; then
    echo "❌ No token found. Run 'just api-login' first"
    exit 1
  fi
  curl -s -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    http://localhost:3000/api/v1/games/{{game_id}}/characters | jq '.'

# Get posts for game (default: 164)
api-posts game_id="164":
  #!/usr/bin/env bash
  if [ ! -f /tmp/api-token.txt ]; then
    echo "❌ No token found. Run 'just api-login' first"
    exit 1
  fi
  curl -s -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    http://localhost:3000/api/v1/games/{{game_id}}/posts | jq '.'

# Get comments for a post
api-comments post_id:
  #!/usr/bin/env bash
  if [ ! -f /tmp/api-token.txt ]; then
    echo "❌ No token found. Run 'just api-login' first"
    exit 1
  fi
  # Get game_id from the post first
  curl -s -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    http://localhost:3000/api/v1/games/164/posts/{{post_id}}/comments | jq '.'

# Create a test post with mentions
api-create-post game_id="164" character_id="1319" content="Test post with @Test Player 2 Character mention":
  #!/usr/bin/env bash
  if [ ! -f /tmp/api-token.txt ]; then
    echo "❌ No token found. Run 'just api-login' first"
    exit 1
  fi
  curl -s -X POST -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    -H "Content-Type: application/json" \
    http://localhost:3000/api/v1/games/{{game_id}}/posts \
    -d "{\"character_id\": {{character_id}}, \"content\": \"{{content}}\"}" | jq '.'

# Create a test comment with mentions
api-create-comment post_id character_id="1319" content="Test comment with @Test Player 2 Character":
  #!/usr/bin/env bash
  if [ ! -f /tmp/api-token.txt ]; then
    echo "❌ No token found. Run 'just api-login' first"
    exit 1
  fi
  curl -s -X POST -H "Authorization: Bearer $(cat /tmp/api-token.txt)" \
    -H "Content-Type: application/json" \
    http://localhost:3000/api/v1/games/164/posts/{{post_id}}/comments \
    -d "{\"character_id\": {{character_id}}, \"content\": \"{{content}}\"}" | jq '.'

# Test character mentions feature end-to-end
api-test-mentions:
  #!/usr/bin/env bash
  echo "=== Testing Character Mentions Feature ==="
  echo ""

  # 1. Login
  echo "1. Logging in as TestPlayer1..."
  just api-login-player
  echo ""

  # 2. Get characters
  echo "2. Getting available characters..."
  just api-characters 164 | jq '.[] | {id, name}' | head -20
  echo ""

  # 3. Get latest post
  echo "3. Getting latest post..."
  POST_ID=$(just api-posts 164 | jq -r '.[0].id')
  echo "Latest post ID: $POST_ID"
  echo ""

  # 4. Create comment with mention
  echo "4. Creating comment with mention..."
  COMMENT=$(just api-create-comment "$POST_ID" 1319 "Hey @Test Player 2 Character, testing mentions!")
  echo "$COMMENT" | jq '.'
  echo ""

  # 5. Check if mentioned_character_ids is present
  echo "5. Checking mentioned_character_ids field..."
  MENTIONED_IDS=$(echo "$COMMENT" | jq '.mentioned_character_ids')
  if [ "$MENTIONED_IDS" != "null" ] && [ "$MENTIONED_IDS" != "[]" ]; then
    echo "✅ mentioned_character_ids found: $MENTIONED_IDS"
  else
    echo "❌ mentioned_character_ids is missing or empty: $MENTIONED_IDS"
  fi

# Quick API status check
api-status:
  @echo "=== API Status Check ==="
  @just api-health
  @echo ""
  @echo "=== Token Status ==="
  @just api-test-token || echo "No valid token"

# === Development Workflows ===

# Complete setup for new developers
dev-setup: db_setup tidy
  @echo "Setting up development environment..."
  @echo "Creating .env file if it doesn't exist..."
  @if [ ! -f .env ]; then cp .env.example .env; echo "✓ Created .env from .env.example"; fi
  @echo ""
  @echo "🎉 Development environment setup complete!"
  @echo ""
  @echo "Next steps:"
  @echo "  1. Review and customize .env file if needed"
  @echo "  2. Run migrations: just migrate"
  @echo "  3. Start development: just dev"

# Quick development startup with environment validation
dev:
  @echo "Starting ActionPhase development environment..."
  @echo "📋 Checking environment..."
  @if [ ! -f .env ]; then echo "❌ .env file not found. Run 'just dev-setup' first."; exit 1; fi
  @echo "✓ .env file found"
  @echo "✓ Starting database..."
  @just db_up
  @sleep 2
  @echo "✓ Database running"
  @echo ""
  @echo "🚀 Starting backend server..."
  @echo "   Backend: http://localhost:3000"
  @echo "   Database: localhost:5432"
  @echo ""
  @echo "Press Ctrl+C to stop"
  cd backend && go run main.go

# Full development environment with frontend
dev-full: db_up
  @echo "Starting full development environment..."
  @echo "Backend: http://localhost:3000"
  @echo "Frontend: http://localhost:5173"
  @echo "Press Ctrl+C to stop all services"
  @trap 'kill 0' SIGINT; \
  (cd backend && go run main.go) & \
  (cd frontend && npm run dev) & \
  wait

ci-test: lint test test-race
  @echo "CI test suite complete"

ci-build: build build-frontend
  @echo "CI build complete"

# Run full test suite (backend + frontend)
full-test: ci-test test-frontend
  @echo "Full test suite complete"

# Run all tests (backend + frontend, no race detection)
test-all: test test-frontend
  @echo "All tests complete"

# === Cleanup Commands ===
clean: test-clean
  cd backend && go clean
  cd frontend && rm -rf node_modules/.cache dist
  @echo "Cleanup complete"

# === Quick Commands ===
quick-test:
  cd backend && go test -short ./...

# Complete system status check
status:
  @echo "═══════════════════════════════════════════════════════════"
  @echo "            ActionPhase System Status"
  @echo "═══════════════════════════════════════════════════════════"
  @echo ""
  @echo "=== Services ==="
  @just ps-backend
  @echo ""
  @just ps-frontend
  @echo ""
  @echo "=== Database ==="
  @if docker ps | grep -q actionphase-db; then \
    echo "✅ Database container is running"; \
  else \
    echo "❌ Database container is not running"; \
  fi
  @echo ""
  @just migrate_status || echo "Database connection failed"
  @echo ""
  @echo "=== Git Status ==="
  @git status --short | head -10
  @echo ""
  @echo "═══════════════════════════════════════════════════════════"

# Restart both backend and frontend
restart-all:
  @echo "🔄 Restarting all services..."
  @just restart-backend
  @echo ""
  @just restart-frontend
  @echo ""
  @echo "✅ All services restarted!"

# Kill all development processes
kill-all:
  @echo "Stopping all services..."
  @just kill-backend
  @just kill-frontend
  @echo "✅ All services stopped"

# View all logs (last 20 lines from each)
logs-all:
  @echo "=== Backend Logs (last 20 lines) ==="
  @just logs-backend 20
  @echo ""
  @echo "=== Frontend Logs (last 20 lines) ==="
  @just logs-frontend 20

# Quick health check of all services
health:
  @echo "=== Health Check ==="
  @echo -n "Backend:  "
  @if curl -sf http://localhost:3000/health > /dev/null; then \
    echo "✅ Healthy"; \
  else \
    echo "❌ Down"; \
  fi
  @echo -n "Frontend: "
  @if curl -sf http://localhost:5173 > /dev/null; then \
    echo "✅ Healthy"; \
  else \
    echo "❌ Down"; \
  fi
  @echo -n "Database: "
  @if docker ps | grep -q actionphase-db; then \
    echo "✅ Running"; \
  else \
    echo "❌ Down"; \
  fi
