package main

import (
	"context"
	"github.com/golang-migrate/migrate/v4"
	"github.com/jackc/pgx/v5/stdlib"
	"log/slog"
	"os"

	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/core"
	"actionphase/pkg/http"
)

func main() {
	ctx := context.Background()
	connectionString := "postgres://postgres:example@localhost:5432/database?sslmode=disable"
	pool, err := pgxpool.New(ctx, connectionString)
	if err != nil {
		panic(err)
	}
	app := &core.App{
		Logger: *slog.New(slog.NewTextHandler(os.Stdout, nil)),
		Pool:   pool,
	}

	// TODO: WE SHOULD DEFINITELY DO THIS AT DEPLOY TIME, NOT RUNTIME
	database := stdlib.OpenDBFromPool(pool)
	driver, err := postgres.WithInstance(database, &postgres.Config{})
	if err != nil {
		panic(err)
	}
	m, err := migrate.NewWithDatabaseInstance(
		"file://pkg/db/migrations",
		"database", driver)
	if err != nil {
		panic(err)
	}

	app.Logger.Info("Running database migrations...")
	m.Up()

	app.Logger.Info("Starting server...")
	httpHandler := &http.Handler{
		App: app,
	}
	httpHandler.Start()
}
