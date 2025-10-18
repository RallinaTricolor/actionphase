/**
 * Test Users for E2E Tests
 *
 * These users correspond to the test fixtures in backend/pkg/db/test_fixtures/01_users.sql
 * All passwords are: testpassword123
 *
 * IMPORTANT: Usernames are case-sensitive and use PascalCase (TestGM, TestPlayer1, etc.)
 */

export const TEST_USERS = {
  GM: {
    username: 'TestGM',
    email: 'test_gm@example.com',
    password: 'testpassword123',
    role: 'Game Master' as const,
  },
  PLAYER_1: {
    username: 'TestPlayer1',
    email: 'test_player1@example.com',
    password: 'testpassword123',
    role: 'Player' as const,
  },
  PLAYER_2: {
    username: 'TestPlayer2',
    email: 'test_player2@example.com',
    password: 'testpassword123',
    role: 'Player' as const,
  },
  PLAYER_3: {
    username: 'TestPlayer3',
    email: 'test_player3@example.com',
    password: 'testpassword123',
    role: 'Player' as const,
  },
  PLAYER_4: {
    username: 'TestPlayer4',
    email: 'test_player4@example.com',
    password: 'testpassword123',
    role: 'Player' as const,
  },
  PLAYER_5: {
    username: 'TestPlayer5',
    email: 'test_player5@example.com',
    password: 'testpassword123',
    role: 'Player' as const,
  },
  AUDIENCE: {
    username: 'TestAudience',
    email: 'test_audience@example.com',
    password: 'testpassword123',
    role: 'Audience' as const,
  },
} as const;

export type TestUser = typeof TEST_USERS[keyof typeof TEST_USERS];
