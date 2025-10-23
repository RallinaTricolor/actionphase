package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// GameService provides database operations for game management.
// It implements core.GameServiceInterface and handles all game-related
// database interactions including CRUD operations, state management,
// and participant management.
type GameService struct {
	DB *pgxpool.Pool
}

// Ensure GameService implements the interface at compile time
var _ core.GameServiceInterface = (*GameService)(nil)

// GameWithDetails represents a game enriched with additional metadata
// including GM information, participant count, and user's role in the game.
// This is used for detailed game views that require aggregated data.
type GameWithDetails struct {
	Game             models.Game
	GMUsername       string // Username of the Game Master
	ParticipantCount int64  // Number of current participants
	UserRole         string // User's role in this game, empty if not participating
}

// CreateGame creates a new game with the specified parameters.
// The game is initially created in "setup" state and requires the GM to
// transition it to "recruitment" when ready to accept players.
//
// Parameters:
//   - ctx: Context for the database operation
//   - req: Game creation request with title, description, GM user ID, and optional settings
//
// Returns:
//   - *models.Game: The created game with generated ID and default state
//   - error: Database error or validation failure
//
// Business Rules:
//   - GMUserID must reference a valid user
//   - Title and description are required
//   - Optional dates must be in logical order (recruitment < start < end)
//   - MaxPlayers defaults to 6 if not specified
//   - Game starts in "setup" state
func (gs *GameService) CreateGame(ctx context.Context, req core.CreateGameRequest) (*models.Game, error) {
	queries := models.New(gs.DB)

	var startDate, endDate, recruitmentDeadline pgtype.Timestamptz

	if req.StartDate != nil {
		startDate = pgtype.Timestamptz{Time: *req.StartDate, Valid: true}
	}
	if req.EndDate != nil {
		endDate = pgtype.Timestamptz{Time: *req.EndDate, Valid: true}
	}
	if req.RecruitmentDeadline != nil {
		recruitmentDeadline = pgtype.Timestamptz{Time: *req.RecruitmentDeadline, Valid: true}
	}

	game, err := queries.CreateGame(ctx, models.CreateGameParams{
		Title:               req.Title,
		Description:         pgtype.Text{String: req.Description, Valid: req.Description != ""},
		GmUserID:            req.GMUserID,
		Genre:               pgtype.Text{String: req.Genre, Valid: req.Genre != ""},
		StartDate:           startDate,
		EndDate:             endDate,
		RecruitmentDeadline: recruitmentDeadline,
		MaxPlayers:          pgtype.Int4{Int32: req.MaxPlayers, Valid: req.MaxPlayers > 0},
		IsPublic:            pgtype.Bool{Bool: req.IsPublic, Valid: true},
		IsAnonymous:         req.IsAnonymous,
	})

	return &game, err
}

func (gs *GameService) GetGame(ctx context.Context, gameID int32) (*models.Game, error) {
	queries := models.New(gs.DB)
	game, err := queries.GetGame(ctx, gameID)
	return &game, err
}

func (gs *GameService) GetGamesByUser(ctx context.Context, userID int32) ([]models.GetGamesByUserRow, error) {
	queries := models.New(gs.DB)
	return queries.GetGamesByUser(ctx, userID)
}

func (gs *GameService) GetAllGames(ctx context.Context) ([]models.GetAllGamesRow, error) {
	queries := models.New(gs.DB)
	return queries.GetAllGames(ctx)
}

func (gs *GameService) UpdateGameState(ctx context.Context, gameID int32, newState string) (*models.Game, error) {
	queries := models.New(gs.DB)

	// Validate state transition
	if !isValidGameState(newState) {
		return nil, fmt.Errorf("invalid game state: %s", newState)
	}

	game, err := queries.UpdateGameState(ctx, models.UpdateGameStateParams{
		ID:    gameID,
		State: pgtype.Text{String: newState, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	// When a game is cancelled, automatically reject all pending applications
	if newState == core.GameStateCancelled {
		appService := &GameApplicationService{DB: gs.DB}
		// Use the GM's ID as the reviewer (since they're cancelling the game)
		if err := appService.BulkRejectApplications(ctx, gameID, game.GmUserID); err != nil {
			// Log the error but don't fail the state change
			// The game is already cancelled at this point
			fmt.Printf("Warning: failed to reject pending applications for cancelled game %d: %v\n", gameID, err)
		}
	}

	return &game, nil
}

func (gs *GameService) LeaveGame(ctx context.Context, gameID, userID int32) error {
	queries := models.New(gs.DB)

	// Check if user is GM (GMs cannot leave their own games)
	game, err := queries.GetGame(ctx, gameID)
	if err != nil {
		return err
	}

	if game.GmUserID == userID {
		return fmt.Errorf("game master cannot leave their own game")
	}

	return queries.RemoveGameParticipant(ctx, models.RemoveGameParticipantParams{
		GameID: gameID,
		UserID: userID,
	})
}

func (gs *GameService) GetUserRole(ctx context.Context, gameID, userID int32) (string, error) {
	queries := models.New(gs.DB)

	// Check if user is GM
	game, err := queries.GetGame(ctx, gameID)
	if err != nil {
		return "", err
	}

	if game.GmUserID == userID {
		return "gm", nil
	}

	// Check participant role
	role, err := queries.GetParticipantRole(ctx, models.GetParticipantRoleParams{
		GameID: gameID,
		UserID: userID,
	})
	if err != nil {
		return "", err
	}

	return role, nil
}

func (gs *GameService) IsUserInGame(ctx context.Context, gameID, userID int32) (bool, error) {
	queries := models.New(gs.DB)

	// Check if user is GM
	game, err := queries.GetGame(ctx, gameID)
	if err != nil {
		return false, err
	}

	if game.GmUserID == userID {
		return true, nil
	}

	// Check if user is participant
	exists, err := queries.IsUserInGame(ctx, models.IsUserInGameParams{
		GameID: gameID,
		UserID: userID,
	})

	return exists, err
}

// isValidGameState validates that a game state string is one of the allowed values.
// This function enforces the game state machine and prevents invalid transitions.
//
// Valid Game States:
//   - "setup": Initial state when game is created, GM configuring game
//   - "recruitment": Game is accepting new players to join
//   - "character_creation": Players are creating their characters
//   - "in_progress": Game is actively being played
//   - "paused": Game is temporarily suspended but can resume
//   - "completed": Game has finished successfully
//   - "cancelled": Game was cancelled before completion
//
// State Transition Rules (enforced at business logic level):
//
//	setup → recruitment → character_creation → in_progress ↔ paused → completed
//	Any state → cancelled (emergency cancellation)
//
// Parameters:
//   - state: The state string to validate
//
// Returns:
//   - bool: true if state is valid, false otherwise
func isValidGameState(state string) bool {
	validStates := []string{"setup", "recruitment", "character_creation", "in_progress", "paused", "completed", "cancelled"}
	for _, validState := range validStates {
		if state == validState {
			return true
		}
	}
	return false
}

// UpdateGame - Update game details
func (gs *GameService) UpdateGame(ctx context.Context, req core.UpdateGameRequest) (*models.Game, error) {
	queries := models.New(gs.DB)

	// Validate game is not completed/cancelled (archived games are read-only)
	game, err := queries.GetGame(ctx, req.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game: %w", err)
	}

	if err := core.ValidateGameNotCompleted(ctx, &game); err != nil {
		return nil, err
	}

	var startDate, endDate, recruitmentDeadline pgtype.Timestamptz

	if req.StartDate != nil {
		startDate = pgtype.Timestamptz{Time: *req.StartDate, Valid: true}
	}
	if req.EndDate != nil {
		endDate = pgtype.Timestamptz{Time: *req.EndDate, Valid: true}
	}
	if req.RecruitmentDeadline != nil {
		recruitmentDeadline = pgtype.Timestamptz{Time: *req.RecruitmentDeadline, Valid: true}
	}

	updatedGame, err := queries.UpdateGame(ctx, models.UpdateGameParams{
		ID:                  req.ID,
		Title:               req.Title,
		Description:         pgtype.Text{String: req.Description, Valid: req.Description != ""},
		Genre:               pgtype.Text{String: req.Genre, Valid: req.Genre != ""},
		StartDate:           startDate,
		EndDate:             endDate,
		RecruitmentDeadline: recruitmentDeadline,
		MaxPlayers:          pgtype.Int4{Int32: req.MaxPlayers, Valid: req.MaxPlayers > 0},
		IsPublic:            pgtype.Bool{Bool: req.IsPublic, Valid: true},
		IsAnonymous:         req.IsAnonymous,
	})

	return &updatedGame, err
}

// DeleteGame - Delete a game
func (gs *GameService) DeleteGame(ctx context.Context, gameID int32) error {
	queries := models.New(gs.DB)
	return queries.DeleteGame(ctx, gameID)
}

// GetGameWithDetails - Get game with additional details like GM username and player count
func (gs *GameService) GetGameWithDetails(ctx context.Context, gameID int32) (*models.GetGameWithDetailsRow, error) {
	queries := models.New(gs.DB)
	game, err := queries.GetGameWithDetails(ctx, gameID)
	return &game, err
}

// GetRecruitingGames - Get games currently accepting players
func (gs *GameService) GetRecruitingGames(ctx context.Context) ([]models.GetRecruitingGamesRow, error) {
	queries := models.New(gs.DB)
	return queries.GetRecruitingGames(ctx)
}

// CanUserJoinGame - Check if user can join a game
func (gs *GameService) CanUserJoinGame(ctx context.Context, gameID, userID int32) (string, error) {
	queries := models.New(gs.DB)
	return queries.CanUserJoinGame(ctx, models.CanUserJoinGameParams{
		GameID: gameID,
		UserID: userID,
	})
}

// AddGameParticipant - Add a user as a participant to a game
func (gs *GameService) AddGameParticipant(ctx context.Context, gameID, userID int32, role string) (*models.GameParticipant, error) {
	queries := models.New(gs.DB)

	// Validate game is not completed/cancelled (archived games are read-only)
	game, err := queries.GetGame(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get game: %w", err)
	}

	if err := core.ValidateGameNotCompleted(ctx, &game); err != nil {
		return nil, err
	}

	participant, err := queries.AddGameParticipant(ctx, models.AddGameParticipantParams{
		GameID: gameID,
		UserID: userID,
		Role:   role,
	})
	return &participant, err
}

// RemoveGameParticipant - Remove a user from game participants
func (gs *GameService) RemoveGameParticipant(ctx context.Context, gameID, userID int32) error {
	queries := models.New(gs.DB)
	return queries.RemoveGameParticipant(ctx, models.RemoveGameParticipantParams{
		GameID: gameID,
		UserID: userID,
	})
}

// GetGameParticipants - Get all participants for a game
func (gs *GameService) GetGameParticipants(ctx context.Context, gameID int32) ([]models.GetGameParticipantsRow, error) {
	queries := models.New(gs.DB)
	return queries.GetGameParticipants(ctx, gameID)
}

// GetFilteredGames retrieves games with filters, sorting, and user enrichment
func (gs *GameService) GetFilteredGames(ctx context.Context, filters core.GameListingFilters) (*core.GameListingResponse, error) {
	queries := models.New(gs.DB)

	// Convert filters to sqlc parameters
	// Note: sqlc generated Column1-8 parameter names, mapping:
	// Column1 = user_id, Column2 = states, Column3 = participation_filter
	// Column4 = has_open_spots, Column5 = sort_by
	// Column6 = admin_mode, Column7 = admin_user_id, Column8 = search
	var userID int32
	if filters.UserID != nil {
		userID = *filters.UserID
	}

	var participationFilter string
	if filters.ParticipationFilter != nil {
		participationFilter = *filters.ParticipationFilter
	}

	var hasOpenSpots bool
	if filters.HasOpenSpots != nil {
		hasOpenSpots = *filters.HasOpenSpots
	}

	// Default sort to recent_activity
	sortBy := filters.SortBy
	if sortBy == "" {
		sortBy = "recent_activity"
	}

	var adminUserID int32
	if filters.AdminUserID != nil {
		adminUserID = *filters.AdminUserID
	}

	// Execute query
	rows, err := queries.GetFilteredGames(ctx, models.GetFilteredGamesParams{
		Column1: userID,
		Column2: filters.States,
		Column3: participationFilter,
		Column4: hasOpenSpots,
		Column5: sortBy,
		Column6: filters.AdminMode,
		Column7: adminUserID,
		Column8: filters.Search,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to fetch games: %w", err)
	}

	// Convert to domain models
	games := make([]*core.EnrichedGameListItem, len(rows))
	for i, row := range rows {
		games[i] = enrichedGameFromRow(row)
	}

	// Fetch metadata (available filters)
	metadata, err := gs.getListingMetadata(ctx, queries)
	if err != nil {
		// Don't fail the entire request, just use empty metadata
		metadata = core.GameListingMetadata{
			TotalCount:      len(games),
			FilteredCount:   len(games),
			AvailableStates: []string{},
		}
	} else {
		metadata.FilteredCount = len(games)
	}

	return &core.GameListingResponse{
		Games:    games,
		Metadata: metadata,
	}, nil
}

// getListingMetadata fetches available states for filter dropdowns
func (gs *GameService) getListingMetadata(ctx context.Context, queries *models.Queries) (core.GameListingMetadata, error) {
	// Get total count of public games
	totalCount, err := queries.CountPublicGames(ctx)
	if err != nil {
		return core.GameListingMetadata{}, err
	}

	// Get states that have at least one game
	statesDB, err := queries.GetAvailableStates(ctx)
	if err != nil {
		return core.GameListingMetadata{}, err
	}

	// Convert pgtype.Text to []string
	states := make([]string, 0, len(statesDB))
	for _, s := range statesDB {
		if s.Valid {
			states = append(states, s.String)
		}
	}

	return core.GameListingMetadata{
		TotalCount:      int(totalCount),
		AvailableStates: states,
	}, nil
}

// enrichedGameFromRow converts DB row to EnrichedGameListItem
func enrichedGameFromRow(row models.GetFilteredGamesRow) *core.EnrichedGameListItem {
	return &core.EnrichedGameListItem{
		ID:                   row.ID,
		Title:                row.Title,
		Description:          textToString(row.Description),
		GMUserID:             row.GmUserID,
		GMUsername:           row.GmUsername,
		State:                textToString(row.State),
		Genre:                nullTextToStringPtr(row.Genre),
		StartDate:            timestamptzToTimePtr(row.StartDate),
		EndDate:              timestamptzToTimePtr(row.EndDate),
		RecruitmentDeadline:  timestamptzToTimePtr(row.RecruitmentDeadline),
		MaxPlayers:           nullInt4ToInt32Ptr(row.MaxPlayers),
		IsPublic:             boolToBool(row.IsPublic),
		IsAnonymous:          row.IsAnonymous,
		CreatedAt:            timestamptzToTime(row.CreatedAt),
		UpdatedAt:            timestamptzToTime(row.UpdatedAt),
		CurrentPlayers:       int32(row.CurrentPlayers),
		UserRelationship:     interfaceToStringPtr(row.UserRelationship),
		CurrentPhaseType:     interfaceToStringPtr(row.CurrentPhaseType),
		CurrentPhaseDeadline: timestamptzToTimePtr(row.CurrentPhaseDeadline),
		DeadlineUrgency:      row.DeadlineUrgency,
		HasRecentActivity:    row.HasRecentActivity,
	}
}

// Helper conversion functions for pgtype to Go types
func textToString(t pgtype.Text) string {
	if t.Valid {
		return t.String
	}
	return ""
}

func nullTextToStringPtr(t pgtype.Text) *string {
	if t.Valid && t.String != "" {
		return &t.String
	}
	return nil
}

func timestamptzToTime(t pgtype.Timestamptz) time.Time {
	if t.Valid {
		return t.Time
	}
	return time.Time{}
}

func timestamptzToTimePtr(t pgtype.Timestamptz) *time.Time {
	if t.Valid {
		return &t.Time
	}
	return nil
}

func nullInt4ToInt32Ptr(i pgtype.Int4) *int32 {
	if i.Valid {
		return &i.Int32
	}
	return nil
}

func boolToBool(b pgtype.Bool) bool {
	if b.Valid {
		return b.Bool
	}
	return false
}

func stringToStringPtr(s string) *string {
	if s != "" && s != "none" {
		return &s
	}
	return nil
}

func interfaceToStringPtr(i interface{}) *string {
	if i == nil {
		return nil
	}
	s, ok := i.(string)
	if !ok || s == "" || s == "none" {
		return nil
	}
	return &s
}

// Player Management Methods

// RemovePlayer removes a player from the game and deactivates their characters
func (gs *GameService) RemovePlayer(ctx context.Context, gameID, userID, gmUserID int32) error {
	queries := models.New(gs.DB)

	// Start a transaction
	tx, err := gs.DB.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	txQueries := queries.WithTx(tx)

	// Remove the participant (soft delete)
	err = txQueries.RemoveParticipant(ctx, models.RemoveParticipantParams{
		GameID:          gameID,
		UserID:          userID,
		RemovedByUserID: pgtype.Int4{Int32: gmUserID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to remove participant: %w", err)
	}

	// Deactivate the player's characters
	err = txQueries.DeactivatePlayerCharacters(ctx, models.DeactivatePlayerCharactersParams{
		GameID: gameID,
		UserID: pgtype.Int4{Int32: userID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to deactivate characters: %w", err)
	}

	// Commit the transaction
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// AddPlayerDirectly adds a player directly to the game without application process
func (gs *GameService) AddPlayerDirectly(ctx context.Context, gameID, userID int32) (*models.GameParticipant, error) {
	queries := models.New(gs.DB)

	participant, err := queries.AddParticipantDirectly(ctx, models.AddParticipantDirectlyParams{
		GameID: gameID,
		UserID: userID,
	})

	if err != nil {
		return nil, fmt.Errorf("failed to add participant: %w", err)
	}

	return &participant, nil
}

// GetActiveParticipants retrieves all active (non-removed) participants for a game
func (gs *GameService) GetActiveParticipants(ctx context.Context, gameID int32) ([]models.GetActiveParticipantsRow, error) {
	queries := models.New(gs.DB)
	return queries.GetActiveParticipants(ctx, gameID)
}

// ============================================================================
// Audience Participation Methods
// ============================================================================

// GetGameAutoAcceptAudience retrieves the auto-accept audience setting for a game
func (gs *GameService) GetGameAutoAcceptAudience(ctx context.Context, gameID int32) (bool, error) {
	queries := models.New(gs.DB)
	return queries.GetGameAutoAcceptAudience(ctx, gameID)
}

// UpdateGameAutoAcceptAudience updates the auto-accept audience setting for a game
func (gs *GameService) UpdateGameAutoAcceptAudience(ctx context.Context, gameID int32, autoAccept bool) error {
	queries := models.New(gs.DB)
	return queries.UpdateGameAutoAcceptAudience(ctx, models.UpdateGameAutoAcceptAudienceParams{
		ID:                 gameID,
		AutoAcceptAudience: autoAccept,
	})
}

// CreateAudienceApplication allows a user to apply/join as an audience member
// If auto_accept_audience is enabled, user is immediately added as active audience.
// Otherwise, they are added with 'pending' status and require GM approval.
func (gs *GameService) CreateAudienceApplication(ctx context.Context, gameID, userID int32) (*models.GameParticipant, error) {
	queries := models.New(gs.DB)

	// Check if auto-accept is enabled for this game
	autoAccept, err := queries.GetGameAutoAcceptAudience(ctx, gameID)
	if err != nil {
		return nil, fmt.Errorf("failed to get auto-accept setting: %w", err)
	}

	// Determine status based on auto-accept setting
	// Use 'inactive' for manual approval, 'active' for auto-accept
	status := "active"
	if !autoAccept {
		status = "inactive"
	}

	// Create the audience application/participant
	participant, err := queries.CreateAudienceApplication(ctx, models.CreateAudienceApplicationParams{
		GameID: gameID,
		UserID: userID,
		Status: pgtype.Text{String: status, Valid: true},
	})

	if err != nil {
		return nil, fmt.Errorf("failed to create audience application: %w", err)
	}

	return &participant, nil
}

// ListAudienceMembers retrieves all audience members for a game
func (gs *GameService) ListAudienceMembers(ctx context.Context, gameID int32) ([]models.ListAudienceMembersRow, error) {
	queries := models.New(gs.DB)
	return queries.ListAudienceMembers(ctx, gameID)
}

// CheckAudienceAccess verifies if a user has audience or GM access to a game
// Returns true if the user is:
// - The GM of the game
// - A co-GM participant
// - An active audience member
func (gs *GameService) CheckAudienceAccess(ctx context.Context, gameID, userID int32) (bool, error) {
	queries := models.New(gs.DB)

	result, err := queries.CheckAudienceAccess(ctx, models.CheckAudienceAccessParams{
		GameID: gameID,
		UserID: userID,
	})

	if err != nil {
		return false, fmt.Errorf("failed to check audience access: %w", err)
	}

	return result.Bool, nil
}

// CanUserViewGame checks if a user can view a game's content (read-only access).
// Public Archive Mode: Completed games are viewable by ANY user (not just participants).
// Active Games: Follows normal permission rules (GM, participants, audience).
// Cancelled Games: Follow normal permission rules (NOT public).
func (gs *GameService) CanUserViewGame(ctx context.Context, gameID, userID int32) (bool, error) {
	queries := models.New(gs.DB)

	// Get the game to check its state
	game, err := queries.GetGame(ctx, gameID)
	if err != nil {
		return false, fmt.Errorf("failed to get game: %w", err)
	}

	// Public Archive Mode: Completed games are viewable by anyone
	if game.State.Valid && game.State.String == core.GameStateCompleted {
		return true, nil
	}

	// For non-completed games (including cancelled), use normal permission checks
	// Check if user is GM or any type of participant (player, audience, co_gm)
	isParticipant, err := gs.IsUserInGame(ctx, gameID, userID)
	if err != nil {
		return false, fmt.Errorf("failed to check participation: %w", err)
	}

	return isParticipant, nil
}
