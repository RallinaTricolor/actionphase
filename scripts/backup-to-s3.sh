#!/bin/bash

# ActionPhase Database Backup to S3
# Runs daily via cron in the backup container
# Dependencies: postgresql-client, aws-cli

set -e

# Configuration (can be overridden by environment variables)
DB_HOST=${POSTGRES_HOST:-db}
DB_NAME=${POSTGRES_DB:-actionphase}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD:-example}
S3_BUCKET=${S3_BUCKET:-actionphase-backups}
BACKUP_DIR=${BACKUP_DIR:-./backups}
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="actionphase_${TIMESTAMP}.sql.gz"
LOCAL_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
S3_PATH="s3://${S3_BUCKET}/backups/${BACKUP_FILE}"

echo "${LOG_PREFIX} Starting database backup: ${BACKUP_FILE}"

# Create database backup with pg_dump
echo "${LOG_PREFIX} Creating PostgreSQL dump..."
export PGPASSWORD="${DB_PASSWORD}"
if pg_dump -h "${DB_HOST}" -U "${DB_USER}" -d "${DB_NAME}" --no-owner --clean --if-exists | gzip -9 > "${LOCAL_PATH}"; then
    echo "${LOG_PREFIX} Database dump created successfully: $(du -h ${LOCAL_PATH} | cut -f1)"
else
    echo "${LOG_PREFIX} ERROR: Database dump failed!"
    exit 1
fi

# Upload to S3
echo "${LOG_PREFIX} Uploading backup to S3: ${S3_PATH}"
if aws s3 cp "${LOCAL_PATH}" "${S3_PATH}" --storage-class STANDARD; then
    echo "${LOG_PREFIX} Upload successful"

    # Verify upload
    if aws s3 ls "${S3_PATH}" > /dev/null 2>&1; then
        echo "${LOG_PREFIX} Backup verified in S3"
    else
        echo "${LOG_PREFIX} WARNING: Could not verify backup in S3"
    fi
else
    echo "${LOG_PREFIX} ERROR: S3 upload failed!"
    exit 1
fi

# Clean up local file (keep last 3 locally for quick access)
echo "${LOG_PREFIX} Cleaning up local backups..."
cd "${BACKUP_DIR}"
ls -t actionphase_*.sql.gz 2>/dev/null | tail -n +4 | xargs -r rm -f
echo "${LOG_PREFIX} Local cleanup complete (kept last 3 backups)"

# Clean up old S3 backups (keep 30 days)
echo "${LOG_PREFIX} Checking for old S3 backups to delete..."
CUTOFF_DATE=$(date -d "30 days ago" +%Y%m%d)

aws s3 ls "s3://${S3_BUCKET}/backups/" | grep "actionphase_" | while read -r line; do
    FILE_NAME=$(echo "$line" | awk '{print $4}')
    FILE_DATE=$(echo "$FILE_NAME" | grep -oE "[0-9]{8}" | head -1)

    if [[ -n "$FILE_DATE" ]] && [[ "$FILE_DATE" -lt "$CUTOFF_DATE" ]]; then
        echo "${LOG_PREFIX} Deleting old backup: $FILE_NAME (date: $FILE_DATE)"
        aws s3 rm "s3://${S3_BUCKET}/backups/${FILE_NAME}"
    fi
done

# Report backup statistics
BACKUP_COUNT=$(aws s3 ls "s3://${S3_BUCKET}/backups/" | grep -c "actionphase_" || echo "0")
TOTAL_SIZE=$(aws s3 ls "s3://${S3_BUCKET}/backups/" --summarize | grep "Total Size" | awk '{print $3}')
TOTAL_SIZE_MB=$((TOTAL_SIZE / 1048576))

echo "${LOG_PREFIX} Backup complete!"
echo "${LOG_PREFIX} Statistics:"
echo "${LOG_PREFIX}   - Total backups in S3: ${BACKUP_COUNT}"
echo "${LOG_PREFIX}   - Total storage used: ${TOTAL_SIZE_MB} MB"
echo "${LOG_PREFIX}   - Latest backup: ${BACKUP_FILE}"
echo "${LOG_PREFIX} ==========================================="

# Exit successfully
exit 0
