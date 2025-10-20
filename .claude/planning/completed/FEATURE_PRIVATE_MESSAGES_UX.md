# Feature Plan: Private Messages UX Improvements

**Created**: 2025-10-19
**Status**: Planning
**Priority**: P2 (Medium Priority - Nice to Have)
**Effort Estimate**: 4-5 days
**Sprint**: Sprint 3 (Week 2-3)
**Owner**: Development Team
**Related Plans**: `FEATURE_COMMON_ROOM_UX.md`, `FEATURE_NOTIFICATIONS_UX.md`

---

## 1. Overview

### 1.1 Problem Statement

**Current Pain Points:**
- **Limited Screen Real Estate**: Fixed 320px sidebar takes significant horizontal space on laptop screens (1366px width)
- **No Unread Tracking**: Scrolls to bottom instead of first unread message when returning to conversation
- **Poor Mobile UX**: Sidebar + thread side-by-side doesn't work well on mobile
- **No Sidebar Flexibility**: Cannot collapse sidebar to focus on conversation
- **No Unread Indicators**: Cannot see which conversations have unread messages or where unread messages start
- **No "Last Read" Tracking**: System doesn't remember where user left off in each conversation

**User Impact:**
- **Cramped Experience**: Especially on 13-14" laptops with 1366x768 or 1440x900 resolution
- **Missed Messages**: Must scroll through entire conversation to find new messages
- **Mobile Frustration**: Hard to navigate between conversation list and thread
- **Context Loss**: Cannot see enough message history without scrolling
- **Inefficiency**: Extra scrolling and navigation to find relevant content

**Business Impact:**
- Lower private message engagement
- Slower response times due to poor navigation
- Mobile users avoiding private messages
- Reduced roleplay depth due to communication friction

### 1.2 Goals and Success Criteria

**Primary Goals:**
1. Make sidebar collapsible to reclaim screen space
2. Implement unread message tracking and auto-scroll to first unread
3. Improve mobile layout (full-screen thread with navigation)
4. Add unread count badges to conversation list
5. Show "New messages" divider like common room
6. Make sidebar width adjustable (bonus feature)

**Success Metrics:**
- **Engagement Increase**: Private message response time reduced by 15%
- **Mobile Usage**: Private messages on mobile increase by 25%
- **User Satisfaction**: "Private messages" rating >4/5 in surveys
- **Screen Efficiency**: >90% of users collapse sidebar at least once
- **Unread Discovery**: Users view >95% of new messages (vs current ~80%)

**Out of Scope (Future Enhancements):**
- Real-time message delivery (WebSockets) - P3
- Message reactions/emojis - P3
- Message search within conversation - P3
- Threaded replies in private messages - P4
- Voice/video integration - P5

### 1.3 User Stories

**Epic**: As a user, I want a comfortable private messaging experience that adapts to my device and helps me find new messages quickly.

**User Stories:**

1. **Collapsible Sidebar**
   *As a user*, I want to collapse the conversation list sidebar to maximize space for messages.
   **Acceptance Criteria:**
   - Toggle button to collapse/expand sidebar
   - Collapsed sidebar shows icons only (mini version)
   - State persists across page refreshes
   - Smooth animation when toggling

2. **Scroll to Unread Messages**
   *As a user returning to a conversation*, I want to automatically scroll to the first unread message.
   **Acceptance Criteria:**
   - System tracks last-read message per conversation
   - Auto-scrolls to first unread on conversation open
   - "New messages" divider line appears before first unread
   - "Jump to latest" button if scrolled up

3. **Unread Count Badges**
   *As a user*, I want to see which conversations have unread messages and how many.
   **Acceptance Criteria:**
   - Unread count badge on each conversation in list
   - Total unread count in tab badge (future integration)
   - Conversations with unread sorted to top
   - Badge disappears when all read

4. **Mobile-Optimized Layout**
   *As a mobile user*, I want a full-screen message view with easy navigation.
   **Acceptance Criteria:**
   - On mobile (<768px), conversation list is full screen
   - Selecting conversation switches to full-screen thread view
   - Back button returns to conversation list
   - Smooth transitions between views

5. **Adjustable Sidebar Width** (Bonus)
   *As a user*, I want to resize the sidebar to my preference.
   **Acceptance Criteria:**
   - Drag handle to resize sidebar (200px - 500px range)
   - Width preference persists across sessions
   - Smooth resize experience
   - Double-click resize handle to reset to default

---

## 2. Technical Design

### 2.1 Database Schema Changes

**New Table**: `conversation_reads`

```sql
-- Migration: XXX_create_conversation_reads.up.sql

CREATE TABLE IF NOT EXISTS conversation_reads (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  last_read_message_id INTEGER REFERENCES private_messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure one read marker per user per conversation
  UNIQUE(user_id, conversation_id)
);

-- Indexes
CREATE INDEX idx_conversation_reads_user_conversation
ON conversation_reads(user_id, conversation_id);

CREATE INDEX idx_conversation_reads_conversation
ON conversation_reads(conversation_id);

COMMENT ON TABLE conversation_reads IS 'Tracks which messages users have read in each conversation';
```

```sql
-- Migration: XXX_create_conversation_reads.down.sql

DROP TABLE IF EXISTS conversation_reads;
```

### 2.2 Backend Implementation

#### 2.2.1 SQL Queries

**File**: `backend/pkg/db/queries/conversation_reads.sql`

```sql
-- name: GetUserConversationRead :one
SELECT *
FROM conversation_reads
WHERE user_id = $1 AND conversation_id = $2;

-- name: UpsertConversationRead :one
INSERT INTO conversation_reads (user_id, conversation_id, last_read_message_id, last_read_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (user_id, conversation_id)
DO UPDATE SET
  last_read_message_id = EXCLUDED.last_read_message_id,
  last_read_at = NOW(),
  updated_at = NOW()
RETURNING *;

-- name: GetConversationUnreadCount :one
-- Count unread messages in a conversation for a user
SELECT COUNT(*) as unread_count
FROM private_messages pm
WHERE
  pm.conversation_id = $1
  AND pm.created_at > COALESCE(
    (SELECT last_read_at FROM conversation_reads WHERE user_id = $2 AND conversation_id = $1),
    '1970-01-01'::timestamptz
  );

-- name: GetUserConversationsWithUnreadCounts :many
-- Get all conversations for a user with unread counts
SELECT
  c.*,
  COALESCE(
    (SELECT COUNT(*)
     FROM private_messages pm
     WHERE pm.conversation_id = c.id
       AND pm.created_at > COALESCE(cr.last_read_at, '1970-01-01'::timestamptz)
    ), 0
  ) as unread_count,
  cr.last_read_message_id,
  cr.last_read_at
FROM conversations c
LEFT JOIN conversation_reads cr ON c.id = cr.conversation_id AND cr.user_id = $1
WHERE c.game_id = $2
  AND EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = c.id
      AND (cp.user_id = $1 OR cp.character_id IN (
        SELECT id FROM characters WHERE user_id = $1
      ))
  )
ORDER BY
  unread_count DESC NULLS LAST,  -- Unread conversations first
  c.updated_at DESC;
```

### 2.3 Frontend Implementation

#### 2.3.1 Local Storage State

**File**: `frontend/src/hooks/usePrivateMessagesLayout.ts` (new)

```typescript
import { useState, useEffect } from 'react';

interface LayoutState {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
}

export function usePrivateMessagesLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default 320px

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pm_layout');
    if (saved) {
      try {
        const parsed: LayoutState = JSON.parse(saved);
        setSidebarCollapsed(parsed.sidebarCollapsed || false);
        setSidebarWidth(parsed.sidebarWidth || 320);
      } catch (e) {
        console.error('Failed to parse saved layout:', e);
      }
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    const state: LayoutState = { sidebarCollapsed, sidebarWidth };
    localStorage.setItem('pm_layout', JSON.stringify(state));
  }, [sidebarCollapsed, sidebarWidth]);

  const toggleSidebar = () => setSidebarCollapsed(prev => !prev);

  const setSidebarWidthWithBounds = (width: number) => {
    // Clamp between 200px and 500px
    const bounded = Math.max(200, Math.min(500, width));
    setSidebarWidth(bounded);
  };

  return {
    sidebarCollapsed,
    sidebarWidth,
    toggleSidebar,
    setSidebarWidth: setSidebarWidthWithBounds,
  };
}
```

#### 2.3.2 Hooks for Read Tracking

**File**: `frontend/src/hooks/useConversationReads.ts` (new)

```typescript
import { useEffect, useRef } from 'react';
import { apiClient } from '../lib/api';

export function useConversationReads(
  gameId: number,
  conversationId: number,
  enabled: boolean = true
) {
  const lastReadMessageIdRef = useRef<number | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const markMessageRead = (messageId: number) => {
    if (!enabled) return;

    lastReadMessageIdRef.current = messageId;

    // Debounce updates - only send after 2 seconds of no new reads
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      if (lastReadMessageIdRef.current !== null) {
        apiClient.conversations.markConversationRead(gameId, conversationId, {
          last_read_message_id: lastReadMessageIdRef.current,
        });
      }
    }, 2000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return { markMessageRead };
}
```

#### 2.3.3 Enhanced PrivateMessages Component

**File**: `frontend/src/components/PrivateMessages.tsx` (updates)

```typescript
import { useState, useEffect } from 'react';
import { ConversationList } from './ConversationList';
import { MessageThread } from './MessageThread';
import { NewConversationModal } from './NewConversationModal';
import { usePrivateMessagesLayout } from '../hooks/usePrivateMessagesLayout';
import type { Character } from '../types/characters';

interface PrivateMessagesProps {
  gameId: number;
  characters: Character[];
  isAnonymous: boolean;
}

export function PrivateMessages({ gameId, characters, isAnonymous }: PrivateMessagesProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    sidebarCollapsed,
    sidebarWidth,
    toggleSidebar,
    setSidebarWidth,
  } = usePrivateMessagesLayout();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleConversationCreated = (conversationId: number) => {
    setRefreshKey(prev => prev + 1);
    setSelectedConversationId(conversationId);
  };

  const handleSelectConversation = (conversationId: number) => {
    setSelectedConversationId(conversationId);
  };

  const handleBackToList = () => {
    setSelectedConversationId(null);
  };

  // Mobile view: show either list or thread
  if (isMobile) {
    return (
      <div className="h-full">
        {!selectedConversationId ? (
          /* Conversation List (full screen on mobile) */
          <div className="h-full flex flex-col bg-white">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-900">Private Messages</h2>
                <button
                  onClick={() => setShowNewConversationModal(true)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md"
                >
                  + New
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <ConversationList
                key={refreshKey}
                gameId={gameId}
                onSelectConversation={handleSelectConversation}
                selectedConversationId={selectedConversationId || undefined}
              />
            </div>
          </div>
        ) : (
          /* Message Thread (full screen on mobile) */
          <div className="h-full flex flex-col bg-white">
            {/* Back button */}
            <div className="p-3 border-b border-gray-200 bg-white sticky top-0 z-10">
              <button
                onClick={handleBackToList}
                className="flex items-center text-blue-600 hover:text-blue-700 font-medium"
              >
                <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to conversations
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <MessageThread
                gameId={gameId}
                conversationId={selectedConversationId}
                characters={characters}
              />
            </div>
          </div>
        )}

        {showNewConversationModal && (
          <NewConversationModal
            gameId={gameId}
            characters={characters}
            isAnonymous={isAnonymous}
            onClose={() => setShowNewConversationModal(false)}
            onConversationCreated={handleConversationCreated}
          />
        )}
      </div>
    );
  }

  // Desktop view: sidebar + thread
  return (
    <div className="h-full flex">
      {/* Conversation List Sidebar */}
      <div
        className={`
          border-r border-gray-200 bg-white flex flex-col transition-all duration-300
          ${sidebarCollapsed ? 'w-16' : ''}
        `}
        style={!sidebarCollapsed ? { width: `${sidebarWidth}px` } : undefined}
      >
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          {!sidebarCollapsed && (
            <>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Messages</h2>
                <p className="text-xs text-gray-600">Private conversations</p>
              </div>
              <button
                onClick={() => setShowNewConversationModal(true)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                title="New Conversation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </>
          )}

          {/* Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={sidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"}
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ConversationList
            key={refreshKey}
            gameId={gameId}
            onSelectConversation={handleSelectConversation}
            selectedConversationId={selectedConversationId || undefined}
            collapsed={sidebarCollapsed}
          />
        </div>
      </div>

      {/* Message Thread */}
      <div className="flex-1 bg-white">
        {selectedConversationId ? (
          <MessageThread
            gameId={gameId}
            conversationId={selectedConversationId}
            characters={characters}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg mb-2">No conversation selected</p>
              <p className="text-sm">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>

      {showNewConversationModal && (
        <NewConversationModal
          gameId={gameId}
          characters={characters}
          isAnonymous={isAnonymous}
          onClose={() => setShowNewConversationModal(false)}
          onConversationCreated={handleConversationCreated}
        />
      )}
    </div>
  );
}
```

#### 2.3.4 Enhanced MessageThread Component

**Key Updates to `MessageThread.tsx`:**
1. Add unread tracking
2. Auto-scroll to first unread instead of bottom
3. Show "New messages" divider
4. Track message visibility for read marking

```typescript
// Add to MessageThread component:

const [firstUnreadId, setFirstUnreadId] = useState<number | null>(null);
const { markMessageRead } = useConversationReads(gameId, conversationId, true);

// After loading messages, determine first unread
useEffect(() => {
  if (messages.length > 0 && conversation?.last_read_at) {
    const lastReadTime = new Date(conversation.last_read_at);
    const firstUnread = messages.find(m => new Date(m.created_at) > lastReadTime);
    if (firstUnread) {
      setFirstUnreadId(firstUnread.id);
      // Scroll to first unread
      setTimeout(() => {
        const element = document.getElementById(`message-${firstUnread.id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      // All read, scroll to bottom
      scrollToBottom();
    }
  } else {
    scrollToBottom();
  }
}, [messages, conversation]);

// Intersection observer to track visible messages
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const messageId = parseInt(entry.target.getAttribute('data-message-id')!);
          markMessageRead(messageId);
        }
      });
    },
    { threshold: 0.5 }
  );

  document.querySelectorAll('[data-message-id]').forEach(el => {
    observer.observe(el);
  });

  return () => observer.disconnect();
}, [messages]);

// Update message rendering to include unread divider and data attributes
{messages.map((message) => (
  <div key={message.id}>
    {/* Show "New messages" divider before first unread */}
    {firstUnreadId === message.id && (
      <div className="flex items-center gap-2 my-4">
        <div className="flex-1 border-t-2 border-blue-400"></div>
        <span className="text-xs font-semibold text-blue-600 uppercase">New messages</span>
        <div className="flex-1 border-t-2 border-blue-400"></div>
      </div>
    )}

    <div
      id={`message-${message.id}`}
      data-message-id={message.id}
      className="flex flex-col"
    >
      {/* ... existing message content ... */}
    </div>
  </div>
))}
```

---

## 3. Implementation Plan

### 3.1 Phase 1: Backend Read Tracking (Days 1-2)

**Tasks:**
- [ ] Create `conversation_reads` table migration
- [ ] Run migration
- [ ] Write SQL queries for read tracking
- [ ] Generate code: `just sqlgen`
- [ ] Implement backend service methods
- [ ] Update API to include read status
- [ ] Write backend tests

**Acceptance Criteria:**
- ✅ Read tracking persists correctly
- ✅ Unread counts calculated accurately
- ✅ Backend tests passing

### 3.2 Phase 2: Collapsible Sidebar (Day 2)

**Tasks:**
- [ ] Create `usePrivateMessagesLayout` hook
- [ ] Add collapse/expand button
- [ ] Add collapsed state styling
- [ ] Test state persistence
- [ ] Test responsive behavior

**Acceptance Criteria:**
- ✅ Sidebar collapses/expands smoothly
- ✅ State persists across sessions
- ✅ Works on all screen sizes

### 3.3 Phase 3: Mobile Layout (Day 3)

**Tasks:**
- [ ] Detect mobile screen size
- [ ] Implement full-screen list view
- [ ] Implement full-screen thread view
- [ ] Add back button navigation
- [ ] Test on real mobile devices

**Acceptance Criteria:**
- ✅ List and thread switch correctly on mobile
- ✅ Navigation intuitive
- ✅ No layout issues on small screens

### 3.4 Phase 4: Unread Tracking UI (Days 3-4)

**Tasks:**
- [ ] Add unread badges to conversation list
- [ ] Implement "New messages" divider
- [ ] Add auto-scroll to first unread
- [ ] Implement intersection observer for read marking
- [ ] Test read tracking accuracy

**Acceptance Criteria:**
- ✅ Unread badges accurate
- ✅ Divider appears correctly
- ✅ Auto-scroll works reliably
- ✅ Messages marked read when viewed

### 3.5 Phase 5: Polish & Testing (Day 5)

**Tasks:**
- [ ] Complete manual testing
- [ ] Fix bugs
- [ ] Accessibility audit
- [ ] Performance testing
- [ ] Documentation updates

**Acceptance Criteria:**
- ✅ All features work correctly
- ✅ No accessibility issues
- ✅ Performance acceptable
- ✅ Documentation complete

---

## 4. Success Metrics

**Engagement Metrics:**
- **Response Time**: Reduce by 15%
- **Mobile Usage**: Increase by 25%
- **Sidebar Collapse**: >90% usage rate
- **User Satisfaction**: "Private messages" >4/5

---

## 5. Documentation Updates

### 5.1 User Documentation

```markdown
# Private Messages

## Desktop Features

### Collapsible Sidebar
- Click the collapse icon to hide the conversation list
- Reclaim screen space for reading messages
- Your preference is saved automatically

### Finding Unread Messages
- Conversations with unread messages show a blue badge
- Opening a conversation scrolls to first unread message
- "New messages" divider marks where you left off

## Mobile Features

### Navigation
- Tap a conversation to view messages full-screen
- Use "← Back to conversations" to return to list
- Swipe gestures supported (future enhancement)

## Keyboard Shortcuts
- `Ctrl/Cmd + Enter`: Send message
- `Esc`: Collapse sidebar (desktop)
```

---

## 6. Revision History

| Date | Changes | Author |
|------|---------|--------|
| 2025-10-19 | Initial plan created | AI Planning Session |
| | | |
