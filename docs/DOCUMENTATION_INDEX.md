# Documentation Index & Cross-Reference

**Comprehensive index of all documentation with cross-references**

**Last Updated**: October 27, 2025
**Last Verified**: October 27, 2025

## 📚 Master Documentation Map

### Core References (Single Sources of Truth)
- **[Test Coverage Metrics](testing/TEST_COVERAGE_REFERENCE.md)** - Authoritative test metrics
- **[Configuration Settings](CONFIGURATION_REFERENCE.md)** - Ports, URLs, database config
- **[Documentation Maintenance](../DOCUMENTATION_MAINTENANCE.md)** - Update tracking and schedules

### Getting Started
- **[Developer Onboarding](getting-started/DEVELOPER_ONBOARDING.md)** - 30-minute setup guide
  - References: Configuration Settings, Test Coverage
- **[Project README](../README.md)** - Project overview
  - References: Developer Onboarding

### Architecture & Design
- **[System Architecture](architecture/SYSTEM_ARCHITECTURE.md)** - Complete system design
  - Referenced by: All feature docs, ADRs
- **[Component Interactions](architecture/COMPONENT_INTERACTIONS.md)** - Communication patterns
  - References: System Architecture
- **[Sequence Diagrams](architecture/SEQUENCE_DIAGRAMS.md)** - Visual flows
  - References: Component Interactions

### Architecture Decision Records (ADRs)
- **[ADR Index](adrs/README.md)** - List of all decisions
- **[ADR-001: Technology Stack](adrs/001-technology-stack-selection.md)**
- **[ADR-002: Database Design](adrs/002-database-design-approach.md)**
- **[ADR-003: Authentication](adrs/003-authentication-strategy.md)**
- **[ADR-004: API Design](adrs/004-api-design-principles.md)**
- **[ADR-005: State Management](adrs/005-frontend-state-management.md)**
  - Referenced by: `.claude/context/STATE_MANAGEMENT.md`
- **[ADR-006: Observability](adrs/006-observability-approach.md)**
- **[ADR-007: Testing Strategy](adrs/007-testing-strategy.md)**
  - Referenced by: All testing docs

### Testing Documentation
- **[Coverage Status](testing/COVERAGE_STATUS.md)** - Detailed coverage breakdown
  - References: Test Coverage Metrics
- **[E2E Quick Start](testing/E2E_QUICK_START.md)** - E2E testing guide
  - References: Test Data documentation
- **[Test Data](testing/TEST_DATA.md)** - Fixture documentation
  - Referenced by: `.claude/context/TEST_DATA.md`

## 🤖 AI Context (.claude/)

### Context Files (Read Before Tasks)
- **[TESTING.md](../.claude/context/TESTING.md)** - Testing patterns
  - References: Test Coverage Metrics, Coverage Status
- **[ARCHITECTURE.md](../.claude/context/ARCHITECTURE.md)** - Architecture patterns
  - References: System Architecture, ADRs
- **[STATE_MANAGEMENT.md](../.claude/context/STATE_MANAGEMENT.md)** - Frontend state
  - References: ADR-005, Feature docs
- **[FRONTEND_STYLING.md](../.claude/context/FRONTEND_STYLING.md)** - UI components & theming
- **[TEST_DATA.md](../.claude/context/TEST_DATA.md)** - Test fixtures
  - References: Test Data documentation

### Command Protocols
- **[debug-e2e-test.md](../.claude/commands/debug-e2e-test.md)** - E2E debugging protocol
- **[implement-features.md](../.claude/commands/implement-features.md)** - Feature implementation
- **[challenge-assumptions.md](../.claude/commands/challenge-assumptions.md)** - Requirements clarification

### Reference Guides
- **[BACKEND_ARCHITECTURE.md](../.claude/reference/BACKEND_ARCHITECTURE.md)**
  - References: System Architecture
- **[API_DOCUMENTATION.md](../.claude/reference/API_DOCUMENTATION.md)**
  - References: ADR-004
- **[TESTING_GUIDE.md](../.claude/reference/TESTING_GUIDE.md)**
  - References: ADR-007, Test Coverage
- **[LOGGING_STANDARDS.md](../.claude/reference/LOGGING_STANDARDS.md)**
  - References: ADR-006

## 📊 Document Relationships

### Documents That Reference Test Coverage
```
Test Coverage Metrics (source)
├── .claude/context/TESTING.md
├── docs/testing/COVERAGE_STATUS.md
├── .claude/reference/TESTING_GUIDE.md
└── docs/adrs/007-testing-strategy.md
```

### Documents That Reference Configuration
```
Configuration Settings (source)
├── docs/getting-started/DEVELOPER_ONBOARDING.md
├── frontend/vite.config.ts
├── .env.example
└── Docker compose files
```

### Documents That Reference Architecture
```
System Architecture (source)
├── .claude/context/ARCHITECTURE.md
├── .claude/reference/BACKEND_ARCHITECTURE.md
├── All feature documentation
└── Component documentation
```

## 🔍 Quick Find

### By Topic
- **Testing**: TESTING.md → Test Coverage → Coverage Status → E2E Guide
- **Setup**: Developer Onboarding → Configuration Reference
- **Architecture**: System Architecture → ADRs → Component Interactions
- **Frontend**: STATE_MANAGEMENT.md → FRONTEND_STYLING.md → ADR-005
- **Backend**: BACKEND_ARCHITECTURE.md → API_DOCUMENTATION.md → ADR-004

### By User Role
- **New Developer**: Start with Developer Onboarding
- **Backend Developer**: BACKEND_ARCHITECTURE.md, API docs, ADRs 1-4
- **Frontend Developer**: STATE_MANAGEMENT.md, FRONTEND_STYLING.md, ADR-005
- **Tester**: TESTING.md, Test Coverage, E2E Quick Start
- **DevOps**: Configuration Reference, ADR-006 (Observability)

## 📝 Documentation Standards

### Every Document Should Have
1. Title and purpose
2. "Last Updated" date
3. "Last Verified" date (for accuracy)
4. References section (what it links to)
5. Referenced By section (what links to it)

### Cross-Reference Format
```markdown
**References**: [Document Name](relative/path.md)
**Referenced By**: [Other Document](path.md)
```

## 🔄 Maintenance

- **Weekly**: Update test metrics in Test Coverage Reference
- **Monthly**: Verify all cross-references still valid
- **Quarterly**: Full index rebuild

---

*This index is the master navigation guide for all ActionPhase documentation.*
