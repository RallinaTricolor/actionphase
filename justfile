help:
  @just --list

sqlgen:
  cd backend/pkg/db && sqlc generate

tidy:
  cd backend && go mod tidy
