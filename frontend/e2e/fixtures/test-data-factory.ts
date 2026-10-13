/**
 * Test Data Factory for E2E Tests
 *
 * Provides constants, helpers, and factory functions for creating
 * and managing test data in E2E tests.
 *
 * IMPORTANT: This assumes test fixtures have been loaded via:
 * ./backend/pkg/db/test_fixtures/apply_all.sh
 */

// ============================================
// Test Users
// ============================================

export const TEST_USERS = {
  GM: {
    username: 'TestGM',
    email: 'test_gm@example.com',
    password: 'testpassword123',
  },
  PLAYER_1: {
    username: 'TestPlayer1',
    email: 'test_player1@example.com',
    password: 'testpassword123',
  },
  PLAYER_2: {
    username: 'TestPlayer2',
    email: 'test_player2@example.com',
    password: 'testpassword123',
  },
  PLAYER_3: {
    username: 'TestPlayer3',
    email: 'test_player3@example.com',
    password: 'testpassword123',
  },
  PLAYER_4: {
    username: 'TestPlayer4',
    email: 'test_player4@example.com',
    password: 'testpassword123',
  },
  PLAYER_5: {
    username: 'TestPlayer5',
    email: 'test_player5@example.com',
    password: 'testpassword123',
  },
  AUDIENCE: {
    username: 'TestAudience',
    email: 'test_audience@example.com',
    password: 'testpassword123',
  },
} as const;

// ============================================
// Test Games (from fixtures)
// ============================================

/**
 * Fixture Game IDs
 *
 * NOTE: These IDs may change if fixtures are reset.
 * For E2E tests, prefer to search for games by title
 * or create new test-specific games.
 */
export const FIXTURE_GAMES = {
  // Game #1: Active Common Room phase
  COMMON_ROOM: {
    title: 'Shadows Over Innsmouth',
    expectedState: 'in_progress',
    expectedPhase: 'common_room',
  },
  // Game #2: Active Action phase with submissions
  ACTION_PHASE: {
    title: 'The Heist at Goldstone Bank',
    expectedState: 'in_progress',
    expectedPhase: 'action',
    hasActionSubmissions: true,
  },
  // Game #3: Active Results phase with published results
  RESULTS_PHASE: {
    title: 'Starfall Station',
    expectedState: 'in_progress',
    expectedPhase: 'results',
    hasPublishedResults: true,
  },
  // Game #4: Phase transition testing
  PHASE_TRANSITION: {
    title: 'Court of Shadows',
    expectedState: 'in_progress',
    expectedPhase: 'action',
  },
  // Game #5: Complex history (6 previous phases)
  COMPLEX_HISTORY: {
    title: 'The Dragon of Mount Krag',
    expectedState: 'in_progress',
    expectedPhase: 'common_room',
    previousPhaseCount: 6,
  },
  // Game #6: Pagination testing (11 previous phases)
  PAGINATION: {
    title: 'Chronicles of Westmarch',
    expectedState: 'in_progress',
    expectedPhase: 'results',
    previousPhaseCount: 11,
  },
  // Game #7: Recruiting state
  RECRUITING: {
    title: 'The Mystery of Blackwood Manor',
    expectedState: 'recruitment',
    hasPhases: false,
  },
  // Game #8: Paused state
  PAUSED: {
    title: 'On Hold: The Frozen North',
    expectedState: 'paused',
    previousPhaseCount: 4,
  },
  // Game #9: Completed state
  COMPLETED: {
    title: 'COMPLETED: Tales of the Arcane',
    expectedState: 'completed',
    previousPhaseCount: 9,
  },
  // Game #10: Private game
  PRIVATE: {
    title: 'Secret Campaign',
    expectedState: 'recruitment',
    isPublic: false,
  },
} as const;

// ============================================
// Factory Functions
// ============================================

export interface TestGameData {
  title: string;
  description: string;
  genre?: string;
  max_players?: number;
  start_date?: string;
  end_date?: string;
  recruitment_deadline?: string;
  is_anonymous?: boolean;
}

export interface TestCharacterData {
  game_id: number;
  name: string;
  character_type: 'player_character' | 'npc_gm' | 'npc_player';
  public_data?: Record<string, unknown>;
  private_data?: Record<string, unknown>;
}

export interface TestPostData {
  title: string;
  content: string;
  is_published?: boolean;
  character_id?: number;
}

export interface TestActionData {
  content: string;
  is_finalized?: boolean;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Wait for a specific condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs: number = 10000,
  intervalMs: number = 500
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return false;
}

// ============================================
// Test Data Validation
// ============================================
