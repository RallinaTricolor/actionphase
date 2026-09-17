package core

import "time"

// DashboardData represents the complete dashboard view for a user.
// It aggregates games, recent activity, and upcoming deadlines.
type DashboardData struct {
	UserID   int32 `json:"user_id"`
	HasGames bool  `json:"has_games"`
	// nullable:"false" on all six: groupGamesByRole make()s its four return
	// values with an explicit "ensure they serialize as [] not null" comment,
	// and transformMessages / transformDeadlines both make(...,0,len). None can
	// be nil, so without the tag huma's DefaultArrayNullable would force dead
	// `?? []` handling at every .map() and .length site on the dashboard.
	PlayerGames         []*DashboardGameCard `json:"player_games" nullable:"false"`
	GMGames             []*DashboardGameCard `json:"gm_games" nullable:"false"`
	AudienceGames       []*DashboardGameCard `json:"audience_games" nullable:"false"`
	MixedRoleGames      []*DashboardGameCard `json:"mixed_role_games" nullable:"false"`
	RecentMessages      []*DashboardMessage  `json:"recent_messages" nullable:"false"`
	UpcomingDeadlines   []*DashboardDeadline `json:"upcoming_deadlines" nullable:"false"`
	UnreadNotifications int                  `json:"unread_notifications"`
	NotificationsByType map[string]int       `json:"notifications_by_type"`
}

// DashboardGameCard represents a game card on the dashboard.
// It includes context-specific information based on user's role and game state.
type DashboardGameCard struct {
	GameID      int32     `json:"game_id"`
	Title       string    `json:"title"`
	Description *string   `json:"description,omitempty"`
	State       GameState `json:"state"`
	Genre       *string   `json:"genre,omitempty"`
	GMUserID    int32     `json:"gm_user_id"`
	GMUsername  string    `json:"gm_username"`
	UserRole    string    `json:"user_role"` // "player", "gm", or "both"

	// Current phase information
	CurrentPhaseID       *int32     `json:"current_phase_id,omitempty"`
	CurrentPhaseType     *string    `json:"current_phase_type,omitempty"`
	CurrentPhaseTitle    *string    `json:"current_phase_title,omitempty"`
	CurrentPhaseDeadline *time.Time `json:"current_phase_deadline,omitempty"`

	// Context-specific fields
	HasPendingAction    bool `json:"has_pending_action"`
	PendingApplications int  `json:"pending_applications"`
	UnreadComments      int  `json:"unread_comments"`
	UnvotedPolls        int  `json:"unvoted_polls"`

	// Urgency indicators (calculated by service layer)
	IsUrgent bool `json:"is_urgent"` // Deadline <24h or pending action
	// Values come from CalculateDeadlineStatus below, which has exactly these
	// three returns. Tagged so the generated TypeScript keeps the union the
	// hand-written type carried instead of widening to bare string.
	DeadlineStatus string `json:"deadline_status" enum:"critical,warning,normal"`

	// Metadata
	UpdatedAt time.Time `json:"updated_at"`
	CreatedAt time.Time `json:"created_at"`
}

// DashboardMessage represents a recent message preview for the dashboard.
type DashboardMessage struct {
	MessageID     int32   `json:"message_id"`
	GameID        int32   `json:"game_id"`
	GameTitle     string  `json:"game_title"`
	AuthorName    string  `json:"author_name"`
	CharacterName *string `json:"character_name,omitempty"`
	Content       string  `json:"content"` // Truncated to ~100 chars
	// Pinned by the message_type Postgres ENUM (migration 20251015165715).
	MessageType string    `json:"message_type" enum:"post,comment,private_message"`
	PhaseID     *int32    `json:"phase_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// DashboardDeadline represents an upcoming deadline (phase or arbitrary).
type DashboardDeadline struct {
	DeadlineType         string    `json:"deadline_type"` // "phase" or "deadline"
	SourceID             int32     `json:"source_id"`     // phase_id or game_deadline id
	PhaseID              int32     `json:"phase_id"`
	GameID               int32     `json:"game_id"`
	GameTitle            string    `json:"game_title"`
	Title                string    `json:"title"` // display title for all deadline types
	PhaseType            string    `json:"phase_type"`
	PhaseTitle           string    `json:"phase_title"`
	PhaseNumber          int32     `json:"phase_number"`
	EndTime              time.Time `json:"end_time"`
	HasPendingSubmission bool      `json:"has_pending_submission"`
	HoursRemaining       int       `json:"hours_remaining"`
}

// UnifiedDeadline aggregates all deadline types (arbitrary, phase, and poll) into a single view.
// This provides a complete picture of all time-sensitive items across different deadline sources.
type UnifiedDeadline struct {
	DeadlineType     string    `json:"deadline_type"`      // "deadline", "phase", or "poll"
	SourceID         int32     `json:"source_id"`          // ID from the source table
	Title            string    `json:"title"`              // Deadline title or phase/poll question
	Description      string    `json:"description"`        // Deadline description
	Deadline         time.Time `json:"deadline"`           // When the deadline expires
	GameID           int32     `json:"game_id"`            // Associated game
	PhaseID          *int32    `json:"phase_id,omitempty"` // NULL for arbitrary deadlines
	PollID           *int32    `json:"poll_id,omitempty"`  // NULL for non-poll deadlines
	IsSystemDeadline bool      `json:"is_system_deadline"` // true for phase deadlines (can't be deleted)
}

// CalculateDeadlineStatus determines urgency level based on hours remaining.
// Returns: "critical" (<1h), "warning" (1-3h), or "normal" (>3h)
func CalculateDeadlineStatus(deadline time.Time) string {
	hoursRemaining := time.Until(deadline).Hours()

	if hoursRemaining < 1 {
		return "critical"
	} else if hoursRemaining < 3 {
		return "warning"
	}
	return "normal"
}

// IsGameUrgent determines if a game should be marked as urgent.
// A game is urgent if it has a deadline <3h AND the user has a pending action.
func IsGameUrgent(hasPendingAction bool, deadline *time.Time) bool {
	if deadline == nil {
		return false
	}

	hoursRemaining := time.Until(*deadline).Hours()
	return hasPendingAction && hoursRemaining < 3
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
