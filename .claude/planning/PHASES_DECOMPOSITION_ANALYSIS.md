# Phase Service Decomposition Analysis
**Date**: 2025-01-20
**File**: `backend/pkg/db/services/phases.go`
**Current Size**: 1056 lines, 42 functions

## Current Structure

### Two Services in One File
1. **PhaseService** - 28 methods (Phase lifecycle management)
2. **ActionSubmissionService** - 14 methods (Action submission & results)

This is actually good news - these are already separate concerns that just need physical separation!

## Proposed Decomposition

### Phase 1: Split Services into Separate Packages

```
backend/pkg/db/services/
├── phases/
│   ├── service.go           (~150 lines) - Main PhaseService struct
│   ├── crud.go             (~200 lines) - CRUD operations
│   ├── transitions.go      (~300 lines) - State transitions
│   ├── validation.go       (~150 lines) - Permissions & validation
│   ├── history.go          (~100 lines) - Phase history
│   └── converters.go       (~100 lines) - Response converters
│
└── actions/
    ├── service.go           (~150 lines) - Main ActionSubmissionService struct
    ├── submissions.go       (~250 lines) - Action submission CRUD
    ├── results.go          (~250 lines) - Action results CRUD
    └── validation.go       (~100 lines) - Submission validation
```

## Function Categorization

### PhaseService (28 methods)

#### CRUD Operations → `phases/crud.go`
- `CreatePhase` (line 80) - Create new phase
- `GetActivePhase` (line 145) - Get currently active phase
- `GetGamePhases` (line 159) - List all phases for game
- `GetPhase` (line 170) - Get single phase by ID
- `UpdatePhase` (line 491) - Update phase details

#### State Transitions → `phases/transitions.go`
- `TransitionToNextPhase` (line 518) - Main transition logic with validation
- `ActivatePhase` (line 628) - Public activate with permissions
- `activatePhaseInternal` (line 634) - Internal activation logic
- `DeactivatePhase` (line 674) - Public deactivate with permissions
- `deactivatePhaseInternal` (line 689) - Internal deactivation logic
- `notifyPhaseActivated` (line 1042) - Notification side effects
- `ActivatePhaseOld` (line 185) - **DEPRECATED** - remove
- `DeactivatePhaseOld` (line 190) - **DEPRECATED** - remove

#### History Tracking → `phases/history.go`
- `GetPhaseHistory` (line 700) - Get phase transition history

#### Validation & Permissions → `phases/validation.go`
- `CanUserManagePhases` (line 410) - Permission check
- `CanUserSubmitActions` (line 421) - Permission check
- `ExtendPhaseDeadline` (line 194) - Deadline validation & update

#### Response Converters → `phases/converters.go`
- `ConvertPhaseToResponse` (line 440) - Model to API response
- `ConvertActionToResponse` (line 471) - Model to API response

#### Deprecated/Misplaced Functions
- `SubmitAction` (line 212) - **WRONG SERVICE** - belongs to ActionSubmissionService
- `GetUserAction` (line 284) - **WRONG SERVICE**
- `GetUserActions` (line 304) - **WRONG SERVICE**
- `GetPhaseActions` (line 320) - **WRONG SERVICE**
- `GetGameActions` (line 331) - **WRONG SERVICE**
- `DeleteAction` (line 342) - **WRONG SERVICE**
- `SendActionResult` (line 361) - **WRONG SERVICE**
- `GetUserResults` (line 381) - **WRONG SERVICE**
- `GetGameResults` (line 397) - **WRONG SERVICE**

**These 9 methods should be removed from PhaseService** - they duplicate ActionSubmissionService!

---

### ActionSubmissionService (14 methods)

#### Action Submission CRUD → `actions/submissions.go`
- `SubmitAction` (line 735) - Submit or update action
- `GetActionSubmission` (line 792) - Get submission by ID
- `GetUserPhaseSubmission` (line 806) - Get user's submission for phase
- `GetPhaseSubmissions` (line 823) - List all submissions for phase
- `DeleteActionSubmission` (line 854) - Delete submission
- `GetSubmissionStats` (line 977) - Get submission statistics

#### Action Results CRUD → `actions/results.go`
- `CreateActionResult` (line 868) - GM creates result
- `GetActionResult` (line 899) - Get result by ID
- `GetUserPhaseResults` (line 913) - Get user's results
- `PublishActionResult` (line 927) - Publish single result
- `PublishAllPhaseResults` (line 938) - Publish all results
- `GetUnpublishedResultsCount` (line 949) - Count unpublished
- `UpdateActionResult` (line 960) - Update result content

#### Validation → `actions/validation.go`
- `CanUserSubmitAction` (line 1027) - Permission check

---

## Migration Strategy

### Step 1: Create Package Structures (Monday)
```bash
mkdir -p backend/pkg/db/services/phases
mkdir -p backend/pkg/db/services/actions
```

### Step 2: Create Main Service Files (Monday)
- `phases/service.go` - PhaseService struct, imports, interface verification
- `actions/service.go` - ActionSubmissionService struct, imports, interface verification

### Step 3: Move PhaseService Methods (Tuesday)
1. Move CRUD to `phases/crud.go` (5 methods, ~200 lines)
2. Move transitions to `phases/transitions.go` (6 methods, ~300 lines)
3. Move validation to `phases/validation.go` (3 methods, ~150 lines)
4. Move history to `phases/history.go` (1 method, ~100 lines)
5. Move converters to `phases/converters.go` (2 methods, ~100 lines)

### Step 4: Move ActionSubmissionService (Wednesday)
1. Move submission methods to `actions/submissions.go` (6 methods, ~250 lines)
2. Move results methods to `actions/results.go` (7 methods, ~250 lines)
3. Move validation to `actions/validation.go` (1 method, ~100 lines)

### Step 5: Clean Up (Wednesday)
1. Remove 9 duplicate action methods from PhaseService
2. Remove deprecated ActivatePhaseOld/DeactivatePhaseOld
3. Delete original `phases.go` file

### Step 6: Update Tests (Thursday)
1. Split `phases_test.go` by responsibility
2. Create `phases/crud_test.go`, `phases/transitions_test.go`, etc.
3. Create `actions/submissions_test.go`, `actions/results_test.go`, etc.
4. Ensure all tests pass

### Step 7: Update Imports (Friday)
1. Update API handlers to import new packages
2. Update other services that depend on PhaseService/ActionSubmissionService
3. Run full test suite
4. Verify compilation

---

## Expected Outcomes

### Before
- 1 file: `phases.go` (1056 lines)
- 2 services mixed together
- 42 functions in one file
- Difficult to navigate
- Hard to test specific features

### After
- **phases/** package (6 files, ~1000 lines total)
  - service.go: 150 lines
  - crud.go: 200 lines
  - transitions.go: 300 lines
  - validation.go: 150 lines
  - history.go: 100 lines
  - converters.go: 100 lines

- **actions/** package (3 files, ~600 lines total)
  - service.go: 150 lines
  - submissions.go: 250 lines
  - results.go: 250 lines
  - validation.go: 100 lines

### Benefits
✅ Each file < 400 lines (goal achieved)
✅ Clear separation of concerns
✅ Easier to find specific functionality
✅ Better testability (can test files independently)
✅ Removed code duplication (9 duplicate methods removed)
✅ Removed deprecated code (2 old methods removed)

---

## Risks & Mitigations

### Risk 1: Import Cycles
**Mitigation**: Keep phases and actions as sibling packages under services/. They can both import core/ for interfaces but not each other.

### Risk 2: Breaking Existing Code
**Mitigation**: Maintain exact function signatures. Only move code, don't change behavior.

### Risk 3: Test Failures
**Mitigation**: Run tests after each file migration. Rollback if issues arise.

### Risk 4: Lost Functionality
**Mitigation**: Use checklist to track every function migration. Verify line count matches.

---

## Implementation Checklist

### Monday (Setup)
- [x] Create `backend/pkg/db/services/phases/` directory
- [ ] Create `backend/pkg/db/services/actions/` directory
- [ ] Create `phases/service.go` with struct definition
- [ ] Create `actions/service.go` with struct definition
- [ ] Define internal interfaces (if needed)

### Tuesday (PhaseService)
- [ ] Create & populate `phases/crud.go` (5 methods)
- [ ] Create & populate `phases/transitions.go` (6 methods)
- [ ] Create & populate `phases/validation.go` (3 methods)
- [ ] Create & populate `phases/history.go` (1 method)
- [ ] Create & populate `phases/converters.go` (2 methods)
- [ ] Verify phases package compiles

### Wednesday (ActionSubmissionService)
- [ ] Create & populate `actions/submissions.go` (6 methods)
- [ ] Create & populate `actions/results.go` (7 methods)
- [ ] Create & populate `actions/validation.go` (1 method)
- [ ] Remove 11 duplicate/deprecated methods from original file
- [ ] Verify actions package compiles

### Thursday (Tests)
- [ ] Split `phases_test.go` into test files per concern
- [ ] Create `actions/submissions_test.go`
- [ ] Create `actions/results_test.go`
- [ ] Run `SKIP_DB_TESTS=false just test` - all pass

### Friday (Integration)
- [ ] Update imports in API handlers (`pkg/phases/api.go`, etc.)
- [ ] Update imports in other services
- [ ] Delete original `phases.go` file
- [ ] Run full test suite
- [ ] Verify backend compiles: `go build ./pkg/...`
- [ ] Update REFACTOR_PROGRESS.md

---

## Success Metrics

- [ ] All files < 400 lines ✅
- [ ] PhaseService split into 6 focused files ✅
- [ ] ActionSubmissionService extracted to separate package ✅
- [ ] 11 duplicate/deprecated methods removed ✅
- [ ] All tests passing ✅
- [ ] Zero breaking changes ✅
- [ ] Backend compiles successfully ✅

**Total line reduction**: 1056 → ~1000 (56 lines removed via deduplication)
**Improved organization**: 1 file → 9 focused files
