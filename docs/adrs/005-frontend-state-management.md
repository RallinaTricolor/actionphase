# ADR-005: Frontend State Management

## Status
Accepted

## Context
ActionPhase frontend requires state management that handles:
- Server state synchronization (games, characters, phases)
- Authentication state and token management
- Complex UI state for game interactions
- Real-time updates for collaborative features
- Optimistic updates for better user experience
- Offline capabilities for read-only data
- Performance optimization through caching

The solution must balance simplicity, performance, and maintainability while providing excellent developer experience.

## Decision
We implemented a **Hybrid State Management Strategy** using specialized tools for different types of state:

**Server State**: React Query (TanStack Query)
- All API communication and server state caching
- Automatic background refetching and synchronization
- Optimistic updates for mutations
- Infinite queries for paginated data

**Authentication State**: Custom React Context + Local Storage
- JWT token management with automatic refresh
- User session state and permissions
- Login/logout flow orchestration
- Persistent authentication across browser sessions

**UI State**: React useState + useReducer
- Component-local state for forms and interactions
- Complex state machines with useReducer
- Temporary UI state that doesn't need persistence
- Modal visibility, form validation states

**Global UI State**: React Context (Sparingly)
- Theme preferences and user settings
- Global UI state that spans multiple components
- Notification/toast management
- Navigation state

## Alternatives Considered

### 1. Redux + Redux Toolkit
**Approach**: Centralized state management with reducers and actions.

**Pros**:
- Predictable state updates with time-travel debugging
- Excellent developer tools and ecosystem
- Battle-tested for large applications
- Clear separation of concerns with slices

**Cons**:
- Significant boilerplate for simple operations
- Steep learning curve for new developers
- Over-engineering for current application size
- Complex setup for async operations and caching

### 2. Zustand
**Approach**: Lightweight state management library with simplified API.

**Pros**:
- Minimal boilerplate and simple API
- TypeScript-first design
- No providers needed
- Good performance characteristics

**Cons**:
- Less mature ecosystem compared to Redux
- Limited developer tooling
- No built-in server state management
- Still requires additional solutions for caching

### 3. Jotai (Atomic State Management)
**Approach**: Bottom-up atomic state management with composable atoms.

**Pros**:
- Fine-grained reactivity and performance
- Composable state atoms
- No unnecessary re-renders
- TypeScript-friendly API

**Cons**:
- Different mental model requires learning
- Less mature ecosystem
- Complex setup for server state
- May be overkill for current needs

### 4. Apollo Client (GraphQL)
**Approach**: GraphQL client with integrated caching and state management.

**Pros**:
- Unified data layer for server and local state
- Excellent caching and optimization features
- Real-time subscriptions support
- Mature ecosystem and tooling

**Cons**:
- Requires GraphQL backend (we use REST)
- Heavy client bundle size
- Complex setup and configuration
- Overkill without GraphQL

## Consequences

### Positive Consequences

**Developer Experience**:
- React Query provides excellent DevTools for debugging server state
- Simple useState for most UI interactions
- TypeScript integration provides compile-time safety
- Minimal learning curve leveraging React patterns

**Performance**:
- React Query handles caching and background updates efficiently
- Component-local state prevents unnecessary re-renders
- Lazy loading of data with suspense integration
- Optimistic updates improve perceived performance

**User Experience**:
- Automatic token refresh provides seamless authentication
- Background data synchronization keeps UI current
- Optimistic updates for immediate feedback
- Error boundaries handle network failures gracefully

**Maintainability**:
- Clear separation between server state and UI state
- Custom hooks encapsulate complex state logic
- Consistent patterns across components
- Easy to refactor and test individual pieces

### Negative Consequences

**Complexity Distribution**:
- Multiple state management approaches require mental context switching
- Custom authentication logic needs careful maintenance
- React Query configuration complexity for advanced features
- Potential for state synchronization issues between systems

**Learning Curve**:
- Developers need to understand React Query concepts
- Custom hooks patterns require React expertise
- Token refresh logic has subtle timing considerations
- Error handling strategies vary by state type

**Bundle Size**:
- React Query adds significant bundle weight
- Multiple state management libraries increase total bundle size
- Custom authentication code adds complexity
- Development overhead for maintaining multiple patterns

### Risk Mitigation Strategies

**State Synchronization**:
- Clear documentation of state boundaries and responsibilities
- Custom hooks provide consistent access patterns
- Integration tests verify cross-system state consistency
- React Query invalidation strategies keep data fresh

**Authentication Security**:
- Secure token storage with appropriate fallbacks
- Automatic logout on token expiration
- Request interceptors handle token refresh transparently
- Correlation IDs for debugging authentication issues

**Performance Monitoring**:
- React Query DevTools for cache performance analysis
- Bundle size monitoring for bloat prevention
- React DevTools profiler for render optimization
- Network monitoring for API call efficiency

## Implementation Details

### React Query Setup
```typescript
// Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on authentication errors
        if (error.status === 401) return false;
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false, // Don't retry mutations by default
    },
  },
});

// Custom hooks for server state
export function useGames() {
  return useQuery({
    queryKey: ['games'],
    queryFn: () => api.games.list(),
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.games.create,
    onSuccess: () => {
      // Invalidate games list to refetch
      queryClient.invalidateQueries(['games']);
    },
    // Optimistic update
    onMutate: async (newGame) => {
      await queryClient.cancelQueries(['games']);
      const previousGames = queryClient.getQueryData(['games']);

      queryClient.setQueryData(['games'], (old) => [
        ...old,
        { ...newGame, id: Date.now(), optimistic: true }
      ]);

      return { previousGames };
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData(['games'], context.previousGames);
    },
  });
}
```

### Authentication Context
```typescript
interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize authentication state from stored tokens
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token && !isTokenExpired(token)) {
        try {
          const userData = await api.auth.getCurrentUser();
          setUser(userData);
        } catch (error) {
          // Token invalid, clear storage
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await api.auth.login(credentials);
    localStorage.setItem('access_token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    setUser(response.user);
  };

  const logout = () => {
    api.auth.logout().catch(() => {
      // Logout locally even if server call fails
    });
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Custom Hook Patterns
```typescript
// Game management hook
export function useGameManagement(gameId: string) {
  const queryClient = useQueryClient();

  const game = useQuery({
    queryKey: ['games', gameId],
    queryFn: () => api.games.get(gameId),
  });

  const updateGame = useMutation({
    mutationFn: (updates: Partial<Game>) =>
      api.games.update(gameId, updates),
    onSuccess: (updatedGame) => {
      queryClient.setQueryData(['games', gameId], updatedGame);
      queryClient.invalidateQueries(['games']);
    },
  });

  const deleteGame = useMutation({
    mutationFn: () => api.games.delete(gameId),
    onSuccess: () => {
      queryClient.removeQueries(['games', gameId]);
      queryClient.invalidateQueries(['games']);
    },
  });

  return {
    game: game.data,
    isLoading: game.isLoading,
    error: game.error,
    updateGame: updateGame.mutate,
    deleteGame: deleteGame.mutate,
    isUpdating: updateGame.isPending || deleteGame.isPending,
  };
}

// Complex form state with validation
export function useGameForm(initialData?: Partial<Game>) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    maxPlayers: initialData?.maxPlayers || 4,
    gameConfig: initialData?.gameConfig || {},
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (formData.maxPlayers < 1 || formData.maxPlayers > 8) {
      newErrors.maxPlayers = 'Max players must be between 1 and 8';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return {
    formData,
    errors,
    isDirty,
    updateField,
    validate,
    reset: () => {
      setFormData(initialData || {});
      setErrors({});
      setIsDirty(false);
    },
  };
}
```

### Error Boundary Integration
```typescript
export function QueryErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            <pre>{error.message}</pre>
          </details>
          <button onClick={resetError}>Try again</button>
        </div>
      )}
      onError={(error) => {
        // Log error with context
        console.error('React Query Error:', error);
        // Could send to error reporting service
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

### State Invalidation Patterns
```typescript
// Automatic invalidation on related mutations
export function useCharacterMutations(gameId: string) {
  const queryClient = useQueryClient();

  const createCharacter = useMutation({
    mutationFn: api.characters.create,
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries(['games', gameId, 'characters']);
      queryClient.invalidateQueries(['games', gameId]); // Update game player count
    },
  });

  // Smart invalidation based on mutation type
  const updateCharacter = useMutation({
    mutationFn: api.characters.update,
    onSuccess: (updatedCharacter) => {
      // Update specific character in cache
      queryClient.setQueryData(
        ['characters', updatedCharacter.id],
        updatedCharacter
      );
      // Invalidate list to maintain consistency
      queryClient.invalidateQueries(['games', gameId, 'characters']);
    },
  });

  return { createCharacter, updateCharacter };
}
```

## Performance Optimizations

### Caching Strategy
- **Stale While Revalidate**: Data stays fresh with background updates
- **Cache Time**: Longer cache times for rarely changing data
- **Query Keys**: Structured keys for efficient invalidation
- **Prefetching**: Load data before user navigation

### Bundle Optimization
- **Code Splitting**: React Query DevTools only in development
- **Tree Shaking**: Import only needed React Query features
- **Lazy Loading**: Dynamic imports for heavy state management logic
- **Memoization**: React.memo and useMemo for expensive computations

## Testing Strategy

### Unit Testing
- Mock React Query for component tests
- Test custom hooks with React Testing Library
- Validate authentication state transitions
- Error boundary behavior testing

### Integration Testing
- Test state synchronization between systems
- Verify token refresh flows
- API integration with mocked responses
- End-to-end user flows with real state management

## Future Considerations

### Planned Enhancements
- **Offline Support**: Background sync for offline operations
- **Real-time Updates**: WebSocket integration with React Query
- **Persistent Caching**: IndexedDB for offline data persistence
- **State Devtools**: Enhanced debugging tools for custom state

### Scalability
- **State Normalization**: Flatten nested data structures
- **Selective Hydration**: Load only necessary state
- **Memory Management**: Garbage collection for unused cache entries
- **Performance Monitoring**: Track state management performance

## References
- [React Query Documentation](https://tanstack.com/query/latest)
- [React State Management Guide](https://react.dev/learn/managing-state)
- [Authentication Patterns in React](https://auth0.com/blog/complete-guide-to-react-user-authentication/)
- [React Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
