# Feature: Admin View and Administration Mode

**Status**: Planning
**Created**: 2025-10-21
**Last Updated**: 2025-10-21
**Owner**: AI Session
**Related ADRs**: ADR-003 (Authentication Strategy)
**Related Issues**: N/A

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

Currently, there is no way for platform administrators to moderate content, manage games, or perform administrative actions across the system. As the platform grows, moderation capabilities are essential for:
- Removing offensive or rule-violating content
- Investigating issues reported by users
- Managing games that have problematic situations
- Granting administrative access to trusted moderators

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: Add `is_admin` flag to users table to designate administrators
- [ ] Goal 2: Implement admin mode toggle that allows admins to access all games
- [ ] Goal 3: Provide admins with GM-level visibility into all games when admin mode is enabled
- [ ] Goal 4: Allow admins to delete (but not edit) comments and posts
- [ ] Goal 5: Add visual indication when admin mode is active
- [ ] Goal 6: Allow admins to ban users from the platform
- [ ] Goal 7: Banned users cannot log in or access the platform

### Non-Goals
**What is explicitly out of scope?**

- Non-goal 1: Admin-specific UI for user management dashboard (can be added later)
- Non-goal 2: Audit logging of admin actions (future enhancement)
- Non-goal 3: Role-based permissions beyond simple is_admin flag
- Non-goal 4: Admin ability to edit content (only delete)
- Non-goal 5: Admin dashboard or analytics
- Non-goal 6: Temporary bans with expiration dates (only permanent bans in v1)
- Non-goal 7: Ban appeals process (can be added later)

### Success Criteria
**How do we know this feature is successful?**

- [ ] Admin users can toggle admin mode on/off
- [ ] When admin mode is enabled, admins can view any game with GM-level access
- [ ] Admins can delete comments and posts in any game
- [ ] Visual indicator shows when admin mode is active
- [ ] Non-admin users cannot access admin features
- [ ] Unit test coverage: >80% for service layer
- [ ] Integration tests: All API endpoints tested
- [ ] Component test coverage: >80% for frontend
- [ ] All regression tests passing
- [ ] Manual UI testing complete with documented flows

---

## 2. User Stories

### Primary User Stories

```gherkin
As a platform administrator
I want to enable admin mode
So that I can access and moderate all games on the platform

Acceptance Criteria:
- Given I am logged in as an admin user
  When I toggle admin mode on
  Then I see a visual indicator that admin mode is active
  And I gain access to view all games
```

```gherkin
As a platform administrator in admin mode
I want to delete inappropriate comments
So that I can maintain community standards

Acceptance Criteria:
- Given I am in admin mode viewing a game
  When I click delete on an offensive comment
  Then the comment is soft-deleted and shows "[deleted]"
  And the thread structure is preserved
  And I cannot edit the comment content
```

```gherkin
As a regular user
I want admin actions to be clearly indicated
So that I know when content was removed by an admin

Acceptance Criteria:
- Given a comment was deleted by an admin
  When I view the thread
  Then I see "[deleted]" placeholder text
  And the thread structure remains intact
```

```gherkin
As a platform administrator
I want to ban problematic users
So that I can protect the community from harassment and abuse

Acceptance Criteria:
- Given I am in admin mode viewing a user's profile
  When I click "Ban User" and confirm
  Then the user is marked as banned in the database
  And they are immediately logged out
  And they cannot log back in
  And I see a confirmation that the user was banned
```

```gherkin
As a banned user
I want to see a clear message when I try to log in
So that I understand why I cannot access the platform

Acceptance Criteria:
- Given I am a banned user
  When I attempt to log in with correct credentials
  Then I see an error message: "Your account has been banned"
  And I am not logged in
  And no session is created
```

### Edge Cases & Error Scenarios

- **Edge Case 1**: Admin mode persists across page refreshes → Stored in localStorage and backend session
- **Edge Case 2**: User is made admin while logged in → Must log out and back in to see admin features
- **Edge Case 3**: Admin mode is toggled off → Immediately loses access to games they're not GM/player of
- **Edge Case 4**: Admin bans themselves → Prevented with warning in UI
- **Edge Case 5**: Banned user has active sessions → All sessions invalidated immediately
- **Edge Case 6**: Admin bans another admin → Allowed (with confirmation)
- **Error Scenario 1**: Non-admin tries to access admin endpoint → 403 Forbidden error
- **Error Scenario 2**: Admin tries to delete already-deleted comment → 404 Not Found
- **Error Scenario 3**: Admin tries to ban non-existent user → 404 Not Found
- **Error Scenario 4**: Banned user tries to access API with valid token → 401 Unauthorized with ban message

---

## 3. Technical Design

### 3.1 Database Schema

**Schema Modifications:**

```sql
-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE NOT NULL;

-- Add is_banned column to users table
ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT FALSE NOT NULL;

-- Add banned_at timestamp for tracking when user was banned
ALTER TABLE users ADD COLUMN banned_at TIMESTAMP;

-- Add banned_by_user_id to track which admin banned the user
ALTER TABLE users ADD COLUMN banned_by_user_id INTEGER REFERENCES users(id);

-- Create index for faster admin user lookups
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;

-- Create index for faster banned user lookups
CREATE INDEX idx_users_is_banned ON users(is_banned) WHERE is_banned = TRUE;

-- Manually set initial admin (run separately)
-- UPDATE users SET is_admin = TRUE WHERE email = 'admin@example.com';
```

**Migration Plan:**
1. Migration file: `[timestamp]_add_is_admin_to_users.up.sql`
2. Rollback file: `[timestamp]_add_is_admin_to_users.down.sql`
3. Data migration strategy: Initially set via manual SQL, then admin can promote others via future UI

### 3.2 Database Queries (sqlc)

**Location**: `backend/pkg/db/queries/users.sql`

```sql
-- name: GetUserByID :one
-- (Update existing query to include is_admin and is_banned)
SELECT id, username, email, password_hash, is_admin, is_banned, banned_at, banned_by_user_id, created_at, updated_at
FROM users
WHERE id = $1;

-- name: GetUserByEmail :one
-- (Update existing query to include is_admin and is_banned)
SELECT id, username, email, password_hash, is_admin, is_banned, banned_at, banned_by_user_id, created_at, updated_at
FROM users
WHERE email = $1;

-- name: UpdateUserAdminStatus :exec
UPDATE users
SET is_admin = $1, updated_at = NOW()
WHERE id = $2;

-- name: ListAdmins :many
SELECT id, username, email, created_at
FROM users
WHERE is_admin = TRUE
ORDER BY created_at ASC;

-- name: BanUser :exec
UPDATE users
SET is_banned = TRUE,
    banned_at = NOW(),
    banned_by_user_id = $2,
    updated_at = NOW()
WHERE id = $1;

-- name: UnbanUser :exec
UPDATE users
SET is_banned = FALSE,
    banned_at = NULL,
    banned_by_user_id = NULL,
    updated_at = NOW()
WHERE id = $1;

-- name: ListBannedUsers :many
SELECT id, username, email, banned_at, banned_by_user_id, created_at
FROM users
WHERE is_banned = TRUE
ORDER BY banned_at DESC;

-- name: DeleteUserSessions :exec
-- Invalidate all sessions for a banned user
DELETE FROM sessions
WHERE user_id = $1;
```

**Query Performance Considerations:**
- [x] Index on is_admin for faster admin lookups (partial index for TRUE values only)
- [x] No N+1 queries (admin check is part of user fetch)
- [x] Pagination not needed (admin list will be small)

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

```go
// Add to existing UserServiceInterface
type UserServiceInterface interface {
    // ... existing methods ...

    // Admin management
    SetAdminStatus(ctx context.Context, userID int32, isAdmin bool) error
    ListAdmins(ctx context.Context) ([]*User, error)

    // User banning
    BanUser(ctx context.Context, userID int32, adminID int32) error
    UnbanUser(ctx context.Context, userID int32) error
    ListBannedUsers(ctx context.Context) ([]*User, error)
    CheckUserBanned(ctx context.Context, userID int32) (bool, error)
}

// Add new middleware interface for admin checks
type AdminMiddleware interface {
    RequireAdmin(next http.Handler) http.Handler
    GetAdminStatus(ctx context.Context, userID int32) (bool, error)
}

// Add to existing SessionServiceInterface
type SessionServiceInterface interface {
    // ... existing methods ...

    // Session invalidation
    InvalidateAllUserSessions(ctx context.Context, userID int32) error
}
```

**Domain Models** (`backend/pkg/core/models.go`):

```go
// Update existing User model
type User struct {
    ID            int32      `json:"id"`
    Username      string     `json:"username"`
    Email         string     `json:"email"`
    PasswordHash  string     `json:"-"` // Never expose in JSON
    IsAdmin       bool       `json:"is_admin"`
    IsBanned      bool       `json:"is_banned"`
    BannedAt      *time.Time `json:"banned_at,omitempty"`
    BannedByUserID *int32    `json:"banned_by_user_id,omitempty"`
    CreatedAt     time.Time  `json:"created_at"`
    UpdatedAt     time.Time  `json:"updated_at"`
}

type BanUserRequest struct {
    Reason string `json:"reason" validate:"required,min=10,max=500"`
}

type BannedUserResponse struct {
    ID            int32     `json:"id"`
    Username      string    `json:"username"`
    Email         string    `json:"email"`
    BannedAt      time.Time `json:"banned_at"`
    BannedByUserID int32    `json:"banned_by_user_id"`
    BannedByUsername string `json:"banned_by_username"`
}
```

**Business Rules:**

1. **Only admins can grant admin status**
   - Validation: Check requesting user is_admin = TRUE
   - Error: "Unauthorized: admin privileges required"

2. **Admins can demote themselves (with warning)**
   - Validation: Allow but warn in UI
   - Error: N/A (allowed)

3. **Admin status persists across sessions**
   - Validation: Stored in database, not session-only
   - Error: N/A (not an error condition)

4. **Only admins can ban users**
   - Validation: Check requesting user is_admin = TRUE
   - Error: "Unauthorized: admin privileges required"

5. **Admins cannot ban themselves**
   - Validation: Check userID != adminID
   - Error: "Cannot ban yourself"

6. **Banned users cannot log in**
   - Validation: Check is_banned = FALSE during login
   - Error: "Your account has been banned. Contact support for more information."

7. **Banning a user invalidates all their sessions**
   - Implementation: Delete all sessions for user when banned
   - User is immediately logged out

8. **Unbanning a user is allowed (with confirmation)**
   - Implementation: Set is_banned = FALSE, clear banned_at and banned_by_user_id
   - User can then log in again

### 3.4 API Endpoints

**Base Path**: `/api/v1/admin`

#### GET /api/v1/users/me
**Description**: Get current user info (existing endpoint, now includes is_admin)
**Auth Required**: Yes
**Permissions**: User must be authenticated

**Response (200 OK):**
```json
{
  "id": 1,
  "username": "admin_user",
  "email": "admin@example.com",
  "is_admin": true,
  "created_at": "2025-10-21T10:00:00Z",
  "updated_at": "2025-10-21T10:00:00Z"
}
```

---

#### GET /api/v1/admin/users
**Description**: List all admin users
**Auth Required**: Yes
**Permissions**: User must be admin

**Response (200 OK):**
```json
{
  "admins": [
    {
      "id": 1,
      "username": "admin_user",
      "email": "admin@example.com",
      "created_at": "2025-10-21T10:00:00Z"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User is not an admin
- `500 Internal Server Error`: Database error

---

#### PUT /api/v1/admin/users/:id/admin-status
**Description**: Grant or revoke admin status for a user
**Auth Required**: Yes
**Permissions**: User must be admin

**Request Body:**
```json
{
  "is_admin": true
}
```

**Response (200 OK):**
```json
{
  "message": "Admin status updated successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request body
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User is not an admin
- `404 Not Found`: User doesn't exist
- `500 Internal Server Error`: Database error

---

#### PUT /api/v1/admin/users/:id/ban
**Description**: Ban a user from the platform
**Auth Required**: Yes
**Permissions**: User must be admin

**Request Body:**
```json
{
  "reason": "Harassment and violation of community guidelines"
}
```

**Response (200 OK):**
```json
{
  "message": "User banned successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid request body or trying to ban yourself
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User is not an admin
- `404 Not Found`: User doesn't exist
- `500 Internal Server Error`: Database error

---

#### PUT /api/v1/admin/users/:id/unban
**Description**: Unban a previously banned user
**Auth Required**: Yes
**Permissions**: User must be admin

**Response (200 OK):**
```json
{
  "message": "User unbanned successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User is not an admin
- `404 Not Found`: User doesn't exist
- `500 Internal Server Error`: Database error

---

#### GET /api/v1/admin/users/banned
**Description**: List all banned users
**Auth Required**: Yes
**Permissions**: User must be admin

**Response (200 OK):**
```json
{
  "banned_users": [
    {
      "id": 123,
      "username": "banned_user",
      "email": "banned@example.com",
      "banned_at": "2025-10-21T10:00:00Z",
      "banned_by_user_id": 1,
      "banned_by_username": "admin_user"
    }
  ]
}
```

**Error Responses:**
- `401 Unauthorized`: No valid authentication token
- `403 Forbidden`: User is not an admin
- `500 Internal Server Error`: Database error

---

### 3.5 Frontend Components

**Component Hierarchy:**

```
[DashboardPage]
├── [AdminModeToggle] (new component in header)
│   └── [Toggle] (UI component)
└── [existing content]

[GameDetailsPage]
├── [AdminBanner] (visible when admin mode is on)
└── [existing content with admin actions]

[UserProfilePage] (or user management UI)
├── [BanUserButton] (new)
│   └── [BanUserModal] (new)
└── [existing content]

[AdminPanel] (optional - future enhancement)
├── [BannedUsersList] (new)
└── [AdminActions]
```

**Component Specifications:**

#### Component: `AdminModeToggle`
**Location**: `frontend/src/components/AdminModeToggle.tsx`
**Purpose**: Toggle admin mode on/off with visual feedback

**Props:**
```typescript
interface AdminModeToggleProps {
  // No props needed - uses AuthContext
}
```

**State:**
- Local state: `adminModeEnabled` (boolean) - stored in localStorage
- Server state: User's is_admin flag from AuthContext

**API Interactions:**
- `useAuth`: Access current user's is_admin status
- No API calls needed (toggle is client-side preference)

**User Interactions:**
- Click toggle → Set localStorage and update UI state
- Shows badge when admin mode is on

---

#### Component: `AdminBanner`
**Location**: `frontend/src/components/AdminBanner.tsx`
**Purpose**: Visual indicator that admin mode is active

**Props:**
```typescript
interface AdminBannerProps {
  // No props needed
}
```

**State:**
- Local state: None
- Server state: Admin mode status from AdminContext

**User Interactions:**
- Click "Exit Admin Mode" → Toggles admin mode off

---

#### Component: `BanUserButton`
**Location**: `frontend/src/components/admin/BanUserButton.tsx`
**Purpose**: Button to ban a user, shown to admins

**Props:**
```typescript
interface BanUserButtonProps {
  userId: number;
  username: string;
}
```

**State:**
- Local state: `isModalOpen` (boolean)

**User Interactions:**
- Click button → Opens BanUserModal

---

#### Component: `BanUserModal`
**Location**: `frontend/src/components/admin/BanUserModal.tsx`
**Purpose**: Confirmation modal for banning a user with reason input

**Props:**
```typescript
interface BanUserModalProps {
  userId: number;
  username: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**State:**
- Local state: `reason` (string), `isSubmitting` (boolean)
- Server state: Uses `useBanUser` mutation

**API Interactions:**
- `useBanUser`: Ban user mutation

**User Interactions:**
- Enter ban reason (required, min 10 chars)
- Click "Ban User" → Submit ban
- Shows confirmation before banning
- Shows success message on completion

**Styling:**
- Use semantic warning/danger colors for destructive action
- Clear warning that this will immediately log out the user
- Confirmation checkbox: "I understand this will ban [username]"

---

### 3.6 Frontend API Client

**Location**: `frontend/src/lib/api.ts`

```typescript
class ApiClient {
  // Admin endpoints
  admin = {
    // List all admin users
    async listAdmins(): Promise<{ admins: AdminUser[] }> {
      const response = await this.client.get<{ admins: AdminUser[] }>(
        '/api/v1/admin/users'
      );
      return response.data;
    },

    // Set admin status for a user
    async setAdminStatus(userId: number, isAdmin: boolean): Promise<void> {
      await this.client.put(`/api/v1/admin/users/${userId}/admin-status`, {
        is_admin: isAdmin,
      });
    },

    // Ban a user
    async banUser(userId: number, reason: string): Promise<void> {
      await this.client.put(`/api/v1/admin/users/${userId}/ban`, {
        reason: reason,
      });
    },

    // Unban a user
    async unbanUser(userId: number): Promise<void> {
      await this.client.put(`/api/v1/admin/users/${userId}/unban`);
    },

    // List banned users
    async listBannedUsers(): Promise<{ banned_users: BannedUserResponse[] }> {
      const response = await this.client.get<{ banned_users: BannedUserResponse[] }>(
        '/api/v1/admin/users/banned'
      );
      return response.data;
    },
  };
}
```

### 3.7 Frontend Custom Hooks

**Location**: `frontend/src/hooks/useAdminMode.ts` and `frontend/src/hooks/useAdmin.ts`

```typescript
// useAdminMode.ts
export function useAdminMode() {
  const { user } = useAuth();
  const [adminModeEnabled, setAdminModeEnabled] = useState(() => {
    if (!user?.is_admin) return false;
    return localStorage.getItem('admin_mode_enabled') === 'true';
  });

  const toggleAdminMode = useCallback(() => {
    if (!user?.is_admin) return;

    const newValue = !adminModeEnabled;
    setAdminModeEnabled(newValue);
    localStorage.setItem('admin_mode_enabled', String(newValue));
  }, [user?.is_admin, adminModeEnabled]);

  return {
    isAdmin: user?.is_admin ?? false,
    adminModeEnabled,
    toggleAdminMode,
  };
}

// useAdmin.ts - Ban functionality hooks
export function useBanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason: string }) =>
      apiClient.admin.banUser(userId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['banned-users'] });
    },
  });
}

export function useUnbanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => apiClient.admin.unbanUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['banned-users'] });
    },
  });
}

export function useBannedUsers() {
  return useQuery({
    queryKey: ['banned-users'],
    queryFn: () => apiClient.admin.listBannedUsers(),
  });
}
```

### 3.8 Frontend Type Definitions

**Location**: `frontend/src/types/users.ts`

```typescript
export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_banned: boolean;
  banned_at?: string;
  banned_by_user_id?: number;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface BannedUserResponse {
  id: number;
  username: string;
  email: string;
  banned_at: string;
  banned_by_user_id: number;
  banned_by_username: string;
}

export interface BanUserRequest {
  reason: string;
}
```

---

## 4. Testing Strategy

**Testing Philosophy**: This feature emphasizes **unit tests** and **integration tests** as the primary quality gates. Manual UI testing validates user experience.

**Test Pyramid Focus**:
```
Manual UI Testing     ← Developer validates admin flows in browser
   ↑
Integration Tests     ← API endpoints with real database
   ↑
Unit Tests           ← Service logic with permission checks
```

---

### 4.1 Backend Tests

**Test Files:**
- `backend/pkg/db/services/user_service_test.go` - Unit tests
- `backend/pkg/auth/admin_middleware_test.go` - Middleware tests
- `backend/pkg/admin/api_test.go` - API endpoint tests

**Unit Tests:**
```go
func TestUserService_SetAdminStatus(t *testing.T) {
    tests := []struct {
        name        string
        userID      int32
        isAdmin     bool
        requesterID int32
        wantErr     bool
        errMsg      string
    }{
        {
            name:        "admin can grant admin status",
            userID:      2,
            isAdmin:     true,
            requesterID: 1, // admin user
            wantErr:     false,
        },
        {
            name:        "non-admin cannot grant admin status",
            userID:      2,
            isAdmin:     true,
            requesterID: 3, // non-admin user
            wantErr:     true,
            errMsg:      "Unauthorized: admin privileges required",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

**Middleware Tests:**
```go
func TestAdminMiddleware_RequireAdmin(t *testing.T) {
    tests := []struct {
        name           string
        userID         int32
        isAdmin        bool
        expectStatus   int
    }{
        {
            name:         "admin user passes",
            userID:       1,
            isAdmin:      true,
            expectStatus: 200,
        },
        {
            name:         "non-admin user blocked",
            userID:       2,
            isAdmin:      false,
            expectStatus: 403,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test middleware
        })
    }
}
```

**Test Coverage Goals:**
- [ ] Service layer: >90% coverage (critical security feature)
- [ ] Middleware: 100% coverage (authentication/authorization)
- [ ] API handlers: >85% coverage

### 4.2 Frontend Tests

**Test Files:**
- `frontend/src/components/__tests__/AdminModeToggle.test.tsx`
- `frontend/src/components/__tests__/AdminBanner.test.tsx`
- `frontend/src/hooks/__tests__/useAdminMode.test.ts`

**Component Tests:**
```typescript
describe('AdminModeToggle', () => {
  it('shows toggle only for admin users', () => {
    const { rerender } = render(<AdminModeToggle />, {
      wrapper: createAuthWrapper({ is_admin: true }),
    });

    expect(screen.getByRole('switch')).toBeInTheDocument();

    rerender(<AdminModeToggle />, {
      wrapper: createAuthWrapper({ is_admin: false }),
    });

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('toggles admin mode on click', async () => {
    const user = userEvent.setup();
    render(<AdminModeToggle />, {
      wrapper: createAuthWrapper({ is_admin: true }),
    });

    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(localStorage.getItem('admin_mode_enabled')).toBe('true');
  });
});

describe('AdminBanner', () => {
  it('displays when admin mode is enabled', () => {
    localStorage.setItem('admin_mode_enabled', 'true');

    render(<AdminBanner />, {
      wrapper: createAuthWrapper({ is_admin: true }),
    });

    expect(screen.getByText(/admin mode active/i)).toBeInTheDocument();
  });

  it('does not display when admin mode is off', () => {
    localStorage.setItem('admin_mode_enabled', 'false');

    render(<AdminBanner />, {
      wrapper: createAuthWrapper({ is_admin: true }),
    });

    expect(screen.queryByText(/admin mode active/i)).not.toBeInTheDocument();
  });
});
```

**Hook Tests:**
```typescript
describe('useAdminMode', () => {
  it('returns false for non-admin users', () => {
    const { result } = renderHook(() => useAdminMode(), {
      wrapper: createAuthWrapper({ is_admin: false }),
    });

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.adminModeEnabled).toBe(false);
  });

  it('allows admin to toggle admin mode', () => {
    const { result } = renderHook(() => useAdminMode(), {
      wrapper: createAuthWrapper({ is_admin: true }),
    });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.adminModeEnabled).toBe(false);

    act(() => {
      result.current.toggleAdminMode();
    });

    expect(result.current.adminModeEnabled).toBe(true);
  });
});
```

**Test Coverage Goals:**
- [ ] Components: >85% coverage
- [ ] Custom hooks: >90% coverage
- [ ] Admin-specific permission checks: 100% coverage

### 4.3 Regression Tests

**Critical Bugs to Prevent:**

1. **Bug**: Non-admin users gaining admin access through client-side manipulation
   - **Test**: `TestAdminMiddleware_BlocksClientSideAdminToggle`
   - **Location**: `backend/pkg/auth/admin_middleware_test.go`

2. **Bug**: Admin status not persisting after logout/login
   - **Test**: `TestUserService_AdminStatusPersists`
   - **Location**: `backend/pkg/db/services/user_service_test.go`

### 4.4 Manual UI Testing Checklist

**After implementation, manually verify the following in the running application:**

**Happy Path Testing:**
- [ ] Log in as admin user
- [ ] Verify admin toggle appears in navigation
- [ ] Toggle admin mode on
- [ ] Verify admin mode banner appears
- [ ] Navigate to a game where user is not GM/player
- [ ] Verify can view game with GM-level access
- [ ] Toggle admin mode off
- [ ] Verify lose access to non-participated games

**Error Handling Testing:**
- [ ] Log in as non-admin user → Verify no admin toggle
- [ ] Try to access admin API as non-admin → Verify 403 error
- [ ] Admin mode state persists across page refresh
- [ ] Admin mode turns off when logging out

**UI/UX Testing:**
- [ ] Admin mode toggle is clearly visible
- [ ] Admin banner is prominent and dismissable
- [ ] Color scheme for admin mode is distinct (use semantic warning colors)
- [ ] Keyboard navigation works for admin toggle
- [ ] Screen reader announces admin mode status

**Integration Testing:**
- [ ] Admin can delete comments (when delete feature is implemented)
- [ ] Admin sees all games in games list when admin mode is on
- [ ] Admin mode indicator shows on all pages consistently

**Notes Section:**
```
- Test with at least 2 different browsers (Chrome, Firefox)
- Verify localStorage persists admin mode preference
- Check that admin banner does not interfere with normal UI layout
```

---

## 5. User Stories for E2E Testing (Future)

**Purpose**: Document user journeys for future E2E test implementation.

### User Journey Documentation

**Journey Name**: Admin enables admin mode and moderates content

**User Goal**: Access any game on the platform to investigate and moderate

**Journey Steps**:
1. Admin logs in to the platform
2. Clicks admin mode toggle in navigation
3. Sees visual confirmation that admin mode is active
4. Navigates to games list
5. Sees all games on platform (not just their games)
6. Opens a game they're not part of
7. Views game with GM-level permissions
8. Deletes an inappropriate comment
9. Toggles admin mode off
10. Verifies they no longer see games they're not part of

**Critical User Flows to Test** (E2E candidates):
- [ ] **Flow 1**: Admin toggles mode on, accesses restricted game, deletes comment, toggles mode off
- [ ] **Flow 2**: Non-admin user cannot access admin features (negative test)
- [ ] **Flow 3**: Admin grants admin status to another user, new admin can use features

**E2E Test Priority**: Medium (Important but not critical path for most users)

**Notes for Future E2E Implementation**:
```
- Test admin mode persistence across browser refresh
- Verify admin banner appears on all pages when mode is active
- Test that localStorage is properly cleared when logging out
```

---

## 6. Implementation Plan

### Phase 1: Database & Backend Foundation
**Estimated Time**: 2 hours

- [ ] Create database migration files
  - [ ] `.up.sql` with is_admin column and index
  - [ ] `.down.sql` with rollback logic
- [ ] Update SQL queries in `queries/users.sql`
- [ ] Run `just sqlgen` to regenerate models
- [ ] Update User interface in `core/interfaces.go`
- [ ] Update User model in `core/models.go`
- [ ] **Write unit tests first** for admin status methods
- [ ] Implement admin status methods in UserService
- [ ] Create admin middleware
- [ ] **Write middleware tests**
- [ ] Run tests: `just test-mocks`

**Acceptance Criteria:**
- [ ] Migration applies and rolls back cleanly
- [ ] sqlc generates code without errors
- [ ] All unit tests passing
- [ ] Middleware blocks non-admin users

### Phase 2: API Endpoints
**Estimated Time**: 2 hours

- [ ] Create admin API handlers
- [ ] Implement GET /api/v1/admin/users endpoint
- [ ] Implement PUT /api/v1/admin/users/:id/admin-status endpoint
- [ ] Update GET /api/v1/users/me to include is_admin
- [ ] Add admin middleware to protected routes
- [ ] Add routes to `pkg/http/root.go`
- [ ] **Write API integration tests**
- [ ] Test with database: `SKIP_DB_TESTS=false just test`
- [ ] Manual testing with curl

**Acceptance Criteria:**
- [ ] All endpoints return correct status codes
- [ ] Non-admin users get 403 Forbidden
- [ ] All API tests passing

### Phase 3: Frontend Implementation
**Estimated Time**: 3 hours

- [ ] Update User type in `types/users.ts`
- [ ] Add admin API methods to `lib/api.ts`
- [ ] Create `useAdminMode` hook
- [ ] **Write hook tests**
- [ ] Create `AdminModeToggle` component (use semantic theme tokens)
- [ ] **Write component tests for toggle**
- [ ] Create `AdminBanner` component (use semantic theme tokens)
- [ ] **Write component tests for banner**
- [ ] Add toggle to navigation header
- [ ] Add banner to layout
- [ ] Style with Tailwind + semantic tokens
- [ ] Run tests: `just test-frontend`

**Acceptance Criteria:**
- [ ] Toggle only visible to admin users
- [ ] Banner appears when admin mode is on
- [ ] Uses semantic warning colors for visibility
- [ ] All frontend tests passing
- [ ] Responsive design works

### Phase 4: Manual Testing & Documentation
**Estimated Time**: 2 hours

- [ ] **Manual UI testing** (use checklist from Section 4.4)
  - [ ] Happy path: Enable admin mode, view games, disable
  - [ ] Error scenarios: Non-admin access, permission checks
  - [ ] Edge cases: Refresh, logout/login, localStorage
- [ ] Performance testing
  - [ ] Admin mode toggle is instant
  - [ ] No console errors or warnings
  - [ ] localStorage working correctly
- [ ] Security review
  - [ ] Cannot bypass admin check with client-side manipulation
  - [ ] Middleware properly protects admin endpoints
  - [ ] Admin status requires database verification
- [ ] Documentation updates
  - [ ] Update API documentation with admin endpoints
  - [ ] Document how to manually set initial admin
  - [ ] Update ADR-003 if auth changes needed

**Acceptance Criteria:**
- [ ] All manual test scenarios pass
- [ ] Security review complete
- [ ] Documentation updated

---

## 7. Rollout Strategy

### Deployment Checklist
- [ ] Database migration tested in staging
- [ ] Initial admin user created manually
- [ ] Monitoring configured for admin endpoints
- [ ] Rollback plan documented

### Rollback Plan
**If deployment fails:**

1. Rollback migration: `just migrate_down`
2. Revert backend code deployment
3. Revert frontend code deployment
4. Verify system stability

**Rollback triggers:**
- Critical security vulnerability discovered
- Admin middleware blocking legitimate users
- Performance degradation

---

## 8. Monitoring & Observability

### Metrics to Track
- [ ] Admin API endpoint latency (p50, p95)
- [ ] Failed admin authorization attempts (security)
- [ ] Number of active admin users
- [ ] Admin actions (deletes) per day

### Logging
- [ ] All admin actions logged with correlation IDs
- [ ] Failed admin access attempts logged
- [ ] Admin mode toggles logged

### Alerts
- [ ] Failed admin auth attempts >10/hour → Warning
- [ ] Admin endpoint latency p95 >200ms → Warning

---

## 9. Documentation

### User Documentation
- [ ] Admin mode usage guide
- [ ] How to grant admin access to users

### Developer Documentation
- [ ] Document admin middleware usage
- [ ] Update API docs with admin endpoints
- [ ] Add comments to admin-specific code

---

## 10. Open Questions

**Technical Questions:**
- [x] Where should admin mode toggle be placed in UI? → Answer: Navigation header
- [x] Should admin mode auto-disable after timeout? → Answer: No, persists until manually toggled

**Product Questions:**
- [x] Can admin demote themselves? → Answer: Yes, with warning
- [x] Should there be audit log of admin actions? → Answer: Not in v1, future enhancement

---

## 11. Risks & Mitigations

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Security bypass via client manipulation | Low | Critical | Server-side verification required for all admin actions |
| localStorage conflicts | Low | Low | Use unique key prefix |
| Admin mode state desync | Low | Medium | Single source of truth in localStorage + DB |

### Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Admin abuse of power | Low | High | Future: audit logging |
| Confusion about admin mode state | Medium | Low | Clear visual indicators |

---

## 12. Future Enhancements

**Post-MVP Ideas:**
- Enhancement 1: Admin audit log of all actions
- Enhancement 2: Role-based permissions (moderator vs super-admin)
- Enhancement 3: Admin dashboard with platform statistics
- Enhancement 4: Bulk moderation tools
- Enhancement 5: Admin notifications for reported content

**Technical Debt:**
- Debt 1: No audit logging → Plan to add in Q2 2026

---

## 13. References

### Related Documentation
- ADR-003: Authentication Strategy
- `.claude/context/STATE_MANAGEMENT.md` - Frontend patterns

---

## Completion Checklist

**Before marking feature complete:**

- [ ] All implementation phases complete
- [ ] All unit tests passing (>90% coverage for security-critical code)
- [ ] All integration tests passing
- [ ] All frontend component tests passing
- [ ] Manual UI testing checklist complete (Section 4.4)
- [ ] User journeys documented for future E2E tests (Section 5)
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Initial admin user created
- [ ] Deployed to staging
- [ ] Manual testing in staging complete
- [ ] Deployed to production
- [ ] Monitoring confirmed working
- [ ] Team notified

**Archive this plan to** `.claude/planning/archive/` **when complete.**
