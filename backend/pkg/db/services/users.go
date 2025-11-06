package db

import (
	"actionphase/pkg/core"
	db "actionphase/pkg/db/models"
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserService struct {
	DB *pgxpool.Pool
}

// Ensure UserService implements the interface
var _ core.UserServiceInterface = (*UserService)(nil)

// GetUserByID retrieves a user by their ID (primary key lookup)
func (s *UserService) GetUserByID(userID int) (*core.User, error) {
	ctx := context.Background()
	q := db.New(s.DB)
	dbUser, err := q.GetUser(ctx, int32(userID))
	if err != nil {
		return nil, err
	}

	// Convert ban fields
	var bannedAt *time.Time
	if dbUser.BannedAt.Valid {
		bannedAt = &dbUser.BannedAt.Time
	}

	var bannedByUserID *int32
	if dbUser.BannedByUserID.Valid {
		bannedByUserID = &dbUser.BannedByUserID.Int32
	}

	// Convert bio
	var bio *string
	if dbUser.Bio.Valid {
		bio = &dbUser.Bio.String
	}

	// Convert avatar URL
	var avatarURL *string
	if dbUser.AvatarUrl.Valid {
		avatarURL = &dbUser.AvatarUrl.String
	}

	return &core.User{
		ID:             int(dbUser.ID),
		Username:       dbUser.Username,
		Password:       dbUser.Password,
		Email:          dbUser.Email,
		EmailVerified:  dbUser.EmailVerified,
		Bio:            bio,
		AvatarURL:      avatarURL,
		IsAdmin:        dbUser.IsAdmin.Bool,
		IsBanned:       dbUser.IsBanned,
		BannedAt:       bannedAt,
		BannedByUserID: bannedByUserID,
		CreatedAt:      &dbUser.CreatedAt.Time,
	}, nil
}

// User is deprecated, use GetUserByID instead
func (s *UserService) User(id int) (*core.User, error) {
	return s.GetUserByID(id)
}

func (s *UserService) UserByUsername(username string) (*core.User, error) {
	ctx := context.Background()
	q := db.New(s.DB)
	dbUser, err := q.GetUserByUsername(ctx, username)
	if err != nil {
		return nil, err
	}

	// Convert ban fields
	var bannedAt *time.Time
	if dbUser.BannedAt.Valid {
		bannedAt = &dbUser.BannedAt.Time
	}

	var bannedByUserID *int32
	if dbUser.BannedByUserID.Valid {
		bannedByUserID = &dbUser.BannedByUserID.Int32
	}

	// Convert bio
	var bio *string
	if dbUser.Bio.Valid {
		bio = &dbUser.Bio.String
	}

	// Convert avatar URL
	var avatarURL *string
	if dbUser.AvatarUrl.Valid {
		avatarURL = &dbUser.AvatarUrl.String
	}

	return &core.User{
		ID:             int(dbUser.ID),
		Username:       dbUser.Username,
		Password:       dbUser.Password,
		Email:          dbUser.Email,
		EmailVerified:  dbUser.EmailVerified,
		Bio:            bio,
		AvatarURL:      avatarURL,
		IsAdmin:        dbUser.IsAdmin.Bool,
		IsBanned:       dbUser.IsBanned,
		BannedAt:       bannedAt,
		BannedByUserID: bannedByUserID,
		CreatedAt:      &dbUser.CreatedAt.Time,
	}, nil
}

func (s *UserService) UserByEmail(email string) (*core.User, error) {
	ctx := context.Background()
	q := db.New(s.DB)
	dbUser, err := q.GetUserByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	// Convert ban fields
	var bannedAt *time.Time
	if dbUser.BannedAt.Valid {
		bannedAt = &dbUser.BannedAt.Time
	}

	var bannedByUserID *int32
	if dbUser.BannedByUserID.Valid {
		bannedByUserID = &dbUser.BannedByUserID.Int32
	}

	// Convert bio
	var bio *string
	if dbUser.Bio.Valid {
		bio = &dbUser.Bio.String
	}

	// Convert avatar URL
	var avatarURL *string
	if dbUser.AvatarUrl.Valid {
		avatarURL = &dbUser.AvatarUrl.String
	}

	return &core.User{
		ID:             int(dbUser.ID),
		Username:       dbUser.Username,
		Password:       dbUser.Password,
		Email:          dbUser.Email,
		EmailVerified:  dbUser.EmailVerified,
		Bio:            bio,
		AvatarURL:      avatarURL,
		IsAdmin:        dbUser.IsAdmin.Bool,
		IsBanned:       dbUser.IsBanned,
		BannedAt:       bannedAt,
		BannedByUserID: bannedByUserID,
		CreatedAt:      &dbUser.CreatedAt.Time,
	}, nil
}

func (s *UserService) Users() ([]*core.User, error) {
	return nil, nil
}

func (s *UserService) CreateUser(u *core.User) (*core.User, error) {
	ctx := context.Background()
	u.HashPassword()
	q := db.New(s.DB)
	dbUser, err := q.CreateUser(ctx, db.CreateUserParams{
		Username: u.Username,
		Password: u.Password,
		Email:    u.Email,
	})
	return &core.User{
		ID:            int(dbUser.ID),
		Username:      dbUser.Username,
		Email:         dbUser.Email,
		EmailVerified: dbUser.EmailVerified,
		CreatedAt:     &dbUser.CreatedAt.Time,
	}, err
}

func (s *UserService) DeleteUser(id int) error {
	return nil
}

// SetAdminStatus grants or revokes admin privileges for a user
func (s *UserService) SetAdminStatus(ctx context.Context, userID int32, isAdmin bool, requesterID int32) error {
	q := db.New(s.DB)

	// Check if requester is admin
	requester, err := q.GetUser(ctx, requesterID)
	if err != nil {
		return err
	}

	if !requester.IsAdmin.Bool {
		return errors.New("Unauthorized: admin privileges required")
	}

	// Update admin status
	err = q.UpdateUserAdminStatus(ctx, db.UpdateUserAdminStatusParams{
		ID:      userID,
		IsAdmin: pgtype.Bool{Bool: isAdmin, Valid: true},
	})
	return err
}

// ListAdmins returns all users with admin privileges
func (s *UserService) ListAdmins(ctx context.Context) ([]*core.User, error) {
	q := db.New(s.DB)

	dbAdmins, err := q.ListAdmins(ctx)
	if err != nil {
		return nil, err
	}

	admins := make([]*core.User, 0, len(dbAdmins))
	for _, dbAdmin := range dbAdmins {
		admins = append(admins, &core.User{
			ID:        int(dbAdmin.ID),
			Username:  dbAdmin.Username,
			Email:     dbAdmin.Email,
			CreatedAt: &dbAdmin.CreatedAt.Time,
		})
	}

	return admins, nil
}

// BanUser bans a user from the platform
func (s *UserService) BanUser(ctx context.Context, userID int32, adminID int32) error {
	// Prevent admin from banning themselves
	if userID == adminID {
		return errors.New("Cannot ban yourself")
	}

	q := db.New(s.DB)

	// Ban the user
	err := q.BanUser(ctx, db.BanUserParams{
		ID:             userID,
		BannedByUserID: pgtype.Int4{Int32: adminID, Valid: true},
	})
	if err != nil {
		return err
	}

	// Invalidate all sessions for the banned user
	// This will be handled by SessionService
	return nil
}

// UnbanUser removes ban from a user
func (s *UserService) UnbanUser(ctx context.Context, userID int32) error {
	q := db.New(s.DB)
	return q.UnbanUser(ctx, userID)
}

// ListBannedUsers returns all banned users with ban details
func (s *UserService) ListBannedUsers(ctx context.Context) ([]*core.BannedUser, error) {
	q := db.New(s.DB)

	dbBannedUsers, err := q.ListBannedUsers(ctx)
	if err != nil {
		return nil, err
	}

	bannedUsers := make([]*core.BannedUser, 0, len(dbBannedUsers))
	for _, dbUser := range dbBannedUsers {
		bannedUsers = append(bannedUsers, &core.BannedUser{
			ID:               int(dbUser.ID),
			Username:         dbUser.Username,
			Email:            dbUser.Email,
			BannedAt:         dbUser.BannedAt.Time,
			BannedByUserID:   dbUser.BannedByUserID.Int32,
			BannedByUsername: dbUser.BannedByUsername.String,
			CreatedAt:        dbUser.CreatedAt.Time,
		})
	}

	return bannedUsers, nil
}

// CheckUserBanned checks if a user is currently banned
func (s *UserService) CheckUserBanned(ctx context.Context, userID int32) (bool, error) {
	q := db.New(s.DB)

	user, err := q.GetUser(ctx, userID)
	if err != nil {
		return false, err
	}

	return user.IsBanned, nil
}

// SearchUsers searches for users by username (case-insensitive partial match)
// Returns only non-banned users, limited to 20 results
func (s *UserService) SearchUsers(ctx context.Context, query string) ([]db.SearchUsersRow, error) {
	q := db.New(s.DB)
	return q.SearchUsers(ctx, pgtype.Text{String: query, Valid: true})
}
