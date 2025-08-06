help:
  @just --list

# === Database Commands ===
db_up:
  docker-compose up -d db

db_down:
  docker-compose down db

db_reset: db_down db_up
  @echo "Database reset complete"

# === Code Generation ===
sqlgen:
  cd backend/pkg/db && sqlc generate

# === Migration Commands ===
make_migration name:
  migrate create -ext sql -dir backend/pkg/db/migrations {{name}}

migrate:
  migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/database?sslmode=disable" up

rollback:
  migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/database?sslmode=disable" down

migrate_status:
  migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/database?sslmode=disable" version

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

# === Backend Testing Commands ===
test:
  cd backend && go test ./...

test-verbose:
  cd backend && go test -v ./...

# Fast unit tests using mocks (no database required)
test-mocks:
  cd backend && SKIP_DB_TESTS=true go test -v -run "Mock" ./pkg/core/

# Integration tests with database (requires PostgreSQL)
test-integration:
  cd backend && go test -v ./pkg/auth/ ./pkg/core/

# All tests in parallel for maximum speed
test-parallel:
  cd backend && go test -parallel 4 ./...

# Run only mock tests without database dependencies
test-no-db:
  cd backend && go test -tags="!integration" ./pkg/core/

test-coverage:
  cd backend && go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out -o coverage.html

test-race:
  cd backend && go test -race ./...

test-bench:
  cd backend && go test -bench=. ./...

test-service service:
  cd backend && go test -v ./pkg/db/services/{{service}}_test.go ./pkg/db/services/{{service}}.go

test-clean:
  cd backend && rm -f coverage.out coverage.html

# Test database setup for integration tests
test-db-setup:
  @echo "Creating test database..."
  createdb actionphase_test || echo "Database may already exist"
  @echo "Test database ready"

# === Frontend Commands ===
install-frontend:
  cd frontend && npm install

run-frontend:
  cd frontend && npm run dev

build-frontend:
  cd frontend && npm run build

preview-frontend:
  cd frontend && npm run preview

# === Frontend Testing Commands ===
setup-frontend-tests:
  @echo "Setting up frontend testing (Vitest + React Testing Library)..."
  cd frontend && npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
  @echo "Frontend testing setup complete. Run 'just test-frontend' to run tests."

test-frontend:
  @cd frontend && if npm run test >/dev/null 2>&1; then npm run test; else echo "Frontend tests not configured. Run 'just setup-frontend-tests' first."; fi

test-frontend-watch:
  @cd frontend && if npm run test:watch >/dev/null 2>&1; then npm run test:watch; else echo "Frontend tests not configured. Run 'just setup-frontend-tests' first."; fi

test-frontend-coverage:
  @cd frontend && if npm run test:coverage >/dev/null 2>&1; then npm run test:coverage; else echo "Frontend tests not configured. Run 'just setup-frontend-tests' first."; fi

lint-frontend:
  cd frontend && npm run lint

# === Development Workflows ===
dev-setup: db_up install-frontend tidy
  @echo "Development environment setup complete"

dev: db_up
  @echo "Starting development servers..."
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

full-test: ci-test
  @echo "Running full test suite..."
  @cd frontend && if npm run test >/dev/null 2>&1; then npm run test; else echo "Skipping frontend tests (not configured)"; fi
  @echo "Full test suite complete"

# === Cleanup Commands ===
clean: test-clean
  cd backend && go clean
  cd frontend && rm -rf node_modules/.cache dist
  @echo "Cleanup complete"

# === Quick Commands ===
quick-test:
  cd backend && go test -short ./...

status:
  @echo "=== Git Status ==="
  git status --short
  @echo ""
  @echo "=== Database Status ==="
  -just migrate_status
  @echo ""
  @echo "=== Go Modules ==="
  cd backend && go list -m all | head -5
  @echo "..."
