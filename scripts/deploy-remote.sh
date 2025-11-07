#!/bin/bash

# ActionPhase Remote Deployment Script
# Run this from your LOCAL machine to deploy to production
# Usage: ./scripts/deploy-remote.sh [server-ip]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - update these for your setup
DEFAULT_SERVER=${ACTIONPHASE_SERVER:-ubuntu@your-server-ip}
SERVER=${1:-$DEFAULT_SERVER}
PROJECT_DIR="/opt/actionphase"
BRANCH=${BRANCH:-main}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ActionPhase Remote Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Server:${NC} ${SERVER}"
echo -e "${BLUE}Branch:${NC} ${BRANCH}"
echo ""

# Check if server is reachable
echo -e "${BLUE}🔌 Checking server connectivity...${NC}"
if ! ssh -o ConnectTimeout=5 "${SERVER}" "echo 'Connected'" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to server: ${SERVER}${NC}"
    echo "Please check:"
    echo "  1. Server IP/hostname is correct"
    echo "  2. SSH key is configured"
    echo "  3. Server is running"
    exit 1
fi
echo -e "${GREEN}✓ Server is reachable${NC}"

# Check local git status
echo -e "${BLUE}📋 Checking local git status...${NC}"
if [ -d .git ]; then
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        echo -e "${YELLOW}⚠️  You have uncommitted changes locally${NC}"
        read -p "Continue anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Deployment cancelled"
            exit 1
        fi
    fi

    # Push to remote
    echo -e "${BLUE}📤 Pushing local changes to git...${NC}"
    CURRENT_BRANCH=$(git branch --show-current)
    git push origin "${CURRENT_BRANCH}"
    echo -e "${GREEN}✓ Changes pushed to ${CURRENT_BRANCH}${NC}"
else
    echo -e "${YELLOW}⚠️  Not in a git repository, skipping git push${NC}"
fi

# Function to run commands on remote server
remote_exec() {
    ssh "${SERVER}" "$1"
}

# Deploy on remote server
echo ""
echo -e "${BLUE}🚀 Starting remote deployment...${NC}"
echo "=========================================="

# Run deployment on remote server
ssh -t "${SERVER}" << ENDSSH
set -e

# Colors for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "\${BLUE}📂 Changing to project directory...\${NC}"
cd ${PROJECT_DIR}

echo -e "\${BLUE}📥 Pulling latest changes from git...\${NC}"
git fetch origin
git checkout ${BRANCH}
git pull origin ${BRANCH}

COMMIT_HASH=\$(git rev-parse --short HEAD)
COMMIT_MSG=\$(git log -1 --pretty=%B | head -1)
echo -e "\${GREEN}✓ Updated to commit: \${COMMIT_HASH}\${NC}"
echo "  Message: \${COMMIT_MSG}"

echo -e "\${BLUE}🔧 Running deployment script...\${NC}"
if [ -x ./scripts/deploy-production.sh ]; then
    ./scripts/deploy-production.sh
else
    # Fallback if deploy-production.sh doesn't exist yet
    echo -e "\${YELLOW}⚠️  deploy-production.sh not found, using fallback deployment\${NC}"

    # Backup database
    echo -e "\${BLUE}💾 Creating database backup...\${NC}"
    if docker ps --format '{{.Names}}' | grep -q actionphase-db; then
        mkdir -p ./backups
        docker exec actionphase-db pg_dump -U postgres actionphase | gzip > "./backups/pre-deploy-\$(date +%Y%m%d_%H%M%S).sql.gz"
        echo -e "\${GREEN}✓ Database backed up\${NC}"
    fi

    # Build and deploy
    echo -e "\${BLUE}🔨 Building Docker images...\${NC}"
    if [ -f docker-compose.prod.yml ]; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    else
        docker-compose build
        docker-compose up -d
    fi

    # Wait for services
    echo -e "\${BLUE}⏳ Waiting for services to be healthy...\${NC}"
    sleep 15

    # Show status
    docker-compose ps
fi

echo ""
echo -e "\${GREEN}========================================\${NC}"
echo -e "\${GREEN}✓ Remote deployment completed!\${NC}"
echo -e "\${GREEN}========================================\${NC}"
ENDSSH

# Verify deployment
echo ""
echo -e "${BLUE}🔍 Verifying deployment...${NC}"

# Check if backend is responding
echo -n "Checking backend API... "
if remote_exec "curl -f http://localhost:3000/ping" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
else
    echo -e "${RED}✗ Backend is not responding${NC}"
fi

# Check Docker containers
echo ""
echo -e "${BLUE}📊 Container Status:${NC}"
remote_exec "docker-compose ps --format 'table {{.Name}}\t{{.Status}}'" | grep -E "Name|actionphase" || true

# Show recent logs if requested
read -p "View recent logs? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}📜 Recent logs:${NC}"
    remote_exec "cd ${PROJECT_DIR} && docker-compose logs --tail=50"
fi

# Final summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Deployment Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Server: ${SERVER}"
echo "Branch: ${BRANCH}"
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Check application at: https://your-domain.com"
echo "  2. Monitor logs: ssh ${SERVER} 'cd ${PROJECT_DIR} && docker-compose logs -f'"
echo "  3. Check metrics: ssh ${SERVER} 'docker stats'"
echo ""

# Open browser if on macOS
if [[ "$OSTYPE" == "darwin"* ]] && command -v open &> /dev/null; then
    read -p "Open browser to check deployment? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Try to extract domain from .env or use default
        DOMAIN=$(ssh "${SERVER}" "cd ${PROJECT_DIR} && grep '^DOMAIN=' .env 2>/dev/null | cut -d'=' -f2" || echo "your-domain.com")
        open "https://${DOMAIN}"
    fi
fi

echo -e "${GREEN}✓ Remote deployment complete!${NC}"
