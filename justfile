help:
  @just --list

sqlgen:
  cd backend/pkg/db && sqlc generate
