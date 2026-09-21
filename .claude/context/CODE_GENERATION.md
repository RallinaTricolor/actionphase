# Code Generation - Read Before Changing Schema or API Shape

**IMPORTANT: Read this before touching a migration, a SQL query, a request or
response struct, or a frontend type.**

**Last Verified**: 2026-09-21

Four artifacts in this repo are **generated and committed**. Each has a `just`
recipe that produces it and a `check-*` recipe that fails when the committed copy
is stale. Both regeneration and the commit are your job — CI will not do it for
you, and `just verify` fails on drift.

## The Golden Rule

> **Never hand-edit a generated file.** Change the *source*, run the recipe,
> commit the result.

A generated file edited by hand is silently reverted by the next person who runs
the recipe, and the `check-*` gate will fail in the meantime. If a generated
shape is wrong, the Go type or SQL that produced it is what needs fixing.

---

## The Four Chains

```
migrations/*.sql ──just sqlgen──────────► pkg/db/models/*.sql.go
      │                                    (sqlc reads migrations directly as
      │                                     the schema — there is no separate
      │                                     schema.sql to maintain)
      │
      └── queries/*.sql ─────┘

Go request/response structs ──just gen-openapi──► pkg/docs/openapi.gen.yaml
                                                          │
                                                          │ just gen-api-types
                                                          ▼
                                          frontend/src/types/api.gen.ts
                                                          │
                                                          │ hand-written aliases
                                                          ▼
                                            frontend/src/types/<domain>.ts
```

| Source of truth | Command | Generated artifact | Staleness gate |
|---|---|---|---|
| `backend/pkg/db/migrations/` + `queries/` | `just sqlgen` | `backend/pkg/db/models/*.sql.go` | compile failure |
| Go types + `huma.Operation` registrations | `just gen-openapi` | `backend/pkg/docs/openapi.gen.yaml` | `just check-api-docs` |
| `openapi.gen.yaml` | `just gen-api-types` | `frontend/src/types/api.gen.ts` | `just check-api-types` |
| `api.gen.ts` | (hand-written aliases) | `frontend/src/types/<domain>.ts` | `just type-check` |

All four run in `just verify`.

---

## 1. Database Schema → Go Models (sqlc)

**sqlc reads `backend/pkg/db/migrations/` as the schema** (`sqlc.yaml`:
`schema: "migrations"`). There is no hand-maintained `schema.sql`, and
`init.sql` does nothing but create the database — do not put DDL there.

Migrations are **goose**, one file per migration with both directions in it:

```sql
-- +goose Up
ALTER TABLE action_results
ADD COLUMN gm_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE;

-- +goose Down
ALTER TABLE action_results DROP COLUMN gm_user_id;
```

> There are **no** `.up.sql` / `.down.sql` pairs. That was golang-migrate, which
> this project has swapped away from. Both `-- +goose` annotations must be
> present or goose silently misreads the file.

**Workflow:**

```bash
just migration create <name>   # writes a guarded stub
# ...write the Up and Down sections, deleting the guard
just migrate                   # apply to the dev database
just sqlgen                    # regenerate pkg/db/models from migrations + queries
```

`just migration create` leaves a `RAISE EXCEPTION` guard in the stub so an
unwritten migration cannot be applied by accident. Remove it as you write.

**Out-of-order migrations.** `just migrate` deliberately refuses a migration
whose timestamp sorts below the current version — the collision golang-migrate
used to apply silently. Read the error, confirm the straggler is safe, then
`just migration-allow-missing`. Before opening a PR when someone else's
migration may have merged, run `just check-migration-order`.

---

## 2. Go Types → OpenAPI Spec

`backend/pkg/docs/openapi.gen.yaml` is produced by huma from the registered
operations plus the metadata in `pkg/docs/spec_metadata.go`. Because every
handler package is huma-native, **the spec is derived from Go types** — it is a
diff, not a judgment call, which is why `check-api-docs` can enforce it.

Anything that changes the spec:

- a field added, removed, retyped or retagged in `requests.go` / `responses.go`
- a schema tag changed (`minLength`, `enum`, `required`, `doc`, …)
- a `huma.Operation` field changed (path, method, status, `Responses`, `Tags`)
- a new `huma.Register` call

```bash
just gen-openapi     # regenerate
just check-api-docs  # verify (also runs in just verify)
```

Commit `openapi.gen.yaml` **in the same change** as the Go code. The spec is
served at `/api/v1/docs/openapi.yaml` and rendered as Swagger UI at
`/api/v1/docs/`.

---

## 3. OpenAPI Spec → Frontend Types

`frontend/src/types/api.gen.ts` (~16.5k lines) is generated from the committed
spec by `openapi-typescript`. This makes request and response shapes a
**compile-time contract** across the stack instead of a 422 discovered at
runtime.

```bash
just gen-api-types     # regenerate from backend/pkg/docs/openapi.gen.yaml
just check-api-types   # verify (also runs in just verify)
```

Note it reads the **committed** spec, so the order after a backend change is
always `just gen-openapi` → `just gen-api-types`.

---

## 4. Generated Types → Domain Aliases

`frontend/src/types/<domain>.ts` files are **hand-written, but only as aliases**
onto the generated schemas. This is where the prose explaining a shape lives;
the shape itself comes from the backend.

```typescript
import type { components } from './api.gen';

export type GameWithDetails = components['schemas']['GameWithDetailsResponse'];
export type GameWritten = components['schemas']['GameResponse'];
```

**Do not hand-write an interface describing a wire shape.** Before these were
generated, the hand-written versions had drifted badly — fields declared
required that the endpoint never sent, fields typed `string | undefined` where
the server sends explicit `null`, and guards on properties that had never once
rendered. Alias the generated type and let the compiler find the call sites.

Optionality in a generated type carries meaning worth preserving in the alias's
doc comment: a field may be absent because the column is NULL, or because the
caller is not *entitled* to it (an anonymous game withholds player identity).
Never infer one optional field's presence from another's.

---

## Frontend Test Mocks

Test factories in `frontend/src/test-utils/factories.ts` are typed against these
aliases, so a backend field addition breaks **one file** instead of dozens of
test files building mocks by hand.

```typescript
import { makeMessage } from '../test-utils/factories';

const comment = makeMessage({ content: 'hello', reply_count: 2 });
```

A mock is a claim about the wire. If the compiler says a field is missing, add it
with a value the server would really send — **do not paper over it with a cast**.
`just check-test-types` type-checks the test tree against these contracts.

---

## Quick Checklist

After a **schema** change:
- [ ] `just migration create <name>`, write both `+goose` sections
- [ ] `just migrate`
- [ ] `just sqlgen`
- [ ] Commit the migration and regenerated models

After an **API shape** change:
- [ ] `just gen-openapi` → commit `backend/pkg/docs/openapi.gen.yaml`
- [ ] `just gen-api-types` → commit `frontend/src/types/api.gen.ts`
- [ ] Alias new schemas in `frontend/src/types/<domain>.ts`
- [ ] Update `factories.ts` if tests build that shape
- [ ] `just verify`

---

## Related

- **`.claude/context/ARCHITECTURE.md`** — huma handler pattern (§4)
- **`.claude/skills/backend-dev-guidelines/resources/huma-handlers.md`** — full handler reference
- **`.claude/context/TESTING.md`** — typed factories and test contracts
- **`.claude/reference/JUSTFILE_QUICK_REFERENCE.md`** — all commands
