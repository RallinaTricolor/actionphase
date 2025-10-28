-- Create Test Users
-- Password for all: testpassword123
-- Hashed with bcrypt cost 10
--
-- Users are created for each worker (0-5) to support parallel test execution
-- Worker-specific users prevent authentication conflicts

BEGIN;

-- Worker 0 users (original test users for backward compatibility)
INSERT INTO users (username, email, password, created_at)
VALUES
  ('TestGM', 'test_gm@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer1', 'test_player1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer2', 'test_player2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer3', 'test_player3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer4', 'test_player4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer5', 'test_player5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestAudience', 'test_audience@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW());

-- Worker 1 users
INSERT INTO users (username, email, password, created_at)
VALUES
  ('TestGM_1', 'test_gm_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer1_1', 'test_player1_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer2_1', 'test_player2_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer3_1', 'test_player3_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer4_1', 'test_player4_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer5_1', 'test_player5_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestAudience_1', 'test_audience_1@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW());

-- Worker 2 users
INSERT INTO users (username, email, password, created_at)
VALUES
  ('TestGM_2', 'test_gm_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer1_2', 'test_player1_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer2_2', 'test_player2_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer3_2', 'test_player3_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer4_2', 'test_player4_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer5_2', 'test_player5_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestAudience_2', 'test_audience_2@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW());

-- Worker 3 users
INSERT INTO users (username, email, password, created_at)
VALUES
  ('TestGM_3', 'test_gm_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer1_3', 'test_player1_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer2_3', 'test_player2_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer3_3', 'test_player3_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer4_3', 'test_player4_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer5_3', 'test_player5_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestAudience_3', 'test_audience_3@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW());

-- Worker 4 users
INSERT INTO users (username, email, password, created_at)
VALUES
  ('TestGM_4', 'test_gm_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer1_4', 'test_player1_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer2_4', 'test_player2_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer3_4', 'test_player3_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer4_4', 'test_player4_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer5_4', 'test_player5_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestAudience_4', 'test_audience_4@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW());

-- Worker 5 users
INSERT INTO users (username, email, password, created_at)
VALUES
  ('TestGM_5', 'test_gm_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer1_5', 'test_player1_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer2_5', 'test_player2_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer3_5', 'test_player3_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer4_5', 'test_player4_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestPlayer5_5', 'test_player5_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW()),
  ('TestAudience_5', 'test_audience_5@example.com', '$2a$10$7LH6DSL0M6Dln50UDtKzY.rs7J3a7S/gAZVONnk6QZvouo0pUx/..', NOW());

COMMIT;
