# Game Applications System Design

## Database Schema

### game_applications table
```sql
CREATE TABLE game_applications (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('player', 'audience')),
    message TEXT, -- Optional message from applicant
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(game_id, user_id) -- One application per user per game
);
```

## API Endpoints

### POST /api/v1/games/{id}/apply
Apply to join a game
```json
{
    "role": "player", // or "audience"
    "message": "I'd love to play a wizard in this campaign!"
}
```

### GET /api/v1/games/{id}/applications (GM only)
Get all applications for a game
```json
[
    {
        "id": 1,
        "game_id": 123,
        "user_id": 456,
        "username": "player1",
        "email": "player1@example.com",
        "role": "player",
        "message": "I'd love to play a wizard!",
        "status": "pending",
        "applied_at": "2023-08-15T10:30:00Z"
    }
]
```

### PUT /api/v1/games/{id}/applications/{application_id}/approve (GM only)
Approve an application (moves to game_participants)

### PUT /api/v1/games/{id}/applications/{application_id}/reject (GM only)
Reject an application

### DELETE /api/v1/games/{id}/applications/{application_id} (Applicant only)
Withdraw an application

## Business Rules

1. Users can only have one application per game
2. Applications can only be submitted for games in "recruitment" state
3. Only GMs can view/approve/reject applications
4. Applications are automatically approved when GM transitions game out of recruitment
5. Approved applications create entries in game_participants table
6. Users cannot apply to games they're already participating in
7. Users cannot apply to games where their previous application was rejected
