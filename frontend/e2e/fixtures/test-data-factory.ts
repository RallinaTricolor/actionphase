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

/**
 * Generate unique credentials for a new test user
 */
export function generateTestUser(prefix: string = 'e2e_user') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);

  return {
    username: `${prefix}_${timestamp}_${random}`,
    email: `${prefix}_${timestamp}_${random}@test.example.com`,
    password: 'TestPassword123!',
  };
}

/**
 * Generate test game data
 */
export function generateTestGame(overrides?: Partial<TestGameData>): TestGameData {
  const timestamp = Date.now();

  return {
    title: `E2E Test Game ${timestamp}`,
    description: 'A test game created by E2E tests',
    genre: 'Test',
    max_players: 4,
    is_anonymous: false,
    ...overrides,
  };
}

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

/**
 * Generate test character data
 */
export function generateTestCharacter(gameId: number, overrides?: Partial<TestCharacterData>): TestCharacterData {
  const timestamp = Date.now();

  return {
    game_id: gameId,
    name: `Test Character ${timestamp}`,
    character_type: 'player_character',
    public_data: {
      description: 'A test character',
      appearance: 'Mysterious',
    },
    private_data: {
      notes: 'Test character notes',
    },
    ...overrides,
  };
}

export interface TestCharacterData {
  game_id: number;
  name: string;
  character_type: 'player_character' | 'npc_gm' | 'npc_player';
  public_data?: Record<string, any>;
  private_data?: Record<string, any>;
}

/**
 * Generate test post data
 */
export function generateTestPost(overrides?: Partial<TestPostData>): TestPostData {
  const timestamp = Date.now();

  return {
    title: `Test Post ${timestamp}`,
    content: 'This is a test post created by E2E tests.',
    is_published: true,
    ...overrides,
  };
}

export interface TestPostData {
  title: string;
  content: string;
  is_published?: boolean;
  character_id?: number;
}

/**
 * Generate test action submission data
 */
export function generateTestActionSubmission(overrides?: Partial<TestActionData>): TestActionData {
  return {
    content: 'This is a test action submission.',
    is_finalized: false,
    ...overrides,
  };
}

export interface TestActionData {
  content: string;
  is_finalized?: boolean;
}

/**
 * Generate test application message
 */
export function generateApplicationMessage(role: 'player' | 'audience' = 'player'): string {
  const messages = {
    player: [
      'I would love to join this game as a player!',
      'Excited to participate in this adventure!',
      'I have experience with this genre and would like to play.',
    ],
    audience: [
      'I would like to follow this game as an audience member.',
      'Interested in watching this story unfold!',
      'Would love to observe this game.',
    ],
  };

  const options = messages[role];
  return options[Math.floor(Math.random() * options.length)];
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

/**
 * Get a random item from an array
 */
export function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Sleep for a specified duration
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = initialDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError!;
}

// ============================================
// Test Data Validation
// ============================================

/**
 * Validate that a game has expected properties
 */
export function validateGameData(game: any, expectedProps: Partial<typeof FIXTURE_GAMES[keyof typeof FIXTURE_GAMES]>) {
  const errors: string[] = [];

  if (expectedProps.expectedState && game.state !== expectedProps.expectedState) {
    errors.push(`Expected state ${expectedProps.expectedState}, got ${game.state}`);
  }

  if (expectedProps.hasPhases === false && game.phases && game.phases.length > 0) {
    errors.push(`Expected no phases, but found ${game.phases.length}`);
  }

  if (expectedProps.previousPhaseCount !== undefined) {
    const actualCount = game.phases ? game.phases.length - 1 : 0; // Subtract active phase
    if (actualCount < expectedProps.previousPhaseCount) {
      errors.push(`Expected at least ${expectedProps.previousPhaseCount} previous phases, got ${actualCount}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
