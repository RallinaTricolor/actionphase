# Mobile Common Room - Readability & Usability Issues Report

**Date**: 2025-11-13
**Viewport**: 375x667px (iPhone SE size)
**Page**: http://localhost:5173/games/50723?tab=common-room

## Critical Issues (High Priority)

### 1. **Action Buttons Too Small & Cramped**
- **Location**: Comment action rows (Reply, ▼1, copy link, edit, delete, parent link buttons)
- **Problem**: Multiple small buttons clustered together in a single row, making them difficult to tap accurately on mobile
- **Impact**: High - Primary interaction mechanism is hard to use
- **Evidence**: See `mobile-deep-nesting.png` - multiple icon buttons in tight horizontal row
- **Recommendation**:
  - Increase button padding/size to meet 44x44px touch target minimum
  - Consider moving some actions to overflow menu (three-dot menu)
  - Space out remaining actions more generously
  - On mobile, consider two-row layout for actions if needed

### 2. **Icon-Only Buttons Without Labels**
- **Location**: Copy link, edit, delete, parent navigation buttons
- **Problem**: Only show icons without accompanying text labels
- **Impact**: Medium-High - Users may not understand what buttons do
- **Evidence**: See `mobile-deep-nesting.png` - several icon-only buttons
- **Recommendation**:
  - Add text labels visible on mobile or use aria-labels with tooltips
  - Most critical: edit, delete, and parent navigation icons need labels

### 3. **Deep Comment Nesting Creates Narrow Content**
- **Location**: Nested comment threads (3+ levels deep)
- **Problem**: Progressive indentation (20px per level) creates very narrow reading areas on 375px screen
- **Impact**: High - Makes deeply nested discussions hard to read
- **Evidence**: See `mobile-deep-nesting.png` and full page screenshot
- **Current behavior**: Mobile already shows "Continue this thread" at depth 3
- **Recommendation**:
  - Reduce indentation increment on mobile from 20px to 10px
  - Consider max indentation limit (e.g., 60px) with visual depth indicator
  - Keep current depth-3 cutoff for "Continue this thread" on mobile

## Medium Priority Issues

### 4. **Game Header Information Density**
- **Location**: Top game info section (below title)
- **Problem**: "GM: TestRal • Genre: Testing • 2/6 Players • Started: Nov 22, 2025 • Ended: Dec 6, 2025" all on one wrapping line with bullet separators
- **Impact**: Medium - Information is cramped and hard to scan quickly
- **Evidence**: See `mobile-header-section.png`
- **Recommendation**:
  - Stack metadata into 2-3 rows on mobile instead of single wrapping line
  - Group related info: "GM: TestRal • Genre: Testing" on one line, dates on another
  - Or use card-style layout with clear visual sections

### 5. **Character Avatars Too Small**
- **Location**: Comment headers (circular avatars with initials)
- **Problem**: Avatar circles are quite small, making character initials hard to read
- **Impact**: Low-Medium - Visual hierarchy and character identification could be improved
- **Evidence**: See `mobile-nested-comments.png` and `mobile-deep-nesting.png`
- **Current size**: Appears to be ~32px
- **Recommendation**: Increase to 40-48px on mobile for better visibility

### 6. **Phase Description Box Unclear**
- **Location**: Below "Common Room - Day 1" heading
- **Problem**: Bordered box with just "Test" label appears without clear context
- **Impact**: Low - Minor UI confusion about purpose of this element
- **Evidence**: See `mobile-comments-actions.png`
- **Recommendation**: Either expand with more descriptive content or remove if not essential

## Low Priority Issues

### 7. **"Hide Comments (23)" Button Wording**
- **Location**: Post action area below post content
- **Problem**: Button says "Hide" when comments are visible, could be clearer semantically
- **Impact**: Low - Minor usability/semantics issue
- **Evidence**: See `mobile-nested-comments.png`
- **Recommendation**: Consider "Collapse Comments (23)" / "Expand Comments (23)" terminology

### 8. **Tab Navigation Active State**
- **Location**: "Posts / New Comments / Polls" horizontal tabs
- **Problem**: Active tab indication could be more prominent on mobile
- **Impact**: Low - Current design works but could be more polished
- **Evidence**: See `mobile-comments-actions.png`
- **Recommendation**: Ensure active tab has strong visual distinction (underline + color already present, could be bolder)

## Positive Observations

✅ **Thread View modal** works well on mobile - good use of full-screen overlay
✅ **Alternating background colors** help distinguish nested comments effectively
✅ **Reading Mode button** is prominent and useful for long posts
✅ **Tab dropdown selector** appears at top for quick navigation on mobile
✅ **Mobile-specific depth cutoff** (depth 3 for "Continue this thread") prevents over-nesting
✅ **"Add Comment" button** is properly styled and prominent

## Recommended Implementation Priority

### Phase 1: Touch Targets & Interaction (Critical)
- [ ] Fix action button sizing and spacing (Issue #1)
- [ ] Add labels to icon-only buttons (Issue #2)
- **Estimated effort**: 4-6 hours
- **Files affected**: `ThreadedComment.tsx`, possibly `PostCard.tsx`

### Phase 2: Content Readability (High)
- [ ] Reduce comment indentation on mobile (Issue #3)
- [ ] Improve game header layout (Issue #4)
- **Estimated effort**: 3-4 hours
- **Files affected**: `ThreadedComment.tsx`, game detail header component

### Phase 3: Visual Polish (Medium)
- [ ] Increase character avatar sizes (Issue #5)
- [ ] Fix phase description box (Issue #6)
- [ ] Improve button wording (Issue #7)
- **Estimated effort**: 2-3 hours
- **Files affected**: `CharacterAvatar.tsx`, `CommonRoom.tsx`, `PostCard.tsx`

### Phase 4: Minor Improvements (Low)
- [ ] Enhance tab active state (Issue #8)
- **Estimated effort**: 1 hour
- **Files affected**: `CommonRoom.tsx` or tab component

## Technical Notes

### Touch Target Guidelines
- **Minimum**: 44x44px (iOS/WCAG)
- **Recommended**: 48x48px (Material Design)
- **Current buttons**: Appear to be ~32-36px based on visual inspection

### Responsive Breakpoints to Consider
- Mobile portrait: < 640px (tested at 375px)
- Mobile landscape: 640-768px
- Tablet: 768-1024px

### Files to Review
- `/frontend/src/components/ThreadedComment.tsx` - Main comment rendering
- `/frontend/src/components/PostCard.tsx` - Post rendering and actions
- `/frontend/src/components/CommonRoom.tsx` - Tab navigation and layout
- `/frontend/src/components/CharacterAvatar.tsx` - Avatar sizing
- CSS/Tailwind utilities for mobile-specific spacing

## Additional Observations - Navigation & Layout

### Navigation Bar (Top Header)
✅ **Well-Designed for Mobile**:
- ActionPhase logo/link clearly visible and tappable
- Notifications bell with badge (4) is appropriately sized
- Hamburger menu icon is standard and recognizable
- All touch targets appear to meet 44x44px minimum
- Good contrast and spacing between elements
- **Evidence**: See `mobile-navigation-bar.png`

### Tab Dropdown Selector
✅ **Mobile-Optimized Design**:
- Dropdown select is full-width and easy to tap
- Current selection ("Common Room") clearly displayed
- Chevron icon indicates it's interactive
- Good padding and height for mobile usage
- **Evidence**: See `mobile-tab-selector.png`

### Active Deadlines Section
✅ **Clear Visual Hierarchy**:
- Warning icon (⚠️) draws attention appropriately
- "Active Deadlines (1 active)" label is clear
- Deadline card has good padding and rounded corners
- Time remaining ("1d 12h") is prominent and easy to read
- Orange/amber color scheme effectively conveys urgency
- **Evidence**: See `mobile-tab-selector.png`

**Minor Enhancement Opportunity**:
- Consider making the deadline card tappable to navigate to the specific phase/task
- Could benefit from a subtle hover/active state on mobile

### Footer
✅ **Minimal and Functional**:
- Copyright text is readable
- Centered alignment works well on mobile
- Adequate padding around text
- **Evidence**: See `mobile-footer.png`

## Screenshots Reference
- `mobile-common-room-full.png` - Full page overview
- `mobile-header-section.png` - Game title and metadata
- `mobile-comments-actions.png` - Post header and tab navigation
- `mobile-nested-comments.png` - Comment interaction buttons
- `mobile-deep-nesting.png` - Deep nesting example with action buttons
- `mobile-thread-modal.png` - Thread view modal (working well)
- `mobile-navigation-bar.png` - Top navigation bar
- `mobile-tab-selector.png` - Tab dropdown and active deadlines
- `mobile-footer.png` - Footer area
