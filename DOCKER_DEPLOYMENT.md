# Docker Deployment Guide

This guide covers deploying ActionPhase using Docker Compose, designed for easy deployment on cloud instances (EC2, DigitalOcean, etc.).

## Quick Start

### Prerequisites

- Docker Engine 20.10+ ([Install Docker](https://docs.docker.com/engine/install/))
- Docker Compose 2.0+ ([Install Docker Compose](https://docs.docker.com/compose/install/))
- Port 80 and 3000 open for external access

### One-Command Deployment

```bash
# 1. Clone the repository
git clone <repository-url>
cd actionphase

# 2. Set up environment variables
cp .env.docker .env

# 3. IMPORTANT: Edit .env and set JWT_SECRET
nano .env  # or vim/vi

# Generate a secure JWT secret:
openssl rand -base64 32

# 4. Start all services
docker-compose up -d

# 5. Check status
docker-compose ps
```

That's it! The application will be available at `http://your-server-ip/`

## Architecture

The Docker setup includes three services:

1. **Database (PostgreSQL 16)** - Port 5432
   - Persistent data stored in Docker volume `pgdata`
   - Automatic database initialization
   - Health checks enabled

2. **Backend (Go API)** - Port 3000
   - Automatic database migrations on startup
   - Health checks via `/ping` endpoint
   - Connects to database via internal network

3. **Frontend (React + Nginx)** - Port 80
   - Production-optimized build
   - Nginx serves static files
   - Proxies `/api` requests to backend
   - Gzip compression enabled

## Service Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db

# Check service health
docker-compose ps

# Rebuild after code changes
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

## Environment Configuration

### Required Variables

Edit `.env` before deployment:

```bash
# CRITICAL: Generate a strong secret
JWT_SECRET=your-super-secret-jwt-signing-key-change-this-in-production

# Optional: Set your domain or IP
HOST_IP=your.domain.com  # or your-ec2-ip
```

### Optional Variables

```bash
ENVIRONMENT=production      # development, staging, or production
LOG_LEVEL=info             # debug, info, warn, error
```

## Cloud Deployment (EC2 / DigitalOcean / etc.)

### EC2 Setup Example

```bash
# 1. SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# 3. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Clone and deploy
git clone <repository-url>
cd actionphase
cp .env.docker .env
nano .env  # Set JWT_SECRET
docker-compose up -d

# 5. Configure security group to allow:
#    - Port 80 (HTTP) from 0.0.0.0/0
#    - Port 22 (SSH) from your IP only
```

### Firewall Configuration

```bash
# Ubuntu/Debian with ufw
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp
sudo ufw enable

# CentOS/RHEL with firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

## Database Management

### Accessing the Database

```bash
# Connect to database from host
docker exec -it actionphase-db psql -U postgres -d actionphase

# Or from inside the container
docker-compose exec db psql -U postgres -d actionphase
```

### Database Backup

```bash
# Create backup
docker exec actionphase-db pg_dump -U postgres actionphase > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker exec -i actionphase-db psql -U postgres -d actionphase < backup_file.sql
```

### Database Reset

```bash
# WARNING: This deletes all data!
docker-compose down -v  # -v flag removes volumes
docker-compose up -d
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs

# Check specific service
docker-compose logs backend

# Verify Docker daemon is running
sudo systemctl status docker
```

### Backend Can't Connect to Database

```bash
# Check if database is healthy
docker-compose ps

# Verify network connectivity
docker-compose exec backend ping db

# Check database logs
docker-compose logs db
```

### Frontend Shows 502 Bad Gateway

```bash
# Check if backend is running
docker-compose ps backend

# Check backend health
curl http://localhost:3000/ping

# Check backend logs
docker-compose logs backend

# Restart backend
docker-compose restart backend
```

### Port Already in Use

```bash
# Check what's using port 80
sudo lsof -i :80

# Stop the conflicting service
sudo systemctl stop apache2  # or nginx, etc.

# Or modify docker-compose.yml to use different ports
# Change "80:80" to "8080:80" for example
```

### Migrations Not Running

```bash
# Check backend logs for migration errors
docker-compose logs backend | grep migration

# Run migrations manually
docker-compose exec backend ./main migrate up
```

## Production Hardening

### Security Checklist

- [ ] Change default `JWT_SECRET` to a strong random value
- [ ] Use HTTPS with Let's Encrypt (see below)
- [ ] Change PostgreSQL default password
- [ ] Enable firewall (ufw/firewalld)
- [ ] Set up regular database backups
- [ ] Configure log rotation
- [ ] Use a reverse proxy (nginx/Traefik) for SSL

### Adding HTTPS with Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Update docker-compose.yml to mount certificates
# (Add nginx SSL configuration)
```

### Monitoring

```bash
# View resource usage
docker stats

# View disk usage
docker system df

# Clean up unused images
docker system prune -a
```

## Updating the Application

```bash
# 1. Pull latest code
git pull

# 2. Rebuild and restart
docker-compose up -d --build

# 3. Check logs
docker-compose logs -f
```

## Performance Tuning

### For Small Instances (1-2 GB RAM)

```bash
# Limit backend memory
# Add to backend service in docker-compose.yml:
#   deploy:
#     resources:
#       limits:
#         memory: 512M
```

### For High Traffic

```bash
# Increase database connections
# Add to backend environment in docker-compose.yml:
DATABASE_MAX_CONNECTIONS=50

# Scale backend (requires load balancer)
docker-compose up -d --scale backend=3
```

## Development vs Production

This setup is optimized for production. For local development, use:

```bash
# Local development (without Docker)
just dev         # Start backend
just run-frontend # Start frontend
```

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Verify health: `docker-compose ps`
3. Review this guide's troubleshooting section
4. Check GitHub issues
