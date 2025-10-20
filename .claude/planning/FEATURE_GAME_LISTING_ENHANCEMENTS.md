# Feature Plan: Game Listing Enhancements

**Created**: 2025-10-19
**Status**: Planning
**Priority**: P0 (High Priority - Must Have)
**Effort Estimate**: 5-7 days
**Sprint**: Sprint 1 (Week 2-3)
**Owner**: Development Team
**Related Plans**: `FEATURE_DASHBOARD_REDESIGN.md`, `FEATURE_SMART_TAB_NAVIGATION.md`

---

## 1. Overview

### 1.1 Problem Statement

**Current Pain Points:**
- Users cannot filter or sort games beyond "Recruiting" vs "All Games"
- Active games the user is participating in are not visually distinguished
- No way to find games by specific criteria (genre, player count, start date)
- Games with approaching deadlines are not highlighted
- Users in multiple games have difficulty finding specific games quickly
- No indication of which games have recent activity

**User Impact:**
- **Discovery Problem**: Players can't find games matching their preferences (genre, schedule, etc.)
- **Navigation Problem**: Active players can't quickly locate their ongoing games among many others
- **Context Problem**: No visual indicators for urgency (deadlines, pending applications, etc.)
- **Efficiency Problem**: Users must scroll through entire list to find relevant games

**Business Impact:**
- Lower game discovery and application rates
- Reduced player engagement due to poor navigation experience
- Missed deadlines due to lack of visual prominence
- Frustration for users in multiple games (GMs especially)

### 1.2 Goals and Success Criteria

**Primary Goals:**
1. Enable users to filter games by multiple criteria simultaneously
2. Provide sortable game listings for better discovery
3. Visually highlight user's active games and approaching deadlines
4. Improve game card information density and scannability

**Success Metrics:**
- **Filter Usage**: >40% of game browse sessions use at least one filter
- **Time to Find Game**: Average time to locate a specific game reduced by 50%
- **Application Rate**: Applications to games increase by 25% (better discovery)
- **User Satisfaction**: "Finding games" rating >4/5 in surveys
- **Active Player Retention**: Users in multiple games spend less time navigating

**Out of Scope (Future Enhancements):**
- Saved filter preferences across sessions (P3)
- Advanced search with full-text query (P3)
- Game recommendations based on user history (P4)
- Pagination (only needed if >50 public games exist)

### 1.3 User Stories

**Epic**: As a user browsing games, I want powerful filtering and sorting so I can quickly find games that match my interests and schedule.

**User Stories:**

1. **Filter by Game State**
   *As a player*, I want to filter games by state (recruiting, in_progress, etc.) so I can see only games I can join or follow.
   **Acceptance Criteria:**
   - Multi-select filter for game states
   - Visual badges showing selected filters
   - Clear filter counts (e.g., "Recruiting (12)")

2. **Filter by Genre**
   *As a genre enthusiast*, I want to filter by genre so I can find games in my favorite settings.
   **Acceptance Criteria:**
   - Dropdown or multi-select for genres
   - Shows all unique genres from existing games
   - "No genre specified" option

3. **Filter by Player Availability**
   *As a new player*, I want to see only games with open spots so I don't waste time on full games.
   **Acceptance Criteria:**
   - Toggle for "Has open spots"
   - Shows current_players / max_players clearly on cards

4. **Filter by Participation Status**
   *As an active player*, I want to filter to "My Games" so I can focus on games I'm already in.
   **Acceptance Criteria:**
   - Quick filter buttons: "All Games", "My Games", "Applied", "Not Joined"
   - "My Games" shows games where user is GM or participant
   - "Applied" shows games with pending applications

5. **Sort Games**
   *As a user*, I want to sort games by various criteria so I can prioritize which to explore.
   **Acceptance Criteria:**
   - Sort options: Recent Activity, Recently Created, Starting Soon, Open Spots, Alphabetical
   - Sort direction toggle (ascending/descending)
   - Persists during filter changes

6. **Visual Highlighting**
   *As a GM or active player*, I want my games highlighted so I can quickly scan to relevant content.
   **Acceptance Criteria:**
   - Distinct visual treatment for user's games (border, badge, or background)
   - Deadline urgency indicators (color-coded: critical <24h, warning <3d, normal)
   - Recent activity badge (new within 24h)

7. **URL State Preservation**
   *As a user*, I want filter settings preserved in URL so I can bookmark or share game searches.
   **Acceptance Criteria:**
   - All filters and sort encoded in URL query params
   - Shareable links (e.g., `/games?state=recruiting&genre=Fantasy&sort=start_date`)
   - Browser back/forward navigation works correctly

---

## 2. Technical Design

### 2.1 Database Schema Changes

**No schema changes required** - existing `games` and `game_participants` tables have all necessary data.

**Indexes to Add** (for query performance):

```sql
-- Migration: XXX_add_game_listing_indexes.up.sql

-- Speed up filtering by state
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_state
ON games(state)
WHERE is_public = true;

-- Speed up filtering by genre
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_genre
ON games(genre)
WHERE is_public = true AND genre IS NOT NULL;

-- Speed up sorting by start_date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_start_date
ON games(start_date)
WHERE is_public = true AND start_date IS NOT NULL;

-- Speed up sorting by updated_at (recent activity)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_updated_at
ON games(updated_at DESC)
WHERE is_public = true;

-- Speed up finding user's games
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_participants_user_game
ON game_participants(user_id, game_id);
```

```sql
-- Migration: XXX_add_game_listing_indexes.down.sql

DROP INDEX CONCURRENTLY IF EXISTS idx_games_state;
DROP INDEX CONCURRENTLY IF EXISTS idx_games_genre;
DROP INDEX CONCURRENTLY IF EXISTS idx_games_start_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_games_updated_at;
DROP INDEX CONCURRENTLY IF EXISTS idx_game_participants_user_game;
```

### 2.2 Backend Implementation

#### 2.2.1 SQL Queries

**New Query File**: `backend/pkg/db/queries/games_listing.sql`

```sql
-- name: GetFilteredGames :many
-- Get games with filters, sorting, and user participation enrichment
SELECT
  g.id,
  g.title,
  g.description,
  g.gm_user_id,
  u.username as gm_username,
  g.state,
  g.genre,
  g.start_date,
  g.end_date,
  g.recruitment_deadline,
  g.max_players,
  g.is_public,
  g.is_anonymous,
  g.created_at,
  g.updated_at,

  -- Computed fields
  (SELECT COUNT(*) FROM game_participants WHERE game_id = g.id AND status = 'active') as current_players,

  -- User participation status (NULL if not logged in)
  CASE
    WHEN $1::int IS NULL THEN NULL
    WHEN g.gm_user_id = $1 THEN 'gm'
    WHEN EXISTS(SELECT 1 FROM game_participants WHERE game_id = g.id AND user_id = $1 AND status = 'active') THEN 'participant'
    WHEN EXISTS(SELECT 1 FROM game_applications WHERE game_id = g.id AND user_id = $1 AND status = 'pending') THEN 'applied'
    ELSE 'none'
  END as user_relationship,

  -- Current phase info for in-progress games
  (SELECT phase_type FROM game_phases WHERE game_id = g.id AND is_active = true) as current_phase_type,
  (SELECT end_time FROM game_phases WHERE game_id = g.id AND is_active = true) as current_phase_deadline,

  -- Deadline urgency calculation
  CASE
    WHEN g.state = 'recruitment' AND g.recruitment_deadline IS NOT NULL THEN
      CASE
        WHEN g.recruitment_deadline < NOW() + INTERVAL '24 hours' THEN 'critical'
        WHEN g.recruitment_deadline < NOW() + INTERVAL '3 days' THEN 'warning'
        ELSE 'normal'
      END
    WHEN g.state = 'in_progress' THEN
      CASE
        WHEN (SELECT end_time FROM game_phases WHERE game_id = g.id AND is_active = true) < NOW() + INTERVAL '24 hours' THEN 'critical'
        WHEN (SELECT end_time FROM game_phases WHERE game_id = g.id AND is_active = true) < NOW() + INTERVAL '3 days' THEN 'warning'
        ELSE 'normal'
      END
    ELSE 'normal'
  END as deadline_urgency,

  -- Recent activity flag (updated in last 24h)
  (g.updated_at > NOW() - INTERVAL '24 hours') as has_recent_activity

FROM games g
INNER JOIN users u ON g.gm_user_id = u.id
WHERE
  g.is_public = true

  -- Filter by states (optional array of states)
  AND ($2::text[] IS NULL OR g.state = ANY($2::text[]))

  -- Filter by genres (optional array of genres)
  AND ($3::text[] IS NULL OR g.genre = ANY($3::text[]))

  -- Filter by user participation (optional)
  AND (
    $4::text IS NULL OR
    ($4 = 'my_games' AND ($1::int IS NOT NULL AND (g.gm_user_id = $1 OR EXISTS(SELECT 1 FROM game_participants WHERE game_id = g.id AND user_id = $1 AND status = 'active')))) OR
    ($4 = 'applied' AND ($1::int IS NOT NULL AND EXISTS(SELECT 1 FROM game_applications WHERE game_id = g.id AND user_id = $1 AND status = 'pending'))) OR
    ($4 = 'not_joined' AND ($1::int IS NOT NULL AND g.gm_user_id != $1 AND NOT EXISTS(SELECT 1 FROM game_participants WHERE game_id = g.id AND user_id = $1)))
  )

  -- Filter by open spots
  AND (
    $5::boolean IS NULL OR
    ($5 = true AND (g.max_players IS NULL OR (SELECT COUNT(*) FROM game_participants WHERE game_id = g.id AND status = 'active') < g.max_players))
  )

ORDER BY
  -- Dynamic sorting based on $6 parameter
  CASE
    WHEN $6 = 'recent_activity' THEN g.updated_at
    WHEN $6 = 'created' THEN g.created_at
    WHEN $6 = 'start_date' THEN g.start_date
    ELSE g.updated_at
  END DESC NULLS LAST,

  CASE
    WHEN $6 = 'alphabetical' THEN g.title
    ELSE NULL
  END ASC NULLS LAST,

  -- Secondary sort by ID for consistency
  g.id DESC;

-- Parameters:
-- $1: user_id (int, nullable) - for participation enrichment
-- $2: states (text[], nullable) - array of game states to filter
-- $3: genres (text[], nullable) - array of genres to filter
-- $4: participation_filter (text, nullable) - 'my_games', 'applied', 'not_joined'
-- $5: has_open_spots (boolean, nullable) - only games with available spots
-- $6: sort_by (text) - 'recent_activity', 'created', 'start_date', 'alphabetical'
```

**Simplified Queries** (keep existing for backward compatibility):

```sql
-- name: GetPublicGames :many
-- Deprecated - use GetFilteredGames with no filters instead
SELECT /* existing query unchanged */;

-- name: GetRecruitingGames :many
-- Deprecated - use GetFilteredGames with states = ['recruitment'] instead
SELECT /* existing query unchanged */;
```

#### 2.2.2 Backend Models

**File**: `backend/pkg/core/models.go` (additions)

```go
// GameListingFilters represents filter criteria for game listing
type GameListingFilters struct {
	UserID              *int32   // For participation enrichment (nullable)
	States              []string // Filter by game states
	Genres              []string // Filter by genres
	ParticipationFilter *string  // 'my_games', 'applied', 'not_joined'
	HasOpenSpots        *bool    // Only games with available player spots
	SortBy              string   // 'recent_activity', 'created', 'start_date', 'alphabetical'
}

// EnrichedGameListItem extends GameListItem with user context and urgency
type EnrichedGameListItem struct {
	// Base game fields (from existing GameListItem)
	ID                   int32      `json:"id"`
	Title                string     `json:"title"`
	Description          string     `json:"description"`
	GMUserID             int32      `json:"gm_user_id"`
	GMUsername           string     `json:"gm_username"`
	State                string     `json:"state"`
	Genre                *string    `json:"genre,omitempty"`
	StartDate            *time.Time `json:"start_date,omitempty"`
	EndDate              *time.Time `json:"end_date,omitempty"`
	RecruitmentDeadline  *time.Time `json:"recruitment_deadline,omitempty"`
	MaxPlayers           *int32     `json:"max_players,omitempty"`
	IsPublic             bool       `json:"is_public"`
	IsAnonymous          bool       `json:"is_anonymous"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
	CurrentPlayers       int32      `json:"current_players"`

	// Enrichment fields
	UserRelationship     *string    `json:"user_relationship,omitempty"` // 'gm', 'participant', 'applied', 'none'
	CurrentPhaseType     *string    `json:"current_phase_type,omitempty"`
	CurrentPhaseDeadline *time.Time `json:"current_phase_deadline,omitempty"`
	DeadlineUrgency      string     `json:"deadline_urgency"` // 'critical', 'warning', 'normal'
	HasRecentActivity    bool       `json:"has_recent_activity"`
}

// GameListingMetadata provides context for the listing
type GameListingMetadata struct {
	TotalCount       int      `json:"total_count"`
	FilteredCount    int      `json:"filtered_count"`
	AvailableGenres  []string `json:"available_genres"`  // Unique genres from all public games
	AvailableStates  []string `json:"available_states"`  // Game states with at least one game
}

// GameListingResponse is the full response for listing endpoint
type GameListingResponse struct {
	Games    []*EnrichedGameListItem `json:"games"`
	Metadata GameListingMetadata     `json:"metadata"`
}
```

#### 2.2.3 Service Layer

**File**: `backend/pkg/db/services/games/listing.go` (new file)

```go
package games

import (
	"context"
	"database/sql"
	"fmt"

	"actionphase/backend/pkg/core"
	"actionphase/backend/pkg/db/sqlc"
)

// GetFilteredGames retrieves games with filters, sorting, and user enrichment
func (s *GamesService) GetFilteredGames(ctx context.Context, filters core.GameListingFilters) (*core.GameListingResponse, error) {
	log := s.logger.With(
		"method", "GetFilteredGames",
		"user_id", filters.UserID,
		"states", filters.States,
		"genres", filters.Genres,
		"participation_filter", filters.ParticipationFilter,
		"has_open_spots", filters.HasOpenSpots,
		"sort_by", filters.SortBy,
	)

	log.Info("Fetching filtered game listing")

	// Convert filters to nullable SQL types
	var userIDParam sql.NullInt32
	if filters.UserID != nil {
		userIDParam = sql.NullInt32{Int32: *filters.UserID, Valid: true}
	}

	var participationFilterParam sql.NullString
	if filters.ParticipationFilter != nil {
		participationFilterParam = sql.NullString{String: *filters.ParticipationFilter, Valid: true}
	}

	var hasOpenSpotsParam sql.NullBool
	if filters.HasOpenSpots != nil {
		hasOpenSpotsParam = sql.NullBool{Bool: *filters.HasOpenSpots, Valid: true}
	}

	// Default sort to recent_activity
	sortBy := filters.SortBy
	if sortBy == "" {
		sortBy = "recent_activity"
	}

	// Execute query
	rows, err := s.queries.GetFilteredGames(ctx, sqlc.GetFilteredGamesParams{
		UserID:              userIDParam,
		States:              filters.States,
		Genres:              filters.Genres,
		ParticipationFilter: participationFilterParam,
		HasOpenSpots:        hasOpenSpotsParam,
		SortBy:              sortBy,
	})
	if err != nil {
		log.Error("Failed to fetch filtered games", "error", err)
		return nil, fmt.Errorf("failed to fetch games: %w", err)
	}

	// Convert to domain models
	games := make([]*core.EnrichedGameListItem, len(rows))
	for i, row := range rows {
		games[i] = s.enrichedGameFromRow(row)
	}

	// Fetch metadata (available filters)
	metadata, err := s.getListingMetadata(ctx)
	if err != nil {
		log.Warn("Failed to fetch listing metadata", "error", err)
		// Don't fail the entire request, just use empty metadata
		metadata = core.GameListingMetadata{
			TotalCount:      len(games),
			FilteredCount:   len(games),
			AvailableGenres: []string{},
			AvailableStates: []string{},
		}
	} else {
		metadata.FilteredCount = len(games)
	}

	log.Info("Filtered games retrieved successfully", "count", len(games))

	return &core.GameListingResponse{
		Games:    games,
		Metadata: metadata,
	}, nil
}

// getListingMetadata fetches available genres and states for filter dropdowns
func (s *GamesService) getListingMetadata(ctx context.Context) (core.GameListingMetadata, error) {
	// Get total count of public games
	totalCount, err := s.queries.CountPublicGames(ctx)
	if err != nil {
		return core.GameListingMetadata{}, err
	}

	// Get unique genres
	genres, err := s.queries.GetAvailableGenres(ctx)
	if err != nil {
		return core.GameListingMetadata{}, err
	}

	// Get states that have at least one game
	states, err := s.queries.GetAvailableStates(ctx)
	if err != nil {
		return core.GameListingMetadata{}, err
	}

	return core.GameListingMetadata{
		TotalCount:      int(totalCount),
		AvailableGenres: genres,
		AvailableStates: states,
	}, nil
}

// enrichedGameFromRow converts DB row to EnrichedGameListItem
func (s *GamesService) enrichedGameFromRow(row sqlc.GetFilteredGamesRow) *core.EnrichedGameListItem {
	return &core.EnrichedGameListItem{
		ID:                   row.ID,
		Title:                row.Title,
		Description:          row.Description,
		GMUserID:             row.GmUserID,
		GMUsername:           row.GmUsername,
		State:                row.State,
		Genre:                core.NullStringPtr(row.Genre),
		StartDate:            core.NullTimePtr(row.StartDate),
		EndDate:              core.NullTimePtr(row.EndDate),
		RecruitmentDeadline:  core.NullTimePtr(row.RecruitmentDeadline),
		MaxPlayers:           core.NullInt32Ptr(row.MaxPlayers),
		IsPublic:             row.IsPublic,
		IsAnonymous:          row.IsAnonymous,
		CreatedAt:            row.CreatedAt,
		UpdatedAt:            row.UpdatedAt,
		CurrentPlayers:       row.CurrentPlayers,
		UserRelationship:     core.NullStringPtr(row.UserRelationship),
		CurrentPhaseType:     core.NullStringPtr(row.CurrentPhaseType),
		CurrentPhaseDeadline: core.NullTimePtr(row.CurrentPhaseDeadline),
		DeadlineUrgency:      row.DeadlineUrgency,
		HasRecentActivity:    row.HasRecentActivity,
	}
}
```

**Additional Queries Needed** (add to `games_listing.sql`):

```sql
-- name: CountPublicGames :one
SELECT COUNT(*) FROM games WHERE is_public = true;

-- name: GetAvailableGenres :many
SELECT DISTINCT genre
FROM games
WHERE is_public = true AND genre IS NOT NULL
ORDER BY genre ASC;

-- name: GetAvailableStates :many
SELECT DISTINCT state
FROM games
WHERE is_public = true
ORDER BY state ASC;
```

#### 2.2.4 API Handler

**File**: `backend/pkg/games/api_listing.go` (new file)

```go
package games

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"actionphase/backend/pkg/core"
	"actionphase/backend/pkg/middleware"
)

// HandleGetFilteredGames handles GET /api/v1/games/filtered
// Supports query parameters for filtering and sorting
func (h *GamesHandler) HandleGetFilteredGames(w http.ResponseWriter, r *http.Request) {
	log := h.logger.With("handler", "HandleGetFilteredGames")

	// Parse query parameters
	query := r.URL.Query()

	filters := core.GameListingFilters{
		SortBy: query.Get("sort_by"),
	}

	// Get user ID from context if authenticated
	userID := middleware.GetUserIDFromContext(r.Context())
	if userID != nil {
		filters.UserID = userID
	}

	// Parse state filters (comma-separated)
	if statesParam := query.Get("states"); statesParam != "" {
		filters.States = strings.Split(statesParam, ",")
	}

	// Parse genre filters (comma-separated)
	if genresParam := query.Get("genres"); genresParam != "" {
		filters.Genres = strings.Split(genresParam, ",")
	}

	// Parse participation filter
	if participationParam := query.Get("participation"); participationParam != "" {
		filters.ParticipationFilter = &participationParam
	}

	// Parse has_open_spots filter
	if openSpotsParam := query.Get("has_open_spots"); openSpotsParam != "" {
		hasOpenSpots, err := strconv.ParseBool(openSpotsParam)
		if err == nil {
			filters.HasOpenSpots = &hasOpenSpots
		} else {
			log.Warn("Invalid has_open_spots parameter", "value", openSpotsParam)
		}
	}

	// Fetch filtered games
	result, err := h.gamesService.GetFilteredGames(r.Context(), filters)
	if err != nil {
		log.Error("Failed to get filtered games", "error", err)
		http.Error(w, "Failed to fetch games", http.StatusInternalServerError)
		return
	}

	// Return JSON response
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Error("Failed to encode response", "error", err)
	}

	log.Info("Filtered games returned", "count", len(result.Games), "metadata", result.Metadata)
}
```

**Update Routing** (`backend/pkg/games/api.go`):

```go
func (h *GamesHandler) RegisterRoutes(r chi.Router) {
	// ... existing routes ...

	// New filtered listing endpoint
	r.Get("/api/v1/games/filtered", h.HandleGetFilteredGames)
}
```

### 2.3 API Specification

#### 2.3.1 Endpoint: Get Filtered Games

**Request:**
```
GET /api/v1/games/filtered?states=recruitment,in_progress&genres=Fantasy,Sci-Fi&participation=my_games&has_open_spots=true&sort_by=recent_activity
```

**Query Parameters:**
- `states` (string, optional): Comma-separated list of game states (e.g., `recruitment,in_progress`)
- `genres` (string, optional): Comma-separated list of genres (e.g., `Fantasy,Sci-Fi`)
- `participation` (string, optional): Filter by user relationship - `my_games`, `applied`, `not_joined`
- `has_open_spots` (boolean, optional): `true` to show only games with available player slots
- `sort_by` (string, optional): Sort criteria - `recent_activity` (default), `created`, `start_date`, `alphabetical`

**Authentication**: Optional (enriches response with user participation if authenticated)

**Response**: `200 OK`
```json
{
  "games": [
    {
      "id": 42,
      "title": "Dragons of Autumn Twilight",
      "description": "A classic Dragonlance adventure...",
      "gm_user_id": 123,
      "gm_username": "dungeon_master",
      "state": "recruitment",
      "genre": "Fantasy",
      "start_date": "2026-02-01T00:00:00Z",
      "end_date": null,
      "recruitment_deadline": "2026-01-25T23:59:59Z",
      "max_players": 6,
      "is_public": true,
      "is_anonymous": false,
      "created_at": "2025-10-15T10:00:00Z",
      "updated_at": "2025-10-19T08:30:00Z",
      "current_players": 3,
      "user_relationship": "applied",
      "current_phase_type": null,
      "current_phase_deadline": null,
      "deadline_urgency": "warning",
      "has_recent_activity": true
    },
    {
      "id": 17,
      "title": "Cyberpunk Night City",
      "description": "High-tech, low-life adventures...",
      "gm_user_id": 99,
      "gm_username": "netrunner_gm",
      "state": "in_progress",
      "genre": "Sci-Fi",
      "start_date": "2025-09-01T00:00:00Z",
      "recruitment_deadline": null,
      "max_players": 4,
      "current_players": 4,
      "user_relationship": "participant",
      "current_phase_type": "action",
      "current_phase_deadline": "2025-10-20T23:59:59Z",
      "deadline_urgency": "critical",
      "has_recent_activity": false
    }
  ],
  "metadata": {
    "total_count": 47,
    "filtered_count": 2,
    "available_genres": ["Fantasy", "Sci-Fi", "Horror", "Historical", "Modern"],
    "available_states": ["recruitment", "in_progress", "character_creation", "completed"]
  }
}
```

**Error Responses:**
- `500 Internal Server Error`: Database error

#### 2.3.2 Backward Compatibility

**Existing endpoints remain unchanged:**
- `GET /api/v1/games/public` - Returns all public games (no filters)
- `GET /api/v1/games/recruiting` - Returns only recruiting games

**Migration Path:**
- Frontend will switch to new `/games/filtered` endpoint
- Old endpoints kept for backward compatibility (mobile app, external integrations)
- Can deprecate old endpoints in future version

### 2.4 Frontend Implementation

#### 2.4.1 Types

**File**: `frontend/src/types/games.ts` (additions)

```typescript
// Enriched game list item with user context
export interface EnrichedGameListItem extends GameListItem {
  current_players: number;
  user_relationship?: 'gm' | 'participant' | 'applied' | 'none';
  current_phase_type?: 'action' | 'common_room';
  current_phase_deadline?: string;
  deadline_urgency: 'critical' | 'warning' | 'normal';
  has_recent_activity: boolean;
}

// Listing metadata
export interface GameListingMetadata {
  total_count: number;
  filtered_count: number;
  available_genres: string[];
  available_states: GameState[];
}

// Full listing response
export interface GameListingResponse {
  games: EnrichedGameListItem[];
  metadata: GameListingMetadata;
}

// Filter parameters
export interface GameListingFilters {
  states?: GameState[];
  genres?: string[];
  participation?: 'my_games' | 'applied' | 'not_joined';
  has_open_spots?: boolean;
  sort_by?: 'recent_activity' | 'created' | 'start_date' | 'alphabetical';
}
```

#### 2.4.2 API Client

**File**: `frontend/src/lib/api/games.ts` (additions)

```typescript
export class GamesApi extends BaseApiClient {
  // ... existing methods ...

  async getFilteredGames(filters: GameListingFilters) {
    // Build query string from filters
    const params = new URLSearchParams();

    if (filters.states && filters.states.length > 0) {
      params.append('states', filters.states.join(','));
    }
    if (filters.genres && filters.genres.length > 0) {
      params.append('genres', filters.genres.join(','));
    }
    if (filters.participation) {
      params.append('participation', filters.participation);
    }
    if (filters.has_open_spots !== undefined) {
      params.append('has_open_spots', String(filters.has_open_spots));
    }
    if (filters.sort_by) {
      params.append('sort_by', filters.sort_by);
    }

    return this.client.get<GameListingResponse>(
      `/api/v1/games/filtered?${params.toString()}`
    );
  }
}
```

#### 2.4.3 Custom Hook

**File**: `frontend/src/hooks/useGameListing.ts` (new file)

```typescript
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../lib/api';
import type { GameListingFilters, GameState } from '../types/games';

/**
 * Hook for managing game listing with URL-synced filters
 * Reads and writes filter state to URL query parameters
 */
export function useGameListing() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse filters from URL
  const filters: GameListingFilters = {
    states: searchParams.get('states')?.split(',') as GameState[] | undefined,
    genres: searchParams.get('genres')?.split(','),
    participation: searchParams.get('participation') as 'my_games' | 'applied' | 'not_joined' | undefined,
    has_open_spots: searchParams.get('has_open_spots') === 'true' ? true : undefined,
    sort_by: (searchParams.get('sort_by') as any) || 'recent_activity',
  };

  // Fetch games with filters
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['games', 'filtered', filters],
    queryFn: () => apiClient.games.getFilteredGames(filters),
    staleTime: 30000, // 30 seconds
  });

  // Update filters and sync to URL
  const updateFilters = (newFilters: Partial<GameListingFilters>) => {
    const params = new URLSearchParams(searchParams);

    // Update or remove each filter
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.join(','));
      } else {
        params.set(key, String(value));
      }
    });

    setSearchParams(params);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchParams({});
  };

  // Quick filter presets
  const setQuickFilter = (preset: 'all' | 'my_games' | 'recruiting' | 'in_progress') => {
    switch (preset) {
      case 'all':
        clearFilters();
        break;
      case 'my_games':
        updateFilters({ participation: 'my_games' });
        break;
      case 'recruiting':
        updateFilters({ states: ['recruitment'] });
        break;
      case 'in_progress':
        updateFilters({ states: ['in_progress'] });
        break;
    }
  };

  return {
    games: data?.data.games || [],
    metadata: data?.data.metadata,
    filters,
    isLoading,
    error,
    updateFilters,
    clearFilters,
    setQuickFilter,
    refetch,
  };
}
```

#### 2.4.4 Component Hierarchy

```
GamesPage (updated)
├── FilterBar (new)
│   ├── QuickFilterButtons (new)
│   ├── StateFilter (new)
│   ├── GenreFilter (new)
│   └── SortDropdown (new)
├── ActiveFiltersDisplay (new)
└── EnhancedGamesList (new, replaces GamesList)
    └── EnhancedGameCard (new, replaces basic cards)
        ├── UrgencyBadge (new)
        ├── UserRelationshipBadge (new)
        └── RecentActivityIndicator (new)
```

#### 2.4.5 Component: FilterBar

**File**: `frontend/src/components/GameListing/FilterBar.tsx` (new)

```typescript
import { useState } from 'react';
import type { GameListingFilters, GameListingMetadata, GameState } from '../../types/games';

interface FilterBarProps {
  filters: GameListingFilters;
  metadata?: GameListingMetadata;
  onUpdateFilters: (filters: Partial<GameListingFilters>) => void;
  onClearFilters: () => void;
}

export function FilterBar({ filters, metadata, onUpdateFilters, onClearFilters }: FilterBarProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const hasActiveFilters = !!(
    filters.states?.length ||
    filters.genres?.length ||
    filters.participation ||
    filters.has_open_spots
  );

  // Handle state filter toggle
  const toggleStateFilter = (state: GameState) => {
    const currentStates = filters.states || [];
    const newStates = currentStates.includes(state)
      ? currentStates.filter(s => s !== state)
      : [...currentStates, state];

    onUpdateFilters({ states: newStates.length > 0 ? newStates : undefined });
  };

  // Handle genre filter toggle
  const toggleGenreFilter = (genre: string) => {
    const currentGenres = filters.genres || [];
    const newGenres = currentGenres.includes(genre)
      ? currentGenres.filter(g => g !== genre)
      : [...currentGenres, genre];

    onUpdateFilters({ genres: newGenres.length > 0 ? newGenres : undefined });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      {/* Quick Filters Row */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium text-gray-700">Quick Filters:</span>
        <button
          onClick={() => onClearFilters()}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            !hasActiveFilters
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All Games
        </button>
        <button
          onClick={() => onUpdateFilters({ participation: 'my_games' })}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            filters.participation === 'my_games'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          My Games
        </button>
        <button
          onClick={() => onUpdateFilters({ states: ['recruitment'] })}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            filters.states?.includes('recruitment')
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Recruiting
        </button>
        <button
          onClick={() => onUpdateFilters({ has_open_spots: true })}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            filters.has_open_spots
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Open Spots
        </button>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-3"
      >
        {showAdvancedFilters ? '− Hide' : '+ Show'} Advanced Filters
      </button>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          {/* State Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Game State
            </label>
            <div className="flex flex-wrap gap-2">
              {metadata?.available_states.map((state) => (
                <button
                  key={state}
                  onClick={() => toggleStateFilter(state)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filters.states?.includes(state)
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                      : 'bg-gray-50 text-gray-600 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {state.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>

          {/* Genre Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Genre
            </label>
            <div className="flex flex-wrap gap-2">
              {metadata?.available_genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleGenreFilter(genre)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filters.genres?.includes(genre)
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                      : 'bg-gray-50 text-gray-600 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={filters.sort_by || 'recent_activity'}
              onChange={(e) => onUpdateFilters({ sort_by: e.target.value as any })}
              className="block w-full md:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="recent_activity">Recent Activity</option>
              <option value="created">Recently Created</option>
              <option value="start_date">Starting Soon</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
          <div className="text-sm text-gray-600">
            Showing {metadata?.filtered_count || 0} of {metadata?.total_count || 0} games
          </div>
          <button
            onClick={onClearFilters}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 2.4.6 Component: EnhancedGameCard

**File**: `frontend/src/components/GameListing/EnhancedGameCard.tsx` (new)

```typescript
import { formatDistanceToNow } from 'date-fns';
import type { EnrichedGameListItem } from '../../types/games';
import { GAME_STATE_LABELS, GAME_STATE_COLORS } from '../../types/games';

interface EnhancedGameCardProps {
  game: EnrichedGameListItem;
  onClick: () => void;
  onApplyClick?: () => void;
}

export function EnhancedGameCard({ game, onClick, onApplyClick }: EnhancedGameCardProps) {
  const isUserGame = game.user_relationship === 'gm' || game.user_relationship === 'participant';
  const hasApplied = game.user_relationship === 'applied';
  const hasOpenSpots = !game.max_players || game.current_players < game.max_players;

  // Determine deadline to display
  const deadline = game.current_phase_deadline || game.recruitment_deadline;

  return (
    <div
      className={`bg-white rounded-lg shadow-md border-2 transition-all hover:shadow-lg cursor-pointer ${
        isUserGame
          ? 'border-blue-400 bg-blue-50/30'
          : hasApplied
          ? 'border-yellow-400 bg-yellow-50/30'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={onClick}
    >
      {/* Card Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 flex-1">
            {game.title}
          </h3>

          {/* User Relationship Badge */}
          {game.user_relationship && game.user_relationship !== 'none' && (
            <span
              className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${
                game.user_relationship === 'gm'
                  ? 'bg-purple-100 text-purple-800'
                  : game.user_relationship === 'participant'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {game.user_relationship === 'gm' ? 'GM' : game.user_relationship === 'participant' ? 'Player' : 'Applied'}
            </span>
          )}
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* State Badge */}
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${GAME_STATE_COLORS[game.state]}`}>
            {GAME_STATE_LABELS[game.state]}
          </span>

          {/* Genre Badge */}
          {game.genre && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
              {game.genre}
            </span>
          )}

          {/* Recent Activity Indicator */}
          {game.has_recent_activity && (
            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              New Activity
            </span>
          )}

          {/* Deadline Urgency Badge */}
          {deadline && game.deadline_urgency !== 'normal' && (
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                game.deadline_urgency === 'critical'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-orange-100 text-orange-800'
              }`}
            >
              {game.deadline_urgency === 'critical' ? '⚠️ Urgent' : '⏰ Soon'}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{game.description}</p>

        {/* Game Info Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
          <div>
            <span className="font-medium">GM:</span> {game.gm_username}
          </div>
          <div>
            <span className="font-medium">Players:</span>{' '}
            {game.current_players}
            {game.max_players && ` / ${game.max_players}`}
            {hasOpenSpots && <span className="text-green-600 ml-1">✓ Open</span>}
          </div>

          {game.start_date && (
            <div className="col-span-2">
              <span className="font-medium">Starts:</span>{' '}
              {new Date(game.start_date).toLocaleDateString()}
            </div>
          )}

          {deadline && (
            <div className="col-span-2">
              <span className="font-medium">
                {game.current_phase_type ? 'Phase Deadline' : 'Application Deadline'}:
              </span>{' '}
              <span
                className={
                  game.deadline_urgency === 'critical'
                    ? 'text-red-600 font-semibold'
                    : game.deadline_urgency === 'warning'
                    ? 'text-orange-600 font-semibold'
                    : ''
                }
              >
                {formatDistanceToNow(new Date(deadline), { addSuffix: true })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Actions */}
      {!isUserGame && !hasApplied && game.state === 'recruitment' && hasOpenSpots && onApplyClick && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApplyClick();
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Apply to Join
          </button>
        </div>
      )}
    </div>
  );
}
```

#### 2.4.7 Updated GamesPage

**File**: `frontend/src/pages/GamesPage.tsx` (significant refactor)

```typescript
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useGameListing } from '../hooks/useGameListing';
import { FilterBar } from '../components/GameListing/FilterBar';
import { EnhancedGameCard } from '../components/GameListing/EnhancedGameCard';
import { Modal } from '../components/Modal';
import { CreateGameForm } from '../components/CreateGameForm';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export const GamesPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const {
    games,
    metadata,
    filters,
    isLoading,
    error,
    updateFilters,
    clearFilters,
    setQuickFilter,
    refetch,
  } = useGameListing();

  const handleGameClick = (gameId: number) => {
    navigate(`/games/${gameId}`);
  };

  const handleCreateSuccess = (gameId: number) => {
    setShowCreateModal(false);
    navigate(`/games/${gameId}`);
  };

  const handleApplyToGame = async (gameId: number) => {
    if (isJoining) return;

    if (!isAuthenticated) {
      if (confirm('You need to log in to apply to a game. Would you like to go to the login page?')) {
        navigate('/login');
      }
      return;
    }

    try {
      setIsJoining(true);
      await apiClient.games.applyToGame(gameId, { role: 'player' });
      alert('Successfully applied to game!');
      refetch();
    } catch (error: any) {
      console.error('Failed to apply to game:', error);
      alert(`Failed to apply: ${error?.response?.data?.error || 'Unknown error'}`);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Games</h1>
          <p className="text-gray-600 mt-2 text-sm">
            Discover and join role-playing games
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
        >
          + Create Game
        </button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        metadata={metadata}
        onUpdateFilters={updateFilters}
        onClearFilters={clearFilters}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-2">Loading games...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load games. Please try again.
        </div>
      )}

      {/* Games Grid */}
      {!isLoading && !error && (
        <>
          {games.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-600">No games found matching your filters.</p>
              <button
                onClick={clearFilters}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game) => (
                <EnhancedGameCard
                  key={game.id}
                  game={game}
                  onClick={() => handleGameClick(game.id)}
                  onApplyClick={
                    game.state === 'recruitment' && game.user_relationship === 'none'
                      ? () => handleApplyToGame(game.id)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Game Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Game"
      >
        <CreateGameForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </div>
  );
};
```

---

## 3. Testing Strategy

### 3.1 Backend Testing

#### Unit Tests (>80% Coverage Target)

**File**: `backend/pkg/db/services/games/listing_test.go`

```go
package games_test

import (
	"context"
	"testing"
	"time"

	"actionphase/backend/pkg/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetFilteredGames_NoFilters(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	// Create test games
	game1 := suite.createGame("Fantasy Adventure", "recruitment", "Fantasy")
	game2 := suite.createGame("Sci-Fi Quest", "in_progress", "Sci-Fi")

	// Fetch with no filters
	result, err := suite.gamesService.GetFilteredGames(context.Background(), core.GameListingFilters{
		SortBy: "recent_activity",
	})

	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.Games), 2)
	assert.Contains(t, gameIDs(result.Games), game1.ID)
	assert.Contains(t, gameIDs(result.Games), game2.ID)
}

func TestGetFilteredGames_FilterByState(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	recruitingGame := suite.createGame("Open Game", "recruitment", "Fantasy")
	inProgressGame := suite.createGame("Active Game", "in_progress", "Sci-Fi")

	// Filter for recruiting only
	result, err := suite.gamesService.GetFilteredGames(context.Background(), core.GameListingFilters{
		States: []string{"recruitment"},
	})

	require.NoError(t, err)
	assert.Contains(t, gameIDs(result.Games), recruitingGame.ID)
	assert.NotContains(t, gameIDs(result.Games), inProgressGame.ID)
}

func TestGetFilteredGames_FilterByGenre(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	fantasyGame := suite.createGame("Fantasy Game", "recruitment", "Fantasy")
	sciFiGame := suite.createGame("Sci-Fi Game", "recruitment", "Sci-Fi")

	// Filter for Fantasy genre
	result, err := suite.gamesService.GetFilteredGames(context.Background(), core.GameListingFilters{
		Genres: []string{"Fantasy"},
	})

	require.NoError(t, err)
	assert.Contains(t, gameIDs(result.Games), fantasyGame.ID)
	assert.NotContains(t, gameIDs(result.Games), sciFiGame.ID)
}

func TestGetFilteredGames_FilterByParticipation_MyGames(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	user := suite.createUser("player1")
	myGame := suite.createGameAsGM("My Game", user.ID)
	joinedGame := suite.createGame("Joined Game", "in_progress", "Fantasy")
	suite.addParticipant(joinedGame.ID, user.ID)
	otherGame := suite.createGame("Other Game", "recruitment", "Sci-Fi")

	participationFilter := "my_games"
	result, err := suite.gamesService.GetFilteredGames(context.Background(), core.GameListingFilters{
		UserID:              &user.ID,
		ParticipationFilter: &participationFilter,
	})

	require.NoError(t, err)
	assert.Contains(t, gameIDs(result.Games), myGame.ID)
	assert.Contains(t, gameIDs(result.Games), joinedGame.ID)
	assert.NotContains(t, gameIDs(result.Games), otherGame.ID)
}

func TestGetFilteredGames_FilterByOpenSpots(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	openGame := suite.createGameWithMaxPlayers("Open Game", 5, 2) // 2/5 players
	fullGame := suite.createGameWithMaxPlayers("Full Game", 3, 3) // 3/3 players

	hasOpenSpots := true
	result, err := suite.gamesService.GetFilteredGames(context.Background(), core.GameListingFilters{
		HasOpenSpots: &hasOpenSpots,
	})

	require.NoError(t, err)
	assert.Contains(t, gameIDs(result.Games), openGame.ID)
	assert.NotContains(t, gameIDs(result.Games), fullGame.ID)
}

func TestGetFilteredGames_SortByStartDate(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	laterGame := suite.createGameWithStartDate("Later Game", time.Now().Add(48*time.Hour))
	soonerGame := suite.createGameWithStartDate("Sooner Game", time.Now().Add(24*time.Hour))

	result, err := suite.gamesService.GetFilteredGames(context.Background(), core.GameListingFilters{
		SortBy: "start_date",
	})

	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(result.Games), 2)

	// Find positions of our test games
	soonerIdx := findGameIndex(result.Games, soonerGame.ID)
	laterIdx := findGameIndex(result.Games, laterGame.ID)

	assert.Less(t, soonerIdx, laterIdx, "Sooner game should appear before later game")
}

func TestGetFilteredGames_DeadlineUrgency(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	// Game with deadline in 12 hours (critical)
	criticalGame := suite.createGameWithRecruitmentDeadline(
		"Critical Deadline",
		time.Now().Add(12*time.Hour),
	)

	result, err := suite.gamesService.GetFilteredGames(context.Background(), core.GameListingFilters{})

	require.NoError(t, err)

	game := findGame(result.Games, criticalGame.ID)
	require.NotNil(t, game)
	assert.Equal(t, "critical", game.DeadlineUrgency)
}

func TestGetFilteredGames_UserRelationshipEnrichment(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	user := suite.createUser("player1")

	// Game where user is GM
	gmGame := suite.createGameAsGM("GM Game", user.ID)

	// Game where user is participant
	participantGame := suite.createGame("Participant Game", "in_progress", "Fantasy")
	suite.addParticipant(participantGame.ID, user.ID)

	// Game where user has applied
	appliedGame := suite.createGame("Applied Game", "recruitment", "Sci-Fi")
	suite.createApplication(appliedGame.ID, user.ID)

	// Game with no relationship
	otherGame := suite.createGame("Other Game", "recruitment", "Horror")

	result, err := suite.gamesService.GetFilteredGames(context.Background(), core.GameListingFilters{
		UserID: &user.ID,
	})

	require.NoError(t, err)

	gmGameResult := findGame(result.Games, gmGame.ID)
	assert.Equal(t, "gm", *gmGameResult.UserRelationship)

	participantGameResult := findGame(result.Games, participantGame.ID)
	assert.Equal(t, "participant", *participantGameResult.UserRelationship)

	appliedGameResult := findGame(result.Games, appliedGame.ID)
	assert.Equal(t, "applied", *appliedGameResult.UserRelationship)

	otherGameResult := findGame(result.Games, otherGame.ID)
	assert.Equal(t, "none", *otherGameResult.UserRelationship)
}

func TestGetFilteredGames_Metadata(t *testing.T) {
	suite := setupTestSuite(t)
	defer suite.Teardown()

	suite.createGame("Fantasy Game 1", "recruitment", "Fantasy")
	suite.createGame("Fantasy Game 2", "in_progress", "Fantasy")
	suite.createGame("Sci-Fi Game", "recruitment", "Sci-Fi")

	result, err := suite.gamesService.GetFilteredGames(context.Background(), core.GameListingFilters{})

	require.NoError(t, err)
	assert.GreaterOrEqual(t, result.Metadata.TotalCount, 3)
	assert.Contains(t, result.Metadata.AvailableGenres, "Fantasy")
	assert.Contains(t, result.Metadata.AvailableGenres, "Sci-Fi")
	assert.Contains(t, result.Metadata.AvailableStates, "recruitment")
	assert.Contains(t, result.Metadata.AvailableStates, "in_progress")
}
```

**Test Coverage Targets:**
- `GetFilteredGames`: 100% coverage
- Filter combinations: Test multiple filters simultaneously
- Edge cases: Empty results, no filters, unauthenticated users
- Business logic: Urgency calculation, user relationship detection
- SQL generation: Verify correct query parameters

#### Integration Tests

**File**: `backend/pkg/games/api_listing_test.go`

```go
func TestHandleGetFilteredGames_Success(t *testing.T) {
	suite := setupAPITestSuite(t)
	defer suite.Teardown()

	// Create test data
	suite.createGame("Test Game 1", "recruitment", "Fantasy")
	suite.createGame("Test Game 2", "in_progress", "Sci-Fi")

	// Make request
	req := suite.newRequest("GET", "/api/v1/games/filtered?states=recruitment&genres=Fantasy", nil)
	resp := suite.executeRequest(req)

	assert.Equal(t, http.StatusOK, resp.Code)

	var result core.GameListingResponse
	err := json.Unmarshal(resp.Body.Bytes(), &result)
	require.NoError(t, err)

	assert.GreaterOrEqual(t, len(result.Games), 1)
	assert.NotNil(t, result.Metadata)
}

func TestHandleGetFilteredGames_WithAuthentication(t *testing.T) {
	suite := setupAPITestSuite(t)
	defer suite.Teardown()

	user := suite.createUser("player1")
	token := suite.createAuthToken(user.ID)

	myGame := suite.createGameAsGM("My Game", user.ID)

	req := suite.newAuthenticatedRequest("GET", "/api/v1/games/filtered?participation=my_games", nil, token)
	resp := suite.executeRequest(req)

	assert.Equal(t, http.StatusOK, resp.Code)

	var result core.GameListingResponse
	json.Unmarshal(resp.Body.Bytes(), &result)

	assert.GreaterOrEqual(t, len(result.Games), 1)
	assert.Equal(t, myGame.ID, result.Games[0].ID)
	assert.Equal(t, "gm", *result.Games[0].UserRelationship)
}
```

### 3.2 Frontend Testing

#### Component Tests (>80% Coverage Target)

**File**: `frontend/src/hooks/useGameListing.test.tsx`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGameListing } from './useGameListing';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('useGameListing', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it('should fetch games with no filters', async () => {
    server.use(
      http.get('http://localhost:3000/api/v1/games/filtered', () => {
        return HttpResponse.json({
          games: [
            { id: 1, title: 'Test Game 1', state: 'recruitment' },
            { id: 2, title: 'Test Game 2', state: 'in_progress' },
          ],
          metadata: {
            total_count: 2,
            filtered_count: 2,
            available_genres: ['Fantasy'],
            available_states: ['recruitment', 'in_progress'],
          },
        });
      })
    );

    const { result } = renderHook(() => useGameListing(), { wrapper });

    await waitFor(() => {
      expect(result.current.games).toHaveLength(2);
    });

    expect(result.current.metadata?.total_count).toBe(2);
  });

  it('should update filters and sync to URL', async () => {
    const { result } = renderHook(() => useGameListing(), { wrapper });

    result.current.updateFilters({ states: ['recruitment'] });

    await waitFor(() => {
      expect(result.current.filters.states).toEqual(['recruitment']);
    });
  });

  it('should use quick filter presets', async () => {
    const { result } = renderHook(() => useGameListing(), { wrapper });

    result.current.setQuickFilter('my_games');

    await waitFor(() => {
      expect(result.current.filters.participation).toBe('my_games');
    });
  });
});
```

**File**: `frontend/src/components/GameListing/FilterBar.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  const mockUpdateFilters = vi.fn();
  const mockClearFilters = vi.fn();

  const mockMetadata = {
    total_count: 50,
    filtered_count: 10,
    available_genres: ['Fantasy', 'Sci-Fi', 'Horror'],
    available_states: ['recruitment', 'in_progress', 'completed'],
  };

  it('should render quick filter buttons', () => {
    render(
      <FilterBar
        filters={{}}
        metadata={mockMetadata}
        onUpdateFilters={mockUpdateFilters}
        onClearFilters={mockClearFilters}
      />
    );

    expect(screen.getByText('All Games')).toBeInTheDocument();
    expect(screen.getByText('My Games')).toBeInTheDocument();
    expect(screen.getByText('Recruiting')).toBeInTheDocument();
  });

  it('should call onUpdateFilters when clicking My Games', () => {
    render(
      <FilterBar
        filters={{}}
        metadata={mockMetadata}
        onUpdateFilters={mockUpdateFilters}
        onClearFilters={mockClearFilters}
      />
    );

    fireEvent.click(screen.getByText('My Games'));

    expect(mockUpdateFilters).toHaveBeenCalledWith({ participation: 'my_games' });
  });

  it('should show advanced filters when toggled', () => {
    render(
      <FilterBar
        filters={{}}
        metadata={mockMetadata}
        onUpdateFilters={mockUpdateFilters}
        onClearFilters={mockClearFilters}
      />
    );

    fireEvent.click(screen.getByText(/show advanced filters/i));

    expect(screen.getByText('Game State')).toBeInTheDocument();
    expect(screen.getByText('Genre')).toBeInTheDocument();
  });

  it('should display filtered count when filters are active', () => {
    render(
      <FilterBar
        filters={{ states: ['recruitment'] }}
        metadata={mockMetadata}
        onUpdateFilters={mockUpdateFilters}
        onClearFilters={mockClearFilters}
      />
    );

    expect(screen.getByText(/showing 10 of 50 games/i)).toBeInTheDocument();
  });
});
```

**File**: `frontend/src/components/GameListing/EnhancedGameCard.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnhancedGameCard } from './EnhancedGameCard';

describe('EnhancedGameCard', () => {
  const mockGame = {
    id: 1,
    title: 'Test Game',
    description: 'A test game',
    gm_user_id: 99,
    gm_username: 'test_gm',
    state: 'recruitment' as const,
    genre: 'Fantasy',
    current_players: 3,
    max_players: 6,
    deadline_urgency: 'normal' as const,
    has_recent_activity: false,
    user_relationship: 'none' as const,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    is_public: true,
    is_anonymous: false,
  };

  it('should render game title and description', () => {
    render(<EnhancedGameCard game={mockGame} onClick={vi.fn()} />);

    expect(screen.getByText('Test Game')).toBeInTheDocument();
    expect(screen.getByText('A test game')).toBeInTheDocument();
  });

  it('should show user relationship badge for participant', () => {
    const participantGame = { ...mockGame, user_relationship: 'participant' as const };

    render(<EnhancedGameCard game={participantGame} onClick={vi.fn()} />);

    expect(screen.getByText('Player')).toBeInTheDocument();
  });

  it('should show urgency badge for critical deadlines', () => {
    const urgentGame = {
      ...mockGame,
      deadline_urgency: 'critical' as const,
      recruitment_deadline: '2025-10-20T23:59:59Z',
    };

    render(<EnhancedGameCard game={urgentGame} onClick={vi.fn()} />);

    expect(screen.getByText(/urgent/i)).toBeInTheDocument();
  });

  it('should show recent activity indicator', () => {
    const activeGame = { ...mockGame, has_recent_activity: true };

    render(<EnhancedGameCard game={activeGame} onClick={vi.fn()} />);

    expect(screen.getByText('New Activity')).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const handleClick = vi.fn();

    render(<EnhancedGameCard game={mockGame} onClick={handleClick} />);

    fireEvent.click(screen.getByText('Test Game'));

    expect(handleClick).toHaveBeenCalled();
  });

  it('should show Apply button for recruiting games', () => {
    const handleApply = vi.fn();

    render(<EnhancedGameCard game={mockGame} onClick={vi.fn()} onApplyClick={handleApply} />);

    expect(screen.getByText('Apply to Join')).toBeInTheDocument();
  });

  it('should not show Apply button for user\'s own game', () => {
    const myGame = { ...mockGame, user_relationship: 'participant' as const };

    render(<EnhancedGameCard game={myGame} onClick={vi.fn()} onApplyClick={vi.fn()} />);

    expect(screen.queryByText('Apply to Join')).not.toBeInTheDocument();
  });
});
```

### 3.3 Manual Testing Checklist

**Comprehensive UI Testing Checklist:**

#### Filter Functionality
- [ ] Quick filter "All Games" shows all public games
- [ ] Quick filter "My Games" shows only user's games (GM + participant)
- [ ] Quick filter "Recruiting" shows only recruitment state games
- [ ] Quick filter "Open Spots" shows only games with available player slots
- [ ] Advanced filters toggle expands/collapses correctly
- [ ] State filter buttons toggle correctly (multi-select)
- [ ] Genre filter buttons toggle correctly (multi-select)
- [ ] Multiple filters work together (AND logic)
- [ ] Filtered count updates correctly
- [ ] "Clear All Filters" button resets to all games

#### Sorting
- [ ] Sort by "Recent Activity" shows most recently updated first
- [ ] Sort by "Recently Created" shows newest games first
- [ ] Sort by "Starting Soon" shows games with nearest start_date first
- [ ] Sort by "Alphabetical" shows games A-Z
- [ ] Sorting persists when changing filters
- [ ] Sorting dropdown updates selection correctly

#### Visual Highlighting
- [ ] User's games (GM) have distinct border/background
- [ ] User's games (participant) have distinct border/background
- [ ] Games user has applied to have distinct styling
- [ ] Critical urgency badge (<24h deadline) appears correctly
- [ ] Warning urgency badge (<3d deadline) appears correctly
- [ ] Recent activity indicator (new in 24h) appears correctly
- [ ] Open spots indicator appears on cards with availability

#### Game Cards
- [ ] All game info displays correctly (title, description, GM, players, dates)
- [ ] Genre badge displays when present
- [ ] State badge displays with correct color
- [ ] Player count shows "X / Y" format with max_players
- [ ] Player count shows "X" format without max_players
- [ ] "Apply to Join" button appears for recruiting games (non-participants)
- [ ] No "Apply to Join" for user's own games
- [ ] No "Apply to Join" for games user has applied to
- [ ] Cards are clickable and navigate to game details

#### URL State Management
- [ ] Filters persist in URL query params
- [ ] URL is shareable (copying link preserves filters)
- [ ] Browser back/forward navigation works
- [ ] Page reload preserves filter state
- [ ] Direct navigation to URL with filters works

#### Responsive Design
- [ ] Filter bar works on mobile (stacks vertically)
- [ ] Game cards grid adjusts to screen size (1 col mobile, 2 col tablet, 3 col desktop)
- [ ] Advanced filters panel scrolls on mobile
- [ ] All buttons are tap-friendly on mobile

#### Edge Cases
- [ ] No games state shows helpful message
- [ ] Loading state shows spinner
- [ ] Error state shows error message
- [ ] Empty filter results show "No games found" with clear filters option
- [ ] Games with no genre display correctly (no genre badge)
- [ ] Games with no max_players display correctly
- [ ] Unauthenticated users see correct UI (no "My Games", no user_relationship enrichment)

#### Performance
- [ ] Game listing loads in <1 second
- [ ] Filter changes update quickly (<200ms)
- [ ] No lag when toggling multiple filters
- [ ] Smooth scrolling with 50+ games

### 3.4 User Journeys for Future E2E Tests

**User Journey 1: New Player Finding a Game**
```gherkin
Given I am a new user on the Games page
When I select the "Recruiting" quick filter
And I filter by genre "Fantasy"
And I sort by "Starting Soon"
Then I should see only recruiting Fantasy games
And the games should be ordered by start_date ascending
When I click on the first game card
Then I should navigate to that game's detail page
When I click "Apply to Join"
Then I should see a success message
And the game should show "Applied" badge when I return to listing
```

**User Journey 2: Active Player Finding Their Games**
```gherkin
Given I am an authenticated user with 3 active games
When I click the "My Games" quick filter
Then I should see only my 3 games
And each game should have a "Player" or "GM" badge
And my games should have distinct visual styling
When I see a game with "Urgent" deadline badge
Then that game should be visually prominent
```

**User Journey 3: GM Browsing All Games**
```gherkin
Given I am a GM on the Games page
When I expand "Advanced Filters"
And I select states "Recruitment" and "In Progress"
And I select genre "Sci-Fi"
Then the URL should update with my filters
When I copy the URL and paste it in a new tab
Then I should see the same filtered games
And all my filter selections should be active
```

**User Journey 4: Filter Combinations**
```gherkin
Given I am on the Games page with 20 total games
When I enable "Open Spots" filter
Then I should only see games with current_players < max_players
When I additionally filter by state "Recruitment"
Then I should see the intersection of both filters
And the filtered count should update
When I click "Clear All Filters"
Then I should see all 20 games again
```

---

## 4. Implementation Plan

### 4.1 Phase 1: Backend Foundation (Days 1-2)

**Tasks:**
- [ ] Create database migration for indexes
- [ ] Write SQL query `GetFilteredGames` with all filter parameters
- [ ] Write helper queries (`CountPublicGames`, `GetAvailableGenres`, `GetAvailableStates`)
- [ ] Run `just sqlgen` to generate Go code
- [ ] Create domain models (`EnrichedGameListItem`, `GameListingFilters`, `GameListingResponse`, `GameListingMetadata`)
- [ ] Implement `GamesService.GetFilteredGames` with full business logic
- [ ] Write comprehensive unit tests (>85% coverage target)
- [ ] Verify tests pass: `SKIP_DB_TESTS=false just test-service games`

**Acceptance Criteria:**
- ✅ All unit tests passing
- ✅ Service returns enriched game data with user_relationship
- ✅ Filters work correctly (states, genres, participation, open spots)
- ✅ Sorting works correctly (recent_activity, created, start_date, alphabetical)
- ✅ Deadline urgency calculation is correct
- ✅ Metadata includes available genres and states

### 4.2 Phase 2: API Layer (Day 2)

**Tasks:**
- [ ] Create `HandleGetFilteredGames` handler
- [ ] Parse query parameters (states, genres, participation, has_open_spots, sort_by)
- [ ] Extract user_id from auth context (if authenticated)
- [ ] Return JSON response with `GameListingResponse`
- [ ] Register route in `games/api.go`
- [ ] Write API integration tests
- [ ] Test manually with curl: `curl "http://localhost:3000/api/v1/games/filtered?states=recruitment" | jq`
- [ ] Verify backward compatibility (old endpoints still work)

**Acceptance Criteria:**
- ✅ Endpoint returns correct JSON structure
- ✅ All query parameters work correctly
- ✅ Authenticated vs unauthenticated requests handled properly
- ✅ Integration tests passing
- ✅ Manual curl testing successful

### 4.3 Phase 3: Frontend - Core (Days 3-4)

**Tasks:**
- [ ] Update types in `types/games.ts` (`EnrichedGameListItem`, `GameListingFilters`, etc.)
- [ ] Add `getFilteredGames` method to `api/games.ts`
- [ ] Create `useGameListing` hook with URL state management
- [ ] Write hook tests (>85% coverage)
- [ ] Verify hook works: `just test-frontend`
- [ ] Create `FilterBar` component
- [ ] Create quick filter buttons (All Games, My Games, Recruiting, Open Spots)
- [ ] Create advanced filters panel (state, genre, sort)
- [ ] Write FilterBar component tests
- [ ] Verify component tests pass

**Acceptance Criteria:**
- ✅ Hook manages URL query params correctly
- ✅ Hook fetches data via React Query
- ✅ Filter changes update URL
- ✅ FilterBar UI matches design
- ✅ All component tests passing

### 4.4 Phase 4: Frontend - Enhanced Display (Days 4-5)

**Tasks:**
- [ ] Create `EnhancedGameCard` component
- [ ] Add visual badges (state, genre, user relationship, urgency, recent activity)
- [ ] Add deadline display with urgency color coding
- [ ] Add player count with open spots indicator
- [ ] Add conditional "Apply to Join" button
- [ ] Style user's games distinctly (border + background)
- [ ] Write EnhancedGameCard component tests
- [ ] Refactor `GamesPage` to use new components
- [ ] Replace old `GamesList` with grid of `EnhancedGameCard`
- [ ] Integrate `FilterBar` into page
- [ ] Add loading and error states

**Acceptance Criteria:**
- ✅ Game cards display all enriched data
- ✅ Visual hierarchy is clear (user's games stand out)
- ✅ Urgency badges display correctly
- ✅ Component tests passing (>85% coverage)
- ✅ Page compiles and runs without errors

### 4.5 Phase 5: Integration & Polish (Days 5-7)

**Tasks:**
- [ ] Manual testing with real data (apply test fixtures)
- [ ] Complete manual testing checklist (all items)
- [ ] Fix any bugs discovered in testing
- [ ] Performance testing (50+ games)
- [ ] Add loading skeletons for better UX
- [ ] Responsive design testing (mobile, tablet, desktop)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Accessibility testing (keyboard navigation, screen readers)
- [ ] Update documentation
- [ ] Create user-facing docs (how to use filters)
- [ ] Update developer docs (API endpoint spec)

**Acceptance Criteria:**
- ✅ All manual testing checklist items pass
- ✅ Responsive design works on all screen sizes
- ✅ Filters perform quickly (<200ms)
- ✅ No accessibility issues
- ✅ Documentation updated

---

## 5. Rollout Strategy

### 5.1 Deployment Plan

**Pre-Deployment:**
1. Run full test suite: `just ci-test` (backend) and `just test-frontend`
2. Create database migration: `just make_migration add_game_listing_indexes`
3. Apply migration to staging: `just migrate`
4. Smoke test on staging environment

**Deployment:**
1. Deploy backend first (new endpoint, backward compatible)
2. Verify `/api/v1/games/filtered` works in production
3. Deploy frontend (switches to new endpoint)
4. Monitor error rates and performance

**Post-Deployment:**
1. Monitor query performance (dashboard for DB query times)
2. Track filter usage analytics
3. Gather user feedback

### 5.2 Rollback Plan

**If issues arise:**
1. Frontend rollback is safe (old endpoints still work)
2. Backend rollback requires reverting migration (indexes only, non-breaking)
3. Database: `just migrate_down` to remove indexes

**Monitoring Alerts:**
- Alert if `/api/v1/games/filtered` error rate >5%
- Alert if query time >2 seconds
- Alert if frontend app crashes increase

### 5.3 Feature Flag (Optional)

**For gradual rollout:**
```typescript
// In GamesPage.tsx
const useNewFiltering = useFeatureFlag('game_listing_v2');

return useNewFiltering ? <NewGamesPage /> : <OldGamesPage />;
```

This allows:
- A/B testing old vs new listing
- Gradual rollout to 10%, 50%, 100% of users
- Easy rollback without deployment

---

## 6. Monitoring and Success Metrics

### 6.1 Technical Metrics

**Backend Metrics:**
- Query execution time (target: <500ms p95)
- Cache hit rate (React Query client-side, target: >60%)
- Error rate (target: <1%)
- Concurrent requests (monitor for load)

**Frontend Metrics:**
- Page load time (target: <1s)
- Time to interactive (target: <1.5s)
- Filter interaction latency (target: <200ms)
- Component render time

**Monitoring Queries:**
```sql
-- Slow query monitoring
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%GetFilteredGames%'
ORDER BY mean_exec_time DESC;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_games%'
ORDER BY idx_scan DESC;
```

### 6.2 Product Metrics

**User Behavior Metrics:**
- **Filter Usage Rate**: % of game listing page views that use at least one filter (target: >40%)
- **My Games Filter**: % of authenticated users who use "My Games" (target: >60%)
- **Advanced Filters**: % who expand advanced filters (target: >20%)
- **Sort Usage**: % who change sort order (target: >30%)
- **Filter Depth**: Average number of active filters per session
- **Apply Rate**: Applications per game view (should increase 15-25%)

**Success Metrics (30 days post-launch):**
- ✅ Filter usage >40% of sessions
- ✅ Time to find specific game reduced by 50%
- ✅ Application rate increase of 25%
- ✅ "My Games" filter used by >60% of active players
- ✅ User satisfaction survey: "Finding games" >4/5

### 6.3 Analytics Events

**Track these events:**
```typescript
// Example analytics tracking
analytics.track('game_listing_filtered', {
  filters_used: ['state', 'genre'],
  filter_count: 2,
  results_count: 12,
  sort_by: 'recent_activity',
});

analytics.track('game_listing_quick_filter', {
  preset: 'my_games',
  results_count: 5,
});

analytics.track('game_card_clicked', {
  game_id: 42,
  user_relationship: 'none',
  from_filter: true,
  filters_active: ['state:recruitment', 'genre:Fantasy'],
});
```

---

## 7. Documentation Updates

### 7.1 User Documentation

**Add to User Guide** (`docs/user-guide/finding-games.md`):

```markdown
# Finding Games on ActionPhase

## Quick Filters

Use quick filter buttons for common searches:
- **All Games**: See all public games
- **My Games**: View only games you're participating in (as GM or player)
- **Recruiting**: Find games currently accepting applications
- **Open Spots**: See games with available player slots

## Advanced Filters

Click "Show Advanced Filters" to refine your search:

### Filter by Game State
Select one or more game states:
- Recruitment: Games accepting new players
- In Progress: Active games currently playing
- Character Creation: Games preparing to start
- Completed: Finished games (view only)

### Filter by Genre
Choose your preferred genres: Fantasy, Sci-Fi, Horror, etc.

### Sort Games
Choose how to order results:
- **Recent Activity**: Games with newest updates (default)
- **Recently Created**: Newest games first
- **Starting Soon**: Games with nearest start dates
- **Alphabetical**: A-Z by title

## Understanding Game Cards

### Badges
- **GM/Player/Applied**: Your relationship to the game
- **⚠️ Urgent**: Deadline within 24 hours
- **⏰ Soon**: Deadline within 3 days
- **New Activity**: Updated in last 24 hours

### Visual Highlights
- **Blue border**: Games you're participating in
- **Yellow border**: Games you've applied to

## Sharing Searches

All filters are saved in the page URL, so you can:
- Bookmark your favorite searches
- Share filtered game lists with friends
- Use browser back/forward to navigate search history
```

### 7.2 Developer Documentation

**Add to API Documentation** (`docs/api/games.md`):

```markdown
## GET /api/v1/games/filtered

Retrieve games with filtering, sorting, and user relationship enrichment.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `states` | string | Comma-separated game states (e.g., `recruitment,in_progress`) |
| `genres` | string | Comma-separated genres (e.g., `Fantasy,Sci-Fi`) |
| `participation` | string | Filter by user relationship: `my_games`, `applied`, `not_joined` |
| `has_open_spots` | boolean | Show only games with available player slots |
| `sort_by` | string | Sort order: `recent_activity`, `created`, `start_date`, `alphabetical` |

### Authentication

Optional. If authenticated:
- `user_relationship` field is enriched
- `participation` filter works
- User's games are highlighted

### Response

```json
{
  "games": [
    {
      "id": 42,
      "title": "Example Game",
      "user_relationship": "participant",
      "deadline_urgency": "warning",
      "has_recent_activity": true,
      ...
    }
  ],
  "metadata": {
    "total_count": 50,
    "filtered_count": 12,
    "available_genres": ["Fantasy", "Sci-Fi"],
    "available_states": ["recruitment", "in_progress"]
  }
}
```

### Performance

- Query execution: <500ms (p95)
- Uses indexed columns for fast filtering
- Results cached client-side for 30 seconds
```

---

## 8. Open Questions and Decisions

### 8.1 Resolved Decisions

**Q: Should we paginate results?**
**A**: No, not in v1. Only paginate if >50 public games exist. Most instances will have <50 games.

**Q: Should filters persist across sessions?**
**A**: Yes, via URL query params (shareable). No server-side persistence (that's P3).

**Q: What if a user has >20 games?**
**A**: Rare edge case. Sort by urgency and recent activity so most important games appear first. Can add pagination in future if needed.

**Q: Should we show completed/cancelled games by default?**
**A**: Yes. Users might want to browse past games for inspiration. They can filter them out if not interested.

### 8.2 Open Questions

**Q: Should we show game count badges on filter buttons?**
**Example**: "Recruiting (12)" instead of just "Recruiting"
**Tradeoff**: More informative, but adds complexity
**Recommendation**: Start without counts, add if users request it

**Q: Should we debounce filter changes?**
**Context**: If user clicks 5 filters quickly, should we wait before querying?
**Recommendation**: No debounce (queries are fast <500ms). Instant feedback is better UX.

**Q: How to handle very long genre lists (>10 genres)?**
**Recommendation**: If >10 genres exist, switch to dropdown instead of button grid. Monitor in production.

---

## 9. Revision History

| Date | Changes | Author |
|------|---------|--------|
| 2025-10-19 | Initial plan created | AI Planning Session |
| | | |
