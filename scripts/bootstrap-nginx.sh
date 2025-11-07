#!/bin/bash

# Bootstrap Nginx for Initial Setup
# This script starts nginx with HTTP-only configuration for Let's Encrypt validation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Nginx Bootstrap (HTTP-only)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running from project root
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

# Stop nginx if running
echo -e "${BLUE}Stopping nginx if running...${NC}"
docker-compose -f docker-compose.yml -f docker-compose.prod.yml stop nginx 2>/dev/null || true
docker rm -f actionphase-nginx 2>/dev/null || true

# Create required directories
mkdir -p ./nginx/conf.d
mkdir -p ./ssl

# Create Docker network if it doesn't exist
docker network create actionphase_actionphase-network 2>/dev/null || true

# Create Docker volumes if they don't exist
docker volume create actionphase_certbot-webroot 2>/dev/null || true
docker volume create actionphase_letsencrypt 2>/dev/null || true

# Start nginx with HTTP-only config
echo -e "${BLUE}Starting nginx with HTTP-only configuration...${NC}"

docker run -d \
    --name actionphase-nginx \
    --network actionphase_actionphase-network \
    -p 80:80 \
    -v "$(pwd)/nginx/nginx.http-only.conf:/etc/nginx/nginx.conf:ro" \
    -v "$(pwd)/nginx/conf.d:/etc/nginx/conf.d:ro" \
    -v actionphase_certbot-webroot:/var/www/certbot:rw \
    -v actionphase_letsencrypt:/etc/letsencrypt:rw \
    --restart unless-stopped \
    nginx:alpine

# Wait for nginx to start
sleep 3

# Check if nginx is running
if docker ps | grep -q actionphase-nginx; then
    echo -e "${GREEN}✓ Nginx started successfully on port 80${NC}"
    echo ""
    echo -e "${BLUE}Testing nginx...${NC}"

    # Test health endpoint
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Nginx is responding${NC}"
    else
        echo -e "${YELLOW}⚠️  Nginx is running but health check failed${NC}"
        echo "This is normal if backend/frontend containers aren't running yet"
    fi

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Bootstrap Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Ensure DNS is configured (A record pointing to this server)"
    echo "  2. Run: ./scripts/setup-ssl.sh yourdomain.com your@email.com"
    echo ""

else
    echo -e "${RED}❌ Failed to start nginx${NC}"
    echo "Check logs: docker logs actionphase-nginx"
    exit 1
fi

exit 0
