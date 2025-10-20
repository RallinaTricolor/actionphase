# Feature Plan: Smart Tab Navigation

**Created**: 2025-10-19
**Status**: Planning
**Priority**: P1 (Medium-High Priority - Should Have)
**Effort Estimate**: 2-3 days
**Sprint**: Sprint 2 (Week 1)
**Owner**: Development Team
**Related Plans**: `FEATURE_DASHBOARD_REDESIGN.md`, `FEATURE_GAME_LISTING_ENHANCEMENTS.md`

---

## 1. Overview

### 1.1 Problem Statement

**Current Pain Points:**
- Default tab selection doesn't always match the most relevant content for current game context
- **For GMs during action phase**: Default tab is "Phases" management, but "Actions" tab (to review player submissions) is more urgent
- **Phase History tab**: Always visible during in_progress games, but contains no useful information during action phases (only relevant for common room phases)
- Players have to manually navigate to the tab that matters for the current phase
- No consideration of pending actions, unread messages, or other urgency indicators

**User Impact:**
- **Extra Clicks**: Users must click to the relevant tab on every game visit
- **Missed Actions**: GMs may not notice pending action submissions during action phases
- **Confusion**: Phase History tab appears but contains no data during action phases
- **Inefficiency**: Players waste time navigating instead of acting

**Business Impact:**
- Slower response times (GMs don't see pending actions immediately)
- Lower engagement (extra friction to reach relevant content)
- Confusion about which tab to check first

### 1.2 Goals and Success Criteria

**Primary Goals:**
1. Automatically select the most contextually relevant tab based on game state and current phase
2. Prioritize tabs with urgent content (pending actions, unread messages, etc.)
3. Hide or rename Phase History during action phases
4. Reduce average clicks to reach relevant content by 30%

**Success Metrics:**
- **Reduced Navigation Time**: Time to relevant content reduced by 30%
- **Default Tab Accuracy**: >80% of users stay on default tab (don't immediately switch)
- **GM Response Time**: Time to review action submissions reduced by 20%
- **User Satisfaction**: "Navigation" rating >4/5 in surveys

**Out of Scope (Future Enhancements):**
- User-customizable default tabs (P3)
- Tab reordering based on usage patterns (P4)
- Tab badges for unread counts (handled separately in notification UX)
- Deep linking to specific phase or action (P3)

### 1.3 User Stories

**Epic**: As a game participant, I want the default tab to show the most relevant content for my current context, so I can act quickly without extra navigation.

**User Stories:**

1. **GM During Action Phase**
   *As a GM when the current phase is an action phase*, I want the default tab to be "Actions" so I can immediately see pending player submissions.
   **Acceptance Criteria:**
   - Default tab is "Actions" for GMs during action phases
   - Tab shows pending submissions prominently
   - One-click access to review and process actions

2. **Player During Action Phase**
   *As a player when the current phase is an action phase*, I want the default tab to be "Submit Action" so I can quickly submit or edit my action.
   **Acceptance Criteria:**
   - Default tab is "Submit Action" for players during action phases
   - Shows whether action has been submitted or is still draft
   - One-click access to action form

3. **All Users During Common Room Phase**
   *As any user when the current phase is a common room phase*, I want the default tab to be "Common Room" so I can participate in discussions.
   **Acceptance Criteria:**
   - Default tab is "Common Room" for all users during common room phases
   - Highlights new posts/replies since last visit
   - Direct access to conversation threads

4. **Phase History Relevance**
   *As a user*, I want Phase History to only show relevant historical content, not empty data.
   **Acceptance Criteria:**
   - During action phases: Phase History tab is renamed "Previous Common Rooms" and only shows common room phase history
   - During common room phases: Phase History shows all previous phases
   - Tab is hidden if no historical phases exist yet

5. **Urgent Content Priority**
   *As a GM*, I want tabs with urgent content (pending reviews, approaching deadlines) to be prioritized.
   **Acceptance Criteria:**
   - If pending applications exist during recruitment, default to "Applications"
   - If phase deadline is within 24 hours, prioritize the relevant action tab
   - URL-based tab override still works (shareable links)

6. **URL Preservation**
   *As a user sharing a link*, I want to specify which tab to open via URL so others see the same content.
   **Acceptance Criteria:**
   - URL query param `?tab=actions` forces that tab to open
   - Default tab logic only applies when no URL param is present
   - Browser back/forward navigation respects tab changes

---

## 2. Technical Design

### 2.1 Database Schema Changes

**No schema changes required** - all necessary data exists in current tables.

**Queries Needed**: None new. Existing queries provide:
- Current phase type (`getCurrentPhase`)
- Pending applications count (from `game_applications`)
- Phase deadline (from `game_phases`)

### 2.2 Backend Implementation

**Minimal backend changes** - all logic is frontend-based.

**Optional Enhancement** (not required for MVP):
If we want to enrich game detail API with "recommended tab", add to response:

```go
// In backend/pkg/core/models.go
type GameWithDetails struct {
	// ... existing fields ...
	RecommendedTab *string `json:"recommended_tab,omitempty"` // Optional: pre-calculated tab
}
```

**Decision**: Start with pure frontend logic. Backend enrichment can be added later if needed for performance or consistency.

### 2.3 Frontend Implementation

#### 2.3.1 Smart Tab Selection Algorithm

**File**: `frontend/src/hooks/useGameTabs.ts` (update existing hook)

**New Logic** (lines 96-105 replacement):

```typescript
// Smart default tab selection logic based on context
const defaultTab = useMemo(() => {
  if (tabs.length === 0) return 'info';

  // Context-aware tab selection
  const context = {
    gameState,
    currentPhaseType,
    isGM,
    hasPendingApplications: false, // TODO: Pass from props if needed
    phaseDeadlineWithin24h: false, // TODO: Calculate from currentPhaseData
  };

  // Priority 1: Recruitment with pending applications (GM only)
  if (context.gameState === 'recruitment' && context.isGM && context.hasPendingApplications) {
    if (tabs.some(t => t.id === 'applications')) return 'applications';
  }

  // Priority 2: In-progress game - phase-aware defaults
  if (context.gameState === 'in_progress' && context.currentPhaseType) {
    if (context.currentPhaseType === 'common_room') {
      // Common room phase - everyone goes to common room
      if (tabs.some(t => t.id === 'common-room')) return 'common-room';
    } else if (context.currentPhaseType === 'action') {
      // Action phase - different default for GM vs players
      if (context.isGM) {
        // GMs see pending submissions in Actions tab
        if (tabs.some(t => t.id === 'actions')) return 'actions';
      } else {
        // Players go to Submit Action
        if (tabs.some(t => t.id === 'actions')) return 'actions';
      }
    }
  }

  // Priority 3: Character creation - go to characters
  if (context.gameState === 'character_creation') {
    if (tabs.some(t => t.id === 'characters')) return 'characters';
  }

  // Priority 4: Completed/cancelled games - phase history
  if (context.gameState === 'completed' || context.gameState === 'cancelled') {
    if (tabs.some(t => t.id === 'phase-history')) return 'phase-history';
  }

  // Fallback: First tab
  return tabs[0].id;
}, [tabs, gameState, currentPhaseType, isGM]);
```

**Enhanced Version with Urgency** (Phase 2 enhancement):

```typescript
interface SmartTabContext {
  gameState: GameState;
  currentPhaseType?: string;
  isGM: boolean;
  hasPendingApplications: boolean;
  pendingApplicationsCount?: number;
  phaseDeadline?: Date;
  hasUnreadMessages: boolean;
  unreadMessagesCount?: number;
  hasSubmittedAction: boolean;
}

const calculateDefaultTab = (tabs: Tab[], context: SmartTabContext): string => {
  if (tabs.length === 0) return 'info';

  const now = new Date();
  const deadlineWithin24h = context.phaseDeadline
    ? context.phaseDeadline.getTime() - now.getTime() < 24 * 60 * 60 * 1000
    : false;

  // Urgency-based prioritization
  if (context.gameState === 'recruitment') {
    if (context.isGM && context.hasPendingApplications) {
      return 'applications'; // Urgent: review applications
    }
    return 'info'; // No urgency, show game info
  }

  if (context.gameState === 'in_progress') {
    // Urgent: Action phase with deadline approaching
    if (context.currentPhaseType === 'action' && deadlineWithin24h) {
      if (context.isGM) {
        return 'actions'; // GM needs to see submissions before processing
      } else if (!context.hasSubmittedAction) {
        return 'actions'; // Player hasn't submitted yet!
      }
    }

    // Normal priority: Follow phase type
    if (context.currentPhaseType === 'common_room') {
      return 'common-room';
    } else if (context.currentPhaseType === 'action') {
      return 'actions';
    }
  }

  // Default fallback
  return tabs[0].id;
};
```

#### 2.3.2 Phase History Filtering

**Update Tab Configuration** (lines 65-81 in `useGameTabs.ts`):

```typescript
} else if (gameState === 'in_progress') {
  // Common Room is primary when it's a common_room phase
  if (currentPhaseType === 'common_room') {
    tabList.push({ id: 'common-room', label: 'Common Room', icon: icons.commonRoom });
  }

  // Phases tab (GM only)
  if (isGM) {
    tabList.push({ id: 'phases', label: 'Phases', icon: icons.phases });
  }

  // Actions tab
  tabList.push({ id: 'actions', label: isGM ? 'Actions' : 'Submit Action', icon: icons.actions });

  // Characters
  tabList.push({ id: 'characters', label: 'Characters', icon: icons.characters });

  // Messages
  tabList.push({ id: 'messages', label: 'Messages', icon: icons.messages });

  // Phase History - context-aware label
  const phaseHistoryLabel = currentPhaseType === 'action' ? 'Previous Common Rooms' : 'Phase History';
  tabList.push({ id: 'phase-history', label: phaseHistoryLabel, icon: icons.phaseHistory });
}
```

**Update Phase History Content Filtering**:

**File**: `frontend/src/components/PhaseHistoryView.tsx` (update filter logic)

```typescript
// Add prop to filter phase types
interface PhaseHistoryViewProps {
  gameId: number;
  filterPhaseType?: 'common_room' | 'action'; // New prop
}

export function PhaseHistoryView({ gameId, filterPhaseType }: PhaseHistoryViewProps) {
  const { data: phases, isLoading } = useQuery({
    queryKey: ['phases', gameId],
    queryFn: () => apiClient.phases.getPhases(gameId),
  });

  // Filter phases based on prop
  const filteredPhases = useMemo(() => {
    if (!phases?.data) return [];
    if (!filterPhaseType) return phases.data;

    return phases.data.filter(phase => phase.phase_type === filterPhaseType);
  }, [phases, filterPhaseType]);

  // ... rest of component using filteredPhases instead of phases.data
}
```

**Update GameTabContent to pass filter**:

**File**: `frontend/src/components/GameTabContent.tsx`

```typescript
{activeTab === 'phase-history' && (
  <PhaseHistoryView
    gameId={gameId}
    filterPhaseType={currentPhaseData?.phase?.phase_type === 'action' ? 'common_room' : undefined}
  />
)}
```

#### 2.3.3 Enhanced Hook Interface

**Updated `useGameTabs` hook signature**:

```typescript
interface UseGameTabsOptions {
  gameState: GameState;
  isGM: boolean;
  participantCount: number;
  currentPhaseType?: string;
  // New optional props for smart selection
  hasPendingApplications?: boolean;
  phaseDeadline?: Date;
  hasUnreadMessages?: boolean;
  hasSubmittedAction?: boolean;
}

export function useGameTabs(options: UseGameTabsOptions) {
  // ... existing implementation with enhanced defaultTab logic
}
```

**Updated usage in GameDetailsPage**:

```typescript
const { tabs, activeTab, setActiveTab } = useGameTabs({
  gameState: game?.state || 'setup',
  isGM,
  participantCount: participants.length,
  currentPhaseType: currentPhaseData?.phase?.phase_type,
  // Enhanced context (optional, graceful degradation if not provided)
  phaseDeadline: currentPhaseData?.phase?.deadline ? new Date(currentPhaseData.phase.deadline) : undefined,
  // TODO: Add these when data is available
  // hasPendingApplications: applications?.some(a => a.status === 'pending'),
  // hasUnreadMessages: unreadCount > 0,
  // hasSubmittedAction: currentAction?.submission_time != null,
});
```

---

## 3. Testing Strategy

### 3.1 Frontend Testing

#### Unit Tests (>85% Coverage Target)

**File**: `frontend/src/hooks/useGameTabs.test.ts` (additions)

```typescript
describe('useGameTabs - Smart Tab Selection', () => {
  it('should default to Actions tab for GM during action phase', () => {
    const { result } = renderHook(() => useGameTabs({
      gameState: 'in_progress',
      isGM: true,
      participantCount: 4,
      currentPhaseType: 'action',
    }), { wrapper });

    expect(result.current.activeTab).toBe('actions');
  });

  it('should default to Submit Action tab for player during action phase', () => {
    const { result } = renderHook(() => useGameTabs({
      gameState: 'in_progress',
      isGM: false,
      participantCount: 4,
      currentPhaseType: 'action',
    }), { wrapper });

    expect(result.current.activeTab).toBe('actions');
  });

  it('should default to Common Room tab during common room phase', () => {
    const { result } = renderHook(() => useGameTabs({
      gameState: 'in_progress',
      isGM: false,
      participantCount: 4,
      currentPhaseType: 'common_room',
    }), { wrapper });

    expect(result.current.activeTab).toBe('common-room');
  });

  it('should default to Applications tab when pending applications exist', () => {
    const { result } = renderHook(() => useGameTabs({
      gameState: 'recruitment',
      isGM: true,
      participantCount: 2,
      hasPendingApplications: true,
    }), { wrapper });

    expect(result.current.activeTab).toBe('applications');
  });

  it('should default to Characters tab during character creation', () => {
    const { result } = renderHook(() => useGameTabs({
      gameState: 'character_creation',
      isGM: false,
      participantCount: 4,
    }), { wrapper });

    expect(result.current.activeTab).toBe('characters');
  });

  it('should default to Phase History for completed games', () => {
    const { result } = renderHook(() => useGameTabs({
      gameState: 'completed',
      isGM: false,
      participantCount: 4,
    }), { wrapper });

    expect(result.current.activeTab).toBe('phase-history');
  });

  it('should respect URL tab parameter over smart default', () => {
    // Mock URL with tab param
    const mockSearchParams = new URLSearchParams('?tab=characters');
    vi.mocked(useSearchParams).mockReturnValue([mockSearchParams, vi.fn()]);

    const { result } = renderHook(() => useGameTabs({
      gameState: 'in_progress',
      isGM: false,
      participantCount: 4,
      currentPhaseType: 'action',
    }), { wrapper });

    // Even though default would be 'actions', URL param takes precedence
    expect(result.current.activeTab).toBe('characters');
  });

  it('should rename Phase History to "Previous Common Rooms" during action phase', () => {
    const { result } = renderHook(() => useGameTabs({
      gameState: 'in_progress',
      isGM: false,
      participantCount: 4,
      currentPhaseType: 'action',
    }), { wrapper });

    const phaseHistoryTab = result.current.tabs.find(t => t.id === 'phase-history');
    expect(phaseHistoryTab?.label).toBe('Previous Common Rooms');
  });

  it('should keep "Phase History" label during common room phase', () => {
    const { result } = renderHook(() => useGameTabs({
      gameState: 'in_progress',
      isGM: false,
      participantCount: 4,
      currentPhaseType: 'common_room',
    }), { wrapper });

    const phaseHistoryTab = result.current.tabs.find(t => t.id === 'phase-history');
    expect(phaseHistoryTab?.label).toBe('Phase History');
  });
});
```

#### Component Tests

**File**: `frontend/src/components/PhaseHistoryView.test.tsx` (additions)

```typescript
describe('PhaseHistoryView - Filtering', () => {
  const mockPhases = [
    {
      id: 1,
      phase_type: 'common_room',
      title: 'Common Room 1',
      phase_number: 1,
    },
    {
      id: 2,
      phase_type: 'action',
      title: 'Action Phase 1',
      phase_number: 2,
    },
    {
      id: 3,
      phase_type: 'common_room',
      title: 'Common Room 2',
      phase_number: 3,
    },
  ];

  it('should show all phases when no filter is applied', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/games/:id/phases', () => {
        return HttpResponse.json(mockPhases);
      })
    );

    render(<PhaseHistoryView gameId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Common Room 1')).toBeInTheDocument();
      expect(screen.getByText('Action Phase 1')).toBeInTheDocument();
      expect(screen.getByText('Common Room 2')).toBeInTheDocument();
    });
  });

  it('should show only common room phases when filtered', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/games/:id/phases', () => {
        return HttpResponse.json(mockPhases);
      })
    );

    render(<PhaseHistoryView gameId={1} filterPhaseType="common_room" />);

    await waitFor(() => {
      expect(screen.getByText('Common Room 1')).toBeInTheDocument();
      expect(screen.queryByText('Action Phase 1')).not.toBeInTheDocument();
      expect(screen.getByText('Common Room 2')).toBeInTheDocument();
    });
  });
});
```

### 3.2 Manual Testing Checklist

**Comprehensive Tab Navigation Testing:**

#### Default Tab Selection
- [ ] **GM during recruitment with pending apps**: Default tab is "Applications"
- [ ] **GM during recruitment without pending apps**: Default tab is "Participants" or "Info"
- [ ] **Player during recruitment**: Default tab is "Participants" or "Info"
- [ ] **GM during character creation**: Default tab is "Characters"
- [ ] **Player during character creation**: Default tab is "Characters"
- [ ] **GM during action phase**: Default tab is "Actions"
- [ ] **Player during action phase**: Default tab is "Submit Action"
- [ ] **Anyone during common room phase**: Default tab is "Common Room"
- [ ] **Anyone viewing completed game**: Default tab is "Phase History"
- [ ] **Setup state (GM)**: Default tab is "Game Info"

#### Phase History Tab
- [ ] During action phase: Tab label is "Previous Common Rooms"
- [ ] During common room phase: Tab label is "Phase History"
- [ ] During action phase: Only common room phases displayed in history
- [ ] During common room phase: All phases displayed in history
- [ ] Empty state shown if no historical phases exist

#### URL Override
- [ ] URL param `?tab=characters` overrides default tab
- [ ] URL param `?tab=actions` overrides default tab
- [ ] Invalid tab in URL falls back to smart default
- [ ] No tab in URL uses smart default
- [ ] Clicking tabs updates URL
- [ ] Browser back/forward navigation works correctly

#### Tab Switching
- [ ] Clicking a tab switches content correctly
- [ ] Active tab is visually highlighted
- [ ] Switching tabs doesn't lose form data (if applicable)
- [ ] Fast tab switching doesn't cause race conditions

#### Edge Cases
- [ ] Game with no current phase shows appropriate tabs
- [ ] Game transitioning between phases updates tabs correctly
- [ ] Player becoming GM (role change) updates tabs
- [ ] Unauthenticated visitor sees correct (limited) tabs

### 3.3 User Journeys for Future E2E Tests

**User Journey 1: GM Managing Action Phase**
```gherkin
Given I am a GM and the game is in an action phase
When I navigate to the game details page
Then the "Actions" tab should be selected by default
And I should see pending player action submissions
When I click "Review" on a submission
Then I should see the submission details
And I can approve or request changes
```

**User Journey 2: Player Submitting Action**
```gherkin
Given I am a player and the game is in an action phase
When I navigate to the game details page
Then the "Submit Action" tab should be selected by default
And I should see the action submission form
When I fill out my action and click "Submit"
Then my action should be saved
And the page should show "Action Submitted" confirmation
```

**User Journey 3: Common Room Participation**
```gherkin
Given I am a player and the game is in a common room phase
When I navigate to the game details page
Then the "Common Room" tab should be selected by default
And I should see the common room conversation
When I click on a new post indicator
Then I should scroll to that new post
```

**User Journey 4: Phase History During Action Phase**
```gherkin
Given I am a player and the game is in an action phase
When I navigate to the game details page
And I click on the "Previous Common Rooms" tab
Then I should see only previous common room phases
And I should NOT see previous action phases
And each common room entry should be clickable
```

---

## 4. Implementation Plan

### 4.1 Phase 1: Smart Default Tab Selection (Day 1)

**Tasks:**
- [ ] Update `useGameTabs` hook with smart default tab logic
- [ ] Implement context-aware tab selection algorithm
- [ ] Add unit tests for all game state + phase type combinations
- [ ] Test with URL override scenarios
- [ ] Verify tests pass: `just test-frontend`
- [ ] Manual testing with all game states

**Acceptance Criteria:**
- ✅ Default tab matches expected tab for all scenarios
- ✅ URL override still works (backward compatibility)
- ✅ Unit tests >90% coverage on smart selection logic
- ✅ No regressions in existing tab behavior

### 4.2 Phase 2: Phase History Filtering (Day 1-2)

**Tasks:**
- [ ] Update tab label logic: "Phase History" vs "Previous Common Rooms"
- [ ] Add `filterPhaseType` prop to `PhaseHistoryView` component
- [ ] Implement phase filtering in PhaseHistoryView
- [ ] Update `GameTabContent` to pass filter based on current phase
- [ ] Write component tests for filtered view
- [ ] Manual testing: verify correct phases shown in each context

**Acceptance Criteria:**
- ✅ Action phase shows "Previous Common Rooms" tab
- ✅ Common room phase shows "Phase History" tab
- ✅ Filtered history only shows relevant phase types
- ✅ Component tests verify filtering logic
- ✅ Empty state shown when no historical phases match filter

### 4.3 Phase 3: Enhanced Context (Optional - Day 2-3)

**Tasks:**
- [ ] Add `hasPendingApplications` logic to GameDetailsPage
- [ ] Pass pending application count to useGameTabs
- [ ] Add `phaseDeadline` prop to useGameTabs
- [ ] Implement urgency-based prioritization (deadlines within 24h)
- [ ] Update tests to cover urgency scenarios
- [ ] Manual testing with different urgency levels

**Acceptance Criteria:**
- ✅ Pending applications trigger Applications tab default (GM)
- ✅ Approaching deadline prioritizes action tab
- ✅ All enhanced context tests passing
- ✅ Graceful degradation if context unavailable

### 4.4 Phase 4: Polish & Documentation (Day 3)

**Tasks:**
- [ ] Complete manual testing checklist
- [ ] Fix any bugs discovered
- [ ] Update user documentation (how tabs work)
- [ ] Update developer documentation (smart tab algorithm)
- [ ] Add inline code comments explaining logic
- [ ] Verify browser compatibility (Chrome, Firefox, Safari)
- [ ] Verify mobile responsiveness

**Acceptance Criteria:**
- ✅ All manual testing items pass
- ✅ No accessibility issues
- ✅ Documentation complete and accurate
- ✅ Code is well-commented

---

## 5. Rollout Strategy

### 5.1 Deployment Plan

**Pre-Deployment:**
1. Run frontend test suite: `just test-frontend`
2. Manual testing on all game states
3. Cross-browser testing

**Deployment:**
1. Deploy frontend update (pure frontend change, no backend required)
2. No database migration needed
3. Monitor error rates post-deployment

**Post-Deployment:**
1. Gather user feedback on default tab accuracy
2. Track tab switching rates (should decrease)
3. Measure time to first interaction

### 5.2 Rollback Plan

**If issues arise:**
1. Revert to previous useGameTabs implementation
2. Restore original default tab logic (first tab or common-room)
3. No data loss or corruption risk (pure frontend change)

**Monitoring Alerts:**
- Alert if tab navigation error rate >2%
- Alert if users immediately switch tabs >50% of time (indicates poor defaults)

### 5.3 Feature Flag (Optional)

```typescript
// For A/B testing
const useSmartTabs = useFeatureFlag('smart_tab_navigation');

const defaultTab = useSmartTabs
  ? calculateSmartDefaultTab(context)
  : calculateLegacyDefaultTab(tabs);
```

This allows:
- A/B testing smart vs legacy tab selection
- Gradual rollout to measure impact
- Easy rollback without deployment

---

## 6. Monitoring and Success Metrics

### 6.1 Technical Metrics

**Frontend Metrics:**
- Tab selection latency (target: <50ms)
- Tab switch rate per page view (target: <30% reduction)
- URL override usage rate
- Error rate in tab rendering

### 6.2 Product Metrics

**User Behavior Metrics:**
- **Default Tab Accuracy**: % of users who stay on default tab (target: >80%)
- **Tab Switches per Visit**: Average number of tab changes (target: <1.5, down from ~2.0)
- **Time to First Interaction**: Time from page load to first action (target: 20% reduction)
- **GM Action Review Time**: Time from page load to reviewing first action (target: 30% reduction)

**Success Metrics (30 days post-launch):**
- ✅ Default tab accuracy >80%
- ✅ Tab switches per visit reduced by 25%
- ✅ Time to relevant content reduced by 30%
- ✅ User satisfaction survey: "Navigation" >4/5

### 6.3 Analytics Events

**Track these events:**
```typescript
// Track default tab selections
analytics.track('game_page_loaded', {
  game_id: gameId,
  game_state: gameState,
  current_phase_type: currentPhaseType,
  default_tab: defaultTab,
  user_role: isGM ? 'gm' : 'player',
});

// Track immediate tab switches (indicates poor default)
analytics.track('tab_switched_immediately', {
  game_id: gameId,
  from_tab: defaultTab,
  to_tab: newTab,
  time_to_switch_ms: switchTime,
});

// Track tab engagement
analytics.track('tab_engaged', {
  game_id: gameId,
  tab_id: activeTab,
  time_spent_seconds: engagementTime,
});
```

---

## 7. Documentation Updates

### 7.1 User Documentation

**Add to User Guide** (`docs/user-guide/navigating-games.md`):

```markdown
# Navigating Game Details

## Smart Tab Defaults

ActionPhase automatically selects the most relevant tab when you visit a game page:

### During Recruitment
- **GMs with pending applications**: Applications tab (review applicants)
- **Everyone else**: Participants tab (see who's joining)

### During Character Creation
- **Everyone**: Characters tab (create your character)

### During Action Phase
- **GMs**: Actions tab (review player submissions)
- **Players**: Submit Action tab (submit your action)

### During Common Room Phase
- **Everyone**: Common Room tab (join the conversation)

### Completed Games
- **Everyone**: Phase History tab (review the game story)

## Phase History

The Phase History tab shows different content depending on the current phase:

- **During Action Phase**: Shows "Previous Common Rooms" - only past discussion phases
- **During Common Room Phase**: Shows "Phase History" - all previous phases

This helps you focus on relevant historical content without clutter.

## Manual Tab Selection

You can always click any tab to view other content. Your tab selection is saved in the URL, so you can bookmark or share specific tabs.

**Example**: Share a link to the Characters tab: `/games/42?tab=characters`
```

### 7.2 Developer Documentation

**Add to Developer Guide** (`docs/development/tab-navigation.md`):

```markdown
# Tab Navigation System

## Smart Default Tab Selection

The `useGameTabs` hook automatically selects the most contextually relevant tab based on:

1. **Game State** (`setup`, `recruitment`, `character_creation`, `in_progress`, `completed`)
2. **Current Phase Type** (`action` or `common_room` for in-progress games)
3. **User Role** (GM vs player)
4. **Urgency Indicators** (optional: pending applications, approaching deadlines)

### Algorithm

```typescript
const calculateDefaultTab = (context: SmartTabContext): string => {
  // Priority 1: Pending actions for GMs
  if (context.isGM && context.hasPendingApplications) return 'applications';

  // Priority 2: Phase-specific defaults
  if (context.gameState === 'in_progress') {
    if (context.currentPhaseType === 'common_room') return 'common-room';
    if (context.currentPhaseType === 'action') return 'actions';
  }

  // Priority 3: Game state defaults
  if (context.gameState === 'character_creation') return 'characters';
  if (context.gameState === 'completed') return 'phase-history';

  // Fallback: first available tab
  return tabs[0].id;
};
```

### URL Override

URL query parameters always take precedence over smart defaults:
- `?tab=characters` → Always opens Characters tab
- `?tab=invalid` → Falls back to smart default

### Adding New Tab Logic

To extend smart tab selection:
1. Update `SmartTabContext` interface with new context
2. Add new priority rule in `calculateDefaultTab`
3. Add corresponding unit tests
4. Update documentation

## Phase History Filtering

The Phase History tab filters content based on current phase:

```typescript
<PhaseHistoryView
  gameId={gameId}
  filterPhaseType={currentPhaseType === 'action' ? 'common_room' : undefined}
/>
```

This ensures users only see relevant historical phases.
```

---

## 8. Open Questions and Decisions

### 8.1 Resolved Decisions

**Q: Should tab defaults be user-customizable?**
**A**: Not in v1. Track metrics first; if >20% of users consistently switch tabs, consider customization in P3.

**Q: Should we hide Phase History during action phases instead of filtering?**
**A**: No. Filtering + renaming is better - users can still access common room history, which is useful.

**Q: Should URL override always take precedence?**
**A**: Yes. Shareable links and bookmarks are important for collaboration.

**Q: What about unread message counts or notification badges?**
**A**: Handled separately in `FEATURE_NOTIFICATIONS_UX.md`. This plan focuses on smart defaults without visual indicators.

### 8.2 Open Questions

**Q: Should we prioritize tabs with unread notifications?**
**Context**: If Messages tab has 5 unread, should it become default?
**Recommendation**: No for v1 (too aggressive). Test in A/B experiment later.

**Q: How to handle rapid phase transitions?**
**Context**: If phase changes while user is on page, should tab auto-switch?
**Recommendation**: No auto-switch (jarring UX). Show notification instead: "Phase changed - view new phase?"

**Q: Should we track "bad default" metrics?**
**Context**: If user switches tab within 2 seconds, default was probably wrong
**Recommendation**: Yes. Track and use to refine algorithm over time.

---

## 9. Future Enhancements (Post-V1)

### P3: User-Customizable Defaults
- Allow users to set preferred default tab per game state
- Stored in user preferences table
- Overrides smart logic but respects URL params

### P3: Deep Linking
- Link directly to specific phase: `/games/42/phases/5`
- Link to specific action submission: `/games/42/actions/17`
- Link to specific conversation thread: `/games/42/common-room/thread/8`

### P4: Usage-Based Prioritization
- Track which tabs users visit most frequently
- Adjust default tab based on personal usage patterns
- Machine learning for personalized defaults

### P4: Tab Badges
- Show unread counts on tab labels
- Visual urgency indicators (red dot for critical)
- Integrated with notification system

---

## 10. Revision History

| Date | Changes | Author |
|------|---------|--------|
| 2025-10-19 | Initial plan created | AI Planning Session |
| | | |
