package db

import (
	"context"
	"fmt"

	"actionphase/pkg/core"
	"actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NotificationService implements core.NotificationServiceInterface
type NotificationService struct {
	DB *pgxpool.Pool
}

// Compile-time interface verification
var _ core.NotificationServiceInterface = (*NotificationService)(nil)

// CreateNotification creates a new notification for a user
func (s *NotificationService) CreateNotification(ctx context.Context, req *core.CreateNotificationRequest) (*core.Notification, error) {
	// Validate request
	if req.Title == "" {
		return nil, fmt.Errorf("title is required")
	}

	if !core.IsValidNotificationType(req.Type) {
		return nil, fmt.Errorf("invalid notification type: %s", req.Type)
	}

	queries := models.New(s.DB)

	// Convert nullable fields
	var gameID *int32
	if req.GameID != nil {
		gameID = req.GameID
	}

	var content *string
	if req.Content != nil {
		content = req.Content
	}

	var relatedType *string
	if req.RelatedType != nil {
		relatedType = req.RelatedType
	}

	var relatedID *int32
	if req.RelatedID != nil {
		relatedID = req.RelatedID
	}

	var linkURL *string
	if req.LinkURL != nil {
		linkURL = req.LinkURL
	}

	// Create notification
	notification, err := queries.CreateNotification(ctx, models.CreateNotificationParams{
		UserID:      req.UserID,
		GameID:      gameID,
		Type:        req.Type,
		Title:       req.Title,
		Content:     content,
		RelatedType: relatedType,
		RelatedID:   relatedID,
		LinkUrl:     linkURL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create notification: %w", err)
	}

	// Convert to core type
	return dbNotificationToCore(&notification), nil
}

// CreateBulkNotifications creates notifications for multiple users at once
func (s *NotificationService) CreateBulkNotifications(ctx context.Context, userIDs []int32, req *core.CreateNotificationRequest) error {
	// Create notification for each user
	for _, userID := range userIDs {
		reqCopy := *req
		reqCopy.UserID = userID
		_, err := s.CreateNotification(ctx, &reqCopy)
		if err != nil {
			// Log error but continue (fire-and-forget pattern)
			fmt.Printf("Failed to create notification for user %d: %v\n", userID, err)
		}
	}
	return nil
}

// GetUserNotifications retrieves a user's notifications with pagination
func (s *NotificationService) GetUserNotifications(ctx context.Context, userID int32, limit, offset int) ([]*core.Notification, error) {
	queries := db.New(s.DB)

	notifications, err := queries.GetUserNotifications(ctx, db.GetUserNotificationsParams{
		UserID: userID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get user notifications: %w", err)
	}

	result := make([]*core.Notification, len(notifications))
	for i, n := range notifications {
		result[i] = dbNotificationToCore(&n)
	}

	return result, nil
}

// GetUnreadCount returns the count of unread notifications for a user
func (s *NotificationService) GetUnreadCount(ctx context.Context, userID int32) (int64, error) {
	queries := db.New(s.DB)

	count, err := queries.GetUnreadNotificationCount(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("failed to get unread notification count: %w", err)
	}

	return count, nil
}

// GetUnreadNotifications retrieves only unread notifications for a user
func (s *NotificationService) GetUnreadNotifications(ctx context.Context, userID int32, limit int) ([]*core.Notification, error) {
	queries := db.New(s.DB)

	notifications, err := queries.GetUnreadNotifications(ctx, db.GetUnreadNotificationsParams{
		UserID: userID,
		Limit:  int32(limit),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get unread notifications: %w", err)
	}

	result := make([]*core.Notification, len(notifications))
	for i, n := range notifications {
		result[i] = dbNotificationToCore(&n)
	}

	return result, nil
}

// MarkAsRead marks a notification as read
func (s *NotificationService) MarkAsRead(ctx context.Context, notificationID, userID int32) error {
	queries := db.New(s.DB)

	err := queries.MarkNotificationAsRead(ctx, db.MarkNotificationAsReadParams{
		ID:     notificationID,
		UserID: userID,
	})
	if err != nil {
		return fmt.Errorf("failed to mark notification as read: %w", err)
	}

	return nil
}

// MarkAllAsRead marks all of a user's unread notifications as read
func (s *NotificationService) MarkAllAsRead(ctx context.Context, userID int32) error {
	queries := db.New(s.DB)

	err := queries.MarkAllNotificationsAsRead(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to mark all notifications as read: %w", err)
	}

	return nil
}

// DeleteNotification deletes a notification (user must own it)
func (s *NotificationService) DeleteNotification(ctx context.Context, notificationID, userID int32) error {
	queries := db.New(s.DB)

	err := queries.DeleteNotification(ctx, db.DeleteNotificationParams{
		ID:     notificationID,
		UserID: userID,
	})
	if err != nil {
		return fmt.Errorf("failed to delete notification: %w", err)
	}

	return nil
}

// DeleteOldReadNotifications cleans up read notifications older than 30 days
func (s *NotificationService) DeleteOldReadNotifications(ctx context.Context) error {
	queries := db.New(s.DB)

	err := queries.DeleteOldReadNotifications(ctx)
	if err != nil {
		return fmt.Errorf("failed to delete old read notifications: %w", err)
	}

	return nil
}

// Helper methods for specific notification types

// NotifyPrivateMessage creates a notification for a new private message
func (s *NotificationService) NotifyPrivateMessage(ctx context.Context, recipientUserID int32, messageID int32, gameID int32, senderCharacterName string) error {
	linkURL := fmt.Sprintf("/games/%d#messages", gameID)
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      recipientUserID,
		GameID:      &gameID,
		Type:        core.NotificationTypePrivateMessage,
		Title:       fmt.Sprintf("%s sent you a message", senderCharacterName),
		RelatedType: stringPtr("message"),
		RelatedID:   &messageID,
		LinkURL:     &linkURL,
	})
	return err
}

// NotifyCommentReply creates a notification when someone replies to a comment
func (s *NotificationService) NotifyCommentReply(ctx context.Context, originalCommentAuthorID int32, replyID int32, gameID int32, replierCharacterName string) error {
	linkURL := fmt.Sprintf("/games/%d#common-room", gameID)
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      originalCommentAuthorID,
		GameID:      &gameID,
		Type:        core.NotificationTypeCommentReply,
		Title:       fmt.Sprintf("%s replied to your comment", replierCharacterName),
		RelatedType: stringPtr("comment"),
		RelatedID:   &replyID,
		LinkURL:     &linkURL,
	})
	return err
}

// NotifyCharacterMention creates a notification when a character is mentioned
func (s *NotificationService) NotifyCharacterMention(ctx context.Context, characterOwnerID int32, commentID int32, gameID int32, mentioningCharacterName string, mentionedCharacterName string) error {
	linkURL := fmt.Sprintf("/games/%d#common-room", gameID)
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      characterOwnerID,
		GameID:      &gameID,
		Type:        core.NotificationTypeCharacterMention,
		Title:       fmt.Sprintf("%s mentioned %s in a comment", mentioningCharacterName, mentionedCharacterName),
		RelatedType: stringPtr("comment"),
		RelatedID:   &commentID,
		LinkURL:     &linkURL,
	})
	return err
}

// NotifyActionSubmitted creates a notification for GM when player submits action
func (s *NotificationService) NotifyActionSubmitted(ctx context.Context, gmUserID int32, actionID int32, gameID int32, characterName string) error {
	linkURL := fmt.Sprintf("/games/%d#actions", gameID)
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      gmUserID,
		GameID:      &gameID,
		Type:        core.NotificationTypeActionSubmitted,
		Title:       fmt.Sprintf("%s submitted an action", characterName),
		RelatedType: stringPtr("action"),
		RelatedID:   &actionID,
		LinkURL:     &linkURL,
	})
	return err
}

// NotifyActionResult creates a notification for player when GM publishes result
func (s *NotificationService) NotifyActionResult(ctx context.Context, playerUserID int32, resultID int32, gameID int32, actionTitle string) error {
	linkURL := fmt.Sprintf("/games/%d#results", gameID)
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      playerUserID,
		GameID:      &gameID,
		Type:        core.NotificationTypeActionResult,
		Title:       "You received an action result",
		Content:     stringPtr(fmt.Sprintf("Your action '%s' has been resolved", actionTitle)),
		RelatedType: stringPtr("result"),
		RelatedID:   &resultID,
		LinkURL:     &linkURL,
	})
	return err
}

// NotifyCommonRoomPost creates notifications for all game participants about new post
func (s *NotificationService) NotifyCommonRoomPost(ctx context.Context, gameID int32, postID int32, postTitle string, excludeUserID int32) error {
	// TODO: Get all game participants and create notifications
	// For now, return nil (will implement in integration phase)
	return nil
}

// NotifyPhaseCreated creates notifications for all participants when phase created
func (s *NotificationService) NotifyPhaseCreated(ctx context.Context, gameID int32, phaseID int32, phaseTitle string, excludeUserID int32) error {
	// TODO: Get all game participants and create notifications
	// For now, return nil (will implement in integration phase)
	return nil
}

// NotifyApplicationStatusChange creates notification for application approval/rejection
func (s *NotificationService) NotifyApplicationStatusChange(ctx context.Context, playerUserID int32, gameID int32, gameTitle string, approved bool) error {
	var notifType string
	var title string
	if approved {
		notifType = core.NotificationTypeApplicationApproved
		title = fmt.Sprintf("Your application to '%s' was approved", gameTitle)
	} else {
		notifType = core.NotificationTypeApplicationRejected
		title = fmt.Sprintf("Your application to '%s' was rejected", gameTitle)
	}

	linkURL := fmt.Sprintf("/games/%d", gameID)
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      playerUserID,
		GameID:      &gameID,
		Type:        notifType,
		Title:       title,
		RelatedType: stringPtr("application"),
		LinkURL:     &linkURL,
	})
	return err
}

// NotifyCharacterStatusChange creates notification for character approval/rejection
func (s *NotificationService) NotifyCharacterStatusChange(ctx context.Context, playerUserID int32, gameID int32, characterID int32, characterName string, approved bool) error {
	var notifType string
	var title string
	if approved {
		notifType = core.NotificationTypeCharacterApproved
		title = fmt.Sprintf("Your character '%s' was approved", characterName)
	} else {
		notifType = core.NotificationTypeCharacterRejected
		title = fmt.Sprintf("Your character '%s' was rejected", characterName)
	}

	linkURL := fmt.Sprintf("/games/%d#characters", gameID)
	_, err := s.CreateNotification(ctx, &core.CreateNotificationRequest{
		UserID:      playerUserID,
		GameID:      &gameID,
		Type:        notifType,
		Title:       title,
		RelatedType: stringPtr("character"),
		RelatedID:   &characterID,
		LinkURL:     &linkURL,
	})
	return err
}

// Helper functions

// dbNotificationToCore converts a database Notification to a core Notification
func dbNotificationToCore(n *db.Notification) *core.Notification {
	notification := &core.Notification{
		ID:        n.ID,
		UserID:    n.UserID,
		Type:      n.Type,
		Title:     n.Title,
		IsRead:    n.IsRead,
		CreatedAt: n.CreatedAt.Time,
	}

	if n.GameID != nil {
		notification.GameID = n.GameID
	}

	if n.Content != nil {
		notification.Content = n.Content
	}

	if n.RelatedType != nil {
		notification.RelatedType = n.RelatedType
	}

	if n.RelatedID != nil {
		notification.RelatedID = n.RelatedID
	}

	if n.LinkUrl != nil {
		notification.LinkURL = n.LinkUrl
	}

	if n.ReadAt != nil && n.ReadAt.Valid {
		readAt := n.ReadAt.Time
		notification.ReadAt = &readAt
	}

	return notification
}

func stringPtr(s string) *string {
	return &s
}
