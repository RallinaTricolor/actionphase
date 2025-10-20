# Feature: Dashboard Redesign

**Status**: Planning
**Created**: 2025-10-19
**Last Updated**: 2025-10-19
**Owner**: AI Planning Session
**Priority**: P0 (High)
**Related ADRs**: None
**Related Issues**: UI_UX_NOTES.md - Dashboard section

---

## 1. Overview

### Problem Statement
**What problem does this feature solve?**

The current dashboard is cluttered, not productive, and doesn't provide quick insights or easy navigation to active content. Users are presented with irrelevant information when they have no active games, and users with active games cannot quickly see what requires their attention. The dashboard fails its primary purpose: providing a centralized hub for game activity and notifications.

**Current Pain Points:**
- Dashboard shows same content regardless of user's game participation status
- No quick insights into active games, pending actions, or urgent deadlines
- No clear navigation to most relevant content
- Users without games see a useless page instead of being directed to find games
- No visibility into recent messages or notifications requiring attention

### Goals
**What are we trying to achieve?**

- [ ] Goal 1: Create an actionable dashboard that surfaces urgent/time-sensitive information first
- [ ] Goal 2: Provide different dashboard experiences based on user context (active player vs. no games)
- [ ] Goal 3: Enable one-click navigation to content requiring user attention
- [ ] Goal 4: Reduce time-to-action for players responding to phases, messages, or GM requests
- [ ] Goal 5: Give GMs a centralized view of all their games' status and pending items

### Non-Goals
**What is explicitly out of scope?**

- Non-goal 1: Creating a social feed or activity stream (keep focused on actionable items)
- Non-goal 2: Game discovery features (belongs on game listing page)
- Non-goal 3: Complex analytics or statistics dashboard
- Non-goal 4: Real-time push notifications (server-sent events/websockets deferred)

### Success Criteria
**How do we know this feature is successful?**

- [ ] User with no games is automatically redirected to games listing page
- [ ] User with active games sees all games requiring their action at the top
- [ ] User can navigate to urgent content (action submissions, unread messages) in 1 click
- [ ] Dashboard loads in <2 seconds with all data
- [ ] GM can see at-a-glance status of all their games (recruiting, in-progress, completed)
- [ ] Unit test coverage: >80% for dashboard service layer
- [ ] Component test coverage: >85% for dashboard components
- [ ] Manual testing: All user flows tested across player, GM, and multi-role scenarios
- [ ] No N+1 query issues (verified via database query logging)

---

## 2. User Stories

### Primary User Stories

```gherkin
As a Player with active games
I want to see games requiring my attention first
So that I can quickly respond to action phases and messages

Acceptance Criteria:
- Given I have 3 active games
  When I navigate to the dashboard
  Then I see games with pending actions at the top
  And I see games with unread messages in the "Recent Activity" section
  And I see upcoming deadlines highlighted

- Given I have an action submission due in 2 hours
  When I view the dashboard
  Then I see a prominent "Action Due Soon" indicator
  And I can click to go directly to the action submission form
```

```gherkin
As a Game Master
I want to see the status of all my games at a glance
So that I can manage multiple games efficiently

Acceptance Criteria:
- Given I am GM of 4 games in different states
  When I view the dashboard
  Then I see games grouped by state (recruiting, in-progress, paused, completed)
  And I see pending applications count for recruiting games
  And I see phase deadline status for in-progress games
  And I can click any game to navigate to its detail page
```

```gherkin
As a new user with no games
I want to be directed to find games
So that I can start playing quickly

Acceptance Criteria:
- Given I am logged in with no game participation
  When I navigate to the dashboard
  Then I am automatically redirected to the games listing page
  And I see a message explaining that I'm not in any games yet
```

```gherkin
As a user playing multiple roles (Player and GM)
I want to see both my player actions and GM responsibilities
So that I can manage all my game commitments

Acceptance Criteria:
- Given I am a player in 2 games and GM of 1 game
  When I view the dashboard
  Then I see two sections: "Your Games (Player)" and "Your Games (GM)"
  And each section shows relevant context (actions due vs. applications pending)
  And urgent items appear first regardless of role
```

### Edge Cases & Error Scenarios

- **Edge Case 1**: User is in 20+ games → Show top 10 most urgent, link to "View All Games"
- **Edge Case 2**: User has both player and GM roles in same game → Show game once under "Mixed Role Games" section
- **Edge Case 3**: All games are paused/completed → Show message "No active games" with link to find new games
- **Error Scenario 1**: Dashboard API timeout → Show skeleton loading state, display error banner with retry button
- **Error Scenario 2**: Partial data load (some games fail) → Show successfully loaded games, error indicator for failed ones

---

## 3. Technical Design

### 3.1 Database Schema

**No new tables required** - Dashboard is a view layer aggregating existing data.

**Queries will need optimization** - Add indexes if performance testing reveals slow queries.

**Potential indexes to consider:**
```sql
-- Index for finding user's games quickly
CREATE INDEX IF NOT EXISTS idx_game_participants_user_id ON game_participants(user_id);

-- Index for finding games by state
CREATE INDEX IF NOT EXISTS idx_games_state ON games(state);

-- Index for finding upcoming phase deadlines
CREATE INDEX IF NOT EXISTS idx_game_phases_end_time ON game_phases(end_time) WHERE is_active = true;

-- Index for finding unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = false;
```

### 3.2 Database Queries (sqlc)

**Location**: `backend/pkg/db/queries/dashboard.sql`

```sql
-- name: GetUserDashboardGames :many
-- Get all games user participates in with relevant metadata
SELECT
  g.*,
  gp.role as user_role,
  (SELECT COUNT(*) FROM game_applications WHERE game_id = g.id AND status = 'pending') as pending_applications_count,
  (SELECT COUNT(*) FROM notifications WHERE game_id = g.id AND user_id = $1 AND is_read = false) as unread_notifications_count,
  current_phase.id as current_phase_id,
  current_phase.phase_type as current_phase_type,
  current_phase.end_time as current_phase_deadline,
  (SELECT COUNT(*) FROM action_submissions
   WHERE game_id = g.id
   AND user_id = $1
   AND phase_id = current_phase.id
   AND submission_time IS NULL) as has_pending_action
FROM games g
INNER JOIN game_participants gp ON g.id = gp.game_id
LEFT JOIN game_phases current_phase ON g.id = current_phase.game_id AND current_phase.is_active = true
WHERE gp.user_id = $1
ORDER BY
  -- Urgent games first: action phases with pending submissions
  CASE WHEN current_phase.phase_type = 'action' AND has_pending_action > 0 THEN 0 ELSE 1 END,
  -- Then by approaching deadlines
  current_phase.end_time ASC NULLS LAST,
  -- Then by unread activity
  unread_notifications_count DESC,
  -- Finally by recently updated
  g.updated_at DESC;

-- name: GetUserRecentMessages :many
-- Get recent unread messages across all user's games
SELECT
  m.*,
  g.title as game_title,
  g.id as game_id,
  author.username as author_name,
  character.name as character_name
FROM messages m
INNER JOIN games g ON m.game_id = g.id
INNER JOIN game_participants gp ON g.id = gp.game_id
INNER JOIN users author ON m.author_id = author.id
LEFT JOIN characters character ON m.character_id = character.id
WHERE gp.user_id = $1
  AND m.created_at > NOW() - INTERVAL '7 days'
  AND m.author_id != $1  -- Don't show user's own messages
ORDER BY m.created_at DESC
LIMIT $2;

-- name: GetUserUpcomingDeadlines :many
-- Get upcoming phase deadlines across all user's games
SELECT
  gp.id,
  gp.end_time,
  gp.phase_type,
  gp.title as phase_title,
  g.id as game_id,
  g.title as game_title,
  (SELECT COUNT(*) FROM action_submissions
   WHERE game_id = g.id
   AND user_id = $1
   AND phase_id = gp.id
   AND submission_time IS NULL) as has_pending_submission
FROM game_phases gp
INNER JOIN games g ON gp.game_id = g.id
INNER JOIN game_participants part ON g.id = part.game_id
WHERE part.user_id = $1
  AND gp.is_active = true
  AND gp.end_time IS NOT NULL
  AND gp.end_time > NOW()
ORDER BY gp.end_time ASC
LIMIT $2;
```

**Query Performance Considerations:**
- [ ] Indexes planned for game_participants(user_id), games(state), notifications(user_id, is_read)
- [ ] Query complexity analyzed - single query for dashboard games to avoid N+1
- [ ] Pagination not needed (dashboard shows summary, not exhaustive list)

### 3.3 Backend Service Layer

**Service Interface** (`backend/pkg/core/interfaces.go`):

```go
type DashboardServiceInterface interface {
    GetUserDashboard(ctx context.Context, userID int32) (*DashboardData, error)
}
```

**Domain Models** (`backend/pkg/core/models.go`):

```go
type DashboardData struct {
    UserID               int32                  `json:"user_id"`
    HasGames             bool                   `json:"has_games"`
    PlayerGames          []*DashboardGameCard   `json:"player_games"`
    GMGames              []*DashboardGameCard   `json:"gm_games"`
    MixedRoleGames       []*DashboardGameCard   `json:"mixed_role_games"`
    RecentMessages       []*DashboardMessage    `json:"recent_messages"`
    UpcomingDeadlines    []*DashboardDeadline   `json:"upcoming_deadlines"`
    UnreadNotifications  int                    `json:"unread_notifications"`
}

type DashboardGameCard struct {
    GameID               int32          `json:"game_id"`
    Title                string         `json:"title"`
    State                string         `json:"state"`
    UserRole             string         `json:"user_role"`  // "player", "gm", or "both"

    // Context-specific fields
    CurrentPhaseType     *string        `json:"current_phase_type,omitempty"`
    CurrentPhaseDeadline *time.Time     `json:"current_phase_deadline,omitempty"`
    HasPendingAction     bool           `json:"has_pending_action"`
    PendingApplications  int            `json:"pending_applications"`
    UnreadMessages       int            `json:"unread_messages"`

    // Urgency indicators
    IsUrgent             bool           `json:"is_urgent"`  // Deadline <24h or pending action
    DeadlineStatus       string         `json:"deadline_status"` // "critical", "warning", "normal"
}

type DashboardMessage struct {
    MessageID       int32      `json:"message_id"`
    GameID          int32      `json:"game_id"`
    GameTitle       string     `json:"game_title"`
    AuthorName      string     `json:"author_name"`
    CharacterName   *string    `json:"character_name,omitempty"`
    Content         string     `json:"content"`  // Truncated to 100 chars
    CreatedAt       time.Time  `json:"created_at"`
}

type DashboardDeadline struct {
    PhaseID             int32      `json:"phase_id"`
    GameID              int32      `json:"game_id"`
    GameTitle           string     `json:"game_title"`
    PhaseType           string     `json:"phase_type"`
    PhaseTitle          string     `json:"phase_title"`
    EndTime             time.Time  `json:"end_time"`
    HasPendingSubmission bool      `json:"has_pending_submission"`
    HoursRemaining      int        `json:"hours_remaining"`
}
```

**Business Rules:**

1. **Users with no games redirect to games listing**
   - Validation: Check if user participates in any game
   - Action: Return `HasGames: false` to trigger frontend redirect

2. **Urgent games appear first**
   - Validation: Check if deadline <24h or has pending action in action phase
   - Action: Set `IsUrgent: true` and sort to top

3. **Deadline status calculation**
   - <6 hours: "critical" (red)
   - 6-24 hours: "warning" (yellow)
   - >24 hours: "normal" (green)

4. **Games with mixed roles**
   - Validation: User is both player AND GM in same game
   - Action: Show in separate "Mixed Role Games" section

### 3.4 API Endpoints

**Base Path**: `/api/v1/dashboard`

#### GET /api/v1/dashboard
**Description**: Get user's dashboard data
**Auth Required**: Yes
**Permissions**: User must be authenticated

**Response (200 OK):**
```json
{
  "user_id": 123,
  "has_games": true,
  "player_games": [
    {
      "game_id": 1,
      "title": "Dragon Quest Campaign",
      "state": "in_progress",
      "user_role": "player",
      "current_phase_type": "action",
      "current_phase_deadline": "2025-10-20T18:00:00Z",
      "has_pending_action": true,
      "pending_applications": 0,
      "unread_messages": 3,
      "is_urgent": true,
      "deadline_status": "warning"
    }
  ],
  "gm_games": [
    {
      "game_id": 2,
      "title": "Sci-Fi Mystery",
      "state": "recruitment",
      "user_role": "gm",
      "current_phase_type": null,
      "current_phase_deadline": null,
      "has_pending_action": false,
      "pending_applications": 5,
      "unread_messages": 0,
      "is_urgent": false,
      "deadline_status": "normal"
    }
  ],
  "mixed_role_games": [],
  "recent_messages": [
    {
      "message_id": 456,
      "game_id": 1,
      "game_title": "Dragon Quest Campaign",
      "author_name": "game_master",
      "character_name": "Narrator",
      "content": "The dragon roars as you approach the cave entrance...",
      "created_at": "2025-10-19T14:30:00Z"
    }
  ],
  "upcoming_deadlines": [
    {
      "phase_id": 10,
      "game_id": 1,
      "game_title": "Dragon Quest Campaign",
      "phase_type": "action",
      "phase_title": "Episode 3: The Cave",
      "end_time": "2025-10-20T18:00:00Z",
      "has_pending_submission": true,
      "hours_remaining": 15
    }
  ],
  "unread_notifications": 7
}
```

**Error Responses:**
- `401 Unauthorized`: No valid authentication token
- `500 Internal Server Error`: Database error

---

### 3.5 Frontend Components

**Component Hierarchy:**

```
DashboardPage
├── DashboardHeader (Welcome message, quick stats)
├── UrgentActionsCard (Action deadlines <24h)
├── GamesGrid
│   ├── GameSection (title="Your Games as Player")
│   │   └── DashboardGameCard (repeat)
│   ├── GameSection (title="Your Games as GM")
│   │   └── DashboardGameCard (repeat)
│   └── GameSection (title="Mixed Role Games")
│       └── DashboardGameCard (repeat)
├── RecentActivityCard
│   └── DashboardMessageList
│       └── MessagePreview (repeat)
└── UpcomingDeadlinesCard
    └── DeadlinesList
        └── DeadlineItem (repeat)
```

**Component Specifications:**

#### Component: `DashboardPage`
**Location**: `frontend/src/pages/DashboardPage.tsx`
**Purpose**: Main dashboard container that fetches data and handles redirect logic

**Props:** None (uses auth context for user ID)

**State:**
- Server state: Dashboard data via `useDashboard()` hook

**Behavior:**
- If user has no games (`has_games: false`), redirect to `/games` with message
- Show loading skeleton while fetching
- Show error state if API fails

---

#### Component: `DashboardGameCard`
**Location**: `frontend/src/components/DashboardGameCard.tsx`
**Purpose**: Display game summary with urgency indicators and quick actions

**Props:**
```typescript
interface DashboardGameCardProps {
  game: DashboardGameCard;
  userRole: 'player' | 'gm' | 'both';
}
```

**Visual Design:**
- Card with color-coded left border (red=urgent, yellow=warning, green=normal)
- Game title as clickable link
- Badge showing game state (recruiting, in-progress, etc.)
- Context-aware content:
  - **Player in action phase**: "Submit Action" button + deadline countdown
  - **GM with pending applications**: "Review 5 Applications" link
  - **Unread messages**: Message count badge
- Deadline countdown: "15 hours remaining" with color coding

---

#### Component: `UrgentActionsCard`
**Location**: `frontend/src/components/UrgentActionsCard.tsx`
**Purpose**: Prominent card at top of dashboard showing time-sensitive actions

**Behavior:**
- Only renders if user has urgent items (deadlines <24h or pending actions)
- Shows count: "You have 2 urgent actions"
- Lists each urgent item with direct navigation link
- Sorted by deadline (soonest first)

---

#### Component: `RecentActivityCard`
**Location**: `frontend/src/components/RecentActivityCard.tsx`
**Purpose**: Show recent messages from all games

**Behavior:**
- Shows last 5 messages from games user participates in
- Truncates message content to 100 characters
- Clicking message navigates to game's common room tab
- Shows relative time ("2 hours ago")

---

#### Component: `UpcomingDeadlinesCard`
**Location**: `frontend/src/components/UpcomingDeadlinesCard.tsx`
**Purpose**: Timeline view of upcoming phase deadlines

**Behavior:**
- Shows next 5 upcoming deadlines
- Color-coded by urgency (red <6h, yellow <24h, green >24h)
- Shows if user has pending submission for that phase
- Click to navigate to game's actions tab

---

### 3.6 Frontend API Client

**Location**: `frontend/src/lib/api/dashboard.ts`

```typescript
import { BaseApiClient } from './client';
import type { DashboardData } from '../../types/dashboard';

export class DashboardApi extends BaseApiClient {
  async getUserDashboard(): Promise<DashboardData> {
    const response = await this.client.get<DashboardData>('/api/v1/dashboard');
    return response.data;
  }
}
```

**Add to main ApiClient** (`frontend/src/lib/api/index.ts`):
```typescript
class ApiClient extends BaseApiClient {
  // ... existing domains
  public dashboard: DashboardApi;

  constructor() {
    super();
    // ... existing initializations
    this.dashboard = new DashboardApi();
  }
}
```

### 3.7 Frontend Custom Hooks

**Location**: `frontend/src/hooks/useDashboard.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export function useDashboard() {
  const { currentUser } = useAuth();

  return useQuery({
    queryKey: ['dashboard', currentUser?.id],
    queryFn: () => apiClient.dashboard.getUserDashboard(),
    enabled: !!currentUser,
    staleTime: 60000, // 1 minute - dashboard needs to be relatively fresh
    refetchInterval: 120000, // Refetch every 2 minutes when tab is active
  });
}

// Helper hook for deadline status calculation
export function useDeadlineStatus(deadline: Date): {
  status: 'critical' | 'warning' | 'normal';
  hoursRemaining: number;
  displayText: string;
} {
  const now = new Date();
  const hoursRemaining = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));

  let status: 'critical' | 'warning' | 'normal';
  if (hoursRemaining < 6) status = 'critical';
  else if (hoursRemaining < 24) status = 'warning';
  else status = 'normal';

  const displayText = hoursRemaining < 1
    ? 'Less than 1 hour'
    : `${hoursRemaining} hours remaining`;

  return { status, hoursRemaining, displayText };
}
```

### 3.8 Frontend Type Definitions

**Location**: `frontend/src/types/dashboard.ts`

```typescript
export interface DashboardData {
  user_id: number;
  has_games: boolean;
  player_games: DashboardGameCard[];
  gm_games: DashboardGameCard[];
  mixed_role_games: DashboardGameCard[];
  recent_messages: DashboardMessage[];
  upcoming_deadlines: DashboardDeadline[];
  unread_notifications: number;
}

export interface DashboardGameCard {
  game_id: number;
  title: string;
  state: string;
  user_role: 'player' | 'gm' | 'both';
  current_phase_type?: string;
  current_phase_deadline?: string;
  has_pending_action: boolean;
  pending_applications: number;
  unread_messages: number;
  is_urgent: boolean;
  deadline_status: 'critical' | 'warning' | 'normal';
}

export interface DashboardMessage {
  message_id: number;
  game_id: number;
  game_title: string;
  author_name: string;
  character_name?: string;
  content: string;
  created_at: string;
}

export interface DashboardDeadline {
  phase_id: number;
  game_id: number;
  game_title: string;
  phase_type: string;
  phase_title: string;
  end_time: string;
  has_pending_submission: boolean;
  hours_remaining: number;
}
```

---

## 4. Testing Strategy

### 4.1 Backend Tests

**Test Files:**
- `backend/pkg/db/services/dashboard_test.go`
- `backend/pkg/dashboard/api_test.go`

**Unit Tests:**
```go
func TestDashboardService_GetUserDashboard(t *testing.T) {
    suite := db.NewTestSuite(t).
        WithCleanup("all").
        Setup()
    defer suite.Cleanup()

    factory := suite.Factory()
    service := NewDashboardService(suite.Pool())

    // Create test user and games
    user := factory.NewUser().Create()

    // Test: User with no games
    t.Run("redirects user with no games", func(t *testing.T) {
        dashboard, err := service.GetUserDashboard(context.Background(), user.ID)
        require.NoError(t, err)
        assert.False(t, dashboard.HasGames)
        assert.Empty(t, dashboard.PlayerGames)
        assert.Empty(t, dashboard.GMGames)
    })

    // Test: User with active games as player
    t.Run("shows player games with pending actions", func(t *testing.T) {
        game := factory.NewGame().WithGM(user.ID).Create()
        factory.NewParticipant(game.ID, user.ID, "player").Create()
        phase := factory.NewPhase().InGame(game).ActionPhase().Active().
            WithDeadlineIn(6 * time.Hour).Create()

        dashboard, err := service.GetUserDashboard(context.Background(), user.ID)
        require.NoError(t, err)
        assert.True(t, dashboard.HasGames)
        assert.Len(t, dashboard.PlayerGames, 1)
        assert.True(t, dashboard.PlayerGames[0].HasPendingAction)
        assert.True(t, dashboard.PlayerGames[0].IsUrgent)
        assert.Equal(t, "warning", dashboard.PlayerGames[0].DeadlineStatus)
    })

    // Test: GM with pending applications
    t.Run("shows GM games with application counts", func(t *testing.T) {
        gmUser := factory.NewUser().Create()
        game := factory.NewGame().WithGM(gmUser.ID).InState("recruitment").Create()
        // Create 3 pending applications
        for i := 0; i < 3; i++ {
            applicant := factory.NewUser().Create()
            factory.NewGameApplication(game.ID, applicant.ID, "pending").Create()
        }

        dashboard, err := service.GetUserDashboard(context.Background(), gmUser.ID)
        require.NoError(t, err)
        assert.Len(t, dashboard.GMGames, 1)
        assert.Equal(t, 3, dashboard.GMGames[0].PendingApplications)
    })

    // Test: Urgent games sorted first
    t.Run("sorts urgent games first", func(t *testing.T) {
        player := factory.NewUser().Create()

        // Create 3 games with different urgency
        game1 := factory.NewGame().Create()
        factory.NewParticipant(game1.ID, player.ID, "player").Create()
        factory.NewPhase().InGame(game1).Active().WithDeadlineIn(48 * time.Hour).Create()

        game2 := factory.NewGame().Create()
        factory.NewParticipant(game2.ID, player.ID, "player").Create()
        factory.NewPhase().InGame(game2).ActionPhase().Active().WithDeadlineIn(2 * time.Hour).Create()

        game3 := factory.NewGame().Create()
        factory.NewParticipant(game3.ID, player.ID, "player").Create()

        dashboard, err := service.GetUserDashboard(context.Background(), player.ID)
        require.NoError(t, err)

        // Game2 should be first (urgent action phase with near deadline)
        assert.Equal(t, game2.ID, dashboard.PlayerGames[0].GameID)
        assert.True(t, dashboard.PlayerGames[0].IsUrgent)
    })
}
```

**Test Coverage Goals:**
- [ ] Service layer: >85% coverage
- [ ] All urgency calculation logic: 100% coverage
- [ ] All sorting/grouping logic: 100% coverage

### 4.2 Frontend Tests

**Component Tests:**

```typescript
describe('DashboardPage', () => {
  it('redirects to games page when user has no games', async () => {
    const mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);

    server.use(
      http.get('/api/v1/dashboard', () => {
        return HttpResponse.json({
          user_id: 1,
          has_games: false,
          player_games: [],
          gm_games: [],
          mixed_role_games: [],
          recent_messages: [],
          upcoming_deadlines: [],
          unread_notifications: 0,
        });
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/games', {
        state: { message: 'You are not in any games yet. Browse available games below.' }
      });
    });
  });

  it('displays urgent actions card when user has urgent items', async () => {
    server.use(
      http.get('/api/v1/dashboard', () => {
        return HttpResponse.json({
          has_games: true,
          player_games: [{
            game_id: 1,
            title: 'Test Game',
            is_urgent: true,
            has_pending_action: true,
            current_phase_deadline: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          }],
          // ... other fields
        });
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/urgent actions/i)).toBeInTheDocument();
      expect(screen.getByText(/submit action/i)).toBeInTheDocument();
    });
  });

  it('groups games by role correctly', async () => {
    server.use(
      http.get('/api/v1/dashboard', () => {
        return HttpResponse.json({
          has_games: true,
          player_games: [{ game_id: 1, title: 'Player Game', user_role: 'player' }],
          gm_games: [{ game_id: 2, title: 'GM Game', user_role: 'gm' }],
          mixed_role_games: [{ game_id: 3, title: 'Both Roles', user_role: 'both' }],
          // ... other fields
        });
      })
    );

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/your games as player/i)).toBeInTheDocument();
      expect(screen.getByText(/your games as gm/i)).toBeInTheDocument();
      expect(screen.getByText(/Player Game/)).toBeInTheDocument();
      expect(screen.getByText(/GM Game/)).toBeInTheDocument();
      expect(screen.getByText(/Both Roles/)).toBeInTheDocument();
    });
  });
});

describe('DashboardGameCard', () => {
  it('displays urgent indicator for critical deadline', () => {
    const urgentGame: DashboardGameCard = {
      game_id: 1,
      title: 'Urgent Game',
      state: 'in_progress',
      user_role: 'player',
      current_phase_deadline: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      has_pending_action: true,
      is_urgent: true,
      deadline_status: 'critical',
      pending_applications: 0,
      unread_messages: 0,
    };

    render(<DashboardGameCard game={urgentGame} />);

    expect(screen.getByText(/3 hours remaining/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /submit action/i })).toBeInTheDocument();
    // Check for red border/urgent styling
    const card = screen.getByTestId('dashboard-game-card');
    expect(card).toHaveClass('border-red-500');
  });

  it('shows pending applications for GM', () => {
    const gmGame: DashboardGameCard = {
      game_id: 2,
      title: 'Recruiting Game',
      state: 'recruitment',
      user_role: 'gm',
      pending_applications: 5,
      unread_messages: 0,
      is_urgent: false,
      deadline_status: 'normal',
      has_pending_action: false,
    };

    render(<DashboardGameCard game={gmGame} />);

    expect(screen.getByText(/5 pending applications/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review applications/i })).toBeInTheDocument();
  });
});
```

**Test Coverage Goals:**
- [ ] Components: >85% coverage
- [ ] Dashboard redirect logic: 100% coverage
- [ ] Urgency display logic: 100% coverage

### 4.3 Manual UI Testing Checklist

**Happy Path Testing:**
- [ ] Login as user with no games → Redirected to games page with helpful message
- [ ] Login as player with 1 active game → Dashboard shows game card correctly
- [ ] Login as player with action due <6 hours → Urgent actions card displays with red styling
- [ ] Login as GM with pending applications → Application count badge displays
- [ ] Login as user with both player and GM roles → Games grouped correctly
- [ ] Click "Submit Action" on urgent game → Navigate to action submission form
- [ ] Click game title → Navigate to game detail page
- [ ] Recent messages display → Click message → Navigate to common room

**Error Handling Testing:**
- [ ] Dashboard API fails → Error message displays with retry button
- [ ] Partial data load → Show available data, error indicator for failed sections
- [ ] Slow API response → Loading skeleton displays, no blank page

**Edge Case Testing:**
- [ ] User in 15+ games → Top 10 display, "View All" link shows
- [ ] All games paused/completed → Message "No active games" displays
- [ ] Game with mixed role (player + GM) → Shows in "Mixed Role" section once

**Performance Testing:**
- [ ] Dashboard loads in <2 seconds
- [ ] No console errors
- [ ] Database queries efficient (check logs for N+1 issues)

---

## 5. User Stories for E2E Testing (Future)

### User Journey Documentation

**Journey Name**: Player responds to urgent action deadline

**User Goal**: Quickly find and submit action before deadline

**Journey Steps**:
1. Player logs in and lands on dashboard
2. Sees "Urgent Actions" card with game requiring action
3. Clicks "Submit Action" button
4. Redirected to action submission form
5. Submits action successfully
6. Returns to dashboard, urgent indicator removed

**E2E Test Priority**: High

---

**Journey Name**: GM manages multiple games from dashboard

**User Goal**: Review all game statuses and navigate to pending tasks

**Journey Steps**:
1. GM logs in with 3 games (recruiting, in-progress, completed)
2. Sees games grouped by state
3. Clicks "Review 5 Applications" on recruiting game
4. Approves/rejects applications
5. Returns to dashboard
6. Clicks in-progress game to manage active phase
7. Creates new phase, activates it
8. Returns to dashboard, sees updated phase deadline

**E2E Test Priority**: Medium

---

## 6. Implementation Plan

### Phase 1: Database & Backend Foundation
**Estimated Time**: 4-6 hours

- [ ] Create SQL queries in `queries/dashboard.sql`
- [ ] Run `just sqlgen` to generate models
- [ ] Add performance indexes if needed
- [ ] Define service interface in `core/interfaces.go`
- [ ] Define domain models in `core/models.go`
- [ ] Create `DashboardService` implementation
- [ ] **Write unit tests first** (TDD)
- [ ] Implement urgency calculation logic
- [ ] Implement game grouping logic (player/GM/mixed)
- [ ] Run tests: `just test-mocks`

**Acceptance Criteria:**
- [ ] All unit tests passing
- [ ] Service implements interface correctly
- [ ] Urgency and grouping logic fully tested

### Phase 2: API Endpoints
**Estimated Time**: 2-3 hours

- [ ] Create handler file `pkg/dashboard/api.go`
- [ ] Implement GET /api/v1/dashboard endpoint
- [ ] Add authentication middleware
- [ ] Add route to `pkg/http/root.go`
- [ ] **Write API integration tests**
- [ ] Test with database: `SKIP_DB_TESTS=false just test`
- [ ] Manual testing with curl

**Acceptance Criteria:**
- [ ] Endpoint returns correct status codes
- [ ] Authentication enforced
- [ ] All API tests passing
- [ ] Response format matches specification

### Phase 3: Frontend Implementation
**Estimated Time**: 8-10 hours

- [ ] Add API client method to `lib/api/dashboard.ts`
- [ ] Create type definitions in `types/dashboard.ts`
- [ ] Implement `useDashboard()` hook
- [ ] **Write hook tests**
- [ ] Create `DashboardPage` component
- [ ] Create `DashboardGameCard` component
- [ ] Create `UrgentActionsCard` component
- [ ] Create `RecentActivityCard` component
- [ ] Create `UpcomingDeadlinesCard` component
- [ ] **Write component tests for each**
- [ ] Implement redirect logic for users with no games
- [ ] Style all components with Tailwind
- [ ] Add loading skeletons
- [ ] Add error states
- [ ] Run tests: `just test-frontend`

**Acceptance Criteria:**
- [ ] All components render correctly
- [ ] Redirect logic works for no-games scenario
- [ ] Urgency indicators display correctly
- [ ] Navigation links work
- [ ] All frontend tests passing
- [ ] Responsive design works

### Phase 4: Manual Testing & Documentation
**Estimated Time**: 3-4 hours

- [ ] **Manual UI testing** (use checklist from Section 4.3)
  - [ ] Test as player with various game states
  - [ ] Test as GM with pending applications
  - [ ] Test mixed role scenarios
  - [ ] Test redirect for no games
  - [ ] Test urgency indicators and deadlines
- [ ] Performance testing
  - [ ] Dashboard loads in <2 seconds
  - [ ] No N+1 queries (check database logs)
  - [ ] No console errors
- [ ] Documentation
  - [ ] Update route documentation
  - [ ] Document dashboard data refresh strategy

**Acceptance Criteria:**
- [ ] All manual test scenarios pass
- [ ] Performance meets requirements (<2s load)
- [ ] Documentation updated

---

## 7. Rollout Strategy

### Deployment Checklist
- [ ] Dashboard queries performance tested in staging
- [ ] Indexes added if needed
- [ ] Frontend assets built and deployed
- [ ] Route /dashboard configured
- [ ] Monitoring configured for dashboard endpoint latency

### Rollback Plan
**If deployment fails:**

1. Revert frontend deployment (no database changes needed)
2. Verify /dashboard route returns to previous version
3. Monitor error rates

**Rollback triggers:**
- Dashboard endpoint p95 latency >1000ms
- Error rate >5%
- User reports of missing data

---

## 8. Monitoring & Observability

### Metrics to Track
- [ ] Dashboard API endpoint latency (p50, p95, p99) - Target: p95 <500ms
- [ ] Dashboard page load time - Target: <2 seconds
- [ ] Redirect rate (users with no games) - Track adoption
- [ ] Error rate per dashboard component

### Logging
- [ ] Log dashboard API calls with user ID and response time
- [ ] Log N+1 query warnings if detected
- [ ] Log redirect events (user with no games)

---

## 9. Open Questions

**Technical Questions:**
- [ ] Should dashboard auto-refresh when tab is active? → **Decision**: Yes, every 2 minutes via `refetchInterval`
- [ ] How many recent messages to show? → **Decision**: 5 most recent from last 7 days
- [ ] Should we cache dashboard data? → **Decision**: React Query cache (1 minute staleTime)

**Product Questions:**
- [ ] Should users be able to customize dashboard layout? → **Decision**: No (future enhancement)
- [ ] Should dashboard show completed games? → **Decision**: No, only active games

---

## 10. Future Enhancements

**Post-MVP Ideas:**
- Enhancement 1: Customizable dashboard widgets (drag-and-drop layout)
- Enhancement 2: Dashboard quick actions (create game, apply to recruiting game)
- Enhancement 3: Real-time updates via websockets (instant deadline updates)
- Enhancement 4: Dashboard for mobile app with push notifications

---

## 11. Completion Checklist

- [ ] All implementation phases complete
- [ ] All unit tests passing (>85% coverage on service layer)
- [ ] All integration tests passing
- [ ] All frontend component tests passing (>85% coverage)
- [ ] Manual UI testing checklist complete (Section 4.3)
- [ ] User journeys documented for future E2E tests (Section 5)
- [ ] Performance requirements met (<2s dashboard load)
- [ ] No N+1 query issues
- [ ] Redirect logic for no-games scenario working
- [ ] Code reviewed
- [ ] Deployed to staging
- [ ] Manual testing in staging complete
- [ ] Deployed to production
- [ ] Monitoring confirmed working

---

## Session Log

### Session 1 - 2025-10-19
**Accomplished:**
- Created comprehensive feature plan for Dashboard Redesign
- Defined data models and API contracts
- Documented component hierarchy and behavior
- Planned testing strategy

**Next Steps:**
- Begin Phase 1 implementation (database queries and backend service)
- Create dashboard service tests
- Implement urgency calculation logic
