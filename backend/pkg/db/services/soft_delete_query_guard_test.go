package db

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// Soft-deleted games are hidden by a `deleted_at IS NULL` predicate written
// into each query, not by a view, so a new query can forget it. This guard
// reads every sqlc query that selects from or joins `games` and fails unless
// each reference to the table filters deleted_at, or the query states why it
// does not need to with a `-- soft-delete: <reason>` comment (usually: it is
// scoped to one game its route already resolved through GetGame, which 404s
// a deleted game).
//
// It cannot see a cross-game query that never touches `games` (favorites by
// user, say). Those still rely on review; the cross-game behaviour is pinned by
// TestSoftDeletedGameHiddenFromCrossGameQueries.

var (
	queryNameLine   = regexp.MustCompile(`(?m)^-- name: (\w+)`)
	gamesReference  = regexp.MustCompile(`(?i)\b(?:FROM|JOIN)\s+games\b(?:\s+(?:AS\s+)?(\w+))?`)
	softDeleteNote  = regexp.MustCompile(`(?m)^-- soft-delete: \S`)
	unqualifiedFilt = regexp.MustCompile(`(?i)(^|[^\w.])deleted_at\s+IS\s+(NOT\s+)?NULL`)
	sqlLineComment  = regexp.MustCompile(`--.*`)
)

// sqlKeywords can follow a table name, so they are never its alias.
var sqlKeywords = map[string]bool{
	"on": true, "where": true, "join": true, "left": true, "inner": true, "right": true,
	"full": true, "cross": true, "order": true, "group": true, "limit": true, "using": true,
	"set": true, "returning": true, "union": true,
}

// unfilteredGamesAliases returns the alias (or "games" when unaliased) of each
// reference to the games table in body that has no deleted_at predicate.
func unfilteredGamesAliases(body string) []string {
	var missing []string
	for _, m := range gamesReference.FindAllStringSubmatch(body, -1) {
		alias := strings.ToLower(m[1])
		if alias == "" || sqlKeywords[alias] {
			if !unqualifiedFilt.MatchString(body) {
				missing = append(missing, "games")
			}
			continue
		}
		qualified := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(alias) + `\.deleted_at\s+IS\s+(NOT\s+)?NULL`)
		if !qualified.MatchString(body) {
			missing = append(missing, alias)
		}
	}
	return missing
}

func TestEveryGamesQueryHandlesSoftDelete(t *testing.T) {
	files, err := filepath.Glob(filepath.Join("..", "queries", "*.sql"))
	require.NoError(t, err)
	require.NotEmpty(t, files, "query directory not found; the guard would pass vacuously")

	checked := 0
	for _, file := range files {
		raw, err := os.ReadFile(file)
		require.NoError(t, err)
		text := string(raw)

		starts := queryNameLine.FindAllStringSubmatchIndex(text, -1)
		for i, s := range starts {
			end := len(text)
			if i+1 < len(starts) {
				end = starts[i+1][0]
			}
			query := text[s[0]:end]
			name := text[s[2]:s[3]]

			body := sqlLineComment.ReplaceAllString(query, "")
			if !gamesReference.MatchString(body) {
				continue
			}
			checked++
			if softDeleteNote.MatchString(query) {
				continue
			}
			if missing := unfilteredGamesAliases(body); len(missing) > 0 {
				t.Errorf("%s: %s reads games (as %s) without a deleted_at filter. Add `<alias>.deleted_at IS NULL`, "+
					"or a `-- soft-delete: <reason>` comment if it is scoped to one already-resolved game.",
					filepath.Base(file), name, strings.Join(missing, ", "))
			}
		}
	}
	require.Greater(t, checked, 0, "no query referencing games was found; the guard is not reading the queries")
}

// The guard's matcher, pinned on small inputs so a regex change cannot quietly
// make it pass everything.
func TestUnfilteredGamesAliases(t *testing.T) {
	cases := []struct {
		name string
		sql  string
		want []string
	}{
		{"aliased and filtered", "SELECT 1 FROM games g WHERE g.deleted_at IS NULL", nil},
		{"aliased, other table filtered", "SELECT 1 FROM messages m JOIN games g ON g.id = m.game_id WHERE m.deleted_at IS NULL", []string{"g"}},
		{"unaliased and filtered", "SELECT * FROM games WHERE id = $1 AND deleted_at IS NULL", nil},
		{"unaliased, unfiltered", "SELECT * FROM games WHERE id = $1", []string{"games"}},
		{"NOT EXISTS on deleted rows counts", "SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.deleted_at IS NOT NULL)", nil},
		{"two references, one filtered", "SELECT 1 FROM games g JOIN x ON TRUE WHERE EXISTS (SELECT 1 FROM games g2 WHERE g2.id = 1) AND g.deleted_at IS NULL", []string{"g2"}},
		{"game_phases is not games", "SELECT 1 FROM game_phases gp", nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			require.Equal(t, c.want, unfilteredGamesAliases(c.sql))
		})
	}
}
