# Development Initiatives Tracker

This document tracks major development initiatives for ActionPhase. Each initiative includes a status, priority, and detailed implementation plan.

**Last Updated**: 2025-10-18

---

## Status Legend
- **Not Started** - Planning complete, implementation not begun
- **In Progress** - Actively being developed
- **Blocked** - Waiting on dependencies or decisions
- **Completed** - Implementation finished and tested

---

## 1. Avatar Implementation

**Status**: Not Started
**Priority**: High
**Estimated Effort**: 2-3 days

### Overview
Add user and character avatar support throughout the application, including upload functionality, storage, and display in all relevant UI components.

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

## 2. Major Refactor Using Opus

**Status**: Not Started
**Priority**: Medium
**Estimated Effort**: 1-2 weeks

### Overview
Use Claude Opus for complex architectural decisions and refactoring of critical backend services. Focus on areas with high complexity or technical debt.

### Phase 1: Identify Refactor Candidates

#### Analysis Tasks
- [ ] Review test coverage report for low-coverage areas
- [ ] Analyze service complexity (lines of code, cyclomatic complexity)
- [ ] Identify duplicate code patterns
- [ ] Review ADR compliance across codebase
- [ ] Collect developer pain points (from commit messages, TODO comments)

#### Priority Targets
1. **Phase Management Service** (`backend/pkg/db/services/phases.go`)
   - Complex state machine logic
   - Multiple transition paths
   - Validation rules spread across service
   - Consider extracting state machine to separate package

2. **Action Submission Flow** (`backend/pkg/db/services/actions.go`)
   - Draft vs final submission logic
   - Phase validation intertwined
   - Result generation mixed with storage
   - Consider splitting into ActionDraftService + ActionSubmissionService

3. **Character Service** (`backend/pkg/db/services/characters.go`)
   - NPC assignment logic
   - Permission checks scattered
   - Consider CharacterPermissionService

4. **Notification Service** (`backend/pkg/db/services/notifications.go`)
   - Multiple notification types
   - Template logic inline
   - Consider NotificationTemplateService

### Phase 2: Refactor Execution

#### For Each Target Service
- [ ] Create detailed refactor plan with Opus
  - Current architecture analysis
  - Proposed new structure
  - Migration strategy (incremental vs big bang)
  - Risk assessment
- [ ] Write new tests for desired behavior
- [ ] Implement refactor incrementally
- [ ] Ensure all tests pass
- [ ] Update documentation
- [ ] Code review before merge

#### Architectural Improvements to Consider
- [ ] Extract validation logic to separate validators
- [ ] Implement command pattern for complex operations
- [ ] Add domain events for cross-service communication
- [ ] Create specification pattern for complex queries
- [ ] Implement repository pattern more consistently

### Phase 3: Frontend Refactors

#### Potential Targets
- [ ] Form handling patterns (consider react-hook-form)
- [ ] Error boundary implementation
- [ ] Loading state management
- [ ] Modal management (global modal context?)
- [ ] Optimistic updates pattern consistency

### Documentation
- [ ] Update ADRs with refactor decisions
- [ ] Document new patterns in `.claude/context/ARCHITECTURE.md`
- [ ] Create refactor retrospective doc

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

**Status**: Not Started
**Priority**: High (blocks testing of new features)
**Estimated Effort**: 2-3 days

### Overview
Update test fixtures to include all new features implemented since initial fixture creation. Ensure comprehensive test data for manual testing and E2E tests.

### New Fixtures Needed

#### Character Mentions
- [ ] `07_character_mentions.sql`
  - Update existing messages/posts to use @mentions
  - Add posts with multiple mentions
  - Add posts with mentions of characters from different games
  - Add edge cases (mention at start, end, middle)
  - Update `messages.mentioned_character_ids` arrays

#### Notifications
- [ ] `08_notifications.sql`
  - Create notifications for each type:
    - Private message received
    - Phase transition
    - Action result posted
    - Character mentioned in post
    - Game invitation
  - Mix of read and unread notifications
  - Multiple notifications for same user
  - Notifications spanning different games

#### Private Messages
- [ ] `09_private_messages.sql`
  - Update existing private messages to include:
    - Character mentions in messages
    - Rich markdown formatting
    - Longer conversation threads
  - Add group conversations (multiple participants)
  - Add messages from different time periods

#### Rich Content Posts
- [ ] `10_rich_content_posts.sql`
  - Posts with complex markdown:
    - Headers, lists, blockquotes
    - Code blocks
    - Links
    - Character mentions
  - Long-form posts (multiple paragraphs)
  - Posts with comments that also use mentions

#### Action Submissions
- [ ] Update `05_actions.sql`
  - Add draft actions (not yet finalized)
  - Add actions in different phases
  - Add complex action content (markdown, mentions)
  - Add action results with rich formatting
  - Add actions for all character types (PC, NPC)

#### Phase History
- [ ] Update `04_phases.sql`
  - Add more phase transitions for Game #2
  - Add phases with different durations
  - Add phases in various statuses
  - Ensure proper progression through phase sequence

### Fixture Updates

#### Existing Files to Update
- [ ] `01_users.sql` - Add avatar_url once implemented
- [ ] `02_games.sql` - Add more game variety, different statuses
- [ ] `03_characters.sql` - Add avatar_url once implemented
- [ ] `06_posts.sql` - Update to use character mentions

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

#### Game Scenarios
- **Game #2** (Active Game)
  - Current phase with pending actions
  - Rich post history with mentions
  - Active private message threads
  - Mix of draft and submitted actions

- **Game #6** (Pagination Test)
  - 50+ posts for pagination testing
  - Multiple pages of comments
  - Extensive phase history
  - Large character roster

- **Game #7** (Recruiting)
  - Open for applications
  - Some pending applications
  - Minimal content (just starting)

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
- [ ] Update `.claude/context/TEST_DATA.md` with new fixtures
- [ ] Document test scenarios in `/docs/testing/TEST_DATA.md`
- [ ] Add fixture usage examples
- [ ] Create "Test User Guide" for manual testing

---

## Cross-Initiative Dependencies

- Avatar implementation should complete before Demo Data Refresh (need avatar_url columns)
- UI/UX improvements can proceed in parallel with other initiatives
- Major refactor should wait for stable test suite (after Demo Data Refresh)

## Notes

- All initiatives should include comprehensive tests
- Follow TDD where possible
- Update documentation as you go
- Consider user impact before breaking changes
- Keep `.claude/context/` files updated with new patterns
