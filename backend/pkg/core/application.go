package core

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
)

type App struct {
	Logger slog.Logger
	Pool   *pgxpool.Pool
}
