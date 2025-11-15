# Documentation Hosting Framework Plan

## Executive Summary

Implement a comprehensive documentation system for ActionPhase that serves both user-facing guides and API documentation alongside the production application. The system will leverage the existing infrastructure (nginx, Go backend) and use path-based routing to serve documentation at `/docs/` endpoints.

## Current State Analysis

### Existing Documentation Assets

#### API Documentation (✅ Already Working!)
- **Location**: `/api/v1/docs/`
- **Technology**: Swagger UI 5.9.0 with OpenAPI 3.0.3 spec
- **File**: `backend/pkg/docs/docs.go` with embedded `openapi.yaml` (868 lines)
- **Features**: Interactive API testing, JWT Bearer auth support, deep linking
- **Status**: Fully functional and integrated

#### Markdown Documentation (32 files)
```
docs/
├── README.md (Main index)
├── adrs/ (8 Architecture Decision Records)
├── architecture/ (System design docs)
├── getting-started/ (Developer onboarding)
├── features/ (State management, implementation)
├── testing/ (Coverage, test data, E2E guides)
├── operations/ (Logging, deployment)
└── deployment/ (Route53, SSL setup)
```

#### AI Context Documentation
```
.claude/
├── context/ (TESTING, ARCHITECTURE, STATE_MANAGEMENT, TEST_DATA)
├── reference/ (BACKEND_ARCHITECTURE, API_DOCUMENTATION, etc.)
└── planning/ (MVP_STATUS, E2E_TESTING_PLAN, etc.)
```

### Current Infrastructure

#### Backend Server
- **Framework**: Go with Chi router
- **Port**: 3000
- **Static File Serving**: Already implemented for `/uploads/*`
- **Embed Support**: Using `//go:embed` for Swagger UI

#### Production Setup
- **Reverse Proxy**: Nginx with SSL termination
- **Containers**: Docker Compose (backend, frontend, nginx, db)
- **Routing**:
  - `/api/*` → backend:3000
  - `/` → frontend:80 (React SPA)

## Proposed Architecture

### URL Structure
```
Production URLs:
├── /                    → React SPA (game application)
├── /api/v1/*           → Backend API endpoints
├── /api/v1/docs/       → API documentation (Swagger UI) [EXISTING]
├── /docs/              → User documentation (static site) [NEW]
├── /docs/user/         → Player/GM guides [NEW]
└── /docs/developer/    → Technical documentation [NEW]
```

### Why Path-Based Routing?
1. **Minimal Infrastructure Changes**: Uses existing nginx/Go setup
2. **Single Domain**: No CORS issues, authentication can be shared
3. **Easy Deployment**: All served through one nginx instance
4. **Future-Proof**: Can migrate to subdomain later if needed

## Implementation Plan

### Phase 1: Documentation Organization (30 minutes)

#### 1.1 Create Directory Structure
```bash
docs-site/
├── .vitepress/           # VitePress configuration
│   └── config.js         # Site configuration
├── user/                 # User-facing documentation
│   ├── index.md         # User docs home
│   ├── getting-started/
│   │   ├── creating-account.md
│   │   ├── joining-game.md
│   │   └── first-character.md
│   ├── game-guide/
│   │   ├── game-phases.md
│   │   ├── common-room.md
│   │   ├── action-phase.md
│   │   └── character-management.md
│   ├── gm-guide/
│   │   ├── creating-game.md
│   │   ├── managing-players.md
│   │   └── running-phases.md
│   └── faq.md
└── developer/           # Developer documentation
    ├── index.md        # Developer docs home
    ├── getting-started/
    │   └── onboarding.md  # From DEVELOPER_ONBOARDING.md
    ├── architecture/
    │   ├── overview.md    # From SYSTEM_ARCHITECTURE.md
    │   ├── components.md  # From COMPONENT_INTERACTIONS.md
    │   └── adrs/         # Copy all ADR files
    ├── api/
    │   └── reference.md  # Link to /api/v1/docs
    ├── testing/
    │   └── [existing test docs]
    └── deployment/
        └── [existing deployment docs]
```

#### 1.2 Content Migration Map
- Move `/docs/adrs/*` → `docs-site/developer/architecture/adrs/`
- Move `/docs/architecture/*` → `docs-site/developer/architecture/`
- Move `/docs/testing/*` → `docs-site/developer/testing/`
- Move `/docs/getting-started/DEVELOPER_ONBOARDING.md` → `docs-site/developer/getting-started/`
- Create new user content in `docs-site/user/`

### Phase 2: Static Site Generator Setup (1 hour)

#### 2.1 Install VitePress
```bash
cd docs-site
npm init -y
npm install -D vitepress
```

#### 2.2 Configure VitePress
Create `.vitepress/config.js`:
```javascript
export default {
  title: 'ActionPhase Documentation',
  description: 'Complete guide for players and developers',
  base: '/docs/',

  themeConfig: {
    nav: [
      { text: 'User Guide', link: '/user/' },
      { text: 'Developer', link: '/developer/' },
      { text: 'API', link: '/api/v1/docs/', target: '_blank' }
    ],

    sidebar: {
      '/user/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Creating an Account', link: '/user/getting-started/creating-account' },
            { text: 'Joining a Game', link: '/user/getting-started/joining-game' },
            { text: 'Your First Character', link: '/user/getting-started/first-character' }
          ]
        },
        {
          text: 'Game Guide',
          items: [
            { text: 'Game Phases', link: '/user/game-guide/game-phases' },
            { text: 'Common Room', link: '/user/game-guide/common-room' },
            { text: 'Action Phase', link: '/user/game-guide/action-phase' }
          ]
        }
      ],
      '/developer/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Developer Onboarding', link: '/developer/getting-started/onboarding' }
          ]
        },
        {
          text: 'Architecture',
          items: [
            { text: 'System Overview', link: '/developer/architecture/overview' },
            { text: 'Components', link: '/developer/architecture/components' },
            { text: 'ADRs', link: '/developer/architecture/adrs/' }
          ]
        }
      ]
    },

    search: {
      provider: 'local'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/yourusername/actionphase' }
    ]
  }
}
```

#### 2.3 Add Build Scripts
Update `package.json`:
```json
{
  "scripts": {
    "docs:dev": "vitepress dev",
    "docs:build": "vitepress build",
    "docs:preview": "vitepress preview"
  }
}
```

### Phase 3: Documentation Serving Implementation (1 hour)

#### Option A: Embed in Go Binary (RECOMMENDED)

##### 3.1 Create Static Documentation Handler
Create `backend/pkg/docs/static.go`:
```go
package docs

import (
    "embed"
    "io/fs"
    "net/http"
    "github.com/go-chi/chi/v5"
)

//go:embed dist/*
var staticDocsFS embed.FS

// RegisterStaticDocs registers the static documentation routes
func RegisterStaticDocs(r chi.Router) {
    // Extract the embedded filesystem
    docsFS, err := fs.Sub(staticDocsFS, "dist")
    if err != nil {
        // Handle error - docs not embedded properly
        return
    }

    // Serve user documentation
    r.Handle("/docs/*", http.StripPrefix("/docs",
        http.FileServer(http.FS(docsFS))))
}
```

##### 3.2 Update Route Registration
In `backend/pkg/http/root.go`:
```go
// Add to imports
import "actionphase/backend/pkg/docs"

// In SetupRoutes function, after API docs registration:
docs.RegisterStaticDocs(r)  // Add static docs serving
```

##### 3.3 Build Process Integration
```bash
# Build documentation and copy to backend
cd docs-site && npm run docs:build
cp -r .vitepress/dist ../backend/pkg/docs/dist
```

#### Option B: Nginx Static Serving (ALTERNATIVE)

##### 3.1 Update nginx.prod.conf
```nginx
# User documentation
location /docs/ {
    alias /app/docs-site/dist/;
    try_files $uri $uri/ /docs/index.html;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Don't cache HTML
    location ~* \.html$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }
}
```

##### 3.2 Update Docker Configuration
In `docker-compose.prod.yml`:
```yaml
nginx:
  volumes:
    - ./docs-site/dist:/app/docs-site/dist:ro
```

### Phase 4: Build Automation (30 minutes)

#### 4.1 Update justfile
```makefile
# Documentation commands
docs-dev:
    cd docs-site && npm run docs:dev

docs-build:
    cd docs-site && npm install && npm run docs:build
    @echo "Documentation built to docs-site/.vitepress/dist"

docs-preview:
    cd docs-site && npm run docs:preview

# Build documentation and embed in backend (Option A)
docs-embed: docs-build
    rm -rf backend/pkg/docs/dist
    cp -r docs-site/.vitepress/dist backend/pkg/docs/dist
    @echo "Documentation embedded in backend"

# Full build including documentation
build-all-with-docs: docs-build
    just build-all backend
    just build-all frontend

# Development with live docs
dev-with-docs:
    (cd docs-site && npm run docs:dev) &
    just dev
```

#### 4.2 Docker Build Integration
Update `Dockerfile.backend`:
```dockerfile
# Build stage for documentation
FROM node:20-alpine AS docs-builder
WORKDIR /app/docs-site
COPY docs-site/package*.json ./
RUN npm ci
COPY docs-site/ ./
RUN npm run docs:build

# Main build stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
# ... existing Go build steps ...

# Copy built documentation (Option A)
COPY --from=docs-builder /app/docs-site/.vitepress/dist ./pkg/docs/dist

# ... continue with Go build ...
```

### Phase 5: Content Creation (2-4 hours)

#### 5.1 User Documentation Priority
1. **Getting Started** (1 hour)
   - Account creation walkthrough
   - Joining first game
   - Character creation basics

2. **Game Guide** (1 hour)
   - Understanding game phases
   - Common Room interactions
   - Action submission process
   - Reading results

3. **GM Guide** (30 minutes)
   - Creating a game
   - Managing applications
   - Running phases
   - Publishing results

4. **FAQ** (30 minutes)
   - Common questions
   - Troubleshooting
   - Tips and tricks

#### 5.2 Developer Documentation Priority
1. **Quick Start** (30 minutes)
   - Link to existing DEVELOPER_ONBOARDING.md
   - Local setup instructions
   - First contribution guide

2. **API Reference** (15 minutes)
   - Overview page
   - Link to Swagger UI
   - Authentication guide

3. **Architecture** (existing content)
   - Migrate existing architecture docs
   - Organize ADRs

### Phase 6: Deployment Integration (30 minutes)

#### 6.1 CI/CD Updates
If using GitHub Actions, add:
```yaml
- name: Build Documentation
  run: |
    cd docs-site
    npm ci
    npm run docs:build

- name: Embed Documentation (Option A)
  run: |
    cp -r docs-site/.vitepress/dist backend/pkg/docs/dist
```

#### 6.2 Production Deployment Checklist
- [ ] Documentation builds successfully
- [ ] Documentation embedded/mounted correctly
- [ ] Routes configured in nginx/Go
- [ ] SSL works for /docs paths
- [ ] Search functionality works
- [ ] Dark mode matches app theme
- [ ] Mobile responsive
- [ ] Links to API docs work

## Technology Decisions

### Why VitePress?
1. **Already using Vite** for frontend build
2. **Vue-based** (similar component model to React)
3. **Fast builds** (Vite's ESBuild)
4. **Built-in search** (local search, no external service)
5. **Dark mode** out of the box
6. **Markdown extensions** (code highlighting, tables, etc.)

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **MkDocs Material** | Beautiful theme, mature, simple | Python dependency, less customizable |
| **Docusaurus** | Feature-rich, versioning, i18n | Heavy, complex, Facebook-specific patterns |
| **Hugo** | Extremely fast, Go-native | Steeper learning curve, less markdown features |
| **Next.js Docs** | React-based, highly customizable | Overkill, requires custom implementation |

### Why Embed in Go Binary (Option A)?
1. **Single deployment artifact** - docs always match code version
2. **No nginx configuration changes** - simpler ops
3. **Automatic versioning** - docs embedded at build time
4. **Better performance** - served from memory
5. **Simpler rollback** - docs roll back with code

## Effort Estimates

### Minimal Viable Documentation (3-4 hours)
- Basic VitePress setup
- Migrate existing developer docs
- Simple user getting started guide
- Embed in Go binary
- Deploy to production

### Complete Documentation (8-10 hours)
- Full user guide content
- GM documentation
- Polished navigation
- Custom theme adjustments
- Search optimization
- Mobile testing

### Full Automation (12 hours)
- CI/CD integration
- Automated screenshots
- Version tagging
- Documentation tests
- Broken link checking
- SEO optimization

## Risk Mitigation

### Risk 1: Binary Size
- **Issue**: Embedding docs increases binary size
- **Mitigation**: Compress assets, use nginx serving for large docs

### Risk 2: Documentation Drift
- **Issue**: Docs become outdated
- **Mitigation**: Documentation review in PR process, automated API doc generation

### Risk 3: Search Performance
- **Issue**: Local search may be slow with large docs
- **Mitigation**: Consider Algolia DocSearch for production

### Risk 4: Build Complexity
- **Issue**: Additional build step adds complexity
- **Mitigation**: Clear justfile commands, good error messages

## Success Metrics

1. **Documentation Coverage**
   - [ ] All user-facing features documented
   - [ ] API fully documented with examples
   - [ ] Developer onboarding < 30 minutes

2. **Performance**
   - [ ] Documentation loads < 2 seconds
   - [ ] Search results < 500ms
   - [ ] Mobile responsive

3. **Usage**
   - [ ] Track documentation page views
   - [ ] Monitor search queries
   - [ ] Collect user feedback

## Next Steps

### Immediate Actions (After Approval)
1. Create `docs-site/` directory structure
2. Install VitePress dependencies
3. Configure VitePress with ActionPhase branding
4. Create minimal user guide content
5. Implement Go embedding (Option A)
6. Test locally with `just docs-dev`

### Week 1
- Complete user documentation
- Migrate all developer docs
- Deploy to staging

### Week 2
- Gather feedback
- Polish and iterate
- Deploy to production

### Month 1
- Monitor usage
- Add missing content based on user questions
- Consider advanced features (versioning, i18n)

## Appendix: Sample User Documentation

### Example: Getting Started Page
```markdown
# Getting Started with ActionPhase

Welcome to ActionPhase, a turn-based narrative gaming platform where players submit actions and GMs craft compelling stories!

## Creating Your Account

1. Navigate to [actionphase.com](https://actionphase.com)
2. Click **Sign Up** in the top right
3. Enter your email and choose a username
4. Verify your email address
5. You're ready to play!

## Joining Your First Game

Games in ActionPhase go through several stages:

- **Recruitment**: Games accepting new players
- **Character Creation**: Build your character
- **In Progress**: Active gameplay
- **Completed**: Finished games you can read

### Finding a Game

1. Click **Browse Games** from the dashboard
2. Filter by:
   - Genre (Fantasy, Sci-Fi, Modern, etc.)
   - Status (Recruiting, In Progress)
   - Player Count
3. Click a game to view details

### Applying to Join

1. Read the game description and requirements
2. Click **Apply to Join**
3. Write a brief application message
4. Wait for GM approval
5. Once approved, create your character!

## Next Steps

- [Creating Your Character](/user/getting-started/first-character)
- [Understanding Game Phases](/user/game-guide/game-phases)
- [Common Room Guide](/user/game-guide/common-room)
```

## Conclusion

This documentation hosting framework provides a production-ready solution that:
- Leverages existing infrastructure
- Requires minimal configuration changes
- Provides excellent user experience
- Scales with the application
- Maintains version consistency
- Supports both user and developer audiences

The recommended approach (VitePress + Go embedding) balances simplicity, performance, and maintainability while providing a professional documentation experience for ActionPhase users and developers.
