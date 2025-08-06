package core

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
)

// App holds the core application dependencies and configuration.
// It serves as the central context for the entire application,
// providing access to database, logging, and configuration.
//
// Usage Example:
//
//	config, err := LoadConfig()
//	if err != nil {
//	    log.Fatal("Config error", err)
//	}
//
//	app := &App{
//	    Logger: *slog.Default(),
//	    Pool:   dbPool,
//	    Config: config,
//	}
//
//	// Pass app to handlers
//	handler := &games.Handler{App: app}
type App struct {
	// Logger provides structured logging throughout the application
	Logger slog.Logger

	// Pool provides database connection pooling for PostgreSQL
	Pool *pgxpool.Pool

	// Config holds all application configuration loaded from environment
	Config *Config
}

// Logger interface for dependency injection in middleware and services.
// This allows components to be testable with mock loggers.
type Logger interface {
	Debug(msg string, args ...any)
	Info(msg string, args ...any)
	Warn(msg string, args ...any)
	Error(msg string, args ...any)
}
