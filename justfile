help:
  @just --list

db_up:
  docker-compose up -d db

sqlgen:
  cd backend/pkg/db && sqlc generate

tidy:
  cd backend && go mod tidy

run:
  cd backend && go run main.go
