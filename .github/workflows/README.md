# GitHub Actions CI/CD

This directory contains GitHub Actions workflows for automated pre-merge checks.

## Workflows

### CI Workflow (ci.yml)

Runs on all pushes and pull requests to `master` and `go_rewrite` branches.

**Jobs:**

1. **backend-lint** - Backend code quality checks
   - Go format check (`gofmt`)
   - Go vet analysis
   - Runs on: `ubuntu-latest`
   - Go version: 1.24.0

2. **backend-test** - Backend testing with PostgreSQL
   - Sets up PostgreSQL 16 service container
   - Creates test database and runs migrations
   - Runs mock tests (fast, parallel)
   - Runs integration tests (with database, sequential)
   - Runs race detector tests
   - Runs on: `ubuntu-latest` with PostgreSQL service
   - Go version: 1.24.0

3. **frontend-lint** - Frontend code quality checks
   - ESLint linting
   - TypeScript type checking (`tsc --noEmit`)
   - Runs on: `ubuntu-latest`
   - Node version: 20

4. **frontend-test** - Frontend unit testing
   - Vitest unit tests
   - Runs on: `ubuntu-latest`
   - Node version: 20

5. **build-check** - Final build verification
   - Runs after all other jobs pass
   - Builds backend (`go build`)
   - Builds frontend (`npm run build`)
   - Ensures production builds succeed

## Caching

The workflow uses caching to speed up builds:
- **Go modules**: Cached via `setup-go` action (backend/go.sum)
- **npm packages**: Cached via `setup-node` action (frontend/package-lock.json)

## What's NOT Included

As requested, the following are handled locally and NOT in CI:
- Docker image builds
- Deployments
- Coverage reports
- Artifact uploads

**Note**: E2E tests run separately on main branch push (see `e2e.yml`)

## Local Testing

To verify changes will pass CI before pushing:

```bash
# Backend
just lint          # Format + vet
just test-mocks    # Fast unit tests
just test          # Full test suite with database

# Frontend
just lint-frontend # ESLint
cd frontend && npx tsc --noEmit  # Type check
just test-frontend # Unit tests

# Build check
just build-all all # Backend + frontend builds
```

## Workflow Triggers

- **Push**: Runs on pushes to `master` and `go_rewrite` branches
- **Pull Request**: Runs on PRs targeting `master` and `go_rewrite` branches

## Job Dependencies

```
backend-lint ──┐
backend-test ──┤
frontend-lint ─┼──> build-check
frontend-test ─┘
```

All lint and test jobs run in parallel. Build check only runs if all previous jobs succeed.

## Troubleshooting

### Workflow fails on format check
Run `just fmt` locally to format Go code.

### Workflow fails on vet
Run `just vet` locally to see vet issues.

### Workflow fails on ESLint
Run `just lint-frontend` locally to see linting errors.

### Workflow fails on TypeScript check
Run `cd frontend && npx tsc --noEmit` locally to see type errors.

### Workflow fails on tests
Run `just test` (backend) or `just test-frontend` (frontend) locally.

### Workflow fails on migration
Ensure all migration files in `backend/pkg/db/migrations/` are valid and run in order.
