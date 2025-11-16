# ActionPhase Documentation Site

This directory contains the ActionPhase documentation built with [VitePress](https://vitepress.dev/).

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run docs:dev

# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
```

## Using Justfile Commands

From the project root:

```bash
# Start documentation dev server
just docs-dev

# Build documentation
just docs-build

# Preview built docs
just docs-preview

# Install dependencies
just docs-install
```

## Directory Structure

```
docs-site/
├── .vitepress/
│   ├── config.mjs         # VitePress configuration
│   └── dist/              # Build output (generated)
├── user/                  # User-facing documentation
│   ├── getting-started/   # Account & first steps
│   ├── game-guide/        # Playing games
│   └── gm-guide/          # Running games
├── developer/             # Developer documentation
│   ├── getting-started/   # Developer onboarding
│   ├── architecture/      # System design & ADRs
│   ├── api/              # API reference
│   └── testing/          # Testing guides
├── package.json          # NPM configuration
└── README.md             # This file
```

## Content Organization

### User Documentation (`/user/`)

Documentation for players and Game Masters:

- **Getting Started**: Account creation, joining games, first character
- **Game Guide**: Game phases, common room, action submission
- **GM Guide**: Creating games, managing players, running phases
- **FAQ**: Common questions and troubleshooting

### Developer Documentation (`/developer/`)

Technical documentation for contributors:

- **Getting Started**: Developer onboarding (30-minute guide)
- **Architecture**: System overview, components, ADRs
- **API**: REST API reference (links to Swagger UI)
- **Testing**: Test pyramid, patterns, E2E guides

## Adding New Pages

1. Create a markdown file in the appropriate directory
2. Add navigation link in `.vitepress/config.mjs`
3. Build and test locally

Example:

```markdown
---
title: My New Page
---

# My New Page

Content goes here...
```

## Configuration

VitePress configuration is in `.vitepress/config.mjs`:

- **Base URL**: `/docs/` (served at https://action-phase.com/docs/)
- **Theme**: Default VitePress theme
- **Search**: Local search enabled
- **Dark Mode**: Automatically supported
- **Navigation**: Configured in `themeConfig.nav`
- **Sidebar**: Configured in `themeConfig.sidebar`

## Build Output

Production builds generate static HTML/CSS/JS to `.vitepress/dist/`:

- **Size**: ~500KB compressed
- **Build Time**: ~1.3 seconds
- **Output**: Optimized static site

## Deployment

### Option A: Embed in Go Binary (Recommended)

Documentation is embedded in the Go backend:

```go
//go:embed dist/*
var staticDocsFS embed.FS
```

Served at `/docs/*` by the backend.

### Option B: Nginx Static Serving

Alternatively, nginx can serve docs directly:

```nginx
location /docs/ {
    alias /app/docs-site/dist/;
    try_files $uri $uri/ /docs/index.html;
}
```

## Development Workflow

1. **Edit** markdown files in `user/` or `developer/`
2. **Test** with `npm run docs:dev` (hot reload)
3. **Build** with `npm run docs:build`
4. **Preview** with `npm run docs:preview`

## Features

- ✅ Local search (no external service required)
- ✅ Dark mode support
- ✅ Mobile responsive
- ✅ Code syntax highlighting
- ✅ Markdown extensions (tables, alerts, etc.)
- ✅ Fast build times (< 2 seconds)
- ✅ Hot module replacement in dev mode

## Tech Stack

- **VitePress**: 1.6.4
- **Node.js**: 24.11.1 (from .tool-versions)
- **Build Tool**: Vite
- **Markdown**: GitHub Flavored Markdown + extensions

## Links

- [VitePress Documentation](https://vitepress.dev/)
- [Markdown Guide](https://vitepress.dev/guide/markdown)
- [Theme Configuration](https://vitepress.dev/reference/default-theme-config)
- [ActionPhase API Docs](/api/v1/docs) (Swagger UI)

## Troubleshooting

**Dead link warnings during build**:
- Set `ignoreDeadLinks: true` in config (already configured for development)
- Create the missing pages or update links

**Port 5173 already in use**:
- Kill the existing process: `lsof -ti:5173 | xargs kill`
- Or use a different port: `npm run docs:dev -- --port 5174`

**Build fails**:
- Check for invalid frontmatter in markdown files
- Ensure all required dependencies installed: `npm install`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`

## Contributing

When adding documentation:

1. Follow the existing structure
2. Use clear, concise language
3. Include code examples where helpful
4. Test links before committing
5. Build locally to catch errors early

## Status

**Current Version**: 1.0.0
**Last Updated**: November 15, 2025
**Status**: ✅ Foundation Complete

**Completed**:
- ✅ VitePress setup
- ✅ Directory structure
- ✅ Developer docs migrated
- ✅ Build system working
- ✅ Justfile commands

**Pending**:
- ⏳ User-facing content creation
- ⏳ Go backend integration
- ⏳ Production deployment
