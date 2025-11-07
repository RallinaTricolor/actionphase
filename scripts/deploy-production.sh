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
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
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

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

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

# Build new images
echo -e "${BLUE}🔨 Building Docker images...${NC}"
docker-compose ${COMPOSE_FILES} build --no-cache

# Health check function
health_check() {
    local service=$1
    local max_attempts=30
    local attempt=1

    echo -n "Waiting for ${service} to be healthy..."
    while [ $attempt -le $max_attempts ]; do
        if docker-compose ${COMPOSE_FILES} ps | grep -E "${service}.*healthy|${service}.*running" > /dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo -e " ${RED}✗${NC}"
    return 1
}

# Deploy with minimal downtime
echo -e "${BLUE}🚀 Starting deployment...${NC}"

# Update database first (if migrations needed)
echo -e "${BLUE}📊 Updating database...${NC}"
docker-compose ${COMPOSE_FILES} up -d db
health_check "db"

# Update backend
echo -e "${BLUE}🔧 Updating backend service...${NC}"
docker-compose ${COMPOSE_FILES} up -d --no-deps backend
health_check "backend"

# Test backend health endpoint
if curl -f http://localhost:3000/ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API is responding${NC}"
else
    echo -e "${RED}✗ Backend API health check failed${NC}"
    echo "Check logs with: docker-compose logs backend"
fi

# Update frontend
echo -e "${BLUE}🎨 Updating frontend service...${NC}"
docker-compose ${COMPOSE_FILES} up -d --no-deps frontend
health_check "frontend"

# Update nginx (if using production config)
if grep -q "nginx:" docker-compose.prod.yml 2>/dev/null; then
    echo -e "${BLUE}🔒 Updating nginx service...${NC}"
    docker-compose ${COMPOSE_FILES} up -d --no-deps nginx
    health_check "nginx"
fi

# Update supporting services
echo -e "${BLUE}📦 Updating supporting services...${NC}"
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

# Show deployment info
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Deployment timestamp: ${TIMESTAMP}"
echo "Git commit: $(git rev-parse --short HEAD)"
echo "Branch: ${CURRENT_BRANCH}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  View logs:        docker-compose ${COMPOSE_FILES} logs -f"
echo "  View backend:     docker-compose logs -f backend"
echo "  Restart service:  docker-compose restart [service]"
echo "  Stop all:         docker-compose down"
echo ""

# Final health check
if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}✓ All services are healthy and running${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some services may need attention${NC}"
    exit 1
fi
