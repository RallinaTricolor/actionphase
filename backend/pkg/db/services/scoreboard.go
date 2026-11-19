package db

import (
	"context"
	"fmt"
	"slices"

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

// GetScoreboard computes the board for a viewer with the given view, from the
// game's stored config as the caller parsed it.
func (s *ScoreboardService) GetScoreboard(ctx context.Context, game *models.Game, config core.ScoreboardConfig, view core.ScoreboardView) (*core.ScoreboardResult, error) {
	return s.buildBoard(ctx, game, config, view)
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
	tabKeys := make([]string, 0, len(config.Columns))
	for _, column := range config.Columns {
		if !slices.Contains(tabKeys, column.TabKey) {
			tabKeys = append(tabKeys, column.TabKey)
		}
	}
	characters, tabData, err := s.loadCast(ctx, game.ID, tabKeys)
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
	sheet := scoreboardSheet(game)
	tabKeys := []string{}
	for _, tabKey := range core.ResolveSheetTabKeys(sheet) {
		if fields, _ := core.ScoreboardNumericFields(sheet, tabKey); len(fields) > 0 {
			tabKeys = append(tabKeys, tabKey)
		}
	}
	characters, tabData, err := s.loadCast(ctx, game.ID, tabKeys)
	if err != nil {
		return nil, err
	}
	return core.ScoreboardEntryNames(sheet, characters, tabData), nil
}

// UpdateScoreboardConfig stores the whole config. It must already have passed
// core.ValidateScoreboardConfig, which the handler's Resolve runs; what is
// checked here is what needs the game.
func (s *ScoreboardService) UpdateScoreboardConfig(ctx context.Context, game *models.Game, config core.ScoreboardConfig) (core.ScoreboardConfig, error) {
	if err := core.ValidateGameNotCompleted(ctx, game); err != nil {
		return core.ScoreboardConfig{}, err
	}
	if err := core.ValidateScoreboardSources(config, scoreboardSheet(game)); err != nil {
		return core.ScoreboardConfig{}, err
	}
	stored, err := core.MarshalScoreboardConfig(config)
	if err != nil {
		return core.ScoreboardConfig{}, err
	}
	if _, err := models.New(s.DB).UpdateGameScoreboard(ctx, models.UpdateGameScoreboardParams{
		ID:         game.ID,
		Scoreboard: stored,
	}); err != nil {
		return core.ScoreboardConfig{}, fmt.Errorf("failed to update scoreboard: %w", err)
	}

	s.Logger.Info(ctx, "Game scoreboard updated", "game_id", game.ID, "columns", len(config.Columns))
	return config, nil
}

func scoreboardSheet(game *models.Game) core.CharacterSheetConfig {
	if sheet := core.CharacterSheetConfigForResponse(game.CharacterSheet); sheet != nil {
		return *sheet
	}
	return core.CharacterSheetConfig{}
}

// loadCast reads the game's characters and the entry lists of the given tabs,
// in two queries run side by side however many characters there are. Only
// those tabs are read: the rest of a sheet (bios, notes) can be long, and the
// board never needs it.
func (s *ScoreboardService) loadCast(ctx context.Context, gameID int32, tabKeys []string) ([]core.ScoreboardCharacter, map[int32]map[string]string, error) {
	queries := models.New(s.DB)

	type tabRows struct {
		rows []models.GetCharacterSheetRowsByGameRow
		err  error
	}
	tabResult := make(chan tabRows, 1)
	if len(tabKeys) == 0 {
		tabResult <- tabRows{}
	} else {
		fieldNames := make([]string, len(tabKeys))
		for i, tabKey := range tabKeys {
			fieldNames[i] = core.SheetStorageFieldName(tabKey)
		}
		go func() {
			var result tabRows
			defer func() {
				if r := recover(); r != nil {
					result = tabRows{err: fmt.Errorf("panic reading character data: %v", r)}
				}
				tabResult <- result
			}()
			result.rows, result.err = queries.GetCharacterSheetRowsByGame(ctx, models.GetCharacterSheetRowsByGameParams{
				GameID:      gameID,
				ModuleTypes: tabKeys,
				FieldNames:  fieldNames,
			})
		}()
	}

	rows, err := queries.GetCharactersByGame(ctx, gameID)
	// Always received, so the goroutine never outlives the request.
	tabs := <-tabResult
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get characters: %w", err)
	}
	if tabs.err != nil {
		return nil, nil, fmt.Errorf("failed to get character data: %w", tabs.err)
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

	tabData := make(map[int32]map[string]string, len(characters))
	for _, row := range tabs.rows {
		// The query matches module and field separately; other rows of a
		// module aren't its entry list.
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
