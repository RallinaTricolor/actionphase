package games

import (
	"net/http"
	"time"
)

// GameResponse represents a basic game response
type GameResponse struct {
	ID                  int32      `json:"id"`
	Title               string     `json:"title"`
	Description         string     `json:"description"`
	GMUserID            int32      `json:"gm_user_id"`
	State               string     `json:"state"`
	Genre               string     `json:"genre,omitempty"`
	StartDate           *time.Time `json:"start_date,omitempty"`
	EndDate             *time.Time `json:"end_date,omitempty"`
	RecruitmentDeadline *time.Time `json:"recruitment_deadline,omitempty"`
	MaxPlayers          int32      `json:"max_players,omitempty"`
	IsAnonymous         bool       `json:"is_anonymous"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

func (rd *GameResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// GameWithDetailsResponse represents a game response with additional details
type GameWithDetailsResponse struct {
	ID                  int32      `json:"id"`
	Title               string     `json:"title"`
	Description         string     `json:"description"`
	GMUserID            int32      `json:"gm_user_id"`
	GMUsername          string     `json:"gm_username,omitempty"`
	State               string     `json:"state"`
	Genre               string     `json:"genre,omitempty"`
	StartDate           *time.Time `json:"start_date,omitempty"`
	EndDate             *time.Time `json:"end_date,omitempty"`
	RecruitmentDeadline *time.Time `json:"recruitment_deadline,omitempty"`
	MaxPlayers          int32      `json:"max_players,omitempty"`
	IsAnonymous         bool       `json:"is_anonymous"`
	CurrentPlayers      int64      `json:"current_players"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

func (rd *GameWithDetailsResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// GameApplicationResponse represents a game application
type GameApplicationResponse struct {
	ID               int32      `json:"id"`
	GameID           int32      `json:"game_id"`
	UserID           int32      `json:"user_id"`
	Username         string     `json:"username,omitempty"`
	Email            string     `json:"email,omitempty"`
	Role             string     `json:"role"`
	Message          string     `json:"message,omitempty"`
	Status           string     `json:"status"`
	AppliedAt        time.Time  `json:"applied_at"`
	ReviewedAt       *time.Time `json:"reviewed_at,omitempty"`
	ReviewedByUserID *int32     `json:"reviewed_by_user_id,omitempty"`
}

func (rd *GameApplicationResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}
