# Generated Documentation

This directory contains built documentation from the VitePress site.

## For Developers

The documentation is **generated** and should not be committed to git (except this README.md).

### Building Documentation

**Local development:**
```bash
just docs-embed
```

This will:
1. Build the VitePress documentation site
2. Copy the built assets to this directory
3. Embedded in the backend binary via `go:embed`

**In CI:**
Documentation is automatically built before backend linting and the final binary build.

## Source Files

The source documentation files are in:
- `/docs-site/` - VitePress configuration and documentation source
- `/docs/` - Original markdown documentation

## Serving Documentation

When the backend is running, built documentation is served at:
- `http://localhost:3000/docs/`

The files in this directory are embedded into the Go binary using the `//go:embed` directive in `static.go`.
