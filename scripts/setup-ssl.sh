#!/bin/bash

# ActionPhase SSL Certificate Setup Script
# Sets up Let's Encrypt SSL certificates using Certbot
# Usage: ./scripts/setup-ssl.sh your-domain.com [email]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Domain name required${NC}"
    echo "Usage: $0 your-domain.com [admin-email]"
    exit 1
fi

DOMAIN="$1"
EMAIL="${2:-admin@$DOMAIN}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ActionPhase SSL Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Domain:${NC} $DOMAIN"
echo -e "${BLUE}Email:${NC} $EMAIL"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
    echo -e "${YELLOW}This script needs sudo privileges${NC}"
    exec sudo "$0" "$@"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

# Check if nginx is configured in docker-compose
if ! grep -q "nginx:" docker-compose*.yml 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Warning: nginx service not found in docker-compose${NC}"
    echo "Make sure you're using docker-compose.prod.yml"
fi

# Create required directories
echo -e "${BLUE}Creating SSL directories...${NC}"
mkdir -p ./ssl
mkdir -p ./nginx/conf.d

# Check if certificate already exists
if [ -d "/etc/letsencrypt/live/$DOMAIN" ] || docker exec actionphase-certbot test -d "/etc/letsencrypt/live/$DOMAIN" 2>/dev/null; then
    echo -e "${YELLOW}Certificate already exists for $DOMAIN${NC}"
    read -p "Do you want to renew it? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "SSL setup cancelled"
        exit 0
    fi
    RENEW_CERT=true
else
    RENEW_CERT=false
fi

# Generate DH parameters if not exists
if [ ! -f ./ssl/dhparam.pem ]; then
    echo -e "${BLUE}Generating DH parameters (this may take a few minutes)...${NC}"
    openssl dhparam -out ./ssl/dhparam.pem 2048
    echo -e "${GREEN}✓ DH parameters generated${NC}"
else
    echo -e "${GREEN}✓ DH parameters already exist${NC}"
fi

# Create temporary nginx configuration for Let's Encrypt challenge
echo -e "${BLUE}Creating temporary nginx configuration...${NC}"
cat > ./nginx/conf.d/letsencrypt.conf << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF

# Start nginx if not running
echo -e "${BLUE}Starting nginx for certificate validation...${NC}"
if docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps | grep -q nginx; then
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
else
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx
fi

sleep 5

# Get SSL certificate
echo -e "${BLUE}Obtaining SSL certificate from Let's Encrypt...${NC}"

if [ "$RENEW_CERT" = true ]; then
    # Force renewal of existing certificate
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --entrypoint "" certbot \
        certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        --non-interactive \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"
else
    # Get new certificate
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --entrypoint "" certbot \
        certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        --non-interactive \
        -d "$DOMAIN" \
        -d "www.$DOMAIN"
fi

# Check if certificate was created successfully
if docker exec actionphase-certbot test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" 2>/dev/null || [ -f "./letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo -e "${GREEN}✓ SSL certificate obtained successfully!${NC}"
else
    echo -e "${RED}❌ Failed to obtain SSL certificate${NC}"
    echo "Please check:"
    echo "  1. Domain DNS is pointing to this server"
    echo "  2. Ports 80 and 443 are open"
    echo "  3. Domain is accessible from internet"
    exit 1
fi

# Update nginx configuration for SSL
echo -e "${BLUE}Updating nginx configuration for SSL...${NC}"

# Update environment variable for domain
if grep -q "DOMAIN=" .env; then
    sed -i.bak "s|DOMAIN=.*|DOMAIN=$DOMAIN|" .env
else
    echo "DOMAIN=$DOMAIN" >> .env
fi

# Create production nginx config with SSL
cat > ./nginx/conf.d/ssl.conf << EOF
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_dhparam /etc/nginx/ssl/dhparam.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers off;

    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Restart nginx with new configuration
echo -e "${BLUE}Restarting nginx with SSL configuration...${NC}"
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx

sleep 5

# Test HTTPS
echo -e "${BLUE}Testing HTTPS connection...${NC}"
if curl -k -f "https://$DOMAIN" > /dev/null 2>&1 || curl -k -f "https://localhost" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ HTTPS is working!${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS test failed, but certificate is installed${NC}"
    echo "This might be normal if the domain DNS is not yet configured"
fi

# Set up auto-renewal cron job
echo -e "${BLUE}Setting up automatic renewal...${NC}"

# Create renewal script
cat > ./scripts/renew-ssl.sh << 'EOF'
#!/bin/bash
# Automatic SSL certificate renewal script
# This runs twice daily via cron to check for expiring certificates

set -e

cd /opt/actionphase

# Try to renew certificates (only renews if within 30 days of expiry)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --entrypoint "" certbot \
    certbot renew \
    --webroot \
    --webroot-path /var/www/certbot \
    --quiet \
    --non-interactive

# Only restart nginx if renewal was successful
if [ $? -eq 0 ]; then
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
fi
EOF

chmod +x ./scripts/renew-ssl.sh

# Add cron job for renewal (runs twice daily as recommended by Let's Encrypt)
CRON_JOB="0 0,12 * * * /opt/actionphase/scripts/renew-ssl.sh >> /opt/actionphase/logs/ssl-renewal.log 2>&1"
(crontab -l 2>/dev/null | grep -v "renew-ssl.sh"; echo "$CRON_JOB") | crontab -

echo -e "${GREEN}✓ Automatic renewal configured${NC}"

# Final summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ SSL Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Certificate Details:${NC}"
echo "  Domain: $DOMAIN"
echo "  Email: $EMAIL"
echo "  Auto-renewal: Enabled (twice daily)"
echo ""
echo -e "${BLUE}Certificate Location:${NC}"
echo "  /etc/letsencrypt/live/$DOMAIN/"
echo ""
echo -e "${BLUE}Test your site:${NC}"
echo "  https://$DOMAIN"
echo "  https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
echo ""
echo -e "${BLUE}Certificate Information:${NC}"
docker exec actionphase-certbot certbot certificates 2>/dev/null || true
echo ""

exit 0
