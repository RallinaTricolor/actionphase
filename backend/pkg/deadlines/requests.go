package deadlines

import (
	"net/http"
	"time"
)

// CreateDeadlineRequest represents the request to create a new deadline
type CreateDeadlineRequest struct {
	Title       string    `json:"title" validate:"required,min=1,max=255"`
	Description string    `json:"description"`
	Deadline    time.Time `json:"deadline" validate:"required"`
}

func (r *CreateDeadlineRequest) Bind(req *http.Request) error {
	return nil
}

// UpdateDeadlineRequest represents the request to update a deadline
type UpdateDeadlineRequest struct {
	Title       string    `json:"title" validate:"required,min=1,max=255"`
	Description string    `json:"description"`
	Deadline    time.Time `json:"deadline" validate:"required"`
}

func (r *UpdateDeadlineRequest) Bind(req *http.Request) error {
	return nil
}

// DeadlineResponse represents a deadline in API responses
type DeadlineResponse struct {
	ID          int32      `json:"id"`
	GameID      int32      `json:"game_id"`
	Title       string     `json:"title"`
	Description *string    `json:"description,omitempty"`
	Deadline    *time.Time `json:"deadline,omitempty"`
	CreatedAt   *time.Time `json:"created_at,omitempty"`
	UpdatedAt   *time.Time `json:"updated_at,omitempty"`
}

// DeadlineWithGameResponse represents a deadline with game information
type DeadlineWithGameResponse struct {
	ID          int32      `json:"id"`
	GameID      int32      `json:"game_id"`
	GameTitle   string     `json:"game_title"`
	Title       string     `json:"title"`
	Description *string    `json:"description,omitempty"`
	Deadline    *time.Time `json:"deadline,omitempty"`
	CreatedAt   *time.Time `json:"created_at,omitempty"`
	UpdatedAt   *time.Time `json:"updated_at,omitempty"`
}
