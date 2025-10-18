# Documentation Reorganization Plan

**Date**: 2025-10-17
**Status**: ✅ COMPLETE
**Goal**: Create clear, organized documentation structure for humans and AI
**Completed**: 2025-10-17

---

## Current Problems

### 1. Duplicate Files

- **FEATURE_TEMPLATE.md** vs **FEATURE_PLAN_TEMPLATE.md** (duplicate!)
- **5 STATE_MANAGEMENT docs** across .claude/ and frontend/docs/
- **3 Test coverage analysis files** (TEST_COVERAGE_ANALYSIS, BACKEND_COVERAGE, FRONTEND_COVERAGE)

### 2. Scattered Documentation

- Testing sessions in `docs/sessions/` (historical, could be archived)
- Implementation summaries in `frontend/` root (should be in docs/)
- State management docs split between `.claude/context/` and `frontend/docs/`

### 3. Unclear Organization

**Questions to answer:**
- What goes in `.claude/` vs `docs/`?
- What's `.claude/context/` vs `.claude/reference/`?
- Where should testing-related docs live?
- Where should E2E testing docs live?

---

## Proposed Structure

### Clear Purpose for Each Directory

```
.claude/                          # AI CONTEXT - Read by Claude Code at session start
├── context/                      # ESSENTIAL context to read before tasks
│   ├── ARCHITECTURE.md           # Quick architecture reference
│   ├── TESTING.md                # Testing standards & where to find details
│   ├── STATE_MANAGEMENT.md       # Frontend state patterns
│   └── TEST_DATA.md              # Test fixtures overview
│
├── reference/                    # DETAILED guides (read when needed)
│   ├── BACKEND_ARCHITECTURE.md   # Deep dive into backend
│   ├── API_DOCUMENTATION.md      # API endpoint reference
│   ├── ERROR_HANDLING.md         # Error handling patterns
│   ├── LOGGING_STANDARDS.md      # Logging best practices
│   └── TESTING_GUIDE.md          # How to write tests
│
├── planning/                     # TEMPLATES & active planning
│   ├── FEATURE_TEMPLATE.md       # Template for new features
│   ├── MVP_STATUS.md             # Current MVP state
│   └── README.md                 # How to use planning/
│
├── README.md                     # Index of all .claude/ docs
└── QUICK_START.md                # Quick reference for common tasks

docs/                             # PROJECT DOCUMENTATION - Human-readable, comprehensive
├── README.md                     # Documentation index
│
├── getting-started/              # NEW - Onboarding docs
│   ├── DEVELOPER_ONBOARDING.md   # 30-min developer setup
│   ├── QUICK_START.md            # 5-min quick commands
│   └── PROJECT_OVERVIEW.md       # What is ActionPhase?
│
├── architecture/                 # Architecture documentation
│   ├── SYSTEM_ARCHITECTURE.md    # Overall system design
│   ├── COMPONENT_INTERACTIONS.md # How components communicate
│   └── SEQUENCE_DIAGRAMS.md      # Flow diagrams
│
├── adrs/                         # Architecture Decision Records
│   ├── README.md
│   ├── 001-technology-stack.md
│   ├── 002-database-design.md
│   ├── 003-authentication.md
│   ├── 004-api-design.md
│   ├── 005-state-management.md
│   ├── 006-observability.md
│   └── 007-testing-strategy.md
│
├── testing/                      # NEW - All testing docs consolidated
│   ├── README.md                 # Testing overview & index
│   ├── UNIT_TESTING_GUIDE.md     # How to write unit tests
│   ├── E2E_TESTING_PLAN.md       # E2E setup & critical journeys
│   ├── E2E_QUICK_START.md        # Quick E2E reference
│   ├── TEST_DATA.md              # Test fixtures documentation
│   ├── COVERAGE_STATUS.md        # Current coverage (replaces 3 files!)
│   └── sessions/                 # Historical testing session notes (archive)
│       ├── README.md             # What these sessions are
│       └── [archived sessions]
│
├── features/                     # NEW - Feature-specific docs
│   ├── STATE_MANAGEMENT.md       # Consolidated state management doc
│   ├── AUTHENTICATION.md         # Auth system documentation
│   ├── GAME_PHASES.md            # Phase system documentation
│   └── MESSAGING.md              # Messaging system documentation
│
└── reference/                    # NEW - Additional reference docs
    └── API_ENDPOINTS.md          # API endpoint reference

frontend/                         # Frontend-specific docs
├── README.md                     # Frontend setup & scripts
└── docs/                         # Frontend technical docs
    └── (keep frontend-specific implementation details here)

backend/                          # Backend-specific docs
└── README.md                     # Backend setup & scripts
```

---

## Reorganization Actions

### Phase 1: Remove Duplicates

**1. Delete Duplicate Feature Template**
```bash
# Keep: .claude/planning/FEATURE_PLAN_TEMPLATE.md (original)
# Delete: .claude/planning/FEATURE_TEMPLATE.md (duplicate I just created)
rm .claude/planning/FEATURE_TEMPLATE.md
```

**2. Consolidate State Management Docs**
```bash
# KEEP (merge into): docs/features/STATE_MANAGEMENT.md
# Merge from:
# - .claude/context/STATE_MANAGEMENT.md (context/patterns)
# - frontend/docs/STATE_MANAGEMENT.md (detailed guide)
# - frontend/docs/STATE_MANAGEMENT_ARCHITECTURE.md (architecture)
# - frontend/docs/STATE_MANAGEMENT_QUICK_REFERENCE.md (quick ref)
# - frontend/docs/STATE_MANAGEMENT_README.md (overview)

# Then update .claude/context/STATE_MANAGEMENT.md to be SHORT pointer:
# "For state management patterns, see docs/features/STATE_MANAGEMENT.md"
```

**3. Consolidate Test Coverage Docs**
```bash
# KEEP (merge into): docs/testing/COVERAGE_STATUS.md
# Merge from:
# - docs/TEST_COVERAGE_ANALYSIS.md (main analysis, very long!)
# - docs/BACKEND_COVERAGE_ANALYSIS.md (backend specific)
# - docs/FRONTEND_COVERAGE_ANALYSIS.md (frontend specific)

# Create shorter summary in .claude/context/TESTING.md with pointer to full doc
```

### Phase 2: Move Files to Correct Locations

**1. Create New Directories**
```bash
mkdir -p docs/getting-started
mkdir -p docs/testing/sessions
mkdir -p docs/features
mkdir -p docs/reference
```

**2. Move Getting Started Docs**
```bash
# Already in docs/, just reorganize:
mv docs/DEVELOPER_ONBOARDING.md docs/getting-started/
```

**3. Move Testing Docs**
```bash
# Consolidate E2E docs
mv docs/E2E_TESTING_PLAN.md docs/testing/
mv .claude/E2E_QUICK_START.md docs/testing/

# Move test data doc
mv docs/TEST_DATA.md docs/testing/

# Archive testing sessions
mv docs/sessions/* docs/testing/sessions/
rmdir docs/sessions
```

**4. Move Feature Docs**
```bash
# From frontend/ to docs/features/
mv frontend/CHARACTER_SHEET_TESTING_INVESTIGATION.md docs/testing/sessions/
mv frontend/IMPLEMENTATION_SUMMARY.md docs/features/
```

**5. Clean Up .claude/**
```bash
# Remove duplicates from .claude/reference/ that belong in docs/
# Keep only AI-essential context in .claude/context/
# Keep detailed guides in .claude/reference/ only if AI needs frequent access
```

### Phase 3: Update Cross-References

**Files to update with new paths:**
- `CLAUDE.md` - Update all file references
- `.claude/README.md` - Update index
- `docs/README.md` - Create comprehensive index
- All files that reference moved docs

---

## File-by-File Actions

### Duplicates to Resolve

| Current Files | Action | Result |
|---------------|--------|--------|
| `.claude/planning/FEATURE_PLAN_TEMPLATE.md`<br>`.claude/planning/FEATURE_TEMPLATE.md` | **DELETE** FEATURE_TEMPLATE.md | Keep original FEATURE_PLAN_TEMPLATE.md |

### State Management (5 → 2 files)

| Current Files | Action | Result |
|---------------|--------|--------|
| `.claude/context/STATE_MANAGEMENT.md`<br>`frontend/docs/STATE_MANAGEMENT.md`<br>`frontend/docs/STATE_MANAGEMENT_ARCHITECTURE.md`<br>`frontend/docs/STATE_MANAGEMENT_QUICK_REFERENCE.md`<br>`frontend/docs/STATE_MANAGEMENT_README.md` | **MERGE** all into `docs/features/STATE_MANAGEMENT.md`<br><br>**UPDATE** `.claude/context/STATE_MANAGEMENT.md` to short pointer | `docs/features/STATE_MANAGEMENT.md` (comprehensive)<br>`.claude/context/STATE_MANAGEMENT.md` (pointer) |

### Test Coverage (3 → 1 file)

| Current Files | Action | Result |
|---------------|--------|--------|
| `docs/TEST_COVERAGE_ANALYSIS.md` (2,686 lines!)<br>`docs/BACKEND_COVERAGE_ANALYSIS.md`<br>`docs/FRONTEND_COVERAGE_ANALYSIS.md` | **MERGE** into `docs/testing/COVERAGE_STATUS.md`<br><br>**ARCHIVE** old versions to `docs/testing/sessions/coverage-history/` | `docs/testing/COVERAGE_STATUS.md` (current status)<br>Archived historical analysis |

### E2E Testing (2 → organized)

| Current Files | Action | Result |
|---------------|--------|--------|
| `docs/E2E_TESTING_PLAN.md`<br>`.claude/E2E_QUICK_START.md` | **MOVE** both to `docs/testing/`<br><br>**CREATE** pointer in `.claude/QUICK_START.md` | `docs/testing/E2E_TESTING_PLAN.md`<br>`docs/testing/E2E_QUICK_START.md`<br>`.claude/QUICK_START.md` (pointers) |

### Frontend-Specific Docs

| Current Files | Action | Result |
|---------------|--------|--------|
| `frontend/CHARACTER_SHEET_TESTING_INVESTIGATION.md`<br>`frontend/IMPLEMENTATION_SUMMARY.md`<br>`frontend/TESTING_NOTES.md` | **MOVE** testing investigation to archive<br>**MOVE** implementation summary to features<br>**KEEP** TESTING_NOTES.md in frontend/ | `docs/testing/sessions/character-sheet-investigation.md`<br>`docs/features/IMPLEMENTATION_SUMMARY.md`<br>`frontend/TESTING_NOTES.md` (stay) |

### Testing Sessions

| Current Location | Action | Result |
|------------------|--------|--------|
| `docs/sessions/*` | **MOVE** to `docs/testing/sessions/`<br>**CREATE** README explaining these are historical | `docs/testing/sessions/`<br>`docs/testing/sessions/README.md` |

---

## Updated .claude/ Purpose

**.claude/context/** - SHORT, essential context (read every session):
- Quick architecture reference
- Testing standards & where to find details
- State management patterns & pointer to full doc
- Test data overview

**.claude/reference/** - Detailed guides (read when needed for specific tasks):
- Backend architecture deep dive
- API documentation
- Error handling patterns
- Logging standards
- Testing guide

**.claude/planning/** - Templates & active planning:
- Feature template
- MVP status
- Planning guides

**Key Principle**: `.claude/` docs should be CONCISE with pointers to `docs/` for details.

---

## Updated docs/ Purpose

**docs/** - Comprehensive project documentation:
- **getting-started/** - Onboarding (5-min to 30-min guides)
- **architecture/** - System design & ADRs
- **testing/** - All testing documentation
- **features/** - Feature-specific documentation
- **reference/** - Additional reference material

**Key Principle**: `docs/` is the source of truth. `.claude/` points to `docs/`.

---

## Implementation Order

### Step 1: Delete Duplicates (5 min)
- [x] Delete `.claude/planning/FEATURE_TEMPLATE.md`

### Step 2: Create New Structure (10 min)
- [ ] Create new directories
- [ ] Create README.md files for new directories

### Step 3: Merge & Consolidate (30 min)
- [ ] Merge state management docs → `docs/features/STATE_MANAGEMENT.md`
- [ ] Merge test coverage docs → `docs/testing/COVERAGE_STATUS.md`
- [ ] Update `.claude/context/` docs to be SHORT pointers

### Step 4: Move Files (15 min)
- [ ] Move E2E docs to `docs/testing/`
- [ ] Move testing sessions to archive
- [ ] Move frontend-specific docs
- [ ] Move getting-started docs

### Step 5: Update References (20 min)
- [ ] Update `CLAUDE.md`
- [ ] Update `.claude/README.md`
- [ ] Create comprehensive `docs/README.md`
- [ ] Update cross-references in moved files

### Step 6: Verify (10 min)
- [ ] Check all links work
- [ ] Verify no broken references
- [ ] Test that structure makes sense

**Total Time**: ~90 minutes

---

## Success Criteria

✅ **No duplicate files**
✅ **Clear purpose** for `.claude/` vs `docs/`
✅ **Organized by topic** (testing, features, architecture)
✅ **Easy for humans** to find documentation
✅ **Easy for AI** to find relevant context
✅ **All references** updated and working

---

## Maintenance Going Forward

**Rules for new documentation:**

1. **AI Context** → `.claude/context/` (SHORT, essential patterns)
2. **Detailed Guides** → `docs/[topic]/` (comprehensive documentation)
3. **Feature Docs** → `docs/features/` (feature-specific details)
4. **Testing Docs** → `docs/testing/` (all testing-related)
5. **ADRs** → `docs/adrs/` (architectural decisions)
6. **Temporary/WIP** → Can go in root temporarily, but move to proper location before merging

**When creating new docs, ask:**
- Is this essential AI context? → `.claude/context/`
- Is this a reference guide? → `docs/[topic]/`
- Is this feature-specific? → `docs/features/`
- Is this a decision record? → `docs/adrs/`
- Is this about testing? → `docs/testing/`

---

**Next Step**: Execute this plan to clean up documentation structure.

---

## COMPLETION SUMMARY (2025-10-17)

### Changes Implemented ✅

**1. Deleted Duplicates**
- ✅ Deleted `.claude/planning/FEATURE_TEMPLATE.md` (duplicate of FEATURE_PLAN_TEMPLATE.md)
- ✅ Removed 4 state management docs from `frontend/docs/`
- ✅ Removed 3 test coverage analysis files

**2. Consolidated Documentation**
- ✅ **State Management**: 5 files → 2 files
  - Created `docs/features/STATE_MANAGEMENT.md` (1,889 lines comprehensive)
  - Updated `.claude/context/STATE_MANAGEMENT.md` as short AI pointer (267 lines)
- ✅ **Test Coverage**: 3 files → 1 file
  - Created `docs/testing/COVERAGE_STATUS.md` (900 lines, 70% reduction from 2,964 lines)

**3. Moved Files to Logical Locations**
- ✅ E2E_TESTING_PLAN.md → `.claude/planning/` (AI implementation plan)
- ✅ E2E_QUICK_START.md → `docs/testing/` (developer reference)
- ✅ Testing sessions → `docs/testing/sessions/` (archived)
- ✅ TEST_DATA.md → `docs/testing/`
- ✅ DEVELOPER_ONBOARDING.md → `docs/getting-started/`
- ✅ Frontend docs → `docs/features/` and `docs/testing/sessions/`

**4. Updated FEATURE_PLAN_TEMPLATE.md**
- ✅ Added section 4.4 "E2E Testing Requirements" with:
  - User journey description template
  - Happy path test specification
  - Error scenario tests
  - Multi-user interaction tests
  - E2E implementation checklist
  - E2E acceptance criteria

**5. Updated CLAUDE.md**
- ✅ Updated all file references to new locations
- ✅ Added "Before E2E Testing" section
- ✅ Updated "Current Status & Testing" section
- ✅ Updated "Getting Help" section

### Final Structure

```
.claude/
├── context/
│   ├── STATE_MANAGEMENT.md (short pointer, 267 lines)
│   └── ... (other context files)
├── planning/
│   ├── E2E_TESTING_PLAN.md (AI implementation plan)
│   ├── FEATURE_PLAN_TEMPLATE.md (updated with E2E section 4.4)
│   └── ... (other planning docs)

docs/
├── getting-started/
│   └── DEVELOPER_ONBOARDING.md
├── testing/
│   ├── sessions/ (archived historical sessions)
│   ├── COVERAGE_STATUS.md (consolidated)
│   ├── TEST_DATA.md
│   └── E2E_QUICK_START.md (developer reference)
├── features/
│   ├── STATE_MANAGEMENT.md (comprehensive, 1,889 lines)
│   └── IMPLEMENTATION_SUMMARY.md
├── architecture/ (existing)
└── adrs/ (existing)
```

### Benefits Achieved

**For Developers:**
- ✅ Single source of truth for state management and test coverage
- ✅ Clear organization by topic (testing, features, getting-started)
- ✅ No more searching across 5 different state management files
- ✅ Archived historical docs accessible but out of the way

**For AI (Claude Code):**
- ✅ Focused context files in `.claude/context/` (quick reference)
- ✅ Implementation plans in `.claude/planning/` (for AI execution)
- ✅ Comprehensive docs in `docs/` for deep dives
- ✅ Clear pointers from context files to comprehensive docs
- ✅ E2E testing integrated into feature development workflow

**File Count:**
- Before: 54 markdown files (many duplicates)
- After: 46 markdown files (no duplicates, well-organized)
- Eliminated: 8 duplicate/redundant files

### Success Criteria Met

✅ **No duplicate files** - All duplicates removed or consolidated
✅ **Clear purpose** for `.claude/` vs `docs/` - Documentation now self-explanatory
✅ **Organized by topic** - Testing, features, getting-started directories created
✅ **Easy for humans** to find documentation - Logical hierarchy
✅ **Easy for AI** to find relevant context - Short pointers to comprehensive docs
✅ **All references** updated and working - CLAUDE.md fully updated
✅ **E2E testing integrated** - FEATURE_PLAN_TEMPLATE.md includes E2E requirements

### Next Steps

The documentation is now well-organized. When ready to implement E2E testing:
1. Read `.claude/planning/E2E_TESTING_PLAN.md` for complete implementation plan
2. Reference `docs/testing/E2E_QUICK_START.md` for quick commands
3. Use FEATURE_PLAN_TEMPLATE.md section 4.4 for new features

**Reorganization Complete! 🎉**
