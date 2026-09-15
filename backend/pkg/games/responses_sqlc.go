package games

import (
	"time"

	models "actionphase/pkg/db/models"
)

// Hand-written response DTOs for the endpoints that used to return sqlc models
// directly.
//
// pgtype marshals to clean scalars at runtime, but huma builds its OpenAPI
// schemas by reflecting over Go fields, so every nullable column was documented
// as a {Valid, ...} wrapper object. As in pkg/polls and pkg/conversations,
// nullable columns are *T *without* omitempty so the explicit nulls the current
// responses emit (`removed_at: null`, `removed_by_user_id: null`) are preserved.

// GameParticipantResponse is a participant row.
type GameParticipantResponse struct {
	ID              int32      `json:"id"`
	GameID          int32      `json:"game_id"`
	UserID          int32      `json:"user_id"`
	Role            string     `json:"role"`
	Status          *string    `json:"status"`
	JoinedAt        time.Time  `json:"joined_at"`
	RemovedAt       *time.Time `json:"removed_at"`
	RemovedByUserID *int32     `json:"removed_by_user_id"`
	IsFormerPlayer  bool       `json:"is_former_player"`
}

// GameLootTableResponse is a loot table row.
type GameLootTableResponse struct {
	ID        int32     `json:"id"`
	GameID    int32     `json:"game_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// GameLootTableContentResponse is one entry in a loot table.
type GameLootTableContentResponse struct {
	ID          int32   `json:"id"`
	LootTableID int32   `json:"loot_table_id"`
	Name        string  `json:"name"`
	Data        *string `json:"data"`
}

func toGameParticipantResponse(p *models.GameParticipant) *GameParticipantResponse {
	if p == nil {
		return nil
	}
	r := &GameParticipantResponse{
		ID:             p.ID,
		GameID:         p.GameID,
		UserID:         p.UserID,
		Role:           p.Role,
		JoinedAt:       p.JoinedAt.Time,
		IsFormerPlayer: p.IsFormerPlayer,
	}
	status := p.Status
	r.Status = &status
	if p.RemovedAt.Valid {
		removedAt := p.RemovedAt.Time
		r.RemovedAt = &removedAt
	}
	if p.RemovedByUserID.Valid {
		removedBy := p.RemovedByUserID.Int32
		r.RemovedByUserID = &removedBy
	}
	return r
}

func toGameLootTableResponse(t *models.GameLootTable) *GameLootTableResponse {
	if t == nil {
		return nil
	}
	return &GameLootTableResponse{
		ID:        t.ID,
		GameID:    t.GameID,
		Name:      t.Name,
		CreatedAt: t.CreatedAt.Time,
		UpdatedAt: t.UpdatedAt.Time,
	}
}

func toGameLootTableContentResponse(c *models.GameLootTableContent) *GameLootTableContentResponse {
	if c == nil {
		return nil
	}
	r := &GameLootTableContentResponse{
		ID:          c.ID,
		LootTableID: c.LootTableID,
		Name:        c.Name,
	}
	if c.Data.Valid {
		data := c.Data.String
		r.Data = &data
	}
	return r
}
