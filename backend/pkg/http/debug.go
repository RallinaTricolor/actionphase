package http

import (
	"encoding/json"
	"net/http"
	"sort"
	"strings"

	"github.com/go-chi/chi/v5"
)

// DebugHandler provides debug endpoints for development
type DebugHandler struct{}

// Route represents a registered API route
type Route struct {
	Method string `json:"method"`
	Path   string `json:"path"`
}

// RegisterRoutes adds debug routes (only enabled in development)
func (h *DebugHandler) RegisterRoutes(r chi.Router) {
	r.Get("/routes", h.listRoutes)
}

// listRoutes returns all registered routes in the Chi router
func (h *DebugHandler) listRoutes(w http.ResponseWriter, r *http.Request) {
	// Get the router from chi.RouteContext
	// We'll walk from the request context's parent router
	ctx := chi.RouteContext(r.Context())
	if ctx == nil {
		http.Error(w, "No route context found", http.StatusInternalServerError)
		return
	}

	// Walk up to the root router by getting the Routes interface
	routes := WalkRoutes(ctx.Routes)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(routes)
}

// WalkRoutes traverses a chi router and collects all routes
func WalkRoutes(r chi.Routes) []Route {
	var routes []Route

	walkFunc := func(method string, route string, handler http.Handler, middlewares ...func(http.Handler) http.Handler) error {
		// Skip wildcard routes
		if strings.Contains(route, "/*") {
			return nil
		}

		// Normalize the route path
		route = strings.TrimSuffix(route, "/")
		if route == "" {
			route = "/"
		}

		routes = append(routes, Route{
			Method: method,
			Path:   route,
		})
		return nil
	}

	chi.Walk(r, walkFunc)

	// Sort routes for consistent output
	sort.Slice(routes, func(i, j int) bool {
		if routes[i].Path == routes[j].Path {
			return routes[i].Method < routes[j].Method
		}
		return routes[i].Path < routes[j].Path
	})

	return routes
}
