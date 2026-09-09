package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestMigrationsDirIsGooseFormat pins the file format the runner depends on.
//
// runMigrations calls goose.Up against migrationsDir. goose ignores a .sql file
// with no "-- +goose Up" annotation rather than failing on it, so a migration
// left in golang-migrate's format — a bare .up.sql/.down.sql pair, as every
// migration in this repo was before the swap — would be silently skipped and
// recorded as nothing. A branch written before the cutover and rebased after it
// is the realistic way that happens.
//
// This runs without a database because it is a property of the files, not of any
// particular schema state.
func TestMigrationsDirIsGooseFormat(t *testing.T) {
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		t.Fatalf("cannot read %s: %v", migrationsDir, err)
	}

	var sqlFiles []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			sqlFiles = append(sqlFiles, e.Name())
		}
	}
	if len(sqlFiles) == 0 {
		t.Fatalf("no .sql migrations found in %s; this test would pass vacuously", migrationsDir)
	}

	for _, name := range sqlFiles {
		t.Run(name, func(t *testing.T) {
			// A leftover golang-migrate pair is the specific regression to catch,
			// and its name is the clearest signal.
			if strings.HasSuffix(name, ".up.sql") || strings.HasSuffix(name, ".down.sql") {
				t.Fatalf("%s is in golang-migrate format; goose expects a single file "+
					"with -- +goose Up and -- +goose Down sections, and silently ignores this one", name)
			}

			body, err := os.ReadFile(filepath.Join(migrationsDir, name))
			if err != nil {
				t.Fatalf("cannot read %s: %v", name, err)
			}
			content := string(body)

			// goose requires the Up annotation to register the migration at all.
			if !strings.Contains(content, "-- +goose Up") {
				t.Errorf("%s has no '-- +goose Up' annotation; goose would skip it entirely", name)
			}
			// Down is not required by goose, but every migration in this repo has
			// one, and rollback depends on it.
			if !strings.Contains(content, "-- +goose Down") {
				t.Errorf("%s has no '-- +goose Down' annotation; it cannot be rolled back", name)
			}

			// Dollar-quoted bodies must be wrapped, or goose splits them on the
			// semicolons inside the function body and fails with "unterminated
			// dollar-quoted string" at apply time.
			if strings.Contains(content, "$$") || strings.Contains(content, "$do$") {
				if !strings.Contains(content, "-- +goose StatementBegin") {
					t.Errorf("%s contains a dollar-quoted block but no '-- +goose StatementBegin'; "+
						"goose splits it on inner semicolons and fails to apply", name)
				}
			}
		})
	}
}
