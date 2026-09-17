#!/bin/bash
set -euo pipefail

# Load E2E parallel worker users (workers 1-5)
# Worker 0 users are already in common/01_users.sql loaded by apply_common.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_NAME="${DB_NAME:-actionphase}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-example}"

# ON_ERROR_STOP=1: psql exits 0 on SQL errors without it, so a failure here would
# leave the worker users missing and every _w1.._w5 fixture failing later on
# games.gm_user_id NOT NULL, far from the real cause.
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/common/01_users_e2e_workers.sql" --quiet
