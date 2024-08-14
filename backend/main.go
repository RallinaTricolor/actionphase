package main

import (
	"actionphase/pkg/db/services"
	"context"
	"github.com/golang-migrate/migrate/v4"
	"github.com/jackc/pgx/v5/stdlib"

	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"

	"actionphase/pkg/http"
)

func main() {
	ctx := context.Background()
	connectionString := "postgres://postgres:example@localhost:5432/database?sslmode=disable"
	pool, err := pgxpool.New(ctx, connectionString)
	if err != nil {
		panic(err)
	}
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
	// WE SHOULD DEFINITELY DO THIS AT DEPLOY TIME, NOT RUNTIME
	m.Up()
	UserService := db.UserService{DB: database}
	UserService.User(1)
	http.Start()
}
