# huma Handlers — Full Reference

Detailed companion to `SKILL.md` principles 3 (handler pattern) and 6
(validation). Read this when writing or changing an API operation.

**Verified 2026-09-21** against the codebase. All 231 API operations are huma
operations; the pre-huma `func(w, r)` + `render.Bind` pattern is gone.

---

### 3. Handlers Are Type-First huma Operations

A handler is `func(ctx, *Input) (*Output, error)`. It never touches
`http.ResponseWriter`: huma decodes and validates the input from the struct's
schema tags, and encodes the output. This is what makes the OpenAPI spec
derivable from Go types instead of hand-maintained.

**Three files per domain** (`backend/pkg/<domain>/`):

| File | Holds |
|---|---|
| `requests.go` | Request body structs + their schema tags |
| `responses.go` | Response body structs — **the wire contract** |
| `huma_api.go` | Input/Output wrappers, handlers, `huma.Register` calls |

```go
// requests.go — constraints live in tags, enforced before the handler runs
type CreateCharacterRequest struct {
    Name          string `json:"name" minLength:"1" maxLength:"255" doc:"Character name"`
    CharacterType string `json:"character_type" enum:"player_character,npc" doc:"Character kind"`
    UserID        *int32 `json:"user_id,omitempty" required:"false" doc:"Player to own the character"`
}

// huma_api.go — Input bundles path/query params with the Body
type createCharacterInput struct {
    GameID int32 `path:"gameID" doc:"Game ID"`
    Body   *CreateCharacterRequest
}

type characterOutput struct {
    Body *CharacterResponse
}

// ✅ Handler: auth, authorization, delegate, map to the response struct
func (h *Handler) humaCreateCharacter(ctx context.Context, in *createCharacterInput) (*characterOutput, error) {
    defer h.App.ObsLogger.LogOperation(ctx, "api_create_character")()

    authUser, err := h.authUser(ctx)
    if err != nil {
        return nil, err
    }

    character, err := h.CharacterService.CreateCharacter(ctx, core.CreateCharacterRequest{
        GameID: in.GameID,
        Name:   in.Body.Name,
    })
    if err != nil {
        h.App.ObsLogger.Error(ctx, "Failed to create character", "error", err, "game_id", in.GameID)
        return nil, huma.Error500InternalServerError(err.Error())
    }

    return &characterOutput{Body: toCharacterResponse(character)}, nil
}
```

Register it, declaring the status and the error responses it can produce:

```go
func RegisterHumaCharacters(api huma.API, h *Handler) {
    huma.Register(api, huma.Operation{
        OperationID:   "createCharacter",
        Method:        http.MethodPost,
        Path:          "/characters",
        Summary:       "Create a character",
        Description:   "Creates a player character or NPC. Requires a verified email.",
        Tags:          []string{"Characters"},
        Security:      bearer,
        DefaultStatus: http.StatusCreated,
        Responses: map[string]*huma.Response{
            "422": {Description: "Request failed validation"},
            "401": {Description: "Not authenticated"},
            "403": {Description: "Not allowed, or email not verified"},
        },
    }, h.humaCreateCharacter)
}
```

**Errors are huma errors**, returned not written: `huma.Error400BadRequest(...)`,
`huma.Error403Forbidden(...)`, `huma.Error500InternalServerError(...)`. Two
helpers bridge the service layer's `core` errors:

- `humaErr(errResp)` — converts a `*core.ErrResponse`, preserving status and message
- `core.NotFoundOr500(err, "character")` — 404 for a missing row, 500 otherwise

Errors render as RFC 7807 problem documents with the correlation ID in
`instance` (`pkg/humaconfig`).

**chi has not gone away.** huma mounts onto the existing chi router via the
humachi adapter, so `r.Mount`, `r.Route` and every `r.Use` middleware still
work. Only the handler signature and encoding changed. A handler needing the
raw request (client IP, user agent, cookie writes) reaches it through
`humaconfig.RequestMiddleware`.

Middleware that used to wrap a chi route has a context-based twin for use
inside a handler — e.g. `core.RequireVerifiedEmailCtx(ctx, h.App.Pool)`.


---

### 6. Validate Input with Schema Tags

Constraints go on the request struct as **huma schema tags**. huma enforces them
before the handler runs and returns 422 with the offending field named; the same
tags become the constraints published in the OpenAPI spec, so validation and
documentation cannot drift apart.

```go
type CreateCharacterRequest struct {
    Name          string `json:"name" minLength:"1" maxLength:"255" doc:"Character name"`
    CharacterType string `json:"character_type" enum:"player_character,npc" doc:"Character kind"`
    UserID        *int32 `json:"user_id,omitempty" required:"false" doc:"Owning player"`
}
```

Common tags: `minLength` / `maxLength`, `minimum` / `maximum`, `enum`,
`required:"false"`, `format`, `pattern`, `doc`.

**A field is required unless you say otherwise.** Mark optional fields
`required:"false"` *and* make them pointers with `omitempty` — pointer +
`omitempty` means the key is absent rather than `null`.

**Prefer `enum` over a hand-rolled check**, and keep it matching the database's
CHECK constraint.

**Trim strings via `Resolve`.** huma's `minLength` counts raw characters, so
`"   "` would pass `minLength:"1"` and put a blank row in the database. Body
structs restore trimming:

```go
func (b *CreateCharacterRequest) Resolve(huma.Context) []error {
    return humaconfig.TrimStrings(b)
}
```

`TrimStrings` trims every exported string field in place and reports the JSON
names of those a non-zero `minLength` requires but which are empty after
trimming. Add it to any body with a `minLength` on a string field.

**Rules the schema cannot see stay in the handler** — anything depending on the
caller's role, on other rows, or on cross-field logic:

```go
// The GM is naming someone else's character, so they must say whose.
if isGM && in.Body.UserID == nil {
    return nil, huma.Error400BadRequest("user_id is required when GM creates player characters")
}
```

**Never rely on the service layer to catch bad input.** A service error renders
as a 500 "unexpected error", so a user who submits a blank name is told the
server broke. Services still hold their own invariants; that is defence in
depth, not the client-facing check.

Before tightening a constraint on an endpoint that already ships, check what the
frontend actually sends: a `minLength` stricter than the UI enforces will reject
payloads that work today.

---

## Where to Look

| For | File |
|---|---|
| A full domain, two mount points | `backend/pkg/characters/huma_api.go` |
| A response contract documented field by field | `backend/pkg/characters/responses.go` |
| API config, RFC 7807 errors, `TrimStrings` | `backend/pkg/humaconfig/humaconfig.go` |
| huma↔chi wiring and spec merging | `backend/pkg/http/huma.go` |
| Mounts and middleware | `backend/pkg/http/root.go` |

## Regenerating After a Change

Any change to a request struct, response struct, or `huma.Operation` changes the
spec:

```bash
just gen-openapi     # backend/pkg/docs/openapi.gen.yaml
just gen-api-types   # frontend/src/types/api.gen.ts
```

Commit both. `just verify` fails on stale output. See
`.claude/context/CODE_GENERATION.md`.
