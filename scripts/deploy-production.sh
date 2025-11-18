#!/bin/bash

# ActionPhase Production Deployment Script
# Run this on the production server after git pull
# Usage: ./scripts/deploy-production.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR=${PROJECT_DIR:-/opt/actionphase}
BACKUP_DIR=${BACKUP_DIR:-./backups}
LOG_DIR=${LOG_DIR:-./logs}
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.logging.yml"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ActionPhase Production Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Change to project directory
cd "${PROJECT_DIR}"

# Check if we're on the correct branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}Current branch:${NC} ${CURRENT_BRANCH}"

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

# Pull latest changes
echo -e "${BLUE}📥 Pulling latest changes from git...${NC}"
git pull origin "${CURRENT_BRANCH}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create .env file with production configuration"
    exit 1
fi

# Check if docker-compose.logging.yml exists
if [ ! -f docker-compose.logging.yml ]; then
    echo -e "${YELLOW}⚠️  Warning: docker-compose.logging.yml not found${NC}"
    echo "Log persistence is disabled. Logs will be lost when containers are removed."
    echo "To enable log persistence, create docker-compose.logging.yml"
    echo "See: docs/operations/LOGGING_STRATEGY.md"
    echo ""
    # Fall back to production-only compose files
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
    read -p "Continue without log persistence? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Log persistence enabled via docker-compose.logging.yml${NC}"
fi

# Create required directories if they don't exist
echo -e "${BLUE}📁 Ensuring required directories exist...${NC}"
mkdir -p "${BACKUP_DIR}"
mkdir -p "${LOG_DIR}"/{backend,frontend,nginx,postgres,backup}

# Set proper permissions
if [ -d "${LOG_DIR}" ]; then
    chmod -R 755 "${LOG_DIR}"
    echo -e "${GREEN}✓ Log directories created/verified${NC}"
fi

# Backup database before deployment
echo -e "${BLUE}💾 Creating pre-deployment database backup...${NC}"
if docker ps --format '{{.Names}}' | grep -q actionphase-db; then
    BACKUP_FILE="${BACKUP_DIR}/pre-deploy-${TIMESTAMP}.sql.gz"
    if docker exec actionphase-db pg_dump -U postgres actionphase | gzip -9 > "${BACKUP_FILE}"; then
        echo -e "${GREEN}✓ Database backed up to: ${BACKUP_FILE}${NC}"
    else
        echo -e "${YELLOW}⚠️  Database backup failed, continuing anyway...${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Database container not running, skipping backup${NC}"
fi

# Build documentation before Docker images
echo -e "${BLUE}📚 Building documentation...${NC}"
if [ -d "docs-site" ]; then
    cd docs-site
    if [ ! -d "node_modules" ]; then
        echo "Installing documentation dependencies..."
        npm install
    fi
    echo "Building VitePress documentation..."
    npm run docs:build
    cd ..

    # Embed documentation in backend
    echo "Embedding documentation in backend..."
    rm -rf backend/pkg/docs/dist
    cp -r docs-site/.vitepress/dist backend/pkg/docs/dist
    echo -e "${GREEN}✓ Documentation built and embedded${NC}"
else
    echo -e "${YELLOW}⚠️  docs-site directory not found, skipping documentation build${NC}"
fi

# Build new images
echo -e "${BLUE}🔨 Building Docker images...${NC}"
docker-compose ${COMPOSE_FILES} build --no-cache

# Deploy with minimal downtime
echo -e "${BLUE}🚀 Starting deployment...${NC}"

docker-compose ${COMPOSE_FILES} down
docker-compose ${COMPOSE_FILES} up -d

# Clean up old images
echo -e "${BLUE}🧹 Cleaning up old Docker images...${NC}"
docker image prune -f

# Show deployment status
echo ""
echo -e "${BLUE}📊 Deployment Status:${NC}"
echo "=============================="
docker-compose ${COMPOSE_FILES} ps

# Verify services
echo ""
echo -e "${BLUE}🔍 Service Health Checks:${NC}"
echo "=============================="

# Check each service
SERVICES=("db" "backend" "frontend")
if grep -q "nginx:" docker-compose.prod.yml 2>/dev/null; then
    SERVICES+=("nginx")
fi
if grep -q "certbot:" docker-compose.prod.yml 2>/dev/null; then
    SERVICES+=("certbot")
fi

ALL_HEALTHY=true
for service in "${SERVICES[@]}"; do
    if docker-compose ${COMPOSE_FILES} ps | grep -E "${service}.*healthy|${service}.*running" > /dev/null 2>&1; then
        echo -e "  ${service}: ${GREEN}✓ Healthy${NC}"
    else
        echo -e "  ${service}: ${RED}✗ Unhealthy${NC}"
        ALL_HEALTHY=false
    fi
done

# Show logs if any service is unhealthy
if [ "$ALL_HEALTHY" = false ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Some services are unhealthy. Recent logs:${NC}"
    docker-compose ${COMPOSE_FILES} logs --tail=20
fi

# Show resource usage
echo ""
echo -e "${BLUE}📈 Resource Usage:${NC}"
echo "=============================="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep actionphase || true

# Show log disk usage (if logs directory exists)
if [ -d "${LOG_DIR}" ]; then
    echo ""
    echo -e "${BLUE}📊 Log Disk Usage:${NC}"
    echo "=============================="
    du -sh "${LOG_DIR}" 2>/dev/null || echo "  Logs directory: 0B"
    if [ -d "${LOG_DIR}/backend" ]; then
        du -sh "${LOG_DIR}"/* 2>/dev/null | sed 's/^/  /' || true
    fi

    # Check for large log files
    LARGE_LOGS=$(find "${LOG_DIR}" -type f -size +100M 2>/dev/null)
    if [ -n "$LARGE_LOGS" ]; then
        echo ""
        echo -e "${YELLOW}⚠️  Large log files found (>100MB):${NC}"
        echo "$LARGE_LOGS" | while read -r logfile; do
            SIZE=$(du -sh "$logfile" | cut -f1)
            echo "    $(basename "$logfile"): $SIZE"
        done
        echo "  Consider rotating logs: logrotate -f /etc/logrotate.d/actionphase"
    fi
fi

# Show deployment info
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Deployment timestamp: ${TIMESTAMP}"
echo "Git commit: $(git rev-parse --short HEAD)"
echo "Branch: ${CURRENT_BRANCH}"
if [ -d "backend/pkg/docs/dist" ]; then
    DOC_FILES=$(find backend/pkg/docs/dist -type f | wc -l)
    echo "Documentation: ${DOC_FILES} files embedded"
fi
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  Container logs:   docker-compose ${COMPOSE_FILES} logs -f"
echo "  Backend logs:     docker-compose logs -f backend"
echo "  Persisted logs:   tail -f ${LOG_DIR}/backend/app.log"
echo "  Nginx access:     tail -f ${LOG_DIR}/nginx/access.log"
echo "  Search errors:    grep '\"level\":\"error\"' ${LOG_DIR}/backend/app.log | jq ."
echo "  Restart service:  docker-compose restart [service]"
echo "  Stop all:         docker-compose down"
echo ""
echo -e "${BLUE}Log locations:${NC}"
echo "  Application:      ${LOG_DIR}/"
echo "  Container logs:   /var/lib/docker/containers/"
echo ""

# Final health check
if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}✓ All services are healthy and running${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some services may need attention${NC}"
    exit 1
fi
