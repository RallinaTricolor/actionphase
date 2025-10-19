# Refactor Plan 02: Documentation Consolidation & Accuracy
**Status**: Ready for Execution
**Executor**: Sonnet Model Compatible
**Estimated Effort**: 3-4 days

## Problem Statement
- 61+ documentation files with significant overlap
- Outdated information in multiple places
- No single source of truth
- Difficult to maintain consistency
- New developers confused about where to find information

## Success Criteria
✅ Reduce documentation files by 50%
✅ Single source of truth for each topic
✅ All code examples verified and working
✅ Clear navigation structure
✅ Automated staleness detection

---

## Part A: Documentation Audit & Consolidation

### Step 1: Identify Redundant Documentation

**Run this audit script:**
```bash
#!/bin/bash
# Find duplicate content across docs
for topic in "testing" "authentication" "state management" "architecture"; do
  echo "=== $topic ==="
  grep -r "$topic" docs/ .claude/ --include="*.md" | wc -l
done
```

**Current structure problems:**
```
docs/
├── testing/
│   ├── COVERAGE_STATUS.md         # Overlaps with .claude/context/TESTING.md
│   ├── E2E_QUICK_START.md        # Duplicates .claude/planning/E2E_TESTING_PLAN.md
│   ├── TEST_DATA.md               # Duplicates .claude/context/TEST_DATA.md
│   └── sessions/*                 # 7 session files - should be in git history
.claude/
├── context/                       # Duplicates /docs content
├── reference/                     # More duplication
└── planning/                      # Planning docs mixed with reference
```

### Step 2: New Documentation Structure

**Implement this consolidated structure:**
```
docs/
├── README.md                      # Navigation hub ONLY
├── getting-started/
│   └── README.md                  # Quickstart (5 min read)
├── architecture/
│   ├── README.md                  # System overview
│   ├── backend.md                 # Backend patterns
│   ├── frontend.md                # Frontend patterns
│   └── decisions/                # ADRs only
│       └── *.md
├── development/
│   ├── README.md                  # Dev workflow
│   ├── testing.md                 # All testing info
│   ├── database.md                # Schema & migrations
│   └── deployment.md              # Deploy guide
└── reference/
    ├── api.md                     # API documentation
    ├── commands.md                # Justfile commands
    └── troubleshooting.md         # Common issues

.claude/
├── CLAUDE.md                      # AI-specific instructions ONLY
└── templates/                     # Templates for AI use
    ├── feature-plan.md
    └── test-plan.md

DELETE:
- All session documentation
- All duplicate files
- All outdated guides
```

### Step 3: Content Migration Plan

**For each file being consolidated:**

| Source Files | Target File | Action |
|-------------|------------|---------|
| `.claude/context/TESTING.md`<br>`docs/testing/COVERAGE_STATUS.md`<br>`docs/testing/TEST_DATA.md` | `docs/development/testing.md` | Merge, deduplicate, update examples |
| `.claude/context/ARCHITECTURE.md`<br>`docs/architecture/*.md`<br>`.claude/reference/BACKEND_ARCHITECTURE.md` | `docs/architecture/README.md`<br>`docs/architecture/backend.md` | Consolidate patterns, remove duplication |
| `.claude/context/STATE_MANAGEMENT.md`<br>`docs/features/STATE_MANAGEMENT.md` | `docs/architecture/frontend.md` | Single source of truth |
| All session files | DELETE | Move insights to relevant docs |

---

## Part B: Documentation Accuracy Verification

### Step 1: Create Verification Script

**Create file**: `scripts/verify-docs.sh`

```bash
#!/bin/bash
# Verify all code examples in documentation

echo "Verifying code examples in documentation..."

# Extract and test Go examples
echo "Testing Go examples..."
for file in docs/**/*.md; do
  # Extract Go code blocks
  awk '/```go/,/```/' $file | grep -v '```' > /tmp/example.go
  if [ -s /tmp/example.go ]; then
    echo "Checking $file..."
    go fmt /tmp/example.go > /dev/null 2>&1
    if [ $? -ne 0 ]; then
      echo "  ❌ Invalid Go code in $file"
    fi
  fi
done

# Extract and test TypeScript examples
echo "Testing TypeScript examples..."
for file in docs/**/*.md; do
  # Extract TypeScript code blocks
  awk '/```typescript/,/```/' $file | grep -v '```' > /tmp/example.ts
  if [ -s /tmp/example.ts ]; then
    echo "Checking $file..."
    npx tsc --noEmit /tmp/example.ts > /dev/null 2>&1
    if [ $? -ne 0 ]; then
      echo "  ❌ Invalid TypeScript in $file"
    fi
  fi
done

# Check for broken internal links
echo "Checking internal links..."
for file in docs/**/*.md; do
  grep -o '\[.*\](.*.md)' $file | while read link; do
    target=$(echo $link | grep -o '(.*.md)' | tr -d '()')
    if [ ! -f "docs/$target" ]; then
      echo "  ❌ Broken link in $file: $target"
    fi
  done
done
```

### Step 2: Fix All Code Examples

**For each documentation file:**
1. Extract code examples
2. Test compilation/syntax
3. Update with working code
4. Add file/line references

**Example fix:**
```markdown
<!-- BEFORE -->
```go
// Create a new user
user := User{Name: "test"}
db.Create(user)
```

<!-- AFTER -->
```go
// Create a new user
// See: backend/pkg/db/services/users.go:45
user := &db.User{
    Email:    "test@example.com",
    Username: "testuser",
}
err := userService.CreateUser(ctx, user)
if err != nil {
    return fmt.Errorf("failed to create user: %w", err)
}
```
```

### Step 3: Add Freshness Indicators

**Add to each doc file header:**
```markdown
---
last_verified: 2025-01-20
code_version: commit_hash
authors: [original_author]
---
```

**Create staleness checker**: `scripts/check-doc-staleness.sh`
```bash
#!/bin/bash
# Alert if docs haven't been verified in 30 days

for file in docs/**/*.md; do
  last_verified=$(grep "last_verified:" $file | cut -d' ' -f2)
  if [ -z "$last_verified" ]; then
    echo "⚠️  No verification date in $file"
    continue
  fi

  days_old=$(( ($(date +%s) - $(date -d "$last_verified" +%s)) / 86400 ))
  if [ $days_old -gt 30 ]; then
    echo "⚠️  $file is $days_old days old"
  fi
done
```

---

## Part C: Migration Execution Steps

### Step 1: Backup Current Documentation
```bash
# Create backup before changes
tar -czf docs-backup-$(date +%Y%m%d).tar.gz docs/ .claude/
git add docs-backup-*.tar.gz
git commit -m "Backup documentation before consolidation"
```

### Step 2: Create New Structure
```bash
# Create new directory structure
mkdir -p docs/{getting-started,architecture/decisions,development,reference}
mkdir -p .claude/templates
```

### Step 3: Migrate Content (File by File)

**docs/development/testing.md** - Combine from 3 sources:
```bash
# Start with the most comprehensive file
cp .claude/context/TESTING.md docs/development/testing.md

# Add missing sections from other files
# - Add coverage metrics from docs/testing/COVERAGE_STATUS.md
# - Add fixture details from docs/testing/TEST_DATA.md
# - Remove duplicate content
# - Update all examples to be current
# - Add clear section headers
```

**docs/architecture/README.md** - System overview:
```markdown
# System Architecture

## Overview
[One paragraph description]

## Architecture Diagram
[ASCII or mermaid diagram]

## Key Components
- Backend: [Link to backend.md]
- Frontend: [Link to frontend.md]
- Database: [Link to ../development/database.md]

## Request Flow
[Simplified flow diagram]

## Architecture Decisions
See [decisions/](./decisions/) for ADRs.
```

### Step 4: Update All References

**Find and update all doc links:**
```bash
# Find all markdown links
grep -r "\[.*\](.*\.md)" . --include="*.md" --include="*.tsx" --include="*.go"

# Update each reference to new location
# Old: [Testing Guide](../../../docs/testing/COVERAGE_STATUS.md)
# New: [Testing Guide](/docs/development/testing.md#coverage)
```

### Step 5: Delete Redundant Files

**Files to delete:**
```bash
# After verifying content is migrated
rm -rf docs/testing/sessions/
rm .claude/context/*.md  # After migrating to docs/
rm .claude/reference/*.md # After consolidating
rm .claude/planning/completed/*.md # Historical, use git history
```

---

## Part D: Maintain Documentation Quality

### Step 1: Add Documentation Linter

**Create**: `.github/workflows/docs-check.yml`
```yaml
name: Documentation Quality
on: [push, pull_request]

jobs:
  check-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Check markdown formatting
        run: npx markdownlint docs/**/*.md

      - name: Verify code examples
        run: ./scripts/verify-docs.sh

      - name: Check staleness
        run: ./scripts/check-doc-staleness.sh

      - name: Check broken links
        run: npx markdown-link-check docs/**/*.md
```

### Step 2: Documentation Update Checklist

**Add to PR template:**
```markdown
## Documentation Updates
- [ ] Updated relevant documentation
- [ ] Verified code examples still work
- [ ] Updated last_verified date
- [ ] No broken internal links
- [ ] Removed any outdated information
```

---

## Execution Checklist

### Day 1: Audit and Planning
- [ ] Run documentation audit script
- [ ] Map all duplicate content
- [ ] Create consolidation plan
- [ ] Get team buy-in on new structure

### Day 2: Structure Creation
- [ ] Backup existing documentation
- [ ] Create new directory structure
- [ ] Migrate architecture documentation
- [ ] Migrate development documentation
- [ ] Update all internal links

### Day 3: Content Consolidation
- [ ] Merge testing documentation
- [ ] Consolidate API documentation
- [ ] Update getting-started guide
- [ ] Verify all code examples
- [ ] Delete redundant files

### Day 4: Quality Assurance
- [ ] Run verification scripts
- [ ] Fix all broken examples
- [ ] Add freshness indicators
- [ ] Set up CI checks
- [ ] Create maintenance plan

---

## Success Validation

**Run these checks after consolidation:**

```bash
# Count total documentation files
find docs -name "*.md" | wc -l  # Should be < 30

# Check for duplicates
for topic in "testing" "auth" "state"; do
  files=$(grep -l "$topic" docs/**/*.md | wc -l)
  echo "$topic appears in $files files"
  # Should be 1-2 files max per topic
done

# Verify no broken links
npx markdown-link-check docs/**/*.md

# Check all code examples
./scripts/verify-docs.sh

# Ensure no stale docs
./scripts/check-doc-staleness.sh
```

---

## Common Pitfalls to Avoid

1. **Don't keep "just in case" docs** - Use git history
2. **Don't duplicate content** - Link instead
3. **Don't document the obvious** - Focus on why, not what
4. **Don't ignore code examples** - They must compile
5. **Don't forget to redirect** - Leave breadcrumbs for old links

---

## Long-term Maintenance

### Monthly Tasks
- Run staleness checker
- Update code examples
- Review and merge similar docs
- Archive outdated decisions

### Quarterly Tasks
- Full documentation audit
- Update architecture diagrams
- Refresh getting-started guide
- Survey developers for gaps

### Documentation Principles
1. **Single Source of Truth** - One place per topic
2. **Just Enough** - Document decisions, not details
3. **Always Current** - Automated verification
4. **Developer-Focused** - Practical, not theoretical
5. **Searchable** - Good headers and keywords
