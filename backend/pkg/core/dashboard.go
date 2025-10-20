package core

import "time"

// DashboardData represents the complete dashboard view for a user.
// It aggregates games, recent activity, and upcoming deadlines.
type DashboardData struct {
	UserID              int32                `json:"user_id"`
	HasGames            bool                 `json:"has_games"`
	PlayerGames         []*DashboardGameCard `json:"player_games"`
	GMGames             []*DashboardGameCard `json:"gm_games"`
	MixedRoleGames      []*DashboardGameCard `json:"mixed_role_games"`
	RecentMessages      []*DashboardMessage  `json:"recent_messages"`
	UpcomingDeadlines   []*DashboardDeadline `json:"upcoming_deadlines"`
	UnreadNotifications int                  `json:"unread_notifications"`
}

// DashboardGameCard represents a game card on the dashboard.
// It includes context-specific information based on user's role and game state.
type DashboardGameCard struct {
	GameID      int32   `json:"game_id"`
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
	State       string  `json:"state"` // "recruitment", "in_progress", "paused", "completed"
	Genre       *string `json:"genre,omitempty"`
	GMUserID    int32   `json:"gm_user_id"`
	GMUsername  string  `json:"gm_username"`
	UserRole    string  `json:"user_role"` // "player", "gm", or "both"

	// Current phase information
	CurrentPhaseID       *int32     `json:"current_phase_id,omitempty"`
	CurrentPhaseType     *string    `json:"current_phase_type,omitempty"`
	CurrentPhaseTitle    *string    `json:"current_phase_title,omitempty"`
	CurrentPhaseDeadline *time.Time `json:"current_phase_deadline,omitempty"`

	// Context-specific fields
	HasPendingAction    bool `json:"has_pending_action"`
	PendingApplications int  `json:"pending_applications"`
	UnreadMessages      int  `json:"unread_messages"`

	// Urgency indicators (calculated by service layer)
	IsUrgent       bool   `json:"is_urgent"`       // Deadline <24h or pending action
	DeadlineStatus string `json:"deadline_status"` // "critical", "warning", "normal"

	// Metadata
	UpdatedAt time.Time `json:"updated_at"`
	CreatedAt time.Time `json:"created_at"`
}

// DashboardMessage represents a recent message preview for the dashboard.
type DashboardMessage struct {
	MessageID     int32     `json:"message_id"`
	GameID        int32     `json:"game_id"`
	GameTitle     string    `json:"game_title"`
	AuthorName    string    `json:"author_name"`
	CharacterName *string   `json:"character_name,omitempty"`
	Content       string    `json:"content"` // Truncated to ~100 chars
	MessageType   string    `json:"message_type"`
	PhaseID       *int32    `json:"phase_id,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

// DashboardDeadline represents an upcoming phase deadline.
type DashboardDeadline struct {
	PhaseID              int32     `json:"phase_id"`
	GameID               int32     `json:"game_id"`
	GameTitle            string    `json:"game_title"`
	PhaseType            string    `json:"phase_type"`
	PhaseTitle           string    `json:"phase_title"`
	PhaseNumber          int32     `json:"phase_number"`
	EndTime              time.Time `json:"end_time"`
	HasPendingSubmission bool      `json:"has_pending_submission"`
	HoursRemaining       int       `json:"hours_remaining"` // Calculated by service
}

// CalculateDeadlineStatus determines urgency level based on hours remaining.
// Returns: "critical" (<6h), "warning" (6-24h), or "normal" (>24h)
func CalculateDeadlineStatus(deadline time.Time) string {
	hoursRemaining := time.Until(deadline).Hours()

	if hoursRemaining < 6 {
		return "critical"
	} else if hoursRemaining < 24 {
		return "warning"
	}
	return "normal"
}

// IsGameUrgent determines if a game should be marked as urgent.
// A game is urgent if it has a deadline <24h AND the user has a pending action.
func IsGameUrgent(hasPendingAction bool, deadline *time.Time) bool {
	if deadline == nil {
		return false
	}

	hoursRemaining := time.Until(*deadline).Hours()
	return hasPendingAction && hoursRemaining < 24
}

// TruncateContent truncates message content to a specified length for previews.
// Adds "..." if content is truncated.
func TruncateContent(content string, maxLength int) string {
	if len(content) <= maxLength {
		return content
	}

	// Try to truncate at a word boundary
	truncated := content[:maxLength]
	lastSpace := maxLength - 1
	for i := maxLength - 1; i >= maxLength-20 && i >= 0; i-- {
		if content[i] == ' ' {
			lastSpace = i
			break
		}
	}

	if lastSpace > 0 {
		truncated = content[:lastSpace]
	}

	return truncated + "..."
}
