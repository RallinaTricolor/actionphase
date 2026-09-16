package http

import (
	"testing"

	"actionphase/pkg/core"
)

// The spec is the contract the frontend's TypeScript is generated from, so a
// field typed as a bare `string` where only a fixed set of values is accepted
// becomes a `string` in TypeScript too -- and every consumer loses the check.
//
// These tests pin the two properties that matter and cannot be checked by the
// Go compiler:
//
//   - the enum MEMBERS match the canonical Go slice, so the spec cannot drift
//     from core.ValidGameStates / core.ValidWebhookEvents
//   - `password` is REQUIRED on login, which it was not: it was declared
//     required:"false" while the handler has no branch that accepts a request
//     without one
//
// They assert against the rendered document rather than the committed YAML:
// check-api-docs already proves those two agree, and reading the live document
// means a failure here points at the Go type rather than at a stale artifact.

// schemaProperty walks components.schemas.<name>.properties.<prop>.
func schemaProperty(t *testing.T, doc map[string]any, schema, prop string) map[string]any {
	t.Helper()

	components, _ := doc["components"].(map[string]any)
	schemas, _ := components["schemas"].(map[string]any)
	s, ok := schemas[schema].(map[string]any)
	if !ok {
		t.Fatalf("schema %q is not in the rendered spec", schema)
	}
	props, _ := s["properties"].(map[string]any)
	p, ok := props[prop].(map[string]any)
	if !ok {
		t.Fatalf("schema %q has no property %q", schema, prop)
	}
	return p
}

// enumOf reads a property's enum as a []string, failing when it has none.
func enumOf(t *testing.T, doc map[string]any, schema, prop string) []string {
	t.Helper()

	p := schemaProperty(t, doc, schema, prop)
	raw, ok := p["enum"].([]any)
	if !ok {
		t.Fatalf("%s.%s has no enum -- it renders as a bare %v, so the generated "+
			"TypeScript is `string` and every consumer loses the check",
			schema, prop, p["type"])
	}

	out := make([]string, 0, len(raw))
	for _, v := range raw {
		s, _ := v.(string)
		out = append(out, s)
	}
	return out
}

func assertSameMembers(t *testing.T, label string, got, want []string) {
	t.Helper()

	if len(got) != len(want) {
		t.Errorf("%s: spec enum has %d members, canonical slice has %d\n  spec: %v\n  Go:   %v",
			label, len(got), len(want), got, want)
		return
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("%s: spec enum differs from the canonical slice\n  spec: %v\n  Go:   %v",
				label, got, want)
			return
		}
	}
}

// TestGameStateSchemasEnumerateValidGameStates covers every schema carrying a
// game state, request and response alike.
//
// Responses matter as much as the request body: the frontend's GameState union
// is read off a response schema, and typing state as a bare string there would
// leave the union as `string` no matter what the request body declares.
func TestGameStateSchemasEnumerateValidGameStates(t *testing.T) {
	doc := specDocument(t)

	// Every schema with a game state in it. Adding a game-bearing response
	// means adding it here -- the spec cannot enumerate these for us, because
	// a property named "state" on an unrelated schema need not be a game state.
	for _, schema := range []string{
		"UpdateGameStateBody",
		"GameResponse",
		"GameWithDetailsResponse",
		"EnrichedGameListItemResponse",
		"DashboardGameCard",
		"UserGame",
	} {
		t.Run(schema, func(t *testing.T) {
			assertSameMembers(t, schema+".state",
				enumOf(t, doc, schema, "state"), core.ValidGameStates)
		})
	}
}

// TestAvailableStatesEnumeratesValidGameStates covers the listing metadata,
// where the states arrive as an array rather than a single value.
func TestAvailableStatesEnumeratesValidGameStates(t *testing.T) {
	doc := specDocument(t)

	p := schemaProperty(t, doc, "GameListingMetadataResponse", "available_states")
	items, ok := p["items"].(map[string]any)
	if !ok {
		t.Fatal("GameListingMetadataResponse.available_states has no items schema")
	}
	raw, ok := items["enum"].([]any)
	if !ok {
		t.Fatalf("available_states items have no enum -- renders as %v[]", items["type"])
	}

	got := make([]string, 0, len(raw))
	for _, v := range raw {
		s, _ := v.(string)
		got = append(got, s)
	}
	assertSameMembers(t, "GameListingMetadataResponse.available_states", got, core.ValidGameStates)
}

// TestWebhookEventSchemasExcludeSetup pins the narrower set.
//
// Not just "has an enum": the point of ValidWebhookEvents is that `setup` is
// absent, so a webhook cannot announce a game its GM has not shown anyone. A
// spec that enumerated all eight states would hand the frontend a picker that
// offers setup, which the service layer would then reject.
func TestWebhookEventSchemasExcludeSetup(t *testing.T) {
	doc := specDocument(t)

	for _, schema := range []string{"CreateWebhookInputBody", "UpdateWebhookInputBody", "CommunityWebhook"} {
		t.Run(schema, func(t *testing.T) {
			p := schemaProperty(t, doc, schema, "events")
			items, ok := p["items"].(map[string]any)
			if !ok {
				t.Fatalf("%s.events has no items schema", schema)
			}
			raw, ok := items["enum"].([]any)
			if !ok {
				t.Fatalf("%s.events items have no enum -- renders as %v[]", schema, items["type"])
			}

			got := make([]string, 0, len(raw))
			for _, v := range raw {
				s, _ := v.(string)
				got = append(got, s)
				if s == core.GameStateSetup {
					t.Errorf("%s.events admits %q: a webhook must not be able to "+
						"announce a game that is still in setup", schema, core.GameStateSetup)
				}
			}
			assertSameMembers(t, schema+".events", got, core.ValidWebhookEvents)
		})
	}
}

// TestLoginRequiresPassword is the regression test for a spec bug.
//
// loginBody declared `password` as required:"false", alongside username and
// email which genuinely are optional -- either may carry the identifier, and
// the handler rejects the request when both are empty. Password is not like
// them: HumaLogin passes it straight to CheckPasswordHash and there is no
// branch that accepts its absence. The false declaration propagated into the
// generated TypeScript as `password?: string`, so a payload with no password
// type-checked on the client and failed at runtime.
//
// RegisterBody, two hundred lines down the same file, has always had this
// right -- which is what marks it as an oversight rather than a decision.
func TestLoginRequiresPassword(t *testing.T) {
	doc := specDocument(t)

	components, _ := doc["components"].(map[string]any)
	schemas, _ := components["schemas"].(map[string]any)
	login, ok := schemas["LoginBody"].(map[string]any)
	if !ok {
		t.Fatal("LoginBody is not in the rendered spec")
	}

	required := map[string]bool{}
	list, _ := login["required"].([]any)
	for _, raw := range list {
		if s, ok := raw.(string); ok {
			required[s] = true
		}
	}

	if !required["password"] {
		t.Error("LoginBody does not require `password`; the generated client type " +
			"makes it optional, so a payload with no password type-checks and " +
			"fails at runtime instead of at build time")
	}

	// The identifier fields must stay optional: there are two of them for one
	// value, so neither can be required on its own. Asserted so a later change
	// cannot "fix" the asymmetry by requiring username and breaking email login.
	for _, field := range []string{"username", "email"} {
		if required[field] {
			t.Errorf("LoginBody requires %q, but login accepts either a username "+
				"or an email -- requiring one breaks the other path", field)
		}
	}
}

// TestResponseEnumsMatchRequestEnums covers closed sets that the REQUEST body
// declares but the RESPONSE schema does not.
//
// The asymmetry is invisible from Go: both sides are `string`, and only the
// struct tag decides whether the spec says so. It matters because the frontend
// reads its unions off response schemas -- a bare `string` there hands every
// consumer an unchecked value even when the request half is airtight.
//
// Each case below has a canonical definition already in the codebase, so these
// assert against that definition rather than against a repeated literal:
//
//   - DraftCharacterUpdateResponse: createDraftUpdateBody already tags all
//     three, and the values match the check constraints on
//     action_result_character_updates.
//   - CommunityBanEvent.action / CommunityDocument.status: core owns the
//     canonical slices, and the frontend hand-wrote the same unions to
//     compensate -- BanHistoryTab keys two Record lookups off its copy.
//   - CharacterDataResponse.field_type is tagged; the phases twin is not, which
//     is what marks the gap as an oversight rather than a decision.
func TestResponseEnumsMatchRequestEnums(t *testing.T) {
	doc := specDocument(t)

	for _, tc := range []struct {
		schema string
		prop   string
		want   []string
	}{
		{"DraftCharacterUpdateResponse", "module_type", []string{"skills", "inventory", "numbers"}},
		{"DraftCharacterUpdateResponse", "field_type", []string{"text", "number", "boolean", "json"}},
		{"DraftCharacterUpdateResponse", "operation", []string{"upsert", "delete"}},
		{"CommunityBanEvent", "action", core.ValidBanEventActions},
		{"CommunityDocument", "status", core.ValidDocumentStatuses},
	} {
		t.Run(tc.schema+"."+tc.prop, func(t *testing.T) {
			assertSameMembers(t, tc.schema+"."+tc.prop,
				enumOf(t, doc, tc.schema, tc.prop), tc.want)
		})
	}
}

// TestCurrentUserResponseHasASchema pins a contract the spec does not describe
// at all.
//
// /me answers with a user object or {"user": null}, and meOutput carries the
// two in a `Body any`. huma cannot reflect `any`, so the operation renders as
// `schema: {}` -- the generated TypeScript for the endpoint the frontend polls
// on every page load is `unknown`.
//
// The fix is to declare the union explicitly rather than to collapse it: the
// response really is one shape or the other, never a merge, so a single
// flattened object with everything optional would describe a payload the server
// never sends.
func TestCurrentUserResponseHasASchema(t *testing.T) {
	doc := specDocument(t)

	paths, _ := doc["paths"].(map[string]any)
	me, ok := paths["/auth/me"].(map[string]any)
	if !ok {
		t.Fatal("/auth/me is not in the rendered spec")
	}
	get, _ := me["get"].(map[string]any)
	responses, _ := get["responses"].(map[string]any)
	ok200, _ := responses["200"].(map[string]any)
	content, _ := ok200["content"].(map[string]any)
	json, _ := content["application/json"].(map[string]any)
	schema, _ := json["schema"].(map[string]any)

	if len(schema) == 0 {
		t.Fatal("GET /auth/me renders `schema: {}` -- the generated client type " +
			"is `unknown`, so the most-polled endpoint in the app carries no " +
			"contract at all")
	}
	if _, hasOneOf := schema["oneOf"]; !hasOneOf {
		t.Errorf("GET /auth/me does not declare a oneOf: the response is a user "+
			"object OR {\"user\": null}, never a merge, so a single object "+
			"schema would describe a payload the server never sends (got %v)",
			schema)
	}
}

// TestResponseArraysAreNotNullable pins array fields that can never be null.
//
// huma renders EVERY bare []T as nullable (DefaultArrayNullable), because a nil
// Go slice marshals to JSON `null`. That default is wrong for these seven: each
// is provably non-nil at its construction site, so the spec over-reports and the
// generated TypeScript forces `?? []` handling at call sites that can never see
// null. PollResults.tsx reads `results.other_responses.length` unguarded today
// and is correct to.
//
// Traced individually rather than assumed -- four are make()'d to a known length
// and two carry an explicit `if ids == nil { ids = []int32{} }` guard written by
// someone who had already hit this:
//
//	PollResultsResponse.option_results   make([]OptionResult, len(...))
//	PollResultsResponse.other_responses  make([]OtherResponse, len(...))
//	MessageThreadContextResponse.chain   make([]*MessageResponse, len(...))
//	GameListingResponse.games            make([]*EnrichedGameListItemResponse, len(...))
//	UserProfileResponse.games            make([]core.UserGame, 0, len(gameMap))
//	PostUnreadCommentsResponse.unread_comment_ids  unreadIDs := []int32{} per row
//	FavoriteCommentIDsResponse.favorite_comment_ids  explicit nil guard
//	UserGame.characters                  []core.UserGameCharacter{} on map insert
//
// NOT included, deliberately: GameListingMetadataResponse.available_states is
// genuinely nullable -- core.GameStates returns nil for a nil input, and the
// service assigns the query result straight through. Its `| null` is accurate,
// which is why these are tagged per field rather than by flipping the global
// huma.DefaultArrayNullable.
//
// Fixed with `nullable:"false"` per field rather than flipping the global
// DefaultArrayNullable: 46 array properties exist across the spec, including
// request bodies whose nullability has not been traced, and only these seven
// were verified.
func TestResponseArraysAreNotNullable(t *testing.T) {
	doc := specDocument(t)

	for _, tc := range []struct{ schema, prop string }{
		{"PollResultsResponse", "option_results"},
		{"PollResultsResponse", "other_responses"},
		{"MessageThreadContextResponse", "chain"},
		{"GameListingResponse", "games"},
		{"UserProfileResponse", "games"},
		{"PostUnreadCommentsResponse", "unread_comment_ids"},
		{"FavoriteCommentIDsResponse", "favorite_comment_ids"},
		{"UserGame", "characters"},
	} {
		t.Run(tc.schema+"."+tc.prop, func(t *testing.T) {
			p := schemaProperty(t, doc, tc.schema, tc.prop)

			// A nullable array renders as type: [array, null]; a non-nullable
			// one as the bare string "array".
			switch got := p["type"].(type) {
			case string:
				if got != "array" {
					t.Errorf("%s.%s has type %q, want \"array\"", tc.schema, tc.prop, got)
				}
			default:
				t.Errorf("%s.%s renders as %v -- the generated TypeScript is "+
					"`T[] | null`, forcing null handling at call sites that can "+
					"never see null", tc.schema, tc.prop, got)
			}
		})
	}
}

// TestCommunityBanUsernameIsOptional pins an asymmetry between the two
// endpoints that both answer with a CommunityBan.
//
// The banlist (GET /communities/{slug}/bans) joins the users table, so every
// row it returns carries a username. The ban itself (POST .../bans) returns the
// bare INSERT ... RETURNING row, which has no joined user columns at all --
// banFromDB sets ID, CommunityID, UserID, Reason, BannedByUserID, BannedAt,
// ExpiresAt and IsActive, and nothing else. Its own doc comment says so:
// "Callers needing the username re-list."
//
// So `username` is genuinely absent on one of the two responses, and the
// `omitempty` on core.CommunityBan.Username is correct. This test exists
// because the hand-written frontend type declared it REQUIRED, which would
// promise a field the create path never sends -- a consumer that rendered
// `ban.username` off the mutation result would print "undefined" with no
// build-time warning. Pinning it optional here keeps the generated type honest.
//
// If a future change joins the username onto the create path too, this test
// should be deleted rather than worked around -- but delete it deliberately,
// after checking BOTH converters in
// pkg/db/services/communities/converters.go.
func TestCommunityBanUsernameIsOptional(t *testing.T) {
	doc := specDocument(t)

	components, _ := doc["components"].(map[string]any)
	schemas, _ := components["schemas"].(map[string]any)
	ban, ok := schemas["CommunityBan"].(map[string]any)
	if !ok {
		t.Fatal("CommunityBan is not in the rendered spec")
	}

	// The property must exist -- optional is not the same as absent.
	props, _ := ban["properties"].(map[string]any)
	if _, hasProp := props["username"]; !hasProp {
		t.Fatal("CommunityBan has no `username` property at all; the banlist " +
			"joins it and the management view renders it")
	}

	for _, raw := range ban["required"].([]any) {
		if s, _ := raw.(string); s == "username" {
			t.Error("CommunityBan requires `username`, but POST /communities/" +
				"{slug}/bans returns banFromDB, which never sets it -- the " +
				"generated client type would promise a field that response omits")
		}
	}
}

// TestUpdateGameStateResponseMatchesWhatItSends is the regression test for a
// spec that advertises a contract the handler does not honour.
//
// PUT /games/{gameID}/state declares GameResponse, which has 28 properties. The
// handler fills SEVEN of them -- id, title, description, gm_user_id, state,
// created_at, updated_at -- and its own comment says so. Everything else is
// left at its zero value, which for the four booleans means they marshal as
// `false` whatever the game actually has stored. A client that trusted the
// declared type would read is_anonymous:false off a game that is anonymous.
//
// That is worse than an undocumented response: the spec is confidently wrong,
// and the generated TypeScript spreads the error to every consumer. Nothing
// merges this payload today (useGameStateManagement discards it and refetches),
// so the fix is to declare the reduced shape rather than to widen the handler.
//
// This test pins the DECLARED schema to the fields actually assigned. If the
// handler later starts sending the full game, update the expectation here --
// after checking humaUpdateGameState, not by assuming.
func TestUpdateGameStateResponseMatchesWhatItSends(t *testing.T) {
	doc := specDocument(t)

	paths, _ := doc["paths"].(map[string]any)
	p, ok := paths["/games/{gameID}/state"].(map[string]any)
	if !ok {
		t.Fatal("/games/{gameID}/state is not in the rendered spec")
	}
	put, _ := p["put"].(map[string]any)
	responses, _ := put["responses"].(map[string]any)
	ok200, _ := responses["200"].(map[string]any)
	content, _ := ok200["content"].(map[string]any)
	media, _ := content["application/json"].(map[string]any)
	schema, _ := media["schema"].(map[string]any)

	ref, _ := schema["$ref"].(string)
	if ref == "#/components/schemas/GameResponse" {
		t.Fatal("PUT /games/{gameID}/state still declares GameResponse, but " +
			"humaUpdateGameState assigns only 7 of its 28 fields -- the four " +
			"booleans (is_anonymous, auto_accept_audience, " +
			"allow_group_conversations, portrait_avatars) serialize as false " +
			"regardless of what the game has stored, so the spec tells every " +
			"client something the server never promised")
	}
}
