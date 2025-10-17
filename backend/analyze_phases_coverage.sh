#!/bin/bash
echo "=== phases.go Coverage Analysis ==="
echo ""

# Get total coverage for phases.go
total=$(go tool cover -func=coverage.out | grep 'phases.go' | grep -v 'phases_test.go' | tail -1 | awk '{print $NF}')
echo "Overall phases.go coverage: $total"
echo ""

# Count functions at different coverage levels
echo "Coverage Distribution:"
go tool cover -func=coverage.out | grep 'phases.go:' | awk '{print $NF}' | sort -n | uniq -c | sort -rn

echo ""
echo "Functions still at 0% coverage:"
go tool cover -func=coverage.out | grep 'phases.go:' | grep '0.0%' | wc -l
