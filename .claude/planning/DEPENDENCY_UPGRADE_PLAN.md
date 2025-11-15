# ActionPhase Dependency Upgrade Plan

> **Created**: November 14, 2024
> **Purpose**: Strategic plan for upgrading all frontend and backend dependencies after 8 years of development
> **Risk Level**: Medium - Active codebase with comprehensive test coverage provides safety net
> **Timeline**: 3-5 working days (23-34 hours)

## Executive Summary

### Current State Analysis
- **Frontend**: React 19 with modern tooling, but contains **4 security vulnerabilities** (1 high, 3 moderate)
- **Backend**: Go 1.23 with mostly current dependencies, deprecated AWS SDK v1 needs replacement
- **Test Coverage**: Comprehensive unit, integration, and E2E tests provide safety net for upgrades

### Key Security Issues Requiring Immediate Attention
1. **Axios 1.11.0** - High severity DoS vulnerability (CVE pending)
2. **PrismJS <1.30.0** - Moderate DOM clobbering vulnerability (via react-syntax-highlighter)
3. **AWS SDK v1** - Deprecated, security updates only in v2

### Upgrade Strategy
- **6-phase approach** over 3-5 days
- **Incremental rollout** with testing checkpoints
- **Git branching** for easy rollback
- **Risk-based prioritization** (security first, then stability)

---

## Phase 1: Critical Security Fixes
**Priority: CRITICAL** | **Risk: LOW** | **Duration: 2-4 hours** | **Day 1**

### Objectives
- Eliminate high severity Axios DoS vulnerability
- Fix PrismJS DOM clobbering vulnerability
- Establish testing baseline

### 1.1 Frontend Security Patches

```bash
cd /Users/jhouser/Personal/actionphase/frontend

# Create safety branch
git checkout -b upgrade-phase-1-security

# Fix Axios DoS vulnerability (non-breaking update)
npm update axios

# Fix PrismJS via react-syntax-highlighter upgrade (BREAKING - v15 → v16)
npm install react-syntax-highlighter@^16.1.0
```

### 1.2 Expected Breaking Changes

**react-syntax-highlighter v15 → v16:**
- May have different prop types
- Language names might change (e.g., 'js' vs 'javascript')
- Check `/src/components/MarkdownPreview.tsx` for usage

### 1.3 Testing Checklist

- [ ] Run frontend unit tests: `just test-frontend`
- [ ] Test markdown rendering with code blocks in:
  - Game messages
  - Character descriptions
  - Handout content
- [ ] Verify syntax highlighting colors work in dark mode
- [ ] Run smoke E2E tests: `npm run test:e2e:smoke`
- [ ] Check browser console for new warnings

### 1.4 Rollback Strategy

```bash
# If react-syntax-highlighter breaks
git checkout package.json package-lock.json
npm install

# Nuclear option
git checkout go_rewrite
git branch -D upgrade-phase-1-security
```

---

## Phase 2: Low-Risk Patch Updates
**Priority: HIGH** | **Risk: VERY LOW** | **Duration: 3-4 hours** | **Day 1-2**

### Objectives
- Update all packages with patch/minor versions available
- No breaking changes expected
- Improve overall dependency health

### 2.1 Frontend Patch Updates

```bash
cd /Users/jhouser/Personal/actionphase/frontend

# Update all minor versions (safe)
npm update @headlessui/react          # 2.2.7 → 2.2.9
npm update @tailwindcss/postcss       # 4.1.11 → 4.1.17
npm update @tanstack/react-query      # 5.84.1 → 5.90.9
npm update @testing-library/jest-dom  # 6.6.4 → 6.9.1
npm update @types/node                # 24.10.0 → 24.10.1
npm update @types/react               # 19.1.9 → 19.2.5
npm update @types/react-dom           # 19.1.7 → 19.2.3
npm update autoprefixer               # 10.4.21 → 10.4.22
npm update eslint                     # 9.32.0 → 9.39.1
npm update @eslint/js                 # 9.32.0 → 9.39.1
npm update eslint-plugin-react-refresh # 0.4.20 → 0.4.24
npm update globals                    # 16.3.0 → 16.5.0
npm update lucide-react               # 0.546.0 → 0.553.0
npm update msw                        # 2.11.5 → 2.12.2
npm update react                      # 19.1.1 → 19.2.0
npm update react-dom                  # 19.1.1 → 19.2.0
npm update react-datepicker           # 8.8.0 → 8.9.0
npm update react-router-dom           # 7.7.1 → 7.9.6
npm update tailwind-merge             # 3.3.1 → 3.4.0
npm update tailwindcss                # 4.1.11 → 4.1.17
npm update typescript-eslint          # 8.39.0 → 8.46.4
npm update vite                       # 7.0.6 → 7.2.2
```

### 2.2 Backend Patch Updates

```bash
cd /Users/jhouser/Personal/actionphase/backend

# Update Go modules to latest patches
go get -u github.com/go-chi/chi/v5@latest
go get -u github.com/go-chi/jwtauth/v5@latest
go get -u github.com/go-chi/render@latest
go get -u github.com/go-playground/validator/v10@latest
go get -u github.com/golang-jwt/jwt/v5@latest
go get -u github.com/google/uuid@latest
go get -u github.com/jackc/pgx/v5@latest
go get -u github.com/joho/godotenv@latest
go get -u github.com/lestrrat-go/jwx/v2@latest
go get -u github.com/rs/zerolog@latest
go get -u github.com/stretchr/testify@latest
go get -u golang.org/x/crypto@latest
go mod tidy
```

### 2.3 Testing Checklist

**Frontend:**
- [ ] Run all tests: `just test-frontend`
- [ ] Run linter: `npm run lint`
- [ ] Build production: `npm run build`
- [ ] Start dev server: `npm run dev`
- [ ] Test dark mode toggle
- [ ] Test data fetching (React Query)
- [ ] Test navigation (React Router)

**Backend:**
- [ ] Run unit tests: `just test-mocks`
- [ ] Run integration tests: `just ci-test`
- [ ] Test JWT auth: `./backend/scripts/api-test.sh login-player`
- [ ] Start server: `just dev`
- [ ] Test API endpoints with curl

### 2.4 Commit Checkpoint

```bash
# After successful testing
git add .
git commit -m "Phase 2: Update all patch/minor versions"
```

---

## Phase 3: Major Version Upgrades - Testing Tools
**Priority: MEDIUM** | **Risk: MEDIUM** | **Duration: 6-8 hours** | **Day 3-4**

### Objectives
- Upgrade core testing infrastructure
- May require test configuration changes
- Critical for maintaining test reliability

### 3.1 Vitest 3 → 4 Upgrade

**Pre-upgrade research:**
```bash
# Review migration guide
open https://vitest.dev/guide/migration.html

# Check current config
cat /Users/jhouser/Personal/actionphase/frontend/vitest.config.ts
```

**Upgrade:**
```bash
cd /Users/jhouser/Personal/actionphase/frontend
npm install vitest@^4.0.9 @vitest/coverage-v8@^4.0.9 --save-dev
```

**Expected breaking changes:**
1. Pool configuration (`pool: 'threads'` may need adjustment)
2. Timeout handling changes
3. Coverage reporter options
4. Globals configuration

**Files to review:**
- `/frontend/vitest.config.ts` - Main config
- `/frontend/src/setupTests.ts` - Test setup
- All `*.test.ts` and `*.test.tsx` files for deprecations

### 3.2 JSdom 26 → 27 Upgrade

```bash
npm install jsdom@^27.2.0 --save-dev
```

**Potential issues:**
- DOM API behavior changes
- localStorage/sessionStorage mock changes
- Focus/blur event handling

### 3.3 Testing Checklist

- [ ] Run all component tests: `just test-frontend`
- [ ] Run with coverage: `npm run test:coverage`
- [ ] Check for deprecation warnings
- [ ] Test watch mode: `npm run test:watch`
- [ ] Verify MSW (Mock Service Worker) works
- [ ] Test components with DOM interactions:
  - Modal focus trapping
  - Form submissions
  - React Router navigation

### 3.4 Rollback Strategy

```bash
# Rollback Vitest
npm install vitest@3.2.4 @vitest/coverage-v8@3.2.4 --save-dev

# Rollback JSdom
npm install jsdom@26.1.0 --save-dev

git checkout vitest.config.ts
```

---

## Phase 4: Major Version Upgrades - Development Tools
**Priority: MEDIUM** | **Risk: MEDIUM-HIGH** | **Duration: 6-10 hours** | **Day 5-6**

### Objectives
- Upgrade development and build tools
- May flag new linting issues
- Improve React 19 compatibility

### 4.1 ESLint React Hooks Plugin 5 → 7

```bash
cd /Users/jhouser/Personal/actionphase/frontend

# Check breaking changes
npm view eslint-plugin-react-hooks@7.0.1

# Upgrade
npm install eslint-plugin-react-hooks@^7.0.1 --save-dev
```

**Expected changes:**
- New React 19 hook rules
- Stricter dependency array checking
- May flag issues in existing hooks

**Files to review:**
- `/frontend/eslint.config.js`
- All files in `/frontend/src/hooks/*.ts`
- Components with `useEffect`, `useCallback`, `useMemo`

### 4.2 Vite Plugin React 4 → 5

```bash
npm install @vitejs/plugin-react@^5.1.1 --save-dev
```

**Expected changes:**
- Different React runtime handling
- Fast Refresh improvements
- May need vite.config.ts updates

### 4.3 Testing Checklist

- [ ] Run linter and fix new warnings: `npm run lint`
- [ ] Build production: `npm run build`
- [ ] Test Fast Refresh (edit component, save, verify update)
- [ ] Verify React DevTools work
- [ ] Run all tests: `just test-frontend`
- [ ] Run E2E smoke tests: `npm run test:e2e:smoke`

### 4.4 Common Issues and Fixes

**New ESLint warnings:**
```typescript
// Before (might now warn)
useEffect(() => {
  fetchData(id);
}, []); // Missing dependency

// After (fixed)
useEffect(() => {
  fetchData(id);
}, [id]); // Dependency added
```

---

## Phase 5: Backend Dependency Modernization
**Priority: MEDIUM** | **Risk: MEDIUM** | **Duration: 6-8 hours** | **Day 7-8**

### Objectives
- Replace deprecated AWS SDK v1 with v2
- Update migration tools
- Modernize cloud service integrations

### 5.1 AWS SDK v1 → v2 Migration

**Current usage analysis:**
```bash
# Find AWS SDK usage
grep -r "aws-sdk-go" /Users/jhouser/Personal/actionphase/backend/pkg
```

**Upgrade steps:**
```bash
cd /Users/jhouser/Personal/actionphase/backend

# Remove old SDK
go get github.com/aws/aws-sdk-go@none

# Install new SDK
go get github.com/aws/aws-sdk-go-v2@latest
go get github.com/aws/aws-sdk-go-v2/config@latest
go get github.com/aws/aws-sdk-go-v2/service/s3@latest
go get github.com/aws/aws-sdk-go-v2/service/ses@latest
go mod tidy
```

**Code changes required:**

```go
// Old (v1)
import "github.com/aws/aws-sdk-go/service/s3"
sess := session.Must(session.NewSession())
svc := s3.New(sess)

// New (v2)
import "github.com/aws/aws-sdk-go-v2/service/s3"
import "github.com/aws/aws-sdk-go-v2/config"
cfg, err := config.LoadDefaultConfig(context.TODO())
client := s3.NewFromConfig(cfg)
```

### 5.2 Migration Tool Update

```bash
go get -u github.com/golang-migrate/migrate/v4@latest
go mod tidy
```

### 5.3 Testing Checklist

- [ ] Run all backend tests: `just ci-test`
- [ ] Test S3 operations (if used):
  - Avatar uploads
  - File storage
- [ ] Test SES operations (if used):
  - Email sending
- [ ] Test migrations:
  - `just migrate status`
  - Fresh database migration
- [ ] Verify server starts: `just dev`
- [ ] Test API with authentication

### 5.4 Rollback Strategy

```bash
# Restore old AWS SDK
git checkout go.mod go.sum
go mod download
```

---

## Phase 6: Optional Future Upgrades
**Priority: LOW** | **Risk: LOW-MEDIUM** | **Duration: TBD** | **Future**

### 6.1 TypeScript 5.8 → 5.9

**Current:** 5.8.3 (pinned with `~5.8.3`)
**Latest:** 5.9.3

**When to upgrade:**
- When React 19 types require it
- When new TS 5.9 features needed
- After all other upgrades stable

```bash
# When ready
npm install typescript@^5.9.3 --save-dev
```

### 6.2 Remove Obsolete Type Packages

```bash
# react-router-dom v7 has built-in types
npm uninstall @types/react-router-dom
```

---

## Testing Strategy

### Create Baseline Before Starting

```bash
#!/bin/bash
# Save current test results as baseline

cd /Users/jhouser/Personal/actionphase/frontend
echo "=== Frontend Tests Baseline ===" > /tmp/upgrade-baseline.txt
npm run test 2>&1 | tee -a /tmp/upgrade-baseline.txt
echo -e "\n=== E2E Tests Baseline ===" >> /tmp/upgrade-baseline.txt
npm run test:e2e:smoke 2>&1 | tee -a /tmp/upgrade-baseline.txt

cd /Users/jhouser/Personal/actionphase/backend
echo -e "\n=== Backend Tests Baseline ===" >> /tmp/upgrade-baseline.txt
just ci-test 2>&1 | tee -a /tmp/upgrade-baseline.txt
```

### After Each Phase Testing

```bash
#!/bin/bash
# Comprehensive test after each phase

echo "Testing Phase $1..."

# Frontend
cd /Users/jhouser/Personal/actionphase/frontend
npm run lint
npm run build
npm run test
npm run test:e2e:smoke

# Backend
cd /Users/jhouser/Personal/actionphase/backend
just test-mocks
just ci-test

# Integration
curl http://localhost:3000/api/v1/ping
./backend/scripts/api-test.sh login-player
```

### Critical User Journey Tests

Manual testing checklist after each phase:

1. **Authentication Flow**
   - User registration
   - Login/logout
   - JWT refresh

2. **Game Management**
   - Create new game
   - Edit game settings
   - Join game as player
   - Join as audience

3. **Character System**
   - Create character
   - Character approval
   - Avatar upload

4. **Messaging**
   - Common room posts
   - Private messages
   - Markdown rendering

5. **Phase System**
   - Phase advancement
   - Action submission
   - Result publishing

6. **UI/UX**
   - Dark mode toggle
   - Mobile responsiveness
   - Form validation

---

## Rollback Strategy

### Git Workflow

```bash
# Before each phase
git checkout -b upgrade-phase-N
git add .
git commit -m "Pre-upgrade checkpoint: Phase N"

# After successful phase
git checkout go_rewrite
git merge upgrade-phase-N

# If rollback needed
git checkout go_rewrite
git branch -D upgrade-phase-N
```

### Package-Level Rollback

```bash
# Frontend - restore and reinstall
git checkout package.json package-lock.json
npm install

# Backend - restore and reinstall
git checkout go.mod go.sum
go mod download
```

### Emergency Full Rollback

```bash
# Complete rollback to pre-upgrade state
git reset --hard HEAD~N  # N = number of upgrade commits
cd frontend && npm install
cd ../backend && go mod download
```

---

## Risk Mitigation

### 1. Test Coverage Shield
- **Frontend**: ~80% component test coverage
- **Backend**: ~80% service layer coverage
- **E2E**: Critical user journeys covered
- **API**: Integration tests with curl scripts

### 2. Incremental Approach
- One phase at a time
- Test thoroughly between phases
- Git branches for isolation
- Easy rollback at any point

### 3. Monitoring Commands

```bash
# Check for deprecation warnings
npm run dev 2>&1 | grep -i "deprecat"
go build ./... 2>&1 | grep -i "deprecat"

# Security audit
npm audit
npm audit fix --dry-run  # Preview fixes

# Go security check
go list -m -u all | grep -i "retracted\|deprecated"
```

### 4. Documentation Updates

After completion, update:
- [ ] `.claude/context/TESTING.md` - If testing tools change
- [ ] `docs/getting-started/DEVELOPER_ONBOARDING.md` - If setup changes
- [ ] `justfile` - If commands change
- [ ] This document - With lessons learned

---

## Timeline and Resource Planning

### Phase Timeline

| Phase | Duration | Risk | Dependencies | Can Parallelize? |
|-------|----------|------|--------------|-----------------|
| Phase 1 | 2-4 hrs | LOW | None | No |
| Phase 2 | 3-4 hrs | VERY LOW | Phase 1 | Frontend/Backend |
| Phase 3 | 6-8 hrs | MEDIUM | Phase 2 | No |
| Phase 4 | 6-10 hrs | MEDIUM-HIGH | Phase 3 | No |
| Phase 5 | 6-8 hrs | MEDIUM | Phase 2 | Yes (with Phase 4) |
| Phase 6 | TBD | LOW-MEDIUM | All | Yes |

**Total:** 23-34 hours (3-5 working days)

### Recommended Schedule

**Week 1:**
- Monday: Phase 1 (Security) - Morning
- Monday: Phase 2 (Patches) - Afternoon
- Tuesday-Wednesday: Phase 3 (Testing tools)
- Thursday-Friday: Phase 4 (Dev tools)

**Week 2:**
- Monday-Tuesday: Phase 5 (Backend)
- Wednesday: Buffer for issues
- Thursday: Final validation
- Friday: Documentation updates

### Resource Requirements

- **Developer Time**: 1 person, 3-5 days
- **Testing Environment**: Staging recommended
- **Rollback Window**: 2-4 hours maximum
- **Database Backup**: Before starting Phase 1

---

## Success Criteria

### Phase Completion Checklist

Each phase is complete when:
- [ ] All tests pass (0 failures)
- [ ] No new linting errors
- [ ] Production build succeeds
- [ ] E2E smoke tests pass
- [ ] No console errors in dev mode
- [ ] Dark mode works correctly
- [ ] API endpoints respond (200 OK)
- [ ] Database migrations work
- [ ] Security audit clean

### Final Validation Script

```bash
#!/bin/bash
# Final validation after all phases

set -e  # Exit on error

echo "=== Frontend Validation ==="
cd /Users/jhouser/Personal/actionphase/frontend
npm run lint
npm run build
npm run test
npm run test:e2e:smoke
npm audit

echo "=== Backend Validation ==="
cd /Users/jhouser/Personal/actionphase/backend
just ci-test
go list -m -u all | head -20

echo "=== Integration Test ==="
# Start servers in background
cd /Users/jhouser/Personal/actionphase/backend
just dev &
BACKEND_PID=$!
sleep 5

cd /Users/jhouser/Personal/actionphase/frontend
npm run dev &
FRONTEND_PID=$!
sleep 5

# Test API
curl http://localhost:3000/api/v1/ping
./backend/scripts/api-test.sh login-player

# Cleanup
kill $BACKEND_PID $FRONTEND_PID

echo "✅ All validations passed!"
```

---

## Post-Upgrade Maintenance

### Monthly Checks

```bash
# Check for new updates
cd frontend && npm outdated
cd ../backend && go list -m -u all | head -20

# Security audit
npm audit
```

### Quarterly Reviews

- Review major version updates
- Plan next upgrade sprint
- Update this document with lessons learned

### CI/CD Integration

Consider adding to `.github/workflows/`:

```yaml
name: Dependency Check
on:
  schedule:
    - cron: '0 9 * * MON'  # Weekly on Monday
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Check npm dependencies
        run: |
          cd frontend
          npm audit --audit-level=moderate
          npm outdated || true

      - name: Check Go dependencies
        run: |
          cd backend
          go list -m -u all | grep -i deprecated || true
```

---

## Questions and Decision Points

### Before Starting

1. **Timing**: Is this a good time for 3-5 day upgrade sprint?
2. **Environment**: Do you have a staging environment for testing?
3. **Backup**: Is production database backed up?
4. **Team**: Are other developers aware of upgrade plan?
5. **Rollback**: What's acceptable downtime for rollback?

### During Upgrade

1. **Breaking Changes**: How much refactoring is acceptable?
2. **New Warnings**: Fix all new linting warnings or defer some?
3. **Performance**: Benchmark before/after for critical paths?
4. **Documentation**: Update inline or after completion?

### After Completion

1. **Monitoring**: Watch error rates for 24-48 hours
2. **Performance**: Compare metrics before/after
3. **Feedback**: Gather team feedback on changes
4. **Documentation**: Update all relevant docs

---

## Appendix: Common Issues and Solutions

### Issue: npm install fails with peer dependency conflicts

```bash
# Solution: Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue: Go module retraction warnings

```bash
# Solution: Use specific version before retraction
go get github.com/some/module@v1.2.3  # Use last good version
```

### Issue: Test timeout in Vitest after upgrade

```typescript
// Solution: Increase timeout in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 20000,  // Increase from 10000
  }
})
```

### Issue: React Fast Refresh not working

```typescript
// Solution: Ensure components use named exports
// Before
export default function MyComponent() {}

// After
export function MyComponent() {}
export default MyComponent;
```

### Issue: AWS SDK v2 credentials not loading

```go
// Solution: Explicitly specify region
cfg, err := config.LoadDefaultConfig(context.TODO(),
    config.WithRegion("us-east-1"),
)
```

---

## Contact and Support

**Questions about this plan?**
- Review `.claude/README.md` for project context
- Check `/docs/` for existing documentation
- Test changes in isolated environment first

**Last Updated**: November 14, 2024
**Next Review**: After Phase 1 completion
