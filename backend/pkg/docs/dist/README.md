# Placeholder

This file exists so that `//go:embed all:dist` in `backend/pkg/docs/static.go`
compiles on a fresh clone. Go's embed directive fails the build if the target
directory does not exist, and the real contents of this directory are generated,
not committed.

To populate it with the actual built documentation site, run:

    just docs-embed

That builds the VitePress site from `docs-site/` and copies the output here.
Everything in this directory except this README is ignored by git.
