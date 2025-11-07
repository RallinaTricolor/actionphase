#!/bin/bash

# ActionPhase SSL Certificate Monitoring Script
# Monitors SSL certificate expiry and configuration
# Usage: ./scripts/check-ssl.sh [domain] [--slack-webhook URL]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${1:-${DOMAIN:-actionphase.com}}"
SLACK_WEBHOOK="${2:-${SLACK_WEBHOOK_URL}}"
LOG_FILE="/opt/actionphase/logs/ssl-monitor.log"

# Warning thresholds (days)
CRITICAL_DAYS=7
WARNING_DAYS=30

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to send alert
send_alert() {
    local message="$1"
    local level="${2:-warning}"

    # Log locally
    log_message "[$level] $message"

    # Send to Slack if webhook is configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        local emoji=":warning:"
        [ "$level" = "critical" ] && emoji=":rotating_light:"
        [ "$level" = "info" ] && emoji=":information_source:"
        [ "$level" = "success" ] && emoji=":white_check_mark:"

        curl -X POST "$SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"$emoji *SSL Certificate Alert* ($level)\n$message\"}" \
            2>/dev/null || true
    fi
}

# Function to check certificate
check_certificate() {
    local host="$1"
    local port="${2:-443}"

    echo -e "${BLUE}Checking SSL certificate for $host:$port...${NC}"

    # Get certificate details
    CERT_OUTPUT=$(echo | openssl s_client -servername "$host" -connect "$host:$port" 2>/dev/null)

    if [ -z "$CERT_OUTPUT" ]; then
        echo -e "${RED}❌ Could not connect to $host:$port${NC}"
        return 1
    fi

    # Extract certificate
    CERT=$(echo "$CERT_OUTPUT" | openssl x509 2>/dev/null)

    if [ -z "$CERT" ]; then
        echo -e "${RED}❌ No certificate found${NC}"
        return 1
    fi

    # Get certificate details
    SUBJECT=$(echo "$CERT" | openssl x509 -noout -subject | sed 's/subject=//')
    ISSUER=$(echo "$CERT" | openssl x509 -noout -issuer | sed 's/issuer=//')
    NOT_BEFORE=$(echo "$CERT" | openssl x509 -noout -startdate | sed 's/notBefore=//')
    NOT_AFTER=$(echo "$CERT" | openssl x509 -noout -enddate | sed 's/notAfter=//')
    FINGERPRINT=$(echo "$CERT" | openssl x509 -noout -fingerprint -sha256 | sed 's/.*=//')

    # Calculate days until expiry
    EXPIRY_EPOCH=$(date -d "$NOT_AFTER" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$NOT_AFTER" +%s)
    CURRENT_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))

    # Display certificate info
    echo "  Subject: $SUBJECT"
    echo "  Issuer: $ISSUER"
    echo "  Valid from: $NOT_BEFORE"
    echo "  Valid until: $NOT_AFTER"
    echo "  Days remaining: $DAYS_LEFT"
    echo "  SHA256 Fingerprint: $FINGERPRINT"

    # Check expiry status
    if [ "$DAYS_LEFT" -lt 0 ]; then
        echo -e "  ${RED}❌ Certificate has expired!${NC}"
        send_alert "SSL certificate for $host has EXPIRED!" "critical"
        return 2
    elif [ "$DAYS_LEFT" -lt "$CRITICAL_DAYS" ]; then
        echo -e "  ${RED}⚠️  Certificate expires in $DAYS_LEFT days!${NC}"
        send_alert "SSL certificate for $host expires in $DAYS_LEFT days!" "critical"
        return 3
    elif [ "$DAYS_LEFT" -lt "$WARNING_DAYS" ]; then
        echo -e "  ${YELLOW}⚠️  Certificate expires in $DAYS_LEFT days${NC}"
        send_alert "SSL certificate for $host expires in $DAYS_LEFT days" "warning"
        return 4
    else
        echo -e "  ${GREEN}✓ Certificate is valid for $DAYS_LEFT more days${NC}"
    fi

    # Check certificate chain
    echo ""
    echo "  Checking certificate chain..."
    CHAIN_VALID=$(echo "$CERT_OUTPUT" | openssl verify 2>&1)
    if echo "$CHAIN_VALID" | grep -q "OK"; then
        echo -e "  ${GREEN}✓ Certificate chain is valid${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Certificate chain validation warning${NC}"
        echo "  $CHAIN_VALID"
    fi

    # Check for common issues
    echo ""
    echo "  Checking for common issues..."

    # Check if certificate matches domain
    SAN=$(echo "$CERT" | openssl x509 -noout -text | grep -A1 "Subject Alternative Name" | tail -1 | sed 's/DNS://g' | tr ',' '\n' | sed 's/^ *//')
    if echo "$SAN" | grep -q "$host"; then
        echo -e "  ${GREEN}✓ Certificate matches domain${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Certificate may not match domain${NC}"
        echo "  SANs: $(echo "$SAN" | tr '\n' ' ')"
    fi

    # Check if Let's Encrypt
    if echo "$ISSUER" | grep -qi "let's encrypt"; then
        echo -e "  ${GREEN}✓ Using Let's Encrypt certificate${NC}"

        # Check auto-renewal
        if [ -f "/etc/letsencrypt/renewal/${host}.conf" ]; then
            echo -e "  ${GREEN}✓ Auto-renewal is configured${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Auto-renewal configuration not found${NC}"
        fi
    fi

    return 0
}

# Function to check TLS configuration
check_tls_config() {
    local host="$1"
    local port="${2:-443}"

    echo ""
    echo -e "${BLUE}Checking TLS configuration...${NC}"

    # Check supported protocols
    echo "  Testing TLS protocols:"
    for protocol in tls1 tls1_1 tls1_2 tls1_3; do
        if echo | openssl s_client -servername "$host" -connect "$host:$port" -"$protocol" 2>/dev/null | grep -q "CONNECTED"; then
            case $protocol in
                tls1|tls1_1)
                    echo -e "    ${YELLOW}⚠️  $protocol: Supported (should be disabled)${NC}"
                    ;;
                tls1_2)
                    echo -e "    ${GREEN}✓ $protocol: Supported${NC}"
                    ;;
                tls1_3)
                    echo -e "    ${GREEN}✓ $protocol: Supported${NC}"
                    ;;
            esac
        else
            case $protocol in
                tls1|tls1_1)
                    echo -e "    ${GREEN}✓ $protocol: Disabled (good)${NC}"
                    ;;
                tls1_2|tls1_3)
                    echo -e "    ${YELLOW}- $protocol: Not supported${NC}"
                    ;;
            esac
        fi
    done

    # Check cipher strength
    echo ""
    echo "  Checking cipher strength:"
    CIPHERS=$(echo | openssl s_client -servername "$host" -connect "$host:$port" 2>/dev/null | grep "Cipher" | head -1)
    echo "  Current cipher: $CIPHERS"

    # Check for weak ciphers
    WEAK_CIPHERS=$(echo | openssl s_client -servername "$host" -connect "$host:$port" -cipher "NULL,EXPORT,LOW,3DES,MD5,RC4" 2>/dev/null)
    if echo "$WEAK_CIPHERS" | grep -q "CONNECTED"; then
        echo -e "  ${RED}❌ Weak ciphers are enabled!${NC}"
        send_alert "Weak SSL ciphers detected on $host!" "warning"
    else
        echo -e "  ${GREEN}✓ No weak ciphers detected${NC}"
    fi
}

# Function to check OCSP stapling
check_ocsp() {
    local host="$1"
    local port="${2:-443}"

    echo ""
    echo -e "${BLUE}Checking OCSP stapling...${NC}"

    OCSP_RESPONSE=$(echo | openssl s_client -servername "$host" -connect "$host:$port" -status 2>/dev/null | grep -A 20 "OCSP Response Status")

    if [ -n "$OCSP_RESPONSE" ]; then
        if echo "$OCSP_RESPONSE" | grep -q "successful"; then
            echo -e "  ${GREEN}✓ OCSP stapling is enabled${NC}"
        else
            echo -e "  ${YELLOW}⚠️  OCSP stapling may not be working properly${NC}"
        fi
    else
        echo -e "  ${YELLOW}- OCSP stapling not detected${NC}"
    fi
}

# Function to check HTTP security headers
check_security_headers() {
    local host="$1"

    echo ""
    echo -e "${BLUE}Checking HTTP security headers...${NC}"

    HEADERS=$(curl -sI "https://$host" 2>/dev/null)

    # Check for important security headers
    SECURITY_HEADERS=(
        "Strict-Transport-Security:HSTS"
        "X-Frame-Options:Clickjacking protection"
        "X-Content-Type-Options:MIME sniffing protection"
        "X-XSS-Protection:XSS protection"
        "Content-Security-Policy:Content security policy"
    )

    for header_config in "${SECURITY_HEADERS[@]}"; do
        IFS=':' read -r HEADER DESC <<< "$header_config"
        if echo "$HEADERS" | grep -qi "$HEADER"; then
            VALUE=$(echo "$HEADERS" | grep -i "$HEADER" | cut -d: -f2- | xargs)
            echo -e "  ${GREEN}✓ $DESC: $VALUE${NC}"
        else
            echo -e "  ${YELLOW}- $DESC: Not set${NC}"
        fi
    done
}

# Main execution
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   ActionPhase SSL Certificate Monitor${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Track overall status
STATUS="healthy"
ISSUES=()

# Check main domain
if check_certificate "$DOMAIN"; then
    STATUS_CODE=$?
    case $STATUS_CODE in
        0) ;;
        2|3) STATUS="critical"; ISSUES+=("Certificate expired or expiring soon") ;;
        4) STATUS="warning"; ISSUES+=("Certificate expiring within $WARNING_DAYS days") ;;
        *) STATUS="error"; ISSUES+=("Certificate check failed") ;;
    esac
else
    STATUS="error"
    ISSUES+=("Could not check certificate for $DOMAIN")
fi

# Check www subdomain
if [ "$DOMAIN" != "localhost" ]; then
    echo ""
    if check_certificate "www.$DOMAIN"; then
        echo -e "${GREEN}✓ www subdomain certificate is valid${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not check www subdomain${NC}"
    fi
fi

# Check TLS configuration
check_tls_config "$DOMAIN"

# Check OCSP
check_ocsp "$DOMAIN"

# Check security headers
check_security_headers "$DOMAIN"

# Check certificate files on disk (if running locally)
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo ""
    echo -e "${BLUE}Checking local certificate files...${NC}"

    for file in fullchain.pem privkey.pem cert.pem chain.pem; do
        FILE_PATH="/etc/letsencrypt/live/$DOMAIN/$file"
        if [ -f "$FILE_PATH" ]; then
            # Check file permissions
            PERMS=$(stat -c %a "$FILE_PATH" 2>/dev/null || stat -f %A "$FILE_PATH")
            OWNER=$(stat -c %U "$FILE_PATH" 2>/dev/null || stat -f %Su "$FILE_PATH")

            echo "  $file: exists (perms: $PERMS, owner: $OWNER)"

            # Check if readable
            if [ ! -r "$FILE_PATH" ]; then
                echo -e "    ${YELLOW}⚠️  File is not readable${NC}"
                ISSUES+=("Certificate file $file is not readable")
            fi
        else
            echo -e "  ${YELLOW}$file: missing${NC}"
            ISSUES+=("Certificate file $file is missing")
        fi
    done

    # Check renewal configuration
    RENEWAL_CONF="/etc/letsencrypt/renewal/${DOMAIN}.conf"
    if [ -f "$RENEWAL_CONF" ]; then
        echo -e "  ${GREEN}✓ Renewal configuration exists${NC}"

        # Check next renewal attempt
        NEXT_EXPIRY=$(grep -E "^expiry_date" "$RENEWAL_CONF" | cut -d= -f2 | xargs)
        if [ -n "$NEXT_EXPIRY" ]; then
            echo "  Next renewal: $NEXT_EXPIRY"
        fi
    else
        echo -e "  ${YELLOW}⚠️  Renewal configuration not found${NC}"
    fi
fi

# Check if Certbot is installed and working
if command -v certbot &> /dev/null; then
    echo ""
    echo -e "${BLUE}Checking Certbot installation...${NC}"

    CERTBOT_VERSION=$(certbot --version 2>&1 | head -1)
    echo "  Version: $CERTBOT_VERSION"

    # Check for certificates managed by Certbot
    if certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
        echo -e "  ${GREEN}✓ Certificate is managed by Certbot${NC}"

        # Try a dry run renewal
        echo "  Testing renewal (dry run)..."
        if certbot renew --dry-run --cert-name "$DOMAIN" 2>/dev/null; then
            echo -e "  ${GREEN}✓ Renewal test passed${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Renewal test failed${NC}"
            ISSUES+=("Certificate renewal test failed")
        fi
    fi
elif docker exec actionphase-certbot certbot --version &>/dev/null 2>&1; then
    echo ""
    echo -e "${BLUE}Checking Certbot in Docker...${NC}"

    CERTBOT_VERSION=$(docker exec actionphase-certbot certbot --version 2>&1 | head -1)
    echo "  Version: $CERTBOT_VERSION"

    # Check certificates in container
    if docker exec actionphase-certbot certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
        echo -e "  ${GREEN}✓ Certificate is managed by Certbot${NC}"
    fi
fi

# Summary
echo ""
echo -e "${BLUE}========================================${NC}"
if [ "$STATUS" = "healthy" ]; then
    echo -e "${GREEN}✓ SSL certificate is healthy${NC}"
    log_message "SSL check completed: Certificate healthy"
elif [ "$STATUS" = "warning" ]; then
    echo -e "${YELLOW}⚠️  SSL certificate warnings:${NC}"
    for issue in "${ISSUES[@]}"; do
        echo "  - $issue"
    done
    log_message "SSL check completed with warnings"
elif [ "$STATUS" = "critical" ]; then
    echo -e "${RED}❌ Critical SSL certificate issues:${NC}"
    for issue in "${ISSUES[@]}"; do
        echo "  - $issue"
    done
    log_message "SSL check completed with critical issues"
    exit 2
else
    echo -e "${RED}❌ SSL certificate check failed:${NC}"
    for issue in "${ISSUES[@]}"; do
        echo "  - $issue"
    done
    log_message "SSL check failed"
    exit 1
fi
echo -e "${BLUE}========================================${NC}"

# Provide renewal command if needed
if [ "$STATUS" != "healthy" ] && [ "$DAYS_LEFT" -lt 30 ]; then
    echo ""
    echo -e "${BLUE}To renew the certificate:${NC}"
    echo "  certbot renew --cert-name $DOMAIN"
    echo "  docker-compose restart nginx"
fi

exit 0
