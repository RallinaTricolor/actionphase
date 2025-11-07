# Production Deployment Plan - Simplified Docker Approach

**Status**: Implementation Ready
**Last Updated**: 2025-11-06
**Cost Target**: <$17/month for hobby project
**Deployment Strategy**: Docker Compose with local builds (no ECR/CI needed)

## Executive Summary

This document outlines a **simplified production deployment strategy** for ActionPhase, optimized for:
- Very low monthly costs (hobby project budget)
- Infrequent deployments (monthly or less)
- Small user base (friends group)
- Acceptable downtime for maintenance
- Simple `git pull` + `docker-compose` deployment flow

**Architecture**: Single EC2 instance with Docker Compose stack
**Estimated Monthly Cost**: ~$17/month
**Deployment Method**: SSH + git pull + docker-compose build

---

## Architecture Overview

### Simplified Stack on Single EC2 Instance

**Instance Type**: t4g.small (ARM-based, 2 vCPU, 2GB RAM)

**Docker Compose Services**:
- PostgreSQL 16 (database)
- ActionPhase Backend (Go API)
- ActionPhase Frontend (React/nginx)
- Nginx (SSL termination & reverse proxy)

**Deployment Flow**:
```
Local Development → Git Push → GitHub
                                  ↓
Production Server ← SSH + git pull ← Developer
                    ↓
             docker-compose up -d --build
```

**No External Dependencies**:
- ❌ No container registry (ECR)
- ❌ No CI/CD pipeline (GitHub Actions)
- ❌ No orchestration complexity
- ✅ Just Docker Compose with local builds

---

## Cost Breakdown

| Service | Component | Monthly Cost |
|---------|-----------|--------------|
| **EC2** | t4g.small instance (2 vCPU, 2GB RAM) | $12.00 |
| **Storage** | 30GB gp3 EBS volume | $2.40 |
| | Daily EBS snapshots (7-day retention) | $0.60 |
| | Weekly AMI snapshots (4 kept) | $1.50 |
| **S3** | Database backups (30-day retention) | $0.30 |
| **Monitoring** | CloudWatch alarm (instance health) | $0.10 |
| **Total** | | **$16.90/month** |

**Annual Cost**: ~$203/year

---

## Docker Compose Configuration

### Base Configuration (docker-compose.yml)

Already exists in repository with:
- PostgreSQL database with health checks
- Backend API with automatic migrations
- Frontend with nginx
- Proper service dependencies
- Volume persistence

### Production Extensions (docker-compose.prod.yml)

```yaml
# Extends base configuration for production
services:
  db:
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./backups:/backups  # For backup scripts
    deploy:
      resources:
        limits:
          memory: 512M

  backend:
    environment:
      ENVIRONMENT: production
      LOG_LEVEL: info
    deploy:
      resources:
        limits:
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    image: nginx:alpine
    container_name: actionphase-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - letsencrypt:/etc/letsencrypt
    depends_on:
      - frontend
      - backend

volumes:
  letsencrypt:
```

---

## Deployment Process

### Initial Server Setup (One-time)

1. **Launch EC2 Instance**
   ```bash
   # Use Ubuntu 24.04 LTS ARM64 AMI
   # Instance type: t4g.small
   # Security groups: 22, 80, 443
   # Attach elastic IP
   ```

2. **Install Docker & Docker Compose**
   ```bash
   # SSH to server
   ssh ubuntu@your-server-ip

   # Install Docker
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker ubuntu

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-linux-aarch64" \
     -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Clone Repository & Initial Deploy**
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/actionphase.git /opt/actionphase
   cd /opt/actionphase

   # Copy production environment file
   cp .env.docker .env
   # Edit .env with production values (JWT_SECRET, HOST_IP, etc.)

   # Run initial setup
   ./docker-setup.sh
   ```

4. **Set Up SSL with Let's Encrypt**
   ```bash
   # Run SSL setup script
   ./scripts/setup-ssl.sh your-domain.com
   ```

### Regular Deployment Process

**From Local Machine**:
```bash
# 1. Push changes to GitHub
git add .
git commit -m "Update feature X"
git push origin main

# 2. Deploy to production
./scripts/deploy-remote.sh
```

**Or Directly on Server**:
```bash
# SSH to server
ssh ubuntu@your-server-ip

# Navigate to project
cd /opt/actionphase

# Pull latest changes
git pull origin main

# Deploy with zero-downtime
./scripts/deploy-production.sh
```

**Deployment Script** (`deploy-production.sh`):
```bash
#!/bin/bash
set -e

echo "📦 Starting deployment..."

# Backup database
docker exec actionphase-db pg_dump -U postgres actionphase | \
  gzip > "./backups/pre-deploy-$(date +%Y%m%d_%H%M%S).sql.gz"

# Build new images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Rolling update (minimal downtime)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify health
sleep 10
docker-compose ps

echo "✅ Deployment complete!"
```

**Time per deployment**: ~5 minutes

---

## Backup Strategy

### Automated Daily Backups

**Backup Script** (`scripts/backup-to-s3.sh`):
- Runs daily at 2 AM via cron
- Creates PostgreSQL dump with pg_dump
- Compresses with gzip
- Uploads to S3 bucket
- Maintains 30-day retention
- Cleans up old backups automatically

**S3 Bucket Configuration**:
- Bucket: `actionphase-backups`
- Lifecycle: 7 days Standard → 23 days Standard-IA → Delete
- Versioning: Enabled
- Encryption: SSE-S3
- Cost: ~$0.30/month

**Recovery Time Objectives**:
- **RTO**: 15 minutes (from backup)
- **RPO**: 24 hours (daily backups)

### Restore Process

```bash
# List available backups
aws s3 ls s3://actionphase-backups/backups/

# Restore specific backup
./scripts/restore-from-s3.sh actionphase_20251106_020000.sql.gz
```

---

## Resilience Features

### Quick Wins (Immediate Implementation)

1. **EC2 Auto Recovery** ($0/month)
   - Automatic restart on hardware failures
   - Enable in AWS Console → EC2 → Instance Settings

2. **Weekly AMI Snapshots** (+$1.50/month)
   - Complete system backup
   - Enables full server rebuild in 15 minutes
   - Automated via cron

3. **Daily EBS Snapshots** (+$0.60/month)
   - Via AWS Backup service
   - 7-day retention
   - Point-in-time volume recovery

4. **CloudWatch Health Monitoring** (+$0.10/month)
   - Instance status checks
   - Email/SMS alerts on failures
   - Backup monitoring

### Infrastructure as Code (Terraform)

**Purpose**: Disaster recovery and reproducibility

```hcl
# terraform/main.tf
resource "aws_instance" "actionphase" {
  ami           = data.aws_ami.ubuntu_arm64.id
  instance_type = "t4g.small"

  user_data = file("${path.module}/user-data.sh")

  tags = {
    Name = "actionphase-production"
  }
}

resource "aws_s3_bucket" "backups" {
  bucket = "actionphase-backups"

  lifecycle_rule {
    enabled = true

    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 30
    }
  }
}
```

**Disaster Recovery**:
```bash
terraform apply  # Recreates entire infrastructure in 15 minutes
```

---

## SSL Certificate Management

### Let's Encrypt with Certbot

**Initial Setup**:
```bash
./scripts/setup-ssl.sh your-domain.com
```

**Auto-Renewal** (via cron):
```cron
0 0 * * 0 certbot renew --quiet --post-hook "docker-compose restart nginx"
```

**Manual Renewal**:
```bash
docker exec certbot certbot renew
docker-compose restart nginx
```

---

## Monitoring & Health Checks

### Docker Health Checks

All services include health checks in docker-compose.yml:
- **Database**: `pg_isready` every 10s
- **Backend**: `/ping` endpoint every 30s
- **Frontend**: HTTP check every 30s

### Cron-Based Monitoring

```bash
# /etc/cron.d/actionphase-monitoring

# Check backup recency (every 6 hours)
0 */6 * * * /opt/actionphase/scripts/health-check.sh

# Check disk usage (daily)
0 8 * * * /opt/actionphase/scripts/check-disk.sh

# Verify SSL certificate (weekly)
0 0 * * 0 /opt/actionphase/scripts/check-ssl.sh
```

### Manual Health Verification

```bash
# Check all services
docker-compose ps

# View logs
docker-compose logs -f --tail=100

# Check specific service
docker-compose exec backend curl http://localhost:3000/health

# Database connection test
docker-compose exec db psql -U postgres -c "SELECT 1"
```

---

## Maintenance Procedures

### Monthly Tasks

1. **Security Updates** (1st Saturday)
   ```bash
   sudo apt update && sudo apt upgrade -y
   docker-compose pull  # Update base images
   docker-compose up -d
   ```

2. **Backup Verification** (2nd Saturday)
   ```bash
   # Test restore to verify backup integrity
   ./scripts/test-restore.sh
   ```

### Quarterly Tasks

1. **Docker Cleanup**
   ```bash
   docker system prune -a --volumes
   ```

2. **PostgreSQL Maintenance**
   ```bash
   docker-compose exec db psql -U postgres actionphase -c "VACUUM ANALYZE;"
   ```

3. **Cost Review**
   - Check AWS billing
   - Verify S3 lifecycle working
   - Review CloudWatch metrics

---

## Rollback Procedures

### Application Rollback

```bash
# Quick rollback via git
cd /opt/actionphase
git log --oneline -10  # Find previous good commit
git checkout <commit-hash>
docker-compose up -d --build

# Or tag-based deployment
git checkout v1.2.3
docker-compose up -d --build
```

### Database Rollback

```bash
# Stop services
docker-compose stop backend

# Restore from backup
./scripts/restore-from-s3.sh actionphase_20251105_020000.sql.gz

# Restart services
docker-compose up -d
```

---

## Security Hardening

### Network Security

**Security Groups**:
```
Inbound:
- 22 (SSH): Your IP only
- 80 (HTTP): 0.0.0.0/0
- 443 (HTTPS): 0.0.0.0/0

Outbound:
- All traffic: 0.0.0.0/0
```

**UFW Firewall**:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp from YOUR_IP
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Application Security

**Environment Variables** (`.env`):
- Strong JWT_SECRET (generated)
- Database passwords (non-default)
- Production environment flags

**Docker Security**:
- Run containers as non-root users
- Resource limits on all containers
- Read-only root filesystems where possible
- No privileged containers

### Automated Updates

```bash
# Unattended upgrades for security patches
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Deployment Checklist

### Pre-Launch

- [ ] EC2 instance launched (t4g.small)
- [ ] Elastic IP attached
- [ ] Security groups configured
- [ ] Docker & Docker Compose installed
- [ ] Repository cloned to `/opt/actionphase`
- [ ] Production `.env` configured
- [ ] Initial `docker-setup.sh` run successful
- [ ] SSL certificates obtained
- [ ] S3 backup bucket created
- [ ] IAM role for S3 access configured
- [ ] Backup scripts tested
- [ ] CloudWatch alarms configured
- [ ] Domain DNS pointed to Elastic IP

### Launch Day

- [ ] Final backup before go-live
- [ ] Run deployment script
- [ ] Verify all services healthy
- [ ] Test critical user paths
- [ ] Monitor logs for first hour
- [ ] Confirm first automated backup runs

### Post-Launch (Week 1)

- [ ] Daily backup verification
- [ ] Monitor resource usage
- [ ] Review application logs
- [ ] Check SSL auto-renewal
- [ ] Document any issues

---

## Troubleshooting

### Common Issues

**Services Won't Start**:
```bash
# Check logs
docker-compose logs backend
docker-compose logs db

# Verify environment variables
docker-compose config

# Check disk space
df -h
```

**Database Connection Failed**:
```bash
# Test database directly
docker-compose exec db psql -U postgres

# Check network
docker network ls
docker network inspect actionphase_actionphase-network
```

**High Memory Usage**:
```bash
# Check container stats
docker stats

# Restart specific service
docker-compose restart backend
```

**SSL Certificate Issues**:
```bash
# Manual renewal
docker exec certbot certbot renew --force-renewal
docker-compose restart nginx

# Check certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

---

## Migration from Current Setup

Since you already have:
- ✅ Working docker-compose.yml
- ✅ Deployment script (docker-setup.sh)
- ✅ Staging environment

Migration is straightforward:

1. **Add production overrides**: Create `docker-compose.prod.yml`
2. **Set up SSL**: Run `setup-ssl.sh` script
3. **Configure backups**: Set up S3 bucket and cron jobs
4. **Add monitoring**: Enable CloudWatch alarms
5. **Test deployment**: Use existing `docker-setup.sh` flow

**No code changes required!** Just infrastructure setup.

---

## Future Considerations

### When to Scale

Consider changes when:
- Concurrent users exceed 50
- Database size exceeds 20GB
- Response times consistently >1s
- Deployment frequency increases to weekly

### Scaling Options

1. **Vertical Scaling** (+$12/month)
   - Upgrade to t4g.medium (4GB RAM)

2. **Database Separation** (+$12/month)
   - Dedicated t4g.small for PostgreSQL

3. **Managed Database** (+$14/month)
   - Migrate to RDS for automated backups

4. **CDN for Assets** (+$1-5/month)
   - CloudFront for static files

---

## Conclusion

This simplified deployment strategy provides:

- ✅ **Low cost**: ~$17/month (within budget)
- ✅ **Simple deployment**: git pull + docker-compose
- ✅ **Quick recovery**: 15-minute RTO with backups
- ✅ **Minimal maintenance**: Monthly updates sufficient
- ✅ **Production ready**: SSL, backups, monitoring included
- ✅ **No external dependencies**: No ECR, no CI/CD complexity

Perfect for a hobby project with infrequent deployments!

**Next Steps**:
1. Set up AWS infrastructure (EC2 + S3)
2. Run production deployment scripts
3. Configure SSL certificates
4. Enable automated backups
5. Test disaster recovery procedure

**Total Setup Time**: 2-3 hours
**Monthly Maintenance**: <30 minutes
