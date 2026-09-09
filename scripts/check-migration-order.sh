#!/bin/bash

# Out-of-order migration guard.
#
# THE FAILURE THIS CATCHES
#
# Two people write migrations at the same time. Alice's 30000000000001 merges
# and deploys. Bob branched earlier, so his is 30000000000000 — an OLDER
# timestamp — and merges second. Bob's migration now sorts BELOW what the
# database has already applied.
#
# Under golang-migrate that was silent and permanent: it tracked a single
# high-water mark, saw nothing above it, and exited 0 reporting "no change".
# Bob's table was never created and nothing ever said so.
#
# goose records one row per applied migration, so it detects the gap and fails.
# That makes the problem *detectable*. This script is what makes it *caught* —
# on Bob's pull request, instead of at deploy time.
#
# HOW IT WORKS
#
# Build a database the way production actually looks — every migration on the
# BASE branch, applied — then apply this branch's migrations on top. If the
# branch adds a migration that sorts below the base tip, goose refuses and names
# the file, and this script exits non-zero.
#
# The baseline is the base branch TIP, not the merge-base. The merge-base is
# where this branch diverged; it cannot contain the very migration that collides,
# because that migration landed on the base branch after the branch was cut.
# Using the tip is what reproduces the collision at all.
#
# Usage:
#   scripts/check-migration-order.sh <base-ref> [db-url]
#
# Example (locally, against the branch you would open a PR into):
#   scripts/check-migration-order.sh origin/develop

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_REF="${1:-origin/develop}"
DB_URL="${2:-postgres://postgres:example@localhost:5432/migration_order_check?sslmode=disable}"

MIG_DIR="backend/pkg/db/migrations"

if ! git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
    echo -e "${RED}✗ base ref not found: $BASE_REF${NC}"
    echo "  Fetch it first, e.g. git fetch origin develop"
    exit 1
fi

if [ ! -d "$MIG_DIR" ]; then
    echo -e "${RED}✗ migration directory not found: $MIG_DIR${NC}"
    echo "  Run this from the repository root."
    exit 1
fi

workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT

base_dir="$workdir/base"
mkdir -p "$base_dir"

# Extract the base branch's migrations. Nothing is checked out — the working
# tree stays exactly as it is, so this is safe to run mid-edit.
git archive "$BASE_REF" -- "$MIG_DIR" 2>/dev/null | tar -x -C "$base_dir" || true

base_migrations="$base_dir/$MIG_DIR"
if [ ! -d "$base_migrations" ]; then
    echo -e "${YELLOW}⚠ no migration directory on $BASE_REF — skipping${NC}"
    exit 0
fi

# A base branch from before the goose cutover holds .up.sql/.down.sql pairs.
# goose panics on those (it reads the pair as a duplicate version), which would
# fail this check for a reason that has nothing to do with migration ordering.
# The guard only has meaning once the base branch is itself on goose.
if ls "$base_migrations"/*.up.sql >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ $BASE_REF still uses golang-migrate (.up.sql/.down.sql)${NC}"
    echo "  Skipping: this guard applies once the cutover has landed on the base branch."
    exit 0
fi

base_count=$(ls "$base_migrations"/*.sql 2>/dev/null | wc -l | tr -d ' ')
head_count=$(ls "$MIG_DIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')

echo "Base ref:        $BASE_REF"
echo "Migrations on base: $base_count"
echo "Migrations on HEAD: $head_count"

if [ "$base_count" -eq 0 ]; then
    echo -e "${YELLOW}⚠ no migrations on the base branch — nothing to compare against${NC}"
    exit 0
fi

# Nothing added? Then no new migration can collide. Note this compares the sets,
# not just the counts: a branch that adds one migration and deletes another
# nets to zero but still needs checking.
added=$(comm -13 \
    <(ls "$base_migrations" | grep '\.sql$' | sort) \
    <(ls "$MIG_DIR" | grep '\.sql$' | sort))

if [ -z "$added" ]; then
    echo -e "${GREEN}✓ this branch adds no migrations — nothing to check${NC}"
    exit 0
fi

echo "Migrations added by this branch:"
echo "$added" | sed 's/^/  + /'
echo ""

# --- Step 1: build the base-branch database -------------------------------
echo "Applying base-branch migrations..."
if ! goose -dir "$base_migrations" postgres "$DB_URL" up > "$workdir/base.log" 2>&1; then
    echo -e "${RED}✗ the BASE branch's own migrations failed to apply${NC}"
    echo "  This is not an ordering problem — the base branch is broken, or the"
    echo "  target database was not empty."
    sed 's/^/  /' "$workdir/base.log"
    exit 1
fi

base_version=$(goose -dir "$base_migrations" postgres "$DB_URL" version 2>&1 | tail -1)
echo "  base is at: $base_version"
echo ""

# --- Step 2: apply this branch on top -------------------------------------
# Deliberately no -allow-missing. Its absence is the entire check.
echo "Applying this branch's migrations on top..."
if goose -dir "$MIG_DIR" postgres "$DB_URL" up > "$workdir/head.log" 2>&1; then
    echo ""
    echo -e "${GREEN}✓ migrations apply cleanly in order${NC}"
    exit 0
fi

# goose failed. Distinguish the ordering collision from an ordinary broken
# migration, because the two need completely different fixes.
if grep -q "missing migrations before current version" "$workdir/head.log"; then
    echo ""
    echo -e "${RED}✗ OUT-OF-ORDER MIGRATION${NC}"
    echo ""
    sed 's/^/  /' "$workdir/head.log"
    echo ""
    echo "  A migration on this branch has a timestamp OLDER than a migration"
    echo "  already applied on $BASE_REF. It would be skipped on any database"
    echo "  that is already up to date — which is every deployed environment."
    echo ""
    echo "  This happens when someone else's migration merged while this branch"
    echo "  was open."
    echo ""
    echo "  Fix: rename the migration with a current timestamp so it sorts last."
    echo "    git mv $MIG_DIR/<old_timestamp>_name.sql \\"
    echo "           $MIG_DIR/\$(date +%Y%m%d%H%M%S)_name.sql"
    echo ""
    echo "  Only rename a migration that has not been applied anywhere. If it has"
    echo "  already run in a real environment, renaming it makes goose apply it a"
    echo "  second time; reconcile that environment by hand instead."
    exit 1
fi

echo ""
echo -e "${RED}✗ migrations failed to apply${NC}"
echo "  (not an ordering problem — the migration itself errored)"
echo ""
sed 's/^/  /' "$workdir/head.log"
exit 1
