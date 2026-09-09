#!/bin/bash

# Backfill goose_db_version for a database that golang-migrate already migrated.
#
# Every existing database (dev, CI, test template, any deployed env) already has
# the schema, but goose knows nothing about it. Left alone, goose would try to
# apply migration 1 and fail on `relation "users" already exists`. This records
# the migrations already present so goose picks up from the right place.
#
# The version list is derived from the migration directory rather than hardcoded,
# so it cannot drift as migrations are added.
#
# Which versions get recorded is guarded on golang-migrate's old high-water mark:
# only versions <= schema_migrations.version are marked applied. A database that
# is legitimately behind stays behind, and goose applies the remainder normally
# on the next run.
#
# Safe to re-run: it inserts only versions not already recorded, so a partially
# backfilled or already-migrated database converges rather than duplicating rows.
#
# schema_migrations is deliberately NOT dropped here — that happens only after
# the cutover is confirmed in every environment. Until then it is the rollback path.
#
# Usage: just goose-backfill                  (dev database)
#        DB_URL=postgres://... ./scripts/goose-backfill.sh
#
# Exit codes: 0 = backfilled or already current, 1 = refused (unsafe state).

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$ROOT/backend/pkg/db/migrations"

DB_URL="${DB_URL:-}"
if [ -z "$DB_URL" ]; then
    echo -e "${RED}✗ DB_URL is not set${NC}"
    echo "  Usage: DB_URL=postgres://user:pass@host:5432/dbname $0"
    exit 1
fi

psql_q() { psql "$DB_URL" -tAq -v ON_ERROR_STOP=1 -c "$1"; }

if ! psql_q "select 1" >/dev/null 2>&1; then
    echo -e "${RED}✗ cannot connect to the database${NC}"
    exit 1
fi

# --- Collect the versions on disk -------------------------------------------
versions=$(ls "$MIGRATIONS"/*.sql 2>/dev/null | xargs -n1 basename | sed 's/_.*//' | sort -n)
if [ -z "$versions" ]; then
    echo -e "${RED}✗ no migrations found in $MIGRATIONS${NC}"
    exit 1
fi
echo "Migrations on disk: $(echo "$versions" | wc -l | tr -d ' ')"

# --- Establish the high-water mark ------------------------------------------
# A database with no schema_migrations table was never migrated by golang-migrate.
# There is nothing to adopt, and inventing a mark here could mark unapplied
# migrations as done against a schema that does not have them. Refuse instead:
# such a database should be built by running goose from zero.
has_sm=$(psql_q "select to_regclass('public.schema_migrations') is not null")
if [ "$has_sm" != "t" ]; then
    if [ "$(psql_q "select to_regclass('public.goose_db_version') is not null")" = "t" ]; then
        echo -e "${GREEN}✓ no schema_migrations; goose_db_version already present — nothing to backfill${NC}"
        exit 0
    fi
    echo -e "${RED}✗ no schema_migrations table in this database${NC}"
    echo "  Nothing to adopt. If this database is empty, run goose from zero instead."
    echo "  If it has schema from some other source, record its versions by hand."
    exit 1
fi

dirty=$(psql_q "select dirty from schema_migrations limit 1")
mark=$(psql_q "select version from schema_migrations limit 1")

if [ "$dirty" = "t" ]; then
    echo -e "${RED}✗ schema_migrations is marked dirty at version $mark${NC}"
    echo "  A migration failed partway under golang-migrate and the schema state is"
    echo "  unknown. Resolve that first — adopting a dirty database would record a"
    echo "  migration as applied when it may only be half applied."
    exit 1
fi

echo "golang-migrate high-water mark: $mark"

# Versions above the mark were never applied; leave them for goose to run.
applied=$(echo "$versions" | awk -v m="$mark" '$1 <= m')
pending=$(echo "$versions" | awk -v m="$mark" '$1 > m')
n_applied=$(echo "$applied" | grep -c . || true)
n_pending=$(echo "$pending" | grep -c . || true)

if [ "$n_applied" -eq 0 ]; then
    echo -e "${RED}✗ no migration on disk is <= the high-water mark $mark${NC}"
    echo "  The migration directory does not look like the history this database was"
    echo "  built from. Refusing to backfill."
    exit 1
fi

# The mark itself must exist on disk. If it does not, this database was migrated
# from a different migration set (or a file was deleted), and the versions below
# the mark are not a history we can vouch for.
if ! echo "$versions" | grep -qx "$mark"; then
    echo -e "${RED}✗ high-water mark $mark has no matching migration file${NC}"
    echo "  This database was migrated from a different set of migrations."
    exit 1
fi

echo "  to record as applied: $n_applied"
if [ "$n_pending" -gt 0 ]; then
    echo -e "  ${YELLOW}left pending for goose to apply: $n_pending${NC}"
    echo "$pending" | sed 's/^/    /'
fi

# --- Create the tracking table and insert -----------------------------------
# Table definition is goose's own, captured from a live `\d goose_db_version`.
# goose creates it on first run; creating it here first is equivalent and lets
# the backfill run before the binary is ever pointed at this database.
#
# Version 0 is goose's zero-value row, present in every goose-managed database.
#
# The whole thing is one transaction: either the database is adopted or it is
# untouched, never half-recorded.
sql_values=$( { echo 0; echo "$applied"; } | sed 's/^/(/; s/$/, true)/' | paste -sd, - )

psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<SQL
BEGIN;

CREATE TABLE IF NOT EXISTS goose_db_version (
    id         integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    version_id bigint  NOT NULL,
    is_applied boolean NOT NULL,
    tstamp     timestamp without time zone NOT NULL DEFAULT now()
);

-- Insert only what is missing, so re-running converges instead of duplicating.
--
-- ORDER BY version_id is load-bearing, not tidiness. goose reads "current
-- version" from the most recently inserted row (ORDER BY id DESC), not from
-- max(version_id), because it reverses migrations in applied order. Without an
-- explicit order the identity ids land arbitrarily, and a goose down would then
-- roll back whichever migration happened to be inserted last rather than the
-- newest one. Inserting in version order makes applied order match version
-- order, which is the truth for a database golang-migrate built.
INSERT INTO goose_db_version (version_id, is_applied)
SELECT v.version_id, v.is_applied
FROM (VALUES $sql_values) AS v(version_id, is_applied)
WHERE NOT EXISTS (
    SELECT 1 FROM goose_db_version g WHERE g.version_id = v.version_id
)
ORDER BY v.version_id;

COMMIT;
SQL

recorded=$(psql_q "select count(*) from goose_db_version where is_applied")
# Read the tip the same way goose does — newest row, not highest version — so
# this output would disagree loudly if the ordering above ever broke.
current=$(psql_q "select version_id from goose_db_version order by id desc limit 1")

echo -e "${GREEN}✓ backfill complete${NC}"
echo "  goose_db_version rows applied: $recorded (including version 0)"
echo "  current version: $current"
echo ""
echo "  schema_migrations left in place as the rollback path; drop it only after"
echo "  the cutover is confirmed in every environment."
