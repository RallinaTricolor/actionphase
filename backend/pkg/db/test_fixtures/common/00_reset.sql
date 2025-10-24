-- Reset Test Data
-- This script removes all test data while preserving the schema

BEGIN;

-- Delete in reverse dependency order

-- Clean up messaging and notification tables (added to fix E2E test pollution)
DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com')));
DELETE FROM message_recipients WHERE message_id IN (SELECT id FROM messages WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com')));
DELETE FROM messages WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM private_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com')));
DELETE FROM conversation_participants WHERE conversation_id IN (SELECT id FROM conversations WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com')));
DELETE FROM conversations WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM notifications WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));

-- Clean up game-related tables
DELETE FROM phase_transitions WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM action_results WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM action_submissions WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM npc_assignments WHERE character_id IN (SELECT id FROM characters WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com')));
DELETE FROM character_data WHERE character_id IN (SELECT id FROM characters WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com')));
DELETE FROM characters WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM game_phases WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM game_participants WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM game_applications WHERE game_id IN (SELECT id FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com'));
DELETE FROM games WHERE gm_user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com');

-- Clean up user-related tables
DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test_%@example.com');
DELETE FROM users WHERE email LIKE 'test_%@example.com';

COMMIT;
