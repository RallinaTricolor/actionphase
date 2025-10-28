# Production Deployment Guide

**Comprehensive guide for deploying ActionPhase to production**

**Last Updated**: October 27, 2025
**Status**: Initial Draft

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Environment Setup](#environment-setup)
4. [Database Setup](#database-setup)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [Security Configuration](#security-configuration)
8. [Monitoring & Observability](#monitoring--observability)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools
- Docker and Docker Compose
- PostgreSQL 14+
- Go 1.21+
- Node.js 20+ and npm
- nginx or similar reverse proxy
- SSL certificates (Let's Encrypt recommended)

### Required Services
- PostgreSQL database
- Redis (for session management - optional)
- Object storage for file uploads (S3 or compatible)

## Infrastructure Requirements

### Minimum Hardware
- **Backend Server**: 2 CPU cores, 4GB RAM
- **Database Server**: 2 CPU cores, 4GB RAM, 50GB SSD
- **Frontend CDN**: Any static hosting service

### Recommended Hardware
- **Backend Server**: 4 CPU cores, 8GB RAM
- **Database Server**: 4 CPU cores, 16GB RAM, 100GB SSD
- **Load Balancer**: nginx/HAProxy

## Environment Setup

### 1. Production Environment Variables

Create `.env.production`:

```bash
# Database Configuration
DATABASE_URL=postgres://actionphase_user:STRONG_PASSWORD@db.internal:5432/actionphase?sslmode=require
DATABASE_MAX_CONNECTIONS=100
DATABASE_MAX_IDLE_CONNECTIONS=10
DATABASE_MAX_LIFETIME=1h

# JWT Configuration
JWT_SECRET=<generate-strong-64-char-secret>
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d

# Server Configuration
ENVIRONMENT=production
PORT=3000
LOG_LEVEL=info
CORS_ALLOWED_ORIGINS=https://yourdomain.com

# Security
BCRYPT_COST=12
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# File Storage (S3 or compatible)
STORAGE_TYPE=s3
S3_BUCKET=actionphase-uploads
S3_REGION=us-east-1
S3_ACCESS_KEY=<your-access-key>
S3_SECRET_KEY=<your-secret-key>

# Monitoring
METRICS_ENABLED=true
METRICS_PORT=9090
TRACING_ENABLED=true
TRACING_ENDPOINT=http://jaeger:14268/api/traces
```

### 2. Generate Secure Secrets

```bash
# Generate JWT secret
openssl rand -base64 64

# Generate database password
openssl rand -base64 32
```

## Database Setup

### 1. PostgreSQL Installation

```bash
# Using Docker
docker run -d \
  --name actionphase-db \
  -e POSTGRES_DB=actionphase \
  -e POSTGRES_USER=actionphase_user \
  -e POSTGRES_PASSWORD=<strong-password> \
  -p 5432:5432 \
  -v /data/postgres:/var/lib/postgresql/data \
  postgres:14-alpine
```

### 2. Database Configuration

Edit `postgresql.conf`:

```conf
# Performance tuning
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1

# Connection settings
max_connections = 200
```

### 3. Run Migrations

```bash
# From project root
DATABASE_URL=<production-db-url> just migrate
```

### 4. Create Database Backups

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/actionphase_${DATE}.sql"

pg_dump $DATABASE_URL > $BACKUP_FILE
gzip $BACKUP_FILE

# Keep only last 30 days of backups
find /backups -name "*.sql.gz" -mtime +30 -delete
```

## Backend Deployment

### 1. Build Production Binary

```bash
# Build optimized binary
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -ldflags="-w -s" \
  -o actionphase-server \
  ./backend/main.go
```

### 2. Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./backend/main.go

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/server .
COPY --from=builder /app/.env.production .env
EXPOSE 3000
CMD ["./server"]
```

Build and run:

```bash
docker build -t actionphase-backend .
docker run -d \
  --name actionphase-backend \
  --env-file .env.production \
  -p 3000:3000 \
  actionphase-backend
```

### 3. Systemd Service (Alternative)

Create `/etc/systemd/system/actionphase.service`:

```ini
[Unit]
Description=ActionPhase Backend
After=network.target postgresql.service

[Service]
Type=simple
User=actionphase
Group=actionphase
WorkingDirectory=/opt/actionphase
ExecStart=/opt/actionphase/actionphase-server
Restart=always
RestartSec=10
Environment="ENVIRONMENT=production"
EnvironmentFile=/opt/actionphase/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
systemctl enable actionphase
systemctl start actionphase
```

## Frontend Deployment

### 1. Build Production Assets

```bash
cd frontend
npm ci --production
npm run build
```

### 2. Configure for Production

Update `frontend/.env.production`:

```bash
VITE_API_URL=https://api.yourdomain.com
VITE_APP_URL=https://yourdomain.com
```

### 3. Deploy to CDN/Static Hosting

#### Option A: nginx

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    root /var/www/actionphase/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### Option B: Cloudflare Pages / Vercel / Netlify

```bash
# Cloudflare Pages
npm install -g wrangler
wrangler pages publish dist

# Vercel
npm install -g vercel
vercel --prod

# Netlify
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

## Security Configuration

### 1. SSL/TLS Setup

```bash
# Using Let's Encrypt
certbot certonly --nginx -d yourdomain.com -d api.yourdomain.com
```

### 2. Firewall Rules

```bash
# Allow only necessary ports
ufw allow 22/tcp   # SSH
ufw allow 443/tcp  # HTTPS
ufw allow 3000/tcp # Backend API (only from load balancer)
ufw allow 9090/tcp # Metrics (only from monitoring)
ufw enable
```

### 3. API Rate Limiting

Configure in nginx:

```nginx
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend:3000;
        }
    }
}
```

## Monitoring & Observability

### 1. Health Checks

```bash
# Backend health
curl https://api.yourdomain.com/health

# Database health
curl https://api.yourdomain.com/health/db
```

### 2. Prometheus Metrics

Configure Prometheus to scrape:

```yaml
scrape_configs:
  - job_name: 'actionphase'
    static_configs:
      - targets: ['backend:9090']
```

### 3. Logging

Configure centralized logging:

```bash
# Using Docker
docker run -d \
  --name actionphase-logs \
  -v /var/log/actionphase:/logs \
  grafana/loki
```

### 4. Alerts

Create `alerts.yml`:

```yaml
groups:
  - name: actionphase
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        annotations:
          summary: "High error rate detected"

      - alert: DatabaseDown
        expr: up{job="postgresql"} == 0
        annotations:
          summary: "Database is down"
```

## Backup & Recovery

### 1. Automated Backups

Create cron job:

```bash
# /etc/cron.d/actionphase-backup
0 2 * * * actionphase /opt/actionphase/scripts/backup.sh
```

### 2. Backup Script

```bash
#!/bin/bash
# /opt/actionphase/scripts/backup.sh

# Database backup
pg_dump $DATABASE_URL | gzip > /backups/db_$(date +%Y%m%d).sql.gz

# File uploads backup (if local)
tar -czf /backups/uploads_$(date +%Y%m%d).tar.gz /var/actionphase/uploads

# Sync to S3
aws s3 sync /backups s3://actionphase-backups/

# Keep only 30 days locally
find /backups -mtime +30 -delete
```

### 3. Recovery Procedure

```bash
# Restore database
gunzip < backup.sql.gz | psql $DATABASE_URL

# Restore uploads
tar -xzf uploads_backup.tar.gz -C /
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors
```bash
# Check PostgreSQL is running
systemctl status postgresql

# Check connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
SELECT count(*) FROM pg_stat_activity;
```

#### 2. High Memory Usage
```bash
# Check Go memory stats
curl http://localhost:9090/debug/pprof/heap

# Adjust GOGC and GOMEMLIMIT
export GOGC=50
export GOMEMLIMIT=1GiB
```

#### 3. Slow Response Times
```bash
# Check slow queries
SELECT query, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

# Add missing indexes
CREATE INDEX CONCURRENTLY idx_games_state ON games(state);
```

### Logs Location

- Backend: `/var/log/actionphase/backend.log`
- nginx: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- PostgreSQL: `/var/log/postgresql/postgresql-14-main.log`

## Deployment Checklist

- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database migrations completed
- [ ] Backups configured and tested
- [ ] Monitoring setup
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Rollback procedure documented
- [ ] Team trained on deployment procedures

## Support

For deployment issues:
1. Check logs in `/var/log/actionphase/`
2. Review metrics at `/metrics` endpoint
3. Check database status: `psql -c "SELECT version()"`
4. Verify environment: `echo $ENVIRONMENT`

---

*This guide covers standard deployment scenarios. Adjust based on your specific infrastructure and requirements.*
