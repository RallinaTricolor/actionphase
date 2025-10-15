# State Management Architecture Diagram

This document provides visual representations of the unified state management system architecture.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Application                             │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              QueryClientProvider (React Query)             │    │
│  │                                                            │    │
│  │  ┌──────────────────────────────────────────────────────┐ │    │
│  │  │              AuthProvider (Context)                  │ │    │
│  │  │                                                      │ │    │
│  │  │  • Fetches & stores current user                    │ │    │
│  │  │  • Manages authentication state                     │ │    │
│  │  │  • Provides user ID, username, email                │ │    │
│  │  │  • Available to ALL components                      │ │    │
│  │  │                                                      │ │    │
│  │  │  ┌────────────────────────────────────────────────┐ │ │    │
│  │  │  │         BrowserRouter (Routes)              │ │ │    │
│  │  │  │                                             │ │ │    │
│  │  │  │  ┌──────────────────────────────────────┐  │ │ │    │
│  │  │  │  │      Public Routes                   │  │ │ │    │
│  │  │  │  │  • Login, Register, Public Games     │  │ │ │    │
│  │  │  │  │  • Use useAuth() for state           │  │ │ │    │
│  │  │  │  └──────────────────────────────────────┘  │ │ │    │
│  │  │  │                                             │ │ │    │
│  │  │  │  ┌──────────────────────────────────────┐  │ │ │    │
│  │  │  │  │   Game-Specific Routes               │  │ │ │    │
│  │  │  │  │   (Wrapped with GameProvider)        │  │ │ │    │
│  │  │  │  │                                       │  │ │ │    │
│  │  │  │  │  ┌─────────────────────────────────┐ │  │ │ │    │
│  │  │  │  │  │   GameProvider (Context)        │ │  │ │ │    │
│  │  │  │  │  │                                 │ │  │ │ │    │
│  │  │  │  │  │  • Fetches game details        │ │  │ │ │    │
│  │  │  │  │  │  • Fetches participants        │ │  │ │ │    │
│  │  │  │  │  │  • Fetches user's characters   │ │  │ │ │    │
│  │  │  │  │  │  • Calculates permissions      │ │  │ │ │    │
│  │  │  │  │  │  • Provides role & helpers     │ │  │ │ │    │
│  │  │  │  │  │                                 │ │  │ │ │    │
│  │  │  │  │  │  ┌───────────────────────────┐ │ │  │ │ │    │
│  │  │  │  │  │  │  Game Page Components     │ │ │  │ │ │    │
│  │  │  │  │  │  │                           │ │ │  │ │ │    │
│  │  │  │  │  │  │  • Use useGameContext()   │ │ │  │ │ │    │
│  │  │  │  │  │  │  • Access game, role, etc │ │ │  │ │ │    │
│  │  │  │  │  │  │  • Check permissions      │ │ │  │ │ │    │
│  │  │  │  │  │  └───────────────────────────┘ │ │  │ │ │    │
│  │  │  │  │  └─────────────────────────────────┘ │  │ │ │    │
│  │  │  │  └──────────────────────────────────────┘  │ │ │    │
│  │  │  │                                             │ │ │    │
│  │  │  │  ┌──────────────────────────────────────┐  │ │ │    │
│  │  │  │  │   Other Routes                       │  │ │ │    │
│  │  │  │  │   (Use hooks without context)        │  │ │ │    │
│  │  │  │  │                                       │  │ │ │    │
│  │  │  │  │  • Use useGamePermissions(gameId)    │  │ │ │    │
│  │  │  │  │  • Use useUserCharacters(gameId)     │  │ │ │    │
│  │  │  │  │  • Use useCharacterOwnership(gameId) │  │ │ │    │
│  │  │  │  └──────────────────────────────────────┘  │ │ │    │
│  │  │  └────────────────────────────────────────────┘ │ │    │
│  │  └──────────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Authentication Flow                         │
└─────────────────────────────────────────────────────────────────┘

User Login
    │
    ├──> AuthContext.login()
    │       │
    │       ├──> API: POST /api/v1/auth/login
    │       │       │
    │       │       └──> Returns JWT token
    │       │
    │       ├──> Store token in localStorage
    │       │
    │       ├──> Set isAuthenticated = true
    │       │
    │       └──> Trigger user data fetch
    │               │
    │               ├──> API: GET /api/v1/auth/me
    │               │       │
    │               │       └──> Returns { id, username, email }
    │               │
    │               └──> Set currentUser in context
    │
    └──> All components can now access currentUser via useAuth()


┌─────────────────────────────────────────────────────────────────┐
│                      Game Context Flow                           │
└─────────────────────────────────────────────────────────────────┘

<GameProvider gameId={123}>
    │
    ├──> Fetch game details
    │       │
    │       └──> API: GET /api/v1/games/123/details
    │               │
    │               └──> Cached by React Query (30s)
    │
    ├──> Fetch participants
    │       │
    │       └──> API: GET /api/v1/games/123/participants
    │               │
    │               └──> Cached by React Query (30s)
    │
    ├──> Fetch user's characters
    │       │
    │       └──> API: GET /api/v1/games/123/characters/controllable
    │               │
    │               └──> Cached by React Query (30s)
    │
    ├──> Calculate user role
    │       │
    │       ├──> If user_id === gm_user_id → role = 'gm'
    │       ├──> Else find in participants
    │       └──> Default to 'none'
    │
    ├──> Calculate permissions
    │       │
    │       ├──> isGM = (role === 'gm')
    │       ├──> isParticipant = (role in ['player', 'co_gm'])
    │       └──> canEditGame = isGM
    │
    └──> Provide context to children
            │
            └──> Components use useGameContext()
                    │
                    ├──> Access game data
                    ├──> Check permissions
                    └──> Check character ownership
```

## Component Usage Patterns

```
┌─────────────────────────────────────────────────────────────────┐
│                     Pattern 1: Full Context                      │
│                  (Recommended for game pages)                    │
└─────────────────────────────────────────────────────────────────┘

function GameDetailsPage({ gameId }) {
  return (
    <GameProvider gameId={gameId}>    ← Wrap entire page
      <GameHeader />
      <GameTabs />
      <GameContent />
    </GameProvider>
  );
}

function GameContent() {
  const {                              ← All child components
    game,                                 can access context
    isGM,
    userCharacters,
    isUserCharacter
  } = useGameContext();

  return (
    <div>
      {isGM && <AdminPanel />}
      <CharacterList chars={userCharacters} />
    </div>
  );
}


┌─────────────────────────────────────────────────────────────────┐
│                  Pattern 2: Hooks Without Context                │
│              (Recommended for smaller components)                │
└─────────────────────────────────────────────────────────────────┘

function GameCard({ gameId }) {
  // No GameProvider needed!
  const { isGM, game } = useGamePermissions(gameId);
  const { characters } = useUserCharacters(gameId);

  return (
    <div>
      <h3>{game?.title}</h3>
      {isGM && <GMBadge />}
      <p>{characters.length} characters</p>
    </div>
  );
}


┌─────────────────────────────────────────────────────────────────┐
│                  Pattern 3: Mixed Approach                       │
│         (Use context when available, hook otherwise)             │
└─────────────────────────────────────────────────────────────────┘

function CharacterCard({ gameId, characterId }) {
  // Try to use context first
  const gameContext = useOptionalGameContext();

  // Fall back to hook if no context
  const { isUserCharacter: hookChecker } = gameContext
    ? { isUserCharacter: gameContext.isUserCharacter }
    : useCharacterOwnership(gameId);

  const canEdit = hookChecker(characterId);

  return (
    <div>
      <h3>Character</h3>
      {canEdit && <EditButton />}
    </div>
  );
}
```

## React Query Cache Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Query Cache Flow                        │
└─────────────────────────────────────────────────────────────────┘

Component A requests game details
    │
    ├──> Check cache: ['gameDetails', 123]
    │       │
    │       ├──> Cache MISS → Fetch from API
    │       │       │
    │       │       └──> Store in cache (staleTime: 30s)
    │       │
    │       └──> Cache HIT → Return cached data
    │
    └──> Component A receives data


Component B requests same game details (within 30s)
    │
    ├──> Check cache: ['gameDetails', 123]
    │       │
    │       └──> Cache HIT → Return cached data instantly
    │                        (NO API call!)
    │
    └──> Component B receives data


After 30 seconds (data is stale)
    │
    ├──> Background refetch triggered
    │       │
    │       └──> API: GET /api/v1/games/123/details
    │               │
    │               └──> Update cache with fresh data
    │
    └──> All components re-render with new data


Manual refetch (after mutation)
    │
    ├──> Call refetchGameData()
    │       │
    │       ├──> Invalidate cache: ['gameDetails', 123]
    │       ├──> Invalidate cache: ['gameParticipants', 123]
    │       └──> Invalidate cache: ['userControllableCharacters', 123]
    │
    └──> All affected queries refetch automatically
```

## Permission Calculation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Permission Calculation                        │
└─────────────────────────────────────────────────────────────────┘

GameContext receives:
  • currentUser.id = 456
  • game.gm_user_id = 123
  • participants = [
      { user_id: 456, role: 'player' },
      { user_id: 789, role: 'audience' }
    ]

Step 1: Determine Role
    │
    ├──> Is currentUser.id === game.gm_user_id?
    │    (456 === 123)
    │    NO
    │
    ├──> Find user in participants
    │    participants.find(p => p.user_id === 456)
    │    FOUND: { user_id: 456, role: 'player' }
    │
    └──> userRole = 'player'

Step 2: Calculate Permission Flags
    │
    ├──> isGM = (userRole === 'gm')
    │    = (player === 'gm')
    │    = false
    │
    ├──> isParticipant = (userRole in ['player', 'co_gm'])
    │    = ('player' in ['player', 'co_gm'])
    │    = true
    │
    ├──> canEditGame = isGM
    │    = false
    │
    └──> canManagePhases = (isGM || isCoGM)
         = (false || false)
         = false

Step 3: Provide to Components
    │
    └──> {
           userRole: 'player',
           isGM: false,
           isParticipant: true,
           canEditGame: false,
           ...
         }
```

## Character Ownership Check Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  Character Ownership Checking                    │
└─────────────────────────────────────────────────────────────────┘

GameContext/Hook fetches user's characters:
  userCharacters = [
    { id: 10, name: 'Hero' },
    { id: 15, name: 'Sidekick' },
    { id: 20, name: 'NPC-1' }
  ]

Step 1: Create Set for O(1) Lookup
    │
    └──> userCharacterIds = Set([10, 15, 20])

Step 2: Memoize Checker Function
    │
    └──> isUserCharacter = (characterId) => {
           return userCharacterIds.has(characterId);
         }

Step 3: Component Uses Checker
    │
    ├──> Check character 10
    │    isUserCharacter(10) → userCharacterIds.has(10) → true
    │
    ├──> Check character 15
    │    isUserCharacter(15) → userCharacterIds.has(15) → true
    │
    └──> Check character 99
         isUserCharacter(99) → userCharacterIds.has(99) → false

Performance: O(1) lookup time regardless of character count!
```

## Error Handling Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Error Handling                              │
└─────────────────────────────────────────────────────────────────┘

Authentication Error:
    │
    ├──> Login fails
    │       │
    │       ├──> Catch error in mutation
    │       ├──> Set error state in AuthContext
    │       └──> Component shows error message
    │
    └──> User can retry

Game Data Fetch Error:
    │
    ├──> API call fails
    │       │
    │       ├──> React Query retries (1 time)
    │       │       │
    │       │       └──> Still fails
    │       │
    │       ├──> Set error state in query
    │       └──> Component receives error
    │
    └──> Component shows error UI with retry button

Token Refresh Error:
    │
    ├──> Access token expired
    │       │
    │       ├──> API returns 401
    │       ├──> Interceptor catches 401
    │       │       │
    │       │       └──> Try to refresh token
    │       │               │
    │       │               ├──> Refresh succeeds → Retry original request
    │       │               │
    │       │               └──> Refresh fails
    │       │                       │
    │       │                       ├──> Clear auth state
    │       │                       ├──> Remove token
    │       │                       └──> Redirect to login
    │       │
    │       └──> User must login again
    │
    └──> Auth state cleared
```

## State Update Propagation

```
┌─────────────────────────────────────────────────────────────────┐
│                    State Update Flow                             │
└─────────────────────────────────────────────────────────────────┘

User approves a character:
    │
    ├──> Component calls mutation
    │       │
    │       └──> API: POST /api/v1/characters/123/approve
    │               │
    │               └──> Success
    │
    ├──> Invalidate related queries
    │       │
    │       ├──> queryClient.invalidateQueries(['gameCharacters', gameId])
    │       └──> queryClient.invalidateQueries(['userControllableCharacters', gameId])
    │
    ├──> React Query refetches stale queries
    │       │
    │       ├──> All components using ['gameCharacters', gameId]
    │       │    receive updated data
    │       │
    │       └──> All components using ['userControllableCharacters', gameId]
    │            receive updated data
    │
    └──> UI updates automatically
            │
            ├──> Character list re-renders
            ├──> Ownership badges update
            └──> Permission checks recalculate
```

## Summary of Data Sources

```
┌─────────────────────────────────────────────────────────────────┐
│                      Data Source Map                             │
└─────────────────────────────────────────────────────────────────┘

AuthContext provides:
  ├──> currentUser (from GET /api/v1/auth/me)
  │    ├──> id: number
  │    ├──> username: string
  │    └──> email: string
  │
  ├──> isAuthenticated (derived from token presence)
  │
  └──> auth methods (login, register, logout)

GameContext provides:
  ├──> game (from GET /api/v1/games/:id/details)
  │    ├──> id, title, description
  │    ├──> gm_user_id, gm_username
  │    ├──> state, genre, dates
  │    └──> current_players, max_players
  │
  ├──> participants (from GET /api/v1/games/:id/participants)
  │    ├──> Array of participant objects
  │    └──> Each has: user_id, role, status
  │
  ├──> userCharacters (from GET /api/v1/games/:id/characters/controllable)
  │    ├──> Array of character objects
  │    └──> Only characters user controls
  │
  └──> Derived/Calculated:
       ├──> userRole (calculated from game + participants)
       ├──> isGM (calculated from userRole)
       ├──> isParticipant (calculated from userRole)
       ├──> canEditGame (calculated from isGM)
       └──> isUserCharacter (function using userCharacters)
```

## Architecture Principles

1. **Single Source of Truth**
   - User data in AuthContext
   - Game data in GameContext or React Query cache
   - No duplicate state

2. **Lazy Loading**
   - Data fetched only when needed
   - Queries enabled conditionally
   - Components render before data loads

3. **Caching Strategy**
   - 30-second stale time for game data
   - 5-minute stale time for user data
   - Automatic background refetching

4. **Permission Calculation**
   - Calculated once in context
   - Memoized to prevent recalculation
   - Shared across all components

5. **Error Resilience**
   - Graceful error handling at every level
   - Retry logic for transient failures
   - User-friendly error messages

6. **Performance Optimization**
   - React Query prevents duplicate fetches
   - Memoization prevents unnecessary calculations
   - Set-based lookups for O(1) performance
   - Selective re-rendering with React.memo

This architecture provides a scalable, maintainable, and performant state management solution for the ActionPhase frontend.
