# Phase System

Complete reference for the phase cycle in ActionPhase.

Source of truth: `backend/pkg/db/migrations/`,
`backend/pkg/db/services/phases/`, `backend/pkg/http/root.go`.

## Phase Types

```sql
-- Live constraint, migration 20260605174513_add_interlude_phase_type.sql
CHECK (phase_type IN ('common_room', 'action', 'interlude'))
```

Canonical list: `core.ValidPhaseTypes` (`backend/pkg/core/constants.go:43`).

⚠️ **There is no `results` phase type.** GM results are rows in the
`action_results` table, which FKs to `game_phases` and `action_submissions`.
They are written and published against an **action** phase.

## Phase Types

- **`common_room`** — public discussion; posts and comments
- **`action`** — players submit actions; GM writes and publishes results
- **`interlude`** — private messaging ONLY: no public posts, no action
  submissions. Private messages may only be sent/edited during `common_room`
  or `interlude` phases (`backend/pkg/conversations/api.go:458`).

## Phase Cycle

```
COMMON ROOM → ACTION (submissions, then GM writes + publishes results) → repeat
INTERLUDE may be inserted between cycles for private-messaging-only stretches
```

## Phase Properties

- `phase_number` — sequential, `UNIQUE(game_id, phase_number)`
- `is_active` — only ONE active phase per game
- `is_published` — ⚠️ **NOT phase visibility.** Means "the GM has published this
  **action** phase's results"; documented as always FALSE for `common_room` and
  `interlude` phases (migration `20251015001708`). Filtering phases on it drops
  every discussion phase. To list phases a game ran, filter only on `game_id`;
  use `activated_at` for "did this phase start".
- `start_time` — if set, the scheduler activates the phase at this time
- `activated_at` — when the phase actually became active
- `end_time`, `deadline`, `title`, `description`

## Activation

Phases are **created and activated** — there is no "advance" endpoint.

A phase becomes active either when:
1. The GM/co-GM explicitly activates it (`ActivatePhase`,
   `backend/pkg/db/services/phases/transitions.go:199`), or
2. The background scheduler reaches its `start_time`
   (`RunScheduledActivations`, `backend/pkg/db/services/phases/scheduler.go:16`)

Transitions are recorded in the `phase_transitions` table.

## Ended Phases

A phase has ended when it isn't active and either it has been activated or a
later phase has (`core.PhaseHasEnded`). The later-phase check is needed because
`activated_at` has no backfill. A phase that hasn't started hasn't ended. The
game's phase list exposes this as `has_ended`.

An ended phase is **read-only, with no exceptions**:

- Its results board can't be changed.
- Its results and their sheet updates can't be written, edited, deleted or
  published. Unpublished drafts stay unpublished.
- Refusals answer **423** (`core.ErrPhaseEnded`).
- Parts already published and waiting on a timer still go out.

To do more work, the GM activates the phase again. It becomes the current phase,
the one that was current becomes ended, and the usual notification goes out.

## Endpoints

```
GET   /api/v1/games/{gameID}/phases
POST  /api/v1/games/{gameID}/phases
GET   /api/v1/games/{gameID}/current-phase

POST  /api/v1/games/{gameID}/actions
GET   /api/v1/games/{gameID}/actions/mine
POST  /api/v1/games/{gameID}/results
POST  /api/v1/games/{gameID}/results/{resultId}/publish
POST  /api/v1/games/{gameID}/phases/{phaseId}/results/publish   -- bulk publish
```

⚠️ There is no `POST /api/v1/phases/advance`, and no top-level
`/api/v1/phases/...` routes at all — phase content is nested under the game.

## Results Visibility

`action_results.is_published` gates player visibility. The GM can publish a
single result or all results for a phase at once. Unpublished results are
invisible to the player they belong to. A result or part with no text can't be
published (409, `core.ErrEmptyResult`), and publish all then sends nothing.

---

**Back to**: [SKILL.md](../SKILL.md)
