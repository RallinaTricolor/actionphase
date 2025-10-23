#!/bin/bash

# ActionPhase Docker Setup Script
# This script sets up and starts the ActionPhase application using Docker Compose

set -e  # Exit on error

echo "=========================================="
echo "   ActionPhase Docker Setup"
echo "=========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/engine/install/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.docker .env

    # Generate a random JWT secret
    JWT_SECRET=$(openssl rand -base64 32)

    # Update .env with generated secret (works on both macOS and Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    else
        # Linux
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
    fi

    echo "✅ Generated secure JWT_SECRET"
    echo ""
    echo "⚠️  IMPORTANT: Review .env file and update any values as needed"
    echo "   Especially set HOST_IP to your server's IP or domain"
    echo ""
    read -p "Press Enter to continue or Ctrl+C to edit .env first..."
else
    echo "✅ .env file already exists"
fi

echo ""
echo "🚀 Starting Docker services..."
echo ""

# Stop any existing services
docker-compose down 2>/dev/null || true

# Build and start services
docker-compose up -d --build

echo ""
echo "⏳ Waiting for services to become healthy..."
echo ""

# Wait for services to be healthy
MAX_WAIT=120  # 2 minutes
WAITED=0
INTERVAL=5

while [ $WAITED -lt $MAX_WAIT ]; do
    # Check if all services are healthy
    HEALTHY=$(docker-compose ps --format json 2>/dev/null | grep -c '"Health":"healthy"' || echo "0")

    if [ "$HEALTHY" -ge 3 ]; then
        echo ""
        echo "✅ All services are healthy!"
        break
    fi

    echo -n "."
    sleep $INTERVAL
    WAITED=$((WAITED + INTERVAL))
done

echo ""
echo ""
echo "=========================================="
echo "   Deployment Status"
echo "=========================================="
echo ""

# Show service status
docker-compose ps

echo ""
echo "=========================================="
echo "   Access Information"
echo "=========================================="
echo ""
echo "🌐 Frontend:  http://localhost/ or http://$(hostname -I | awk '{print $1}')/"
echo "🔧 Backend:   http://localhost:3000/ping"
echo "🗄️  Database: localhost:5432 (postgres/example)"
echo ""
echo "=========================================="
echo "   Useful Commands"
echo "=========================================="
echo ""
echo "View logs:           docker-compose logs -f"
echo "View backend logs:   docker-compose logs -f backend"
echo "Stop services:       docker-compose down"
echo "Restart services:    docker-compose restart"
echo "Rebuild services:    docker-compose up -d --build"
echo ""
echo "For more information, see DOCKER_DEPLOYMENT.md"
echo ""
