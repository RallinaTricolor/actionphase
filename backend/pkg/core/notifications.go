package core

import (
	"time"

	"github.com/go-playground/validator/v10"
)

// Notification represents a user notification.
// It contains information about an event that the user should be aware of.
type Notification struct {
	ID          int32      `json:"id"`
	UserID      int32      `json:"user_id"`
	GameID      *int32     `json:"game_id,omitempty"`
	Type        string     `json:"type"`
	Title       string     `json:"title"`
	Content     *string    `json:"content,omitempty"`
	RelatedType *string    `json:"related_type,omitempty"`
	RelatedID   *int32     `json:"related_id,omitempty"`
	LinkURL     *string    `json:"link_url,omitempty"`
	IsRead      bool       `json:"is_read"`
	ReadAt      *time.Time `json:"read_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// CreateNotificationRequest contains the data needed to create a notification.
type CreateNotificationRequest struct {
	UserID      int32   `json:"user_id" validate:"required"`
	GameID      *int32  `json:"game_id,omitempty"`
	Type        string  `json:"type" validate:"required"`
	Title       string  `json:"title" validate:"required,min=1,max=255"`
	Content     *string `json:"content,omitempty" validate:"omitempty,max=1000"`
	RelatedType *string `json:"related_type,omitempty"`
	RelatedID   *int32  `json:"related_id,omitempty"`
	LinkURL     *string `json:"link_url,omitempty" validate:"omitempty,max=500"`
}

// Validate validates the CreateNotificationRequest.
func (r *CreateNotificationRequest) Validate() error {
	validate := validator.New(validator.WithRequiredStructEnabled())

	// Register custom validator for notification type
	validate.RegisterValidation("notification_type", func(fl validator.FieldLevel) bool {
		return IsValidNotificationType(fl.Field().String())
	})

	// Add custom validation for notification type
	if !IsValidNotificationType(r.Type) {
		return &validator.ValidationErrors{}
	}

	return validate.Struct(r)
}

// NotificationFilters contains filters for querying notifications.
type NotificationFilters struct {
	Limit  int  `json:"limit"`
	Offset int  `json:"offset"`
	Unread bool `json:"unread"` // Only return unread notifications
}
