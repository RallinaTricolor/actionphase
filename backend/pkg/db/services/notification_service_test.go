package db

import (
	"context"
	"testing"

	"actionphase/pkg/core"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNotificationService_CreateNotification(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	service := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test user
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")

	tests := []struct {
		name    string
		req     *core.CreateNotificationRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid notification",
			req: &core.CreateNotificationRequest{
				UserID:  int32(user.ID),
				GameID:  nil, // No game association to avoid foreign key constraint
				Type:    core.NotificationTypePrivateMessage,
				Title:   "You have a new message",
				LinkURL: stringPtr("/messages"),
			},
			wantErr: false,
		},
		{
			name: "missing title",
			req: &core.CreateNotificationRequest{
				UserID: int32(user.ID),
				Type:   core.NotificationTypePrivateMessage,
				Title:  "",
			},
			wantErr: true,
			errMsg:  "Title",
		},
		{
			name: "invalid notification type",
			req: &core.CreateNotificationRequest{
				UserID: int32(user.ID),
				Type:   "invalid_type",
				Title:  "Test",
			},
			wantErr: true,
			errMsg:  "", // Validator returns empty error for custom validation
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
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	service := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test user
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")

	// Create 5 notifications
	for i := 0; i < 5; i++ {
		_, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
			UserID: int32(user.ID),
			Type:   core.NotificationTypePrivateMessage,
			Title:  "Test notification",
		})
		require.NoError(t, err)
	}

	// Get unread count
	count, err := service.GetUnreadCount(ctx, int32(user.ID))
	require.NoError(t, err)
	assert.Equal(t, int64(5), count)

	// Mark 2 as read
	notifications, err := service.GetUserNotifications(ctx, int32(user.ID), 2, 0)
	require.NoError(t, err)
	require.Len(t, notifications, 2)

	err = service.MarkAsRead(ctx, notifications[0].ID, int32(user.ID))
	require.NoError(t, err)
	err = service.MarkAsRead(ctx, notifications[1].ID, int32(user.ID))
	require.NoError(t, err)

	// Check unread count again
	count, err = service.GetUnreadCount(ctx, int32(user.ID))
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)
}

func TestNotificationService_MarkAsRead(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	service := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test user
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")

	// Create notification
	notification, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID: int32(user.ID),
		Type:   core.NotificationTypePrivateMessage,
		Title:  "Test notification",
	})
	require.NoError(t, err)
	assert.False(t, notification.IsRead)

	// Mark as read
	err = service.MarkAsRead(ctx, notification.ID, int32(user.ID))
	require.NoError(t, err)

	// Verify it's marked as read
	notifications, err := service.GetUserNotifications(ctx, int32(user.ID), 10, 0)
	require.NoError(t, err)
	require.Len(t, notifications, 1)
	assert.True(t, notifications[0].IsRead)
	assert.NotNil(t, notifications[0].ReadAt)
}

func TestNotificationService_MarkAllAsRead(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	service := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test user
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")

	// Create 3 notifications
	for i := 0; i < 3; i++ {
		_, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
			UserID: int32(user.ID),
			Type:   core.NotificationTypePrivateMessage,
			Title:  "Test notification",
		})
		require.NoError(t, err)
	}

	// Verify unread count
	count, err := service.GetUnreadCount(ctx, int32(user.ID))
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)

	// Mark all as read
	err = service.MarkAllAsRead(ctx, int32(user.ID))
	require.NoError(t, err)

	// Verify all marked as read
	count, err = service.GetUnreadCount(ctx, int32(user.ID))
	require.NoError(t, err)
	assert.Equal(t, int64(0), count)
}

func TestNotificationService_GetUserNotifications_Pagination(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	service := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test user
	user := testDB.CreateTestUser(t, "testuser", "test@example.com")

	// Create 10 notifications
	for i := 0; i < 10; i++ {
		_, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
			UserID: int32(user.ID),
			Type:   core.NotificationTypePrivateMessage,
			Title:  "Test notification",
		})
		require.NoError(t, err)
	}

	// Get first 5
	page1, err := service.GetUserNotifications(ctx, int32(user.ID), 5, 0)
	require.NoError(t, err)
	assert.Len(t, page1, 5)

	// Get next 5
	page2, err := service.GetUserNotifications(ctx, int32(user.ID), 5, 5)
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
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	service := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test users
	user1 := testDB.CreateTestUser(t, "user1", "user1@example.com")
	user2 := testDB.CreateTestUser(t, "user2", "user2@example.com")

	// Create notification for user1
	notification, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID: int32(user1.ID),
		Type:   core.NotificationTypePrivateMessage,
		Title:  "Test notification",
	})
	require.NoError(t, err)

	// User1 can delete their own notification
	err = service.DeleteNotification(ctx, notification.ID, int32(user1.ID))
	require.NoError(t, err)

	// Verify it's deleted
	notifications, err := service.GetUserNotifications(ctx, int32(user1.ID), 10, 0)
	require.NoError(t, err)
	assert.Len(t, notifications, 0)

	// Create another notification
	notification2, err := service.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID: int32(user1.ID),
		Type:   core.NotificationTypePrivateMessage,
		Title:  "Test notification 2",
	})
	require.NoError(t, err)

	// User2 cannot delete user1's notification (should have no effect)
	err = service.DeleteNotification(ctx, notification2.ID, int32(user2.ID))
	// This should not error but should not delete the notification
	require.NoError(t, err)

	// Verify it still exists
	notifications, err = service.GetUserNotifications(ctx, int32(user1.ID), 10, 0)
	require.NoError(t, err)
	assert.Len(t, notifications, 1)
}

func TestNotificationService_NotifyPhaseCreated(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	ctx := context.Background()
	app := core.NewTestApp(testDB.Pool)
	service := &NotificationService{DB: testDB.Pool, Logger: app.ObsLogger}

	// Create test users (GM + 2 players)
	gm := testDB.CreateTestUser(t, "gm", "gm@example.com")
	player1 := testDB.CreateTestUser(t, "player1", "player1@example.com")
	player2 := testDB.CreateTestUser(t, "player2", "player2@example.com")

	// Create test game with GM
	game := testDB.CreateTestGame(t, int32(gm.ID), "Test Game")

	// Add players as participants (with status 'active')
	testDB.AddTestGameParticipant(t, int32(game.ID), int32(player1.ID), "player")
	testDB.AddTestGameParticipant(t, int32(game.ID), int32(player2.ID), "player")

	// Create a test phase
	phase := testDB.CreateTestPhase(t, int32(game.ID), "action", "Test Phase")

	// Notify all participants about the phase (excluding GM who created it)
	err := service.NotifyPhaseCreated(ctx, int32(game.ID), int32(phase.ID), phase.Title, int32(gm.ID))
	require.NoError(t, err)

	// Verify player1 received notification
	player1Notifications, err := service.GetUserNotifications(ctx, int32(player1.ID), 10, 0)
	require.NoError(t, err)
	assert.Len(t, player1Notifications, 1)
	assert.Equal(t, "New phase: Test Phase", player1Notifications[0].Title)
	assert.Equal(t, core.NotificationTypePhaseCreated, player1Notifications[0].Type)
	assert.False(t, player1Notifications[0].IsRead)

	// Verify player2 received notification
	player2Notifications, err := service.GetUserNotifications(ctx, int32(player2.ID), 10, 0)
	require.NoError(t, err)
	assert.Len(t, player2Notifications, 1)
	assert.Equal(t, "New phase: Test Phase", player2Notifications[0].Title)

	// Verify GM did NOT receive notification (excluded)
	gmNotifications, err := service.GetUserNotifications(ctx, int32(gm.ID), 10, 0)
	require.NoError(t, err)
	assert.Len(t, gmNotifications, 0)
}
