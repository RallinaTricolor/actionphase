# Test Coverage Reference

**Single Source of Truth for Test Coverage Metrics**

⚠️ **IMPORTANT**: This is the authoritative source for test coverage information. All other documentation should reference this file rather than duplicating metrics.

**Last Updated**: October 27, 2025
**Last Verified**: October 27, 2025

## Current Test Metrics

### Overall Summary
- **Total Tests**: 1,489 passing tests (100% pass rate)
- **Backend**: 467 tests across 45 test files (75.0% line coverage)
- **Frontend**: 1,022 tests across 75 test files (~60% estimated coverage)
- **E2E Tests**: Comprehensive suite with parallel execution support

### How to Update These Metrics

```bash
# Backend test count
find backend -name "*_test.go" | wc -l  # Files
go test -v ./... 2>&1 | grep -c "^--- PASS:"  # Test functions

# Frontend test count
find frontend/src -name "*.test.tsx" -o -name "*.test.ts" | wc -l  # Files
npm test -- --reporter=json | jq '.numPassedTests'  # Test count

# Coverage
just test-coverage  # Backend coverage
npm run test:coverage  # Frontend coverage
```

## Files That Reference This Document

The following files should link here instead of duplicating metrics:
- `.claude/context/TESTING.md` → Links here for current metrics
- `docs/testing/COVERAGE_STATUS.md` → Detailed breakdown and history
- `.claude/reference/TESTING_GUIDE.md` → Implementation details
- `docs/adrs/007-testing-strategy.md` → Strategic decisions

## Quick Reference Links

- **Detailed Coverage Report**: [COVERAGE_STATUS.md](./COVERAGE_STATUS.md)
- **Testing Context**: [.claude/context/TESTING.md](../../.claude/context/TESTING.md)
- **Testing Strategy**: [ADR-007](../adrs/007-testing-strategy.md)

---

*When updating metrics, also update the "Last Updated" date and verify the counts are accurate.*
