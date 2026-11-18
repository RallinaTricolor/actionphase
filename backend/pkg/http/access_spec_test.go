package http

import (
	"fmt"
	"slices"
	"sort"
	"strings"
	"testing"

	"actionphase/pkg/access"
)

// specOperation is one operation as the rendered spec describes it.
type specOperation struct {
	method, path, id string
	fields           map[string]any
}

func specOperations(t *testing.T) []specOperation {
	t.Helper()
	var ops []specOperation
	paths, _ := specDocument(t)["paths"].(map[string]any)
	for path, rawItem := range paths {
		item, _ := rawItem.(map[string]any)
		for method, rawOp := range item {
			op, ok := rawOp.(map[string]any)
			if !ok {
				continue
			}
			id, _ := op["operationId"].(string)
			ops = append(ops, specOperation{strings.ToUpper(method), path, id, op})
		}
	}
	return ops
}

// Every top-level path in the API is in exactly one of these lists, or under
// /games/{gameID}; TestGameScopedOperationsDeclareAccess fails on a path in
// neither. Adding a mount means deciding which list it belongs to. The
// resource mounts are the ones root.go wires with gateResource.
var (
	// resourceRoutePrefixes are mounts whose routes address a game-owned row
	// by its own ID. Each installs access.ResourceMiddleware, so every route
	// on them declares a level just as /games/{gameID} routes do.
	resourceRoutePrefixes = []string{"/characters", "/phases", "/deadlines", "/exports", "/polls"}

	// nonGameRoutePrefixes hold no game content, or only the caller's own rows
	// across games, and are gated by their own middleware (auth, admin,
	// community standing). They must not declare a level: nothing enforces one.
	nonGameRoutePrefixes = []string{"/admin", "/auth", "/comments", "/communities", "/dashboard", "/favorites", "/games", "/handouts", "/notifications", "/users", "/ping"}
)

func hasPathPrefix(path string, prefixes []string) bool {
	for _, p := range prefixes {
		if path == p || strings.HasPrefix(path, p+"/") {
			return true
		}
	}
	return false
}

func isGameScoped(path string) bool { return strings.Contains(path, "/games/{gameID}") }

// isAccessGated reports whether a path runs one of the access middlewares:
// game-scoped, or on a mount that resolves its game from the row it names.
func isAccessGated(path string) bool {
	return isGameScoped(path) || hasPathPrefix(path, resourceRoutePrefixes)
}

// TestGameScopedOperationsDeclareAccess is the build-time half of pkg/access:
// every route under /games/{gameID}, and every route on a mount that names a
// game's row by its own ID, must declare who may call it. A new route
// that declares nothing fails here, before it can ship, rather than at runtime
// with a 500.
func TestGameScopedOperationsDeclareAccess(t *testing.T) {
	ops := specOperations(t)
	var problems []string
	fail := func(op specOperation, format string, args ...any) {
		problems = append(problems, fmt.Sprintf("%s %s (%s): %s", op.method, op.path, op.id, fmt.Sprintf(format, args...)))
	}

	for _, op := range ops {
		level, declared := op.fields[access.ExtensionKey].(string)

		if !isAccessGated(op.path) {
			if !hasPathPrefix(op.path, nonGameRoutePrefixes) {
				// A new mount nobody classified: it may hold game content
				// with no gate. Decide which list it belongs to.
				fail(op, "is on no known mount; add its prefix to resourceRoutePrefixes or nonGameRoutePrefixes in access_resources.go")
				continue
			}
			// The middleware only runs on the game APIs, so a declaration
			// anywhere else would read as protection it doesn't have.
			if declared {
				fail(op, "declares %s but no access middleware runs on this mount, so nothing enforces it", access.ExtensionKey)
			}
			continue
		}

		if isGameScoped(op.path) {
			for _, child := range access.ChildParams(op.path) {
				if _, ok := childParams[child.Shape]; !ok {
					fail(op, "names %s with no childParams entry for %q in access_resources.go, so its game is never checked", child.Name, child.Shape)
				}
			}
		}

		if !declared {
			fail(op, "declares no access level; add Extensions: access.<Level>() to its huma.Operation")
			continue
		}
		if !slices.Contains(access.Levels, access.Level(level)) {
			fail(op, "declares unknown level %q", level)
		}
		if level == string(access.Public) || level == string(access.Handler) {
			if reason, _ := op.fields[access.ReasonKey].(string); strings.TrimSpace(reason) == "" {
				fail(op, "level %q requires a reason", level)
			}
		}
	}

	sort.Strings(problems)
	for _, p := range problems {
		t.Error(p)
	}
}
