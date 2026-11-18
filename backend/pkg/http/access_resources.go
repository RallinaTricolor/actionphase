package http

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"actionphase/pkg/access"
	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
)

// Every mount that gates with gateResource must also be listed in
// resourceRoutePrefixes (access_spec_test.go); every other top-level mount goes
// in nonGameRoutePrefixes there. The spec test fails on a path in neither.

// gameAccess is the access.ResourceChecker the resource mounts share.
type gameAccess struct{ *db.GameService }

func (g gameAccess) IsGameMaster(ctx context.Context, game *models.Game, user *core.AuthenticatedUser) bool {
	return core.IsUserGameMasterCtx(ctx, user.ID, user.IsAdmin, *game, g.DB)
}

// gateResource installs access.ResourceMiddleware on api. Call it right after
// creating the API, before anything registers on it.
func (h *Handler) gateResource(api huma.API, res access.Resource) {
	checker := gameAccess{&db.GameService{DB: h.App.Pool, Logger: h.App.ObsLogger}}
	api.UseMiddleware(access.ResourceMiddleware(api, h.App, checker, res))
}

// The resources, each resolved by the same query its handlers load it with.
// A missing row surfaces as pgx.ErrNoRows, which the middleware answers 404.

func (h *Handler) characterResource() access.Resource {
	q := models.New(h.App.Pool)
	return access.Resource{Name: "character", Param: "id", GameOf: func(ctx context.Context, id int32) (int32, error) {
		row, err := q.GetCharacter(ctx, id)
		return row.GameID, err
	}}
}

func (h *Handler) phaseResource() access.Resource {
	q := models.New(h.App.Pool)
	return access.Resource{Name: "phase", Param: "id", GameOf: func(ctx context.Context, id int32) (int32, error) {
		row, err := q.GetPhase(ctx, id)
		return row.GameID, err
	}}
}

func (h *Handler) deadlineResource() access.Resource {
	q := models.New(h.App.Pool)
	return access.Resource{Name: "deadline", Param: "deadlineId", GameOf: func(ctx context.Context, id int32) (int32, error) {
		row, err := q.GetDeadline(ctx, id)
		return row.GameID, err
	}}
}

func (h *Handler) exportResource() access.Resource {
	q := models.New(h.App.Pool)
	return access.Resource{Name: "export", Param: "exportID", GameOf: func(ctx context.Context, id int32) (int32, error) {
		row, err := q.GetGameExport(ctx, id)
		return row.GameID, err
	}}
}

func (h *Handler) pollResource() access.Resource {
	q := models.New(h.App.Pool)
	return access.Resource{Name: "poll", Param: "pollId", GameOf: func(ctx context.Context, id int32) (int32, error) {
		row, err := q.GetPoll(ctx, id)
		return row.GameID, err
	}}
}

// childParams maps every child-ID path shape under /games/{gameID} (the path
// up to and including the ID, relative to {gameID}) to what it names.
// access.ChildScope refuses a request unless each such row is in {gameID}, and
// each nested row (InParent) is under the ID before it. Keyed by shape rather
// than parameter name, because the same name means different rows in
// different places: commentId is a handout comment under /handouts and a
// Common Room comment under /posts.
//
// An empty Child is a path ID that names no game row (a user), so there is
// nothing to scope. A shape missing from this map is refused with a 500 and
// fails TestGameScopedOperationsDeclareAccess.
var childParams = map[string]access.Child{
	"/applications/{applicationId}":                        {Kind: "application"},
	"/loot-tables/{tableId}":                               {Kind: "loot table"},
	"/loot-tables/{tableId}/random/{characterId}":          {Kind: "character"},
	"/handouts/{handoutId}":                                {Kind: "handout"},
	"/handouts/{handoutId}/comments/{commentId}":           {Kind: "handout comment", InParent: true},
	"/posts/{postId}":                                      {Kind: "post"},
	"/posts/{postId}/comments/{commentId}":                 {Kind: "comment", InParent: true},
	"/messages/{messageId}":                                {Kind: "message"},
	"/conversations/{conversationId}":                      {Kind: "conversation"},
	"/conversations/{conversationId}/messages/{messageId}": {Kind: "private message", InParent: true},
	"/private-messages/conversations/{conversationId}":     {Kind: "conversation"},
	"/phases/{phaseId}":                                    {Kind: "phase"},
	"/phases/{phaseId}/characters/{characterId}":           {Kind: "character"},
	"/results/{resultId}":                                  {Kind: "action result"},
	"/results/{resultId}/character-updates/{draftId}":      {Kind: "character update", InParent: true},
	"/participants/{userId}":                               {},
}

// childOwnerOf resolves each kind in childParams to its owner: its game, or
// for an InParent kind, its parent row.
func (h *Handler) childOwnerOf() map[string]func(context.Context, int32) (int32, error) {
	q := models.New(h.App.Pool)
	return map[string]func(context.Context, int32) (int32, error){
		"application":   q.GameIDOfApplication,
		"loot table":    q.GameIDOfLootTable,
		"character":     q.GameIDOfCharacter,
		"handout":       q.GameIDOfHandout,
		"post":          q.GameIDOfMessage,
		"message":       q.GameIDOfMessage,
		"conversation":  q.GameIDOfConversation,
		"phase":         q.GameIDOfPhase,
		"action result": q.GameIDOfActionResult,
		// Nested: these answer the parent's ID.
		"handout comment":  q.HandoutOfHandoutComment,
		"comment":          q.RootPostOfComment, // the thread's top-level post
		"private message":  q.ConversationOfPrivateMessage,
		"character update": q.ActionResultOfCharacterUpdate,
	}
}
