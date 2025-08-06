package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"

	"actionphase/pkg/core"
	"actionphase/pkg/http"
)

func main() {
	// Load configuration from environment with validation
	config, err := core.LoadConfig()
	if err != nil {
		fmt.Printf("Configuration error: %v\n", err)
		os.Exit(1)
	}

	// Setup structured logger with appropriate level
	logLevel := slog.LevelInfo
	switch config.App.LogLevel {
	case "debug":
		logLevel = slog.LevelDebug
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))

	logger.Info("Starting ActionPhase backend",
		"environment", config.App.Environment,
		"log_level", config.App.LogLevel,
		"port", config.Server.Port)

	// Setup database connection pool
	ctx := context.Background()
	poolConfig, err := pgxpool.ParseConfig(config.Database.URL)
	if err != nil {
		logger.Error("Invalid database configuration", "error", err)
		os.Exit(1)
	}

	// Configure connection pool settings
	poolConfig.MaxConns = int32(config.Database.MaxConnections)
	poolConfig.MaxConnIdleTime = config.Database.MaxIdleTime

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		logger.Error("Failed to create database pool", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// Test database connection
	if err := pool.Ping(ctx); err != nil {
		logger.Error("Database connection failed", "error", err)
		os.Exit(1)
	}

	logger.Info("Database connection established")

	// Initialize application context
	app := &core.App{
		Logger: *logger,
		Pool:   pool,
		Config: config,
	}

	// Run database migrations if configured
	if config.App.RunMigrations {
		if err := runMigrations(logger, pool); err != nil {
			logger.Error("Migration failed", "error", err)
			// Don't exit - allow manual migration in production
			if config.IsProduction() {
				logger.Warn("Skipping failed migrations in production - please run manually")
			} else {
				os.Exit(1)
			}
		}
	} else {
		logger.Info("Skipping database migrations (RUN_MIGRATIONS=false)")
	}

	// Start HTTP server
	logger.Info("Starting HTTP server",
		"address", config.GetServerAddress(),
		"environment", config.App.Environment)

	httpHandler := &http.Handler{
		App: app,
	}

	// httpHandler.Start() should be updated to use config for server settings
	// For now, it will use the existing implementation
	httpHandler.Start()
}

// runMigrations applies database schema migrations
func runMigrations(logger *slog.Logger, pool *pgxpool.Pool) error {
	logger.Info("Running database migrations...")

	// Convert pgx pool to database/sql for migrate library
	database := stdlib.OpenDBFromPool(pool)
	defer database.Close()

	driver, err := postgres.WithInstance(database, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("failed to create migration driver: %w", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://pkg/db/migrations",
		"postgres", // database name for migrate
		driver,
	)
	if err != nil {
		return fmt.Errorf("failed to create migration instance: %w", err)
	}
	defer m.Close()

	// Apply migrations
	err = m.Up()
	if err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migration failed: %w", err)
	}

	if err == migrate.ErrNoChange {
		logger.Info("Database is up to date")
	} else {
		logger.Info("Database migrations completed successfully")
	}

	return nil
}
