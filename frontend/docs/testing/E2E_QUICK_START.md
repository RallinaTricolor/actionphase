# E2E Testing Quick Start

**Quick reference for running end-to-end tests in ActionPhase**

For the complete implementation plan and architecture details, see `.claude/planning/E2E_TESTING_PLAN.md`.

---

## Prerequisites

Before running E2E tests, ensure:

1. **Database is running**
   ```bash
   just db_up
   ```

2. **Test fixtures are loaded**
   ```bash
   just test-fixtures
   ```

3. **Backend server is running**
   ```bash
   just dev
   # Or in a separate terminal:
   cd backend && go run main.go
   ```

The **frontend dev server will be auto-started** by Playwright when you run E2E tests.

---

## Running E2E Tests

### Quick Commands

```bash
# Run all E2E tests (headless)
just e2e

# Run with UI (interactive mode) - RECOMMENDED for development
just e2e-ui

# Run with visible browser
just e2e-headed

# Debug tests (step-through mode)
just e2e-debug

# Show HTML test report
just e2e-report

# Run specific test file
just e2e-test e2e/auth/login.spec.ts
```

---

## Test Users

All test users have the password: **`testpassword123`**

| Role | Email | Purpose |
|------|-------|---------|
| GM | `test_gm@example.com` | Game master |
| Player 1-5 | `test_player1@example.com` | Players |
| Audience | `test_audience@example.com` | Audience member |

---

## Current Test Coverage

### ✅ Implemented

**Journey 1: User Authentication** (`e2e/auth/login.spec.ts`)
- Login and logout flows
- Invalid credentials handling
- Protected route redirects
- Auth persistence

---

## Resources

- **Implementation Plan**: `.claude/planning/E2E_TESTING_PLAN.md`
- **Playwright Docs**: https://playwright.dev/docs/intro
- **Test Helpers**: `frontend/e2e/fixtures/`
