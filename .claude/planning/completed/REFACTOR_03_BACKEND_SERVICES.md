# Refactor Plan 03: Backend Service Decomposition
**Status**: Ready for Execution
**Executor**: Sonnet Model Compatible
**Estimated Effort**: 1 week per service

## Problem Statement
- Service files exceeding 1000 lines (phases.go: 1056, messages.go: 699)
- Mixed responsibilities in single services
- Difficult to test individual features
- High coupling between service methods

## Success Criteria
✅ No service file > 400 lines
✅ Each file has single responsibility
✅ Test files < 600 lines
✅ Service methods < 50 lines each
✅ Clear interface boundaries

---

## Service 1: Phase Service Decomposition

### Current Structure Analysis
**File**: `backend/pkg/db/services/phases.go` (1056 lines)
**Responsibilities mixed**:
- Phase CRUD operations
- State transitions
- Validation logic
- History tracking
- Timer management
- Notification triggers

### New Structure
```
backend/pkg/db/services/phases/
├── service.go           (200 lines) - Main service & interface
├── crud.go             (150 lines) - Create, Read, Update, Delete
├── transitions.go      (300 lines) - State machine logic
├── validation.go       (200 lines) - Business rules
├── timers.go          (150 lines) - Phase timer management
└── history.go         (100 lines) - History tracking
```

### Step-by-Step Decomposition

#### Step 1: Create Package Structure
```bash
mkdir -p backend/pkg/db/services/phases
```

#### Step 2: Extract Interfaces
**Create**: `backend/pkg/db/services/phases/interfaces.go`
```go
package phases

import (
    "context"
    "actionphase/pkg/core"
    "actionphase/pkg/db/models"
)

// Main service interface stays in core/interfaces.go
// Internal interfaces for decomposition:

type TransitionManager interface {
    CanTransition(ctx context.Context, from, to string) bool
    ValidateTransition(ctx context.Context, phase *models.Phase, newState string) error
    ExecuteTransition(ctx context.Context, phaseID int32, newState string) error
}

type ValidationService interface {
    ValidatePhaseData(ctx context.Context, phase *models.Phase) error
    ValidateTimerSettings(duration int32, phaseType string) error
}

type HistoryTracker interface {
    RecordTransition(ctx context.Context, phaseID int32, from, to string) error
    GetPhaseHistory(ctx context.Context, gameID int32) ([]models.PhaseHistory, error)
}
```

#### Step 3: Move CRUD Operations
**Create**: `backend/pkg/db/services/phases/crud.go`
```go
package phases

// Move these methods from phases.go:
// - CreatePhase
// - GetPhase
// - GetPhaseByID
// - UpdatePhase
// - DeletePhase
// - ListPhasesByGame

// Steps:
// 1. Copy methods to crud.go
// 2. Update imports
// 3. Ensure queries object is accessible
// 4. Run tests to verify
```

#### Step 4: Extract Transition Logic
**Create**: `backend/pkg/db/services/phases/transitions.go`
```go
package phases

// Move these methods from phases.go:
// - TransitionToNextPhase
// - canTransitionFrom
// - executeStateChange
// - handleTransitionSideEffects

// Refactor pattern:
func (s *Service) TransitionToNextPhase(ctx context.Context, phaseID int32) error {
    // 1. Load current phase
    phase, err := s.getPhaseByID(ctx, phaseID)

    // 2. Validate transition
    if err := s.transitions.ValidateTransition(ctx, phase, nextState); err != nil {
        return err
    }

    // 3. Execute transition
    if err := s.transitions.ExecuteTransition(ctx, phaseID, nextState); err != nil {
        return err
    }

    // 4. Record history
    return s.history.RecordTransition(ctx, phaseID, phase.State, nextState)
}
```

#### Step 5: Extract Validation
**Create**: `backend/pkg/db/services/phases/validation.go`
```go
package phases

// Move validation methods:
// - validatePhaseType
// - validateDuration
// - validatePhaseSettings
// - checkBusinessRules

// Consolidate into clean methods:
func (v *validator) ValidatePhaseData(ctx context.Context, phase *models.Phase) error {
    // Type validation
    if err := v.validateType(phase.Type); err != nil {
        return fmt.Errorf("invalid phase type: %w", err)
    }

    // Duration validation
    if err := v.validateDuration(phase.Duration, phase.Type); err != nil {
        return fmt.Errorf("invalid duration: %w", err)
    }

    // Business rules
    return v.checkBusinessRules(ctx, phase)
}
```

#### Step 6: Update Tests
**Split**: `backend/pkg/db/services/phases_test.go` (1472 lines)
```
backend/pkg/db/services/phases/
├── crud_test.go        (300 lines)
├── transitions_test.go (400 lines)
├── validation_test.go  (300 lines)
├── timers_test.go      (200 lines)
├── history_test.go     (200 lines)
└── integration_test.go (200 lines)
```

---

## Service 2: Message Service Decomposition

### Current Structure Analysis
**File**: `backend/pkg/db/services/messages.go` (699 lines)
**Responsibilities mixed**:
- Message CRUD
- Thread management
- Mention extraction
- Notification triggers
- Comment handling

### New Structure
```
backend/pkg/db/services/messages/
├── service.go          (150 lines) - Main service
├── posts.go           (200 lines) - Post operations
├── comments.go        (200 lines) - Comment operations
├── threads.go         (150 lines) - Thread management
├── mentions.go        (150 lines) - Mention handling
└── notifications.go   (100 lines) - Message notifications
```

### Migration Steps

#### Step 1: Separate Posts and Comments
```go
// posts.go
type PostService struct {
    db      *sql.DB
    queries *models.Queries
}

func (s *PostService) CreatePost(ctx context.Context, req CreatePostRequest) (*models.Post, error) {
    // Just post creation logic
}

// comments.go
type CommentService struct {
    db      *sql.DB
    queries *models.Queries
}

func (s *CommentService) CreateComment(ctx context.Context, req CreateCommentRequest) (*models.Comment, error) {
    // Just comment logic
}
```

#### Step 2: Extract Thread Management
```go
// threads.go
type ThreadManager struct {
    db      *sql.DB
    queries *models.Queries
}

func (t *ThreadManager) GetThreadedComments(ctx context.Context, postID int32) ([]ThreadedComment, error) {
    // Thread building logic
}

func (t *ThreadManager) BuildCommentTree(comments []models.Comment) []ThreadedComment {
    // Tree structure building
}
```

---

## Service 3: Character Service Decomposition

### Current Structure Analysis
**File**: `backend/pkg/db/services/characters.go`
**Responsibilities mixed**:
- Character CRUD
- NPC assignment
- Permission checks
- Ability management
- Inventory management

### New Structure
```
backend/pkg/db/services/characters/
├── service.go          (150 lines) - Main service
├── crud.go            (200 lines) - Basic operations
├── npcs.go            (150 lines) - NPC logic
├── permissions.go     (100 lines) - Access control
├── abilities.go       (150 lines) - Ability management
└── inventory.go       (150 lines) - Item management
```

---

## Common Refactoring Patterns

### Pattern 1: Service Composition
```go
// Old: Everything in one service
type PhaseService struct {
    db      *sql.DB
    queries *models.Queries
    // ... everything mixed
}

// New: Composed service
type PhaseService struct {
    db          *sql.DB
    queries     *models.Queries
    transitions TransitionManager
    validator   ValidationService
    history     HistoryTracker
    timers      TimerManager
}

func NewPhaseService(db *sql.DB) *PhaseService {
    queries := models.New(db)
    return &PhaseService{
        db:          db,
        queries:     queries,
        transitions: NewTransitionManager(db, queries),
        validator:   NewValidator(queries),
        history:     NewHistoryTracker(db, queries),
        timers:      NewTimerManager(db, queries),
    }
}
```

### Pattern 2: Method Extraction
```go
// Before: 100+ line method
func (s *Service) ComplexOperation(ctx context.Context, id int32) error {
    // validation logic (20 lines)
    // business logic (30 lines)
    // side effects (20 lines)
    // notifications (15 lines)
    // cleanup (15 lines)
}

// After: Composed of smaller methods
func (s *Service) ComplexOperation(ctx context.Context, id int32) error {
    if err := s.validate(ctx, id); err != nil {
        return err
    }

    result, err := s.executeBusinessLogic(ctx, id)
    if err != nil {
        return err
    }

    if err := s.handleSideEffects(ctx, result); err != nil {
        return err
    }

    return s.notifySubscribers(ctx, result)
}
```

### Pattern 3: Reduce Coupling
```go
// Before: Direct dependencies
func (s *PhaseService) TransitionPhase(ctx context.Context, id int32) error {
    // Directly calls message service
    messageService := NewMessageService(s.db)
    messageService.CreateSystemMessage(...)

    // Directly calls notification service
    notificationService := NewNotificationService(s.db)
    notificationService.NotifyUsers(...)
}

// After: Event-driven
func (s *PhaseService) TransitionPhase(ctx context.Context, id int32) error {
    // Just handle the transition
    if err := s.doTransition(ctx, id); err != nil {
        return err
    }

    // Emit event for other services
    return s.eventBus.Publish(PhaseTransitionedEvent{
        PhaseID: id,
        Time:    time.Now(),
    })
}
```

---

## Execution Checklist

### Week 1: Phase Service
- [ ] Day 1: Create package structure and interfaces
- [ ] Day 2: Extract CRUD operations to crud.go
- [ ] Day 3: Extract transition logic to transitions.go
- [ ] Day 4: Extract validation to validation.go
- [ ] Day 5: Split tests and verify all pass

### Week 2: Message Service
- [ ] Day 1: Create package structure
- [ ] Day 2: Separate posts and comments
- [ ] Day 3: Extract thread management
- [ ] Day 4: Move mention logic
- [ ] Day 5: Split tests and verify

### Week 3: Character Service
- [ ] Day 1: Create package structure
- [ ] Day 2: Extract CRUD operations
- [ ] Day 3: Separate NPC logic
- [ ] Day 4: Extract permissions
- [ ] Day 5: Split tests and verify

---

## Verification Steps

After each service refactor:
```bash
# 1. Check file sizes
find backend/pkg/db/services/phases -name "*.go" -exec wc -l {} \;
# No file should be > 400 lines

# 2. Run tests
go test ./backend/pkg/db/services/phases/...
# All should pass

# 3. Check test coverage
go test -cover ./backend/pkg/db/services/phases/...
# Should maintain or improve coverage

# 4. Verify interfaces
go build ./backend/pkg/db/services/phases
# Should compile without errors

# 5. Integration test
go test ./backend/pkg/api/...
# API tests should still pass
```

---

## Migration Safety Checklist

Before starting each refactor:
- [ ] Create feature branch
- [ ] Run full test suite
- [ ] Document current coverage %
- [ ] Identify all callers of service

During refactor:
- [ ] Keep old service working
- [ ] Migrate one method at a time
- [ ] Run tests after each migration
- [ ] Update imports incrementally

After refactor:
- [ ] All tests passing
- [ ] Coverage maintained or improved
- [ ] No performance regression
- [ ] Update documentation
- [ ] Delete old service file
