package core

import (
	db "actionphase/pkg/db/models"
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"
)

// TestDataFactory provides convenient methods to create test objects
type TestDataFactory struct {
	db       *TestDatabase
	t        TestingInterface
	sequence int // For generating unique values
}

// NewTestDataFactory creates a new test data factory
func NewTestDataFactory(db *TestDatabase, t TestingInterface) *TestDataFactory {
	return &TestDataFactory{
		db:       db,
		t:        t,
		sequence: 1,
	}
}

// UserBuilder provides a fluent interface for building test users
type UserBuilder struct {
	factory  *TestDataFactory
	username string
	email    string
	password string
	isAdmin  bool
}

// NewUser starts building a new user with default values
func (f *TestDataFactory) NewUser() *UserBuilder {
	seq := f.nextSequence()
	return &UserBuilder{
		factory:  f,
		username: fmt.Sprintf("testuser%d", seq),
		email:    fmt.Sprintf("testuser%d@example.com", seq),
		password: "testpassword123",
		isAdmin:  false,
	}
}

func (b *UserBuilder) WithUsername(username string) *UserBuilder {
	b.username = username
	return b
}

func (b *UserBuilder) WithEmail(email string) *UserBuilder {
	b.email = email
	return b
}

func (b *UserBuilder) WithPassword(password string) *UserBuilder {
	b.password = password
	return b
}

func (b *UserBuilder) AsAdmin() *UserBuilder {
	b.isAdmin = true
	return b
}

// Create persists the user to the database and returns the created user
func (b *UserBuilder) Create() db.User {
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(b.password), bcrypt.DefaultCost)
	if err != nil {
		b.factory.t.Fatalf("Should be able to hash password: %v", err)
	}

	params := db.CreateUserParams{
		Username: b.username,
		Email:    b.email,
		Password: string(hashedPassword),
	}

	queries := db.New(b.factory.db.Pool)
	user, err := queries.CreateUser(context.Background(), params)
	if err != nil {
		b.factory.t.Fatalf("Should be able to create test user: %v", err)
	}

	return user
}

// Build returns the user data without persisting to database
func (b *UserBuilder) Build() User {
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(b.password), bcrypt.DefaultCost)
	return User{
		Username: b.username,
		Email:    b.email,
		Password: string(hashedPassword),
	}
}

// GameBuilder provides a fluent interface for building test games
type GameBuilder struct {
	factory             *TestDataFactory
	title               string
	description         string
	gmUserID            int32
	genre               string
	state               string
	maxPlayers          int32
	isPublic            bool
	startDate           *time.Time
	endDate             *time.Time
	recruitmentDeadline *time.Time
}

// NewGame starts building a new game with default values
func (f *TestDataFactory) NewGame() *GameBuilder {
	seq := f.nextSequence()
	return &GameBuilder{
		factory:     f,
		title:       fmt.Sprintf("Test Game %d", seq),
		description: fmt.Sprintf("Description for test game %d", seq),
		gmUserID:    1, // Default GM user ID
		genre:       "Fantasy",
		state:       "setup",
		maxPlayers:  4,
		isPublic:    true,
	}
}

func (b *GameBuilder) WithTitle(title string) *GameBuilder {
	b.title = title
	return b
}

func (b *GameBuilder) WithDescription(description string) *GameBuilder {
	b.description = description
	return b
}

func (b *GameBuilder) WithGM(gmUserID int32) *GameBuilder {
	b.gmUserID = gmUserID
	return b
}

func (b *GameBuilder) WithGenre(genre string) *GameBuilder {
	b.genre = genre
	return b
}

func (b *GameBuilder) WithState(state string) *GameBuilder {
	b.state = state
	return b
}

func (b *GameBuilder) WithMaxPlayers(maxPlayers int32) *GameBuilder {
	b.maxPlayers = maxPlayers
	return b
}

func (b *GameBuilder) AsPrivate() *GameBuilder {
	b.isPublic = false
	return b
}

func (b *GameBuilder) WithStartDate(startDate time.Time) *GameBuilder {
	b.startDate = &startDate
	return b
}

func (b *GameBuilder) WithEndDate(endDate time.Time) *GameBuilder {
	b.endDate = &endDate
	return b
}

func (b *GameBuilder) WithRecruitmentDeadline(deadline time.Time) *GameBuilder {
	b.recruitmentDeadline = &deadline
	return b
}

// Create persists the game to the database and returns the created game
func (b *GameBuilder) Create() db.Game {
	params := db.CreateGameParams{
		Title:       b.title,
		Description: pgtype.Text{String: b.description, Valid: true},
		GmUserID:    b.gmUserID,
		Genre:       pgtype.Text{String: b.genre, Valid: true},
		MaxPlayers:  pgtype.Int4{Int32: b.maxPlayers, Valid: true},
		IsPublic:    pgtype.Bool{Bool: b.isPublic, Valid: true},
	}

	if b.startDate != nil {
		params.StartDate = pgtype.Timestamptz{Time: *b.startDate, Valid: true}
	}

	if b.endDate != nil {
		params.EndDate = pgtype.Timestamptz{Time: *b.endDate, Valid: true}
	}

	if b.recruitmentDeadline != nil {
		params.RecruitmentDeadline = pgtype.Timestamptz{Time: *b.recruitmentDeadline, Valid: true}
	}

	queries := db.New(b.factory.db.Pool)
	game, err := queries.CreateGame(context.Background(), params)
	if err != nil {
		b.factory.t.Fatalf("Should be able to create test game: %v", err)
	}

	// Update game state if different from default
	if b.state != "setup" {
		updateParams := db.UpdateGameStateParams{
			ID:    game.ID,
			State: pgtype.Text{String: b.state, Valid: true},
		}
		game, err = queries.UpdateGameState(context.Background(), updateParams)
		if err != nil {
			b.factory.t.Fatalf("Should be able to update game state: %v", err)
		}
	}

	return game
}

// SessionBuilder provides a fluent interface for building test sessions
type SessionBuilder struct {
	factory *TestDataFactory
	userID  int32
	data    string
	expires *time.Time
}

// NewSession starts building a new session with default values
func (f *TestDataFactory) NewSession() *SessionBuilder {
	seq := f.nextSequence()
	return &SessionBuilder{
		factory: f,
		userID:  1, // Default user ID
		data:    fmt.Sprintf("test_session_token_%d", seq),
	}
}

func (b *SessionBuilder) WithUserID(userID int32) *SessionBuilder {
	b.userID = userID
	return b
}

func (b *SessionBuilder) WithData(data string) *SessionBuilder {
	b.data = data
	return b
}

func (b *SessionBuilder) WithExpiry(expires time.Time) *SessionBuilder {
	b.expires = &expires
	return b
}

func (b *SessionBuilder) ExpiringIn(duration time.Duration) *SessionBuilder {
	expiry := time.Now().Add(duration)
	b.expires = &expiry
	return b
}

// Create persists the session to the database and returns the created session
func (b *SessionBuilder) Create() db.Session {
	params := db.CreateSessionParams{
		UserID: b.userID,
		Data:   b.data,
	}

	if b.expires != nil {
		params.Expires = pgtype.Timestamptz{Time: *b.expires, Valid: true}
	} else {
		// Default to 24 hours from now
		params.Expires = pgtype.Timestamptz{Time: time.Now().Add(24 * time.Hour), Valid: true}
	}

	queries := db.New(b.factory.db.Pool)
	session, err := queries.CreateSession(context.Background(), params)
	if err != nil {
		b.factory.t.Fatalf("Should be able to create test session: %v", err)
	}

	return session
}

// GameParticipantBuilder provides a fluent interface for building test game participants
type GameParticipantBuilder struct {
	factory *TestDataFactory
	gameID  int32
	userID  int32
	role    string
	status  string
}

// NewGameParticipant starts building a new game participant with default values
func (f *TestDataFactory) NewGameParticipant() *GameParticipantBuilder {
	return &GameParticipantBuilder{
		factory: f,
		gameID:  1, // Default game ID
		userID:  1, // Default user ID
		role:    "player",
		status:  "active",
	}
}

func (b *GameParticipantBuilder) ForGame(gameID int32) *GameParticipantBuilder {
	b.gameID = gameID
	return b
}

func (b *GameParticipantBuilder) WithUser(userID int32) *GameParticipantBuilder {
	b.userID = userID
	return b
}

func (b *GameParticipantBuilder) WithRole(role string) *GameParticipantBuilder {
	b.role = role
	return b
}

func (b *GameParticipantBuilder) WithStatus(status string) *GameParticipantBuilder {
	b.status = status
	return b
}

func (b *GameParticipantBuilder) AsGM() *GameParticipantBuilder {
	b.role = "gm"
	return b
}

func (b *GameParticipantBuilder) AsPlayer() *GameParticipantBuilder {
	b.role = "player"
	return b
}

func (b *GameParticipantBuilder) AsObserver() *GameParticipantBuilder {
	b.role = "observer"
	return b
}

// Create persists the game participant to the database and returns the created participant
func (b *GameParticipantBuilder) Create() db.GameParticipant {
	params := db.AddGameParticipantParams{
		GameID: b.gameID,
		UserID: b.userID,
		Role:   b.role,
	}

	queries := db.New(b.factory.db.Pool)
	participant, err := queries.AddGameParticipant(context.Background(), params)
	if err != nil {
		b.factory.t.Fatalf("Should be able to create test game participant: %v", err)
	}

	// Update status if different from default
	if b.status != "active" {
		updateParams := db.UpdateParticipantStatusParams{
			GameID: b.gameID,
			UserID: b.userID,
			Status: pgtype.Text{String: b.status, Valid: true},
		}
		participant, err = queries.UpdateParticipantStatus(context.Background(), updateParams)
		if err != nil {
			b.factory.t.Fatalf("Should be able to update participant status: %v", err)
		}
	}

	return participant
}

// Convenience methods for creating common test scenarios

// CreateUserWithGame creates a user and a game they own
func (f *TestDataFactory) CreateUserWithGame() (db.User, db.Game) {
	user := f.NewUser().Create()
	game := f.NewGame().WithGM(user.ID).Create()
	return user, game
}

// CreateGameWithParticipants creates a game with specified number of participants
func (f *TestDataFactory) CreateGameWithParticipants(numParticipants int) (db.Game, []db.User, []db.GameParticipant) {
	// Create GM
	gm := f.NewUser().WithUsername("gm").WithEmail("gm@test.com").Create()
	game := f.NewGame().WithGM(gm.ID).Create()

	// Create participants
	users := make([]db.User, numParticipants)
	participants := make([]db.GameParticipant, numParticipants)

	for i := 0; i < numParticipants; i++ {
		user := f.NewUser().
			WithUsername(fmt.Sprintf("player%d", i+1)).
			WithEmail(fmt.Sprintf("player%d@test.com", i+1)).
			Create()

		participant := f.NewGameParticipant().
			ForGame(game.ID).
			WithUser(user.ID).
			AsPlayer().
			Create()

		users[i] = user
		participants[i] = participant
	}

	return game, users, participants
}

// CreateAuthenticatedUser creates a user and an associated session for authentication testing
func (f *TestDataFactory) CreateAuthenticatedUser() (db.User, db.Session) {
	user := f.NewUser().Create()
	session := f.NewSession().
		WithUserID(user.ID).
		ExpiringIn(24 * time.Hour).
		Create()

	return user, session
}

// Helper method to get next sequence number
func (f *TestDataFactory) nextSequence() int {
	seq := f.sequence
	f.sequence++
	return seq
}

// ResetSequence resets the sequence counter for predictable test data
func (f *TestDataFactory) ResetSequence() {
	f.sequence = 1
}

// Batch creation methods for performance testing

// CreateUsersInBatch creates multiple users efficiently
func (f *TestDataFactory) CreateUsersInBatch(count int) []db.User {
	users := make([]db.User, count)

	for i := 0; i < count; i++ {
		users[i] = f.NewUser().
			WithUsername("batch_user_" + strconv.Itoa(i)).
			WithEmail("batch_user_" + strconv.Itoa(i) + "@test.com").
			Create()
	}

	return users
}

// CreateGamesInBatch creates multiple games efficiently
func (f *TestDataFactory) CreateGamesInBatch(count int, gmUserID int32) []db.Game {
	games := make([]db.Game, count)

	for i := 0; i < count; i++ {
		games[i] = f.NewGame().
			WithTitle("Batch Game " + strconv.Itoa(i)).
			WithGM(gmUserID).
			Create()
	}

	return games
}
