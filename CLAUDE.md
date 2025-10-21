# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AI Context Directory

**IMPORTANT: Before performing specific coding tasks, read the relevant context files from `.claude/context/`**

The `.claude/` directory contains organized AI context and instructions:
- **`.claude/README.md`** - Complete index of all AI context and documentation
- **`.claude/context/`** - Essential context to read before specific tasks
- **`.claude/reference/`** - Detailed implementation guides
- **`.claude/commands/`** - Custom slash commands
- **`.claude/planning/`** - Persistent planning documents and multi-session task tracking

### When to Read Context Files

**Before Writing ANY Tests**:
1. Read **`.claude/context/TESTING.md`** for testing philosophy and patterns
2. Review **`/docs/testing/COVERAGE_STATUS.md`** for current coverage status
3. Reference **`/docs/adrs/007-testing-strategy.md`** for strategy details
4. Check **`.claude/context/TEST_DATA.md`** when using test fixtures

**⚠️ BEFORE WRITING E2E TESTS - CRITICAL**:
**E2E tests are the LAST step, NEVER the first!** Follow the test pyramid:
1. ✅ Backend unit test passes
2. ✅ API endpoint returns correct data (verify with curl)
3. ✅ Frontend component test passes
4. ✅ System verification complete (backend + frontend running)
5. **THEN** write E2E test

**See `.claude/context/TESTING.md` section "E2E Tests (Playwright)" for mandatory checklist.**

**Before Implementing Features**:
1. Read **`.claude/context/ARCHITECTURE.md`** for architectural patterns
2. Review relevant ADRs in **`/docs/adrs/`** for architectural decisions
3. Check **`/docs/architecture/`** for system design context

**Before Frontend State Work**:
1. Read **`.claude/context/STATE_MANAGEMENT.md`** for state management patterns (quick reference)
2. Review **`/docs/features/STATE_MANAGEMENT.md`** for comprehensive guide
3. Check **`/docs/adrs/005-frontend-state-management.md`** for architecture decisions

**Before Working with Test Data**:
1. Read **`.claude/context/TEST_DATA.md`** for fixture overview
2. Review **`/docs/testing/TEST_DATA.md`** for detailed fixture documentation
3. Check **`/backend/pkg/db/test_fixtures/`** for actual SQL files

**Before E2E Testing**:
1. Review **`.claude/planning/E2E_TESTING_PLAN.md`** for complete implementation plan (AI-focused)
2. Check **`/docs/testing/E2E_QUICK_START.md`** for quick reference and commands (developer reference)
3. Reference **`.claude/planning/FEATURE_PLAN_TEMPLATE.md`** section 4.4 for E2E requirements in new features

### Context File Quick Reference

- **TESTING.md** - Testing philosophy, coverage status, patterns, commands
- **ARCHITECTURE.md** - Clean Architecture patterns, request flow, key files
- **STATE_MANAGEMENT.md** - React Query, AuthContext, common patterns
- **TEST_DATA.md** - Test fixtures, test users, game scenarios

**See `.claude/README.md` for complete documentation index and workflow guides.**

---

## Project Overview

ActionPhase is a modern gaming platform with Clean Architecture principles:

- **Go Backend**: JWT-based API using Chi router, PostgreSQL with sqlc
- **React Frontend**: React/TypeScript SPA with Vite, Tailwind CSS, React Query
- **Database**: PostgreSQL with hybrid relational-document design (JSONB for game data)
  - **CRITICAL**: Database name is **`actionphase`**, NOT `database`
  - All PostgreSQL connections MUST use: `postgres://postgres:example@localhost:5432/actionphase`
  - The justfile commands use the correct `actionphase` database

### Core Principles
- **Interface-First Development** - Define interfaces before implementation
- **Domain-Driven Design** - Clear bounded contexts (auth, games, characters, phases)
- **Test-Driven Development** - Write tests before/alongside features
- **Observability-First** - Structured logging with correlation IDs

### Technology Stack
- **Backend**: Go, Chi, PostgreSQL, sqlc, golang-migrate
- **Frontend**: React, TypeScript, Vite, React Query, Tailwind CSS
- **Auth**: JWT + Refresh Tokens with server-side sessions

**For architectural details, read `.claude/context/ARCHITECTURE.md`**

---

## Quick Start Commands

### Environment Setup
```bash
# Complete setup (database + environment + dependencies)
just dev-setup

# Apply database migrations
just migrate

# Start development server
just dev
```

### Development Workflow

**Backend Development**:
```bash
just dev                      # Start backend with .env loading
just sqlgen                   # Generate Go code from SQL queries
just test                     # Run all tests
just test-mocks               # Fast unit tests (~300ms)
just ci-test                  # Full CI test suite (lint + test + race)
```

**API Testing with curl**:
```bash
# ALWAYS use this pattern for authenticated API requests:
curl -s -H "Authorization: Bearer $(cat /tmp/api-token.txt)" "http://localhost:3000/api/v1/endpoint" | jq '.'

# Login first to get token:
./scripts/api-test.sh login-player  # Token saved to /tmp/api-token.txt

# See scripts/api-test.sh for reference patterns
```

**Frontend Development**:
```bash
just run-frontend             # Start development server
just test-frontend            # Run frontend tests
just test-frontend-watch      # Watch mode for development
```

**Database Management**:
```bash
just make_migration <name>    # Create new migration
just migrate                  # Apply migrations to actionphase database
just migrate_test             # Apply migrations to test database

# ⚠️ CRITICAL: Always use 'actionphase' database name
# Correct:   postgres://postgres:example@localhost:5432/actionphase
# WRONG:     postgres://postgres:example@localhost:5432/database
```

**For complete command reference, see justfile or run `just --list`**

---

## Testing Requirements

**Tests are MANDATORY for all new features and bug fixes.**

### Quick Testing Guide

**Test Pyramid (Bottom to Top)**:
```
4. E2E Tests (Playwright)          ← Slow, expensive, LAST
   ↑
3. Component Tests (React)          ← Medium speed
   ↑
2. API Integration Tests (curl)     ← Fast verification
   ↑
1. Unit Tests (Go/TypeScript)       ← Fastest, FIRST
```

**Backend**:
- Unit tests with mocks: `just test-mocks` (FAST - run first)
- Integration tests with DB: `SKIP_DB_TESTS=false just test`
- API verification: `curl http://localhost:3000/api/v1/endpoint | jq`
- Target: >80% coverage on service layer

**Frontend**:
- Component tests: `just test-frontend` (run before E2E)
- Watch mode: `just test-frontend-watch`
- Test user interactions, not implementation

**E2E Tests**:
- **ONLY after unit + API + component tests pass**
- Run synchronously: `npx playwright test --reporter=list` (NO `&`)
- One concern per test
- Use `data-testid` selectors, not class names
- See `.claude/context/TESTING.md` E2E section for rules

### Bug Fix Process (Mandatory)
1. Write test that reproduces bug (should fail)
2. Fix the bug
3. Verify test passes
4. Commit test and fix together

**For detailed testing patterns and requirements, read `.claude/context/TESTING.md`**

---

## Development Patterns

### Integrated Feature Development

**Implement BOTH backend and frontend together before moving to next feature.**

**Backend Flow**:
1. Database migration (if needed) → `just make_migration <name>`
2. SQL queries → `backend/pkg/db/queries/*.sql`
3. Generate code → `just sqlgen`
4. Define interface → `backend/pkg/core/interfaces.go`
5. **Write tests first** → `*_test.go`
6. Implement service → `backend/pkg/db/services/*.go`
7. Implement handler → `backend/pkg/*/api.go`
8. Run tests → `just test`

**Frontend Flow**:
1. API client method → `frontend/src/lib/api.ts`
2. Custom hooks → `frontend/src/hooks/*.ts`
3. **Write hook tests** → `*.test.ts`
4. Implement components → `frontend/src/components/*.tsx`
5. **Write component tests** → `*.test.tsx`
6. Run tests → `just test-frontend`

**Then**: Test complete feature in UI before moving on

**For architectural patterns and best practices, read `.claude/context/ARCHITECTURE.md`**

---

## Key Files Reference

### Backend Core
- `backend/pkg/core/interfaces.go` - All service interfaces
- `backend/pkg/core/models.go` - Domain models
- `backend/pkg/http/root.go` - API routing and middleware
- `backend/pkg/db/queries/` - SQL queries (generates code via sqlc)
- `backend/pkg/db/services/` - Service implementations
  - `phases/` - Phase service (decomposed into 6 focused files)
  - `actions/` - Action submission service (decomposed into 5 files)
  - `messages/` - Message service (decomposed into 6 files)
  - Other services (games, characters, users, sessions, notifications)

### Frontend Core
- `frontend/src/lib/api.ts` - API client with JWT interceptors
- `frontend/src/contexts/AuthContext.tsx` - Centralized auth state
- `frontend/src/App.tsx` - Application setup
- `frontend/src/hooks/` - Custom hooks
- `frontend/src/components/` - React components

### Configuration
- `.env` - Environment variables (local development)
- `.env.example` - Environment variable template
- `justfile` - Development commands
- `backend/pkg/db/migrations/` - Database migrations

---

## Documentation Index

### Essential Context (Read Before Coding)
- **`.claude/context/TESTING.md`** - Testing patterns and requirements
- **`.claude/context/ARCHITECTURE.md`** - Architectural patterns
- **`.claude/context/STATE_MANAGEMENT.md`** - Frontend state management
- **`.claude/context/TEST_DATA.md`** - Test fixtures and data

### Architecture Decision Records (ADRs)
Location: `/docs/adrs/`

- **ADR-001**: Technology Stack Selection
- **ADR-002**: Database Design Approach
- **ADR-003**: Authentication Strategy
- **ADR-004**: API Design Principles
- **ADR-005**: Frontend State Management
- **ADR-006**: Observability Approach
- **ADR-007**: Testing Strategy

### System Design Documentation
Location: `/docs/architecture/`

- **SYSTEM_ARCHITECTURE.md** - Complete system design
- **COMPONENT_INTERACTIONS.md** - How components communicate
- **SEQUENCE_DIAGRAMS.md** - Visual process flows

### Reference Documentation
Location: `.claude/reference/`

- **BACKEND_ARCHITECTURE.md** - Detailed backend guide
- **API_DOCUMENTATION.md** - API endpoint documentation
- **TESTING_GUIDE.md** - Implementation testing guide
- **LOGGING_STANDARDS.md** - Logging best practices
- **ERROR_HANDLING.md** - Error handling patterns

### Current Status & Testing
- **`.claude/planning/MVP_STATUS.md`** - Current MVP implementation status and development plan
- **`.claude/planning/E2E_TESTING_PLAN.md`** - E2E testing implementation plan (AI-focused)
- **`/docs/testing/COVERAGE_STATUS.md`** - Test coverage status and recommendations
- **`/docs/testing/TEST_DATA.md`** - Detailed test fixture documentation
- **`/docs/testing/E2E_QUICK_START.md`** - Quick reference for E2E testing (developer reference)
- **`/frontend/TESTING_NOTES.md`** - Frontend testing notes and intentionally untested components

---

## Coding Standards (Quick Reference)

### Go Backend
- Define interfaces in `backend/pkg/core/interfaces.go` FIRST
- Use compile-time verification: `var _ Interface = (*Implementation)(nil)`
- Co-locate tests with implementation: `*_test.go`
- Use table-driven tests for multiple scenarios
- Mock dependencies using interfaces
- Document all public functions

### TypeScript Frontend

**Component Structure:**
- Enable TypeScript strict mode
- One component per file
- Co-locate tests: `ComponentName.test.tsx`
- Test user interactions, not implementation details
- Use React Testing Library with `screen` queries
- Type all API client methods

**Styling & Theming (CRITICAL - Dark Mode Support):**

⚠️ **ALWAYS use the UI Component Library** (`@/components/ui`) for consistent dark mode support
❌ **NEVER use hardcoded Tailwind colors** or native HTML elements for interactive components

**UI Component Library Reference:**

```tsx
// ❌ WRONG - Native HTML with manual styling
<div className="bg-white border border-gray-200 rounded-lg p-4">
  <input className="border border-gray-300 px-3 py-2 rounded" />
  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
    Submit
  </button>
</div>

// ✅ CORRECT - UI Component Library
import { Card, CardBody, Input, Button } from '@/components/ui';

<Card variant="default" padding="md">
  <CardBody>
    <Input label="Email" type="email" placeholder="Enter email" />
    <Button variant="primary">Submit</Button>
  </CardBody>
</Card>
```

**Available UI Components:**

**Layout Components:**
- `<Card variant="default|elevated|bordered">` - Container with sections
- `<CardHeader>`, `<CardBody>`, `<CardFooter>` - Card sections

**Form Components:**
- `<Input label="..." />` - Text input with label and validation
- `<Textarea label="..." />` - Multi-line text input
- `<Select label="...">` - Dropdown select
- `<Checkbox label="..." />` - Checkbox with label
- `<Radio label="..." />` - Radio button
- `<DateTimeInput label="..." />` - Date/time picker
- `<Label required optional>` - Standalone form label

**Interactive Components:**
- `<Button variant="primary|secondary|danger|ghost">` - Action buttons
- `<Badge variant="primary|success|warning|danger">` - Status indicators
- `<Alert variant="info|success|warning|danger">` - Notification boxes
- `<Spinner size="sm|md|lg|xl">` - Loading indicator

**Common Patterns:**

```tsx
import { Card, CardHeader, CardBody, CardFooter, Input, Button, Badge } from '@/components/ui';

// Login Form
<Card variant="elevated" padding="md">
  <CardHeader>
    <h2>Sign In</h2>
  </CardHeader>
  <CardBody>
    <Input
      label="Email"
      type="email"
      placeholder="you@example.com"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />
    <Input
      label="Password"
      type="password"
      error={passwordError}
    />
  </CardBody>
  <CardFooter>
    <Button variant="primary" loading={isLoading}>
      Sign In
    </Button>
  </CardFooter>
</Card>

// Status Display
<div className="flex items-center gap-2">
  <Badge variant="success">Active</Badge>
  <Badge variant="warning" dot>Pending Review</Badge>
</div>

// Action Buttons
<div className="flex gap-2">
  <Button variant="primary" onClick={handleSave}>Save</Button>
  <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
  <Button variant="danger" onClick={handleDelete}>Delete</Button>
</div>

// Alert Messages
<Alert variant="success" title="Success!" dismissible onDismiss={closeAlert}>
  Your changes have been saved.
</Alert>
```

**Markdown/Prose Content:**

For markdown content, use the MarkdownPreview component:

```tsx
import { MarkdownPreview } from '@/components/MarkdownPreview';

<MarkdownPreview
  content={markdownText}
  mentionedCharacters={characters}  // Optional
/>
```

**When You Can't Use UI Components:**

For layout-only elements (flexbox containers, grids, etc.), use semantic CSS tokens:
- `bg-bg-primary`, `bg-bg-secondary` - Backgrounds
- `text-text-heading`, `text-text-primary` - Text colors
- `border-border-primary` - Borders

**Pre-Flight Checklist for New Components:**

Before committing any new React component, verify:
- [ ] Uses `<Button>` instead of `<button>`
- [ ] Uses `<Input>` instead of `<input>`
- [ ] Uses `<Card>` instead of manual `<div>` containers
- [ ] Uses `<Badge>` for status indicators
- [ ] Uses `<Alert>` for notifications
- [ ] Layout containers use `bg-bg-*` and `text-text-*` tokens
- [ ] Component tested in both light AND dark mode
- [ ] Markdown content uses MarkdownPreview component

**Testing Dark Mode:**
1. Navigate to `/settings`
2. Toggle between Light/Dark/System
3. Verify all text is readable
4. Verify all backgrounds adapt correctly
5. Visit `/theme-test` to see all components in action

**Full Documentation:** See `frontend/src/components/ui/README.md` for complete API reference

### General
- **Tests are MANDATORY** for all features and bug fixes
- Write tests BEFORE or ALONGSIDE implementation
- Descriptive names (no abbreviations)
- Follow language idioms (camelCase for TS, PascalCase for Go exports)
- No hardcoded secrets or configuration

**For complete coding standards, see context files in `.claude/context/`**

---

## Environment Variables

Key variables in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (change for production!)
- `ENVIRONMENT` - development/staging/production
- `LOG_LEVEL` - debug/info/warn/error
- `SKIP_DB_TESTS` - Skip database tests if "true"

---

## Common Workflows

### Adding a New Feature

**RECOMMENDED: Start with a feature plan**

1. **Create Feature Plan**
   - Copy **`.claude/planning/FEATURE_PLAN_TEMPLATE.md`** to `.claude/planning/FEATURE_[name].md`
   - Fill in all sections systematically (problem statement, design, API, tests, implementation phases)
   - Review plan before starting implementation
   - See `.claude/planning/README.md` for template usage guide

2. **Implementation** (following the plan):
   - Read **`.claude/context/ARCHITECTURE.md`** for patterns
   - Read **`.claude/context/TESTING.md`** for test requirements
   - Create database migration if needed
   - Implement backend with tests (TDD)
   - Implement frontend with tests
   - Test manually in UI
   - Update documentation

**Benefits of planning first:**
- ✅ Catches design issues before coding
- ✅ Ensures all architectural layers considered
- ✅ Documents business rules and edge cases
- ✅ Provides session continuity for complex features
- ✅ Creates rollback strategy upfront

### Fixing a Bug
1. Read **`.claude/context/TESTING.md`** for regression test requirements
2. Write test that reproduces bug (should fail)
3. Fix the bug
4. Verify test passes
5. Commit test and fix together

### Working with Test Data
1. Read **`.claude/context/TEST_DATA.md`** for fixture overview
2. Apply fixtures: `./backend/pkg/db/test_fixtures/apply_all.sh`
3. Login as test user: `test_gm@example.com` / `testpassword123`
4. Use Game #2 for action testing, Game #6 for pagination

### Updating Database Schema
1. Create migration: `just make_migration <name>`
2. Write both `.up.sql` and `.down.sql`
3. Update queries in `backend/pkg/db/queries/`
4. Regenerate code: `just sqlgen`
5. Update tests
6. Apply migration: `just migrate`

---

## Maintaining AI Context

**IMPORTANT: After making significant changes, update the `.claude/` context files to keep them current.**

### When to Update Context Files

**After implementing new patterns or architectural changes**:
- Update **`.claude/context/ARCHITECTURE.md`** with new patterns
- Document new interfaces, handlers, or request flows
- Add examples if introducing a new architectural concept

**After adding or changing test infrastructure**:
- Update **`.claude/context/TESTING.md`** with new test patterns
- Document new test utilities or fixtures
- Update coverage status if significantly changed

**After state management changes**:
- Update **`.claude/context/STATE_MANAGEMENT.md`** with new patterns
- Document new hooks, contexts, or query patterns
- Add anti-patterns if discovered through bug fixes

**After adding/modifying test fixtures**:
- Update **`.claude/context/TEST_DATA.md`** with new test scenarios
- Document new test users, games, or data patterns
- Update fixture usage examples

**After major refactors**:
- Update relevant ADRs in **`/docs/adrs/`** if decisions changed
- Add "Recent Changes" sections to context files with date
- Update **`.claude/planning/MVP_STATUS.md`** with current implementation status

### What to Update

**In Context Files** (`.claude/context/`):
- ✅ Current patterns and best practices
- ✅ Recent architectural changes (with dates)
- ✅ New anti-patterns discovered
- ✅ Updated examples reflecting current code
- ✅ Coverage status and test counts

**In Reference Files** (`.claude/reference/`):
- ✅ Detailed implementation guides
- ✅ API documentation for new endpoints
- ✅ Logging standards if changed
- ✅ Error handling patterns

**In ADRs** (`/docs/adrs/`):
- ✅ Add new ADRs for major architectural decisions
- ✅ Update existing ADRs if decisions evolved
- ✅ Add "Recent Architectural Evolution" sections (like ADR-005)

### Example: After Frontend State Refactor

```markdown
When we completed the AuthContext centralization refactor:
1. ✅ Updated .claude/context/STATE_MANAGEMENT.md with new patterns
2. ✅ Updated /docs/adrs/005-frontend-state-management.md with evolution section
3. ✅ Updated `.claude/planning/MVP_STATUS.md` with completion status
4. ✅ Documented isCheckingAuth pattern to prevent future bugs
```

### Quick Checklist After Major Changes

- [ ] Updated relevant context file in `.claude/context/`
- [ ] Added date to "Recent Changes" if applicable
- [ ] Updated code examples to reflect current patterns
- [ ] Documented new anti-patterns or gotchas discovered
- [ ] Updated ADRs if architectural decisions changed
- [ ] Verified all references and links still work

**Keeping context files current ensures consistent code quality and prevents pattern drift.**

---

## Getting Help

- **Project Setup**: See `/docs/getting-started/DEVELOPER_ONBOARDING.md` (30-minute guide)
- **Architecture Questions**: Read `/docs/architecture/SYSTEM_ARCHITECTURE.md`
- **Testing Questions**: Read `.claude/context/TESTING.md` and `/docs/testing/COVERAGE_STATUS.md`
- **E2E Testing**: Read `.claude/planning/E2E_TESTING_PLAN.md` (implementation plan) or `/docs/testing/E2E_QUICK_START.md` (quick reference)
- **State Management**: Read `.claude/context/STATE_MANAGEMENT.md` or `/docs/features/STATE_MANAGEMENT.md`
- **All Documentation**: See `.claude/README.md` for complete index

---

## Critical Reminders

1. **Read context files BEFORE coding** - They contain essential patterns and requirements
2. **Tests are mandatory** - No PRs without tests
3. **Bug fixes need regression tests** - Always write the test first
4. **Implement features end-to-end** - Backend + frontend together
5. **Follow established patterns** - Consistency is key for AI comprehension
6. **Check ADRs for decisions** - Understand the "why" behind architectural choices
7. **Update context files after changes** - Keep `.claude/context/` current with new patterns

**For detailed guidance on any topic, start with `.claude/README.md`**
