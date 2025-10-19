# Development Initiatives Tracker

This document tracks major development initiatives for ActionPhase. Each initiative includes a status, priority, and detailed implementation plan.

**Last Updated**: 2025-10-19

---

## Status Legend
- **Not Started** - Planning complete, implementation not begun
- **In Progress** - Actively being developed
- **Blocked** - Waiting on dependencies or decisions
- **Completed** - Implementation finished and tested

---

## 1. Avatar Implementation

**Status**: ✅ Completed
**Priority**: High
**Completed**: Before 2025-10-18

### Overview
Add user and character avatar support throughout the application, including upload functionality, storage, and display in all relevant UI components.

**Note**: This feature has been fully implemented. Backend has `/api/v1/characters/:id/avatar` endpoints, `avatars` package with service and storage layers, and database schema includes `characters.avatar_url` column. Frontend has avatar components and E2E test fixture (`test-avatar.jpg`) available.

### Backend Implementation

#### Database Changes
- [ ] Create migration for `users.avatar_url` column (nullable varchar)
- [ ] Create migration for `characters.avatar_url` column (nullable varchar)
- [ ] Apply migrations to dev and test databases

#### File Storage
- [ ] Decide on storage strategy (local filesystem vs S3)
- [ ] Create upload directory structure: `uploads/avatars/users/` and `uploads/avatars/characters/`
- [ ] Configure file size limits (e.g., 2MB max)
- [ ] Implement image validation (allowed types: jpg, png, gif, webp)
- [ ] Implement file cleanup for replaced avatars

#### API Endpoints
- [ ] `POST /api/v1/users/avatar` - Upload user avatar
  - Multipart form data
  - Validate image type and size
  - Generate unique filename
  - Save to storage
  - Update user record
  - Return avatar URL
- [ ] `POST /api/v1/characters/:id/avatar` - Upload character avatar
  - Permission check: user owns character
  - Same validation as user avatar
  - Update character record
- [ ] `DELETE /api/v1/users/avatar` - Remove user avatar
- [ ] `DELETE /api/v1/characters/:id/avatar` - Remove character avatar
- [ ] Update existing endpoints to include avatar_url in responses:
  - `GET /api/v1/auth/me`
  - `GET /api/v1/games/:id/characters`
  - `GET /api/v1/characters/:id`

#### Service Layer
- [ ] Create `AvatarService` interface in `core/interfaces.go`
  - `UploadUserAvatar(userID int, file io.Reader, filename string) (string, error)`
  - `UploadCharacterAvatar(charID int, file io.Reader, filename string) (string, error)`
  - `DeleteUserAvatar(userID int) error`
  - `DeleteCharacterAvatar(charID int) error`
- [ ] Implement service in `db/services/avatars.go`
- [ ] Write comprehensive tests in `avatars_test.go`

#### Static File Serving
- [ ] Add static file route for `/uploads/` directory
- [ ] Configure CORS if needed
- [ ] Add cache headers for avatar images

### Frontend Implementation

#### API Client
- [ ] Add avatar upload methods to `lib/api.ts`:
  - `uploadUserAvatar(file: File): Promise<{ avatar_url: string }>`
  - `uploadCharacterAvatar(characterId: number, file: File): Promise<{ avatar_url: string }>`
  - `deleteUserAvatar(): Promise<void>`
  - `deleteCharacterAvatar(characterId: number): Promise<void>`

#### Components
- [ ] Create `Avatar.tsx` component
  - Props: `src`, `alt`, `size` (sm, md, lg, xl)
  - Display image or fallback initials
  - Circular crop
  - Loading state
- [ ] Create `AvatarUpload.tsx` component
  - File input with drag-and-drop
  - Image preview before upload
  - Progress indicator
  - Size validation on client
  - Crop tool (optional, v2)
- [ ] Write tests for both components

#### Integration Points
- [ ] Add avatar to `Layout.tsx` user menu
- [ ] Add avatar to `CharacterCard.tsx`
- [ ] Add avatar to `CharacterSheet.tsx`
- [ ] Add avatar to `PostCard.tsx` for character posts
- [ ] Add avatar to `CommentEditor.tsx` when selecting character
- [ ] Add avatar to `PrivateMessages.tsx` message list
- [ ] Add avatar to `GameApplicationCard.tsx`
- [ ] Add AvatarUpload to user profile page (if exists)
- [ ] Add AvatarUpload to character creation/edit modal

#### Hooks
- [ ] Create `useAvatarUpload` hook
  - Handles file selection
  - Client-side validation
  - Upload mutation
  - Error handling
  - Success callback
- [ ] Write tests for hook

### Testing

#### Backend Tests
- [ ] Unit tests for AvatarService
  - File validation (type, size)
  - Upload success
  - Upload failure (invalid file)
  - Delete success
  - Permissions (character ownership)
- [ ] Integration tests for API endpoints
  - Upload flow end-to-end
  - Auth requirements
  - File serving

#### Frontend Tests
- [ ] Avatar component tests
  - Displays image when src provided
  - Displays fallback when no src
  - Correct size classes
- [ ] AvatarUpload component tests
  - File selection
  - Validation errors
  - Upload progress
  - Success/error states
- [ ] Integration tests in affected components

#### E2E Tests
- [ ] User avatar upload flow
- [ ] Character avatar upload flow
- [ ] Avatar display in various contexts
- [ ] Avatar deletion

### Documentation
- [ ] Update API documentation with new endpoints
- [ ] Add avatar feature to user guide
- [ ] Document storage configuration in deployment guide

---

## 2. Major Refactoring Initiative

**Status**: Week 4 - Final Documentation & Polish (Week 3 Complete)
**Priority**: High
**Estimated Effort**: 4-5 weeks (Week 4 of 4-5 in progress)
**Tracking**: See `.claude/planning/REFACTOR_00_MASTER_PLAN.md`

### Overview
Comprehensive refactoring to address code duplication, test brittleness, and service complexity. Using systematic approach with measurable goals.

**Master Plan**: `.claude/planning/REFACTOR_00_MASTER_PLAN.md`
**Week 4 Plan**: `.claude/planning/WEEK_4_DOCUMENTATION_PLAN.md`

### Phase 1: Analysis & Planning ✅ COMPLETED (2025-01-20)

#### Analysis Tasks Completed
- [x] Review test coverage report for low-coverage areas
- [x] Analyze service complexity (lines of code, cyclomatic complexity)
- [x] Identify duplicate code patterns (found 281 instances)
- [x] Analyzed existing error handling system (found it's well-designed)
- [x] Created comprehensive refactoring plans

**Key Findings**:
- **Large files**: phases.go (1056 lines), games/api.go (1307 lines)
- **Repetitive patterns**: JWT extraction (30×), DB errors (50×), validation (20×)
- **E2E test issues**: Brittleness, hardcoded waits, fixture dependencies
- **Documentation sprawl**: 61+ files with duplication

### Phase 2: Code Reduction Utilities ✅ COMPLETED (Day 1)

#### Created Utilities
- [x] Database error conversion (`core.HandleDBError`)
- [x] JWT extraction helpers (`core.GetUserIDFromJWT`)
- [x] Validation utilities (`core.ValidateRequired`)
- [x] Complete documentation (`backend/pkg/core/UTILITIES_GUIDE.md`)

**Impact Metrics**:
- JWT extraction: 29 lines → 7 lines (76% reduction)
- DB error handling: 8 lines → 5 lines (37% reduction)
- **Estimated total**: ~850 lines of code can be eliminated

### Phase 3: Backend Service Decomposition ✅ COMPLETED (Weeks 1-3)

#### Week 1: Utility Creation & Testing Infrastructure ✅
- [x] Migrate 3 handlers to use new utilities (111 lines eliminated)
- [x] Create integration test infrastructure
- [x] Messages API fully tested at integration level

**Handlers migrated**:
1. `backend/pkg/games/api.go` - 76 lines reduced
2. `backend/pkg/characters/api.go` - 23 lines reduced
3. `backend/pkg/messages/api.go` - 12 lines reduced

#### Week 2: Phase Service Decomposition ✅
- [x] phases.go (1056 lines) → 10 focused files (~800 lines)
- [x] 6 implementation files for phases/ + 6 test files
- [x] 4 implementation files for actions/ + 3 test files
- [x] All files < 250 lines
- [x] 17 comprehensive test functions, all passing

#### Week 3: Message Service Decomposition ✅
- [x] messages.go (699 lines) → 5 focused files (~600 lines)
- [x] 15 test functions, all passing
- [x] API handlers updated
- [x] Full cleanup completed (6 legacy files deleted)

**Remaining Services** - All appropriately sized (< 500 lines):
- notification_service.go (454 lines)
- conversations.go (364 lines)
- game_applications.go (354 lines)
- games.go (298 lines)
- characters.go (223 lines)

### Phase 4: Documentation & Polish (IN PROGRESS - Week 4)

#### Week 4 Goals
- [ ] Delete session files (reduce docs/ from 27 to 20 files)
- [ ] Verify and update key documentation files
- [ ] Simplify Justfile commands (target < 30)
- [ ] Create refactoring retrospective
- [ ] Final testing and verification

**See**: `.claude/planning/WEEK_4_DOCUMENTATION_PLAN.md`

---

## 3. UI/UX Improvements

**Status**: Not Started
**Priority**: Medium
**Estimated Effort**: 2-3 weeks (incremental)

### Overview
Improve user experience through better feedback, responsive design, and polish. Implement incrementally alongside other features.

### Quick Wins (1-2 days)

#### Loading States
- [ ] Add skeleton loaders for:
  - Game list
  - Character list
  - Phase history
  - Notification dropdown
  - Posts and comments
- [ ] Replace spinner-only loading with skeletons

#### Error Messages
- [ ] Audit all error messages for user-friendliness
- [ ] Add specific error messages for common failures:
  - Network errors
  - Permission errors
  - Validation errors
  - Session expiry
- [ ] Add retry buttons where appropriate

#### Toast Notifications
- [ ] Install toast library (e.g., react-hot-toast)
- [ ] Create toast notification context
- [ ] Replace alert() calls with toasts
- [ ] Add success toasts for:
  - Character created
  - Action submitted
  - Comment posted
  - Settings saved
  - Avatar uploaded

### Medium Priority (1 week)

#### Responsive Design
- [ ] Audit mobile experience
- [ ] Fix layout issues on tablet/mobile:
  - Navigation collapse to hamburger menu
  - Game cards stack vertically
  - Character sheet responsive layout
  - Phase management mobile view
- [ ] Test on actual devices

#### Form Improvements
- [ ] Add inline validation to all forms
- [ ] Show field-level errors immediately
- [ ] Add character counters for text fields with limits
- [ ] Improve textarea auto-resize
- [ ] Add "unsaved changes" warning

#### Accessibility
- [ ] Audit with axe DevTools
- [ ] Fix keyboard navigation issues
- [ ] Add proper ARIA labels
- [ ] Ensure sufficient color contrast
- [ ] Test with screen reader

### Major Features (1-2 weeks)

#### Dark Mode
- [ ] Design dark color palette
- [ ] Implement theme context
- [ ] Add theme toggle to user menu
- [ ] Persist theme preference
- [ ] Update all components for dark mode
- [ ] Test readability in both modes

#### Notification Preferences
- [ ] UI for notification settings
- [ ] Backend: `notification_preferences` table
- [ ] API endpoints for preferences CRUD
- [ ] Control notification types:
  - Private messages
  - Phase transitions
  - Action results
  - Game invitations
  - Comments on posts
- [ ] Email notification toggle (future)

#### Game Discovery
- [ ] Public games listing page
- [ ] Search and filter:
  - By game system
  - By status (recruiting, active)
  - By player count
- [ ] Game preview before applying
- [ ] "Featured games" section

### Polish

#### Animations
- [ ] Smooth page transitions
- [ ] Modal enter/exit animations
- [ ] Dropdown animations
- [ ] List item animations (fade in/out)
- [ ] Button hover states

#### Visual Consistency
- [ ] Audit button styles across app
- [ ] Consistent card design
- [ ] Standardize spacing
- [ ] Icon consistency
- [ ] Typography scale review

### Documentation
- [ ] Create UI component library documentation
- [ ] Screenshot all states for reference
- [ ] Document color palette and design tokens

---

## 4. Demo/Test Data Refresh

**Status**: In Progress (Revised 2025-10-18)
**Priority**: High (blocks testing of new features)
**Estimated Effort**: 2-3 days

### Overview
Update test fixtures to include all new features implemented since initial fixture creation. Ensure comprehensive test data for manual testing and E2E tests.

**IMPORTANT**: Based on October 2025 learnings, fixtures should provide **infrastructure only**, not test-specific content. E2E tests create their own dynamic content (posts, messages, etc.) with timestamps.

### Fixture Strategy (Revised)

#### E2E Test Fixtures (Infrastructure Only)
**Purpose**: Provide stable environment for automated tests. **Do NOT include test-specific content.**

- [x] ✅ `07_common_room.sql` - **Already complete**
  - Game #164 with active common_room phase (**is_published = true**)
  - GM and 2 player characters
  - **NO posts** (E2E tests create their own)
  - Used by: character-mentions, autocomplete, notification tests

**What E2E fixtures should NOT include**:
- ❌ Posts with specific content (tests create dynamically with `${Date.now()}`)
- ❌ Comments or replies (tests create during test execution)
- ❌ Notifications (too timing-dependent for fixtures)
- ❌ Private messages (tests create as needed)

#### Manual Testing Fixtures (Sample Content)
**Purpose**: Provide realistic data for developers to manually test features.

- [ ] `08_demo_content.sql` - **New fixture for manual testing only**
  - Sample posts with character mentions
  - Sample private message conversations
  - Sample action results with rich markdown
  - **Used for**: Manual UI exploration, not E2E tests
  - **Note**: This data is for humans, not automated tests

**What demo fixtures should include**:
- ✅ Varied content showcasing all features
- ✅ Edge cases for manual verification
- ✅ Realistic conversation threads
- ✅ Rich markdown examples
- ✅ Character mentions in different contexts

#### Existing Fixtures to Update

- [x] ✅ `01_users.sql` - **Complete** (provides test users)
- [x] ✅ `02_games.sql` - **Complete** (provides game scenarios)
- [x] ✅ `03_characters.sql` - **Complete** (provides characters)
- [x] ✅ `04_phases.sql` - **Complete** (provides phase infrastructure)
- [x] ✅ `05_actions.sql` - **Complete** (provides draft actions for state testing)
- [ ] `06_action_results.sql` - Add more result examples
- [x] ✅ `07_common_room.sql` - **Complete** (E2E infrastructure)

### Next Steps

#### Immediate (For Manual Testing)
1. [ ] Create `08_demo_content.sql` with rich sample content
   - Posts showcasing markdown features
   - Character mentions in various contexts
   - Private message conversations
   - Action results with complex formatting
   - Comments with replies and mentions

2. [ ] Remove GM post from `07_common_room.sql` (lines 76-86)
   - E2E tests create their own posts
   - Keep only infrastructure (game, phase, characters)

#### Future (Avatar Feature Available)
- [ ] Update `08_demo_content.sql` - Include sample avatar_url values for characters
  - Can reference test-avatar.jpg or create sample avatar URLs
  - Note: `characters.avatar_url` column exists and is ready
  - E2E tests already use `frontend/e2e/fixtures/test-avatar.jpg` for uploads

### Test User Scenarios

#### User Personas
1. **GM User** (test_gm@example.com)
   - Has unread notifications
   - Has active games with various statuses
   - Has received private messages with mentions

2. **Player User** (test_player@example.com)
   - Has multiple characters across games
   - Has draft actions pending
   - Has unread messages and notifications
   - Has been mentioned in posts

3. **Multi-Game User** (test_multiuser@example.com)
   - Active in 3+ games
   - Different character types (PC, NPC, companion)
   - Mix of GM and player roles
   - Extensive notification history

### Testing Scenarios

#### Current E2E Test Games
- **Game #164** (COMMON_ROOM_TEST) - ✅ Already exists
  - Active common_room phase (is_published = true)
  - 3 characters (GM + 2 players)
  - **Infrastructure only** - no posts
  - Used by: character-mentions, autocomplete, notification UI tests

#### Manual Testing Games (From Existing Fixtures)
- **Game #2** ("The Heist at Goldstone Bank")
  - Active game with action phase
  - Has draft and submitted actions
  - Multiple characters with abilities
  - Good for testing action submission flow

- **Game #4** ("Court of Shadows")
  - Active game with phase history
  - Has action submissions
  - Good for testing phase transitions

- **Game #1** ("Westmarch Adventure")
  - Recruiting game
  - Good for testing applications flow

#### Games That Need Demo Content (Via `08_demo_content.sql`)
- **Game #2** - Add sample Common Room posts
  - Posts with character mentions
  - Comments with markdown
  - Threaded conversations

- **Game #4** - Add rich action results
  - Complex markdown formatting
  - Character mentions in results
  - Multiple result types

### Data Quality

#### Validation
- [ ] All foreign keys valid
- [ ] Timestamps in logical order
- [ ] No orphaned records
- [ ] All created_at dates realistic
- [ ] JSON fields properly formatted

#### Realism
- [ ] Use realistic game content
- [ ] Varied writing styles
- [ ] Logical conversation threads
- [ ] Appropriate markdown usage
- [ ] Believable character interactions

### Scripts

#### Fixture Management
- [ ] Update `apply_all.sh` to include new fixtures
- [ ] Create `reset_demo_data.sh` for quick refresh
- [ ] Add fixture validation script
- [ ] Document fixture dependencies

### Documentation
- [x] ✅ Updated `.claude/planning/completed/AI_E2E_TESTING_STRATEGY.md` with fixture learnings
- [ ] Update `.claude/context/TEST_DATA.md` when `08_demo_content.sql` is created
- [ ] Document test scenarios in `/docs/testing/TEST_DATA.md`
- [ ] Add fixture usage examples for new developers
- [ ] Create "Test User Guide" for manual testing

### Progress Summary (2025-10-18)

#### Completed Today
1. ✅ Fixed `07_common_room.sql` - Set `is_published = true` on phase
2. ✅ Added GM post to fixture (lines 76-86) - **Note: Should be removed per new strategy**
3. ✅ Fixed 3 failing E2E tests (avatar, autocomplete, notification)
4. ✅ Documented fixture strategy in `AI_E2E_TESTING_STRATEGY.md`
5. ✅ Revised this plan based on learnings

#### Key Learnings
- **Fixtures ARE reliable** - issue was config bug (is_published = false)
- **Separate concerns**: E2E fixtures (infrastructure) vs Demo fixtures (sample content)
- **Dynamic creation best** for test-specific content (posts, messages)
- **Multi-context pattern** works well for user interaction tests
- **Test UI, not backend** - avoid timing-dependent backend behaviors in E2E

#### Next Priority
1. **Create `08_demo_content.sql`** for manual testing
   - Rich posts with markdown and mentions
   - Sample conversations
   - Edge cases for visual verification
2. **Clean up `07_common_room.sql`** - remove GM post (optional)

---

## Cross-Initiative Dependencies

- ✅ Avatar implementation complete (avatar_url columns exist, can be used in Demo Data)
- UI/UX improvements can proceed in parallel with other initiatives
- Major refactor should wait for stable test suite (Demo Data Refresh optional, current fixtures sufficient for E2E)

## Status Summary (Last Updated: 2025-10-19)

### Completed
1. ✅ **Avatar Implementation** - Fully functional with uploads, storage, and display
2. ✅ **E2E Test Infrastructure** - Common Room fixture, 3 passing tests, documented strategy
3. ✅ **Backend Service Decomposition** - Weeks 1-3 complete
   - Phase service: 1056 lines → 10 files
   - Message service: 699 lines → 5 files
   - Action service: Extracted to separate package
   - All remaining services < 500 lines

### In Progress
1. 🔄 **Major Refactoring Initiative - Week 4** - Documentation & Polish
   - See `.claude/planning/WEEK_4_DOCUMENTATION_PLAN.md`
   - Session files deleted (docs/ reduced to 20 files)
   - Documentation verification in progress
2. 🔄 **Demo/Test Data Refresh** - E2E fixtures complete, manual testing fixtures optional

### Not Started
1. ⏸️ **UI/UX Improvements** - Can start anytime, incremental approach

## Notes

- All initiatives should include comprehensive tests
- Follow TDD where possible
- Update documentation as you go
- Consider user impact before breaking changes
- Keep `.claude/context/` files updated with new patterns
