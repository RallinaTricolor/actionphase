# Feature Plan: Notifications UX Improvements

**Created**: 2025-10-19
**Status**: Planning
**Priority**: P2 (Medium Priority - Nice to Have)
**Effort Estimate**: 2-3 days
**Sprint**: Sprint 3 (Week 1)
**Owner**: Development Team
**Related Plans**: `FEATURE_DASHBOARD_REDESIGN.md`, `FEATURE_DARK_MODE.md`

---

## 1. Overview

### 1.1 Problem Statement

**Current Pain Points:**
- **Dark-on-Dark Styling**: Notification dropdown uses `bg-gray-800` with default text colors, creating readability issues
- **Missing "View All" Page**: "View all notifications" link goes to `/notifications` which doesn't exist (404 error)
- **Limited Pagination**: Dropdown shows only 20 most recent notifications with no way to see older ones
- **Poor Contrast**: Text colors (especially unread notification titles) blend into dark background
- **No Filtering**: Cannot filter by notification type or read/unread status
- **No Bulk Actions**: Must mark notifications as read individually

**User Impact:**
- **Readability Problems**: Hard to read notification text, especially titles
- **Broken Functionality**: Clicking "View all" results in 404 error
- **Missed Notifications**: Older notifications (beyond 20) are inaccessible
- **Frustration**: Cannot efficiently manage notifications
- **Information Loss**: No way to review notification history

**Business Impact:**
- Lower notification engagement (users don't read them)
- Missed important updates (action results, messages, etc.)
- User frustration with non-functional links
- Reduced retention due to poor UX

### 1.2 Goals and Success Criteria

**Primary Goals:**
1. Fix dark-on-dark styling issue for readability
2. Create functional "View All Notifications" page with pagination
3. Add filtering by notification type and read/unread status
4. Improve visual hierarchy and contrast
5. Add bulk mark-as-read functionality
6. Implement notification grouping (future enhancement)

**Success Metrics:**
- **Notification Read Rate**: Increase from ~40% to >60%
- **View All Usage**: >30% of users visit notifications page monthly
- **Styling Complaints**: Zero reports of readability issues
- **Engagement**: Average time on notifications page >30 seconds
- **User Satisfaction**: "Notifications" rating >4/5 in surveys

**Out of Scope (Future Enhancements):**
- Push notifications (browser/mobile) - P3
- Email notification digests - P3
- Notification preferences/settings - P2 (related to FEATURE_DARK_MODE user preferences)
- Real-time notification delivery (WebSockets) - P3
- Notification grouping (e.g., "5 new common room posts") - P3

### 1.3 User Stories

**Epic**: As a user, I want clear, readable notifications that I can review, filter, and manage efficiently.

**User Stories:**

1. **Readable Notification Dropdown**
   *As a user*, I want to easily read notification text in the dropdown.
   **Acceptance Criteria:**
   - Background uses appropriate contrast color
   - Text colors provide >4.5:1 WCAG contrast ratio
   - Unread notifications visually distinct from read
   - Icons clearly visible

2. **View All Notifications Page**
   *As a user*, I want to see all my notifications in one place.
   **Acceptance Criteria:**
   - `/notifications` page exists and loads correctly
   - Shows all notifications with infinite scroll or pagination
   - Same read/unread visual distinction as dropdown
   - Breadcrumb navigation back to previous page

3. **Filter Notifications**
   *As a user*, I want to filter notifications by type and read status.
   **Acceptance Criteria:**
   - Filter by notification type (messages, mentions, actions, etc.)
   - Filter by read/unread status
   - "Show only unread" quick filter
   - Filters work in combination

4. **Mark Multiple as Read**
   *As a user*, I want to mark all or selected notifications as read efficiently.
   **Acceptance Criteria:**
   - "Mark all as read" button (already exists, keep it)
   - "Mark visible as read" option on View All page
   - Confirmation for bulk actions
   - Optimistic UI updates

5. **Delete Notifications**
   *As a user*, I want to delete notifications I no longer need.
   **Acceptance Criteria:**
   - Delete individual notifications (already exists, keep it)
   - "Clear all read notifications" option
   - Confirmation before deleting
   - Soft delete with undo option (future enhancement)

6. **Notification Badges**
   *As a user*, I want accurate unread counts on notification icons.
   **Acceptance Criteria:**
   - Bell icon shows unread count badge
   - Badge updates in real-time when marking as read
   - Badge shows "9+" for 10 or more unread
   - Badge disappears when all read

---

## 2. Technical Design

### 2.1 Database Schema Changes

**No schema changes required** - existing `notifications` table has all needed fields.

**Optional Enhancement** (soft delete):
```sql
-- Add deleted_at column for soft deletes (optional)
ALTER TABLE notifications ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_notifications_deleted_at ON notifications(deleted_at);
```

**Existing Queries Need Pagination** - update to support limit/offset.

### 2.2 Backend Implementation

#### 2.2.1 SQL Queries

**Update existing query** (`backend/pkg/db/queries/notifications.sql`):

```sql
-- name: GetUserNotifications :many
-- Get user's notifications with pagination and filtering
SELECT *
FROM notifications
WHERE
  user_id = $1
  AND ($2::text[] IS NULL OR type = ANY($2::text[]))  -- Filter by types
  AND ($3::boolean IS NULL OR is_read = $3)            -- Filter by read status
  AND deleted_at IS NULL  -- Exclude soft-deleted (if implementing soft delete)
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;

-- name: CountUserNotifications :one
-- Count user's notifications for pagination
SELECT COUNT(*)
FROM notifications
WHERE
  user_id = $1
  AND ($2::text[] IS NULL OR type = ANY($2::text[]))
  AND ($3::boolean IS NULL OR is_read = $3)
  AND deleted_at IS NULL;

-- name: MarkAllNotificationsAsRead :exec
-- Mark all unread notifications as read for a user
UPDATE notifications
SET is_read = true, updated_at = NOW()
WHERE user_id = $1 AND is_read = false AND deleted_at IS NULL;

-- name: DeleteReadNotifications :exec
-- Delete all read notifications for a user
UPDATE notifications
SET deleted_at = NOW(), updated_at = NOW()
WHERE user_id = $1 AND is_read = true AND deleted_at IS NULL;
```

#### 2.2.2 Backend Models

**File**: `backend/pkg/core/models.go` (additions)

```go
// NotificationFilters represents filter criteria for notifications
type NotificationFilters struct {
	Types        []string // Filter by notification types
	IsRead       *bool    // Filter by read status (nil = all)
	Limit        int      // Pagination limit
	Offset       int      // Pagination offset
}

// NotificationListResponse is the full response for listing endpoint
type NotificationListResponse struct {
	Notifications []*Notification `json:"notifications"`
	TotalCount    int             `json:"total_count"`
	UnreadCount   int             `json:"unread_count"`
	HasMore       bool            `json:"has_more"` // More pages available
}
```

#### 2.2.3 Service Layer

**File**: `backend/pkg/db/services/notifications/listing.go` (new file)

```go
package notifications

import (
	"context"
	"database/sql"

	"actionphase/backend/pkg/core"
	"actionphase/backend/pkg/db/sqlc"
)

// GetUserNotifications retrieves notifications with filtering and pagination
func (s *NotificationsService) GetUserNotifications(ctx context.Context, userID int32, filters core.NotificationFilters) (*core.NotificationListResponse, error) {
	log := s.logger.With(
		"method", "GetUserNotifications",
		"user_id", userID,
		"filters", filters,
	)

	log.Info("Fetching user notifications")

	// Convert filters to SQL types
	var typesParam []string
	if len(filters.Types) > 0 {
		typesParam = filters.Types
	}

	var isReadParam sql.NullBool
	if filters.IsRead != nil {
		isReadParam = sql.NullBool{Bool: *filters.IsRead, Valid: true}
	}

	// Set defaults
	limit := filters.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := filters.Offset
	if offset < 0 {
		offset = 0
	}

	// Fetch notifications
	rows, err := s.queries.GetUserNotifications(ctx, sqlc.GetUserNotificationsParams{
		UserID: userID,
		Types:  typesParam,
		IsRead: isReadParam,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		log.Error("Failed to fetch notifications", "error", err)
		return nil, err
	}

	// Get total count
	totalCount, err := s.queries.CountUserNotifications(ctx, sqlc.CountUserNotificationsParams{
		UserID: userID,
		Types:  typesParam,
		IsRead: isReadParam,
	})
	if err != nil {
		log.Warn("Failed to count notifications", "error", err)
		totalCount = int64(len(rows))  // Fallback
	}

	// Get unread count
	falseVal := false
	unreadCount, err := s.queries.CountUserNotifications(ctx, sqlc.CountUserNotificationsParams{
		UserID: userID,
		IsRead: sql.NullBool{Bool: false, Valid: true},
	})
	if err != nil {
		log.Warn("Failed to count unread notifications", "error", err)
		unreadCount = 0
	}

	// Convert to domain models
	notifications := make([]*core.Notification, len(rows))
	for i, row := range rows {
		notifications[i] = s.notificationFromRow(row)
	}

	hasMore := int64(offset+limit) < totalCount

	log.Info("Notifications retrieved", "count", len(notifications), "total", totalCount, "unread", unreadCount)

	return &core.NotificationListResponse{
		Notifications: notifications,
		TotalCount:    int(totalCount),
		UnreadCount:   int(unreadCount),
		HasMore:       hasMore,
	}, nil
}

// DeleteReadNotifications deletes all read notifications for a user
func (s *NotificationsService) DeleteReadNotifications(ctx context.Context, userID int32) error {
	log := s.logger.With("method", "DeleteReadNotifications", "user_id", userID)

	log.Info("Deleting read notifications")

	err := s.queries.DeleteReadNotifications(ctx, userID)
	if err != nil {
		log.Error("Failed to delete read notifications", "error", err)
		return err
	}

	log.Info("Read notifications deleted successfully")
	return nil
}
```

#### 2.2.4 API Handler

**File**: `backend/pkg/notifications/api_listing.go` (new)

```go
package notifications

import (
	"encoding/json"
	"net/http"
	"strconv"

	"actionphase/backend/pkg/core"
	"actionphase/backend/pkg/middleware"
)

// HandleGetNotifications handles GET /api/v1/notifications
func (h *NotificationsHandler) HandleGetNotifications(w http.ResponseWriter, r *http.Request) {
	log := h.logger.With("handler", "HandleGetNotifications")

	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse query parameters
	query := r.URL.Query()

	filters := core.NotificationFilters{
		Limit:  20,  // Default
		Offset: 0,
	}

	// Parse limit
	if limitParam := query.Get("limit"); limitParam != "" {
		if limit, err := strconv.Atoi(limitParam); err == nil {
			filters.Limit = limit
		}
	}

	// Parse offset
	if offsetParam := query.Get("offset"); offsetParam != "" {
		if offset, err := strconv.Atoi(offsetParam); err == nil {
			filters.Offset = offset
		}
	}

	// Parse types filter (comma-separated)
	if typesParam := query.Get("types"); typesParam != "" {
		filters.Types = strings.Split(typesParam, ",")
	}

	// Parse is_read filter
	if isReadParam := query.Get("is_read"); isReadParam != "" {
		if isRead, err := strconv.ParseBool(isReadParam); err == nil {
			filters.IsRead = &isRead
		}
	}

	// Fetch notifications
	result, err := h.notificationsService.GetUserNotifications(r.Context(), *userID, filters)
	if err != nil {
		log.Error("Failed to get notifications", "error", err)
		http.Error(w, "Failed to fetch notifications", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// HandleDeleteReadNotifications handles DELETE /api/v1/notifications/read
func (h *NotificationsHandler) HandleDeleteReadNotifications(w http.ResponseWriter, r *http.Request) {
	log := h.logger.With("handler", "HandleDeleteReadNotifications")

	userID := middleware.GetUserIDFromContext(r.Context())
	if userID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	err := h.notificationsService.DeleteReadNotifications(r.Context(), *userID)
	if err != nil {
		log.Error("Failed to delete read notifications", "error", err)
		http.Error(w, "Failed to delete notifications", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
```

**Update Routing** (`backend/pkg/notifications/api.go`):

```go
func (h *NotificationsHandler) RegisterRoutes(r chi.Router) {
	// ... existing routes ...

	// Enhanced listing with filters
	r.Get("/api/v1/notifications", h.HandleGetNotifications)

	// Bulk actions
	r.Delete("/api/v1/notifications/read", h.HandleDeleteReadNotifications)
}
```

### 2.3 API Specification

#### 2.3.1 Endpoint: Get Notifications (Enhanced)

**Request:**
```
GET /api/v1/notifications?limit=20&offset=0&types=private_message,comment_reply&is_read=false
```

**Query Parameters:**
- `limit` (integer, optional): Number of notifications to return (default: 20, max: 100)
- `offset` (integer, optional): Pagination offset (default: 0)
- `types` (string, optional): Comma-separated notification types to filter
- `is_read` (boolean, optional): Filter by read status (`true`, `false`, or omit for all)

**Authentication**: Required

**Response**: `200 OK`
```json
{
  "notifications": [
    {
      "id": 123,
      "user_id": 42,
      "type": "private_message",
      "title": "New message from Aragorn",
      "content": "Gandalf sent you a message",
      "link_url": "/games/5/messages",
      "is_read": false,
      "created_at": "2025-10-19T14:30:00Z"
    }
  ],
  "total_count": 47,
  "unread_count": 12,
  "has_more": true
}
```

#### 2.3.2 Endpoint: Delete Read Notifications

**Request:**
```
DELETE /api/v1/notifications/read
```

**Authentication**: Required

**Response**: `204 No Content`

### 2.4 Frontend Implementation

#### 2.4.1 Types

**File**: `frontend/src/types/notifications.ts` (additions)

```typescript
export interface NotificationListResponse {
  notifications: Notification[];
  total_count: number;
  unread_count: number;
  has_more: boolean;
}

export interface NotificationFilters {
  limit?: number;
  offset?: number;
  types?: NotificationType[];
  is_read?: boolean;
}

export type NotificationType =
  | 'private_message'
  | 'comment_reply'
  | 'character_mention'
  | 'action_submitted'
  | 'action_result'
  | 'common_room_post'
  | 'phase_created'
  | 'application_approved'
  | 'application_rejected'
  | 'character_approved'
  | 'character_rejected'
  | 'game_state_changed';

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  private_message: 'Messages',
  comment_reply: 'Replies',
  character_mention: 'Mentions',
  action_submitted: 'Actions Submitted',
  action_result: 'Action Results',
  common_room_post: 'Common Room',
  phase_created: 'New Phases',
  application_approved: 'Applications Approved',
  application_rejected: 'Applications Rejected',
  character_approved: 'Characters Approved',
  character_rejected: 'Characters Rejected',
  game_state_changed: 'Game Updates',
};
```

#### 2.4.2 API Client

**File**: `frontend/src/lib/api/notifications.ts` (additions)

```typescript
export class NotificationsApi extends BaseApiClient {
  // ... existing methods ...

  async getNotifications(filters?: NotificationFilters) {
    const params = new URLSearchParams();

    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));
    if (filters?.types && filters.types.length > 0) {
      params.append('types', filters.types.join(','));
    }
    if (filters?.is_read !== undefined) {
      params.append('is_read', String(filters.is_read));
    }

    return this.client.get<NotificationListResponse>(
      `/api/v1/notifications?${params.toString()}`
    );
  }

  async deleteReadNotifications() {
    return this.client.delete('/api/v1/notifications/read');
  }
}
```

#### 2.4.3 Hooks

**File**: `frontend/src/hooks/useNotifications.ts` (update existing)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { NotificationFilters } from '../types/notifications';

export function useNotifications(filters?: NotificationFilters) {
  return useQuery({
    queryKey: ['notifications', filters],
    queryFn: () => apiClient.notifications.getNotifications(filters),
    staleTime: 30000, // 30 seconds
  });
}

export function useDeleteReadNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.notifications.deleteReadNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
```

#### 2.4.4 Component: Fixed NotificationDropdown

**File**: `frontend/src/components/NotificationDropdown.tsx` (styling fixes)

**Key Changes:**
- Line 59: Change `bg-gray-800` → `bg-white`
- Line 63: Change `border-gray-700` → `border-gray-200`
- Line 64: Add explicit text color: `text-gray-900`
- Line 68-72: Update button colors for light background
- Line 84-86: Update error state colors
- Line 88-95: Update empty state colors

```typescript
// Updated styling
return (
  <div
    ref={dropdownRef}
    className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl z-50"
    data-testid="notification-dropdown"
  >
    {/* Header */}
    <div className="flex items-center justify-between p-4 border-b border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
      {hasUnread && (
        <button
          onClick={handleMarkAllAsRead}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          disabled={markAllAsRead.isPending}
        >
          {markAllAsRead.isPending ? 'Marking...' : 'Mark all read'}
        </button>
      )}
    </div>

    {/* Content */}
    <div className="max-h-96 overflow-y-auto bg-gray-50">
      {isLoading ? (
        <div className="p-8 text-center text-gray-600">
          {/* ... loading state ... */}
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600">
          {/* ... error state ... */}
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-8 text-center text-gray-600">
          {/* ... empty state ... */}
        </div>
      ) : (
        notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onNavigate={handleNavigate}
          />
        ))
      )}
    </div>

    {/* Footer */}
    {notifications.length > 0 && (
      <div className="p-3 border-t border-gray-200 bg-white text-center">
        <button
          onClick={() => {
            navigate('/notifications');
            onClose();
          }}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          View all notifications
        </button>
      </div>
    )}
  </div>
);
```

#### 2.4.5 Component: Fixed NotificationItem

**File**: `frontend/src/components/NotificationItem.tsx` (styling fixes)

**Key Changes:**
- Line 67-73: Update background colors for light theme
- Line 84: Add explicit text color: `text-gray-900`
- Line 88: Keep `text-gray-600` for content
- Line 99: Keep `text-gray-500` for timestamp
- Line 107: Update delete button hover color

```typescript
return (
  <div
    onClick={handleClick}
    className={`
      notification-item
      flex items-start gap-3 p-4 border-b border-gray-200 last:border-b-0
      ${notification.is_read ? 'bg-white' : 'bg-blue-50'}
      ${notification.link_url ? 'cursor-pointer hover:bg-gray-50' : ''}
      transition-colors
    `}
  >
    {/* Icon */}
    <div className="text-2xl flex-shrink-0">
      {getNotificationIcon(notification.type)}
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h4 className={`text-sm text-gray-900 ${!notification.is_read ? 'font-semibold' : 'font-normal'}`}>
            {notification.title}
          </h4>
          {notification.content && (
            <p className="text-sm text-gray-600 mt-1">{notification.content}</p>
          )}
        </div>

        {/* Unread indicator */}
        {!notification.is_read && (
          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
        )}
      </div>

      {/* Timestamp */}
      <p className="text-xs text-gray-500 mt-2">
        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
      </p>
    </div>

    {/* Delete button */}
    <button
      onClick={handleDelete}
      className="text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
      title="Delete notification"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
);
```

#### 2.4.6 Component: NotificationsPage

**File**: `frontend/src/pages/NotificationsPage.tsx` (new)

```typescript
import { useState } from 'react';
import { useNotifications, useMarkAllAsRead, useDeleteReadNotifications } from '../hooks/useNotifications';
import NotificationItem from '../components/NotificationItem';
import { useNavigate } from 'react-router-dom';
import type { NotificationFilters, NotificationType } from '../types/notifications';
import { NOTIFICATION_TYPE_LABELS } from '../types/notifications';

export function NotificationsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<NotificationFilters>({
    limit: 50,
    offset: 0,
  });

  const { data, isLoading, error } = useNotifications(filters);
  const markAllAsRead = useMarkAllAsRead();
  const deleteReadNotifications = useDeleteReadNotifications();

  const handleFilterChange = (updates: Partial<NotificationFilters>) => {
    setFilters(prev => ({ ...prev, ...updates, offset: 0 })); // Reset offset when changing filters
  };

  const handleLoadMore = () => {
    setFilters(prev => ({ ...prev, offset: prev.offset! + (prev.limit || 50) }));
  };

  const handleDeleteRead = () => {
    if (confirm('Delete all read notifications? This cannot be undone.')) {
      deleteReadNotifications.mutate();
    }
  };

  const notifications = data?.data.notifications || [];
  const totalCount = data?.data.total_count || 0;
  const unreadCount = data?.data.unread_count || 0;
  const hasMore = data?.data.has_more || false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600 mt-2">
          {unreadCount > 0 ? `${unreadCount} unread · ` : ''}
          {totalCount} total
        </p>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Filter:</label>
            <button
              onClick={() => handleFilterChange({ is_read: undefined })}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filters.is_read === undefined
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleFilterChange({ is_read: false })}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                filters.is_read === false
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Unread only
            </button>

            {/* Type Filter Dropdown */}
            <select
              value={filters.types?.[0] || ''}
              onChange={(e) => {
                const type = e.target.value as NotificationType | '';
                handleFilterChange({ types: type ? [type] : undefined });
              }}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead.mutate()}
                disabled={markAllAsRead.isPending}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
              >
                {markAllAsRead.isPending ? 'Marking...' : 'Mark all read'}
              </button>
            )}
            <button
              onClick={handleDeleteRead}
              disabled={deleteReadNotifications.isPending}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
            >
              Clear read
            </button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">
            <p className="font-semibold mb-2">Failed to load notifications</p>
            <p className="text-sm text-gray-600">Please try again later</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-gray-600 font-medium">No notifications</p>
            <p className="text-sm text-gray-500 mt-1">
              {filters.is_read === false ? "You're all caught up!" : "No notifications yet"}
            </p>
          </div>
        ) : (
          <>
            <div>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onNavigate={(url) => navigate(url)}
                />
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="p-4 border-t border-gray-200 text-center">
                <button
                  onClick={handleLoadMore}
                  className="px-6 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

**Add Route** (`frontend/src/App.tsx`):

```typescript
<Route path="/notifications" element={<NotificationsPage />} />
```

---

## 3. Testing Strategy

### 3.1 Backend Testing

#### Unit Tests

**File**: `backend/pkg/db/services/notifications/listing_test.go`

```go
func TestGetUserNotifications_WithFilters(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	user := suite.createUser("player1")

	// Create notifications of different types
	suite.createNotification(user.ID, "private_message", "Message 1")
	suite.createNotification(user.ID, "comment_reply", "Reply 1")
	suite.createNotification(user.ID, "private_message", "Message 2")

	// Filter by type
	filters := core.NotificationFilters{
		Types:  []string{"private_message"},
		Limit:  10,
		Offset: 0,
	}

	result, err := suite.notificationsService.GetUserNotifications(ctx, user.ID, filters)
	require.NoError(t, err)
	assert.Equal(t, 2, len(result.Notifications))
	assert.Equal(t, 3, result.TotalCount) // Total regardless of filter
}

func TestGetUserNotifications_ReadStatusFilter(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	user := suite.createUser("player1")

	// Create read and unread notifications
	n1 := suite.createNotification(user.ID, "private_message", "Unread")
	n2 := suite.createNotification(user.ID, "comment_reply", "Read")
	suite.markAsRead(n2.ID)

	// Filter for unread only
	falseVal := false
	filters := core.NotificationFilters{
		IsRead: &falseVal,
		Limit:  10,
	}

	result, err := suite.notificationsService.GetUserNotifications(ctx, user.ID, filters)
	require.NoError(t, err)
	assert.Equal(t, 1, len(result.Notifications))
	assert.False(t, result.Notifications[0].IsRead)
}

func TestGetUserNotifications_Pagination(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	user := suite.createUser("player1")

	// Create 25 notifications
	for i := 0; i < 25; i++ {
		suite.createNotification(user.ID, "private_message", fmt.Sprintf("Notification %d", i))
	}

	// First page
	filters := core.NotificationFilters{Limit: 10, Offset: 0}
	result, err := suite.notificationsService.GetUserNotifications(ctx, user.ID, filters)
	require.NoError(t, err)
	assert.Equal(t, 10, len(result.Notifications))
	assert.Equal(t, 25, result.TotalCount)
	assert.True(t, result.HasMore)

	// Second page
	filters.Offset = 10
	result, err = suite.notificationsService.GetUserNotifications(ctx, user.ID, filters)
	require.NoError(t, err)
	assert.Equal(t, 10, len(result.Notifications))
	assert.True(t, result.HasMore)

	// Third page
	filters.Offset = 20
	result, err = suite.notificationsService.GetUserNotifications(ctx, user.ID, filters)
	require.NoError(t, err)
	assert.Equal(t, 5, len(result.Notifications))
	assert.False(t, result.HasMore)
}
```

### 3.2 Frontend Testing

#### Component Tests

**File**: `frontend/src/pages/NotificationsPage.test.tsx`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsPage } from './NotificationsPage';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('NotificationsPage', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('should render notifications list', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/notifications', () => {
        return HttpResponse.json({
          notifications: [
            { id: 1, type: 'private_message', title: 'Test notification', is_read: false, created_at: '2025-10-19T10:00:00Z' },
          ],
          total_count: 1,
          unread_count: 1,
          has_more: false,
        });
      })
    );

    render(<NotificationsPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Test notification')).toBeInTheDocument();
    });
  });

  it('should filter by unread status', async () => {
    const mockGetNotifications = vi.fn();

    server.use(
      http.get('http://localhost:3000/api/v1/notifications', ({ request }) => {
        const url = new URL(request.url);
        mockGetNotifications(url.searchParams.get('is_read'));

        return HttpResponse.json({
          notifications: [],
          total_count: 0,
          unread_count: 0,
          has_more: false,
        });
      })
    );

    render(<NotificationsPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Unread only')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Unread only'));

    await waitFor(() => {
      expect(mockGetNotifications).toHaveBeenCalledWith('false');
    });
  });

  it('should display empty state when no notifications', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/notifications', () => {
        return HttpResponse.json({
          notifications: [],
          total_count: 0,
          unread_count: 0,
          has_more: false,
        });
      })
    );

    render(<NotificationsPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });
  });

  it('should show load more button when has_more is true', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/notifications', () => {
        return HttpResponse.json({
          notifications: [
            { id: 1, type: 'private_message', title: 'Notification 1', is_read: false, created_at: '2025-10-19T10:00:00Z' },
          ],
          total_count: 100,
          unread_count: 50,
          has_more: true,
        });
      })
    );

    render(<NotificationsPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Load more')).toBeInTheDocument();
    });
  });
});
```

### 3.3 Manual Testing Checklist

**Dropdown Styling:**
- [ ] Dropdown background is white (not dark gray)
- [ ] Text is dark gray/black (readable contrast)
- [ ] Unread notifications have blue background
- [ ] Read notifications have white background
- [ ] Icons are clearly visible
- [ ] "Mark all as read" button has correct colors
- [ ] "View all notifications" link is readable

**Notifications Page:**
- [ ] Page loads at `/notifications` (no 404)
- [ ] Shows all notifications with pagination
- [ ] "All" filter shows all notifications
- [ ] "Unread only" filter shows only unread
- [ ] Type filter dropdown works correctly
- [ ] "Mark all as read" button marks all as read
- [ ] "Clear read" button deletes read notifications with confirmation
- [ ] "Load more" button appears when `has_more` is true
- [ ] Clicking "Load more" loads next page
- [ ] Notifications are ordered by most recent first

**Integration:**
- [ ] Clicking notification in dropdown navigates correctly
- [ ] Clicking notification on page navigates correctly
- [ ] Mark as read updates unread count immediately
- [ ] Delete notification removes it from list
- [ ] Unread badge on bell icon updates correctly
- [ ] Navigation between dropdown and page works smoothly

**Responsive Design:**
- [ ] Dropdown width appropriate on mobile
- [ ] Page layout works on mobile (375px)
- [ ] Filters stack correctly on small screens
- [ ] Touch targets are accessible (>44px)

---

## 4. Implementation Plan

### 4.1 Phase 1: Backend Enhancements (Day 1)

**Tasks:**
- [ ] Update SQL queries for pagination and filtering
- [ ] Run `just sqlgen`
- [ ] Implement `NotificationsService` listing methods
- [ ] Write unit tests (>85% coverage)
- [ ] Create API handlers for new endpoints
- [ ] Test with curl

**Acceptance Criteria:**
- ✅ Queries support filters (types, is_read)
- ✅ Pagination works correctly
- ✅ Unit tests passing
- ✅ API returns correct response structure

### 4.2 Phase 2: Dropdown Styling Fixes (Day 1)

**Tasks:**
- [ ] Update `NotificationDropdown.tsx` colors
- [ ] Update `NotificationItem.tsx` colors
- [ ] Test contrast ratios (WCAG 2.1 AA)
- [ ] Update component tests
- [ ] Visual regression testing

**Acceptance Criteria:**
- ✅ All text readable (>4.5:1 contrast)
- ✅ Unread notifications visually distinct
- ✅ Component tests passing
- ✅ No dark-on-dark issues

### 4.3 Phase 3: Notifications Page (Days 2-3)

**Tasks:**
- [ ] Create `NotificationsPage` component
- [ ] Implement filter UI
- [ ] Add "Load more" pagination
- [ ] Add bulk actions (mark all read, clear read)
- [ ] Add route to App.tsx
- [ ] Write component tests
- [ ] Manual testing

**Acceptance Criteria:**
- ✅ Page loads at `/notifications`
- ✅ All filters work correctly
- ✅ Pagination works smoothly
- ✅ Bulk actions function correctly
- ✅ Component tests passing

### 4.4 Phase 4: Polish & Documentation (Day 3)

**Tasks:**
- [ ] Complete manual testing checklist
- [ ] Fix any bugs discovered
- [ ] Accessibility audit
- [ ] Update documentation
- [ ] Add loading skeletons
- [ ] Cross-browser testing

**Acceptance Criteria:**
- ✅ All manual testing items pass
- ✅ No accessibility issues
- ✅ Documentation updated
- ✅ Works in all browsers

---

## 5. Rollout Strategy

### 5.1 Deployment Plan

**Pre-Deployment:**
1. Run test suite (backend + frontend)
2. Visual QA on staging
3. Test on mobile devices

**Deployment:**
1. Deploy backend (backward compatible)
2. Deploy frontend
3. Monitor error rates

**Post-Deployment:**
1. Monitor notification read rates
2. Track page visit rates
3. Gather user feedback

### 5.2 Rollback Plan

**If issues arise:**
1. Frontend rollback: Safe, no data changes
2. Backend rollback: Safe, new endpoints unused by old frontend
3. Database: No schema changes, nothing to roll back

---

## 6. Monitoring and Success Metrics

### 6.1 Product Metrics

- **Notification Read Rate**: Target >60% (from ~40%)
- **View All Page Usage**: Target >30% monthly
- **Clear Read Usage**: Target >20% of users per month
- **Time on Page**: Target >30 seconds average
- **User Satisfaction**: "Notifications" >4/5

---

## 7. Documentation Updates

### 7.1 User Documentation

**Add to User Guide**:

```markdown
# Notifications

## Notification Dropdown

Click the bell icon (🔔) to view your recent notifications.

- **Unread** notifications have a blue background
- **Read** notifications have a white background
- Click a notification to navigate to relevant content
- Click "Mark all as read" to mark all as read
- Click "View all notifications" to see full history

## Notifications Page

Access all your notifications at `/notifications`:

### Filters
- **All**: Show all notifications
- **Unread only**: Show only unread notifications
- **Type filter**: Filter by notification type (messages, replies, etc.)

### Actions
- **Mark all as read**: Mark all notifications as read
- **Clear read**: Delete all read notifications (cannot be undone)
- **Delete**: Click ✕ on individual notifications to delete

### Tips
- Use filters to find specific notifications quickly
- Clear read notifications periodically to keep list manageable
- Notifications are sorted by most recent first
```

---

## 8. Revision History

| Date | Changes | Author |
|------|---------|--------|
| 2025-10-19 | Initial plan created | AI Planning Session |
| | | |
