# State Management Quick Reference

Quick reference for common state management patterns in ActionPhase.

## Import Statements

```typescript
// Enhanced Auth Context
import { useAuth } from '../contexts/AuthContext';

// Game Context
import { GameProvider, useGameContext, useOptionalGameContext } from '../contexts/GameContext';

// Custom Hooks
import { useGamePermissions } from '../hooks/useGamePermissions';
import { useUserCharacters } from '../hooks/useUserCharacters';
import { useCharacterOwnership } from '../hooks/useCharacterOwnership';
```

## Common Patterns

### Get Current User

```typescript
const { currentUser, isAuthenticated } = useAuth();

// Access user properties
const userId = currentUser?.id;
const username = currentUser?.username;
const email = currentUser?.email;
```

### Check User Role in Game

```typescript
// Option 1: Using GameContext (inside GameProvider)
const { userRole, isGM, isParticipant } = useGameContext();

// Option 2: Using hook (anywhere)
const { userRole, isGM, isParticipant } = useGamePermissions(gameId);
```

### Get User's Characters

```typescript
// Option 1: Using GameContext
const { userCharacters } = useGameContext();

// Option 2: Using hook
const { characters } = useUserCharacters(gameId);
```

### Check Character Ownership

```typescript
// Option 1: Using GameContext
const { isUserCharacter } = useGameContext();
if (isUserCharacter(characterId)) {
  // User owns this character
}

// Option 2: Using hook
const { isUserCharacter } = useCharacterOwnership(gameId);
if (isUserCharacter(characterId)) {
  // User owns this character
}
```

### Conditional Rendering by Role

```typescript
const { isGM, isParticipant, userRole } = useGameContext();

return (
  <div>
    {isGM && <GMControls />}
    {isParticipant && <PlayerControls />}
    {userRole === 'audience' && <AudienceView />}
  </div>
);
```

### Loading States

```typescript
// Auth loading
const { isCheckingAuth } = useAuth();

// Game loading
const { isLoadingGame, isLoadingParticipants } = useGameContext();

// Combined
if (isCheckingAuth || isLoadingGame) {
  return <Spinner />;
}
```

### Error Handling

```typescript
const { error } = useAuth();

if (error) {
  return <ErrorDisplay message={error.message} />;
}
```

### Refetch Data

```typescript
// Refetch all game data
const { refetchGameData } = useGameContext();
await refetchGameData();

// Refetch user characters
const { refetch } = useUserCharacters(gameId);
await refetch();
```

## Component Patterns

### Authenticated Component

```typescript
function MyComponent() {
  const { currentUser, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <div>Welcome, {currentUser?.username}!</div>;
}
```

### Game Page with Context

```typescript
function GamePage({ gameId }: { gameId: number }) {
  return (
    <GameProvider gameId={gameId}>
      <GameContent />
    </GameProvider>
  );
}

function GameContent() {
  const { game, isGM, userCharacters } = useGameContext();

  return (
    <div>
      <h1>{game?.title}</h1>
      {isGM && <EditButton />}
      <CharacterList characters={userCharacters} />
    </div>
  );
}
```

### Component with Optional Context

```typescript
function CharacterCard({ characterId }: { characterId: number }) {
  const gameContext = useOptionalGameContext();
  const canEdit = gameContext?.isUserCharacter(characterId) ?? false;

  return (
    <div>
      <h3>Character</h3>
      {canEdit && <EditButton />}
    </div>
  );
}
```

### Component Using Hooks

```typescript
function GameCard({ gameId }: { gameId: number }) {
  const { isGM, game } = useGamePermissions(gameId);
  const { characters } = useUserCharacters(gameId);

  return (
    <div>
      <h3>{game?.title}</h3>
      {isGM && <GMBadge />}
      <p>Your characters: {characters.length}</p>
    </div>
  );
}
```

## Permission Checks

### Simple Permission Check

```typescript
const { canEditGame } = useGameContext();

if (canEditGame) {
  // Allow editing
}
```

### Multiple Permission Checks

```typescript
const { isGM, isCoGM, isPlayer, canManagePhases } = useGamePermissions(gameId);

if (isGM || isCoGM) {
  // GM or Co-GM actions
}

if (canManagePhases) {
  // Phase management
}

if (isPlayer) {
  // Player-specific actions
}
```

### Role-Specific Rendering

```typescript
const { userRole } = useGameContext();

const roleMap = {
  gm: <GMDashboard />,
  co_gm: <CoGMDashboard />,
  player: <PlayerDashboard />,
  audience: <AudienceView />,
  none: <AccessDenied />
};

return roleMap[userRole];
```

## React Query Integration

### Query Keys Used

```typescript
// Auth
['auth'] - Authentication state
['currentUser'] - Current user data

// Game
['gameDetails', gameId] - Game details
['gameParticipants', gameId] - Participants
['userControllableCharacters', gameId] - User's characters
['currentPhase', gameId] - Current phase
['gameCharacters', gameId] - All characters
```

### Invalidate Queries

```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// Invalidate game data
await queryClient.invalidateQueries({ queryKey: ['gameDetails', gameId] });

// Invalidate user characters
await queryClient.invalidateQueries({ queryKey: ['userControllableCharacters', gameId] });

// Invalidate current user
await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
```

## TypeScript Types

### Common Types

```typescript
import type { User } from '../types/auth';
import type { GameWithDetails, GameParticipant } from '../types/games';
import type { Character } from '../types/characters';
import type { UserGameRole } from '../contexts/GameContext';

// User
const user: User = {
  id: 1,
  username: 'player1',
  email: 'player1@example.com'
};

// Role
const role: UserGameRole = 'gm' | 'player' | 'co_gm' | 'audience' | 'none';
```

## Debugging

### Enable Debug Logs

All contexts and hooks log to console:

```typescript
// Check browser console for:
[AuthContext] Context state: { isAuthenticated: true, hasUser: true, userId: 123 }
[GameContext] Context state: { gameId: 1, userRole: 'gm', isGM: true }
[useUserCharacters] Characters loaded: [...]
```

### React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <AuthProvider>
    {/* App */}
  </AuthProvider>
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

## Performance Tips

1. **Use contexts for pages** - Wrap entire pages with GameProvider
2. **Use hooks for widgets** - Use hooks for small, focused components
3. **Leverage caching** - React Query caches for 30 seconds
4. **Memoize expensive calculations** - Contexts memoize permission checks
5. **Avoid prop drilling** - Use contexts/hooks instead

## Common Mistakes

### ❌ Don't Do This

```typescript
// Don't fetch user ID manually
const [userId, setUserId] = useState(null);
useEffect(() => {
  apiClient.getCurrentUser().then(/* ... */);
}, []);

// Don't calculate permissions manually
const isGM = game?.gm_user_id === userId;

// Don't create duplicate queries
const { data: game } = useQuery(['game', gameId], /* ... */);
```

### ✅ Do This Instead

```typescript
// Use context/hooks
const { currentUser } = useAuth();
const userId = currentUser?.id;

// Use provided permissions
const { isGM } = useGameContext();

// Let contexts handle queries
const { game } = useGameContext();
```

## Migration Quick Tips

1. Replace `useState` for user ID with `useAuth()`
2. Replace permission calculations with context/hooks
3. Remove duplicate React Query queries
4. Wrap game pages with `GameProvider`
5. Use hooks for smaller components
6. Test thoroughly after migration

## When to Use What

| Use Case | Recommended Approach |
|----------|---------------------|
| Get current user anywhere | `useAuth()` |
| Game detail page | Wrap with `GameProvider` |
| Check game permissions | `useGamePermissions(gameId)` |
| List user's characters | `useUserCharacters(gameId)` |
| Check character ownership | `useCharacterOwnership(gameId)` |
| Reusable component (may be outside game) | `useOptionalGameContext()` |
| Small widget needing game info | Use specific hook |
| Complex page with multiple game queries | Wrap with `GameProvider` |

## Support

- **Documentation**: `docs/STATE_MANAGEMENT.md`
- **Migration Guide**: `docs/MIGRATION_CHECKLIST.md`
- **Example Components**: See updated `GameDetailsPage.tsx`
- **Type Definitions**: `frontend/src/types/`
