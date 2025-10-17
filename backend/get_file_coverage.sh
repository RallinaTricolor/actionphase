#!/bin/bash

echo "=== Service Files Coverage ==="
echo ""

for file in characters conversations game_applications games messages phases sessions users; do
    coverage=$(go tool cover -func=coverage.out | grep "pkg/db/services/${file}.go:" | awk '{cov+=$NF; n++} END {if(n>0) printf "%.1f%%", cov/n; else print "N/A"}' | sed 's/%//g')
    printf "%-25s %s%%\n" "${file}.go" "$coverage"
done

echo ""
echo "Overall:"
go tool cover -func=coverage.out | tail -1
