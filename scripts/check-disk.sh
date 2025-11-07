#!/bin/bash

# ActionPhase Disk Space Monitoring Script
# Monitors disk usage and sends alerts when thresholds are exceeded
# Usage: ./scripts/check-disk.sh [--threshold PERCENT] [--slack-webhook URL]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
WARNING_THRESHOLD=70
CRITICAL_THRESHOLD=85
SLACK_WEBHOOK=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --threshold)
            WARNING_THRESHOLD="$2"
            CRITICAL_THRESHOLD=$((WARNING_THRESHOLD + 15))
            shift 2
            ;;
        --slack-webhook)
            SLACK_WEBHOOK="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--threshold PERCENT] [--slack-webhook URL]"
            exit 1
            ;;
    esac
done

# Use environment variable if no webhook provided
SLACK_WEBHOOK="${SLACK_WEBHOOK:-$SLACK_WEBHOOK_URL}"

# Log file
LOG_FILE="/opt/actionphase/logs/disk-monitor.log"
mkdir -p "$(dirname "$LOG_FILE")"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to send alert
send_alert() {
    local message="$1"
    local level="${2:-warning}"

    # Log locally
    log_message "[$level] $message"

    # Send to Slack if webhook is configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        local emoji=":warning:"
        [ "$level" = "critical" ] && emoji=":rotating_light:"
        [ "$level" = "info" ] && emoji=":information_source:"

        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"$emoji *Disk Space Alert* ($level)\n$message\"}" \
            2>/dev/null || true
    fi
}

# Function to format size
format_size() {
    local size=$1
    if [ "$size" -gt 1048576 ]; then
        echo "$((size / 1048576))G"
    elif [ "$size" -gt 1024 ]; then
        echo "$((size / 1024))M"
    else
        echo "${size}K"
    fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ActionPhase Disk Space Monitor${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Thresholds:${NC}"
echo "  Warning: ${WARNING_THRESHOLD}%"
echo "  Critical: ${CRITICAL_THRESHOLD}%"
echo ""

# Track overall status
STATUS="healthy"
ISSUES=()

# Check main filesystem
echo -e "${BLUE}Checking filesystem usage...${NC}"

df -h | grep -E '^/dev/' | while read -r line; do
    FILESYSTEM=$(echo "$line" | awk '{print $1}')
    SIZE=$(echo "$line" | awk '{print $2}')
    USED=$(echo "$line" | awk '{print $3}')
    AVAIL=$(echo "$line" | awk '{print $4}')
    USAGE=$(echo "$line" | awk '{print $5}' | sed 's/%//')
    MOUNT=$(echo "$line" | awk '{print $6}')

    # Skip special filesystems
    if [[ "$MOUNT" == "/dev" || "$MOUNT" == "/dev/shm" || "$MOUNT" == "/run"* ]]; then
        continue
    fi

    echo -e "  $MOUNT: ${USAGE}% used ($USED of $SIZE)"

    if [ "$USAGE" -ge "$CRITICAL_THRESHOLD" ]; then
        STATUS="critical"
        ISSUES+=("$MOUNT is ${USAGE}% full (Critical)")
        send_alert "CRITICAL: $MOUNT is ${USAGE}% full!\nUsed: $USED of $SIZE\nAvailable: $AVAIL" "critical"
    elif [ "$USAGE" -ge "$WARNING_THRESHOLD" ]; then
        STATUS="warning"
        ISSUES+=("$MOUNT is ${USAGE}% full (Warning)")
        send_alert "WARNING: $MOUNT is ${USAGE}% full\nUsed: $USED of $SIZE\nAvailable: $AVAIL" "warning"
    else
        echo -e "    ${GREEN}✓ Healthy${NC}"
    fi
done

# Check Docker volumes
echo ""
echo -e "${BLUE}Checking Docker volumes...${NC}"

if command -v docker &> /dev/null; then
    # Check total Docker disk usage
    DOCKER_USAGE=$(docker system df --format "table {{.Type}}\t{{.Size}}\t{{.Reclaimable}}" 2>/dev/null | tail -n +2)

    echo "$DOCKER_USAGE" | while IFS=$'\t' read -r TYPE SIZE RECLAIMABLE; do
        echo "  $TYPE: $SIZE (Reclaimable: $RECLAIMABLE)"
    done

    # Check individual volumes
    echo ""
    echo "  Volume details:"
    docker volume ls --format "{{.Name}}" | while read -r volume; do
        # Skip system volumes
        if [[ "$volume" == *"_vscode"* ]]; then
            continue
        fi

        SIZE=$(docker run --rm -v "$volume:/data" alpine du -sh /data 2>/dev/null | cut -f1)
        if [ -n "$SIZE" ]; then
            echo "    $volume: $SIZE"
        fi
    done

    # Check for unused containers/images
    UNUSED_CONTAINERS=$(docker ps -a -f "status=exited" -q | wc -l)
    UNUSED_IMAGES=$(docker images -f "dangling=true" -q | wc -l)

    if [ "$UNUSED_CONTAINERS" -gt 10 ]; then
        echo ""
        echo -e "  ${YELLOW}⚠️  Found $UNUSED_CONTAINERS stopped containers${NC}"
        echo "    Run 'docker container prune' to clean up"
        ISSUES+=("$UNUSED_CONTAINERS stopped containers consuming space")
    fi

    if [ "$UNUSED_IMAGES" -gt 10 ]; then
        echo -e "  ${YELLOW}⚠️  Found $UNUSED_IMAGES dangling images${NC}"
        echo "    Run 'docker image prune' to clean up"
        ISSUES+=("$UNUSED_IMAGES dangling images consuming space")
    fi
fi

# Check specific application directories
echo ""
echo -e "${BLUE}Checking application directories...${NC}"

APP_DIRS=(
    "/opt/actionphase/backups:50:Database backups"
    "/opt/actionphase/logs:20:Application logs"
    "/var/log:10:System logs"
)

for dir_config in "${APP_DIRS[@]}"; do
    IFS=':' read -r DIR MAX_SIZE DESC <<< "$dir_config"

    if [ -d "$DIR" ]; then
        SIZE_KB=$(du -sk "$DIR" 2>/dev/null | cut -f1)
        SIZE_MB=$((SIZE_KB / 1024))
        SIZE_GB=$((SIZE_MB / 1024))

        if [ "$SIZE_GB" -gt 0 ]; then
            DISPLAY_SIZE="${SIZE_GB}G"
        else
            DISPLAY_SIZE="${SIZE_MB}M"
        fi

        echo "  $DESC ($DIR): $DISPLAY_SIZE"

        if [ "$SIZE_MB" -gt $((MAX_SIZE * 1024)) ]; then
            STATUS="warning"
            ISSUES+=("$DESC directory is large: $DISPLAY_SIZE")
            send_alert "$DESC directory is using $DISPLAY_SIZE of disk space" "warning"
        fi

        # For backups directory, check oldest backup
        if [[ "$DIR" == *"backups"* ]]; then
            OLDEST_BACKUP=$(ls -t "$DIR"/*.sql.gz 2>/dev/null | tail -1)
            if [ -n "$OLDEST_BACKUP" ]; then
                BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$OLDEST_BACKUP")) / 86400 ))
                echo "    Oldest backup: $(basename "$OLDEST_BACKUP") ($BACKUP_AGE days old)"

                if [ "$BACKUP_AGE" -gt 30 ]; then
                    echo -e "    ${YELLOW}Consider cleaning old backups${NC}"
                fi
            fi
        fi

        # For logs directory, check for large files
        if [[ "$DIR" == *"logs"* ]]; then
            LARGE_LOGS=$(find "$DIR" -type f -size +100M 2>/dev/null)
            if [ -n "$LARGE_LOGS" ]; then
                echo -e "    ${YELLOW}Large log files found:${NC}"
                echo "$LARGE_LOGS" | while read -r logfile; do
                    SIZE=$(du -sh "$logfile" | cut -f1)
                    echo "      $(basename "$logfile"): $SIZE"
                done
                ISSUES+=("Large log files found in $DIR")
            fi
        fi
    fi
done

# Check for core dumps
echo ""
echo -e "${BLUE}Checking for core dumps...${NC}"

CORE_DUMPS=$(find /opt/actionphase -name "core.*" -o -name "*.core" 2>/dev/null | wc -l)
if [ "$CORE_DUMPS" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠️  Found $CORE_DUMPS core dump files${NC}"
    ISSUES+=("$CORE_DUMPS core dump files found")
    send_alert "Found $CORE_DUMPS core dump files that should be investigated" "warning"
else
    echo -e "  ${GREEN}✓ No core dumps found${NC}"
fi

# Check PostgreSQL specific
if docker ps --format "{{.Names}}" | grep -q "actionphase-db"; then
    echo ""
    echo -e "${BLUE}Checking PostgreSQL database...${NC}"

    # Database size
    DB_SIZE=$(docker exec actionphase-db psql -U postgres -d actionphase -t -c "SELECT pg_size_pretty(pg_database_size('actionphase'));" 2>/dev/null | xargs)
    echo "  Database size: $DB_SIZE"

    # WAL size
    WAL_SIZE=$(docker exec actionphase-db du -sh /var/lib/postgresql/data/pg_wal 2>/dev/null | cut -f1)
    if [ -n "$WAL_SIZE" ]; then
        echo "  WAL size: $WAL_SIZE"
    fi

    # Check for bloat
    BLOAT=$(docker exec actionphase-db psql -U postgres -d actionphase -t -c "
        SELECT schemaname, tablename, pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS size
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 5;
    " 2>/dev/null)

    if [ -n "$BLOAT" ]; then
        echo "  Largest tables:"
        echo "$BLOAT" | while read -r line; do
            echo "    $line"
        done
    fi
fi

# Provide cleanup recommendations
if [ "$STATUS" != "healthy" ]; then
    echo ""
    echo -e "${BLUE}Cleanup recommendations:${NC}"
    echo "  1. Remove old backups: find /opt/actionphase/backups -name '*.sql.gz' -mtime +30 -delete"
    echo "  2. Clean Docker resources: docker system prune -a"
    echo "  3. Rotate logs: logrotate -f /etc/logrotate.d/actionphase"
    echo "  4. Clean package cache: apt-get clean"
    echo "  5. Remove old kernels: apt-get autoremove"
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓ Disk space is healthy${NC}"
    log_message "Disk check completed: All filesystems healthy"
elif [ "$STATUS" = "warning" ]; then
    echo -e "${YELLOW}⚠️  Disk space warnings:${NC}"
    for issue in "${ISSUES[@]}"; do
        echo "  - $issue"
    done
    log_message "Disk check completed with warnings"
else
    echo -e "${RED}❌ Critical disk space issues:${NC}"
    for issue in "${ISSUES[@]}"; do
        echo "  - $issue"
    done
    log_message "Disk check completed with critical issues"
    exit 1
fi
echo -e "${BLUE}========================================${NC}"

exit 0
