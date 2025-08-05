# ActionPhase MVP Development Plan

## Development Phases Overview

**Phase 1**: Foundation (2-3 weeks)
**Phase 2**: Core Game Features (3-4 weeks)
**Phase 3**: Communication & Polish (2-3 weeks)

---

## Phase 1: Foundation (Weeks 1-3)

### 1.1 Development Environment Setup
**Estimated Time**: 2-3 days

**Backend Tasks:**
- [ ] Set up Go project structure with proper modules
- [ ] Configure PostgreSQL database connection
- [ ] Set up MongoDB/document storage for rich content
- [ ] Implement database migration system
- [ ] Set up JWT authentication middleware
- [ ] Create basic API routing structure
- [ ] Configure CORS for frontend integration

**Frontend Tasks:**
- [ ] Enhance current React/TypeScript setup
- [ ] Configure rich text editor (TipTap or similar)
- [ ] Set up routing structure for all main pages
- [ ] Implement theme system (dark/light mode)
- [ ] Create basic component library and design system

**DevOps Tasks:**
- [ ] Set up local development docker-compose
- [ ] Configure database backup scripts
- [ ] Set up linting and code formatting

### 1.2 Database Schema Design
**Estimated Time**: 3-4 days

**Core Tables:**
```sql
-- Users table (extend existing)
users: id, username, email, password_hash, created_at, updated_at, is_admin

-- Games table
games: id, title, description, gm_user_id, state, genre, start_date, end_date,
       recruitment_deadline, max_players, is_public, created_at, updated_at

-- Game participants (players, co-GMs, audience)
game_participants: id, game_id, user_id, role, status, joined_at

-- Characters table
characters: id, game_id, user_id, name, character_type, status, created_at, updated_at
-- character_type: 'player_character', 'npc_gm', 'npc_audience'

-- Character data (modular system)
character_data: id, character_id, module_type, field_name, field_value,
                field_type, is_public, created_at, updated_at

-- Action submissions (private until game completion)
action_submissions: id, game_id, user_id, phase_id, content, submitted_at

-- Action results (private GM -> player messages)
action_results: id, game_id, user_id, phase_id, content, sent_at

-- NPC assignments
npc_assignments: id, character_id, assigned_user_id, assigned_by_user_id, assigned_at

-- Notifications
notifications: id, user_id, game_id, type, content, is_read, created_at

-- Message participants (for private messages including NPCs)
message_participants: id, conversation_id, user_id, character_id, joined_at
```

**Document Storage Schema:**
```javascript
// Rich text content (MongoDB)
{
  _id: ObjectId,
  content_type: "character_bio|game_description|thread_post|action_submission",
  entity_id: string, // references SQL table
  content: {}, // rich text JSON
  created_at: Date,
  updated_at: Date
}
```

**Tasks:**
- [ ] Create database migration files
- [ ] Implement SQLC queries for all basic operations
- [ ] Set up document storage connection and basic operations
- [ ] Create database seeding scripts for development

### 1.3 Core Authentication & User Management
**Estimated Time**: 3-4 days

**Backend API Endpoints:**
- [ ] `POST /api/v1/auth/register` - Enhanced with profile fields
- [ ] `POST /api/v1/auth/login` - Already implemented
- [ ] `GET /api/v1/auth/refresh` - Already implemented
- [ ] `GET /api/v1/auth/profile` - Get current user profile
- [ ] `PUT /api/v1/auth/profile` - Update profile
- [ ] `POST /api/v1/auth/logout` - Token invalidation

**Frontend Components:**
- [ ] Enhanced registration form with additional fields
- [ ] User profile page and edit functionality
- [ ] Password change functionality
- [ ] Account settings page

**User Profile Fields:**
- [ ] Display name, bio, timezone preferences
- [ ] Email notification preferences
- [ ] Accessibility preferences (high contrast, font size)

---

## Phase 2: Core Game Features (Weeks 4-7)

### 2.1 Game Lifecycle Management
**Estimated Time**: 5-6 days

**Backend API Endpoints:**
```
POST   /api/v1/games                    # Create game
GET    /api/v1/games                    # List games (with filters)
GET    /api/v1/games/:id                # Get game details
PUT    /api/v1/games/:id                # Update game (GM only)
DELETE /api/v1/games/:id                # Cancel game (GM/Admin only)

POST   /api/v1/games/:id/participants   # Join game / invite users
DELETE /api/v1/games/:id/participants/:user_id # Remove participant

PUT    /api/v1/games/:id/state          # Change game state
```

**Game States Implementation:**
- [ ] Setup → Recruitment transition logic
- [ ] Recruitment → Character Creation (close applications)
- [ ] Character Creation → In Progress (all characters approved)
- [ ] In Progress → Paused/Completed/Cancelled

**Frontend Pages:**
- [ ] Game creation wizard (setup phase)
- [ ] Game details/management page (GM view)
- [ ] Game browser with filtering
- [ ] Join game functionality
- [ ] Game settings management

### 2.2 Character Sheet System
**Estimated Time**: 6-7 days

**Backend Character Management:**
```
POST   /api/v1/games/:id/characters     # Create character
GET    /api/v1/games/:id/characters     # List game characters
GET    /api/v1/characters/:id           # Get character details
PUT    /api/v1/characters/:id           # Update character
DELETE /api/v1/characters/:id           # Delete character

POST   /api/v1/characters/:id/approve   # GM approve character
POST   /api/v1/characters/:id/modules   # Enable/configure modules
```

**MVP Character Modules:**
- [ ] **Bio/Background Module**: Rich text character description
- [ ] **Notes Module**: Private player notes (rich text)
- [ ] **Abilities Module**: List of character abilities/skills
- [ ] **Inventory Module**: Items and equipment tracking

**NPC System:**
- [ ] NPC creation (GM only)
- [ ] NPC assignment to audience members
- [ ] NPC permissions and access controls
- [ ] NPC participation in private messages and group chats
- [ ] GM notification system for all NPC communications
- [ ] Character type distinction in UI

**Frontend Character Components:**
- [ ] Character creation wizard (PC and NPC)
- [ ] Modular character sheet display
- [ ] Character edit forms (different permissions for player vs GM vs NPC controller)
- [ ] Character approval workflow (GM interface)
- [ ] Character module configuration (GM setup)
- [ ] NPC assignment interface

**Character Data Architecture:**
- [ ] Flexible module system that can be extended
- [ ] Permission system (public/private/GM-only fields)
- [ ] Rich text integration for bio and notes

### 2.3 Game Phase Management
**Estimated Time**: 4-5 days

**Phase System Backend:**
```
GET    /api/v1/games/:id/current-phase  # Get current phase info
POST   /api/v1/games/:id/phases         # Create new phase
PUT    /api/v1/games/:id/phases/:id     # Update phase (extend time, etc.)

POST   /api/v1/games/:id/actions        # Submit action (action phase)
GET    /api/v1/games/:id/actions        # Get actions (GM only)
POST   /api/v1/games/:id/results        # Publish results (GM only)
```

**Frontend Phase Components:**
- [ ] Phase countdown timers
- [ ] Current phase display and status
- [ ] Phase transition controls (GM)
- [ ] Custom countdown creation (GM)

**Phase Types:**
- [ ] Common Room Phase: Enable threaded discussions
- [ ] Action Phase: Enable action submissions, disable common room
- [ ] Results Phase: Display GM results, prepare for next common room

---

## Phase 3: Communication & Polish (Weeks 8-10)

### 3.1 Communication Systems
**Estimated Time**: 6-7 days

**Threaded Discussions (Common Room):**
```
POST   /api/v1/games/:id/threads        # Create thread (GM only for MVP)
GET    /api/v1/games/:id/threads        # List threads
POST   /api/v1/games/:id/threads/:id/posts # Create post/reply
GET    /api/v1/games/:id/threads/:id/posts # Get thread posts
PUT    /api/v1/posts/:id                # Edit post
DELETE /api/v1/posts/:id               # Delete post
```

**Private Messaging (including NPC participation):**
```
POST   /api/v1/games/:id/messages       # Send private message (player/NPC/GM)
GET    /api/v1/games/:id/conversations  # List conversations
GET    /api/v1/games/:id/conversations/:id # Get conversation messages

POST   /api/v1/games/:id/group-chats    # Create group chat (any participant)
POST   /api/v1/group-chats/:id/invite   # Invite player/NPC to group chat
POST   /api/v1/group-chats/:id/messages # Send group message
POST   /api/v1/group-chats/:id/add-npc  # Add NPC to group chat
```

**Action Submissions & Results:**
```
POST   /api/v1/games/:id/actions        # Submit action
GET    /api/v1/games/:id/actions/mine   # Get my submitted actions (only)
PUT    /api/v1/games/:id/actions/:id    # Edit action (before deadline)

GET    /api/v1/games/:id/actions        # Get all actions (GM only)
POST   /api/v1/games/:id/results        # Send private result to player
GET    /api/v1/games/:id/results/mine   # Get my private results

# These become public only when game is completed:
GET    /api/v1/games/:id/actions/archive # All actions (completed games only)
GET    /api/v1/games/:id/results/archive # All results (completed games only)
```

**Frontend Communication:**
- [ ] Reddit-style threaded comment system (NPCs can participate)
- [ ] Rich text editor with character ability/item linking
- [ ] Private message interface (1-on-1 and group, including NPCs)
- [ ] NPC participation UI (clear indication when NPCs are involved)
- [ ] Action submission form with rich text
- [ ] Message/thread read/unread tracking
- [ ] GM notification center for NPC activity monitoring

### 3.2 Dashboards & Navigation
**Estimated Time**: 4-5 days

**Global Dashboard:**
- [ ] Active games (as player, GM, audience)
- [ ] Recent notifications
- [ ] Games in recruitment
- [ ] Quick stats

**Game-Specific Dashboard:**
- [ ] Current phase status and countdown
- [ ] Recent activity feed
- [ ] Quick access to characters, messages, threads
- [ ] Action submission status

**Navigation & UX:**
- [ ] Responsive navigation system
- [ ] Breadcrumb navigation within games
- [ ] Quick-switch between games
- [ ] Search functionality

### 3.3 Notifications & Polish
**Estimated Time**: 3-4 days

**Notification System:**
```
POST   /api/v1/notifications           # Create notification
GET    /api/v1/notifications           # Get user notifications
PUT    /api/v1/notifications/:id/read  # Mark as read
PUT    /api/v1/notifications/read-all  # Mark all as read
```

**Notification Types:**
- [ ] Phase transitions
- [ ] New messages (including NPC communications for GMs)
- [ ] Game invitations
- [ ] Character approval/rejection
- [ ] Action deadlines
- [ ] NPC activity alerts (GM only)
- [ ] Thread replies involving NPCs (GM notifications)

**UI Polish:**
- [ ] Loading states and skeleton screens
- [ ] Error handling and user feedback
- [ ] Form validation and helpful error messages
- [ ] Accessibility improvements (ARIA labels, keyboard navigation)
- [ ] Mobile-responsive breakpoints (basic support)

---

## Testing & Quality Assurance

### Throughout Development:
- [ ] Write unit tests for critical backend functions
- [ ] Integration tests for API endpoints
- [ ] Frontend component testing
- [ ] End-to-end testing for critical user flows

### Before MVP Release:
- [ ] Full game lifecycle testing (Setup → Completed)
- [ ] Multi-user testing with different roles
- [ ] Performance testing with realistic data volumes
- [ ] Security testing (authentication, authorization)
- [ ] Accessibility testing

---

## Deployment Preparation

### Infrastructure Setup:
- [ ] Production database setup with backups
- [ ] Document storage configuration
- [ ] File upload/attachment storage (S3-compatible)
- [ ] SSL certificates and domain configuration
- [ ] Monitoring and logging setup

### Launch Preparation:
- [ ] Data migration scripts (if needed)
- [ ] Admin user creation
- [ ] Basic community guidelines page
- [ ] Error monitoring and alerting
- [ ] Backup verification and recovery testing

---

## Success Criteria for MVP

**Technical:**
- [ ] Complete game can be run from setup to completion
- [ ] All user roles function correctly
- [ ] Data integrity maintained throughout game lifecycle
- [ ] 99%+ uptime during active games

**User Experience:**
- [ ] New users can successfully join and participate in a game
- [ ] GMs can effectively manage games and process actions
- [ ] Communication flows work smoothly
- [ ] Interface is intuitive without extensive documentation

**Performance:**
- [ ] Page loads under 2 seconds
- [ ] Rich text editor responsive and reliable
- [ ] Real-time features (notifications, timers) work consistently

This plan provides approximately 8-10 weeks of development work for a solo developer, or 4-6 weeks with a small team.
