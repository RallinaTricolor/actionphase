# Master Refactoring Execution Plan
**Created**: 2025-01-20
**Executor**: Optimized for Sonnet Model
**Total Estimated Effort**: 4-5 weeks

## Executive Overview

This master plan coordinates 4 major refactoring initiatives to address:
- **E2E test brittleness** causing frequent CI failures
- **Documentation sprawl** across 61+ files with inconsistencies
- **Backend services** exceeding 1000+ lines with mixed responsibilities
- **Code duplication** and inconsistent error handling patterns

## Priority Matrix

| Priority | Plan | Impact | Effort | Risk | Start Week |
|----------|------|--------|--------|------|------------|
| **P0** | [01: Test Pyramid](./REFACTOR_01_TEST_PYRAMID.md) | Critical | 1-2 weeks | Low | Week 1 |
| **P0** | [04: Error Handling](./REFACTOR_04_ERROR_HANDLING_AND_SIMPLIFICATION.md) | High | 3-4 days | Low | Week 1 |
| **P1** | [03: Backend Services](./REFACTOR_03_BACKEND_SERVICES.md) | High | 3 weeks | Medium | Week 2 |
| **P2** | [02: Documentation](./REFACTOR_02_DOCUMENTATION.md) | Medium | 3-4 days | Low | Week 4 |

## Week-by-Week Execution

### Week 1: Test Infrastructure & Quick Wins
**Goal**: Fix test brittleness and standardize error handling

#### Monday-Tuesday: Error Handling (Plan 04, Part A)
- [ ] Morning: Create error package and types
- [ ] Afternoon: Implement error builders and HTTP handler
- [ ] Day 2: Replace 50+ error handling patterns

#### Wednesday-Friday: Integration Tests (Plan 01, Part A-B)
- [ ] Create backend integration test infrastructure
- [ ] Move character-mentions E2E to integration
- [ ] Move autocomplete E2E to component test
- [ ] Fix remaining E2E tests (remove waitForTimeout)

**Deliverables**:
- ✅ Standardized error handling across codebase
- ✅ 3-5 E2E tests converted to integration tests
- ✅ Zero waitForTimeout in E2E tests

### Week 2: Backend Service Refactoring - Phase Service
**Goal**: Decompose the largest service file (1056 lines)

#### Monday: Setup
- [ ] Create phases package structure
- [ ] Define internal interfaces
- [ ] Set up test infrastructure

#### Tuesday-Wednesday: Extract Components
- [ ] Extract CRUD operations to crud.go
- [ ] Extract transition logic to transitions.go
- [ ] Extract validation to validation.go

#### Thursday-Friday: Testing & Integration
- [ ] Split test file into logical units
- [ ] Verify all tests pass
- [ ] Update API handlers to use new structure

**Deliverables**:
- ✅ Phase service split into 5-6 files, each < 400 lines
- ✅ Test file split into manageable units
- ✅ All tests passing with maintained coverage

### Week 3: Backend Service Refactoring - Messages & Characters
**Goal**: Complete backend service decomposition

#### Monday-Tuesday: Message Service
- [ ] Create messages package structure
- [ ] Separate posts and comments logic
- [ ] Extract thread management
- [ ] Move mention handling

#### Wednesday-Thursday: Character Service
- [ ] Create characters package structure
- [ ] Extract NPC logic
- [ ] Separate permissions
- [ ] Split ability/inventory management

#### Friday: Integration & Cleanup
- [ ] Verify all API endpoints work
- [ ] Update documentation
- [ ] Remove old service files

**Deliverables**:
- ✅ All service files < 400 lines
- ✅ Clear separation of concerns
- ✅ Improved testability

### Week 4: Documentation & Polish
**Goal**: Consolidate documentation and finalize improvements

#### Monday-Tuesday: Documentation Consolidation (Plan 02)
- [ ] Backup existing documentation
- [ ] Create new structure
- [ ] Migrate and consolidate content
- [ ] Delete redundant files

#### Wednesday: Justfile Simplification (Plan 04, Part B)
- [ ] Implement hierarchical command structure
- [ ] Remove redundant commands
- [ ] Create command documentation

#### Thursday: Comment Linking (Plan 04, Part D)
- [ ] Add database migration for anchors
- [ ] Update API responses
- [ ] Implement frontend deep linking

#### Friday: Final Testing & Documentation
- [ ] Run full test suite
- [ ] Verify all refactoring complete
- [ ] Update CLAUDE.md with new patterns
- [ ] Create retrospective document

**Deliverables**:
- ✅ Documentation reduced by 50%
- ✅ Justfile commands < 30
- ✅ Comment direct linking working
- ✅ All documentation current and verified

### Week 5: Buffer & Optimization
**Goal**: Address any issues and optimize

- [ ] Performance testing
- [ ] Address any regressions
- [ ] Code review findings
- [ ] Final documentation updates
- [ ] Team knowledge transfer

## Quick Start Guide

### For Sonnet Execution

1. **Start with Plan 04, Part A** (Error Handling):
   ```bash
   # Day 1 tasks
   - Read REFACTOR_04_ERROR_HANDLING_AND_SIMPLIFICATION.md Part A
   - Create backend/pkg/core/errors/ directory
   - Implement types.go, builders.go, http.go
   - Find 10 instances of error handling to replace
   - Test the new error responses
   ```

2. **Move to Plan 01** (Test Pyramid):
   ```bash
   # Read the specific test to migrate
   - Look at Section "Part A: Shift E2E Tests to Integration Tests"
   - Pick one test from the migration table
   - Follow the step-by-step template
   - Run tests to verify
   ```

3. **Each refactor has**:
   - Clear file paths to create
   - Exact code to implement
   - Validation steps to run
   - Success criteria to meet

## Risk Mitigation

### Potential Risks & Mitigations

1. **Risk**: Breaking existing functionality
   - **Mitigation**: Keep old code working during migration
   - **Validation**: Run full test suite after each change

2. **Risk**: Team disruption during refactor
   - **Mitigation**: Work on feature branches
   - **Validation**: Daily merges to avoid conflicts

3. **Risk**: Performance regression
   - **Mitigation**: Benchmark before/after
   - **Validation**: Load test critical paths

## Success Metrics

### Test Infrastructure
- **E2E execution time**: 5 min → 2 min
- **Integration test count**: 5 → 25+
- **Flaky test incidents**: 5/week → 0/week

### Code Quality
- **Largest service file**: 1056 lines → 400 lines
- **Error handling patterns**: 125 instances → 10 templates
- **Code duplication**: -30% reduction

### Documentation
- **File count**: 61 → 30
- **Broken examples**: Unknown → 0
- **Time to find info**: Varies → < 30 seconds

### Developer Experience
- **Justfile commands**: 66 → 30
- **Test execution time**: 5 min → 30 sec (unit+integration)
- **Onboarding time**: Days → Hours

## Daily Execution Template

For Sonnet model execution, each day:

1. **Morning Standup**:
   ```
   - Which plan am I working on?
   - Which specific section?
   - What are today's deliverables?
   ```

2. **Execution**:
   ```
   - Open the specific refactor plan
   - Find today's section
   - Follow step-by-step instructions
   - Run validation commands
   ```

3. **End of Day**:
   ```
   - Run validation checklist
   - Commit completed work
   - Note any blockers for tomorrow
   ```

## Critical Path

These must be done in order:
1. Error handling (enables consistent service refactoring)
2. Test infrastructure (ensures safety for other changes)
3. Backend services (major architectural change)
4. Documentation (captures all changes)

## Notes for Sonnet Model

- **Don't overthink** - Each plan has explicit steps
- **Follow the templates** - Code examples are provided
- **Run validations** - Each section has verification steps
- **Ask if unclear** - Better to clarify than guess
- **Commit frequently** - Small, working increments

## Final Checklist

Before considering refactoring complete:
- [ ] All test suites passing
- [ ] No service file > 400 lines
- [ ] E2E tests < 2 minutes
- [ ] Documentation verified and current
- [ ] Error handling standardized
- [ ] Justfile simplified to < 30 commands
- [ ] Comment deep linking working
- [ ] Performance benchmarks maintained
- [ ] Team trained on new patterns
- [ ] CLAUDE.md updated with changes

---

**Ready to Execute**: Start with [REFACTOR_04 Part A](./REFACTOR_04_ERROR_HANDLING_AND_SIMPLIFICATION.md#part-a-error-handling-standardization) for immediate impact.
