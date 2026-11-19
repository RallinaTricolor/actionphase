// Package scoreboard serves a game's scoreboard: the computed board, and the
// GM's setup for it.
package scoreboard

import (
	"context"
	"errors"
	"net/http"

	"github.com/danielgtaylor/huma/v2"

	"actionphase/pkg/access"
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

// Handler serves the scoreboard operations.
type Handler struct {
	App               *core.App
	ScoreboardService core.ScoreboardServiceInterface
}

type gameInput struct {
	GameID int32 `path:"gameID" doc:"Game ID"`
}

type updateConfigInput struct {
	GameID int32 `path:"gameID" doc:"Game ID"`
	// The whole document, not a patch: the editor always sends all of it.
	Body core.ScoreboardConfig
}

// Resolve checks and normalizes the config on its own terms, so a bad one is a
// 422 naming the problem. This is the only place that runs: the service takes a
// validated config. Whether it fits the game's sheet needs the game, so the
// service checks that on save.
func (in *updateConfigInput) Resolve(huma.Context) []error {
	validated, err := core.ValidateScoreboardConfig(in.Body)
	if err != nil {
		return []error{&huma.ErrorDetail{
			Message:  core.UserMessage(err, core.ErrInvalidScoreboardConfig),
			Location: "body",
		}}
	}
	in.Body = validated
	return nil
}

type scoreboardOutput struct {
	Body *core.ScoreboardResult
}

type configOutput struct {
	Body core.ScoreboardConfig
}

type entryNamesOutput struct {
	Body *EntryNamesResponse
}

func gameFromCtx(ctx context.Context) (*models.Game, error) {
	game, ok := ctx.Value("game").(*models.Game)
	if !ok || game == nil {
		return nil, huma.Error500InternalServerError("game context missing")
	}
	return game, nil
}

func (h *Handler) internalError(ctx context.Context, msg string, err error, gameID int32) error {
	h.App.ObsLogger.Error(ctx, msg, "error", err, "game_id", gameID)
	return huma.Error500InternalServerError("unexpected error")
}

func (h *Handler) humaGetScoreboard(ctx context.Context, _ *gameInput) (*scoreboardOutput, error) {
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_scoreboard")()

	game, err := gameFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	user := core.GetAuthenticatedUser(ctx)
	if user == nil {
		return nil, huma.Error401Unauthorized("authentication required")
	}

	// Off, or closed to this viewer: either way there is no board for them. This
	// isn't concealment; the game's details already say whether a board exists
	// and who it is open to.
	notFound := huma.Error404NotFound("scoreboard not found")
	// Checked first, so a game without a board costs no role lookup.
	if !game.ScoreboardEnabled {
		return nil, notFound
	}

	config := core.ScoreboardConfigForStored(game.Scoreboard)
	isGM, _ := ctx.Value("is_gm").(bool)
	view := core.ScoreboardViewFor(
		game.State,
		game.ScoreboardEnabled,
		config.ResolvedVisibility(),
		core.ResolveGameRole(ctx, h.App.Pool, game.ID, user.ID, isGM),
		isGM,
		user.IsAdmin && core.GetAdminMode(ctx),
	)
	if view == core.ScoreboardNone {
		return nil, notFound
	}

	board, err := h.ScoreboardService.GetScoreboard(ctx, game, config, view)
	if err != nil {
		return nil, h.internalError(ctx, "Failed to build scoreboard", err, game.ID)
	}
	return &scoreboardOutput{Body: board}, nil
}

func (h *Handler) humaGetConfig(ctx context.Context, _ *gameInput) (*configOutput, error) {
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_scoreboard_config")()

	game, err := gameFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	return &configOutput{Body: core.ScoreboardConfigForStored(game.Scoreboard)}, nil
}

func (h *Handler) humaUpdateConfig(ctx context.Context, in *updateConfigInput) (*configOutput, error) {
	defer h.App.ObsLogger.LogOperation(ctx, "api_update_scoreboard_config")()

	game, err := gameFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	stored, err := h.ScoreboardService.UpdateScoreboardConfig(ctx, game, in.Body)
	switch {
	case err == nil:
		return &configOutput{Body: stored}, nil
	case errors.Is(err, core.ErrInvalidScoreboardConfig):
		return nil, huma.Error422UnprocessableEntity(core.UserMessage(err, core.ErrInvalidScoreboardConfig))
	case errors.Is(err, core.ErrGameReadOnly):
		return nil, huma.Error409Conflict("an archived game's scoreboard cannot be changed")
	default:
		return nil, h.internalError(ctx, "Failed to update scoreboard", err, game.ID)
	}
}

func (h *Handler) humaPreview(ctx context.Context, in *updateConfigInput) (*scoreboardOutput, error) {
	defer h.App.ObsLogger.LogOperation(ctx, "api_preview_scoreboard")()

	game, err := gameFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	board, err := h.ScoreboardService.PreviewScoreboard(ctx, game, in.Body)
	if err != nil {
		return nil, h.internalError(ctx, "Failed to preview scoreboard", err, game.ID)
	}
	return &scoreboardOutput{Body: board}, nil
}

func (h *Handler) humaGetEntryNames(ctx context.Context, _ *gameInput) (*entryNamesOutput, error) {
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_scoreboard_entry_names")()

	game, err := gameFromCtx(ctx)
	if err != nil {
		return nil, err
	}
	tabs, err := h.ScoreboardService.GetScoreboardEntryNames(ctx, game)
	if err != nil {
		return nil, h.internalError(ctx, "Failed to list scoreboard entry names", err, game.ID)
	}
	return &entryNamesOutput{Body: &EntryNamesResponse{Tabs: tabs}}, nil
}

// RegisterHumaGameScoreboard registers the scoreboard operations. Paths are
// relative to the /games/{gameID} subrouter.
func RegisterHumaGameScoreboard(api huma.API, h *Handler) {
	bearer := []map[string][]string{{"BearerAuth": {}}}

	huma.Register(api, huma.Operation{
		OperationID: "getGameScoreboard",
		Extensions:  access.CheckedInHandler("depends on the board's own visibility setting; decided by core.ScoreboardViewFor"),
		Method:      http.MethodGet,
		Path:        "/scoreboard",
		Summary:     "Get the scoreboard",
		Description: "Returns the board as the caller may see it. Players never receive hidden columns or the values behind range labels.",
		Tags:        []string{"Scoreboard"},
		Security:    bearer,
		Responses: map[string]*huma.Response{
			"401": {Description: "Not authenticated"},
			"404": {Description: "The game has no scoreboard this caller may see"},
		},
	}, h.humaGetScoreboard)

	huma.Register(api, huma.Operation{
		OperationID: "getGameScoreboardConfig",
		Extensions:  access.GMOnly(),
		Method:      http.MethodGet,
		Path:        "/scoreboard/config",
		Summary:     "Get the scoreboard setup",
		Description: "Returns the stored visibility, columns and sort for the editor.",
		Tags:        []string{"Scoreboard"},
		Security:    bearer,
		Responses: map[string]*huma.Response{
			"401": {Description: "Not authenticated"},
			"403": {Description: "Only the GM can read the scoreboard setup"},
		},
	}, h.humaGetConfig)

	huma.Register(api, huma.Operation{
		OperationID: "updateGameScoreboardConfig",
		Extensions:  access.GMOnly(),
		Method:      http.MethodPut,
		Path:        "/scoreboard/config",
		Summary:     "Replace the scoreboard setup",
		Description: "Validates the whole config against the game's character sheet and stores it.",
		Tags:        []string{"Scoreboard"},
		Security:    bearer,
		Responses: map[string]*huma.Response{
			"401": {Description: "Not authenticated"},
			"403": {Description: "Only the GM can change the scoreboard"},
			"409": {Description: "The game is archived"},
			"422": {Description: "The config is invalid or doesn't fit the character sheet"},
		},
	}, h.humaUpdateConfig)

	huma.Register(api, huma.Operation{
		OperationID: "previewGameScoreboard",
		Extensions:  access.GMOnly(),
		Method:      http.MethodPost,
		Path:        "/scoreboard/preview",
		Summary:     "Preview the scoreboard as a player",
		Description: "Computes the board players would get from the given setup. Nothing is stored.",
		Tags:        []string{"Scoreboard"},
		Security:    bearer,
		Responses: map[string]*huma.Response{
			"401": {Description: "Not authenticated"},
			"403": {Description: "Only the GM can preview the scoreboard"},
			"422": {Description: "The config is invalid"},
		},
	}, h.humaPreview)

	huma.Register(api, huma.Operation{
		OperationID: "getGameScoreboardEntryNames",
		Extensions:  access.GMOnly(),
		Method:      http.MethodGet,
		Path:        "/scoreboard/entry-names",
		Summary:     "List entry names for scoreboard columns",
		Description: "Lists the entry names player characters use on each tab with a number or track field.",
		Tags:        []string{"Scoreboard"},
		Security:    bearer,
		Responses: map[string]*huma.Response{
			"401": {Description: "Not authenticated"},
			"403": {Description: "Only the GM can read this list"},
		},
	}, h.humaGetEntryNames)
}
