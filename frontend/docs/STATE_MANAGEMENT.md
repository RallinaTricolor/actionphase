# Unified State Management System

This document describes the unified state management system for the ActionPhase frontend, which consolidates user identity, game context, and permissions management.

## Overview

The system provides three main components:

1. **Enhanced AuthContext** - Manages authentication and current user data
2. **GameContext** - Manages game-specific state and permissions
3. **Custom Hooks** - Provides granular access to specific functionality

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                          │
│                      (AuthProvider)                         │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Game-Specific Routes                     │ │
│  │              (GameProvider - Optional)                │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │           Components                             │ │
│  │  │  • Can use useAuth() anywhere                    │ │
│  │  │  • Can use useGameContext() if wrapped          │ │
│  │  │  • Can use hooks (useGamePermissions, etc.)     │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 1. Enhanced AuthContext

### Location
`frontend/src/contexts/AuthContext.tsx`

### Features
- Automatically fetches current user data from `/api/v1/auth/me` on mount
- Stores complete user object (id, username, email)
- Provides authentication state management
- Handles login, registration, and logout
- Maintains backward compatibility with existing code

### Usage

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const {
    currentUser,      // User object with id, username, email
    isAuthenticated,  // boolean
    isLoading,        // Auth action in progress
    isCheckingAuth,   // Initial auth check
    login,            // Login function
    register,         // Register function
    logout,           // Logout function
    error             // Any auth errors
  } = useAuth();

  // User ID is immediately available after login
  console.log('Current user ID:', currentUser?.id);
  console.log('Current username:', currentUser?.username);

  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {currentUser?.username}!</p>
      ) : (
        <p>Please log in</p>
      )}
    </div>
  );
}
```

### Setup

Wrap your application with `AuthProvider`:

```typescript
// In App.tsx or main entry point
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Your app routes */}
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

## 2. GameContext

### Location
`frontend/src/contexts/GameContext.tsx`

### Features
- Provides game details, participants, and user's characters
- Automatically calculates user's role (gm, player, co_gm, audience, none)
- Provides permission flags (isGM, isParticipant, canEditGame)
- Includes character ownership checker
- Uses React Query for efficient caching

### Usage

```typescript
import { GameProvider, useGameContext } from '../contexts/GameContext';

function GameDetailsPage({ gameId }: { gameId: number }) {
  return (
    <GameProvider gameId={gameId}>
      <GameContent />
    </GameProvider>
  );
}

function GameContent() {
  const {
    gameId,           // number
    game,             // GameWithDetails | null
    participants,     // GameParticipant[]
    userRole,         // 'gm' | 'player' | 'co_gm' | 'audience' | 'none'
    isGM,             // boolean
    isParticipant,    // boolean (player or co_gm)
    canEditGame,      // boolean
    userCharacters,   // Character[] - User's controllable characters
    isUserCharacter,  // (characterId: number) => boolean
    isLoadingGame,    // boolean
    isLoadingParticipants, // boolean
    isLoadingCharacters,   // boolean
    refetchGameData,  // () => Promise<void>
  } = useGameContext();

  return (
    <div>
      {isGM && <button onClick={editGame}>Edit Game</button>}
      {isParticipant && <p>You are a participant</p>}

      {userCharacters.map(char => (
        <div key={char.id}>{char.name}</div>
      ))}
    </div>
  );
}
```

### Optional Usage

For components that might be used outside of a GameContext:

```typescript
import { useOptionalGameContext } from '../contexts/GameContext';

function MyComponent() {
  const gameContext = useOptionalGameContext();

  if (gameContext) {
    // Use game context
    const { isGM } = gameContext;
  } else {
    // Handle case where no game context
  }
}
```

## 3. Custom Hooks

### useGamePermissions

**Location:** `frontend/src/hooks/useGamePermissions.ts`

Get game permissions without requiring a GameContext. Useful for components that need game info but aren't wrapped in GameProvider.

```typescript
import { useGamePermissions } from '../hooks/useGamePermissions';

function MyComponent({ gameId }: { gameId: number }) {
  const {
    game,              // GameWithDetails | null
    participants,      // GameParticipant[]
    isLoading,         // boolean
    userRole,          // 'gm' | 'player' | 'co_gm' | 'audience' | 'none'
    isGM,              // boolean
    isCoGM,            // boolean
    isPlayer,          // boolean
    isAudience,        // boolean
    isParticipant,     // boolean (player or co_gm)
    canEditGame,       // boolean
    canManagePhases,   // boolean (GM or co-GM)
    canViewAllActions, // boolean (GM or co-GM)
    currentUserId,     // number | null
  } = useGamePermissions(gameId);

  return (
    <div>
      {isGM && <AdminPanel />}
      {canManagePhases && <PhaseControls />}
    </div>
  );
}
```

### useUserCharacters

**Location:** `frontend/src/hooks/useUserCharacters.ts`

Fetch the current user's controllable characters for a game.

```typescript
import { useUserCharacters } from '../hooks/useUserCharacters';

function CharacterSelector({ gameId }: { gameId: number }) {
  const {
    characters,  // Character[]
    isLoading,   // boolean
    error,       // Error | null
    refetch      // () => Promise<void>
  } = useUserCharacters(gameId);

  if (isLoading) return <Spinner />;
  if (error) return <Error error={error} />;

  return (
    <select>
      {characters.map(char => (
        <option key={char.id} value={char.id}>
          {char.name}
        </option>
      ))}
    </select>
  );
}
```

### useCharacterOwnership

**Location:** `frontend/src/hooks/useCharacterOwnership.ts`

Efficient character ownership checking.

```typescript
import { useCharacterOwnership } from '../hooks/useCharacterOwnership';

function CharacterCard({
  gameId,
  characterId
}: {
  gameId: number;
  characterId: number;
}) {
  const {
    isUserCharacter,   // (characterId: number) => boolean
    userCharacterIds,  // Set<number>
    isLoading          // boolean
  } = useCharacterOwnership(gameId);

  const canEdit = isUserCharacter(characterId);

  return (
    <div>
      <h3>Character</h3>
      {canEdit && <button>Edit</button>}
    </div>
  );
}
```

## Migration Guide

### From Old useAuth Hook

**Before:**
```typescript
// Old hook from frontend/src/hooks/useAuth.ts
const { isAuthenticated, login, register, logout } = useAuth();
```

**After:**
```typescript
// New context-based approach
import { useAuth } from '../contexts/AuthContext';

const {
  currentUser,      // NEW: Access to user data
  isAuthenticated,
  login,
  register,
  logout
} = useAuth();

// Now you can access user ID immediately
const userId = currentUser?.id;
```

### From Manual User ID Fetching

**Before:**
```typescript
const [currentUserId, setCurrentUserId] = useState<number | null>(null);

useEffect(() => {
  const fetchCurrentUser = async () => {
    try {
      const response = await apiClient.getCurrentUser();
      setCurrentUserId(response.data.id);
    } catch (err) {
      console.error('Failed to fetch current user:', err);
    }
  };
  fetchCurrentUser();
}, []);
```

**After:**
```typescript
import { useAuth } from '../contexts/AuthContext';

const { currentUser } = useAuth();
const currentUserId = currentUser?.id;

// That's it! No manual fetching needed
```

### From Manual Permission Checks

**Before:**
```typescript
const [isGM, setIsGM] = useState(false);
const [isParticipant, setIsParticipant] = useState(false);

useEffect(() => {
  if (game && currentUserId) {
    setIsGM(game.gm_user_id === currentUserId);
    setIsParticipant(participants.some(p => p.user_id === currentUserId));
  }
}, [game, currentUserId, participants]);
```

**After (Option 1: Using GameContext):**
```typescript
// Wrap component in GameProvider
<GameProvider gameId={gameId}>
  <MyComponent />
</GameProvider>

// In MyComponent:
const { isGM, isParticipant } = useGameContext();
```

**After (Option 2: Using Hook):**
```typescript
const { isGM, isParticipant } = useGamePermissions(gameId);
```

### From Manual Character Ownership Checks

**Before:**
```typescript
const { data: controllableCharacters } = useQuery({
  queryKey: ['controllableCharacters', gameId],
  queryFn: () => apiClient.getUserControllableCharacters(gameId)
});

const isUserCharacter = (characterId: number) => {
  return controllableCharacters?.some(c => c.id === characterId) || false;
};
```

**After:**
```typescript
const { isUserCharacter } = useCharacterOwnership(gameId);

// Use it
if (isUserCharacter(characterId)) {
  // User owns this character
}
```

## Best Practices

### 1. Use GameContext for Game-Focused Pages

Wrap entire game detail pages with GameProvider:

```typescript
function GameDetailsPage({ gameId }: { gameId: number }) {
  return (
    <GameProvider gameId={gameId}>
      <GameHeader />
      <GameTabs />
      <GameContent />
    </GameProvider>
  );
}
```

### 2. Use Hooks for Smaller Components

For components that need specific functionality without full context:

```typescript
function CharacterSelector({ gameId }: { gameId: number }) {
  // Lighter weight than GameContext
  const { characters } = useUserCharacters(gameId);

  return <select>{/* ... */}</select>;
}
```

### 3. Leverage React Query Caching

All hooks use React Query with 30-second stale time. Multiple components requesting the same data won't trigger duplicate API calls.

```typescript
// Component A
const { game } = useGamePermissions(gameId);

// Component B (same gameId)
const { game } = useGamePermissions(gameId);
// ↑ This uses cached data, no new API call!
```

### 4. Handle Loading States

Always check loading states before rendering:

```typescript
const { currentUser, isCheckingAuth } = useAuth();

if (isCheckingAuth) {
  return <Spinner />;
}

return <div>Welcome, {currentUser?.username}!</div>;
```

### 5. Use Optional Context for Reusable Components

Components that might be used both inside and outside a GameContext:

```typescript
function CharacterCard({ characterId }: { characterId: number }) {
  const gameContext = useOptionalGameContext();

  // Graceful fallback
  const canEdit = gameContext?.isUserCharacter(characterId) ?? false;

  return <div>{/* ... */}</div>;
}
```

## Common Patterns

### Pattern: Role-Based Rendering

```typescript
function GameControls() {
  const { userRole, isGM } = useGameContext();

  return (
    <div>
      {isGM && <GMControls />}
      {userRole === 'player' && <PlayerControls />}
      {userRole === 'audience' && <AudienceView />}
    </div>
  );
}
```

### Pattern: Character Management

```typescript
function CharacterList() {
  const { userCharacters, isUserCharacter } = useGameContext();

  return (
    <div>
      {userCharacters.map(char => (
        <CharacterCard
          key={char.id}
          character={char}
          canEdit={true} // User owns all userCharacters
        />
      ))}
    </div>
  );
}
```

### Pattern: Permission-Based Actions

```typescript
function GameActions() {
  const { canEditGame, canManagePhases } = useGamePermissions(gameId);

  return (
    <div>
      {canEditGame && <button>Edit Game</button>}
      {canManagePhases && <button>Manage Phases</button>}
    </div>
  );
}
```

## Debugging

All contexts and hooks include debug logging:

```typescript
// In browser console:
// [AuthContext] Context state: { isAuthenticated: true, hasUser: true, userId: 123 }
// [GameContext] Context state: { gameId: 1, userRole: 'gm', isGM: true }
// [useUserCharacters] Characters loaded: [...]
```

Enable these logs to troubleshoot state issues.

## Performance Considerations

1. **React Query Caching**: All data is cached for 30 seconds, reducing API calls
2. **Memoization**: Permission flags and checkers are memoized
3. **Conditional Fetching**: Queries only run when conditions are met (e.g., user is authenticated)
4. **Granular Updates**: Only affected components re-render when data changes

## TypeScript Support

All contexts and hooks are fully typed:

```typescript
interface AuthContextValue {
  currentUser: User | null;
  isAuthenticated: boolean;
  // ...
}

type UserGameRole = 'gm' | 'player' | 'co_gm' | 'audience' | 'none';

interface GamePermissions {
  userRole: UserGameRole;
  isGM: boolean;
  // ...
}
```

Use TypeScript's autocomplete to explore available properties.

## Error Handling

All hooks gracefully handle errors:

```typescript
const { currentUser, error } = useAuth();

if (error) {
  return <ErrorDisplay error={error} />;
}
```

Errors are logged to console with context-specific prefixes.

## Next Steps

1. Update existing components to use new contexts (see Migration Guide)
2. Remove duplicated user ID fetching logic
3. Remove manual permission calculations
4. Test thoroughly in all game states
5. Monitor performance and adjust cache times if needed

## Related Files

- `frontend/src/contexts/AuthContext.tsx` - Enhanced auth context
- `frontend/src/contexts/GameContext.tsx` - Game context
- `frontend/src/hooks/useGamePermissions.ts` - Permissions hook
- `frontend/src/hooks/useUserCharacters.ts` - User characters hook
- `frontend/src/hooks/useCharacterOwnership.ts` - Ownership checker hook
- `frontend/src/hooks/useAuth.ts` - Original auth hook (deprecated, remove after migration)
- `frontend/src/types/auth.ts` - Auth type definitions
