package docs

import (
	"actionphase/pkg/observability"
	"context"
	"embed"
	"io/fs"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Embed the dist directory from VitePress build
// Uses 'all:dist' to include all files and subdirectories
//
//go:embed all:dist
var staticDocsFS embed.FS

// RegisterStaticDocs registers the static documentation routes
// Serves the VitePress-built documentation at /docs/*
func RegisterStaticDocs(r chi.Router, logger *observability.Logger) {
	// Get the dist subdirectory from the embedded filesystem
	docsFS, err := fs.Sub(staticDocsFS, "dist")
	if err != nil {
		logger.Error(context.Background(), "failed to create docs filesystem", "error", err)
		return
	}

	// Create file server with prefix stripping
	fileServer := http.StripPrefix("/docs", http.FileServer(http.FS(docsFS)))

	// Handle /docs/ routes
	r.Get("/docs", func(w http.ResponseWriter, r *http.Request) {
		// Redirect /docs to /docs/
		http.Redirect(w, r, "/docs/", http.StatusMovedPermanently)
	})

	r.Handle("/docs/*", fileServer)

	logger.Info(context.Background(), "static documentation routes registered", "path", "/docs/*")
}
