package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	"actionphase/pkg/observability"
)

var _ core.ScoreboardServiceInterface = (*ScoreboardService)(nil)

// ScoreboardService loads what a scoreboard is computed from. The computing,
// and the filtering of hidden values, is core.BuildScoreboard.
type ScoreboardService struct {
	DB     *pgxpool.Pool
	Logger *observability.Logger
}

// GetScoreboard computes the board for a viewer with the given view.
func (s *ScoreboardService) GetScoreboard(ctx context.Context, game *models.Game, view core.ScoreboardView) (*core.ScoreboardResult, error) {
	return s.buildBoard(ctx, game, core.ScoreboardConfigForStored(game.Scoreboard), view)
}

// PreviewScoreboard computes the board players would get from an unsaved config,
// whether or not the board is open to them yet. Players of an archived game see
// every column, so that is what its preview shows.
func (s *ScoreboardService) PreviewScoreboard(ctx context.Context, game *models.Game, config core.ScoreboardConfig) (*core.ScoreboardResult, error) {
	view := core.ScoreboardPlayer
	if core.IsPublicArchive(game.State) {
		view = core.ScoreboardFull
	}
	return s.buildBoard(ctx, game, config, view)
}

func (s *ScoreboardService) buildBoard(ctx context.Context, game *models.Game, config core.ScoreboardConfig, view core.ScoreboardView) (*core.ScoreboardResult, error) {
	characters, tabData, err := s.loadCast(ctx, game.ID)
	if err != nil {
		return nil, err
	}
	return core.BuildScoreboard(core.ScoreboardInput{
		GameState:  game.State,
		Config:     config,
		Sheet:      scoreboardSheet(game),
		Characters: characters,
		TabData:    tabData,
		View:       view,
	}), nil
}

// GetScoreboardEntryNames lists the entry names in use on each tab that can
// feed a column.
func (s *ScoreboardService) GetScoreboardEntryNames(ctx context.Context, game *models.Game) ([]core.ScoreboardTabEntryNames, error) {
	characters, tabData, err := s.loadCast(ctx, game.ID)
	if err != nil {
		return nil, err
	}
	return core.ScoreboardEntryNames(scoreboardSheet(game), characters, tabData), nil
}

// UpdateScoreboardConfig validates and stores the whole config.
func (s *ScoreboardService) UpdateScoreboardConfig(ctx context.Context, game *models.Game, config core.ScoreboardConfig) (core.ScoreboardConfig, error) {
	if err := core.ValidateGameNotCompleted(ctx, game); err != nil {
		return core.ScoreboardConfig{}, err
	}
	validated, err := core.ValidateScoreboardConfig(config)
	if err != nil {
		return core.ScoreboardConfig{}, err
	}
	if err := core.ValidateScoreboardSources(validated, scoreboardSheet(game)); err != nil {
		return core.ScoreboardConfig{}, err
	}
	stored, err := core.MarshalScoreboardConfig(validated)
	if err != nil {
		return core.ScoreboardConfig{}, err
	}
	if _, err := models.New(s.DB).UpdateGameScoreboard(ctx, models.UpdateGameScoreboardParams{
		ID:         game.ID,
		Scoreboard: stored,
	}); err != nil {
		return core.ScoreboardConfig{}, fmt.Errorf("failed to update scoreboard: %w", err)
	}

	s.Logger.Info(ctx, "Game scoreboard updated", "game_id", game.ID, "columns", len(validated.Columns))
	return validated, nil
}

func scoreboardSheet(game *models.Game) core.CharacterSheetConfig {
	if sheet := core.CharacterSheetConfigForResponse(game.CharacterSheet); sheet != nil {
		return *sheet
	}
	return core.CharacterSheetConfig{}
}

// loadCast reads the game's characters and their sheet tabs in two queries,
// however many characters there are.
func (s *ScoreboardService) loadCast(ctx context.Context, gameID int32) ([]core.ScoreboardCharacter, map[int32]map[string]string, error) {
	queries := models.New(s.DB)

	rows, err := queries.GetCharactersByGame(ctx, gameID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get characters: %w", err)
	}
	characters := make([]core.ScoreboardCharacter, 0, len(rows))
	for _, row := range rows {
		character := core.ScoreboardCharacter{
			ID:            row.ID,
			Name:          row.Name,
			CharacterType: row.CharacterType,
			Status:        row.Status,
			IsActive:      row.IsActive,
		}
		if row.AvatarUrl.Valid {
			avatar := row.AvatarUrl.String
			character.AvatarURL = &avatar
		}
		characters = append(characters, character)
	}

	dataRows, err := queries.GetCharacterDataByGame(ctx, gameID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get character data: %w", err)
	}
	tabData := make(map[int32]map[string]string, len(characters))
	for _, row := range dataRows {
		// Other rows of a module aren't its entry list.
		if !row.FieldValue.Valid || row.FieldName != core.SheetStorageFieldName(row.ModuleType) {
			continue
		}
		if tabData[row.CharacterID] == nil {
			tabData[row.CharacterID] = map[string]string{}
		}
		tabData[row.CharacterID][row.ModuleType] = row.FieldValue.String
	}
	return characters, tabData, nil
}
