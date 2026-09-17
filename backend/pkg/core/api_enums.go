package core

import "github.com/danielgtaylor/huma/v2"

// API enum types: named string types that derive their OpenAPI schema from the
// canonical Go slices rather than repeating the members in a struct tag.
//
// The alternative -- `enum:"setup,recruitment,..."` on each field -- would make
// the spec correct but reintroduce the problem it was meant to solve: a second
// hand-maintained list, in a struct tag where nothing can check it against
// ValidGameStates. These types read the slice at schema-generation time, so
// adding a state to ValidGameStates updates every schema that uses it, and
// through the generated spec, the frontend's TypeScript union as well.
//
// Huma calls Schema() once per type while rendering the document. Note that it
// INLINES scalar schemas rather than emitting a $ref -- huma only refs structs
// -- so the spec repeats the enum at each site and there is no
// components/schemas/GameState to alias. The frontend therefore names these
// unions by indexing into a generated schema; see frontend/src/types/games.ts.
//
// These are deliberately confined to the API boundary -- the response and
// request structs huma reflects over. core.Game.State and the service layer
// stay plain strings: they are internal, they are compared against the
// GameState* constants (which are untyped string constants and so assign to
// either), and widening the change there would add conversions at 65 call
// sites to describe a wire format none of them are part of.

// GameState is a game's lifecycle state, as it appears in the API.
//
// The schema enumerates ValidGameStates, so this type and the const block it
// draws from cannot disagree.
type GameState string

// Schema implements huma.SchemaProvider.
func (GameState) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{
		Type:        "string",
		Enum:        enumValues(ValidGameStates),
		Description: "Game lifecycle state",
	}
}

// WebhookEvent is a game state a community webhook may subscribe to.
//
// A strict subset of GameState: setup is excluded, because announcing a game
// still in setup would leak an unlisted game into a Discord channel before its
// GM has shown it to anyone. That exclusion lives in ValidWebhookEvents, and
// this schema follows it -- so the narrower set reaches the frontend as a
// narrower union, and a picker cannot offer setup by construction.
type WebhookEvent string

// Schema implements huma.SchemaProvider.
func (WebhookEvent) Schema(huma.Registry) *huma.Schema {
	return &huma.Schema{
		Type:        "string",
		Enum:        enumValues(ValidWebhookEvents),
		Description: "Game state a webhook may announce; setup is excluded",
	}
}

// enumValues converts a canonical []string to the []any huma.Schema.Enum wants.
func enumValues(values []string) []any {
	out := make([]any, 0, len(values))
	for _, v := range values {
		out = append(out, v)
	}
	return out
}

// GameStates and WebhookEvents convert at the API boundary, where a []string
// from sqlc or the service layer becomes the typed slice a response declares.
//
// Neither VALIDATES. They are converters, not gates: the service layer already
// rejects an unknown webhook event on the way in (validateWebhookEvents), and
// dropping an unrecognised value on the way out would hide a bad row rather
// than surface it. Rows written before that validation existed can still hold
// anything, and a masking converter is not the place to discover it.
//
// A nil slice converts to nil rather than an empty slice, so `events: null`
// does not silently become `events: []` in a response.

// GameStates converts a slice of raw state strings to typed game states.
func GameStates(values []string) []GameState {
	if values == nil {
		return nil
	}
	out := make([]GameState, 0, len(values))
	for _, v := range values {
		out = append(out, GameState(v))
	}
	return out
}

// WebhookEvents converts a slice of raw event strings to typed webhook events.
func WebhookEvents(values []string) []WebhookEvent {
	if values == nil {
		return nil
	}
	out := make([]WebhookEvent, 0, len(values))
	for _, v := range values {
		out = append(out, WebhookEvent(v))
	}
	return out
}

// WebhookEventStrings is the inverse, for handing a typed slice to the service
// layer and sqlc, both of which speak []string.
func WebhookEventStrings(values []WebhookEvent) []string {
	if values == nil {
		return nil
	}
	out := make([]string, 0, len(values))
	for _, v := range values {
		out = append(out, string(v))
	}
	return out
}
