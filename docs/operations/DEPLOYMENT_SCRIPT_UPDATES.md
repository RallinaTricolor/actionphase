# Deployment Script Updates for Log Persistence

## Summary

Updated both deployment scripts to automatically use the new log persistence configuration with `docker-compose.logging.yml`.

## Changes Made

### 1. `scripts/deploy-production.sh`

#### Added Log Persistence Configuration
- **Line 20**: Added `LOG_DIR` variable (default: `./logs`)
- **Line 20**: Updated `COMPOSE_FILES` to include `-f docker-compose.logging.yml`

#### Pre-Deployment Checks
- **Lines 57-74**: Added check for `docker-compose.logging.yml`
  - ✅ If found: Enables log persistence and continues
  - ⚠️ If missing: Warns user and asks for confirmation
  - Falls back to non-logging deployment if user confirms

#### Directory Creation
- **Lines 77-86**: Creates log directories automatically:
  ```bash
  mkdir -p logs/{backend,frontend,nginx,postgres,backup}
  chmod -R 755 logs/
  ```

#### Post-Deployment Information
- **Lines 215-236**: Added log disk usage reporting
  - Shows total log directory size
  - Lists size per service
  - Warns if any log files exceed 100MB
  - Suggests log rotation if needed

#### Updated Help Text
- **Lines 207-218**: Enhanced "Useful commands" section:
  - Added persisted log viewing commands
  - Added log search examples
  - Added log location information

### 2. `scripts/deploy-remote.sh`

#### Fallback Deployment Enhancement
- **Lines 117-131**: Updated fallback deployment logic
  - Automatically detects and includes `docker-compose.logging.yml`
  - Creates log directories if logging is enabled
  - Shows confirmation when log persistence is enabled

#### Updated Next Steps
- **Lines 181-186**: Enhanced post-deployment instructions
  - Added command to view persisted logs
  - Distinguishes between container logs and persisted logs

---

## Usage

### Local Deployment (on server)
```bash
# SSH to production server
ssh ubuntu@your-server.com

# Navigate to project
cd /opt/actionphase

# Run deployment (automatically includes logging)
./scripts/deploy-production.sh
```

**Output includes:**
- ✅ "Log persistence enabled via docker-compose.logging.yml"
- 📊 Log disk usage statistics
- 📍 Commands to view persisted logs

### Remote Deployment (from local machine)
```bash
# From your local machine
./scripts/deploy-remote.sh ubuntu@your-server.com

# Or set environment variable
export ACTIONPHASE_SERVER=ubuntu@your-server.com
./scripts/deploy-remote.sh
```

**Automatically:**
- Pushes code to git
- Pulls on remote server
- Runs `deploy-production.sh` with logging enabled
- Shows deployment status

---

## What Happens During Deployment

### 1. Pre-Flight Checks
```
📥 Pulling latest changes from git...
✓ Log persistence enabled via docker-compose.logging.yml
📁 Ensuring required directories exist...
✓ Log directories created/verified
```

### 2. Deployment Process
```
💾 Creating pre-deployment database backup...
🔨 Building Docker images...
🚀 Starting deployment...
📊 Updating database...
🔧 Updating backend service...
✓ Backend API is responding
🎨 Updating frontend service...
🔒 Updating nginx service...
```

### 3. Post-Deployment Report
```
📈 Resource Usage:
==============================
NAME                    CPU %     MEM USAGE
actionphase-backend     2.5%      256MB / 512MB
actionphase-frontend    0.5%      64MB / 256MB
actionphase-nginx       0.3%      32MB / 128MB

📊 Log Disk Usage:
==============================
52M     logs/
  32M   logs/backend
  12M   logs/nginx
  8M    logs/frontend
```

### 4. Helpful Commands
```
Useful commands:
  Container logs:   docker-compose -f ... logs -f
  Backend logs:     docker-compose logs -f backend
  Persisted logs:   tail -f ./logs/backend/app.log
  Nginx access:     tail -f ./logs/nginx/access.log
  Search errors:    grep '"level":"error"' ./logs/backend/app.log | jq .
  Restart service:  docker-compose restart [service]
  Stop all:         docker-compose down

Log locations:
  Application:      ./logs/
  Container logs:   /var/lib/docker/containers/
```

---

## Backward Compatibility

### If `docker-compose.logging.yml` Doesn't Exist

The script gracefully handles missing logging configuration:

```
⚠️  Warning: docker-compose.logging.yml not found
Log persistence is disabled. Logs will be lost when containers are removed.
To enable log persistence, create docker-compose.logging.yml
See: docs/operations/LOGGING_STRATEGY.md

Continue without log persistence? (y/n):
```

**Options:**
- Press `y`: Continue deployment without log persistence
- Press `n`: Cancel deployment to add logging configuration

**Falls back to:**
```bash
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
```

---

## Testing

### Test Deployment Script Locally
```bash
# Dry run (check without deploying)
cd /opt/actionphase
bash -n ./scripts/deploy-production.sh  # Syntax check

# Test with docker-compose check
docker-compose -f docker-compose.yml \
               -f docker-compose.prod.yml \
               -f docker-compose.logging.yml \
               config  # Validates configuration
```

### Verify Log Directories Created
```bash
# After running deploy-production.sh
ls -la /opt/actionphase/logs/

# Expected output:
# drwxr-xr-x  backend/
# drwxr-xr-x  frontend/
# drwxr-xr-x  nginx/
# drwxr-xr-x  postgres/
# drwxr-xr-x  backup/
```

### Verify Logs Are Being Written
```bash
# Generate some activity
curl http://localhost:3000/ping

# Check if logs exist
tail /opt/actionphase/logs/backend/app.log

# Should show JSON log entries with timestamps
```

---

## Troubleshooting

### Issue: "docker-compose.logging.yml not found"

**Solution 1**: Create the file
```bash
cd /opt/actionphase
# Copy from git or create manually
cp docker-compose.logging.yml.example docker-compose.logging.yml
```

**Solution 2**: Deploy without logging (not recommended)
```bash
# Press 'y' when prompted
./scripts/deploy-production.sh
```

### Issue: "Permission denied" on log directories

**Fix permissions:**
```bash
sudo chown -R ubuntu:ubuntu /opt/actionphase/logs
sudo chmod -R 755 /opt/actionphase/logs
```

### Issue: Logs filling up disk

**View disk usage:**
```bash
du -sh /opt/actionphase/logs/*
```

**Rotate logs manually:**
```bash
logrotate -f /etc/logrotate.d/actionphase
```

**Clean old compressed logs:**
```bash
find /opt/actionphase/logs -name "*.gz" -mtime +30 -delete
```

---

## Migration from Old Deployment

### For Existing Production Servers

1. **Pull latest code:**
   ```bash
   cd /opt/actionphase
   git pull origin main
   ```

2. **Verify `docker-compose.logging.yml` exists:**
   ```bash
   ls -l docker-compose.logging.yml
   ```

3. **Run deployment:**
   ```bash
   ./scripts/deploy-production.sh
   ```

4. **Verify logs are being written:**
   ```bash
   ls -lh logs/backend/
   tail -f logs/backend/app.log
   ```

### Manual Deployment (Without Script)

If you prefer to deploy manually:

```bash
# Create log directories
mkdir -p logs/{backend,frontend,nginx,postgres,backup}

# Deploy with logging
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f docker-compose.logging.yml \
  up -d

# Verify
docker-compose ps
ls -lh logs/
```

---

## Environment Variables

The deployment scripts support these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_DIR` | `/opt/actionphase` | Project root directory |
| `BACKUP_DIR` | `./backups` | Database backup location |
| `LOG_DIR` | `./logs` | Persisted logs location |
| `BRANCH` | `main` | Git branch to deploy |
| `ACTIONPHASE_SERVER` | `ubuntu@your-server-ip` | Remote server for deploy-remote.sh |

**Example usage:**
```bash
# Deploy from different directory
PROJECT_DIR=/srv/actionphase ./scripts/deploy-production.sh

# Use different log location
LOG_DIR=/var/log/actionphase ./scripts/deploy-production.sh
```

---

## Best Practices

### Before Each Deployment
1. ✅ Review changes: `git log --oneline -10`
2. ✅ Test locally if possible
3. ✅ Check disk space: `df -h`
4. ✅ Verify backup is recent: `ls -lt backups/ | head`

### After Each Deployment
1. ✅ Verify all services healthy
2. ✅ Check for errors: `grep '"level":"error"' logs/backend/app.log | tail -20`
3. ✅ Test critical functionality
4. ✅ Monitor for 5-10 minutes

### Regular Maintenance
1. ✅ Weekly: Check log disk usage
2. ✅ Weekly: Review error logs
3. ✅ Monthly: Clean old compressed logs
4. ✅ Monthly: Review and optimize log retention

---

## Related Documentation

- **Logging Strategy**: `docs/operations/LOGGING_STRATEGY.md`
- **Quick Reference**: `docs/operations/LOGGING_QUICK_REFERENCE.md`
- **Deployment Guide**: `docs/operations/DEPLOYMENT_IMPROVEMENTS.md`
- **Production Setup**: `.claude/planning/PRODUCTION_DEPLOYMENT.md`

---

## Summary of Changes

✅ **deploy-production.sh**:
- Automatically includes `docker-compose.logging.yml`
- Creates log directories
- Shows log disk usage
- Enhanced helpful commands
- Graceful fallback if logging config missing

✅ **deploy-remote.sh**:
- Runs updated `deploy-production.sh` on remote
- Fallback deployment includes logging config
- Updated next steps with log viewing commands

✅ **Backward Compatible**:
- Works with or without `docker-compose.logging.yml`
- Warns user if logging is disabled
- No breaking changes to existing deployments

**Result**: Zero-config log persistence for production deployments! 🎉
