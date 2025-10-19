package characters

import (
	"net/http"
	"time"
)

// CharacterResponse represents a character response
type CharacterResponse struct {
	ID            int32     `json:"id"`
	GameID        int32     `json:"game_id"`
	UserID        *int32    `json:"user_id,omitempty"`
	Name          string    `json:"name"`
	CharacterType string    `json:"character_type"`
	Status        string    `json:"status"`
	AvatarURL     *string   `json:"avatar_url,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (rd *CharacterResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// CharacterWithUserResponse represents a character response with user details
type CharacterWithUserResponse struct {
	ID            int32     `json:"id"`
	GameID        int32     `json:"game_id"`
	UserID        *int32    `json:"user_id,omitempty"`
	Username      *string   `json:"username,omitempty"`
	Name          string    `json:"name"`
	CharacterType string    `json:"character_type"`
	Status        string    `json:"status"`
	AvatarURL     *string   `json:"avatar_url,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (rd *CharacterWithUserResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

// CharacterDataResponse represents a character data field response
type CharacterDataResponse struct {
	ID          int32     `json:"id"`
	CharacterID int32     `json:"character_id"`
	ModuleType  string    `json:"module_type"`
	FieldName   string    `json:"field_name"`
	FieldValue  string    `json:"field_value,omitempty"`
	FieldType   string    `json:"field_type"`
	IsPublic    bool      `json:"is_public"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (rd *CharacterDataResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}
