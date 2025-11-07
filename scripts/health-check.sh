#!/bin/bash

# ActionPhase Health Check Script
# Monitors the health of all services and sends alerts if issues detected
# Usage: ./scripts/health-check.sh [--slack-webhook URL]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SLACK_WEBHOOK="${1:-$SLACK_WEBHOOK_URL}"
LOG_FILE="/opt/actionphase/logs/health-check.log"
DOMAIN="${DOMAIN:-localhost}"

# Track overall health status
HEALTH_STATUS="healthy"
HEALTH_MESSAGES=()

# Log function
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    echo -e "$1"
}

# Send alert function
send_alert() {
    local message="$1"
    local level="${2:-warning}"

    # Log locally
    log_message "[$level] $message"

    # Send to Slack if webhook is configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        local emoji=":warning:"
        [ "$level" = "error" ] && emoji=":rotating_light:"
        [ "$level" = "info" ] && emoji=":information_source:"

        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"$emoji *ActionPhase Alert* ($level)\n$message\"}" \
            2>/dev/null || true
    fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ActionPhase Health Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check Docker services
echo -e "${BLUE}Checking Docker services...${NC}"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    HEALTH_STATUS="critical"
    HEALTH_MESSAGES+=("Docker daemon is not running!")
    send_alert "Docker daemon is not running on production server!" "error"
else
    echo -e "${GREEN}✓ Docker is running${NC}"
fi

# Check container health
EXPECTED_CONTAINERS=("actionphase-backend" "actionphase-frontend" "actionphase-db" "actionphase-nginx")
for container in "${EXPECTED_CONTAINERS[@]}"; do
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        # Check if container is healthy
        STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
        if [ "$STATUS" = "unhealthy" ]; then
            HEALTH_STATUS="critical"
            HEALTH_MESSAGES+=("Container $container is unhealthy!")
            send_alert "Container $container is unhealthy!" "error"
        else
            echo -e "${GREEN}✓ $container is running${NC}"
        fi
    else
        HEALTH_STATUS="critical"
        HEALTH_MESSAGES+=("Container $container is not running!")
        send_alert "Container $container is not running!" "error"
    fi
done

# Check API health
echo -e "${BLUE}Checking API health...${NC}"

# Backend health check
if curl -sf "http://localhost:3000/ping" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API is responding${NC}"
else
    HEALTH_STATUS="critical"
    HEALTH_MESSAGES+=("Backend API is not responding!")
    send_alert "Backend API health check failed!" "error"
fi

# Frontend health check
if curl -sf "http://localhost:5173" > /dev/null 2>&1 || curl -sf "http://localhost:80" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is accessible${NC}"
else
    HEALTH_STATUS="warning"
    HEALTH_MESSAGES+=("Frontend may not be accessible")
fi

# Database health check
echo -e "${BLUE}Checking database health...${NC}"

if docker exec actionphase-db pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database is accepting connections${NC}"

    # Check database size
    DB_SIZE=$(docker exec actionphase-db psql -U postgres -d actionphase -t -c "SELECT pg_size_pretty(pg_database_size('actionphase'));" 2>/dev/null | xargs)
    echo "  Database size: $DB_SIZE"

    # Check active connections
    CONN_COUNT=$(docker exec actionphase-db psql -U postgres -d actionphase -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs)
    echo "  Active connections: $CONN_COUNT"

    if [ "$CONN_COUNT" -gt 90 ]; then
        HEALTH_STATUS="warning"
        HEALTH_MESSAGES+=("High number of database connections: $CONN_COUNT")
        send_alert "High number of database connections: $CONN_COUNT" "warning"
    fi
else
    HEALTH_STATUS="critical"
    HEALTH_MESSAGES+=("Database is not accepting connections!")
    send_alert "Database health check failed!" "error"
fi

# Check system resources
echo -e "${BLUE}Checking system resources...${NC}"

# Check CPU usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}' | cut -d. -f1)
if [ "$CPU_USAGE" -gt 80 ]; then
    HEALTH_STATUS="warning"
    HEALTH_MESSAGES+=("High CPU usage: ${CPU_USAGE}%")
    send_alert "High CPU usage: ${CPU_USAGE}%" "warning"
else
    echo -e "${GREEN}✓ CPU usage: ${CPU_USAGE}%${NC}"
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ "$MEM_USAGE" -gt 80 ]; then
    HEALTH_STATUS="warning"
    HEALTH_MESSAGES+=("High memory usage: ${MEM_USAGE}%")
    send_alert "High memory usage: ${MEM_USAGE}%" "warning"
else
    echo -e "${GREEN}✓ Memory usage: ${MEM_USAGE}%${NC}"
fi

# Check disk usage (handled by check-disk.sh)
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    HEALTH_STATUS="warning"
    HEALTH_MESSAGES+=("High disk usage: ${DISK_USAGE}%")
else
    echo -e "${GREEN}✓ Disk usage: ${DISK_USAGE}%${NC}"
fi

# Check HTTPS if domain is configured
if [ "$DOMAIN" != "localhost" ]; then
    echo -e "${BLUE}Checking HTTPS...${NC}"

    if curl -ksf "https://$DOMAIN" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ HTTPS is working${NC}"

        # Check SSL certificate expiry
        CERT_EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
        if [ -n "$CERT_EXPIRY" ]; then
            DAYS_LEFT=$(( ($(date -d "$CERT_EXPIRY" +%s) - $(date +%s)) / 86400 ))
            echo "  SSL certificate expires in $DAYS_LEFT days"

            if [ "$DAYS_LEFT" -lt 7 ]; then
                HEALTH_STATUS="critical"
                HEALTH_MESSAGES+=("SSL certificate expires in $DAYS_LEFT days!")
                send_alert "SSL certificate expires in $DAYS_LEFT days!" "error"
            elif [ "$DAYS_LEFT" -lt 30 ]; then
                HEALTH_STATUS="warning"
                HEALTH_MESSAGES+=("SSL certificate expires in $DAYS_LEFT days")
                send_alert "SSL certificate expires in $DAYS_LEFT days" "warning"
            fi
        fi
    else
        HEALTH_STATUS="warning"
        HEALTH_MESSAGES+=("HTTPS is not accessible")
    fi
fi

# Check recent backups
echo -e "${BLUE}Checking backups...${NC}"

BACKUP_DIR="/opt/actionphase/backups"
if [ -d "$BACKUP_DIR" ]; then
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))
        echo "  Latest backup: $(basename "$LATEST_BACKUP") (${BACKUP_AGE} hours ago)"

        if [ "$BACKUP_AGE" -gt 48 ]; then
            HEALTH_STATUS="warning"
            HEALTH_MESSAGES+=("No recent backup (last: ${BACKUP_AGE} hours ago)")
            send_alert "No backup in ${BACKUP_AGE} hours" "warning"
        else
            echo -e "${GREEN}✓ Backups are current${NC}"
        fi
    else
        HEALTH_STATUS="warning"
        HEALTH_MESSAGES+=("No backups found!")
        send_alert "No backup files found!" "warning"
    fi
fi

# Check for container restarts
echo -e "${BLUE}Checking for recent container restarts...${NC}"

for container in "${EXPECTED_CONTAINERS[@]}"; do
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        RESTART_COUNT=$(docker inspect --format='{{.RestartCount}}' "$container" 2>/dev/null || echo "0")
        if [ "$RESTART_COUNT" -gt 5 ]; then
            HEALTH_STATUS="warning"
            HEALTH_MESSAGES+=("Container $container has restarted $RESTART_COUNT times")
            send_alert "Container $container has restarted $RESTART_COUNT times" "warning"
        fi
    fi
done

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$HEALTH_STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓ All health checks passed!${NC}"
    log_message "Health check completed: All systems healthy"
elif [ "$HEALTH_STATUS" = "warning" ]; then
    echo -e "${YELLOW}⚠️  Some warnings detected:${NC}"
    for msg in "${HEALTH_MESSAGES[@]}"; do
        echo "  - $msg"
    done
    log_message "Health check completed with warnings"
else
    echo -e "${RED}❌ Critical issues detected:${NC}"
    for msg in "${HEALTH_MESSAGES[@]}"; do
        echo "  - $msg"
    done
    log_message "Health check completed with critical issues"
    exit 1
fi
echo -e "${BLUE}========================================${NC}"

exit 0
