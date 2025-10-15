-- Create Test Users
-- Password for all: testpassword123
-- Hashed with bcrypt cost 10

BEGIN;

-- Game Master
INSERT INTO users (username, email, password, created_at)
VALUES
  ('TestGM', 'test_gm@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW());

-- Players
INSERT INTO users (username, email, password, created_at)
VALUES
  ('TestPlayer1', 'test_player1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer2', 'test_player2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer3', 'test_player3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer4', 'test_player4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer5', 'test_player5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW());

-- Audience Member
INSERT INTO users (username, email, password, created_at)
VALUES
  ('TestAudience', 'test_audience@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW());

COMMIT;
