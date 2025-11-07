# Production Deployment Checklist

This checklist covers all manual steps required to deploy ActionPhase to production using the docker-compose setup.

---

## Pre-Deployment: Get API Keys

Before deployment, sign up for these free services and obtain API keys:

### 1. **hCaptcha (Bot Prevention)**
- 🔗 Sign up: https://www.hcaptcha.com/
- 📝 Plan: Free (unlimited requests)
- 🔑 Keys needed:
  - **Site Key** (public, embedded in frontend)
  - **Secret Key** (private, backend only)

**Steps:**
1. Create hCaptcha account
2. Go to "Sites" → "New Site"
3. Add domain: `yourdomain.com` (or use `localhost` for testing)
4. Copy **Site Key** and **Secret Key**

### 2. **Resend (Email Sending)**
- 🔗 Sign up: https://resend.com/
- 📝 Plan: Free (3,000 emails/month)
- 🔑 Keys needed:
  - **API Key**

**Steps:**
1. Create Resend account
2. Go to "API Keys" → "Create API Key"
3. Copy the API key (starts with `re_`)
4. **Verify your domain** in Resend dashboard:
   - Add DNS records (DKIM, SPF, DMARC)
   - Wait for verification (~5 minutes)
   - **Important**: Emails will NOT send until domain is verified

### 3. **AWS Account (Backups - Optional)**
- 🔗 Sign up: https://aws.amazon.com/
- 📝 Plan: Free tier (5GB S3 storage)
- 🔑 Keys needed:
  - **AWS Access Key ID**
  - **AWS Secret Access Key**

**Steps:**
1. Create AWS account
2. Create IAM user with S3 permissions
3. Create S3 bucket: `actionphase-backups` (or your preferred name)
4. Generate access keys for the IAM user

---

## Deployment Steps

### Step 1: Initial Server Setup (Terraform)

**If using Terraform to provision EC2:**

```bash
# 1. Update terraform/variables.tf with your values
cd terraform

# 2. Initialize Terraform
terraform init

# 3. Preview changes
terraform plan \
  -var="domain=yourdomain.com" \
  -var="admin_email=admin@yourdomain.com" \
  -var="aws_region=us-east-1" \
  -var="instance_type=t4g.small"

# 4. Apply (creates EC2 instance)
terraform apply \
  -var="domain=yourdomain.com" \
  -var="admin_email=admin@yourdomain.com"

# 5. Note the output (public IP address)
terraform output
```

**If manually provisioning EC2:**

1. Launch Ubuntu 22.04 ARM instance (t4g.small)
2. Configure security group (ports 22, 80, 443)
3. SSH into instance
4. Run user-data.sh manually (see terraform/user-data.sh)

---

### Step 2: Configure Environment Variables

SSH into your EC2 instance:

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
cd /opt/actionphase
```

Edit the `.env` file with your production values:

```bash
sudo nano /opt/actionphase/.env
```

**Required Changes:**

```bash
# =============================================================================
# EMAIL CONFIGURATION - REQUIRED FOR EMAIL SENDING
# =============================================================================

# Update with your verified domain
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=ActionPhase

# Add your Resend API key
RESEND_API_KEY=re_YourActualResendAPIKeyHere

# =============================================================================
# HCAPTCHA CONFIGURATION - REQUIRED FOR REGISTRATION
# =============================================================================

# Add your hCaptcha keys
HCAPTCHA_SITE_KEY=10000000-ffff-ffff-ffff-000000000001  # Your actual site key
HCAPTCHA_SECRET=0x0000000000000000000000000000000000000000  # Your actual secret
HCAPTCHA_ENABLED=true

# =============================================================================
# DOMAIN CONFIGURATION - ALREADY SET BY user-data.sh
# =============================================================================

# Verify these were set correctly by terraform/user-data.sh
DOMAIN=yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com
CORS_ORIGINS=https://yourdomain.com

# =============================================================================
# AWS CONFIGURATION - OPTIONAL (FOR BACKUPS)
# =============================================================================

# If using S3 backups, add these
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
S3_BACKUP_BUCKET=actionphase-backups

# =============================================================================
# SLACK ALERTS - OPTIONAL
# =============================================================================

# If using Slack for monitoring alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# =============================================================================
# SECURITY - VERIFY THESE
# =============================================================================

# Verify JWT_SECRET was generated (should be long random string)
# If empty, generate one:
# JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Verify database password was changed from default
# DATABASE_URL should NOT contain "example" as password
```

**Save and exit** (Ctrl+X, Y, Enter)

---

### Step 3: Rebuild Frontend with hCaptcha Configuration

The frontend needs to be rebuilt with the hCaptcha site key baked in:

```bash
cd /opt/actionphase

# Stop services
sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Rebuild frontend with new environment variables
sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache frontend

# Start services
sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

**Why rebuild?** Vite bakes `VITE_*` environment variables into the frontend bundle at build time.

---

### Step 4: Setup SSL Certificates

Run the SSL setup script:

```bash
cd /opt/actionphase
sudo ./scripts/setup-ssl.sh
```

This will:
- Install Certbot
- Request Let's Encrypt certificate for your domain
- Configure nginx for HTTPS
- Set up auto-renewal cron job

**Prerequisites:**
- Domain DNS must point to your EC2 instance
- Ports 80 and 443 must be open in security group
- Email address must be valid (Let's Encrypt sends expiry notices)

---

### Step 5: Verify Deployment

**Check services are running:**

```bash
sudo docker-compose ps
```

Expected output:
```
NAME                      STATUS        PORTS
actionphase-backend       Up (healthy)  0.0.0.0:3000->3000/tcp
actionphase-certbot       Up
actionphase-db            Up (healthy)  0.0.0.0:5432->5432/tcp
actionphase-frontend      Up (healthy)
actionphase-nginx         Up (healthy)  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

**Check logs:**

```bash
# All services
sudo docker-compose logs -f

# Specific service
sudo docker-compose logs -f backend
sudo docker-compose logs -f frontend
```

**Test the application:**

1. **HTTP to HTTPS redirect:**
   ```bash
   curl -I http://yourdomain.com
   # Should return 301 redirect to https://
   ```

2. **Backend health:**
   ```bash
   curl https://yourdomain.com/api/v1/ping
   # Should return: {"message":"pong"}
   ```

3. **Frontend loads:**
   - Visit: https://yourdomain.com
   - Should load ActionPhase homepage

4. **hCaptcha appears on registration:**
   - Go to: https://yourdomain.com/register
   - Should see hCaptcha widget
   - If missing, check browser console for errors

5. **Test email sending:**
   - Register a new account
   - Check email for verification link
   - If not received:
     - Check Resend dashboard logs
     - Verify domain is verified in Resend
     - Check backend logs: `sudo docker-compose logs backend | grep email`

---

### Step 6: Setup Monitoring (Optional)

**Enable Slack alerts:**

1. Create Slack incoming webhook
2. Add to `.env`:
   ```bash
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```
3. Restart services:
   ```bash
   sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart
   ```

**Health check scripts run automatically:**
- `health-check.sh` - Every 5 minutes
- `check-disk.sh` - Daily at 2 AM
- `check-ssl.sh` - Daily at 2 AM

**View cron logs:**
```bash
sudo journalctl -u cron -f
```

---

### Step 7: Setup Backups

**Manual backup:**

```bash
cd /opt/actionphase
sudo ./scripts/backup-to-s3.sh
```

**Automatic backups:**
- Already configured in docker-compose.prod.yml
- Runs daily at 2 AM UTC
- Uploads to S3 bucket
- Keeps last 30 days

**Verify backup cron:**

```bash
# Check backup service is running
sudo docker-compose ps backup

# Check backup logs
sudo docker-compose logs backup

# Test backup manually
sudo docker exec actionphase-backup /scripts/backup-to-s3.sh
```

**Restore from backup:**

```bash
# List backups
aws s3 ls s3://actionphase-backups/

# Download backup
aws s3 cp s3://actionphase-backups/backup-YYYY-MM-DD-HHMMSS.sql.gz ./backups/

# Restore
cd /opt/actionphase
sudo ./scripts/restore-from-s3.sh backup-YYYY-MM-DD-HHMMSS.sql.gz
```

---

## Post-Deployment Checklist

- [ ] All services show "Up (healthy)" in `docker-compose ps`
- [ ] HTTPS works (certificate valid, no warnings)
- [ ] HTTP redirects to HTTPS
- [ ] Frontend loads at https://yourdomain.com
- [ ] Backend API responds at /api/v1/ping
- [ ] hCaptcha widget appears on registration page
- [ ] Can create test account (email verification works)
- [ ] Email verification link works
- [ ] Can log in with verified account
- [ ] Can create a game
- [ ] Database backups are working (check S3 bucket)
- [ ] Monitoring alerts work (if using Slack)
- [ ] SSL auto-renewal is configured (check cron)

---

## Common Issues & Troubleshooting

### hCaptcha Not Appearing

**Symptoms:** Registration form shows no captcha widget

**Solutions:**
1. Check browser console for errors
2. Verify `HCAPTCHA_SITE_KEY` in `.env`
3. Verify frontend was rebuilt after setting env var:
   ```bash
   sudo docker-compose build --no-cache frontend
   sudo docker-compose up -d
   ```
4. Check site key matches what's in hCaptcha dashboard

### Email Verification Not Sending

**Symptoms:** No email received after registration

**Solutions:**
1. Check Resend dashboard → Logs
2. Verify domain is verified in Resend (DNS records)
3. Check `.env` has correct `RESEND_API_KEY`
4. Check backend logs:
   ```bash
   sudo docker-compose logs backend | grep -i email
   ```
5. Check spam folder
6. Verify `EMAIL_FROM` domain matches verified Resend domain

### SSL Certificate Fails

**Symptoms:** Certbot fails to get certificate

**Solutions:**
1. Verify DNS points to your server:
   ```bash
   dig +short yourdomain.com
   # Should return your EC2 public IP
   ```
2. Verify ports 80 and 443 are open
3. Check nginx is running and accessible on port 80
4. Try manual certificate request:
   ```bash
   sudo certbot certonly --webroot -w /var/www/certbot \
     -d yourdomain.com --email admin@yourdomain.com --agree-tos
   ```

### Backend Not Starting

**Symptoms:** Backend service shows "Exited" or unhealthy

**Solutions:**
1. Check logs:
   ```bash
   sudo docker-compose logs backend
   ```
2. Common issues:
   - Database not ready: Wait 30 seconds and check again
   - Missing JWT_SECRET: Add to `.env`
   - Migration failure: Check database is accessible
3. Restart:
   ```bash
   sudo docker-compose restart backend
   ```

### Frontend Build Fails

**Symptoms:** Frontend service fails during build

**Solutions:**
1. Check build logs:
   ```bash
   sudo docker-compose build frontend
   ```
2. Common issues:
   - Invalid hCaptcha site key format
   - npm install failure (network issue)
3. Rebuild with verbose output:
   ```bash
   sudo docker-compose build --no-cache --progress=plain frontend
   ```

---

## Maintenance Commands

### View Logs
```bash
# All services
sudo docker-compose logs -f

# Specific service
sudo docker-compose logs -f backend
sudo docker-compose logs -f nginx

# Last 100 lines
sudo docker-compose logs --tail=100 backend
```

### Restart Services
```bash
# All services
sudo docker-compose restart

# Specific service
sudo docker-compose restart backend
sudo docker-compose restart frontend
```

### Update Application
```bash
cd /opt/actionphase

# Pull latest code
git pull origin main

# Rebuild and restart
sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Database Access
```bash
# Connect to PostgreSQL
sudo docker exec -it actionphase-db psql -U postgres -d actionphase

# Backup manually
sudo docker exec actionphase-db pg_dump -U postgres actionphase > backup.sql

# Restore manually
sudo docker exec -i actionphase-db psql -U postgres actionphase < backup.sql
```

### Check Disk Space
```bash
# Overall disk usage
df -h

# Docker disk usage
sudo docker system df

# Clean up old images/containers
sudo docker system prune -a
```

### Renew SSL Certificate Manually
```bash
sudo certbot renew
sudo docker-compose restart nginx
```

---

## Security Best Practices

1. **Rotate JWT_SECRET periodically** (every 90 days)
   - Generate new secret: `openssl rand -base64 64`
   - Update `.env`
   - Restart backend
   - All users will need to log in again

2. **Keep secrets out of version control**
   - Never commit `.env` file
   - Never commit API keys to git

3. **Monitor failed login attempts**
   - Check backend logs for auth failures
   - Consider adding fail2ban for brute force protection

4. **Keep system updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo reboot
   ```

5. **Review access logs**
   ```bash
   sudo docker-compose logs nginx | grep -E "POST|DELETE|PUT"
   ```

6. **Backup encryption**
   - Consider encrypting database backups before S3 upload
   - Use AWS S3 server-side encryption

---

## Cost Breakdown

**Free Tier:**
- hCaptcha: $0/month (unlimited)
- Resend: $0/month (3,000 emails/month)
- AWS S3: ~$0.15/month (5GB backups)

**Total: ~$17/month** (EC2 t4g.small + S3)

---

## Support & Debugging

**Check service status:**
```bash
sudo systemctl status docker
sudo docker-compose ps
```

**Check docker-compose configuration:**
```bash
sudo docker-compose config
```

**Check environment variables loaded:**
```bash
sudo docker-compose exec backend env | grep HCAPTCHA
sudo docker-compose exec backend env | grep RESEND
```

**Test from inside container:**
```bash
# Test backend can reach database
sudo docker-compose exec backend sh
ping db

# Test email configuration
sudo docker-compose exec backend env | grep EMAIL
```

---

## Emergency Procedures

### Rollback Deployment

```bash
cd /opt/actionphase

# Stop current version
sudo docker-compose down

# Checkout previous version
git log --oneline  # Find commit hash
git checkout <commit-hash>

# Rebuild and restart
sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Restore from Backup

See "Step 7: Setup Backups" → "Restore from backup"

### Complete Reset

```bash
cd /opt/actionphase

# Stop everything
sudo docker-compose down -v

# Remove all data (WARNING: This deletes everything)
sudo rm -rf backups/* uploads/*

# Start fresh
sudo docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Appendix: Environment Variables Reference

See `.env.docker` for complete reference with all available environment variables and their descriptions.

**Critical Variables:**
- `JWT_SECRET` - Must be strong random string
- `RESEND_API_KEY` - From Resend dashboard
- `HCAPTCHA_SITE_KEY` - From hCaptcha dashboard (public)
- `HCAPTCHA_SECRET` - From hCaptcha dashboard (private)
- `DOMAIN` - Your production domain
- `EMAIL_FROM` - Must match verified Resend domain

---

**Last Updated:** 2025-01-06
**Deployment Type:** Docker Compose (Local Build)
**Target Platform:** AWS EC2 (t4g.small ARM)
