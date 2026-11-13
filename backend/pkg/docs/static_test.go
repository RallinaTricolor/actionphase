package docs

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
)

func docsTestFS() fstest.MapFS {
	return fstest.MapFS{
		"index.html":             {Data: []byte("home")},
		"guide/index.html":       {Data: []byte("guide home")},
		"guide/phases.html":      {Data: []byte("phases page")},
		"assets/app.js":          {Data: []byte("js")},
		"guide/results-board.md": {Data: []byte("not a page")},
	}
}

// The app links to guide pages by VitePress's clean URL (no .html), and people
// share them that way. Loaded directly, each must serve the built page.
func TestStaticDocs_CleanURLs(t *testing.T) {
	h := newStaticDocsHandler(docsTestFS())

	tests := []struct {
		name     string
		path     string
		status   int
		body     string
		location string
	}{
		{name: "clean URL serves the page", path: "/docs/guide/phases", status: http.StatusOK, body: "phases page"},
		{name: ".html still serves the page", path: "/docs/guide/phases.html", status: http.StatusOK, body: "phases page"},
		{name: "trailing slash redirects to the clean URL", path: "/docs/guide/phases/", status: http.StatusMovedPermanently, location: "/docs/guide/phases"},
		{name: "trailing slash keeps the query", path: "/docs/guide/phases/?x=1", status: http.StatusMovedPermanently, location: "/docs/guide/phases?x=1"},
		{name: "a directory serves its index", path: "/docs/guide/", status: http.StatusOK, body: "guide home"},
		{name: "assets are served as is", path: "/docs/assets/app.js", status: http.StatusOK, body: "js"},
		{name: "a missing page is still a 404", path: "/docs/guide/nope", status: http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, tt.path, nil))
			assert.Equal(t, tt.status, rec.Code)
			if tt.body != "" {
				assert.Equal(t, tt.body, rec.Body.String())
			}
			if tt.location != "" {
				assert.Equal(t, tt.location, rec.Header().Get("Location"))
			}
		})
	}
}
