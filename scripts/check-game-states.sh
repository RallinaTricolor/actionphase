#!/bin/bash

# Game State Consistency Check
#
# Three places independently define the set of valid game states, with nothing
# connecting them at compile time:
#
#   1. core.ValidGameStates             backend/pkg/core/constants.go
#   2. allowedTransitions               backend/pkg/db/services/games.go
#   3. the games.state CHECK constraint backend/pkg/db/migrations/*.sql
#
# A state added to some but not all of them fails in ways that only surface in
# a running app: a transition the API rejects, or a state Postgres refuses to
# store.
#
# The fourth source used to be the hand-written GameState union in
# frontend/src/types/games.ts. It is gone: that union is now derived from the
# OpenAPI spec, which huma renders from core.GameState, which enumerates
# core.ValidGameStates. Those three legs are linked by the compiler and the
# generator, so they cannot drift -- there is nothing left to compare.
#
# What IS still worth checking is that the committed spec matches the Go slice,
# because the spec is a generated ARTIFACT that can go stale if someone edits
# the states and does not run `just gen-openapi`. That is source 4 below. It
# proves the frontend's inherited union is current without reading the frontend
# tree at all.
#
# This runs as a script rather than a unit test because it spans Go, SQL and a
# generated YAML document. `just check-game-states` executes it inside the
# backend container, where the repo root is bind-mounted read-only at /repo (the
# service's own /app mount only covers backend/). Keeping it in the container
# means contributors without a POSIX shell on the host — e.g. Windows — run the
# same check as everyone else.
#
# Usage: just check-game-states
#    or: ./scripts/check-game-states.sh   (directly, on a host with bash)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CONSTANTS="$ROOT/backend/pkg/core/constants.go"
TRANSITIONS="$ROOT/backend/pkg/db/services/games.go"
SPEC="$ROOT/backend/pkg/docs/openapi.gen.yaml"

for f in "$CONSTANTS" "$TRANSITIONS" "$SPEC"; do
    if [ ! -f "$f" ]; then
        echo -e "${RED}✗ missing file: $f${NC}"
        exit 1
    fi
done

# --- 1. Backend: the ValidGameStates slice body -----------------------------
# Take the lines between the var declaration and its closing brace, then pull
# the string literal off each GameState* constant's own declaration.
backend_states=$(
    awk '/^var ValidGameStates = \[\]string\{/{flag=1; next} /^\}/{flag=0} flag' "$CONSTANTS" |
    grep -o 'GameState[A-Za-z]*' |
    while read -r ident; do
        sed -n "s/^	$ident = \"\([a-z_]*\)\".*/\1/p" "$CONSTANTS" || true
    done | sort -u
)

# --- 2. Spec: the UpdateGameStateBody.state enum -----------------------------
# The committed OpenAPI document, which the frontend's GameState union is
# generated from. Rendered by huma from core.GameState, so a mismatch here means
# the spec is STALE rather than that someone typed a different list.
#
# UpdateGameStateBody is the schema the frontend indexes for its union, so it is
# the one to check -- the response schemas carry the same enum from the same Go
# type, and checking one of them instead would leave the union's own source
# unverified.
#
# Parsed with awk rather than a YAML library: the backend container has neither
# yq nor python3-yaml. That is tolerable because this file is machine-generated,
# so its indentation is stable -- but see the empty-extraction guard below,
# which is what catches a generator reformat instead of silently passing.
spec_states=$(
    awk '
        /^        UpdateGameStateBody:/      { inbody = 1; next }
        inbody && /^        [A-Za-z]/        { exit }
        inbody && /^                    enum:/ { inenum = 1; next }
        inenum && /^                        - / { sub(/^ *- /, ""); print; next }
        inenum                               { exit }
    ' "$SPEC" | sort -u
)

# --- 3. Backend: the allowedTransitions map keys ----------------------------
transition_states=$(
    awk '/^var allowedTransitions = map\[string\]\[\]string\{/{flag=1; next} /^\}/{flag=0} flag' "$TRANSITIONS" |
    sed -n 's/^[[:space:]]*"\([a-z_]*\)".*/\1/p' | sort -u
)

# --- 4. Migrations: the newest games.state CHECK constraint -----------------
# Later migrations may drop and recreate the constraint, so take the last
# definition in filename (chronological) order rather than the first.
#
# The state list routinely wraps across lines, so match from "CHECK (state IN"
# through the closing paren rather than grepping single lines — a line-at-a-time
# read silently sees only the first few states and reports a false mismatch.
#
# Read only the "-- +goose Up" half of each file. Under goose a migration holds
# both directions, and a down migration that reverts a state addition contains
# the OLD, narrower list; since we take the last match in the file, reading the
# whole thing would extract the reverted list and report a false mismatch.
constraint_block=""
for f in $(ls "$ROOT/backend/pkg/db/migrations/"*.sql 2>/dev/null | sort); do
    block=$(
        sed -n '/^-- +goose Up/,/^-- +goose Down/p' "$f" |
        tr '\n' ' ' |
        sed -n 's/.*CHECK (state IN \(([^)]*)\).*/\1/p'
    )
    if [ -n "$block" ]; then
        constraint_block="$block"
    fi
done
constraint_states=$(echo "$constraint_block" | tr ',' '\n' | sed -n "s/.*'\([a-z_]*\)'.*/\1/p" | sort -u)

fail=0

# The baseline every other source is compared against. If extraction breaks —
# a gofmt change to the leading tab the sed depends on, a reformatted closing
# brace — this goes empty, and any other source whose extraction also broke
# compares equal to it, so the script reports success with an empty list.
if [ -z "$backend_states" ]; then
    echo -e "${RED}✗ could not extract core.ValidGameStates from $CONSTANTS${NC}"
    echo "  The extraction in this script is brittle by nature (it parses Go"
    echo "  source with awk/sed); check that the var block and the GameState*"
    echo "  const declarations still match the patterns above."
    exit 1
fi

compare() {
    local label="$1" actual="$2"
    if [ -z "$actual" ]; then
        echo -e "${RED}✗ could not extract any states for $label${NC}"
        fail=1
        return
    fi
    if [ "$actual" != "$backend_states" ]; then
        echo -e "${RED}✗ $label does not match core.ValidGameStates${NC}"
        echo "  core.ValidGameStates: $(echo "$backend_states" | tr '\n' ' ')"
        echo "  $label: $(echo "$actual" | tr '\n' ' ')"
        diff <(echo "$backend_states") <(echo "$actual") | sed 's/^/    /' || true
        fail=1
    fi
}

compare "UpdateGameStateBody.state enum (backend/pkg/docs/openapi.gen.yaml)" "$spec_states"
compare "allowedTransitions (backend/pkg/db/services/games.go)" "$transition_states"

if [ -z "$constraint_states" ]; then
    echo -e "${RED}✗ could not find a 'CHECK (state IN ...)' constraint in migrations${NC}"
    fail=1
else
    compare "games.state CHECK constraint (latest migration)" "$constraint_states"
fi

if [ "$fail" -ne 0 ]; then
    echo ""
    echo "Game state definitions are out of sync. Update:"
    echo "  - backend/pkg/core/constants.go       (const + ValidGameStates)"
    echo "  - backend/pkg/db/services/games.go    (allowedTransitions)"
    echo "  - backend/pkg/db/migrations/          (new migration for the CHECK)"
    echo ""
    echo "Then run 'just gen-openapi' and 'just gen-api-types' and commit both."
    echo "Do NOT hand-edit the spec or frontend/src/types/games.ts: the GameState"
    echo "union is derived from core.ValidGameStates through the generated spec."
    exit 1
fi

echo -e "${GREEN}✓ game states consistent across constants, transitions, migration, and spec${NC}"
echo "  $(echo "$backend_states" | tr '\n' ' ')"
