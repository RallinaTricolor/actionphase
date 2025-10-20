package core

import (
	models "actionphase/pkg/db/models"
	"context"
	"io"
	"time"
)

// SessionServiceInterface defines the contract for session management operations.
// Sessions are used to manage JWT refresh tokens and provide secure token renewal.
//
// Usage Example:
//
//	sessionService := &services.SessionService{DB: pool}
//
//	// Create a new session for user login
//	session := &Session{
//	    User:  user,
//	    Token: "refresh_token_string",
//	}
//	createdSession, err := sessionService.CreateSession(session)
//
//	// Retrieve session by refresh token
//	session, err := sessionService.SessionByToken("refresh_token")
//
//	// Clean up expired sessions
//	err := sessionService.DeleteSessionByToken("old_token")
type SessionServiceInterface interface {
	// Session retrieves a session by ID
	Session(id int) (*Session, error)

	// SessionByToken retrieves a session by its token
	SessionByToken(token string) (*Session, error)

	// Sessions retrieves all sessions (primarily for admin operations)
	Sessions() ([]*Session, error)

	// CreateSession creates a new session for a user
	CreateSession(session *Session) (*Session, error)

	// DeleteSessionByToken removes a session by its token
	DeleteSessionByToken(token string) error
}

// UserServiceInterface defines the contract for user management operations.
// Handles user account lifecycle including registration, authentication, and profile management.
//
// Usage Example:
//
//	userService := &services.UserService{DB: pool}
//
//	// Create a new user account
//	user := &User{
//	    Username: "player1",
//	    Email:    "player1@example.com",
//	    Password: "plaintext_password",
//	}
//	user.HashPassword() // Hash password before storage
//	createdUser, err := userService.CreateUser(user)
//
//	// Authenticate user login
//	user, err := userService.UserByUsername("player1")
//	if user != nil && user.CheckPasswordHash("attempted_password") {
//	    // User authenticated successfully
//	}
//
//	// Retrieve user for authorization
//	user, err := userService.User(userID)
type UserServiceInterface interface {
	// User retrieves a user by ID
	User(id int) (*User, error)

	// UserByUsername retrieves a user by username
	UserByUsername(username string) (*User, error)

	// Users retrieves all users (primarily for admin operations)
	Users() ([]*User, error)

	// CreateUser creates a new user account
	CreateUser(user *User) (*User, error)

	// DeleteUser removes a user account
	DeleteUser(id int) error
}

// GameServiceInterface defines the contract for game management operations.
// Handles complete game lifecycle from creation through completion, including
// participant management and state transitions.
//
// Usage Example:
//
//	gameService := &services.GameService{DB: pool}
//
//	// Create a new game
//	game, err := gameService.CreateGame(ctx, CreateGameRequest{
//	    Title:       "Epic D&D Campaign",
//	    Description: "A thrilling adventure in the Forgotten Realms",
//	    GMUserID:    int32(gmUser.ID),
//	    Genre:       "Fantasy RPG",
//	    MaxPlayers:  6,
//	    IsPublic:    true,
//	})
//
//	// Transition game to accept players
//	game, err = gameService.UpdateGameState(ctx, game.ID, "recruitment")
//
//	// Players apply to join the game (no direct joining)
//	// Applications are handled by the GameApplicationService
//
//	// Check if user can perform actions
//	role, err := gameService.GetUserRole(ctx, game.ID, int32(user.ID))
//	if role == "gm" {
//	    // User is Game Master, allow game management
//	}
//
//	// Start the game when ready (auto-approves and converts applications)
//	game, err = gameService.UpdateGameState(ctx, game.ID, "character_creation")
type GameServiceInterface interface {
	// CreateGame creates a new game with the given parameters
	CreateGame(ctx context.Context, req CreateGameRequest) (*models.Game, error)

	// GetGame retrieves a game by its ID
	GetGame(ctx context.Context, gameID int32) (*models.Game, error)

	// GetGamesByUser retrieves all games associated with a user
	GetGamesByUser(ctx context.Context, userID int32) ([]models.GetGamesByUserRow, error)

	// GetAllGames retrieves all games in the system
	GetAllGames(ctx context.Context) ([]models.GetAllGamesRow, error)

	// UpdateGameState updates the state of a game (setup, recruitment, in_progress, etc.)
	UpdateGameState(ctx context.Context, gameID int32, newState string) (*models.Game, error)

	// UpdateGame updates game details
	UpdateGame(ctx context.Context, req UpdateGameRequest) (*models.Game, error)

	// DeleteGame removes a game from the system
	DeleteGame(ctx context.Context, gameID int32) error

	// LeaveGame allows a user to leave a game
	LeaveGame(ctx context.Context, gameID, userID int32) error

	// GetUserRole determines a user's role in a specific game
	GetUserRole(ctx context.Context, gameID, userID int32) (string, error)

	// IsUserInGame checks if a user is participating in a game
	IsUserInGame(ctx context.Context, gameID, userID int32) (bool, error)

	// GetGameWithDetails retrieves a game with additional metadata
	GetGameWithDetails(ctx context.Context, gameID int32) (*models.GetGameWithDetailsRow, error)

	// GetRecruitingGames retrieves all games currently accepting new players
	GetRecruitingGames(ctx context.Context) ([]models.GetRecruitingGamesRow, error)

	// CanUserJoinGame checks if a user is eligible to join a specific game
	CanUserJoinGame(ctx context.Context, gameID, userID int32) (string, error)

	// AddGameParticipant adds a user as a participant to a game
	AddGameParticipant(ctx context.Context, gameID, userID int32, role string) (*models.GameParticipant, error)

	// RemoveGameParticipant removes a user from game participants
	RemoveGameParticipant(ctx context.Context, gameID, userID int32) error

	// GetGameParticipants retrieves all participants for a game
	GetGameParticipants(ctx context.Context, gameID int32) ([]models.GetGameParticipantsRow, error)
}

// GameApplicationServiceInterface defines the contract for game application operations.
// Handles the application flow where players apply to join games and require GM approval.
//
// Usage Example:
//
//	applicationService := &services.GameApplicationService{DB: pool}
//
//	// Player applies to join a game
//	application, err := applicationService.CreateGameApplication(ctx, CreateGameApplicationRequest{
//	    GameID:  123,
//	    UserID:  456,
//	    Role:    "player",
//	    Message: "I'd love to play a wizard in this campaign!",
//	})
//
//	// GM views all applications for their game
//	applications, err := applicationService.GetGameApplications(ctx, 123)
//
//	// GM approves an application
//	err = applicationService.ApproveGameApplication(ctx, application.ID, gmUserID)
//
//	// Check if user can apply to a game
//	canApply, err := applicationService.CanUserApplyToGame(ctx, gameID, userID)
type GameApplicationServiceInterface interface {
	// CreateGameApplication creates a new application to join a game
	CreateGameApplication(ctx context.Context, req CreateGameApplicationRequest) (*models.GameApplication, error)

	// GetGameApplication retrieves a specific application by ID
	GetGameApplication(ctx context.Context, applicationID int32) (*models.GameApplication, error)

	// GetGameApplications retrieves all applications for a game with user details
	GetGameApplications(ctx context.Context, gameID int32) ([]models.GetGameApplicationsRow, error)

	// GetGameApplicationsByStatus retrieves applications for a game filtered by status
	GetGameApplicationsByStatus(ctx context.Context, gameID int32, status string) ([]models.GetGameApplicationsByStatusRow, error)

	// GetUserGameApplications retrieves all applications submitted by a user
	GetUserGameApplications(ctx context.Context, userID int32) ([]models.GetUserGameApplicationsRow, error)

	// ApproveGameApplication approves an application and optionally creates participant
	ApproveGameApplication(ctx context.Context, applicationID, reviewerID int32) error

	// RejectGameApplication rejects an application
	RejectGameApplication(ctx context.Context, applicationID, reviewerID int32) error

	// WithdrawGameApplication allows applicant to withdraw their application
	WithdrawGameApplication(ctx context.Context, applicationID, userID int32) error

	// DeleteGameApplication removes an application (for cleanup)
	DeleteGameApplication(ctx context.Context, applicationID, userID int32) error

	// CanUserApplyToGame checks if a user is eligible to apply to a game
	CanUserApplyToGame(ctx context.Context, gameID, userID int32) (string, error)

	// HasUserAppliedToGame checks if user has an existing application
	HasUserAppliedToGame(ctx context.Context, gameID, userID int32) (bool, error)

	// CountPendingApplicationsForGame returns count of pending applications
	CountPendingApplicationsForGame(ctx context.Context, gameID int32) (int64, error)

	// BulkApproveApplications approves all pending applications for a game
	BulkApproveApplications(ctx context.Context, gameID, reviewerID int32) error

	// GetApprovedApplicationsForGame retrieves approved applications for participant creation
	GetApprovedApplicationsForGame(ctx context.Context, gameID int32) ([]models.GetApprovedApplicationsForGameRow, error)
}

// CreateGameRequest represents the parameters needed to create a new game
type CreateGameRequest struct {
	Title               string
	Description         string
	GMUserID            int32
	Genre               string
	StartDate           *time.Time
	EndDate             *time.Time
	RecruitmentDeadline *time.Time
	MaxPlayers          int32
	IsPublic            bool
	IsAnonymous         bool
}

// UpdateGameRequest represents the parameters needed to update an existing game
type UpdateGameRequest struct {
	ID                  int32
	Title               string
	Description         string
	Genre               string
	StartDate           *time.Time
	EndDate             *time.Time
	RecruitmentDeadline *time.Time
	MaxPlayers          int32
	IsPublic            bool
	IsAnonymous         bool
}

// PhaseServiceInterface defines the contract for game phase management operations.
// Handles the alternating Common Room and Action phases that define ActionPhase gameplay.
//
// Usage Example:
//
//	phaseService := &services.PhaseService{DB: pool}
//
//	// Create the first phase for a new game
//	phase, err := phaseService.CreatePhase(ctx, CreatePhaseRequest{
//	    GameID:      123,
//	    PhaseType:   "common_room",
//	    PhaseNumber: 1,
//	    Title:       "Opening Scene",
//	    StartTime:   time.Now(),
//	    EndTime:     time.Now().Add(48 * time.Hour),
//	})
//
//	// Transition to action phase
//	actionPhase, err := phaseService.TransitionToNextPhase(ctx, 123, gmUserID,
//	    TransitionPhaseRequest{
//	        PhaseType: "action",
//	        Title:     "Submit Your Actions",
//	        Deadline:  time.Now().Add(72 * time.Hour),
//	    })
//
//	// Get current active phase
//	currentPhase, err := phaseService.GetActivePhase(ctx, gameID)
type PhaseServiceInterface interface {
	// CreatePhase creates a new phase for a game
	CreatePhase(ctx context.Context, req CreatePhaseRequest) (*models.GamePhase, error)

	// GetPhase retrieves a specific phase by ID
	GetPhase(ctx context.Context, phaseID int32) (*models.GamePhase, error)

	// GetActivePhase retrieves the currently active phase for a game
	GetActivePhase(ctx context.Context, gameID int32) (*models.GamePhase, error)

	// GetGamePhases retrieves all phases for a game in chronological order
	GetGamePhases(ctx context.Context, gameID int32) ([]models.GamePhase, error)

	// UpdatePhase updates phase details (title, description, times)
	UpdatePhase(ctx context.Context, req UpdatePhaseRequest) (*models.GamePhase, error)

	// TransitionToNextPhase ends current phase and starts a new one
	TransitionToNextPhase(ctx context.Context, gameID, userID int32, req TransitionPhaseRequest) (*models.GamePhase, error)

	// ExtendPhaseDeadline extends the end time or deadline of a phase
	ExtendPhaseDeadline(ctx context.Context, phaseID int32, newDeadline time.Time) (*models.GamePhase, error)

	// ActivatePhase makes a specific phase the active phase for a game
	ActivatePhase(ctx context.Context, phaseID, userID int32) error

	// DeactivatePhase ends the current active phase
	DeactivatePhase(ctx context.Context, gameID, userID int32) error

	// GetPhaseHistory retrieves phase transition history for a game
	GetPhaseHistory(ctx context.Context, gameID int32) ([]PhaseTransitionInfo, error)
}

// ActionSubmissionServiceInterface defines the contract for action submission operations.
// Handles player action submissions during Action phases of games.
//
// Usage Example:
//
//	actionService := &services.ActionSubmissionService{DB: pool}
//
//	// Player submits action during action phase
//	submission, err := actionService.SubmitAction(ctx, SubmitActionRequest{
//	    GameID:    123,
//	    PhaseID:   456,
//	    UserID:    789,
//	    Content:   richTextContent,
//	    IsDraft:   false,
//	})
//
//	// GM retrieves all submissions for processing
//	submissions, err := actionService.GetPhaseSubmissions(ctx, phaseID)
//
//	// GM sends result to player
//	result, err := actionService.CreateActionResult(ctx, CreateActionResultRequest{
//	    GameID:             123,
//	    PhaseID:            456,
//	    UserID:             789,
//	    ActionSubmissionID: submission.ID,
//	    Content:            gmResponseContent,
//	})
type ActionSubmissionServiceInterface interface {
	// SubmitAction creates or updates an action submission for a phase
	SubmitAction(ctx context.Context, req SubmitActionRequest) (*models.ActionSubmission, error)

	// GetActionSubmission retrieves a specific action submission
	GetActionSubmission(ctx context.Context, submissionID int32) (*models.ActionSubmission, error)

	// GetUserPhaseSubmission retrieves a user's submission for a specific phase
	GetUserPhaseSubmission(ctx context.Context, phaseID, userID int32) (*models.ActionSubmission, error)

	// GetPhaseSubmissions retrieves all submissions for a phase (GM only)
	GetPhaseSubmissions(ctx context.Context, phaseID int32) ([]models.ActionSubmission, error)

	// DeleteActionSubmission removes an action submission (before deadline)
	DeleteActionSubmission(ctx context.Context, submissionID, userID int32) error

	// CreateActionResult creates a GM result for an action submission
	CreateActionResult(ctx context.Context, req CreateActionResultRequest) (*models.ActionResult, error)

	// GetActionResult retrieves a specific action result
	GetActionResult(ctx context.Context, resultID int32) (*models.ActionResult, error)

	// GetUserPhaseResults retrieves all results for a user in a phase
	GetUserPhaseResults(ctx context.Context, phaseID, userID int32) ([]models.ActionResult, error)

	// PublishActionResult makes an action result visible to the player
	PublishActionResult(ctx context.Context, resultID, userID int32) error

	// PublishAllPhaseResults publishes all unpublished results for a phase
	PublishAllPhaseResults(ctx context.Context, phaseID int32) error

	// GetUnpublishedResultsCount returns the count of unpublished results for a phase
	GetUnpublishedResultsCount(ctx context.Context, phaseID int32) (int64, error)

	// UpdateActionResult updates the content of an unpublished action result
	UpdateActionResult(ctx context.Context, resultID int32, content string) (*models.ActionResult, error)

	// GetSubmissionStats returns statistics about submissions for a phase
	GetSubmissionStats(ctx context.Context, phaseID int32) (*ActionSubmissionStats, error)

	// CanUserSubmitAction checks if user can submit/edit actions for a phase
	CanUserSubmitAction(ctx context.Context, phaseID, userID int32) (bool, error)
}

// MessageServiceInterface defines the contract for message and comment operations.
// Handles both Common Room posts/comments and future private messaging between characters.
//
// Key Design Principles:
// - All messages MUST be sent as a character (character_id is required)
// - Visibility types: 'game' (Common Room) or 'private' (future DMs)
// - Reddit-style threading: parent_id creates threaded conversations
// - Thread building: Frontend recursively calls GetPostComments to build comment trees
//
// Usage Example:
//
//	messageService := &services.MessageService{DB: pool}
//
//	// Create a Common Room post
//	post, err := messageService.CreatePost(ctx, CreatePostRequest{
//	    GameID:      123,
//	    PhaseID:     456,
//	    AuthorID:    789,
//	    CharacterID: 111,
//	    Content:     "What should we do next?",
//	    Visibility:  "game",
//	})
//
//	// Add a comment to the post
//	comment, err := messageService.CreateComment(ctx, CreateCommentRequest{
//	    GameID:      123,
//	    PhaseID:     456,
//	    AuthorID:    222,
//	    CharacterID: 333,
//	    Content:     "I think we should investigate the old ruins",
//	    ParentID:    post.ID,
//	    Visibility:  "game",
//	})
//
//	// Get all posts for a game
//	posts, err := messageService.GetGamePosts(ctx, gameID, phaseID, limit, offset)
//
//	// Get comments for a post (direct children only - frontend builds tree)
//	comments, err := messageService.GetPostComments(ctx, postID)
type MessageServiceInterface interface {
	// CreatePost creates a new top-level message post
	CreatePost(ctx context.Context, req CreatePostRequest) (*models.Message, error)

	// GetPost retrieves a specific post by ID with metadata
	GetPost(ctx context.Context, postID int32) (*MessageWithDetails, error)

	// GetGamePosts retrieves posts for a game, optionally filtered by phase
	GetGamePosts(ctx context.Context, gameID int32, phaseID *int32, limit, offset int32) ([]MessageWithDetails, error)

	// GetPhasePosts retrieves all posts for a specific phase
	GetPhasePosts(ctx context.Context, phaseID int32) ([]MessageWithDetails, error)

	// UpdatePost updates the content of an existing post
	UpdatePost(ctx context.Context, postID int32, content string) (*models.Message, error)

	// DeletePost soft-deletes a post (preserves thread structure)
	DeletePost(ctx context.Context, postID int32) error

	// CreateComment creates a comment reply to a post or another comment
	CreateComment(ctx context.Context, req CreateCommentRequest) (*models.Message, error)

	// GetComment retrieves a specific comment by ID with metadata
	GetComment(ctx context.Context, commentID int32) (*MessageWithDetails, error)

	// GetPostComments retrieves direct child comments for a post or comment
	GetPostComments(ctx context.Context, parentID int32) ([]MessageWithDetails, error)

	// UpdateComment updates the content of an existing comment
	UpdateComment(ctx context.Context, commentID int32, content string) (*models.Message, error)

	// DeleteComment soft-deletes a comment (preserves thread structure)
	DeleteComment(ctx context.Context, commentID int32) error

	// GetGamePostCount returns total post count for a game
	GetGamePostCount(ctx context.Context, gameID int32, phaseID *int32) (int64, error)

	// GetPostCommentCount returns total comment count for a post
	GetPostCommentCount(ctx context.Context, postID int32) (int64, error)

	// GetUserPostsInGame retrieves all posts by a user in a game
	GetUserPostsInGame(ctx context.Context, gameID, userID int32) ([]MessageWithDetails, error)

	// AddReaction adds a reaction to a message
	AddReaction(ctx context.Context, messageID, userID int32, reactionType string) (*models.MessageReaction, error)

	// RemoveReaction removes a reaction from a message
	RemoveReaction(ctx context.Context, messageID, userID int32, reactionType string) error

	// GetMessageReactions retrieves all reactions for a message
	GetMessageReactions(ctx context.Context, messageID int32) ([]models.GetMessageReactionsRow, error)

	// GetReactionCounts retrieves reaction counts grouped by type
	GetReactionCounts(ctx context.Context, messageID int32) ([]models.GetReactionCountsRow, error)

	// ValidateCharacterOwnership verifies character belongs to author and game
	ValidateCharacterOwnership(ctx context.Context, characterID, authorID, gameID int32) error
}

// CreatePhaseRequest represents the parameters needed to create a new game phase
type CreatePhaseRequest struct {
	GameID      int32
	PhaseType   string // "common_room", "action", "results"
	PhaseNumber int32
	Title       string
	Description string
	StartTime   *time.Time
	EndTime     *time.Time
	Deadline    *time.Time // For action phases
}

// UpdatePhaseRequest represents the parameters needed to update a phase
type UpdatePhaseRequest struct {
	ID          int32
	Title       string
	Description string
	StartTime   *time.Time
	EndTime     *time.Time
	Deadline    *time.Time
}

// TransitionPhaseRequest represents the parameters for phase transitions
type TransitionPhaseRequest struct {
	PhaseType   string // "common_room", "action", "results"
	Title       string
	Description string
	Duration    *time.Duration // If specified, calculates EndTime from now
	EndTime     *time.Time     // Explicit end time
	Deadline    *time.Time     // For action phases
	Reason      string         // Optional reason for transition
}

// SubmitActionRequest represents the parameters needed to submit an action
type SubmitActionRequest struct {
	GameID      int32
	PhaseID     int32
	UserID      int32
	CharacterID *int32      // Optional reference to character
	Content     interface{} // Rich text content (JSON)
	IsDraft     bool
}

// CreateActionResultRequest represents the parameters needed to create action results
type CreateActionResultRequest struct {
	GameID             int32
	PhaseID            int32
	UserID             int32
	GMUserID           int32       // The GM creating the result
	ActionSubmissionID *int32      // Optional reference to submission
	Content            interface{} // Rich text content (JSON)
	IsPublished        bool
}

// ActionSubmissionStats provides statistics about action submissions for a phase
type ActionSubmissionStats struct {
	PhaseID          int32
	TotalPlayers     int32
	SubmittedCount   int32
	DraftCount       int32
	SubmissionRate   float64 // Percentage of players who submitted
	AverageWordCount int32
	LatestSubmission *time.Time
}

// PhaseTransitionInfo represents a phase transition record
type PhaseTransitionInfo struct {
	ID              int32
	GameID          int32
	FromPhaseID     *int32
	ToPhaseID       int32
	InitiatedBy     int32
	Reason          string
	CreatedAt       time.Time
	FromPhaseType   string // Type of phase transitioned from
	ToPhaseType     string // Type of phase transitioned to
	FromPhaseNum    int32  // Phase number transitioned from
	ToPhaseNum      int32  // Phase number transitioned to
	InitiatedByUser string // Username who initiated transition
}

// CreateGameApplicationRequest represents the parameters needed to create a game application
type CreateGameApplicationRequest struct {
	GameID  int32
	UserID  int32
	Role    string
	Message string
}

// CreatePostRequest represents the parameters needed to create a new post
type CreatePostRequest struct {
	GameID      int32
	PhaseID     *int32 // Optional - can be nil for game-wide posts
	AuthorID    int32
	CharacterID int32
	Content     string
	Visibility  string // "game" or "private"
}

// CreateCommentRequest represents the parameters needed to create a comment
type CreateCommentRequest struct {
	GameID      int32
	PhaseID     *int32 // Optional - inherits from parent
	AuthorID    int32
	CharacterID int32
	Content     string
	ParentID    int32  // Required - the post or comment being replied to
	Visibility  string // "game" or "private"
}

// MessageWithDetails represents a message with additional metadata
type MessageWithDetails struct {
	models.Message
	AuthorUsername     string
	CharacterName      string
	CharacterAvatarUrl *string // Optional - character's avatar URL
	CommentCount       int64   // For posts
	ReplyCount         int64   // For comments
}

// NotificationServiceInterface defines the contract for notification operations.
// Handles creating, retrieving, and managing user notifications.
//
// Usage Example:
//
//	notificationService := &services.NotificationService{DB: pool}
//
//	// Create a notification
//	notification, err := notificationService.CreateNotification(ctx, &CreateNotificationRequest{
//	    UserID: 123,
//	    GameID: &gameID,
//	    Type:   NotificationTypeActionResult,
//	    Title:  "You received an action result",
//	    LinkURL: &linkURL,
//	})
//
//	// Get unread count
//	count, err := notificationService.GetUnreadCount(ctx, userID)
//
//	// Mark as read
//	err := notificationService.MarkAsRead(ctx, notificationID, userID)
type NotificationServiceInterface interface {
	// CreateNotification creates a new notification for a user
	CreateNotification(ctx context.Context, req *CreateNotificationRequest) (*Notification, error)

	// CreateBulkNotifications creates notifications for multiple users at once
	// Used for game-wide notifications (e.g., new phase, new post)
	CreateBulkNotifications(ctx context.Context, userIDs []int32, req *CreateNotificationRequest) error

	// GetUserNotifications retrieves a user's notifications with pagination
	GetUserNotifications(ctx context.Context, userID int32, limit, offset int) ([]*Notification, error)

	// GetUnreadCount returns the count of unread notifications for a user
	GetUnreadCount(ctx context.Context, userID int32) (int64, error)

	// GetUnreadNotifications retrieves only unread notifications for a user
	GetUnreadNotifications(ctx context.Context, userID int32, limit int) ([]*Notification, error)

	// MarkAsRead marks a notification as read
	MarkAsRead(ctx context.Context, notificationID, userID int32) error

	// MarkAllAsRead marks all of a user's unread notifications as read
	MarkAllAsRead(ctx context.Context, userID int32) error

	// DeleteNotification deletes a notification (user must own it)
	DeleteNotification(ctx context.Context, notificationID, userID int32) error

	// DeleteOldReadNotifications cleans up read notifications older than 30 days
	// Called by background job
	DeleteOldReadNotifications(ctx context.Context) error

	// Helper methods for common notification scenarios
	// These methods handle the creation logic for specific notification types

	// NotifyPrivateMessage creates a notification for a new private message
	NotifyPrivateMessage(ctx context.Context, recipientUserID int32, messageID int32, gameID int32, senderCharacterName string) error

	// NotifyCommentReply creates a notification when someone replies to a comment
	NotifyCommentReply(ctx context.Context, originalCommentAuthorID int32, replyID int32, gameID int32, replierCharacterName string) error

	// NotifyCharacterMention creates a notification when a character is mentioned
	NotifyCharacterMention(ctx context.Context, characterOwnerID int32, commentID int32, gameID int32, mentioningCharacterName string, mentionedCharacterName string) error

	// NotifyActionSubmitted creates a notification for GM when player submits action
	NotifyActionSubmitted(ctx context.Context, gmUserID int32, actionID int32, gameID int32, characterName string) error

	// NotifyActionResult creates a notification for player when GM publishes result
	NotifyActionResult(ctx context.Context, playerUserID int32, resultID int32, gameID int32, actionTitle string) error

	// NotifyCommonRoomPost creates notifications for all game participants about new post
	NotifyCommonRoomPost(ctx context.Context, gameID int32, postID int32, postTitle string, excludeUserID int32) error

	// NotifyPhaseCreated creates notifications for all participants when phase created
	NotifyPhaseCreated(ctx context.Context, gameID int32, phaseID int32, phaseTitle string, excludeUserID int32) error

	// NotifyApplicationStatusChange creates notification for application approval/rejection
	NotifyApplicationStatusChange(ctx context.Context, playerUserID int32, gameID int32, gameTitle string, approved bool) error

	// NotifyCharacterStatusChange creates notification for character approval/rejection
	NotifyCharacterStatusChange(ctx context.Context, playerUserID int32, gameID int32, characterID int32, characterName string, approved bool) error
}

// StorageBackendInterface defines the contract for file storage operations.
// Supports both local filesystem and cloud storage (S3-compatible).
//
// Usage Example:
//
//	// Local storage
//	localStorage := storage.NewLocalStorage("/var/uploads", "http://localhost:3000/uploads")
//	avatarURL, err := localStorage.Upload(ctx, "avatars/characters/1/avatar.jpg", file, "image/jpeg")
//
//	// S3 storage
//	s3Storage := storage.NewS3Storage("my-bucket", "us-east-1", "https://cdn.example.com")
//	avatarURL, err := s3Storage.Upload(ctx, "avatars/characters/1/avatar.jpg", file, "image/jpeg")
type StorageBackendInterface interface {
	// Upload saves a file to storage and returns its public URL
	// path: relative path within storage (e.g., "avatars/characters/1/avatar.jpg")
	// file: the file data to upload
	// contentType: MIME type of the file (e.g., "image/jpeg")
	Upload(ctx context.Context, path string, file io.Reader, contentType string) (string, error)

	// Delete removes a file from storage
	// path: relative path within storage
	Delete(ctx context.Context, path string) error

	// GetURL returns the public URL for a file path
	// path: relative path within storage
	GetURL(path string) string
}

// AvatarServiceInterface defines the contract for avatar management operations.
// Handles character avatar uploads, deletion, and storage cleanup.
//
// Usage Example:
//
//	avatarService := &services.AvatarService{
//	    DB: pool,
//	    Storage: localStorage,
//	    CharacterService: characterService,
//	}
//
//	// Upload character avatar
//	avatarURL, err := avatarService.UploadCharacterAvatar(ctx, characterID, file, "avatar.jpg", "image/jpeg")
//
//	// Delete character avatar
//	err := avatarService.DeleteCharacterAvatar(ctx, characterID)
type AvatarServiceInterface interface {
	// UploadCharacterAvatar uploads an avatar image for a character
	// Returns the public URL of the uploaded avatar
	// Validates file type (must be image/jpeg, image/png, or image/webp)
	// Validates file size (must be <= 5MB)
	// Deletes previous avatar if exists
	UploadCharacterAvatar(ctx context.Context, characterID int32, file io.Reader, filename string, contentType string) (string, error)

	// DeleteCharacterAvatar removes a character's avatar
	// Deletes the file from storage and updates database
	DeleteCharacterAvatar(ctx context.Context, characterID int32) error

	// GetCharacterAvatarURL retrieves the avatar URL for a character
	// Returns nil if character has no avatar
	GetCharacterAvatarURL(ctx context.Context, characterID int32) (*string, error)
}

// DashboardServiceInterface defines the contract for dashboard data operations.
// Provides aggregated view of user's games, deadlines, and activity for the dashboard page.
//
// Usage Example:
//
//	dashboardService := &services.DashboardService{DB: pool}
//
//	// Get user's complete dashboard data
//	dashboard, err := dashboardService.GetUserDashboard(ctx, userID)
//	if !dashboard.HasGames {
//	    // Redirect user to games listing page
//	}
//
//	// Access urgent games requiring action
//	for _, game := range dashboard.PlayerGames {
//	    if game.IsUrgent {
//	        // Display with urgent styling
//	    }
//	}
type DashboardServiceInterface interface {
	// GetUserDashboard retrieves complete dashboard data for a user
	// Returns aggregated game information, recent activity, and upcoming deadlines
	// If user has no games, returns DashboardData with HasGames = false
	GetUserDashboard(ctx context.Context, userID int32) (*DashboardData, error)
}
