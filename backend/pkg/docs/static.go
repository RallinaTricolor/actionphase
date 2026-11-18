package docs

import (
	"actionphase/pkg/observability"
	"context"
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"

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

	// Handle /docs/ routes
	r.Get("/docs", func(w http.ResponseWriter, r *http.Request) {
		// Redirect /docs to /docs/
		http.Redirect(w, r, "/docs/", http.StatusMovedPermanently)
	})

	r.Handle("/docs/*", newStaticDocsHandler(docsFS))

	logger.Info(context.Background(), "static documentation routes registered", "path", "/docs/*")
}

// newStaticDocsHandler serves the built docs under /docs, resolving VitePress's
// clean URLs. The site is built without cleanUrls, so each page is a .html
// file, but its router and the app link to /docs/guide/phases. Loaded directly,
// that path is served guide/phases.html. With a trailing slash it redirects to
// the clean URL: VitePress's router would read guide/phases/ as
// guide/phases/index and show its 404 once the page loads.
func newStaticDocsHandler(docsFS fs.FS) http.Handler {
	fileServer := http.StripPrefix("/docs", http.FileServer(http.FS(docsFS)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rel := strings.TrimPrefix(r.URL.Path, "/docs/")
		page := strings.TrimSuffix(rel, "/")
		if page != "" && path.Ext(page) == "" {
			if _, err := fs.Stat(docsFS, page+".html"); err == nil {
				if page != rel {
					target := "/docs/" + page
					if r.URL.RawQuery != "" {
						target += "?" + r.URL.RawQuery
					}
					http.Redirect(w, r, target, http.StatusMovedPermanently)
					return
				}
				r2 := r.Clone(r.Context())
				r2.URL.Path = "/docs/" + page + ".html"
				r2.URL.RawPath = ""
				fileServer.ServeHTTP(w, r2)
				return
			}
		}
		fileServer.ServeHTTP(w, r)
	})
}
