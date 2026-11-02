// Package gmboard serves the GM results board: per-phase board items and
// per-game board settings, stored one item per row (see core/gm_board.go).
//
// Who may call what:
//   - Writes are the GM level (GM, co-GMs, admin mode).
//   - Reads are the audience level as a floor, and the handler also refuses
//     anyone without the GM flag unless the game shares its boards
//     (games.share_gm_board). With sharing on, that admits the audience while
//     the game runs, and anyone once it is a public archive.
package gmboard

import (
	"context"
	"errors"
	"net/http"
	"reflect"

	"github.com/danielgtaylor/huma/v2"
	"github.com/jackc/pgx/v5"

	"actionphase/pkg/access"
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	"actionphase/pkg/humaconfig"
	"actionphase/pkg/observability"
)

// Handler serves the board routes. Register on the /{gameID} API, after
// access.Middleware and access.ChildScope: ChildScope is what keeps
// {phaseId} inside {gameID}.
type Handler struct {
	App          *core.App
	BoardService core.GmBoardServiceInterface
}

// NotSharedMessage is the detail of the 403 a viewer without the GM flag gets
// while the game doesn't share its boards. Distinct from the access
// middleware's message, so a refusal here is told apart from the gate's.
const NotSharedMessage = "the GM hasn't shared this game's results boards"

// ---------------------------------------------------------------- I/O types

type boardInput struct {
	GameID  int32 `path:"gameID" minimum:"1" doc:"Game ID"`
	PhaseID int32 `path:"phaseId" minimum:"1" doc:"Action phase ID"`
	Since   int64 `query:"since" minimum:"0" doc:"Return only items changed after this cursor, tombstones included. Omit (or 0) for a full load"`
}

type applyBoardInput struct {
	GameID  int32 `path:"gameID" minimum:"1" doc:"Game ID"`
	PhaseID int32 `path:"phaseId" minimum:"1" doc:"Action phase ID"`
	Body    ApplyBoardChangesRequest
}

type settingsInput struct {
	GameID int32 `path:"gameID" minimum:"1" doc:"Game ID"`
	Since  int64 `query:"since" minimum:"0" doc:"Return only items changed after this cursor, tombstones included. Omit (or 0) for a full load"`
}

type applySettingsInput struct {
	GameID int32 `path:"gameID" minimum:"1" doc:"Game ID"`
	Body   ApplySettingsChangesRequest
}

type setSharingInput struct {
	GameID int32 `path:"gameID" minimum:"1" doc:"Game ID"`
	Body   SetSharingRequest
}

type itemsOutput struct{ Body *GmItemsResponse }
type settingsOutput struct{ Body *GmSettingsResponse }
type writtenOutput struct{ Body *GmItemsWrittenResponse }
type sharingOutput struct{ Body *SharingResponse }

// ---------------------------------------------------------------- helpers

func requestGame(ctx context.Context, gameID int32) (*models.Game, error) {
	game, ok := core.RequestGame(ctx, gameID)
	if !ok {
		// GameMiddleware always loads it on this mount.
		return nil, huma.Error500InternalServerError("game not resolved")
	}
	return game, nil
}

// requireViewer applies the sharing rule on top of the audience floor.
func (h *Handler) requireViewer(ctx context.Context, gameID int32) (*models.Game, error) {
	game, err := requestGame(ctx, gameID)
	if err != nil {
		return nil, err
	}
	if isGM, _ := ctx.Value("is_gm").(bool); isGM || game.ShareGmBoard {
		return game, nil
	}
	h.App.ObsLogger.Warn(ctx, "Results board read refused: not shared", "game_id", gameID)
	return nil, huma.Error403Forbidden(NotSharedMessage)
}

func since(v int64) *int64 {
	if v <= 0 {
		return nil
	}
	return &v
}

func toChanges[T BoardItemChange | SettingsItemChange](in []T) []core.GmBoardChange {
	out := make([]core.GmBoardChange, len(in))
	for i, c := range in {
		// Both request types have the same fields; only the kind enum differs.
		b := BoardItemChange(c)
		out[i] = core.GmBoardChange{Kind: b.Kind, Key: b.Key, BaseVersion: b.BaseVersion, Doc: b.Doc, Deleted: b.Deleted}
	}
	return out
}

// writeErr maps a service error from a changes request to its response.
func (h *Handler) writeErr(ctx context.Context, err error, what string, attrs ...any) error {
	var conflict *core.GmBoardConflictError
	switch {
	case errors.As(err, &conflict):
		h.App.ObsLogger.Info(ctx, what+": version conflict", append(attrs, "conflicts", len(conflict.Current))...)
		return newConflictResponse(conflict, humaconfig.CorrelationInstance(observability.GetCorrelationID(ctx)))
	case errors.Is(err, core.ErrGameReadOnly):
		return huma.Error409Conflict("this game is archived, so its results boards can't be changed")
	case errors.Is(err, core.ErrGmBoardNotActionPhase), errors.Is(err, pgx.ErrNoRows):
		return huma.Error404NotFound("only action phases have a results board")
	case errors.Is(err, core.ErrGmBoardItemTooLarge),
		errors.Is(err, core.ErrGmBoardTooManyItems),
		errors.Is(err, core.ErrGmBoardDuplicateChange),
		errors.Is(err, core.ErrGmBoardMissingDoc):
		// These messages are written for people (core/gm_board.go and the
		// service), and name only the item.
		h.App.ObsLogger.Warn(ctx, what+": refused", append(attrs, "error", err)...)
		return huma.Error422UnprocessableEntity(core.CapitalizeSentence(err.Error()))
	default:
		h.App.ObsLogger.Error(ctx, what+": failed", append(attrs, "error", err)...)
		return huma.Error500InternalServerError("failed to save the results board")
	}
}

// ---------------------------------------------------------------- handlers

func (h *Handler) humaGetBoard(ctx context.Context, in *boardInput) (*itemsOutput, error) {
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_gm_board")()
	if _, err := h.requireViewer(ctx, in.GameID); err != nil {
		return nil, err
	}
	items, err := h.BoardService.ListBoardItems(ctx, in.PhaseID, since(in.Since))
	if err != nil {
		if errors.Is(err, core.ErrGmBoardNotActionPhase) || errors.Is(err, pgx.ErrNoRows) {
			return nil, huma.Error404NotFound("only action phases have a results board")
		}
		h.App.ObsLogger.Error(ctx, "Failed to load results board", "error", err, "phase_id", in.PhaseID)
		return nil, huma.Error500InternalServerError("failed to load the results board")
	}
	return &itemsOutput{Body: &GmItemsResponse{Items: toItemResponses(items.Items), Cursor: items.Cursor}}, nil
}

func (h *Handler) humaApplyBoardChanges(ctx context.Context, in *applyBoardInput) (*writtenOutput, error) {
	defer h.App.ObsLogger.LogOperation(ctx, "api_apply_gm_board_changes")()
	user := core.GetAuthenticatedUser(ctx)
	written, err := h.BoardService.ApplyBoardChanges(ctx, in.PhaseID, user.ID, toChanges(in.Body.Changes))
	if err != nil {
		return nil, h.writeErr(ctx, err, "Apply results board changes", "phase_id", in.PhaseID)
	}
	return &writtenOutput{Body: &GmItemsWrittenResponse{Items: toItemResponses(written)}}, nil
}

func (h *Handler) humaGetSettings(ctx context.Context, in *settingsInput) (*settingsOutput, error) {
	defer h.App.ObsLogger.LogOperation(ctx, "api_get_gm_settings")()
	game, err := h.requireViewer(ctx, in.GameID)
	if err != nil {
		return nil, err
	}
	items, err := h.BoardService.ListSettingsItems(ctx, in.GameID, since(in.Since))
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to load results board settings", "error", err, "game_id", in.GameID)
		return nil, huma.Error500InternalServerError("failed to load the results board settings")
	}
	return &settingsOutput{Body: &GmSettingsResponse{
		Items: toItemResponses(items.Items), Cursor: items.Cursor, ShareGmBoard: game.ShareGmBoard,
	}}, nil
}

func (h *Handler) humaApplySettingsChanges(ctx context.Context, in *applySettingsInput) (*writtenOutput, error) {
	defer h.App.ObsLogger.LogOperation(ctx, "api_apply_gm_settings_changes")()
	user := core.GetAuthenticatedUser(ctx)
	written, err := h.BoardService.ApplySettingsChanges(ctx, in.GameID, user.ID, toChanges(in.Body.Changes))
	if err != nil {
		return nil, h.writeErr(ctx, err, "Apply results board settings changes", "game_id", in.GameID)
	}
	return &writtenOutput{Body: &GmItemsWrittenResponse{Items: toItemResponses(written)}}, nil
}

func (h *Handler) humaSetSharing(ctx context.Context, in *setSharingInput) (*sharingOutput, error) {
	defer h.App.ObsLogger.LogOperation(ctx, "api_set_gm_board_sharing")()
	shared, err := h.BoardService.SetShareGmBoard(ctx, in.GameID, in.Body.Share)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to set results board sharing", "error", err, "game_id", in.GameID)
		return nil, huma.Error500InternalServerError("failed to change sharing")
	}
	h.App.ObsLogger.Info(ctx, "Results board sharing changed", "game_id", in.GameID, "share", shared)
	return &sharingOutput{Body: &SharingResponse{ShareGmBoard: shared}}, nil
}

// ---------------------------------------------------------------- registration

// RegisterHumaGmBoard registers the board operations on the /{gameID} API.
func RegisterHumaGmBoard(api huma.API, h *Handler) {
	bearer := []map[string][]string{{"bearerAuth": {}}}
	conflictSchema := api.OpenAPI().Components.Schemas.Schema(reflect.TypeOf(GmBoardConflictResponse{}), true, "")
	conflict := &huma.Response{
		Description: "Another editor changed an item in the batch (conflicts holds their copies), or the game is archived (no conflicts). Nothing was written",
		Content:     map[string]*huma.MediaType{"application/problem+json": {Schema: conflictSchema}},
	}
	readErrors := map[string]*huma.Response{
		"401": {Description: "Not authenticated"},
		"403": {Description: "Not the GM, and the game doesn't share its boards with this viewer"},
		"404": {Description: "No such action phase in this game"},
		"422": {Description: "Request failed validation"},
	}
	writeErrors := map[string]*huma.Response{
		"401": {Description: "Not authenticated"},
		"403": {Description: "Only the GM can change the results board"},
		"404": {Description: "No such action phase in this game"},
		"409": conflict,
		"422": {Description: "Request failed validation, an item is too large, or the board is full"},
	}

	huma.Register(api, huma.Operation{
		OperationID: "getGmBoard",
		Extensions:  access.AudienceOnly(),
		Method:      http.MethodGet,
		Path:        "/phases/{phaseId}/gm-board",
		Summary:     "Load a phase's results board",
		Description: "Returns the board's live items and a cursor, or with since, every item changed after that cursor (tombstones included). GM, or a viewer the board is shared with.",
		Tags:        []string{"Results Board"},
		Security:    bearer,
		Responses:   readErrors,
	}, h.humaGetBoard)

	huma.Register(api, huma.Operation{
		OperationID: "applyGmBoardChanges",
		Extensions:  access.GMOnly(),
		Method:      http.MethodPost,
		Path:        "/phases/{phaseId}/gm-board/changes",
		Summary:     "Save changes to a phase's results board",
		Description: "Applies a batch of item changes in one transaction. If any change names a stale base_version, nothing is written and the 409 carries the current copy of each conflicting item. GM only.",
		Tags:        []string{"Results Board"},
		Security:    bearer,
		Responses:   writeErrors,
	}, h.humaApplyBoardChanges)

	huma.Register(api, huma.Operation{
		OperationID: "getGmSettings",
		Extensions:  access.AudienceOnly(),
		Method:      http.MethodGet,
		Path:        "/gm-settings",
		Summary:     "Load the game's results board settings",
		Description: "The codex, character names, reward template and similar game-level setup, plus whether the boards are shared. Same viewers as the board.",
		Tags:        []string{"Results Board"},
		Security:    bearer,
		Responses: map[string]*huma.Response{
			"401": readErrors["401"], "403": readErrors["403"], "422": readErrors["422"],
		},
	}, h.humaGetSettings)

	huma.Register(api, huma.Operation{
		OperationID: "applyGmSettingsChanges",
		Extensions:  access.GMOnly(),
		Method:      http.MethodPost,
		Path:        "/gm-settings/changes",
		Summary:     "Save changes to the game's results board settings",
		Description: "Same rules as saving board changes. Works before the game has any phase. GM only.",
		Tags:        []string{"Results Board"},
		Security:    bearer,
		Responses: map[string]*huma.Response{
			"401": writeErrors["401"], "403": writeErrors["403"], "409": conflict, "422": writeErrors["422"],
		},
	}, h.humaApplySettingsChanges)

	huma.Register(api, huma.Operation{
		OperationID: "setGmBoardSharing",
		Extensions:  access.GMOnly(),
		Method:      http.MethodPut,
		Path:        "/gm-settings/sharing",
		Summary:     "Share the results boards, or stop sharing them",
		Description: "Read-only sharing: with the audience while the game runs, and with everyone once it is a public archive. Allowed in any game state, so a finished game's boards can be shared. GM only.",
		Tags:        []string{"Results Board"},
		Security:    bearer,
		Responses: map[string]*huma.Response{
			"401": writeErrors["401"], "403": {Description: "Only the GM can change sharing"}, "422": readErrors["422"],
		},
	}, h.humaSetSharing)
}
