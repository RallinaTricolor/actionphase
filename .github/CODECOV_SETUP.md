# Codecov Setup Instructions

This project uses Codecov for code coverage tracking and reporting.

## Initial Setup

1. **Sign up for Codecov** (if you haven't already):
   - Go to https://codecov.io
   - Sign in with your GitHub account
   - Authorize Codecov to access your repositories

2. **Add the repository**:
   - Navigate to https://app.codecov.io/gh/{YOUR_USERNAME}
   - Click "Add new repository"
   - Find and select `actionphase`

3. **Get the upload token**:
   - Once added, go to the repository settings in Codecov
   - Copy the "Repository Upload Token"

4. **Add the token to GitHub Secrets**:
   - Go to your GitHub repository settings
   - Navigate to: Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `CODECOV_TOKEN`
   - Value: Paste the token from Codecov
   - Click "Add secret"

## What's Configured

### Coverage Reports
- **Backend**: Go coverage from integration tests
- **Frontend**: Vitest coverage from unit tests

### PR Comments
Codecov will automatically comment on pull requests with:
- Overall coverage change (±%)
- Coverage of changed files
- Coverage of new code (patch coverage)
- Detailed diff showing which lines are covered

### Coverage Requirements
- **Project Coverage**: Must stay within 1% of current coverage
- **Patch Coverage**: New code must have at least 80% coverage
- **Threshold**: PRs can drop coverage by up to 1% without failing

### Badges
Add these badges to your README.md:

```markdown
[![codecov](https://codecov.io/gh/{YOUR_USERNAME}/actionphase/branch/master/graph/badge.svg)](https://codecov.io/gh/{YOUR_USERNAME}/actionphase)
```

Replace `{YOUR_USERNAME}` with your actual GitHub username.

## Configuration Files

- **`.github/workflows/ci.yml`**: Generates coverage and uploads to Codecov
- **`codecov.yml`**: Configures coverage requirements and PR comments
- **`justfile`**: Local `test-coverage` command for development

## Local Coverage Testing

```bash
# Backend coverage
just test-coverage

# View coverage report
cd backend && go tool cover -html=coverage.out

# Frontend coverage
cd frontend && npm run test:coverage
```

## Viewing Coverage Reports

1. **On Codecov Dashboard**:
   - Visit https://app.codecov.io/gh/{YOUR_USERNAME}/actionphase
   - View sunburst charts, file coverage, and trends

2. **On Pull Requests**:
   - Codecov bot will comment with coverage changes
   - Click "View on Codecov" for detailed report

3. **In CI Logs**:
   - Coverage summary is printed in GitHub Actions logs
   - Look for "Upload backend/frontend coverage to Codecov" steps

## Troubleshooting

**Coverage not uploading?**
- Check that `CODECOV_TOKEN` is set in repository secrets
- Verify the token is correct (regenerate if needed)
- Check GitHub Actions logs for upload errors

**Badge not showing?**
- Replace `{YOUR_USERNAME}` with your actual GitHub username
- Ensure the repository name is correct
- Try using the branch-specific badge URL

**Coverage too low?**
- Adjust thresholds in `codecov.yml`
- Focus on testing critical paths first
- Use `just test-coverage` to identify gaps

## Coverage Goals

**Current Status**: See badge in README

**Target Coverage**:
- Backend: >80% (focus on service layer and handlers)
- Frontend: >70% (focus on components and hooks)
- Overall: >75%

**Ignored from Coverage**:
- Test files (`*_test.go`, `*.test.tsx`)
- Test utilities and mocks
- E2E test files
- Embedded documentation assets
