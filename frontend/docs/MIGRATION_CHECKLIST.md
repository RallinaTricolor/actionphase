# State Management Migration Checklist

This document provides a step-by-step checklist for migrating existing components to use the new unified state management system.

## Overview

The migration involves:
1. Updating App.tsx to use AuthProvider
2. Migrating components to use new contexts/hooks
3. Removing duplicate logic
4. Testing thoroughly

## Phase 1: Setup (Required First)

### Step 1: Update App Entry Point

- [ ] Import `AuthProvider` from `contexts/AuthContext`
- [ ] Wrap application with `AuthProvider`
- [ ] Ensure `QueryClientProvider` is still the outermost provider

**File:** `frontend/src/App.tsx`

```typescript
import { AuthProvider } from './contexts/AuthContext';
import { QueryClientProvider } from '@tanstack/react-query';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          {/* Routes */}
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

### Step 2: Test Basic Auth

- [ ] Verify login still works
- [ ] Check that `currentUser` is populated after login
- [ ] Verify logout clears user data
- [ ] Check browser console for auth context logs

## Phase 2: Migrate Individual Components

### Components Currently Fetching User ID

These components currently fetch `currentUserId` independently:

#### GameDetailsPage

**File:** `frontend/src/pages/GameDetailsPage.tsx`

- [ ] Remove `currentUserId` state
- [ ] Remove `fetchCurrentUser` useEffect
- [ ] Import `useAuth` from contexts
- [ ] Get `currentUser` from `useAuth()`
- [ ] Update all `currentUserId` references to `currentUser?.id`

**Changes:**
```typescript
// REMOVE:
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

// ADD:
import { useAuth } from '../contexts/AuthContext';

const { currentUser } = useAuth();
const currentUserId = currentUser?.id;
```

#### CommonRoom

**File:** `frontend/src/components/CommonRoom.tsx`

- [ ] Remove `currentUserId` state
- [ ] Remove `fetchCurrentUser` useEffect
- [ ] Import `useAuth` from contexts
- [ ] Get `currentUser` from `useAuth()`
- [ ] Update references to use `currentUser?.id`

#### CharactersList

**File:** `frontend/src/components/CharactersList.tsx`

- [ ] Check if it fetches user ID (currently receives as prop)
- [ ] Consider whether to use `useAuth` or keep prop
- [ ] If keeping prop, update parent to pass `currentUser?.id`

### Components with Manual Permission Logic

#### GameDetailsPage

**File:** `frontend/src/pages/GameDetailsPage.tsx`

Option A: Wrap with GameProvider (Recommended)
- [ ] Wrap page content with `<GameProvider gameId={gameId}>`
- [ ] Update component to use `useGameContext()`
- [ ] Remove manual `isGM` calculation
- [ ] Remove manual `isParticipant` calculation
- [ ] Use `gameContext.isGM` and `gameContext.isParticipant`
- [ ] Use `gameContext.userCharacters` instead of separate query
- [ ] Use `gameContext.isUserCharacter(characterId)` for ownership checks

Option B: Use hook (Alternative)
- [ ] Import `useGamePermissions`
- [ ] Replace manual calculations with hook

**Recommended Approach:**
```typescript
// Wrap the page
export function GameDetailsPage({ gameId }: { gameId: number }) {
  return (
    <GameProvider gameId={gameId}>
      <GameDetailsContent gameId={gameId} />
    </GameProvider>
  );
}

// Update content component
function GameDetailsContent({ gameId }: { gameId: number }) {
  const {
    game,
    participants,
    isGM,
    isParticipant,
    userCharacters,
    isUserCharacter,
    refetchGameData
  } = useGameContext();

  // Remove all manual fetching and calculation logic
  // Use context values directly
}
```

### Components That Need Character Ownership

#### CharactersList

**File:** `frontend/src/components/CharactersList.tsx`

If receiving `currentUserId` as prop:
- [ ] Update parent to use `useAuth()` and pass `currentUser?.id`

If checking ownership internally:
- [ ] Consider using `useCharacterOwnership(gameId)` hook
- [ ] Replace manual ownership checks with `isUserCharacter(characterId)`

#### CharacterCard (in CharactersList)

- [ ] Verify ownership check uses consistent logic
- [ ] Consider passing ownership check from parent

### Components Using `useAuth()` Hook (Old)

**File:** Any component importing from `hooks/useAuth.ts`

- [ ] Update import from `hooks/useAuth` to `contexts/AuthContext`
- [ ] Check if using `currentUser` (new feature)
- [ ] Verify backward compatibility (isAuthenticated, login, etc.)

**Find all occurrences:**
```bash
grep -r "from '../hooks/useAuth'" frontend/src/
grep -r "from './hooks/useAuth'" frontend/src/
```

## Phase 3: Cleanup

### Remove Deprecated Code

- [ ] Check if old `hooks/useAuth.ts` is still used
- [ ] If not used, delete or deprecate `hooks/useAuth.ts`
- [ ] Search for remaining manual `apiClient.getCurrentUser()` calls
- [ ] Remove duplicate React Query queries for user data

### Consolidate Queries

Search for duplicate queries:
```bash
grep -r "queryKey: \['currentUser" frontend/src/
grep -r "queryKey: \['gameDetails" frontend/src/
grep -r "queryKey: \['gameParticipants" frontend/src/
grep -r "queryKey: \['userControllableCharacters" frontend/src/
```

- [ ] Verify all are using consistent query keys
- [ ] Remove any duplicate/competing queries
- [ ] Let contexts handle the data fetching

## Phase 4: Testing

### Manual Testing Checklist

#### Authentication
- [ ] Login with valid credentials
- [ ] Check user data appears immediately after login
- [ ] Verify currentUser has id, username, email
- [ ] Test logout clears all user data
- [ ] Test protected routes still work
- [ ] Test token refresh still works

#### Game Details Page
- [ ] View game as GM
  - [ ] Verify GM controls appear
  - [ ] Check edit game button works
  - [ ] Verify phase management appears
- [ ] View game as Player
  - [ ] Verify player controls appear
  - [ ] Check character list shows correctly
  - [ ] Verify action submission works
- [ ] View game as Audience
  - [ ] Verify limited permissions
  - [ ] Check appropriate UI restrictions

#### Character Management
- [ ] Create character as player
- [ ] View own characters
- [ ] Verify "Your Character" badge appears
- [ ] Check edit permissions on own characters
- [ ] View other players' characters (should not allow edit)

#### Common Room
- [ ] Create posts as GM
- [ ] Comment on posts
- [ ] Verify character selector shows only user's characters
- [ ] Check anonymous games hide ownership correctly

#### Private Messages
- [ ] Create conversation
- [ ] Send messages
- [ ] Verify character selector works
- [ ] Check unread counts

### Performance Testing

- [ ] Check browser Network tab for duplicate API calls
- [ ] Verify React Query cache is working (no repeated calls)
- [ ] Check console for excessive re-renders
- [ ] Verify page load time hasn't increased

### Browser Console Checks

- [ ] No errors in console
- [ ] Check for context state logs
- [ ] Verify query cache in React Query DevTools
- [ ] Check for any deprecation warnings

## Phase 5: Documentation Updates

- [ ] Update component documentation
- [ ] Add JSDoc comments to updated components
- [ ] Update any architecture diagrams
- [ ] Note breaking changes if any

## Common Issues and Solutions

### Issue: `currentUser` is null after login

**Solution:**
- Check that AuthProvider is wrapping the app
- Verify token is being stored correctly
- Check browser console for auth errors
- Ensure `/api/v1/auth/me` endpoint is working

### Issue: GameContext throws "must be used within GameProvider"

**Solution:**
- Ensure component using `useGameContext()` is wrapped with `<GameProvider>`
- Consider using `useGamePermissions()` hook instead if wrapping isn't feasible
- Or use `useOptionalGameContext()` for components that may be used outside context

### Issue: Duplicate API calls

**Solution:**
- Check React Query DevTools
- Verify query keys are consistent
- Ensure staleTime is set appropriately
- Remove any duplicate queries in components

### Issue: Permissions not updating

**Solution:**
- Check that game data is refetching after changes
- Call `refetchGameData()` after mutations
- Verify React Query invalidation is working
- Check network tab for API response

### Issue: Type errors with User interface

**Solution:**
- User interface now requires `id` to be present
- Update any code expecting `id?` to handle `User | null` instead
- AuthContext returns `currentUser: User | null`

## Rollback Plan

If issues arise:

1. Keep old `hooks/useAuth.ts` file initially
2. Components can import from old location temporarily
3. Gradually migrate components one at a time
4. Test each migration before proceeding
5. Old and new can coexist during transition

## Verification Commands

Run these commands to verify migration:

```bash
# Find components still using old auth hook
grep -r "from '../hooks/useAuth'" frontend/src/ --exclude-dir=node_modules

# Find manual currentUser fetching
grep -r "getCurrentUser()" frontend/src/ --exclude-dir=node_modules

# Find manual permission calculations
grep -r "gm_user_id === currentUserId" frontend/src/ --exclude-dir=node_modules

# Find duplicate queries
grep -r "queryKey: \['game" frontend/src/ --exclude-dir=node_modules
```

## Migration Progress Tracker

Track which components have been migrated:

### Core Pages
- [ ] App.tsx (AuthProvider setup)
- [ ] LoginPage.tsx
- [ ] RegisterPage.tsx
- [ ] DashboardPage.tsx
- [ ] GamesPage.tsx
- [ ] GameDetailsPage.tsx

### Game Components
- [ ] CharactersList.tsx
- [ ] CharacterCard (internal to CharactersList)
- [ ] CommonRoom.tsx
- [ ] PrivateMessages.tsx
- [ ] PhaseManagement.tsx
- [ ] ActionSubmission.tsx
- [ ] GameApplicationsList.tsx

### Utility Components
- [ ] ProtectedRoute.tsx
- [ ] Layout.tsx
- [ ] Navigation components

## Success Criteria

Migration is complete when:

- [ ] All components use AuthProvider for user data
- [ ] No manual `getCurrentUser()` calls exist
- [ ] GameDetailsPage uses GameContext or hooks
- [ ] No duplicate permission calculations
- [ ] All tests pass
- [ ] No console errors
- [ ] Performance metrics are stable
- [ ] React Query cache is optimized

## Timeline Estimate

- Phase 1 (Setup): 30 minutes
- Phase 2 (Component Migration): 2-4 hours
- Phase 3 (Cleanup): 1 hour
- Phase 4 (Testing): 2-3 hours
- Phase 5 (Documentation): 1 hour

**Total:** ~7-10 hours for complete migration

## Support

If issues arise during migration:

1. Check STATE_MANAGEMENT.md for usage examples
2. Review component examples in documentation
3. Check browser console for context logs
4. Use React Query DevTools to inspect cache
5. Refer to TypeScript types for available properties
