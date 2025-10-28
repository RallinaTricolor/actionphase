#!/bin/bash

# Documentation Health Check Script
# Automatically checks documentation for common issues
# Usage: ./scripts/doc-check.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📋 ActionPhase Documentation Health Check"
echo "========================================="
echo ""

# Track issues
ISSUES=0
WARNINGS=0

# Function to check if file exists
check_file() {
    if [ ! -f "$1" ]; then
        echo -e "${RED}❌ Missing: $1${NC}"
        ((ISSUES++))
        return 1
    fi
    return 0
}

# Function to check for broken file references
check_references() {
    local file=$1
    echo "Checking references in $file..."

    # Extract markdown links
    grep -oE '\[([^]]+)\]\(([^)]+)\)' "$file" 2>/dev/null | while read -r line; do
        # Extract the path from the link
        path=$(echo "$line" | sed -E 's/.*\(([^)]+)\).*/\1/')

        # Skip URLs and anchors
        if [[ "$path" =~ ^https?:// ]] || [[ "$path" =~ ^# ]]; then
            continue
        fi

        # Convert relative path to absolute
        dir=$(dirname "$file")
        if [[ "$path" =~ ^\/ ]]; then
            # Absolute path from project root
            full_path="${path:1}"
        else
            # Relative path
            full_path="$dir/$path"
        fi

        # Remove anchor if present
        full_path=${full_path%%#*}

        # Check if file exists
        if [ ! -f "$full_path" ]; then
            echo -e "${RED}  ❌ Broken link in $file: $path${NC}"
            ((ISSUES++))
        fi
    done
}

# 1. Check critical documentation files exist
echo "1. Checking critical files..."
echo "------------------------------"

CRITICAL_FILES=(
    "README.md"
    "CLAUDE.md"
    ".claude/README.md"
    ".claude/context/TESTING.md"
    ".claude/context/ARCHITECTURE.md"
    ".claude/context/STATE_MANAGEMENT.md"
    ".claude/context/TEST_DATA.md"
    "docs/README.md"
    "justfile"
)

for file in "${CRITICAL_FILES[@]}"; do
    if check_file "$file"; then
        echo -e "${GREEN}✓${NC} $file"
    fi
done
echo ""

# 2. Update test counts automatically
echo "2. Updating test counts..."
echo "--------------------------"

# Count backend tests
BACKEND_TESTS=$(find backend -name "*_test.go" -type f | wc -l | tr -d ' ')
BACKEND_TEST_FUNCS=$(grep -r "^func Test" backend --include="*_test.go" 2>/dev/null | wc -l | tr -d ' ')

# Count frontend tests
FRONTEND_TESTS=$(find frontend/src -name "*.test.tsx" -o -name "*.test.ts" -type f | wc -l | tr -d ' ')
FRONTEND_TEST_SUITES=$(grep -r "describe\(" frontend/src --include="*.test.ts*" 2>/dev/null | wc -l | tr -d ' ')

# Count E2E tests
E2E_TESTS=$(find frontend/e2e -name "*.spec.ts" -type f | wc -l | tr -d ' ')
E2E_TEST_CASES=$(grep -r "test\(" frontend/e2e --include="*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')

echo "Backend: $BACKEND_TEST_FUNCS tests across $BACKEND_TESTS files"
echo "Frontend: $FRONTEND_TEST_SUITES test suites across $FRONTEND_TESTS files"
echo "E2E: $E2E_TEST_CASES test cases across $E2E_TESTS files"
echo ""

# Check if counts match documentation
if [ -f ".claude/context/TESTING.md" ]; then
    DOCUMENTED_BACKEND=$(grep -oE "Backend:.*[0-9]+ tests" ".claude/context/TESTING.md" | grep -oE "[0-9]+" | head -1)
    if [ "$DOCUMENTED_BACKEND" != "$BACKEND_TEST_FUNCS" ]; then
        echo -e "${YELLOW}⚠️  Backend test count mismatch: documented=$DOCUMENTED_BACKEND, actual=$BACKEND_TEST_FUNCS${NC}"
        ((WARNINGS++))
    fi
fi

# 3. Check for outdated timestamps
echo "3. Checking documentation dates..."
echo "----------------------------------"

# Find files with "Last Updated" dates
for file in $(find . -name "*.md" -type f); do
    if grep -q "Last Updated:" "$file" 2>/dev/null; then
        last_updated=$(grep "Last Updated:" "$file" | head -1)
        # Check if file was modified after the last updated date
        file_mod_time=$(stat -f "%m" "$file" 2>/dev/null || stat -c "%Y" "$file" 2>/dev/null)
        current_time=$(date +%s)
        days_old=$(( (current_time - file_mod_time) / 86400 ))

        if [ $days_old -gt 30 ]; then
            echo -e "${YELLOW}⚠️  $file may be outdated (modified $days_old days ago)${NC}"
            ((WARNINGS++))
        fi
    fi
done
echo ""

# 4. Check for broken internal links
echo "4. Checking for broken links..."
echo "-------------------------------"

for file in $(find . -name "*.md" -type f | grep -v node_modules | grep -v ".git"); do
    check_references "$file"
done
echo ""

# 5. Check for missing ADRs
echo "5. Checking ADR sequence..."
echo "--------------------------"

if [ -d "docs/adrs" ]; then
    expected=1
    while [ -f "docs/adrs/$(printf "%03d" $expected)"*.md ]; do
        echo -e "${GREEN}✓${NC} ADR-$(printf "%03d" $expected) found"
        ((expected++))
    done

    # Check if there are gaps
    for file in docs/adrs/[0-9]*.md; do
        num=$(basename "$file" | grep -oE "^[0-9]+" | sed 's/^0*//')
        if [ "$num" -gt "$expected" ]; then
            echo -e "${YELLOW}⚠️  Gap in ADR sequence: missing ADR-$(printf "%03d" $expected)${NC}"
            ((WARNINGS++))
        fi
    done
fi
echo ""

# 6. Check configuration consistency
echo "6. Checking configuration..."
echo "----------------------------"

# Check ports
BACKEND_PORT_ENV=$(grep "PORT=" .env 2>/dev/null | cut -d= -f2 || echo "3000")
BACKEND_PORT_DOCS=$(grep -r "localhost:3000" docs .claude --include="*.md" | wc -l | tr -d ' ')

if [ "$BACKEND_PORT_DOCS" -gt 0 ] && [ "$BACKEND_PORT_ENV" != "3000" ]; then
    echo -e "${YELLOW}⚠️  Port mismatch: .env has PORT=$BACKEND_PORT_ENV but docs reference port 3000${NC}"
    ((WARNINGS++))
fi

# Check database name
DB_NAME=$(grep "DATABASE_URL=" .env 2>/dev/null | grep -oE "://[^/]+/([^?]+)" | cut -d/ -f4 || echo "actionphase")
if [ "$DB_NAME" != "actionphase" ]; then
    echo -e "${YELLOW}⚠️  Non-standard database name: $DB_NAME (expected: actionphase)${NC}"
    ((WARNINGS++))
fi
echo ""

# Summary
echo "========================================="
echo "📊 Documentation Health Check Summary"
echo "========================================="

if [ $ISSUES -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Documentation is healthy.${NC}"
    exit 0
else
    if [ $ISSUES -gt 0 ]; then
        echo -e "${RED}❌ Found $ISSUES critical issues${NC}"
    fi
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found $WARNINGS warnings${NC}"
    fi

    echo ""
    echo "Recommendations:"
    if [ $ISSUES -gt 0 ]; then
        echo "  • Fix broken file references"
        echo "  • Create missing critical files"
    fi
    if [ $WARNINGS -gt 0 ]; then
        echo "  • Update test counts in documentation"
        echo "  • Review files not updated in 30+ days"
        echo "  • Check configuration consistency"
    fi

    exit 1
fi
