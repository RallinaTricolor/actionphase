package messages

// Handler-side gates for restricted Common Room posts. The rule and its facts
// live in the service (ResolveViewerScope, CanUserViewMessage); these helpers
// turn the answers into responses.

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"actionphase/pkg/core"
)

// callerID returns the authenticated user's ID, or 0 when there is none. 0
// matches no allowlist row and no game role, so it fails closed.
func (h *Handler) callerID(ctx context.Context) int32 {
	userID, errResp := core.GetUserIDFromJWT(ctx, h.UserService)
	if errResp != nil {
		return 0
	}
	return userID
}

// viewerScope builds the caller's allowlist scope for one game, once per
// request.
func (h *Handler) viewerScope(ctx context.Context, gameID int32) core.ViewerScope {
	return h.MessageService.ResolveViewerScope(ctx, gameID, h.callerID(ctx))
}

// requireMessageVisible returns a 404 if the caller may not see messageID.
//
// 404, not 403: a 403 would confirm the message exists. A message that does
// not exist gets the same 404 from here, so the two can't be told apart, and
// so does a failed lookup: it is logged and treated as hidden rather than
// turned into a 500.
//
// The check resolves the message's own game and root post, so it holds even
// when the gameID in the URL names a different game.
func (h *Handler) requireMessageVisible(ctx context.Context, messageID int32, resource string) error {
	userID := h.callerID(ctx)
	visible, err := h.MessageService.CanUserViewMessage(ctx, messageID, userID)
	if err != nil {
		h.App.ObsLogger.Warn(ctx, "Message visibility check failed; treating as hidden",
			"error", err, "message_id", messageID, "user_id", userID)
		visible = false
	}
	if !visible {
		return huma.Error404NotFound(resource + " not found")
	}
	return nil
}

// postViewerIDs loads the allowlists for a page of posts, but only for a
// caller who bypasses them. Everyone else gets nil and the field stays absent
// from the response (D8: allowlisted players can't see who else is listed).
func (h *Handler) postViewerIDs(ctx context.Context, scope core.ViewerScope, postIDs []int32) (map[int32][]int32, error) {
	if !scope.SeesAll {
		return nil, nil
	}
	viewers, err := h.MessageService.ListPostViewers(ctx, postIDs)
	if err != nil {
		h.App.ObsLogger.Error(ctx, "Failed to list post viewers", "error", err)
		return nil, huma.Error500InternalServerError("failed to load post viewers")
	}
	return viewers, nil
}

// viewerIDsField renders one post's allowlist for the response: nil (absent)
// when viewers is nil, otherwise always a list, empty for a public post.
func viewerIDsField(viewers map[int32][]int32, postID int32) *[]int32 {
	if viewers == nil {
		return nil
	}
	ids := viewers[postID]
	if ids == nil {
		ids = []int32{}
	}
	return &ids
}

// withPostViewers fills viewer_user_ids on a single post response for a
// caller who bypasses the allowlists. Comments are left alone: the allowlist
// lives on the post.
func (h *Handler) withPostViewers(ctx context.Context, resp *MessageResponse) (*MessageResponse, error) {
	if resp.MessageType != "post" {
		return resp, nil
	}
	viewers, err := h.postViewerIDs(ctx, h.viewerScope(ctx, resp.GameID), []int32{resp.ID})
	if err != nil {
		return nil, err
	}
	resp.ViewerUserIDs = viewerIDsField(viewers, resp.ID)
	return resp, nil
}
