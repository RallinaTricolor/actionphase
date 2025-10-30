#!/bin/bash
set -e

# ActionPhase Build Check Hook
# Checks both frontend (TypeScript/npm) and backend (Go) for compilation errors
# Runs on Stop event to catch issues before ending the session

# Read hook information from stdin
hook_info=$(cat)

# Extract session ID for cache management
session_id=$(echo "$hook_info" | jq -r '.session_id // "default"')

# Cache directory for this session
cache_dir="$CLAUDE_PROJECT_DIR/.claude/tsc-cache/${session_id}"

# Check if we have any edited files
if [[ ! -f "$cache_dir/affected-repos.txt" ]]; then
    echo "✅ No files edited in this session" >&2
    exit 0
fi

# Track if we found any errors
has_errors=false
error_messages=""

# Function to add error message
add_error() {
    local component="$1"
    local message="$2"
    has_errors=true
    error_messages="${error_messages}❌ ${component}: ${message}\n"
}

# Check frontend if frontend files were edited
if grep -q "^frontend$" "$cache_dir/affected-repos.txt" 2>/dev/null; then
    echo "🔍 Checking frontend build..." >&2

    # First check TypeScript compilation
    if [[ -f "$CLAUDE_PROJECT_DIR/frontend/tsconfig.app.json" ]]; then
        echo "  → Running TypeScript check..." >&2
        cd "$CLAUDE_PROJECT_DIR/frontend"

        # Run TypeScript check
        if ! npx tsc --project tsconfig.app.json --noEmit 2>&1 | tee /tmp/tsc-output.txt; then
            error_count=$(grep -E "error TS[0-9]+" /tmp/tsc-output.txt | wc -l | tr -d ' ')
            add_error "Frontend TypeScript" "${error_count} compilation error(s) found"
        else
            echo "  ✓ TypeScript check passed" >&2
        fi
    fi

    # Then check npm build
    echo "  → Running npm build..." >&2
    cd "$CLAUDE_PROJECT_DIR/frontend"

    # Run npm build
    if ! npm run build 2>&1 | tee /tmp/npm-build-output.txt; then
        # Extract meaningful error from npm output
        if grep -q "error TS" /tmp/npm-build-output.txt; then
            error_count=$(grep -c "error TS" /tmp/npm-build-output.txt || echo "0")
            add_error "Frontend Build" "${error_count} TypeScript error(s) in build"
        else
            add_error "Frontend Build" "Build failed (check npm output)"
        fi
    else
        echo "  ✓ npm build succeeded" >&2
    fi
fi

# Check backend if backend files were edited
if grep -q "^backend$" "$cache_dir/affected-repos.txt" 2>/dev/null; then
    echo "🔍 Checking backend build..." >&2

    # Check Go compilation
    echo "  → Running Go build..." >&2
    cd "$CLAUDE_PROJECT_DIR"

    # Try to build the main server binary
    if [[ -f "backend/cmd/server/main.go" ]]; then
        if ! go build -o /tmp/actionphase-server ./backend/cmd/server 2>&1 | tee /tmp/go-build-output.txt; then
            # Count Go compilation errors
            error_count=$(grep -c "^.*\.go:[0-9]" /tmp/go-build-output.txt || echo "multiple")
            add_error "Backend Go" "${error_count} compilation error(s)"
        else
            echo "  ✓ Go build succeeded" >&2
            # Clean up temporary binary
            rm -f /tmp/actionphase-server
        fi
    fi

    # Also run go vet for additional checks
    echo "  → Running go vet..." >&2
    if ! go vet ./backend/... 2>&1 | tee /tmp/go-vet-output.txt; then
        vet_issues=$(wc -l < /tmp/go-vet-output.txt | tr -d ' ')
        if [[ $vet_issues -gt 0 ]]; then
            add_error "Backend Go Vet" "${vet_issues} issue(s) found"
        fi
    else
        echo "  ✓ go vet passed" >&2
    fi
fi

# Check if root files were edited (like justfile, go.mod, etc.)
if grep -q "^root$" "$cache_dir/affected-repos.txt" 2>/dev/null; then
    # If go.mod was changed, check module validity
    if [[ -f "$CLAUDE_PROJECT_DIR/go.mod" ]]; then
        echo "🔍 Checking Go modules..." >&2
        cd "$CLAUDE_PROJECT_DIR"

        if ! go mod verify 2>&1 | tee /tmp/go-mod-output.txt; then
            add_error "Go Modules" "Module verification failed"
        else
            echo "  ✓ Go modules valid" >&2
        fi
    fi
fi

# Report results
if [[ "$has_errors" == "true" ]]; then
    echo "" >&2
    echo "⚠️  BUILD ERRORS DETECTED" >&2
    echo "=========================" >&2
    echo -e "$error_messages" >&2
    echo "" >&2
    echo "💡 Suggestions:" >&2

    if echo "$error_messages" | grep -q "Frontend"; then
        echo "  • Fix TypeScript errors before committing" >&2
        echo "  • Run 'cd frontend && npm run build' to see full error details" >&2
    fi

    if echo "$error_messages" | grep -q "Backend"; then
        echo "  • Fix Go compilation errors before committing" >&2
        echo "  • Run 'just test' to see full error details" >&2
    fi

    echo "" >&2
    echo "🔧 To fix these issues, you may want to:" >&2
    echo "  1. Review the errors above" >&2
    echo "  2. Run the suggested commands locally" >&2
    echo "  3. Fix the issues and re-run the build" >&2

    # Exit with error code to indicate issues found (but don't block)
    exit 2
else
    echo "" >&2
    echo "✅ All build checks passed!" >&2

    # List what was checked
    echo "Checked components:" >&2
    if grep -q "^frontend$" "$cache_dir/affected-repos.txt" 2>/dev/null; then
        echo "  • Frontend (TypeScript + npm build)" >&2
    fi
    if grep -q "^backend$" "$cache_dir/affected-repos.txt" 2>/dev/null; then
        echo "  • Backend (Go build + vet)" >&2
    fi
    if grep -q "^root$" "$cache_dir/affected-repos.txt" 2>/dev/null; then
        echo "  • Go modules" >&2
    fi

    exit 0
fi
