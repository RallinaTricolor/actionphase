# Feature: [Feature Name]

**Status**: Planning | In Progress | Complete
**Created**: [Date]
**Last Updated**: [Date]
**Owner**: [Developer/AI Session]
**Related ADRs**: [List any relevant ADRs]
**Related Issues**: [GitHub issue numbers if applicable]

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

[Describe the user problem or business need this feature addresses. Be specific about the pain point.]

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: [Specific, measurable goal]
- [ ] Goal 2: [Specific, measurable goal]
- [ ] Goal 3: [Specific, measurable goal]

### Non-Goals
**What is explicitly out of scope?**

- Non-goal 1: [What we're NOT doing]
- Non-goal 2: [Future considerations]

### Success Criteria
**How do we know this feature is successful?**

- [ ] User can [specific action]
- [ ] System handles [edge case]
- [ ] Performance: [metric] under [threshold]
- [ ] Test coverage: >80% for new code
- [ ] All regression tests passing

---

## 2. User Stories

### Primary User Stories
```gherkin
As a [user role]
I want to [action]
So that [benefit]

Acceptance Criteria:
- Given [context]
  When [action]
  Then [expected outcome]
```

**Example:**
```gherkin
As a Game Master
I want to create custom character templates
So that players can quickly create characters that fit my game setting

Acceptance Criteria:
- Given I am a GM in the character_creation phase
  When I create a template with custom fields
  Then players see those fields when creating characters
- Given a player is creating a character
  When they fill out a template form
  Then their data is validated against template constraints
```

### Edge Cases & Error Scenarios
- **Edge Case 1**: [Scenario] → [Expected behavior]
- **Edge Case 2**: [Scenario] → [Expected behavior]
- **Error Scenario 1**: [Failure condition] → [Error message/handling]

---

## 3. Technical Design

### 3.1 Database Schema

**New Tables:**

```sql
-- Describe new tables with full schema
CREATE TABLE [table_name] (
    id SERIAL PRIMARY KEY,
    -- Add columns with constraints
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Add foreign keys
    CONSTRAINT fk_example FOREIGN KEY (example_id)
        REFERENCES examples(id) ON DELETE CASCADE,

    -- Add unique constraints
    UNIQUE(column1, column2)
);

-- Add indexes
CREATE INDEX idx_[table]_[column] ON [table]([column]);
```

**Schema Modifications:**

```sql
-- Add columns to existing tables
ALTER TABLE [existing_table] ADD COLUMN [new_column] [type] [constraints];

-- Add indexes for performance
CREATE INDEX idx_[table]_[column] ON [table]([column]);
```

**Migration Plan:**
1. Migration file: `[timestamp]_[descriptive_name].up.sql`
2. Rollback file: `[timestamp]_[descriptive_name].down.sql`
3. Data migration strategy (if needed): [Describe]

### 3.2 Database Queries (sqlc)

**Location**: `backend/pkg/db/queries/[feature].sql`

```sql
-- name: GetExample :one
SELECT * FROM examples WHERE id = $1;

-- name: CreateExample :one
INSERT INTO examples (
    column1, column2
) VALUES (
    $1, $2
) RETURNING *;

-- name: ListExamples :many
SELECT * FROM examples
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: UpdateExample :exec
UPDATE examples
SET column1 = $1, updated_at = NOW()
WHERE id = $2;

-- name: DeleteExample :exec
DELETE FROM examples WHERE id = $1;
```

**Query Performance Considerations:**
- [ ] Indexes planned for frequently queried columns
- [ ] Query complexity analyzed (N+1 queries avoided)
- [ ] Pagination implemented for list endpoints

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

```go
type ExampleServiceInterface interface {
    CreateExample(ctx context.Context, req *CreateExampleRequest) (*Example, error)
    GetExample(ctx context.Context, id int32) (*Example, error)
    ListExamples(ctx context.Context, filters *ExampleFilters) ([]*Example, error)
    UpdateExample(ctx context.Context, id int32, req *UpdateExampleRequest) (*Example, error)
    DeleteExample(ctx context.Context, id int32) error
}
```

**Domain Models** (`backend/pkg/core/models.go`):

```go
type Example struct {
    ID          int32     `json:"id"`
    Column1     string    `json:"column1"`
    Column2     string    `json:"column2"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
}

type CreateExampleRequest struct {
    Column1 string `json:"column1" validate:"required,min=3,max=100"`
    Column2 string `json:"column2" validate:"required"`
}

type UpdateExampleRequest struct {
    Column1 *string `json:"column1,omitempty" validate:"omitempty,min=3,max=100"`
    Column2 *string `json:"column2,omitempty"`
}
```

**Business Rules:**

1. **Rule 1**: [Description]
   - Validation: [What to check]
   - Error: [Error message if violated]

2. **Rule 2**: [Description]
   - Validation: [What to check]
   - Error: [Error message if violated]

**Example:**
1. **Users can only create one example per category**
   - Validation: Check for existing example with same user_id + category_id
   - Error: "You already have an example in this category"

2. **Examples cannot be deleted if referenced by other entities**
   - Validation: Check for foreign key references
   - Error: "Cannot delete example: currently in use"

### 3.4 API Endpoints

**Base Path**: `/api/v1/[resource]`

#### GET /api/v1/[resource]
**Description**: List all examples
**Auth Required**: Yes
**Permissions**: User must be authenticated

**Query Parameters:**
- `limit` (int, optional): Number of results (default: 20, max: 100)
- `offset` (int, optional): Pagination offset (default: 0)
- `filter_by` (string, optional): Filter criteria

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "column1": "value1",
      "column2": "value2",
      "created_at": "2025-08-07T10:30:00Z",
      "updated_at": "2025-08-07T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

**Error Responses:**
- `401 Unauthorized`: No valid authentication token
- `500 Internal Server Error`: Database error

---

#### POST /api/v1/[resource]
**Description**: Create a new example
**Auth Required**: Yes
**Permissions**: User must be authenticated

**Request Body:**
```json
{
  "column1": "value1",
  "column2": "value2"
}
```

**Response (201 Created):**
```json
{
  "id": 1,
  "column1": "value1",
  "column2": "value2",
  "created_at": "2025-08-07T10:30:00Z",
  "updated_at": "2025-08-07T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
  ```json
  {
    "error": "Validation failed",
    "details": {
      "column1": "must be at least 3 characters"
    }
  }
  ```
- `401 Unauthorized`: No valid authentication token
- `409 Conflict`: Business rule violation (e.g., duplicate)
- `500 Internal Server Error`: Database error

---

#### GET /api/v1/[resource]/:id
**Description**: Get a specific example
**Auth Required**: Yes
**Permissions**: User must own the resource OR be admin

**Response (200 OK):**
```json
{
  "id": 1,
  "column1": "value1",
  "column2": "value2",
  "created_at": "2025-08-07T10:30:00Z",
  "updated_at": "2025-08-07T10:30:00Z"
}
```

**Error Responses:**
- `404 Not Found`: Resource doesn't exist
- `403 Forbidden`: User doesn't have permission
- `401 Unauthorized`: No valid authentication token

---

#### PUT /api/v1/[resource]/:id
**Description**: Update an example
**Auth Required**: Yes
**Permissions**: User must own the resource

**Request Body:**
```json
{
  "column1": "updated_value1",
  "column2": "updated_value2"
}
```

**Response (200 OK):**
```json
{
  "id": 1,
  "column1": "updated_value1",
  "column2": "updated_value2",
  "created_at": "2025-08-07T10:30:00Z",
  "updated_at": "2025-08-07T10:35:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation error
- `404 Not Found`: Resource doesn't exist
- `403 Forbidden`: User doesn't have permission
- `401 Unauthorized`: No valid authentication token

---

#### DELETE /api/v1/[resource]/:id
**Description**: Delete an example
**Auth Required**: Yes
**Permissions**: User must own the resource OR be admin

**Response (204 No Content)**

**Error Responses:**
- `404 Not Found`: Resource doesn't exist
- `403 Forbidden`: User doesn't have permission
- `409 Conflict`: Cannot delete (e.g., referenced by other entities)
- `401 Unauthorized`: No valid authentication token

---

### 3.5 Frontend Components

**Component Hierarchy:**

```
[FeaturePage]
├── [FeatureList]
│   ├── [FeatureCard]
│   └── [EmptyState]
├── [CreateFeatureModal]
│   └── [FeatureForm]
└── [FeatureDetailsPanel]
    ├── [FeatureInfo]
    └── [FeatureActions]
```

**Component Specifications:**

#### Component: `[ComponentName]`
**Location**: `frontend/src/components/[ComponentName].tsx`
**Purpose**: [What this component does]

**Props:**
```typescript
interface ComponentNameProps {
  prop1: string;
  prop2?: number;
  onAction: (data: ActionData) => void;
}
```

**State:**
- Local state: [What state is managed locally]
- Server state: [What data comes from API via React Query]

**API Interactions:**
- `useQuery`: [Which queries this component uses]
- `useMutation`: [Which mutations this component uses]

**User Interactions:**
- Click [element] → [Action happens]
- Submit [form] → [API call] → [Update UI]
- Error state → [Show error message]

---

### 3.6 Frontend API Client

**Location**: `frontend/src/lib/api.ts`

```typescript
class ApiClient {
  // List examples
  async listExamples(filters?: ExampleFilters): Promise<Example[]> {
    const response = await this.client.get<Example[]>('/api/v1/examples', {
      params: filters,
    });
    return response.data;
  }

  // Get single example
  async getExample(id: number): Promise<Example> {
    const response = await this.client.get<Example>(`/api/v1/examples/${id}`);
    return response.data;
  }

  // Create example
  async createExample(data: CreateExampleRequest): Promise<Example> {
    const response = await this.client.post<Example>('/api/v1/examples', data);
    return response.data;
  }

  // Update example
  async updateExample(
    id: number,
    data: UpdateExampleRequest
  ): Promise<Example> {
    const response = await this.client.put<Example>(
      `/api/v1/examples/${id}`,
      data
    );
    return response.data;
  }

  // Delete example
  async deleteExample(id: number): Promise<void> {
    await this.client.delete(`/api/v1/examples/${id}`);
  }
}
```

### 3.7 Frontend Custom Hooks

**Location**: `frontend/src/hooks/useExamples.ts`

```typescript
export function useExamples(filters?: ExampleFilters) {
  return useQuery({
    queryKey: ['examples', filters],
    queryFn: () => apiClient.listExamples(filters),
    staleTime: 30000, // 30 seconds
  });
}

export function useExample(id: number) {
  return useQuery({
    queryKey: ['examples', id],
    queryFn: () => apiClient.getExample(id),
    enabled: !!id,
  });
}

export function useCreateExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExampleRequest) =>
      apiClient.createExample(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['examples'] });
    },
  });
}

export function useUpdateExample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateExampleRequest }) =>
      apiClient.updateExample(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['examples'] });
      queryClient.invalidateQueries({ queryKey: ['examples', variables.id] });
    },
  });
}
```

### 3.8 Frontend Type Definitions

**Location**: `frontend/src/types/[feature].ts`

```typescript
export interface Example {
  id: number;
  column1: string;
  column2: string;
  created_at: string;
  updated_at: string;
}

export interface CreateExampleRequest {
  column1: string;
  column2: string;
}

export interface UpdateExampleRequest {
  column1?: string;
  column2?: string;
}

export interface ExampleFilters {
  limit?: number;
  offset?: number;
  filter_by?: string;
}
```

---

## 4. Testing Strategy

### 4.1 Backend Tests

**Test Files:**
- `backend/pkg/db/services/[feature]_test.go` - Unit tests
- `backend/pkg/[feature]/[feature]_integration_test.go` - Integration tests
- `backend/pkg/[feature]/api_test.go` - API endpoint tests

**Unit Tests (with mocks):**
```go
func TestExampleService_CreateExample(t *testing.T) {
    tests := []struct {
        name    string
        req     *core.CreateExampleRequest
        wantErr bool
        errMsg  string
    }{
        {
            name: "valid example",
            req: &core.CreateExampleRequest{
                Column1: "test",
                Column2: "value",
            },
            wantErr: false,
        },
        {
            name: "missing required field",
            req: &core.CreateExampleRequest{
                Column1: "",
                Column2: "value",
            },
            wantErr: true,
            errMsg: "column1 is required",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

**Integration Tests (with database):**
```go
func TestExampleService_CreateExample_Integration(t *testing.T) {
    pool := testutil.SetupTestDB(t)
    defer testutil.CleanupTestDB(t, pool)

    service := &ExampleService{DB: pool}

    req := &core.CreateExampleRequest{
        Column1: "test",
        Column2: "value",
    }

    example, err := service.CreateExample(context.Background(), req)

    require.NoError(t, err)
    assert.Equal(t, "test", example.Column1)
    assert.NotZero(t, example.ID)
}
```

**API Tests:**
```go
func TestExampleAPI_CreateExample(t *testing.T) {
    // Test HTTP handler with mock service
    // Verify request parsing, validation, response format
}
```

**Test Coverage Goals:**
- [ ] Service layer: >85% coverage
- [ ] API handlers: >80% coverage
- [ ] Business logic: 100% coverage for critical paths

### 4.2 Frontend Tests

**Test Files:**
- `frontend/src/components/__tests__/[ComponentName].test.tsx`
- `frontend/src/hooks/__tests__/use[Feature].test.ts`
- `frontend/src/lib/__tests__/api.[feature].test.ts`

**Component Tests:**
```typescript
describe('ComponentName', () => {
  it('renders example data correctly', async () => {
    // Setup MSW handlers
    server.use(
      http.get('/api/v1/examples', () => {
        return HttpResponse.json([
          { id: 1, column1: 'test', column2: 'value' }
        ]);
      })
    );

    render(<ComponentName />);

    // Assert expected UI
    await waitFor(() => {
      expect(screen.getByText('test')).toBeInTheDocument();
    });
  });

  it('handles create example flow', async () => {
    const user = userEvent.setup();
    render(<ComponentName />);

    // Interact with form
    await user.click(screen.getByRole('button', { name: /create/i }));
    await user.type(screen.getByLabelText(/column1/i), 'test value');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    // Verify mutation called
    await waitFor(() => {
      expect(screen.getByText(/created successfully/i)).toBeInTheDocument();
    });
  });

  it('displays error message on failure', async () => {
    server.use(
      http.post('/api/v1/examples', () => {
        return HttpResponse.json(
          { error: 'Validation failed' },
          { status: 400 }
        );
      })
    );

    // Test error handling
  });
});
```

**Hook Tests:**
```typescript
describe('useExamples', () => {
  it('fetches examples successfully', async () => {
    const { result } = renderHook(() => useExamples(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });
});
```

**Test Coverage Goals:**
- [ ] Components: >80% coverage
- [ ] Custom hooks: >85% coverage
- [ ] User interactions: All primary flows tested

### 4.3 Regression Tests

**Critical Bugs to Prevent:**

1. **Bug**: [Description of past bug this feature might reintroduce]
   - **Test**: [Specific test to prevent regression]
   - **Location**: [Test file]

**Example:**
1. **Bug**: Users could delete examples still referenced by other entities
   - **Test**: `TestExampleService_Delete_PreventsCascadeFailure`
   - **Location**: `backend/pkg/db/services/example_test.go:150`

---

## 5. Implementation Plan

### Phase 1: Database & Backend Foundation
**Estimated Time**: [X hours/days]

- [ ] Create database migration files
  - [ ] `.up.sql` with new tables/columns
  - [ ] `.down.sql` with rollback logic
- [ ] Write SQL queries in `queries/[feature].sql`
- [ ] Run `just sqlgen` to generate models
- [ ] Define service interface in `core/interfaces.go`
- [ ] Define domain models in `core/models.go`
- [ ] Create service implementation skeleton
- [ ] **Write unit tests first** (TDD)
- [ ] Implement service methods
- [ ] Verify compile-time interface compliance
- [ ] Run tests: `just test-mocks`

**Acceptance Criteria:**
- [ ] Migration applies and rolls back cleanly
- [ ] sqlc generates code without errors
- [ ] All unit tests passing
- [ ] Service implements interface correctly

### Phase 2: API Endpoints
**Estimated Time**: [X hours/days]

- [ ] Create handler file `pkg/[feature]/api.go`
- [ ] Implement HTTP handlers for each endpoint
- [ ] Add request validation
- [ ] Add error handling with correlation IDs
- [ ] Add routes to `pkg/http/root.go`
- [ ] Add authentication middleware
- [ ] **Write API integration tests**
- [ ] Test with database: `SKIP_DB_TESTS=false just test`
- [ ] Manual testing with curl/Postman

**Acceptance Criteria:**
- [ ] All endpoints return correct status codes
- [ ] Request validation works
- [ ] Error responses are properly formatted
- [ ] Authentication/authorization enforced
- [ ] All API tests passing

### Phase 3: Frontend Implementation
**Estimated Time**: [X hours/days]

- [ ] Add API client methods to `lib/api.ts`
- [ ] Create type definitions in `types/[feature].ts`
- [ ] Implement custom hooks in `hooks/use[Feature].ts`
- [ ] **Write hook tests**
- [ ] Create components (start with leaf components)
- [ ] **Write component tests**
- [ ] Integrate with pages
- [ ] Add loading states
- [ ] Add error handling
- [ ] Style with Tailwind CSS
- [ ] Run tests: `just test-frontend`

**Acceptance Criteria:**
- [ ] Components render correctly
- [ ] API calls work end-to-end
- [ ] Loading states display properly
- [ ] Error messages are user-friendly
- [ ] All frontend tests passing
- [ ] Responsive design works

### Phase 4: Integration & Testing
**Estimated Time**: [X hours/days]

- [ ] Manual end-to-end testing
  - [ ] Happy path: [Describe flow]
  - [ ] Error scenarios: [List key errors to test]
  - [ ] Edge cases: [List edge cases]
- [ ] Performance testing
  - [ ] Load testing with [N] concurrent users
  - [ ] Query performance analysis
- [ ] Security review
  - [ ] Authorization checks
  - [ ] Input validation
  - [ ] SQL injection prevention
- [ ] Documentation updates
  - [ ] Update API documentation
  - [ ] Add user guide (if needed)
  - [ ] Update ADRs (if architectural decision made)

**Acceptance Criteria:**
- [ ] All manual test scenarios pass
- [ ] Performance meets requirements
- [ ] Security review complete
- [ ] Documentation updated

---

## 6. Rollout Strategy

### Deployment Checklist
- [ ] Database migrations tested in staging
- [ ] Feature flag enabled (if applicable)
- [ ] Monitoring/alerts configured
- [ ] Rollback plan documented
- [ ] Stakeholders notified

### Rollback Plan
**If deployment fails:**

1. Disable feature flag (if applicable)
2. Rollback migration: `just migrate_down`
3. Revert backend code deployment
4. Revert frontend code deployment
5. Verify system stability

**Rollback triggers:**
- Critical bug discovered
- Performance degradation >20%
- User-facing errors >5%

---

## 7. Monitoring & Observability

### Metrics to Track
- [ ] API endpoint latency (p50, p95, p99)
- [ ] Error rate per endpoint
- [ ] Database query performance
- [ ] User adoption rate

### Logging
- [ ] All errors logged with correlation IDs
- [ ] Business events logged (create, update, delete)
- [ ] Performance issues logged

### Alerts
- [ ] Error rate >5% → Alert team
- [ ] API latency p95 >500ms → Warning
- [ ] Database query timeout → Critical

---

## 8. Documentation

### User Documentation
- [ ] Feature guide added to docs
- [ ] API endpoints documented (OpenAPI)
- [ ] Common workflows documented

### Developer Documentation
- [ ] Code comments added
- [ ] Architecture decision recorded (ADR if needed)
- [ ] README updated with new commands/setup

---

## 9. Open Questions

**Technical Questions:**
- [ ] Question 1: [Question] → [Decision/Status]
- [ ] Question 2: [Question] → [Decision/Status]

**Product Questions:**
- [ ] Question 1: [Question] → [Decision/Status]

**Performance Questions:**
- [ ] Question 1: [Question] → [Decision/Status]

---

## 10. Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Database migration fails | Low | High | Test in staging, have rollback ready |
| API performance issues | Medium | Medium | Add indexes, implement caching |
| Breaking API changes | Low | High | Version API, maintain backward compat |

### Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Low user adoption | Medium | Medium | User testing before launch |
| Feature creep | High | Low | Stick to defined scope |

---

## 11. Future Enhancements

**Post-MVP Ideas:**
- Enhancement 1: [Description]
- Enhancement 2: [Description]
- Enhancement 3: [Description]

**Technical Debt:**
- Debt 1: [Description] → [Plan to address]
- Debt 2: [Description] → [Plan to address]

---

## 12. References

### Related Documentation
- ADR-XXX: [Link to related ADR]
- Architecture Doc: [Link to relevant architecture doc]
- Design Document: [Link to design doc]

### External Resources
- [Technology documentation]
- [Best practices guide]

---

## Session Log

### Session 1 - [Date]
**Accomplished:**
- [What was done]

**Next Steps:**
- [What to do next]

### Session 2 - [Date]
**Accomplished:**
- [What was done]

**Blockers:**
- [Any issues]

**Next Steps:**
- [What to do next]

---

## Completion Checklist

**Before marking feature complete:**

- [ ] All phases implemented
- [ ] All tests passing (>80% coverage)
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] User acceptance testing complete
- [ ] Deployed to production
- [ ] Monitoring confirmed working
- [ ] Team notified
- [ ] Feature marked complete in tracking system

**Archive this plan to** `.claude/planning/archive/` **when complete.**
