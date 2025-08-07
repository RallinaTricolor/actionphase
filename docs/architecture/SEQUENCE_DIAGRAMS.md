# Sequence Diagrams for Complex Flows

## Overview

This document provides detailed sequence diagrams for the most complex and critical flows in ActionPhase. These diagrams illustrate the step-by-step interactions between system components for key user journeys and system processes.

## 1. User Authentication Flow

### Login Process with JWT Token Management

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as Auth Handler
    participant S as Session Service
    participant D as Database
    participant J as JWT Service

    U->>F: Enter credentials
    F->>A: POST /api/v1/auth/login
    Note over F,A: {username, password}

    A->>A: Validate request format
    A->>D: Query user by username
    D-->>A: User record (with password hash)

    A->>A: Compare password hash
    alt Invalid credentials
        A-->>F: 401 Unauthorized
        F-->>U: Display error message
    else Valid credentials
        A->>S: Create session
        S->>D: Insert session record
        Note over S,D: {user_id, refresh_token, device_info}
        D-->>S: Session created

        A->>J: Generate JWT access token
        J-->>A: Access token (15min expiry)

        A-->>F: 200 OK with tokens
        Note over A,F: {access_token, refresh_token, user}

        F->>F: Store tokens in localStorage
        F->>F: Update AuthContext state
        F-->>U: Redirect to dashboard
    end
```

### Automatic Token Refresh Flow

```mermaid
sequenceDiagram
    participant F as Frontend
    participant I as Axios Interceptor
    participant A as API Endpoint
    participant R as Refresh Handler
    participant S as Session Service
    participant D as Database
    participant J as JWT Service

    F->>A: API request with expired token
    A-->>F: 401 Unauthorized

    I->>I: Detect 401 response
    I->>R: POST /api/v1/auth/refresh
    Note over I,R: {refresh_token}

    R->>S: Validate refresh token
    S->>D: Query session by refresh_token
    D-->>S: Session record

    alt Refresh token invalid/expired
        S-->>R: Invalid session
        R-->>I: 401 Unauthorized
        I->>F: Clear stored tokens
        F->>F: Redirect to login
    else Valid refresh token
        S->>D: Update session last_used_at
        D-->>S: Session updated

        R->>J: Generate new access token
        J-->>R: New access token

        R-->>I: 200 OK with new token
        Note over R,I: {access_token}

        I->>I: Update Authorization header
        I->>A: Retry original request
        A-->>F: Original response
    end
```

## 2. Game Creation and Management Flow

### Complete Game Creation Process

```mermaid
sequenceDiagram
    participant U as User (GM)
    participant F as Frontend
    participant H as Game Handler
    participant V as Validator
    participant GS as Game Service
    participant R as Repository
    participant D as Database
    participant O as Observability

    U->>F: Fill game creation form
    U->>F: Click "Create Game"

    F->>F: Client-side validation
    F->>H: POST /api/v1/games
    Note over F,H: {title, description, max_players, game_config}

    H->>O: Start request tracing
    Note over H,O: correlation_id: corr_abc123

    H->>V: Validate request data
    V-->>H: Validation result

    alt Validation fails
        H->>O: Log validation error
        H-->>F: 400 Bad Request
        F-->>U: Display validation errors
    else Validation passes
        H->>GS: CreateGame(ctx, gameData)

        GS->>GS: Apply business rules
        Note over GS: Check user permissions, game limits

        alt Business rules fail
            GS-->>H: Business logic error
            H->>O: Log business error
            H-->>F: 422 Unprocessable Entity
        else Business rules pass
            GS->>R: CreateGame(ctx, game)

            R->>D: BEGIN TRANSACTION
            R->>D: INSERT INTO games(...)
            D-->>R: Game record with ID

            R->>D: INSERT INTO game_phases(...)
            Note over R,D: Initial setup phase
            D-->>R: Phase record

            R->>D: COMMIT TRANSACTION
            R-->>GS: Created game with phases

            GS->>O: Record business metrics
            Note over GS,O: games_created_total++

            GS-->>H: Successfully created game

            H->>O: Log successful creation
            H-->>F: 201 Created
            Note over H,F: {game_id, title, status, phases}

            F->>F: Update React Query cache
            F->>F: Navigate to game detail page
            F-->>U: Show success message
        end
    end
```

### Game Phase Transition

```mermaid
sequenceDiagram
    participant GM as Game Master
    participant F as Frontend
    participant H as Phase Handler
    participant PS as Phase Service
    participant GS as Game Service
    participant R as Repository
    participant D as Database
    participant N as Notification Service

    GM->>F: Click "Advance Phase"
    F->>H: POST /api/v1/games/{id}/phases/advance

    H->>PS: AdvancePhase(ctx, gameID)

    PS->>GS: GetGameWithCurrentPhase(ctx, gameID)
    GS->>R: GetGameWithPhases(ctx, gameID)
    R->>D: SELECT game, current phase
    D-->>R: Game and phase data
    R-->>GS: Game with current phase
    GS-->>PS: Current game state

    PS->>PS: Validate phase transition
    Note over PS: Check business rules, timing

    alt Invalid transition
        PS-->>H: Phase transition error
        H-->>F: 400 Bad Request
        F-->>GM: Display error message
    else Valid transition
        PS->>R: Begin phase transition

        R->>D: BEGIN TRANSACTION

        R->>D: UPDATE current phase (end_time, status)
        R->>D: INSERT new phase (planning/action/resolution)
        R->>D: UPDATE game (current_phase_id)

        alt Database error
            R->>D: ROLLBACK TRANSACTION
            R-->>PS: Transaction failed
            PS-->>H: 500 Internal Error
        else Transaction successful
            R->>D: COMMIT TRANSACTION
            R-->>PS: Phase transition complete

            PS->>N: NotifyPlayers(gameID, phaseChange)
            Note over PS,N: Async notification to all players

            PS-->>H: New phase created
            H-->>F: 200 OK with new phase

            F->>F: Update game state cache
            F->>F: Show phase transition animation
            F-->>GM: Display new phase interface

            par Parallel notifications
                N->>N: Send email notifications
            and
                N->>N: Update real-time dashboard
            and
                N->>N: Log phase change event
            end
        end
    end
```

## 3. Character Management Flow

### Character Creation and Approval Process

```mermaid
sequenceDiagram
    participant P as Player
    participant F as Frontend
    participant CH as Character Handler
    participant CS as Character Service
    participant GS as Game Service
    participant R as Repository
    participant D as Database
    participant GM as Game Master UI

    P->>F: Navigate to game application
    P->>F: Fill character sheet form
    P->>F: Submit character application

    F->>CH: POST /api/v1/games/{id}/characters
    Note over F,CH: {name, character_data, background}

    CH->>CS: CreateCharacter(ctx, gameID, charData)

    CS->>GS: ValidateGameJoinability(ctx, gameID)
    GS->>R: GetGameStatus(ctx, gameID)
    R->>D: SELECT game status, player_count, max_players
    D-->>R: Game information
    R-->>GS: Game details

    alt Game not accepting players
        GS-->>CS: Game closed for applications
        CS-->>CH: 409 Conflict
        CH-->>F: Display error
        F-->>P: "Applications closed"
    else Game accepting players
        GS-->>CS: Game available for joining

        CS->>CS: Validate character data
        Note over CS: Check required fields, game system rules

        alt Character validation fails
            CS-->>CH: Validation errors
            CH-->>F: 400 Bad Request
            F-->>P: Display character errors
        else Character valid
            CS->>R: CreateCharacter(ctx, character)

            R->>D: INSERT INTO characters
            Note over R,D: status='pending', awaiting GM approval
            D-->>R: Character record created

            R-->>CS: Character with pending status
            CS-->>CH: Character application submitted
            CH-->>F: 201 Created

            F->>F: Update character list cache
            F-->>P: "Application submitted, awaiting approval"

            # Notify GM of new application
            par GM Notification
                CS->>GM: New character application
                Note over CS,GM: Real-time notification or polling
                GM->>GM: Review character application
            end
        end
    end
```

### Character Approval by GM

```mermaid
sequenceDiagram
    participant GM as Game Master
    participant F as Frontend
    participant CH as Character Handler
    participant CS as Character Service
    participant R as Repository
    participant D as Database
    participant P as Player UI

    GM->>F: View pending character applications
    F->>CH: GET /api/v1/games/{id}/characters?status=pending
    CH->>CS: GetPendingCharacters(ctx, gameID)
    CS->>R: GetCharactersByStatus(ctx, gameID, "pending")
    R->>D: SELECT characters WHERE status='pending'
    D-->>R: Pending character list
    R-->>CS: Character applications
    CS-->>CH: Pending characters
    CH-->>F: Character list
    F-->>GM: Display pending applications

    GM->>F: Review character details
    GM->>F: Click "Approve" or "Reject"

    F->>CH: PUT /api/v1/characters/{id}/status
    Note over F,CH: {status: "approved", feedback: "Welcome!"}

    CH->>CS: UpdateCharacterStatus(ctx, characterID, status)

    CS->>R: GetCharacterWithGame(ctx, characterID)
    R->>D: SELECT character, game info
    D-->>R: Character and game details
    R-->>CS: Character data

    CS->>CS: Validate GM authorization
    Note over CS: Ensure GM owns the game

    alt GM not authorized
        CS-->>CH: 403 Forbidden
        CH-->>F: Authorization error
    else GM authorized
        CS->>R: UpdateCharacterStatus(ctx, characterID, newStatus)

        R->>D: BEGIN TRANSACTION
        R->>D: UPDATE characters SET status=?, feedback=?

        alt Status = "approved"
            R->>D: UPDATE games SET current_players = current_players + 1
            Note over R,D: Increment player count
        end

        R->>D: INSERT INTO character_status_history
        Note over R,D: Audit trail of status changes

        R->>D: COMMIT TRANSACTION
        R-->>CS: Status updated successfully

        CS-->>CH: Character status updated
        CH-->>F: 200 OK

        F->>F: Update character cache
        F-->>GM: Show updated status

        # Notify player of decision
        par Player Notification
            CS->>P: Character status changed
            Note over CS,P: Email/in-app notification
            P->>P: Update character list
            P->>P: Show approval/rejection message
        end
    end
```

## 4. Error Handling and Recovery Flow

### Database Connection Failure Recovery

```mermaid
sequenceDiagram
    participant F as Frontend
    participant H as Handler
    participant S as Service
    participant R as Repository
    participant P as Connection Pool
    participant D as Database
    participant O as Observability

    F->>H: API Request
    H->>S: Business operation
    S->>R: Data operation
    R->>P: Get connection
    P->>D: Database query

    D-->>P: Connection timeout/error
    P-->>R: Connection error

    R->>O: Log database error
    Note over R,O: correlation_id, error details, stack trace

    R->>R: Implement retry logic
    Note over R: Exponential backoff, max 3 retries

    loop Retry attempts (max 3)
        R->>P: Retry get connection
        P->>D: Retry database query

        alt Database responds
            D-->>P: Successful response
            P-->>R: Query result
            R-->>S: Data returned
            S-->>H: Business result
            H-->>F: 200 OK response
        else Database still failing
            D-->>P: Still failing
            P-->>R: Connection still failed
            Note over R: Continue retry loop
        end
    end

    alt All retries exhausted
        R->>O: Log critical database failure
        R-->>S: Database unavailable error
        S-->>H: Service degraded error
        H->>O: Log service error
        H-->>F: 503 Service Unavailable
        F->>F: Display user-friendly error
        Note over F: "Service temporarily unavailable"
    end
```

### Distributed Request Tracing

```mermaid
sequenceDiagram
    participant F as Frontend
    participant M as Middleware
    participant H1 as Handler A
    participant S1 as Service A
    participant H2 as Handler B
    participant S2 as Service B
    participant D as Database
    participant O as Observability

    F->>M: HTTP Request
    Note over F,M: X-Correlation-ID: corr_user123

    M->>M: Extract/generate correlation ID
    M->>O: Log request start
    Note over M,O: correlation_id: corr_user123, operation: start

    M->>H1: Request with context
    Note over M,H1: ctx.WithValue(correlationID)

    H1->>O: Log handler start
    H1->>S1: Service call with context

    S1->>O: Log service operation
    S1->>H2: Internal service call
    Note over S1,H2: Propagate correlation ID

    H2->>S2: Second service call
    S2->>O: Log second service operation
    S2->>D: Database operation

    alt Database success
        D-->>S2: Query result
        S2->>O: Log operation success
        S2-->>H2: Service result
        H2-->>S1: Internal result
        S1-->>H1: Service result
        H1->>O: Log handler success
        H1-->>M: Handler result
        M->>O: Log request completion
        M-->>F: 200 OK response
        Note over M,F: X-Correlation-ID: corr_user123
    else Database error
        D-->>S2: Database error
        S2->>O: Log database error
        Note over S2,O: correlation_id: corr_user123, error: connection_timeout

        S2-->>H2: Error response
        H2->>O: Log handler error
        H2-->>S1: Error propagation
        S1->>O: Log service error
        S1-->>H1: Error result
        H1->>O: Log final error
        H1-->>M: Error response
        M->>O: Log request failure
        M-->>F: 500 Internal Error
        Note over M,F: X-Correlation-ID: corr_user123
    end
```

## 5. Performance Optimization Flow

### React Query Cache Management

```mermaid
sequenceDiagram
    participant U as User
    participant C as Component
    participant RQ as React Query
    participant AC as Axios Client
    participant API as Backend API
    participant Cache as Browser Cache

    U->>C: Navigate to games list
    C->>RQ: useGames() hook

    RQ->>RQ: Check query cache
    Note over RQ: queryKey: ['games']

    alt Cache hit (fresh data)
        RQ-->>C: Return cached data immediately
        C-->>U: Display games list

        RQ->>RQ: Background refetch check
        Note over RQ: staleTime check (5 minutes)

        alt Data is stale
            RQ->>AC: Background fetch
            AC->>API: GET /api/v1/games
            Note over AC,API: If-None-Match: etag123

            alt Data unchanged (304)
                API-->>AC: 304 Not Modified
                AC-->>RQ: No changes
                RQ->>RQ: Update cache timestamp
            else Data changed (200)
                API-->>AC: 200 OK with new data
                AC-->>RQ: Fresh game data
                RQ->>RQ: Update cache
                RQ-->>C: Trigger re-render
                C-->>U: Update UI with fresh data
            end
        end
    else Cache miss or expired
        RQ-->>C: Return loading state
        C-->>U: Display loading spinner

        RQ->>AC: Fetch data
        AC->>Cache: Check HTTP cache

        alt HTTP cache hit
            Cache-->>AC: Cached response
            AC-->>RQ: Game data
        else HTTP cache miss
            AC->>API: GET /api/v1/games
            API-->>AC: 200 OK with data
            AC->>Cache: Store in HTTP cache
            AC-->>RQ: Fresh game data
        end

        RQ->>RQ: Store in query cache
        RQ-->>C: Return data
        C-->>U: Display games list
    end

    U->>C: Create new game
    C->>RQ: useCreateGame() mutation

    RQ->>AC: POST /api/v1/games
    AC->>API: Create game request
    API-->>AC: 201 Created with new game
    AC-->>RQ: New game data

    RQ->>RQ: Optimistic update
    Note over RQ: Add new game to cache immediately
    RQ-->>C: Update UI optimistically
    C-->>U: Show new game immediately

    RQ->>RQ: Invalidate related queries
    Note over RQ: Invalidate ['games'] query
    RQ->>AC: Refetch games list
    AC->>API: GET /api/v1/games
    API-->>AC: Updated games list
    AC-->>RQ: Fresh data with real IDs
    RQ-->>C: Final UI update
```

## 6. Security Flow Diagrams

### JWT Token Validation Process

```mermaid
sequenceDiagram
    participant F as Frontend
    participant M as Auth Middleware
    participant J as JWT Service
    participant S as Session Service
    participant D as Database
    participant H as Handler

    F->>M: API Request
    Note over F,M: Authorization: Bearer jwt_token_here

    M->>M: Extract token from header
    M->>J: ValidateToken(token)

    J->>J: Parse JWT structure
    alt Malformed JWT
        J-->>M: Invalid token format
        M-->>F: 401 Unauthorized
    else Valid JWT structure
        J->>J: Verify signature
        alt Invalid signature
            J-->>M: Invalid signature
            M-->>F: 401 Unauthorized
        else Valid signature
            J->>J: Check expiration
            alt Token expired
                J-->>M: Token expired
                M-->>F: 401 Unauthorized (trigger refresh)
            else Token valid
                J->>J: Extract user claims
                J-->>M: User ID and claims

                M->>S: ValidateUserSession(userID)
                S->>D: Check active sessions
                D-->>S: Session status

                alt No active session
                    S-->>M: User session invalid
                    M-->>F: 401 Unauthorized
                else Valid session
                    S-->>M: Session confirmed
                    M->>M: Add user to request context
                    M->>H: Forward request with user context
                    H->>H: Process authorized request
                    H-->>M: Response
                    M-->>F: Authorized response
                end
            end
        end
    end
```

These sequence diagrams provide detailed visual representations of the most complex flows in ActionPhase, making it easier for developers to understand system behavior and identify potential issues or optimization opportunities.
