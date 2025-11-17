# Backend Linting Fix - Proper Solution

## ✅ Problem Solved

Fixed the `go vet` error: "pattern dist/*: no matching files found" using **best practices** instead of committing generated files.

## 🎯 The Right Way

### What We Did

1. **Keep dist/ ignored in git** (except stub README.md)
2. **Build docs during CI** before backend linting
3. **Use `all:dist` embed directive** (more forgiving)
4. **Add stub README.md** for local development

### Why This Is Better

✅ **No repository bloat**: Generated files not committed
✅ **No merge conflicts**: Only source files in git
✅ **Always fresh**: Docs rebuilt on every CI run
✅ **Clean git history**: Only meaningful changes tracked
✅ **Professional**: Follows software engineering best practices

## 📝 Changes Made

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Backend Lint Job** - Added docs build:
```yaml
- name: Set up Node.js for docs
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
    cache-dependency-path: docs-site/package-lock.json

- name: Build documentation
  run: |
    cd docs-site
    npm ci
    npm run docs:build
    rm -rf ../backend/pkg/docs/dist
    mkdir -p ../backend/pkg/docs/dist
    cp -r .vitepress/dist/* ../backend/pkg/docs/dist/
```

**Build Check Job** - Added docs build before backend build:
```yaml
- name: Build documentation for embedding
  run: |
    cd docs-site
    npm ci
    npm run docs:build
    rm -rf ../backend/pkg/docs/dist
    mkdir -p ../backend/pkg/docs/dist
    cp -r .vitepress/dist/* ../backend/pkg/docs/dist/
```

### 2. Go Embed Directive (`backend/pkg/docs/static.go`)

Changed from `dist/*` to `all:dist`:
```go
// Before:
//go:embed dist/*
var staticDocsFS embed.FS

// After (more forgiving):
//go:embed all:dist
var staticDocsFS embed.FS
```

### 3. Gitignore (`.gitignore`)

```gitignore
dist/  # Keep ignoring dist directories

# Exception: Keep stub file in backend docs dist for embed directive
!backend/pkg/docs/dist/README.md
```

### 4. Stub File (`backend/pkg/docs/dist/README.md`)

- **Only file committed** in dist/
- Explains the directory is for generated content
- Provides build instructions
- Satisfies embed directive locally

## 🔄 Workflow

### In CI:
1. Checkout code (only README.md in dist/)
2. Build documentation from source
3. Copy built files to dist/
4. Run go vet (finds built files)
5. Build backend (embeds documentation)

### Locally:
```bash
# Build and embed docs
just docs-embed

# Or manually:
cd docs-site
npm run docs:build
cp -r .vitepress/dist/* ../backend/pkg/docs/dist/

# Then run backend
just dev
```

## 📊 What Gets Committed

**Committed to git:**
- ✅ Source docs (docs-site/)
- ✅ Stub README.md (backend/pkg/docs/dist/README.md)

**NOT committed (generated):**
- ❌ Built HTML (backend/pkg/docs/dist/*.html)
- ❌ Built JS (backend/pkg/docs/dist/assets/)
- ❌ Built CSS (backend/pkg/docs/dist/*.css)

## 🧪 Verification

```bash
# Local lint check
just lint
# ✅ Passes with only README.md

# Build with embedded docs
just docs-embed
just build
# ✅ Backend binary includes full documentation

# CI will build docs automatically
git push
# ✅ CI builds docs before linting and final build
```

## 🎓 Key Takeaways

1. **Never commit generated files** if you can avoid it
2. **Build during CI** is the professional approach
3. **Stub files** can satisfy build tools without bloat
4. **`all:` prefix** in embed is more forgiving than `*`
5. **Source of truth** stays with source files, not builds

## 🔗 Related Commands

```bash
# Build docs locally
just docs-embed

# Build backend with embedded docs
just build

# Run backend (serves docs at /docs/)
just dev

# CI automatically builds docs before:
# - Backend linting (go vet)
# - Final backend build (production binary)
```

## 📚 Benefits

**For Development:**
- Clean, fast git operations
- No accidental commits of generated files
- Easy to rebuild docs anytime

**For CI:**
- Always fresh documentation
- Consistent builds
- No stale embedded assets

**For Production:**
- Docs embedded in binary
- Self-contained deployment
- No external doc files needed

---

**Status**: ✅ Implemented and tested
**Type**: Best Practice Implementation
**Impact**: Resolves CI failure with professional solution
