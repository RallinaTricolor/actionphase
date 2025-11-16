//go:build ignore

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// Route represents a registered API route
type Route struct {
	Method string `json:"method"`
	Path   string `json:"path"`
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

	// Step 3: Find missing routes
	missing := findMissingRoutes(actualRoutes, documentedRoutes)

	if len(missing) == 0 {
		fmt.Println("✅ All routes are documented!")
		return
	}

	// Step 4: Generate skeleton YAML for missing routes
	fmt.Printf("Generating skeleton documentation for %d missing routes...\n\n", len(missing))
	fmt.Println("# Add this to your openapi.yaml file:\n")
	fmt.Println(generateSkeletonYAML(missing))
}

// fetchRegisteredRoutes gets all routes from Chi router via debug endpoint
func fetchRegisteredRoutes() ([]Route, error) {
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
			method = strings.ToUpper(method)
			if isHTTPMethod(method) {
				routes = append(routes, Route{
					Method: method,
					Path:   "/api/v1" + path,
				})
			}
		}
	}

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

// findMissingRoutes returns routes that are in actual but not in documented
func findMissingRoutes(actual, documented []Route) []Route {
	documentedMap := make(map[string]bool)
	for _, r := range documented {
		key := r.Method + " " + r.Path
		documentedMap[key] = true
	}

	var missing []Route
	for _, r := range actual {
		key := r.Method + " " + r.Path
		if !documentedMap[key] {
			missing = append(missing, r)
		}
	}

	return missing
}

// generateSkeletonYAML generates basic OpenAPI YAML for missing routes
func generateSkeletonYAML(routes []Route) string {
	var out strings.Builder

	// Group routes by path
	pathMap := make(map[string][]string)
	for _, route := range routes {
		// Remove /api/v1 prefix for OpenAPI spec
		path := strings.TrimPrefix(route.Path, "/api/v1")
		if path == "" {
			path = "/"
		}
		pathMap[path] = append(pathMap[path], route.Method)
	}

	// Generate YAML for each path
	for path, methods := range pathMap {
		out.WriteString(fmt.Sprintf("  %s:\n", path))

		for _, method := range methods {
			methodLower := strings.ToLower(method)
			out.WriteString(fmt.Sprintf("    %s:\n", methodLower))
			out.WriteString(fmt.Sprintf("      summary: TODO: %s %s\n", method, path))
			out.WriteString("      description: TODO: Add description\n")
			out.WriteString("      tags:\n")
			out.WriteString(fmt.Sprintf("        - %s\n", guessTag(path)))

			// Add common responses
			out.WriteString("      responses:\n")
			if method == "GET" {
				out.WriteString("        '200':\n")
				out.WriteString("          description: Success\n")
				out.WriteString("          content:\n")
				out.WriteString("            application/json:\n")
				out.WriteString("              schema:\n")
				out.WriteString("                type: object\n")
			} else if method == "POST" {
				out.WriteString("        '201':\n")
				out.WriteString("          description: Created\n")
			} else if method == "DELETE" {
				out.WriteString("        '204':\n")
				out.WriteString("          description: No content\n")
			} else {
				out.WriteString("        '200':\n")
				out.WriteString("          description: Success\n")
			}

			out.WriteString("        '400':\n")
			out.WriteString("          description: Bad request\n")
			out.WriteString("          content:\n")
			out.WriteString("            application/json:\n")
			out.WriteString("              schema:\n")
			out.WriteString("                $ref: '#/components/schemas/ErrorResponse'\n")
			out.WriteString("        '401':\n")
			out.WriteString("          description: Unauthorized\n")
			out.WriteString("          content:\n")
			out.WriteString("            application/json:\n")
			out.WriteString("              schema:\n")
			out.WriteString("                $ref: '#/components/schemas/ErrorResponse'\n")
			out.WriteString("\n")
		}
	}

	return out.String()
}

// guessTag attempts to guess the appropriate tag based on the path
func guessTag(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) > 0 {
		// Capitalize first letter
		tag := parts[0]
		if len(tag) > 0 {
			return strings.ToUpper(tag[:1]) + tag[1:]
		}
	}
	return "General"
}
