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

just migrate:
     migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/database?sslmode=disable" up

 just rollback:
     migrate -source file://backend/pkg/db/migrations -database "postgres://postgres:example@localhost:5432/database?sslmode=disable" down
