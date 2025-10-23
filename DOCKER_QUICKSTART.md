# Docker Quick Start

Deploy the entire ActionPhase stack (database, backend, frontend) with a single command.

## Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- Ports 80, 3000, 5432 available

## One-Command Setup

```bash
./docker-setup.sh
```

That's it! The script will:
- ✅ Generate a secure JWT secret
- ✅ Create environment configuration
- ✅ Build all Docker images
- ✅ Start all services
- ✅ Run database migrations
- ✅ Wait for health checks

## Manual Setup

If you prefer manual setup:

```bash
# 1. Copy environment template
cp .env.docker .env

# 2. Generate JWT secret
openssl rand -base64 32

# 3. Edit .env and paste the JWT secret
nano .env

# 4. Start services
docker-compose up -d

# 5. Check status
docker-compose ps
```

## Access the Application

- **Frontend:** http://localhost/ or http://YOUR_SERVER_IP/
- **Backend API:** http://localhost:3000/ping
- **Database:** localhost:5432 (postgres/example)

## Common Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart services
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# Database backup
docker exec actionphase-db pg_dump -U postgres actionphase > backup.sql
```

## Troubleshooting

### Services won't start
```bash
docker-compose logs
```

### Port 80 already in use
```bash
# Check what's using port 80
sudo lsof -i :80

# Edit docker-compose.yml to use different port
# Change "80:80" to "8080:80"
```

### Database connection issues
```bash
# Wait for database to be ready
docker-compose ps

# Check database health
docker-compose exec db pg_isready -U postgres
```

## What's Running?

- **PostgreSQL 16** - Database with persistent storage
- **Go Backend** - REST API with automatic migrations
- **React + Nginx** - Production-optimized frontend

## For EC2/Cloud Deployment

See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for detailed cloud deployment instructions including:
- EC2 setup
- Firewall configuration
- HTTPS with Let's Encrypt
- Production hardening
- Monitoring and backups

## Architecture

```
┌─────────────────────────────────────┐
│         Nginx (Port 80)             │
│  ┌──────────────────────────────┐   │
│  │   React Frontend (Static)    │   │
│  └──────────────────────────────┘   │
│           │                          │
│           │ /api requests            │
│           ▼                          │
│  ┌──────────────────────────────┐   │
│  │   Go Backend (Port 3000)     │   │
│  └──────────────────────────────┘   │
│           │                          │
│           │ Database queries         │
│           ▼                          │
│  ┌──────────────────────────────┐   │
│  │  PostgreSQL 16 (Port 5432)   │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
       All connected via Docker network
```

## Next Steps

1. Change the default JWT secret in `.env` (already done if you used `docker-setup.sh`)
2. Configure your cloud firewall to allow port 80
3. (Optional) Set up HTTPS with Let's Encrypt
4. (Optional) Configure automated backups

For more details, see [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
