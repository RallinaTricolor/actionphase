# UI/UX Improvements - Master Plan

**Created**: 2025-10-19
**Status**: Planning
**Owner**: AI Planning Session
**Source**: UI_UX_NOTES.md

---

## Overview

This document provides an overview of all planned UI/UX improvements for ActionPhase. Each improvement has a detailed feature plan document that follows our standard template with comprehensive technical specifications, test strategies, and implementation phases.

---

## Priority Matrix

### P0 - High Priority (Must Have)
**Goal**: Fix critical usability issues that block core workflows

1. **Dashboard Redesign** → `FEATURE_DASHBOARD_REDESIGN.md` ✅
   - **Problem**: Current dashboard is cluttered and not productive
   - **Impact**: Users can't quickly find games requiring their attention
   - **Effort**: Medium (6-8 days)
   - **Status**: Plan complete

2. **Game Listing Enhancements** → `FEATURE_GAME_LISTING_ENHANCEMENTS.md`
   - **Problem**: No way to filter/sort games, active games not highlighted
   - **Impact**: Hard to find relevant games, especially for active players
   - **Effort**: Medium (5-7 days)
   - **Status**: Ready to plan

### P1 - Medium-High Priority (Should Have)
**Goal**: Improve core game experience and navigation

3. **Smart Tab Navigation** → `FEATURE_SMART_TAB_NAVIGATION.md`
   - **Problem**: Default tab doesn't match current phase context
   - **Impact**: Extra clicks to get to relevant content
   - **Effort**: Small (2-3 days)
   - **Status**: Ready to plan

4. **Common Room UX Improvements** → `FEATURE_COMMON_ROOM_UX.md`
   - **Problem**: Poor visual separation, no new post indicators, deep nesting issues
   - **Impact**: Hard to follow conversations, miss new activity
   - **Effort**: Large (8-10 days)
   - **Status**: Ready to plan

### P2 - Medium Priority (Nice to Have)
**Goal**: Polish and infrastructure for better UX

5. **Notifications UX** → `FEATURE_NOTIFICATIONS_UX.md`
   - **Problem**: Dark-on-dark styling, no "View All" page
   - **Impact**: Hard to read notifications, can't review history
   - **Effort**: Small (2-3 days)
   - **Status**: Ready to plan

6. **Dark Mode + User Preferences** → `FEATURE_DARK_MODE.md`
   - **Problem**: No theme support, no settings page
   - **Impact**: Eye strain for some users, no personalization
   - **Effort**: Large (10-12 days) - Infrastructure + Theme
   - **Status**: Ready to plan

7. **Private Messages UX** → `FEATURE_PRIVATE_MESSAGES_UX.md`
   - **Problem**: Limited screen real estate, no auto-scroll to unread
   - **Impact**: Clunky messaging experience
   - **Effort**: Medium (4-5 days)
   - **Status**: Ready to plan

### P3 - Future / Deferred
**Goal**: Advanced features for future iterations

8. **Audience Support** → Separate plan document needed
   - **Problem**: No support for non-participating viewers
   - **Impact**: Can't share games with friends/audience
   - **Effort**: Very Large (15+ days)
   - **Status**: Requires separate design discussion

---

## Implementation Roadmap

### Sprint 1 (High Priority - Core Navigation)
**Duration**: 2-3 weeks
**Focus**: Fix critical navigation and discovery issues

- [ ] **Week 1-2**: FEATURE_DASHBOARD_REDESIGN
  - Backend: Dashboard service + API
  - Frontend: Dashboard page + components
  - Testing: Unit + component + manual

- [ ] **Week 2-3**: FEATURE_GAME_LISTING_ENHANCEMENTS
  - Backend: Filters + sorting queries
  - Frontend: Filter UI + game cards
  - Testing: Unit + component + manual

**Success Metric**: Users can find their active games in <5 seconds from login

---

### Sprint 2 (Medium-High Priority - Game Experience)
**Duration**: 2 weeks
**Focus**: Improve in-game navigation and communication

- [ ] **Week 1**: FEATURE_SMART_TAB_NAVIGATION
  - Backend: Minimal (context detection)
  - Frontend: Tab routing logic
  - Testing: Component + manual

- [ ] **Week 1-2**: FEATURE_COMMON_ROOM_UX
  - Backend: Threading improvements
  - Frontend: UI redesign + nesting handling
  - Testing: Extensive component + manual

**Success Metric**: Players spend 30% less time navigating to relevant content

---

### Sprint 3 (Medium Priority - Polish)
**Duration**: 2-3 weeks
**Focus**: Polish notifications and add theme support

- [ ] **Week 1**: FEATURE_NOTIFICATIONS_UX
  - Backend: Minimal (pagination)
  - Frontend: Styling fixes + view all page
  - Testing: Component + manual

- [ ] **Week 1-3**: FEATURE_DARK_MODE
  - Backend: User preferences table + API
  - Frontend: Theme infrastructure + dark styles
  - Testing: Extensive manual (all pages in both themes)

- [ ] **Week 2-3**: FEATURE_PRIVATE_MESSAGES_UX
  - Backend: Minimal
  - Frontend: Layout improvements + auto-scroll
  - Testing: Component + manual

**Success Metric**: 50%+ of users enable dark mode, notification engagement increases

---

## Dependencies

### Feature Dependencies
```
FEATURE_DARK_MODE (user preferences infrastructure)
  └─> Required by: Future personalization features

FEATURE_DASHBOARD_REDESIGN
  └─> Blocks: Nothing (standalone)
  └─> Enhanced by: FEATURE_SMART_TAB_NAVIGATION (better navigation)

FEATURE_COMMON_ROOM_UX
  └─> Blocks: Nothing (standalone)
  └─> Enhanced by: FEATURE_DARK_MODE (theme support)

FEATURE_NOTIFICATIONS_UX
  └─> Blocks: Nothing (standalone)
  └─> Enhanced by: FEATURE_DARK_MODE (styling in theme)
```

### Technical Dependencies
- All features require existing auth system
- Dark mode requires user preferences infrastructure (new)
- Common room improvements may need message indexing
- Dashboard requires optimized queries (add indexes if needed)

---

## Success Metrics

### Quantitative Metrics
- **Dashboard**: Time to find active game <5 seconds (vs. current ~20s)
- **Game Listing**: Filter usage rate >40% of game browse sessions
- **Tab Navigation**: Reduce avg clicks to relevant content by 30%
- **Common Room**: Engagement time increases 20%
- **Notifications**: Read rate increases from ~40% to >60%
- **Dark Mode**: Adoption rate >50% within 2 weeks
- **Private Messages**: Response time improves 15%

### Qualitative Metrics
- User feedback survey: "Finding games" satisfaction >4/5
- User feedback survey: "Navigation" satisfaction >4/5
- User feedback survey: "Communication" satisfaction >4/5
- Zero complaints about dark-on-dark text
- Positive feedback on theme customization

---

## Risk Assessment

### High Risk Items
1. **Common Room nested conversations** - Complex UI problem
   - Mitigation: Prototype multiple approaches, user test early
   - Fallback: Limit nesting depth to 3 levels

2. **Dashboard query performance** - Could be slow with many games
   - Mitigation: Add indexes, test with 50+ games
   - Fallback: Paginate or limit to top 20 games

3. **Dark mode implementation scope** - Easy to underestimate
   - Mitigation: Audit all components first, create checklist
   - Fallback: Launch with partial coverage, iterate

### Medium Risk Items
1. **Game listing filters** - Many options = complex UI
   - Mitigation: Start with 3-4 most important filters
   - Fallback: Progressive disclosure pattern

2. **Private message auto-scroll** - Tricky UX problem
   - Mitigation: Research best practices (Slack, Discord)
   - Fallback: Manual "Jump to unread" button

---

## Architecture Decisions

### New Infrastructure Needed

1. **User Preferences System** (FEATURE_DARK_MODE)
   - New table: `user_preferences`
   - Columns: theme, timezone, notification_settings (JSONB)
   - API: GET/PUT /api/v1/users/:id/preferences

2. **Dashboard Data Service** (FEATURE_DASHBOARD_REDESIGN)
   - Aggregate queries across games, messages, notifications
   - Caching strategy: React Query (1min staleTime)

3. **Game Filtering/Sorting** (FEATURE_GAME_LISTING_ENHANCEMENTS)
   - URL query params for state preservation
   - Backend: Dynamic WHERE clauses based on filters
   - Frontend: Filter component with URL sync

### Shared Components

Several features will share components:
- **Badge/Counter** component (notifications, unread counts)
- **Card** component (game cards, message cards)
- **FilterBar** component (game listing, future: character listing)
- **LoadingSkeleton** component (dashboard, game listing)

**Action**: Create shared component library early in Sprint 1

---

## Testing Strategy

### Test Coverage Requirements
Each feature plan includes:
- ✅ Unit tests: >80% service layer coverage
- ✅ Component tests: >80% coverage with user interaction testing
- ✅ Manual UI testing: Comprehensive checklist in each plan
- ✅ E2E test planning: User journeys documented for future implementation

### Manual Testing Cadence
- **After each feature**: Complete feature-specific manual testing checklist
- **After each sprint**: Regression test all previously implemented features
- **Before production**: Full application manual test (all user roles)

### Performance Testing
- Dashboard load time: <2 seconds
- Game listing with filters: <1 second
- Common room scroll performance: 60fps with 100+ messages
- Theme switch: <100ms perceived delay

---

## Documentation Updates

### User Documentation Needed
- [ ] How to use the new dashboard
- [ ] How to filter and sort games
- [ ] How to change theme preference
- [ ] How to navigate private messages
- [ ] Common room conversation threading guide

### Developer Documentation Needed
- [ ] Dashboard data model and caching strategy
- [ ] User preferences API specification
- [ ] Theme implementation guide
- [ ] Filter component usage guide
- [ ] Testing patterns for themed components

---

## Rollout Strategy

### Phased Rollout Plan

**Phase 1: Core Navigation (Sprint 1)**
- Deploy dashboard + game listing together
- Monitor: Dashboard load times, filter usage
- Success criteria: <5% error rate, <2s load time

**Phase 2: In-Game Experience (Sprint 2)**
- Deploy smart tabs + common room together
- Monitor: Tab navigation patterns, common room engagement
- Success criteria: Increased time in common room, reduced navigation time

**Phase 3: Polish (Sprint 3)**
- Deploy notifications + dark mode + PM improvements
- Monitor: Theme adoption rate, notification read rate
- Success criteria: >40% dark mode adoption, >60% notification read rate

### Feature Flags
Consider feature flags for:
- Dark mode (allow gradual rollout)
- New dashboard (A/B test old vs new)
- Common room threading (easy rollback if issues)

---

## Open Questions

**Product Questions:**
- [ ] Should dashboard be customizable? → Decision: No (future enhancement)
- [ ] Should we support custom themes beyond dark/light? → Decision: Defer to P4
- [ ] How many games should dashboard show before pagination? → Decision: All (unless >20)
- [ ] Should filters persist across sessions? → Decision: Yes (via URL params)

**Technical Questions:**
- [ ] Should we use CSS variables for theming or Tailwind dark mode? → Need to decide before dark mode implementation
- [ ] Should preferences be per-device or per-account? → Decision: Per-account (sync across devices)
- [ ] Should we cache dashboard data server-side? → Decision: No (React Query client-side cache sufficient)

**Design Questions:**
- [ ] How to handle deeply nested comments (>5 levels)? → Need design review
- [ ] What's the visual language for urgency (colors, icons, badges)? → Need design system
- [ ] Should notifications auto-dismiss? → Decision: No (user-controlled only)

---

## Feature Plan Documents

### Completed Plans
1. ✅ **FEATURE_DASHBOARD_REDESIGN.md** (1103 lines)
   - Comprehensive backend + frontend specification
   - Dashboard service with urgency calculation
   - Component hierarchy with 5 new components
   - Test strategy with >85% coverage targets

### Pending Plans
2. **FEATURE_GAME_LISTING_ENHANCEMENTS.md**
3. **FEATURE_SMART_TAB_NAVIGATION.md**
4. **FEATURE_COMMON_ROOM_UX.md**
5. **FEATURE_NOTIFICATIONS_UX.md**
6. **FEATURE_DARK_MODE.md**
7. **FEATURE_PRIVATE_MESSAGES_UX.md**

---

## Next Steps

1. **Review Dashboard Plan**
   - Have user/product owner review FEATURE_DASHBOARD_REDESIGN.md
   - Validate success criteria and metrics
   - Approve for implementation

2. **Create Remaining P0 Plans**
   - Complete FEATURE_GAME_LISTING_ENHANCEMENTS.md
   - Review and approve

3. **Prioritize Sprint 1**
   - Confirm dashboard + game listing as Sprint 1 scope
   - Allocate resources and timeline
   - Set up monitoring for success metrics

4. **Begin Implementation**
   - Start with dashboard backend (Phase 1)
   - Create shared component library in parallel
   - Set up feature flags if needed

---

## References

- **Source Document**: `.claude/planning/UI_UX_NOTES.md`
- **Template**: `.claude/planning/FEATURE_PLAN_TEMPLATE.md`
- **Architecture**: `.claude/context/ARCHITECTURE.md`
- **Testing Guide**: `.claude/context/TESTING.md`
- **State Management**: `.claude/context/STATE_MANAGEMENT.md`

---

## Revision History

| Date | Changes | Author |
|------|---------|--------|
| 2025-10-19 | Initial plan created, dashboard plan complete | AI Planning |
| | | |
