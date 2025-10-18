package db

import (
	"context"
	"testing"

	"actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNotificationService_CreateNotification(t *testing.T) {
	pool := core.SetupTestDB(t)
	defer core.CleanupTestDB(t, pool)

	ctx := context.Background()
	service := &NotificationService{DB: pool}

	// Create test user
	user := core.CreateTestUser(t, pool, "testuser", "test@example.com")
	gameID := int32(1)

	tests := []struct {
		name    string
		req     *core.CreateNotificationRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid notification",
			req: &core.CreateNotificationRequest{
				UserID:  user.ID,
				GameID:  &gameID,
				Type:    core.NotificationTypePrivateMessage,
				Title:   "You have a new message",
				LinkURL: stringPtr("/games/1#messages"),
			},
			wantErr: false,
		},
		{
			name: "missing title",
			req: &core.CreateNotificationRequest{
				UserID: user.ID,
				Type:   core.NotificationTypePrivateMessage,
				Title:  "",
			},
			wantErr: true,
			errMsg:  "title is required",
		},
		{
			name: "invalid notification type",
			req: &core.CreateNotificationRequest{
				UserID: user.ID,
				Type:   "invalid_type",
				Title:  "Test",
			},
			wantErr: true,
			errMsg:  "invalid notification type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			notification, err := service.CreateNotification(ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				if tt.errMsg != "" {
					assert.Contains(t, err.Error(), tt.errMsg)
				}
				return
			}

			require.NoError(t, err)
			assert.NotZero(t, notification.ID)
			assert.Equal(t, tt.req.UserID, notification.UserID)
			assert.Equal(t, tt.req.Type, notification.Type)
			assert.Equal(t, tt.req.Title, notification.Title)
			assert.False(t, notification.IsRead)
			assert.NotZero(t, notification.CreatedAt)
		})
	}
}

func TestNotificationService_GetUnreadCount(t *testing.T) {
	pool := core.SetupTestDB(t)
	defer core.CleanupTestDB(t, pool)

	ctx := context.Background()
	service := &NotificationService{DB: pool}

	// Create test user
	user := core.CreateTestUser(t, pool, "testuser", "test@example.com")

	// Create 5 notifications
	for i := 0; i < 5; i++ {
		_, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
			UserID: user.ID,
			Type:   core.NotificationTypePrivateMessage,
			Title:  "Test notification",
		})
		require.NoError(t, err)
	}

	// Get unread count
	count, err := service.GetUnreadCount(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(5), count)

	// Mark 2 as read
	notifications, err := service.GetUserNotifications(ctx, user.ID, 2, 0)
	require.NoError(t, err)
	require.Len(t, notifications, 2)

	err = service.MarkAsRead(ctx, notifications[0].ID, user.ID)
	require.NoError(t, err)
	err = service.MarkAsRead(ctx, notifications[1].ID, user.ID)
	require.NoError(t, err)

	// Check unread count again
	count, err = service.GetUnreadCount(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)
}

func TestNotificationService_MarkAsRead(t *testing.T) {
	pool := core.SetupTestDB(t)
	defer core.CleanupTestDB(t, pool)

	ctx := context.Background()
	service := &NotificationService{DB: pool}

	// Create test user
	user := core.CreateTestUser(t, pool, "testuser", "test@example.com")

	// Create notification
	notification, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID: user.ID,
		Type:   core.NotificationTypePrivateMessage,
		Title:  "Test notification",
	})
	require.NoError(t, err)
	assert.False(t, notification.IsRead)

	// Mark as read
	err = service.MarkAsRead(ctx, notification.ID, user.ID)
	require.NoError(t, err)

	// Verify it's marked as read
	notifications, err := service.GetUserNotifications(ctx, user.ID, 10, 0)
	require.NoError(t, err)
	require.Len(t, notifications, 1)
	assert.True(t, notifications[0].IsRead)
	assert.NotNil(t, notifications[0].ReadAt)
}

func TestNotificationService_MarkAllAsRead(t *testing.T) {
	pool := core.SetupTestDB(t)
	defer core.CleanupTestDB(t, pool)

	ctx := context.Background()
	service := &NotificationService{DB: pool}

	// Create test user
	user := core.CreateTestUser(t, pool, "testuser", "test@example.com")

	// Create 3 notifications
	for i := 0; i < 3; i++ {
		_, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
			UserID: user.ID,
			Type:   core.NotificationTypePrivateMessage,
			Title:  "Test notification",
		})
		require.NoError(t, err)
	}

	// Verify unread count
	count, err := service.GetUnreadCount(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)

	// Mark all as read
	err = service.MarkAllAsRead(ctx, user.ID)
	require.NoError(t, err)

	// Verify all marked as read
	count, err = service.GetUnreadCount(ctx, user.ID)
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)
}

func TestNotificationService_GetUserNotifications_Pagination(t *testing.T) {
	pool := core.SetupTestDB(t)
	defer core.CleanupTestDB(t, pool)

	ctx := context.Background()
	service := &NotificationService{DB: pool}

	// Create test user
	user := core.CreateTestUser(t, pool, "testuser", "test@example.com")

	// Create 10 notifications
	for i := 0; i < 10; i++ {
		_, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
			UserID: user.ID,
			Type:   core.NotificationTypePrivateMessage,
			Title:  "Test notification",
		})
		require.NoError(t, err)
	}

	// Get first 5
	page1, err := service.GetUserNotifications(ctx, user.ID, 5, 0)
	require.NoError(t, err)
	assert.Len(t, page1, 5)

	// Get next 5
	page2, err := service.GetUserNotifications(ctx, user.ID, 5, 5)
	require.NoError(t, err)
	assert.Len(t, page2, 5)

	// Verify no overlap (IDs should be different)
	page1IDs := make(map[int32]bool)
	for _, n := range page1 {
		page1IDs[n.ID] = true
	}
	for _, n := range page2 {
		assert.False(t, page1IDs[n.ID], "Pagination should not have overlapping results")
	}
}

func TestNotificationService_DeleteNotification(t *testing.T) {
	pool := core.SetupTestDB(t)
	defer core.CleanupTestDB(t, pool)

	ctx := context.Background()
	service := &NotificationService{DB: pool}

	// Create test users
	user1 := core.CreateTestUser(t, pool, "user1", "user1@example.com")
	user2 := core.CreateTestUser(t, pool, "user2", "user2@example.com")

	// Create notification for user1
	notification, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID: user1.ID,
		Type:   core.NotificationTypePrivateMessage,
		Title:  "Test notification",
	})
	require.NoError(t, err)

	// User1 can delete their own notification
	err = service.DeleteNotification(ctx, notification.ID, user1.ID)
	require.NoError(t, err)

	// Verify it's deleted
	notifications, err := service.GetUserNotifications(ctx, user1.ID, 10, 0)
	require.NoError(t, err)
	assert.Len(t, notifications, 0)

	// Create another notification
	notification2, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID: user1.ID,
		Type:   core.NotificationTypePrivateMessage,
		Title:  "Test notification 2",
	})
	require.NoError(t, err)

	// User2 cannot delete user1's notification (should have no effect)
	err = service.DeleteNotification(ctx, notification2.ID, user2.ID)
	// This should not error but should not delete the notification
	require.NoError(t, err)

	// Verify it still exists
	notifications, err = service.GetUserNotifications(ctx, user1.ID, 10, 0)
	require.NoError(t, err)
	assert.Len(t, notifications, 1)
}

// Helper function
func stringPtr(s string) *string {
	return &s
}
