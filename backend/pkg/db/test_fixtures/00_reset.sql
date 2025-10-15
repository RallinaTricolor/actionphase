-- Reset Test Data
-- This script removes all test data while preserving the schema

BEGIN;

-- Delete in reverse dependency order
DELETE FROM phase_transitions WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM action_results WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM action_submissions WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM character_data WHERE character_id IN (SELECT id FROM characters WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com')));
DELETE FROM characters WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM game_phases WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM game_participants WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM game_applications WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com');
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com');
DELETE FROM users WHERE email LIKE 'test_%@example.com';

COMMIT;
