#!/bin/bash

# ActionPhase Database Restore from S3 Backup
# Usage: ./restore-from-s3.sh [backup-filename]
# If no filename provided, shows list of available backups

set -e

# Configuration
DB_HOST=${POSTGRES_HOST:-localhost}
DB_NAME=${POSTGRES_DB:-actionphase}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD:-example}
S3_BUCKET=${S3_BUCKET:-actionphase-backups}
RESTORE_DIR=${RESTORE_DIR:-/tmp/restore}
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to list available backups
list_backups() {
    echo -e "${GREEN}Available backups in S3:${NC}"
    echo "========================"
    aws s3 ls "s3://${S3_BUCKET}/backups/" | grep "actionphase_" | sort -r | head -20 | while read -r line; do
        FILE_SIZE=$(echo "$line" | awk '{print $3}')
        FILE_DATE=$(echo "$line" | awk '{print $1, $2}')
        FILE_NAME=$(echo "$line" | awk '{print $4}')
        FILE_SIZE_MB=$((FILE_SIZE / 1048576))
        echo "  $FILE_NAME (${FILE_SIZE_MB}MB) - $FILE_DATE"
    done
    echo ""
}

# Check if backup filename was provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <backup-filename>${NC}"
    echo ""
    list_backups
    echo -e "${YELLOW}Example: $0 actionphase_20251106_020000.sql.gz${NC}"
    exit 1
fi

BACKUP_FILE="$1"
S3_PATH="s3://${S3_BUCKET}/backups/${BACKUP_FILE}"
LOCAL_PATH="${RESTORE_DIR}/${BACKUP_FILE}"

echo "${LOG_PREFIX} Starting database restore process..."
echo "${LOG_PREFIX} Backup file: ${BACKUP_FILE}"

# Create restore directory
mkdir -p "${RESTORE_DIR}"

# Check if backup exists in S3
echo "${LOG_PREFIX} Checking if backup exists in S3..."
if ! aws s3 ls "${S3_PATH}" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Backup file not found in S3: ${BACKUP_FILE}${NC}"
    echo ""
    list_backups
    exit 1
fi

# Download backup from S3
echo "${LOG_PREFIX} Downloading backup from S3..."
if aws s3 cp "${S3_PATH}" "${LOCAL_PATH}"; then
    echo "${LOG_PREFIX} Download complete: $(du -h ${LOCAL_PATH} | cut -f1)"
else
    echo -e "${RED}ERROR: Failed to download backup from S3${NC}"
    exit 1
fi

# Verify the downloaded file
if [ ! -f "${LOCAL_PATH}" ]; then
    echo -e "${RED}ERROR: Downloaded file not found at ${LOCAL_PATH}${NC}"
    exit 1
fi

# Confirm restore with user
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will replace the current database!${NC}"
echo "Database: ${DB_NAME} on ${DB_HOST}"
echo ""
read -p "Are you sure you want to restore from ${BACKUP_FILE}? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "${LOG_PREFIX} Restore cancelled by user"
    rm -f "${LOCAL_PATH}"
    exit 0
fi

# Stop backend services to prevent connections during restore
echo "${LOG_PREFIX} Stopping backend services..."
if command -v docker-compose &> /dev/null; then
    docker-compose stop backend 2>/dev/null || true
    echo "${LOG_PREFIX} Backend services stopped"
else
    echo "${LOG_PREFIX} WARNING: docker-compose not found, please stop backend manually"
    read -p "Press Enter when backend is stopped..."
fi

# Create a backup of current database before restore (safety)
echo "${LOG_PREFIX} Creating safety backup of current database..."
SAFETY_BACKUP="actionphase_pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
export PGPASSWORD="${DB_PASSWORD}"
if pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" --no-owner | gzip -9 > "/tmp/${SAFETY_BACKUP}"; then
    echo "${LOG_PREFIX} Safety backup created: /tmp/${SAFETY_BACKUP}"
else
    echo -e "${YELLOW}WARNING: Could not create safety backup, continuing anyway...${NC}"
fi

# Drop and recreate database
echo "${LOG_PREFIX} Dropping existing database..."
export PGPASSWORD="${DB_PASSWORD}"
psql -h "${DB_HOST}" -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"

echo "${LOG_PREFIX} Creating fresh database..."
psql -h "${DB_HOST}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"

# Restore from backup
echo "${LOG_PREFIX} Restoring database from backup..."
if gunzip -c "${LOCAL_PATH}" | psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database restored successfully!${NC}"
else
    echo -e "${RED}ERROR: Database restore failed!${NC}"
    echo "${LOG_PREFIX} Attempting to restore safety backup..."
    if [ -f "/tmp/${SAFETY_BACKUP}" ]; then
        psql -h "${DB_HOST}" -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
        psql -h "${DB_HOST}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${DB_NAME};"
        gunzip -c "/tmp/${SAFETY_BACKUP}" | psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}"
    fi
    exit 1
fi

# Verify restore
echo "${LOG_PREFIX} Verifying restore..."
TABLE_COUNT=$(psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
USER_COUNT=$(psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")
GAME_COUNT=$(psql -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM games;" 2>/dev/null | tr -d ' ' || echo "0")

echo "${LOG_PREFIX} Restore statistics:"
echo "${LOG_PREFIX}   - Tables restored: ${TABLE_COUNT}"
echo "${LOG_PREFIX}   - Users in database: ${USER_COUNT}"
echo "${LOG_PREFIX}   - Games in database: ${GAME_COUNT}"

# Start backend services again
echo "${LOG_PREFIX} Starting backend services..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d backend
    echo "${LOG_PREFIX} Backend services started"

    # Wait for backend to be healthy
    echo "${LOG_PREFIX} Waiting for backend to be healthy..."
    sleep 10

    # Check backend health
    if curl -f http://localhost:3000/ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
    else
        echo -e "${YELLOW}WARNING: Backend health check failed, please check logs${NC}"
    fi
else
    echo "${LOG_PREFIX} Please start backend services manually"
fi

# Clean up
echo "${LOG_PREFIX} Cleaning up temporary files..."
rm -f "${LOCAL_PATH}"
[ -f "/tmp/${SAFETY_BACKUP}" ] && echo "${LOG_PREFIX} Safety backup kept at: /tmp/${SAFETY_BACKUP}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Database restore completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo "${LOG_PREFIX} Restored from: ${BACKUP_FILE}"
echo "${LOG_PREFIX} Database: ${DB_NAME}"
echo "${LOG_PREFIX} Recovery time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

exit 0
