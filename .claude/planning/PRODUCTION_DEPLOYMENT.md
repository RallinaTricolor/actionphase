# Production Deployment Plan

**Status**: Planning Phase
**Last Updated**: 2025-11-03
**Cost Target**: <$15/month for hobby project

## Executive Summary

This document outlines the production deployment strategy for ActionPhase, optimized for:
- Very low monthly costs (hobby project budget)
- Infrequent deployments
- Small user base (friends group)
- Acceptable downtime for maintenance
- Simple, maintainable architecture

**Chosen Architecture**: Single EC2 instance with PostgreSQL + S3 backups
**Estimated Monthly Cost**: ~$14/month
**Comparison**: 50% cheaper than RDS-based architecture (~$28/month)

---

## Architecture Decision

### EC2 + Self-Managed PostgreSQL vs RDS

**Decision**: Use EC2 with self-managed PostgreSQL and S3 backups

**Rationale**:
1. **Cost**: Save ~$80/year (~50% reduction)
2. **Simplicity**: Entire stack on single instance (no network latency)
3. **Control**: Full PostgreSQL configuration access
4. **Acceptable trade-offs**: Manual patching acceptable for infrequent deploys
5. **Good enough reliability**: Daily S3 backups + EBS snapshots provide adequate recovery

### Cost Comparison

| Component | RDS Architecture | EC2 Architecture | Savings |
|-----------|-----------------|------------------|---------|
| Compute | t4g.micro EC2: $6/mo | t4g.small EC2: $12/mo | -$6/mo |
| Database | db.t4g.micro RDS: $14/mo | Included in EC2 | +$14/mo |
| Storage | 20GB EBS: $2/mo + 20GB RDS: $2.30/mo | 30GB EBS: $3/mo | +$1.30/mo |
| Backups | RDS: Free (20GB) | S3: $0.50/mo | -$0.50/mo |
| **Total** | **~$24/month** | **~$15.50/month** | **~$8.50/month** |

**Annual Savings**: ~$102/year

### When to Migrate to RDS

Consider upgrading to RDS if:
- [ ] User base grows significantly (need high availability)
- [ ] Point-in-time recovery becomes required (not just daily snapshots)
- [ ] Manual PostgreSQL patching becomes burdensome
- [ ] Read replicas needed for scaling
- [ ] Multi-region deployment required

---

## Deployment Architecture

### Single EC2 Instance Stack

**Instance Type**: t4g.small (ARM-based, 2 vCPU, 2GB RAM)
- Backend (Go binary via systemd)
- Frontend (nginx serving static files)
- PostgreSQL (local instance)
- Backup cron jobs

**Operating System**: Ubuntu 24.04 LTS (ARM64)

**Storage**: 30GB gp3 EBS volume
- OS + applications: ~10GB
- PostgreSQL data: ~15GB (growth capacity)
- Logs + temporary: ~5GB

### Network Configuration

**Security Groups**:
```yaml
Inbound Rules:
  - Port 80 (HTTP): 0.0.0.0/0
  - Port 443 (HTTPS): 0.0.0.0/0
  - Port 22 (SSH): YOUR_IP/32  # Restrict to your IP

Outbound Rules:
  - All traffic: 0.0.0.0/0  # For S3, package updates, etc.
```

**Elastic IP**: Attach static IP for consistent DNS mapping

### Application Layout

```
/opt/actionphase/
├── backend/
│   └── actionphase-server  # Go binary
├── frontend/
│   └── dist/               # Built React app
├── scripts/
│   ├── backup-postgres.sh
│   ├── monitor-backups.sh
│   └── restore-from-s3.sh
└── logs/
    ├── backend.log
    ├── nginx.log
    └── backup.log

/etc/systemd/system/
└── actionphase.service     # Systemd service for backend

/etc/nginx/
└── sites-available/
    └── actionphase         # Nginx configuration
```

---

## PostgreSQL Backup Strategy

### Daily Automated Backups to S3

**Backup Script**: `/opt/actionphase/scripts/backup-postgres.sh`

```bash
#!/bin/bash
# PostgreSQL backup to S3
# Runs daily via cron at 2 AM UTC

set -e

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="actionphase_${TIMESTAMP}.sql.gz"
S3_BUCKET="s3://actionphase-backups"
BACKUP_DIR="/tmp/pg_backups"
LOG_FILE="/opt/actionphase/logs/backup.log"

# Ensure backup directory exists
mkdir -p ${BACKUP_DIR}

# Log start
echo "[$(date)] Starting backup: ${BACKUP_FILE}" >> ${LOG_FILE}

# Create compressed backup
if pg_dump -U postgres actionphase | gzip > ${BACKUP_DIR}/${BACKUP_FILE}; then
  echo "[$(date)] Database dump successful" >> ${LOG_FILE}
else
  echo "[$(date)] ERROR: Database dump failed" >> ${LOG_FILE}
  exit 1
fi

# Upload to S3
if aws s3 cp ${BACKUP_DIR}/${BACKUP_FILE} ${S3_BUCKET}/backups/${BACKUP_FILE}; then
  echo "[$(date)] Upload to S3 successful" >> ${LOG_FILE}
else
  echo "[$(date)] ERROR: S3 upload failed" >> ${LOG_FILE}
  exit 1
fi

# Clean up local file
rm ${BACKUP_DIR}/${BACKUP_FILE}

# Optional: Delete backups older than 30 days from S3
echo "[$(date)] Cleaning up old backups..." >> ${LOG_FILE}
aws s3 ls ${S3_BUCKET}/backups/ | \
  grep -E "actionphase_[0-9]{8}_[0-9]{6}.sql.gz" | \
  awk '{print $4}' | \
  while read file; do
    file_date=$(echo $file | grep -oE "[0-9]{8}" | head -1)
    file_timestamp=$(date -d "${file_date}" +%s 2>/dev/null || echo 0)
    current_timestamp=$(date +%s)
    age_days=$(( (current_timestamp - file_timestamp) / 86400 ))

    if [ $age_days -gt 30 ]; then
      echo "[$(date)] Deleting old backup: $file (${age_days} days old)" >> ${LOG_FILE}
      aws s3 rm ${S3_BUCKET}/backups/$file
    fi
  done

echo "[$(date)] Backup completed successfully" >> ${LOG_FILE}
```

**Cron Configuration**: `/etc/cron.d/actionphase-backup`

```cron
# Daily PostgreSQL backup at 2 AM UTC
0 2 * * * postgres /opt/actionphase/scripts/backup-postgres.sh
```

**File Permissions**:
```bash
chmod +x /opt/actionphase/scripts/backup-postgres.sh
chown postgres:postgres /opt/actionphase/scripts/backup-postgres.sh
```

### S3 Bucket Configuration

**Bucket Name**: `actionphase-backups`

**Bucket Policy** (restrict to EC2 instance role):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowEC2BackupAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ActionPhaseEC2Role"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::actionphase-backups/*",
        "arn:aws:s3:::actionphase-backups"
      ]
    }
  ]
}
```

**Lifecycle Policy** (automatic cost optimization):
```json
{
  "Rules": [
    {
      "Id": "TransitionToIA",
      "Status": "Enabled",
      "Prefix": "backups/",
      "Transitions": [
        {
          "Days": 7,
          "StorageClass": "STANDARD_IA"
        }
      ]
    },
    {
      "Id": "DeleteOldBackups",
      "Status": "Enabled",
      "Prefix": "backups/",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

**Versioning**: Enabled (safety net against accidental deletions)

**Encryption**: AES-256 (SSE-S3) enabled by default

### Storage Cost Estimate

**Assumptions**:
- Database size: ~500MB compressed
- Daily backups
- 30-day retention
- 7 days in Standard, 23 days in Standard-IA

**Monthly Costs**:
- Standard storage (7 backups × 500MB): $0.16
- Standard-IA storage (23 backups × 500MB): $0.14
- PUT requests (30/month): $0.001
- **Total S3 cost: ~$0.30/month**

### Restore Procedure

**Restore Script**: `/opt/actionphase/scripts/restore-from-s3.sh`

```bash
#!/bin/bash
# Restore PostgreSQL from S3 backup

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup-filename>"
  echo "Available backups:"
  aws s3 ls s3://actionphase-backups/backups/ | grep .sql.gz
  exit 1
fi

BACKUP_FILE=$1
S3_BUCKET="s3://actionphase-backups"
RESTORE_DIR="/tmp/pg_restore"

mkdir -p ${RESTORE_DIR}

echo "Downloading backup: ${BACKUP_FILE}"
aws s3 cp ${S3_BUCKET}/backups/${BACKUP_FILE} ${RESTORE_DIR}/${BACKUP_FILE}

echo "Stopping backend service..."
sudo systemctl stop actionphase

echo "Dropping existing database..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS actionphase;"

echo "Creating fresh database..."
sudo -u postgres psql -c "CREATE DATABASE actionphase;"

echo "Restoring backup..."
gunzip -c ${RESTORE_DIR}/${BACKUP_FILE} | sudo -u postgres psql actionphase

echo "Starting backend service..."
sudo systemctl start actionphase

echo "Cleanup..."
rm ${RESTORE_DIR}/${BACKUP_FILE}

echo "Restore completed successfully!"
echo "Recovery Time: ~5 minutes"
```

**Recovery Time Objective (RTO)**: ~15 minutes total
- Download from S3: ~1 minute
- Stop services: ~30 seconds
- Database restore: ~3-5 minutes
- Start services: ~30 seconds
- Validation: ~5 minutes

**Recovery Point Objective (RPO)**: 24 hours (daily backups)

---

## Backup Monitoring

### Health Check Script

**Monitor Script**: `/opt/actionphase/scripts/monitor-backups.sh`

```bash
#!/bin/bash
# Check backup health and alert if stale

set -e

S3_BUCKET="s3://actionphase-backups"
ALERT_EMAIL="your@email.com"
MAX_AGE_HOURS=26  # Alert if no backup in 26 hours

# Get latest backup timestamp
LATEST=$(aws s3 ls ${S3_BUCKET}/backups/ | sort | tail -1 | awk '{print $1,$2}')

if [ -z "$LATEST" ]; then
  echo "ERROR: No backups found in S3!" | \
    mail -s "[ALERT] ActionPhase: No Backups Found" ${ALERT_EMAIL}
  exit 1
fi

# Calculate age in hours
LATEST_TIMESTAMP=$(date -d "$LATEST" +%s)
CURRENT_TIMESTAMP=$(date +%s)
AGE_HOURS=$(( (CURRENT_TIMESTAMP - LATEST_TIMESTAMP) / 3600 ))

if [ $AGE_HOURS -gt $MAX_AGE_HOURS ]; then
  echo "WARNING: Latest backup is ${AGE_HOURS} hours old (threshold: ${MAX_AGE_HOURS}h)" | \
    mail -s "[ALERT] ActionPhase: Backup Stale" ${ALERT_EMAIL}
  exit 1
fi

echo "Backup health OK: Latest backup ${AGE_HOURS} hours old"
```

**Cron Configuration**: Run every 6 hours

```cron
# Check backup health every 6 hours
0 */6 * * * /opt/actionphase/scripts/monitor-backups.sh >> /opt/actionphase/logs/backup-monitor.log 2>&1
```

### Backup Metrics to Track

- **Backup frequency**: Daily (expected)
- **Backup size**: ~500MB compressed (baseline)
- **Backup duration**: ~2-3 minutes (normal)
- **S3 upload time**: ~1 minute (normal)
- **Retention**: 30 days minimum

**Alert conditions**:
- No backup in 26 hours
- Backup size <100MB (possible corruption)
- Backup duration >10 minutes (performance issue)
- S3 upload failures

---

## Deployment Checklist

### Pre-Launch Tasks

**Infrastructure Setup**:
- [ ] Launch t4g.small EC2 instance (Ubuntu 24.04 ARM64)
- [ ] Attach 30GB gp3 EBS volume
- [ ] Associate Elastic IP
- [ ] Configure security groups (ports 80, 443, 22)
- [ ] Create IAM role with S3 access for backups
- [ ] Attach IAM role to EC2 instance

**S3 Backup Configuration**:
- [ ] Create S3 bucket: `actionphase-backups`
- [ ] Enable versioning
- [ ] Configure lifecycle policy (7d Standard → 30d Standard-IA → delete)
- [ ] Enable default encryption (SSE-S3)
- [ ] Set bucket policy (restrict to EC2 instance role)

**PostgreSQL Setup**:
- [ ] Install PostgreSQL 16
- [ ] Configure `postgresql.conf` (performance tuning)
- [ ] Configure `pg_hba.conf` (local access only)
- [ ] Create `actionphase` database
- [ ] Create application user with limited permissions
- [ ] Run migrations: `just migrate`

**Application Deployment**:
- [ ] Clone repository to `/opt/actionphase`
- [ ] Build Go backend: `just build`
- [ ] Build React frontend: `just build-frontend`
- [ ] Create systemd service: `actionphase.service`
- [ ] Configure nginx (proxy to backend, serve static frontend)
- [ ] Install SSL certificate (Let's Encrypt)
- [ ] Configure environment variables in `/opt/actionphase/.env`

**Backup System**:
- [ ] Copy backup scripts to `/opt/actionphase/scripts/`
- [ ] Set executable permissions
- [ ] Configure cron jobs (backup + monitoring)
- [ ] Test manual backup: `./backup-postgres.sh`
- [ ] Verify S3 upload successful
- [ ] Test restore procedure on staging data
- [ ] Configure email alerts (for backup monitoring)

**Monitoring & Logging**:
- [ ] Configure systemd journal retention
- [ ] Set up log rotation for application logs
- [ ] Test backup health monitoring
- [ ] Configure CloudWatch metrics (optional, adds cost)

### Launch Day Tasks

- [ ] Final backup verification
- [ ] DNS cutover (point domain to Elastic IP)
- [ ] SSL certificate validation
- [ ] Smoke test all critical paths (login, game creation, etc.)
- [ ] Monitor logs for first 2 hours
- [ ] Verify first automated backup runs successfully

### Post-Launch Monitoring (First Week)

- [ ] Daily backup verification
- [ ] Monitor disk usage
- [ ] Check application logs for errors
- [ ] Verify backup rotation working (old backups deleted)
- [ ] Performance monitoring (response times)
- [ ] Database size growth tracking

---

## Maintenance Procedures

### Monthly Maintenance

**Security Updates** (1st Saturday of month):
```bash
# Update OS packages
sudo apt update && sudo apt upgrade -y

# Restart services if kernel updated
sudo systemctl restart actionphase
sudo systemctl restart nginx

# Verify services healthy
sudo systemctl status actionphase
curl -f http://localhost:3000/health || echo "Backend health check failed"
```

**Backup Verification** (2nd Saturday of month):
```bash
# Test restore procedure on separate test database
./scripts/restore-from-s3.sh actionphase_YYYYMMDD_HHMMSS.sql.gz

# Verify data integrity
psql actionphase -c "SELECT COUNT(*) FROM users;"
psql actionphase -c "SELECT COUNT(*) FROM games;"
```

### Quarterly Maintenance

**PostgreSQL Updates** (Quarterly):
```bash
# Backup before update
./scripts/backup-postgres.sh

# Check current version
psql --version

# Update PostgreSQL (if new version available)
sudo apt update
sudo apt install postgresql-16

# Run VACUUM ANALYZE
psql actionphase -c "VACUUM ANALYZE;"

# Update statistics
psql actionphase -c "ANALYZE;"
```

**Cost Review**:
- Review AWS billing
- Check S3 storage costs
- Verify lifecycle policies working
- Optimize if costs increasing

### Annual Maintenance

**Disaster Recovery Drill**:
- Simulate EC2 instance failure
- Practice full restore from S3 backup
- Measure actual RTO (should be <30 minutes)
- Document any issues or improvements

**Security Audit**:
- Review IAM permissions
- Rotate JWT secrets
- Update SSL certificates (if not auto-renewed)
- Review security group rules
- Check for PostgreSQL security updates

---

## Disaster Recovery Procedures

### Scenario 1: EC2 Instance Failure

**Detection**: Health checks fail, SSH unreachable

**Recovery Steps**:
1. Launch new t4g.small instance (same AMI/region)
2. Attach Elastic IP to new instance
3. Mount EBS volume (if salvageable) OR
4. Install PostgreSQL and restore from S3:
   ```bash
   # Get latest backup
   aws s3 ls s3://actionphase-backups/backups/ | tail -1

   # Restore
   ./scripts/restore-from-s3.sh <backup-file>
   ```
5. Deploy latest application code
6. Verify services healthy
7. Update DNS if needed

**Expected RTO**: 30 minutes
**Expected RPO**: 24 hours (last backup)

### Scenario 2: Database Corruption

**Detection**: Application errors, query failures

**Recovery Steps**:
1. Stop backend: `sudo systemctl stop actionphase`
2. Backup corrupted database (for forensics)
3. Restore from latest S3 backup
4. Verify data integrity
5. Restart backend
6. Monitor for recurring issues

**Expected RTO**: 15 minutes
**Expected RPO**: 24 hours

### Scenario 3: Accidental Data Deletion

**Detection**: User reports missing data

**Recovery Steps**:
1. Identify timestamp of deletion
2. Find backup BEFORE deletion
3. Restore to temporary database
4. Extract specific data needed
5. Import into production database
6. Verify with user

**Expected RTO**: 1 hour (manual extraction)
**Expected RPO**: Up to 24 hours

### Scenario 4: S3 Backup Failure

**Detection**: Backup monitoring alert

**Recovery Steps**:
1. Check backup script logs: `/opt/actionphase/logs/backup.log`
2. Verify IAM permissions still valid
3. Test manual S3 upload: `aws s3 cp test.txt s3://actionphase-backups/`
4. Check S3 bucket accessibility
5. Run manual backup: `./scripts/backup-postgres.sh`
6. Fix root cause (permissions, network, etc.)

**Expected RTO**: 2 hours (investigation + fix)

---

## Cost Breakdown & Optimization

### Monthly Cost Estimate (Detailed)

| Service | Component | Specs | Monthly Cost |
|---------|-----------|-------|-------------|
| **EC2** | t4g.small instance | 2 vCPU, 2GB RAM | $12.00 |
| | Elastic IP | Static IP | $0.00 (attached) |
| **Storage** | EBS gp3 volume | 30GB | $2.40 |
| | EBS snapshots | Weekly (4 snapshots) | $0.20 |
| **S3** | Standard storage | 7 backups × 500MB | $0.16 |
| | Standard-IA storage | 23 backups × 500MB | $0.14 |
| | PUT requests | 30/month | $0.00 |
| **Data Transfer** | Outbound (S3) | <1GB/month | $0.00 |
| **Total** | | | **$14.90/month** |

**Annual Cost**: ~$179/year

### Cost Optimization Tips

**Immediate Savings**:
- ✅ Use ARM-based t4g instances (20% cheaper than t3)
- ✅ Use gp3 EBS instead of gp2 (20% cheaper)
- ✅ S3 lifecycle policy (Standard → Standard-IA after 7 days)
- ✅ Compress backups with gzip (~90% size reduction)

**Future Optimizations** (if needed):
- Use AWS Free Tier (first 12 months): EC2 t2.micro free
- Consider EC2 Reserved Instances (if committing 1 year): ~40% savings
- Use S3 Glacier for long-term backup retention: ~80% cheaper than Standard-IA
- Implement incremental backups (reduce S3 storage)

**Not Recommended** (diminishing returns):
- Spot instances (not suitable for production database)
- Smaller instance types (t4g.micro insufficient for DB + app)
- Longer backup retention beyond 30 days (hobby project doesn't need)

---

## Performance Tuning

### PostgreSQL Configuration

**File**: `/etc/postgresql/16/main/postgresql.conf`

```ini
# Memory Configuration (for 2GB RAM instance)
shared_buffers = 512MB              # 25% of RAM
effective_cache_size = 1536MB       # 75% of RAM
maintenance_work_mem = 128MB
work_mem = 16MB

# Connection Settings
max_connections = 50                # Conservative for hobby project

# Write-Ahead Log
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# Query Planner
random_page_cost = 1.1              # SSD storage
effective_io_concurrency = 200      # SSD storage

# Logging (for troubleshooting)
log_min_duration_statement = 1000   # Log queries >1s
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

### Nginx Configuration

**File**: `/etc/nginx/sites-available/actionphase`

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    listen 80;
    listen [::]:80;
    server_name actionphase.example.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name actionphase.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/actionphase.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/actionphase.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    # Frontend (static files)
    location / {
        root /opt/actionphase/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
    }

    # Backend API (proxy)
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://localhost:3000/health;
    }
}
```

### Backend Systemd Service

**File**: `/etc/systemd/system/actionphase.service`

```ini
[Unit]
Description=ActionPhase Backend Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=actionphase
Group=actionphase
WorkingDirectory=/opt/actionphase/backend
EnvironmentFile=/opt/actionphase/.env
ExecStart=/opt/actionphase/backend/actionphase-server
Restart=on-failure
RestartSec=5s

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/actionphase/logs

# Resource limits
LimitNOFILE=4096
MemoryMax=512M

# Logging
StandardOutput=append:/opt/actionphase/logs/backend.log
StandardError=append:/opt/actionphase/logs/backend-error.log

[Install]
WantedBy=multi-user.target
```

---

## Security Hardening

### OS-Level Security

**Firewall (UFW)**:
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH (restrict to your IP in practice)
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

**Fail2Ban** (SSH brute-force protection):
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

**Automatic Security Updates**:
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### Application Security

**Environment Variables** (`/opt/actionphase/.env`):
```bash
# CRITICAL: Use strong, randomly generated secrets in production
JWT_SECRET=<generate-with-openssl-rand-base64-32>
DATABASE_URL=postgres://actionphase:STRONG_PASSWORD@localhost:5432/actionphase
ENVIRONMENT=production
LOG_LEVEL=info
```

**PostgreSQL Security**:
```bash
# Create limited application user (not postgres superuser)
sudo -u postgres psql << EOF
CREATE USER actionphase WITH PASSWORD 'STRONG_PASSWORD';
GRANT CONNECT ON DATABASE actionphase TO actionphase;
GRANT USAGE ON SCHEMA public TO actionphase;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO actionphase;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO actionphase;
EOF
```

**File Permissions**:
```bash
# Application directory
sudo chown -R actionphase:actionphase /opt/actionphase
sudo chmod 750 /opt/actionphase

# Environment file (contains secrets)
sudo chmod 600 /opt/actionphase/.env

# Backup scripts
sudo chmod 750 /opt/actionphase/scripts/*.sh
```

---

## Monitoring & Alerting

### Essential Metrics to Monitor

**System Metrics**:
- CPU utilization (alert if >80% sustained)
- Memory usage (alert if >90%)
- Disk usage (alert if >85%)
- Disk I/O wait (alert if >30%)

**Application Metrics**:
- Backend health endpoint (`/health`)
- HTTP response times (alert if p95 >2s)
- Error rate (alert if >5% of requests)
- Active connections to PostgreSQL

**Backup Metrics**:
- Last successful backup timestamp (alert if >26 hours)
- Backup file size (alert if deviation >50%)
- S3 upload success rate

### Simple Monitoring Setup (No Cost)

**Cron-based Health Checks**:

```bash
# /opt/actionphase/scripts/health-check.sh
#!/bin/bash

set -e

# Check backend health endpoint
if ! curl -f http://localhost:3000/health &>/dev/null; then
  echo "[$(date)] Backend health check FAILED" | \
    mail -s "[ALERT] ActionPhase Backend Down" your@email.com
fi

# Check disk usage
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
  echo "[$(date)] Disk usage at ${DISK_USAGE}%" | \
    mail -s "[ALERT] ActionPhase Disk Space Low" your@email.com
fi

# Check PostgreSQL
if ! sudo -u postgres psql -c "SELECT 1" &>/dev/null; then
  echo "[$(date)] PostgreSQL check FAILED" | \
    mail -s "[ALERT] ActionPhase Database Down" your@email.com
fi
```

**Cron**: Run every 15 minutes
```cron
*/15 * * * * /opt/actionphase/scripts/health-check.sh
```

### Optional: CloudWatch Monitoring

**If you want AWS-integrated monitoring** (adds ~$3/month):

- Enable detailed EC2 monitoring
- Create CloudWatch alarms for CPU, memory, disk
- Send alerts to SNS topic → email
- Set up custom metrics from application logs

**Not required for hobby project**, but useful if you want centralized AWS monitoring.

---

## Rollback Procedures

### Application Rollback

**If new deployment breaks production**:

```bash
# Stop broken version
sudo systemctl stop actionphase

# Restore previous binary (keep last 3 versions)
cd /opt/actionphase/backend
cp actionphase-server.backup actionphase-server

# Restart
sudo systemctl start actionphase

# Verify
curl http://localhost:3000/health
```

**Best practice**: Keep last 3 deployment binaries
```bash
# During deployment
mv actionphase-server actionphase-server.backup.2
mv actionphase-server.backup actionphase-server.backup.1
cp new-build/actionphase-server .
```

### Database Rollback

**If migration breaks production**:

```bash
# Rollback migration
cd /opt/actionphase/backend
migrate -path pkg/db/migrations -database "${DATABASE_URL}" down 1

# Verify schema
psql actionphase -c "\dt"

# Restart backend
sudo systemctl restart actionphase
```

**Best practice**: Test migrations on staging database first

---

## Future Enhancements

### Short-term Improvements (Next 3-6 Months)

- [ ] Automated deployment script (rsync + systemd restart)
- [ ] Incremental backups (reduce S3 costs)
- [ ] CloudWatch dashboard (if monitoring becomes priority)
- [ ] Automated SSL certificate renewal verification
- [ ] Database query performance monitoring

### Long-term Improvements (6-12 Months)

- [ ] Blue-green deployment strategy
- [ ] Read replica for reporting (if needed)
- [ ] Multi-region backup replication
- [ ] Automated testing in staging environment
- [ ] CDN for static assets (if global users)

### Scalability Considerations

**When to scale up**:
- Concurrent users >50
- Database size >20GB
- Response times consistently >1s
- CPU utilization sustained >80%

**Scaling options** (in order of cost-effectiveness):
1. Vertical scaling: t4g.medium (4GB RAM) - +$12/month
2. Separate database instance: t4g.small for DB - +$12/month
3. Load balancer + multiple backend instances: +$20/month
4. Migrate to RDS: +$14/month, better automation

**For hobby project**: Current architecture sufficient for 100+ concurrent users

---

## Conclusion

This production deployment plan provides:

- ✅ **Cost-effective hosting** (~$15/month)
- ✅ **Reliable backups** (daily S3 backups, 30-day retention)
- ✅ **Disaster recovery** (RTO: 30 minutes, RPO: 24 hours)
- ✅ **Simple maintenance** (quarterly updates acceptable)
- ✅ **Security hardening** (SSL, firewall, limited permissions)
- ✅ **Performance optimization** (tuned for 2GB RAM instance)

**Next Steps**:
1. Review and approve this plan
2. Set up AWS infrastructure (EC2 + S3)
3. Test backup/restore procedures in staging
4. Deploy to production
5. Monitor for first week
6. Schedule quarterly maintenance reviews

**Total setup time**: ~4-6 hours initial setup, then <1 hour/month maintenance
