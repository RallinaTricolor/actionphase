# State Management Context - Read Before Frontend State Work

**IMPORTANT: Read this file before working on frontend state management.**

## State Management Strategy

ActionPhase uses a **Hybrid State Management Strategy** with specialized tools for different types of state:

### 1. Server State: React Query (TanStack Query)
**For all API communication and server data caching**

- Automatic background refetching
- Intelligent caching with stale-while-revalidate
- Optimistic updates for mutations
- Automatic retry logic
- Request deduplication

### 2. Authentication State: AuthContext + React Query
**Centralized authentication with single source of truth**

- JWT token management
- User session state
- Login/logout orchestration
- Automatic token refresh
- **isCheckingAuth flag** prevents race conditions

### 3. UI State: React useState + useReducer
**Component-local state for forms and interactions**

- Form inputs and validation
- Modal visibility
- Loading states
- Temporary UI state

### 4. Global UI State: React Context (Sparingly)
**Only for truly global state**

- Theme preferences
- User settings
- Notification management
- Navigation state

## Core Pattern: Centralized AuthContext

### The Problem (Before October 2025)
- **15+ components** independently fetching user data
- Each component decoded JWT client-side
- **60-70% duplicate API calls**
- Race conditions and inconsistent loading states
- Security risk from client-side JWT parsing

### The Solution (October 2025 Refactor)

**Single AuthContext with React Query integration**

```typescript
// frontend/src/contexts/AuthContext.tsx

interface AuthContextValue {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isCheckingAuth: boolean;  // CRITICAL: Prevents premature renders
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  error: Error | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Single query for authentication state
  const { data: isAuthenticated, isLoading: isCheckingAuth } = useQuery({
    queryKey: ['auth'],
    queryFn: () => !!apiClient.getAuthToken(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Single query for user data
  const { data: currentUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await apiClient.getCurrentUser();
      return response.data;
    },
    enabled: isAuthenticated === true,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isLoading = isCheckingAuth || isLoadingUser;

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Results
- **60-70% reduction** in `/auth/me` API calls
- **Zero client-side JWT decoding** (security improvement)
- **Consistent loading states** across all components
- **Single source of truth** eliminates race conditions

## Using AuthContext in Components

### Basic Usage

```typescript
import { useAuth } from '../contexts/AuthContext';

export function MyComponent() {
  const { currentUser, isCheckingAuth, isAuthenticated } = useAuth();

  // Always check auth state first
  if (isCheckingAuth) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Safe to use currentUser here
  const userId = currentUser?.id;
  const username = currentUser?.username;

  return <div>Welcome, {username}!</div>;
}
```

### Critical: isCheckingAuth Flag

**ALWAYS use `isCheckingAuth` to prevent premature rendering**

```typescript
// ❌ BAD: Button may render before auth state is known
{!isGM && game.state === 'recruitment' && (
  <button onClick={handleApply}>Apply to Join</button>
)}

// ✅ GOOD: Wait for auth state before rendering
{!isGM && !isCheckingAuth && game.state === 'recruitment' && (
  <button onClick={handleApply}>Apply to Join</button>
)}
```

**Why**: Without `isCheckingAuth`, buttons/UI may briefly appear before auth is confirmed, causing UX issues and potential bugs (e.g., GM seeing "Apply to Join" on their own game).

### Getting User ID

```typescript
// ✅ CORRECT: Use nullish coalescing
const currentUserId = currentUser?.id ?? null;

// ✅ CORRECT: Direct comparison
const isGM = game.gm_user_id === currentUser?.id;

// ❌ WRONG: Don't decode JWT client-side
const decoded = decodeJWT(token);  // NEVER DO THIS
```

## React Query Patterns

### Query Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on auth errors
        if (error.status === 401) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});
```

### Custom Query Hooks

```typescript
export function useGame(gameId: number) {
  return useQuery({
    queryKey: ['games', gameId],
    queryFn: () => apiClient.getGame(gameId),
    enabled: !!gameId, // Only run if gameId exists
  });
}

export function useGames() {
  return useQuery({
    queryKey: ['games'],
    queryFn: () => apiClient.getAllGames(),
  });
}
```

### Mutation Hooks with Cache Invalidation

```typescript
export function useCreateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateGameRequest) => apiClient.createGame(data),
    onSuccess: (newGame) => {
      // Invalidate and refetch games list
      queryClient.invalidateQueries(['games']);

      // Optionally set the new game in cache
      queryClient.setQueryData(['games', newGame.id], newGame);
    },
    onError: (error) => {
      console.error('Failed to create game:', error);
    },
  });
}
```

### Optimistic Updates

```typescript
export function useUpdateGame(gameId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<Game>) =>
      apiClient.updateGame(gameId, updates),

    // Optimistic update
    onMutate: async (updates) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries(['games', gameId]);

      // Save current value for rollback
      const previousGame = queryClient.getQueryData(['games', gameId]);

      // Optimistically update cache
      queryClient.setQueryData(['games', gameId], (old: Game) => ({
        ...old,
        ...updates,
      }));

      return { previousGame };
    },

    // Rollback on error
    onError: (error, updates, context) => {
      queryClient.setQueryData(['games', gameId], context.previousGame);
    },

    // Refetch on success
    onSuccess: () => {
      queryClient.invalidateQueries(['games', gameId]);
      queryClient.invalidateQueries(['games']); // Refresh list too
    },
  });
}
```

## Common Patterns

### Loading States

```typescript
export function MyComponent() {
  const { data: game, isLoading, error } = useGame(gameId);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!game) {
    return <NotFound />;
  }

  return <GameDisplay game={game} />;
}
```

### Dependent Queries

```typescript
export function CharacterSheet({ characterId }: Props) {
  // First query: Get character
  const { data: character } = useQuery({
    queryKey: ['characters', characterId],
    queryFn: () => apiClient.getCharacter(characterId),
  });

  // Second query: Get character's game (only runs if character exists)
  const { data: game } = useQuery({
    queryKey: ['games', character?.game_id],
    queryFn: () => apiClient.getGame(character!.game_id),
    enabled: !!character?.game_id, // Only run if we have game_id
  });

  return <div>...</div>;
}
```

### Polling for Real-time Updates

```typescript
export function useGamePhase(gameId: number) {
  return useQuery({
    queryKey: ['games', gameId, 'phase'],
    queryFn: () => apiClient.getCurrentPhase(gameId),
    refetchInterval: 10000, // Poll every 10 seconds
    refetchIntervalInBackground: true, // Continue polling in background
  });
}
```

## State Management Anti-Patterns

### ❌ Don't Decode JWT Client-Side

```typescript
// ❌ WRONG: Security risk
const token = localStorage.getItem('access_token');
const decoded = JSON.parse(atob(token.split('.')[1]));
const userId = decoded.user_id;

// ✅ CORRECT: Use AuthContext
const { currentUser } = useAuth();
const userId = currentUser?.id;
```

### ❌ Don't Fetch User Data in Multiple Places

```typescript
// ❌ WRONG: Duplicate API calls
export function MyComponent() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    apiClient.getCurrentUser().then(setUser);
  }, []);
  // ...
}

// ✅ CORRECT: Use centralized AuthContext
export function MyComponent() {
  const { currentUser } = useAuth();
  // ...
}
```

### ❌ Don't Forget isCheckingAuth

```typescript
// ❌ WRONG: Race condition
{!isGM && <button>Apply</button>}

// ✅ CORRECT: Wait for auth
{!isGM && !isCheckingAuth && <button>Apply</button>}
```

### ❌ Don't Store Server Data in useState

```typescript
// ❌ WRONG: Manual state management
const [games, setGames] = useState([]);
useEffect(() => {
  apiClient.getGames().then(setGames);
}, []);

// ✅ CORRECT: Use React Query
const { data: games } = useQuery({
  queryKey: ['games'],
  queryFn: () => apiClient.getGames(),
});
```

## Testing State Management

### Testing Components with AuthContext

```typescript
import { render, screen } from '@testing-library/react';
import { AuthContext } from '../contexts/AuthContext';

const mockAuthValue = {
  currentUser: { id: 1, username: 'testuser' },
  isAuthenticated: true,
  isLoading: false,
  isCheckingAuth: false,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  error: null,
};

test('renders with authenticated user', () => {
  render(
    <AuthContext.Provider value={mockAuthValue}>
      <MyComponent />
    </AuthContext.Provider>
  );
  expect(screen.getByText('Welcome, testuser!')).toBeInTheDocument();
});
```

### Testing Components with React Query

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

test('loads and displays game', async () => {
  render(<GameDetails gameId={1} />, { wrapper: createWrapper() });
  expect(await screen.findByText('Game Title')).toBeInTheDocument();
});
```

## References

- **ADR**: `/docs/adrs/005-frontend-state-management.md` (includes October 2025 refactor details)
- **Quick Reference**: `/frontend/docs/STATE_MANAGEMENT_QUICK_REFERENCE.md`
- **Detailed Architecture**: `/frontend/docs/STATE_MANAGEMENT_ARCHITECTURE.md`
- **Implementation Details**: `/frontend/docs/STATE_MANAGEMENT.md`

## Quick Checklist

- [ ] Use `useAuth()` hook for all user data
- [ ] Always check `isCheckingAuth` before conditional rendering
- [ ] Use React Query for all server state
- [ ] Never decode JWT client-side
- [ ] Use nullish coalescing (`??`) for user ID
- [ ] Invalidate queries after mutations
- [ ] Handle loading, error, and empty states
- [ ] Test components with mocked context/queries
