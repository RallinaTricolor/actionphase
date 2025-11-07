# Route53 and SSL Setup Guide

This guide walks you through setting up your domain with AWS Route53 and obtaining SSL certificates via Let's Encrypt.

## Prerequisites

- AWS account with Route53 access
- Domain name registered (can be through Route53 or another registrar)
- Production server with Docker and docker-compose installed
- Server accessible on ports 80 and 443

## Step 1: Check Server IP Configuration

On your production server, determine your IP addresses:

```bash
# Get IPv4 address
curl -4 ifconfig.me

# Check if you have IPv6 support
curl -6 ifconfig.me --max-time 5
```

**Note down your IPv4 address.** If the IPv6 command times out or fails, you only have IPv4 (most common).

## Step 2: Configure Route53 DNS Records

### For IPv4-Only Servers (Recommended)

Log into AWS Console → Route53 → Hosted Zones → Select your domain

**Create these records:**

1. **A Record for root domain:**
   - Record name: *(leave blank or enter `@`)*
   - Record type: `A - IPv4 address`
   - Value: `YOUR_SERVER_IPv4` (e.g., `54.123.45.67`)
   - TTL: `300`
   - Routing policy: `Simple routing`

2. **A Record for www subdomain:**
   - Record name: `www`
   - Record type: `A - IPv4 address`
   - Value: `YOUR_SERVER_IPv4`
   - TTL: `300`
   - Routing policy: `Simple routing`

### For Servers with IPv6 Support

If your server has IPv6, also create:

3. **AAAA Record for root domain:**
   - Record name: *(leave blank)*
   - Record type: `AAAA - IPv6 address`
   - Value: `YOUR_SERVER_IPv6` (e.g., `2600:1f18:xxxx:xxxx::`)
   - TTL: `300`

4. **AAAA Record for www subdomain:**
   - Record name: `www`
   - Record type: `AAAA - IPv6 address`
   - Value: `YOUR_SERVER_IPv6`
   - TTL: `300`

**Then enable IPv6 in nginx** by uncommenting the IPv6 lines in `nginx/nginx.prod.conf`:
```nginx
listen [::]:80;
listen [::]:443 ssl http2;
```

## Step 3: Verify DNS Propagation

Wait 2-5 minutes for DNS to propagate, then test:

```bash
# Install dig if needed (Ubuntu/Debian)
sudo apt-get install dnsutils

# Test your domain
dig +short yourdomain.com A
dig +short www.yourdomain.com A

# Should return your server's IPv4 address
```

**Alternative method using nslookup:**
```bash
nslookup yourdomain.com
nslookup www.yourdomain.com
```

## Step 4: Prepare Server Environment

1. **Clone the repository** (if not already done):
   ```bash
   cd /opt
   git clone https://github.com/yourusername/actionphase.git
   cd actionphase
   ```

2. **Create `.env` file:**
   ```bash
   cp .env.example .env
   nano .env
   ```

   Update these values:
   ```env
   DOMAIN=yourdomain.com
   JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars
   ENVIRONMENT=production
   LOG_LEVEL=info
   ```

3. **Ensure scripts are executable:**
   ```bash
   chmod +x scripts/setup-ssl.sh
   chmod +x scripts/check-ssl.sh
   ```

## Step 5: Start Docker Services

```bash
# Start the stack
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check services are running
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Check nginx logs
docker logs actionphase-nginx
```

## Step 6: Obtain SSL Certificate

Run the SSL setup script:

```bash
./scripts/setup-ssl.sh yourdomain.com admin@yourdomain.com
```

The script will:
1. Generate DH parameters (takes 2-5 minutes)
2. Configure nginx for Let's Encrypt validation
3. Obtain SSL certificate from Let's Encrypt
4. Configure nginx with SSL
5. Set up automatic renewal via cron

**Expected output:**
```
========================================
   ActionPhase SSL Setup
========================================

Domain: yourdomain.com
Email: admin@yourdomain.com

Creating SSL directories...
Generating DH parameters (this may take a few minutes)...
✓ DH parameters generated
Creating temporary nginx configuration...
Starting nginx for certificate validation...
Obtaining SSL certificate from Let's Encrypt...
✓ SSL certificate obtained successfully!
...
✓ SSL Setup Complete!
```

## Step 7: Verify SSL is Working

Test your site:

```bash
# Test HTTPS connection
curl -I https://yourdomain.com

# Check certificate details
./scripts/check-ssl.sh yourdomain.com
```

Or visit in browser:
- https://yourdomain.com
- https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com

## Troubleshooting

### DNS Not Resolving

**Problem:** `dig yourdomain.com` returns no results

**Solutions:**
1. Wait longer (DNS can take up to 48 hours, but usually 5-30 minutes)
2. Verify Route53 records are created correctly
3. If using external registrar, ensure nameservers point to Route53:
   ```bash
   dig NS yourdomain.com
   ```
   Should show AWS nameservers like `ns-123.awsdns-45.com`

### Certificate Validation Fails

**Problem:** Let's Encrypt can't validate domain ownership

**Common causes:**
1. **DNS not propagated:** Wait and retry
2. **Firewall blocking port 80:** Ensure port 80 is open:
   ```bash
   sudo ufw allow 80
   sudo ufw allow 443
   ```
3. **Nginx not serving .well-known:** Check nginx is running:
   ```bash
   docker logs actionphase-nginx
   ```

**Test validation path:**
```bash
# Create test file
mkdir -p certbot-webroot/.well-known/acme-challenge
echo "test" > certbot-webroot/.well-known/acme-challenge/test.txt

# Test from another machine
curl http://yourdomain.com/.well-known/acme-challenge/test.txt
```

### AAAA Record Error

**Problem:** Error mentions missing AAAA record

**Solution:** Disable IPv6 in nginx (already done in latest config):
```nginx
# In nginx/nginx.prod.conf, these lines should be commented:
# listen [::]:80;
# listen [::]:443 ssl http2;
```

Restart nginx:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

### Certificate Renewal Issues

**Problem:** Automatic renewal failing

**Check renewal status:**
```bash
# Test renewal
docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --entrypoint "" certbot \
    certbot renew --dry-run \
    --webroot \
    --webroot-path /var/www/certbot

# Check cron job is installed
crontab -l | grep renew-ssl
```

## Manual Certificate Renewal

If automatic renewal fails, manually renew:

```bash
./scripts/setup-ssl.sh yourdomain.com admin@yourdomain.com
```

Or directly:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --entrypoint "" certbot \
    certbot renew \
    --webroot \
    --webroot-path /var/www/certbot \
    --force-renewal

docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

## Security Checklist

After SSL is configured:

- [ ] Test SSL configuration at https://www.ssllabs.com/ssltest/
- [ ] Verify all HTTP traffic redirects to HTTPS
- [ ] Check certificate auto-renewal is scheduled: `crontab -l`
- [ ] Review nginx logs for any errors: `docker logs actionphase-nginx`
- [ ] Set up monitoring for certificate expiration (recommended: 30 days before expiry)
- [ ] Configure firewall to only allow ports 22, 80, 443, and 5432 (if database access needed)

## Additional Resources

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [AWS Route53 Documentation](https://docs.aws.amazon.com/route53/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [SSL Labs Best Practices](https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices)
