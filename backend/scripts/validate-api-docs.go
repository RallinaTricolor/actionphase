//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// Route represents a registered API route
type Route struct {
	Method string
	Path   string
}

// OpenAPISpec represents the minimal structure we need from openapi.yaml
type OpenAPISpec struct {
	Paths map[string]map[string]interface{} `yaml:"paths"`
}

func main() {
	// Step 1: Get all registered routes from the running server
	actualRoutes, err := fetchRegisteredRoutes()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error fetching routes: %v\n", err)
		fmt.Println("\n⚠️  Make sure the server is running on http://localhost:3000")
		os.Exit(1)
	}

	// Step 2: Parse openapi.yaml to get documented routes
	documentedRoutes, err := parseOpenAPISpec("pkg/docs/openapi.yaml")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing OpenAPI spec: %v\n", err)
		os.Exit(1)
	}

	// Step 3: Compare and report
	missing, extra := compareRoutes(actualRoutes, documentedRoutes)

	// Report results
	fmt.Println("=== API Documentation Validation ===\n")
	fmt.Printf("Total registered routes: %d\n", len(actualRoutes))
	fmt.Printf("Total documented routes: %d\n", len(documentedRoutes))
	fmt.Printf("Coverage: %.1f%%\n\n", float64(len(documentedRoutes))/float64(len(actualRoutes))*100)

	if len(missing) > 0 {
		fmt.Printf("❌ Missing from documentation (%d routes):\n", len(missing))
		for _, route := range missing {
			fmt.Printf("   %s %s\n", route.Method, route.Path)
		}
		fmt.Println()
	}

	if len(extra) > 0 {
		fmt.Printf("⚠️  Documented but not registered (%d routes):\n", len(extra))
		for _, route := range extra {
			fmt.Printf("   %s %s\n", route.Method, route.Path)
		}
		fmt.Println()
	}

	if len(missing) == 0 && len(extra) == 0 {
		fmt.Println("✅ All routes are documented!")
		os.Exit(0)
	} else {
		fmt.Printf("\n💡 Tip: Run 'go run scripts/generate-doc-skeleton.go' to generate skeletons for missing routes\n")
		os.Exit(1)
	}
}

// fetchRegisteredRoutes gets all routes from Chi router via a debug endpoint
func fetchRegisteredRoutes() ([]Route, error) {
	// We'll need to add a debug endpoint to expose routes
	// For now, we'll parse from chi.Walk() output
	// This is a placeholder - we'll implement the actual route extraction

	resp, err := http.Get("http://localhost:3000/api/v1/debug/routes")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch routes: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	var routes []Route
	if err := json.NewDecoder(resp.Body).Decode(&routes); err != nil {
		return nil, fmt.Errorf("failed to decode routes: %w", err)
	}

	return routes, nil
}

// parseOpenAPISpec extracts all documented routes from openapi.yaml
func parseOpenAPISpec(filepath string) ([]Route, error) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var spec OpenAPISpec
	if err := yaml.Unmarshal(data, &spec); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	var routes []Route
	for path, methods := range spec.Paths {
		for method := range methods {
			// Skip non-HTTP methods (like $ref, description, etc.)
			method = strings.ToUpper(method)
			if isHTTPMethod(method) {
				routes = append(routes, Route{
					Method: method,
					Path:   "/api/v1" + path, // Add base path
				})
			}
		}
	}

	sort.Slice(routes, func(i, j int) bool {
		if routes[i].Path == routes[j].Path {
			return routes[i].Method < routes[j].Method
		}
		return routes[i].Path < routes[j].Path
	})

	return routes, nil
}

func isHTTPMethod(method string) bool {
	validMethods := []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	for _, m := range validMethods {
		if method == m {
			return true
		}
	}
	return false
}

// compareRoutes returns routes that are missing from docs and routes that are extra in docs
func compareRoutes(actual, documented []Route) (missing, extra []Route) {
	actualMap := make(map[string]bool)
	documentedMap := make(map[string]bool)

	for _, r := range actual {
		key := r.Method + " " + r.Path
		actualMap[key] = true
	}

	for _, r := range documented {
		key := r.Method + " " + r.Path
		documentedMap[key] = true
	}

	// Find missing (in actual but not in documented)
	for _, r := range actual {
		key := r.Method + " " + r.Path
		if !documentedMap[key] {
			missing = append(missing, r)
		}
	}

	// Find extra (in documented but not in actual)
	for _, r := range documented {
		key := r.Method + " " + r.Path
		if !actualMap[key] {
			extra = append(extra, r)
		}
	}

	sort.Slice(missing, func(i, j int) bool {
		if missing[i].Path == missing[j].Path {
			return missing[i].Method < missing[j].Method
		}
		return missing[i].Path < missing[j].Path
	})

	sort.Slice(extra, func(i, j int) bool {
		if extra[i].Path == extra[j].Path {
			return extra[i].Method < extra[j].Method
		}
		return extra[i].Path < extra[j].Path
	})

	return missing, extra
}
