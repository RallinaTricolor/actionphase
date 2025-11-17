# ActionPhase

[![CI](https://github.com/{YOUR_USERNAME}/actionphase/actions/workflows/ci.yml/badge.svg)](https://github.com/{YOUR_USERNAME}/actionphase/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/{YOUR_USERNAME}/actionphase/branch/master/graph/badge.svg)](https://codecov.io/gh/{YOUR_USERNAME}/actionphase)
[![Go Report Card](https://goreportcard.com/badge/github.com/{YOUR_USERNAME}/actionphase)](https://goreportcard.com/report/github.com/{YOUR_USERNAME}/actionphase)

> **Note**: Replace `{YOUR_USERNAME}` with your GitHub username in the badges above.

A modern turn-based gaming platform built with Go and React.

## Features

- 🎮 Turn-based game management
- 👥 Character creation and management
- 💬 Real-time messaging and discussions
- 📊 Game phase management
- 🔐 Secure JWT-based authentication
- 📱 Responsive design with dark mode
- 🎯 Action submission and results system

## Tech Stack

**Backend:**
- Go 1.24+ with Chi router
- PostgreSQL 17 with sqlc
- JWT authentication
- Clean Architecture patterns

**Frontend:**
- React 18+ with TypeScript
- Vite for build tooling
- TanStack Query (React Query)
- Tailwind CSS
- Vitest + Playwright for testing

## Quick Start

### Prerequisites

- Go 1.24+
- Node.js 20+
- PostgreSQL 17
- Docker & Docker Compose (for database)
- [just](https://github.com/casey/just) command runner

### Installation

```bash
# Clone the repository
git clone https://github.com/{YOUR_USERNAME}/actionphase.git
cd actionphase

# Complete setup (database, .env, dependencies)
just dev-setup

# Run migrations
just migrate

# Load test data (optional)
just load-demo
```

### Development

```bash
# Start backend (with database)
just dev

# In another terminal, start frontend
cd frontend && npm run dev

# Run tests
just test          # Backend tests
just test-frontend # Frontend tests
just e2e           # E2E tests

# Run linting
just lint          # Backend linting
just lint-frontend # Frontend linting
```

Visit:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Docs**: http://localhost:3000/api/v1/docs

### Test Accounts

After loading test data (`just load-demo`):

- **GM**: test_gm@example.com / testpassword123
- **Players**: test_player1@example.com through test_player5@example.com / testpassword123
- **Audience**: test_audience@example.com / testpassword123

## Documentation

- **[Developer Onboarding](docs/getting-started/DEVELOPER_ONBOARDING.md)** - 30-minute setup guide
- **[Architecture Overview](docs/architecture/SYSTEM_ARCHITECTURE.md)** - System design
- **[API Documentation](http://localhost:3000/api/v1/docs)** - OpenAPI/Swagger docs (when server running)
- **[Testing Guide](.claude/context/TESTING.md)** - Testing patterns and requirements
- **[ADRs](docs/adrs/)** - Architecture Decision Records

## Project Structure

```
actionphase/
├── backend/          # Go backend
│   ├── pkg/
│   │   ├── core/     # Domain models and interfaces
│   │   ├── db/       # Database queries and services
│   │   ├── http/     # API handlers and middleware
│   │   └── ...
│   └── main.go
├── frontend/         # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── pages/
│   └── e2e/         # Playwright E2E tests
├── docs/            # Documentation
└── .claude/         # AI development context
```

## Development Commands

See the [justfile](justfile) for all available commands:

```bash
just help              # Show all commands

# Database
just db setup          # Setup database
just migrate           # Run migrations
just load-demo         # Load demo data

# Development
just dev               # Start backend
just start frontend    # Start frontend
just start all         # Start both

# Testing
just test              # Backend tests
just test-frontend     # Frontend tests
just e2e               # E2E tests
just test-coverage     # Backend coverage report

# Linting
just lint              # Backend lint
just lint-frontend     # Frontend lint

# Build
just build             # Build backend
just build-all all     # Build backend + frontend
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`just test && just test-frontend`)
5. Ensure linting passes (`just lint && just lint-frontend`)
6. Commit your changes (follow [Conventional Commits](https://www.conventionalcommits.org/))
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Quality Standards

- **Tests Required**: All new features and bug fixes must include tests
- **Coverage**: PRs should maintain or improve code coverage
- **Linting**: All code must pass linting checks
- **Documentation**: Update docs for API or architectural changes

See [Contributing Guide](docs/CONTRIBUTING.md) for detailed guidelines.

## Testing

```bash
# Backend
just test              # All tests
just test-mocks        # Fast unit tests only
just test-integration  # Database integration tests
just test-coverage     # With coverage report

# Frontend
just test-frontend           # Run once
just test-fe watch          # Watch mode
just test-fe coverage       # With coverage

# E2E
just e2e                    # Headless
just e2e-test headed        # With browser visible
just e2e-test ui            # Interactive UI
```

## License

[MIT License](LICENSE)

## Acknowledgments

Built with Clean Architecture principles, TDD practices, and modern development workflows.

---

**Status**: Active Development

For questions or issues, please [open an issue](https://github.com/{YOUR_USERNAME}/actionphase/issues).
