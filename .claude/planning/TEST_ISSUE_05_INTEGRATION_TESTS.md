# Test Issue #5: Missing Integration and API Contract Tests

## Status: 🟡 HIGH PRIORITY - Not Started

## Problem Statement
No comprehensive integration tests exist that validate complete workflows across multiple components. API contracts are not validated, leading to potential breaking changes.

## Current State
- No end-to-end API workflow tests
- No API contract validation
- No multi-user scenario tests
- No complex state transition tests
- Minimal cross-service integration tests

## Business Impact
- 🟡 **Breaking Changes**: API changes break clients
- 🟡 **Workflow Bugs**: Multi-step processes fail
- 🟡 **State Corruption**: Invalid state combinations

## Required Integration Tests

### 1. Complete User Journey Tests
```go
func TestCompleteGameLifecycle(t *testing.T) {
    // 1. GM creates game
    // 2. Players join game
    // 3. Characters created
    // 4. Game starts
    // 5. Phases progress
    // 6. Actions submitted
    // 7. Results posted
    // 8. Game completes
}
```

### 2. Multi-User Scenarios
```go
func TestConcurrentPlayerActions(t *testing.T) {
    // Setup game with multiple players
    // Simulate concurrent:
    //   - Character creation
    //   - Action submissions
    //   - Message posting
    // Verify no conflicts or data loss
}
```

### 3. API Contract Tests
```go
func TestAPIContracts(t *testing.T) {
    t.Run("GET /games response schema", func(t *testing.T) {
        resp := getGames()
        validateSchema(t, resp, gamesListSchema)
    })

    t.Run("POST /games request validation", func(t *testing.T) {
        // Test required fields
        // Test field types
        // Test field constraints
    })
}
```

## Implementation Structure

### integration_test Package
```
backend/tests/integration/
├── game_lifecycle_test.go
├── auth_flow_test.go
├── character_workflow_test.go
├── phase_transitions_test.go
├── messaging_flow_test.go
└── helpers_test.go
```

### Test Patterns

#### Workflow Test Pattern
```go
func TestCharacterCreationWorkflow(t *testing.T) {
    // Setup
    db := setupTestDB(t)
    gm := createTestGM(t, db)
    game := createTestGame(t, db, gm)
    player := createTestPlayer(t, db)

    // Join game
    err := joinGame(player, game)
    require.NoError(t, err)

    // Create character
    char := createCharacter(player, game)
    require.NotNil(t, char)

    // Verify state
    assert.Equal(t, "pending_approval", char.Status)

    // GM approves
    err = approveCharacter(gm, char)
    require.NoError(t, err)

    // Verify final state
    char = getCharacter(char.ID)
    assert.Equal(t, "approved", char.Status)
}
```

#### API Contract Test Pattern
```go
type GameResponse struct {
    ID          int       `json:"id" validate:"required"`
    Title       string    `json:"title" validate:"required,max=255"`
    State       string    `json:"state" validate:"required,oneof=setup recruiting active"`
    CreatedAt   time.Time `json:"created_at" validate:"required"`
}

func TestGameAPIContract(t *testing.T) {
    resp := httpGet(t, "/api/v1/games/1")

    var game GameResponse
    json.Unmarshal(resp.Body, &game)

    // Validate structure
    v := validator.New()
    err := v.Struct(game)
    assert.NoError(t, err)
}
```

## Test Scenarios

### Priority 1: Core Workflows
- User registration → email verification → login
- Create game → recruit players → start game
- Submit action → GM review → post results
- Character death → resurrection → continue play

### Priority 2: Edge Cases
- Player leaves mid-game
- GM transfers ownership
- Game paused and resumed
- Rollback after error

### Priority 3: Performance
- 100 concurrent users
- Large game with 50 players
- Phase with 1000 messages
- Bulk operations

## API Contract Validation

### Response Schemas
```yaml
# games_list.yaml
type: array
items:
  type: object
  required: [id, title, state, gm_user_id, created_at]
  properties:
    id: {type: integer}
    title: {type: string, maxLength: 255}
    state: {type: string, enum: [setup, recruiting, active, paused, completed]}
```

### Validation Implementation
```go
func validateAPIResponse(t *testing.T, response []byte, schemaFile string) {
    schema := loadSchema(schemaFile)
    result := schema.Validate(response)
    assert.True(t, result.Valid(), result.Errors())
}
```

## Success Criteria
- [ ] 10+ complete workflow tests
- [ ] All major user journeys covered
- [ ] API contracts validated
- [ ] Multi-user scenarios tested
- [ ] State transitions verified

## Testing Infrastructure

### Required Helpers
```go
// Test data builders
func NewGameBuilder() *GameBuilder
func NewUserBuilder() *UserBuilder
func NewCharacterBuilder() *CharacterBuilder

// API helpers
func authenticatedRequest(user *User, method, path string, body interface{})
func validateJSONSchema(t *testing.T, data []byte, schema Schema)

// Workflow helpers
func runGameToPhase(game *Game, targetPhase string)
func simulatePlayerActions(players []*User, actions []Action)
```

## Estimated Effort
**12 hours** - Complex multi-component testing

## Next Actions
1. Create integration test package structure
2. Build test data helpers
3. Implement first complete workflow test
4. Add API contract validation
5. Add concurrent user scenarios
