package db

import (
	"actionphase/pkg/core"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserService_CreateUser(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &UserService{DB: testDB.Pool}

	t.Run("creates user successfully", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		user := &core.User{
			Username: "testuser",
			Password: "password123",
			Email:    "test@example.com",
		}

		created, err := service.CreateUser(user)
		require.NoError(t, err)
		require.NotNil(t, created)

		assert.Greater(t, created.ID, 0)
		assert.Equal(t, "testuser", created.Username)
		assert.Equal(t, "test@example.com", created.Email)
		assert.NotNil(t, created.CreatedAt)

		// Password should be hashed (not the original password)
		assert.NotEqual(t, "password123", user.Password)
		assert.NotEmpty(t, user.Password) // Should contain bcrypt hash
	})

	t.Run("hashes password before storing", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		plainPassword := "password123"
		user := &core.User{
			Username: "hashtest",
			Password: plainPassword,
			Email:    "hash@example.com",
		}

		created, err := service.CreateUser(user)
		require.NoError(t, err)
		assert.NotNil(t, created)

		// The original password in the user object should be hashed
		assert.NotEqual(t, plainPassword, user.Password)
		assert.Greater(t, len(user.Password), 50) // Bcrypt hashes are 60 chars

		// Verify we can retrieve the user and password is hashed
		retrieved, err := service.UserByUsername("hashtest")
		require.NoError(t, err)
		assert.NotEqual(t, plainPassword, retrieved.Password)
		assert.Equal(t, user.Password, retrieved.Password) // Should match the hashed version
	})

	t.Run("returns error for duplicate username", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		user1 := &core.User{
			Username: "duplicate",
			Password: "password123",
			Email:    "user1@example.com",
		}

		_, err := service.CreateUser(user1)
		require.NoError(t, err)

		// Try to create another user with same username
		user2 := &core.User{
			Username: "duplicate",
			Password: "password456",
			Email:    "user2@example.com",
		}

		_, err = service.CreateUser(user2)
		assert.Error(t, err)
	})

	t.Run("returns error for duplicate email", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		user1 := &core.User{
			Username: "user1",
			Password: "password123",
			Email:    "duplicate@example.com",
		}

		_, err := service.CreateUser(user1)
		require.NoError(t, err)

		// Try to create another user with same email
		user2 := &core.User{
			Username: "user2",
			Password: "password456",
			Email:    "duplicate@example.com",
		}

		_, err = service.CreateUser(user2)
		assert.Error(t, err)
	})
}

func TestUserService_UserByUsername(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &UserService{DB: testDB.Pool}

	t.Run("retrieves user by username", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Create a user
		created := &core.User{
			Username: "findme",
			Password: "password123",
			Email:    "findme@example.com",
		}

		_, err := service.CreateUser(created)
		require.NoError(t, err)

		// Retrieve by username
		retrieved, err := service.UserByUsername("findme")
		require.NoError(t, err)
		require.NotNil(t, retrieved)

		assert.Equal(t, "findme", retrieved.Username)
		assert.Equal(t, "findme@example.com", retrieved.Email)
		assert.NotEmpty(t, retrieved.Password) // Should have hashed password
		assert.NotNil(t, retrieved.CreatedAt)
	})

	t.Run("returns error for non-existent username", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		user, err := service.UserByUsername("doesnotexist")
		assert.Error(t, err)
		assert.Nil(t, user)
	})

	t.Run("username is case-sensitive", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Create a user with specific casing
		created := &core.User{
			Username: "CaseSensitive",
			Password: "password123",
			Email:    "case@example.com",
		}

		_, err := service.CreateUser(created)
		require.NoError(t, err)

		// Should find with exact case
		found, err := service.UserByUsername("CaseSensitive")
		require.NoError(t, err)
		assert.Equal(t, "CaseSensitive", found.Username)

		// Should not find with different case
		notFound, err := service.UserByUsername("casesensitive")
		assert.Error(t, err)
		assert.Nil(t, notFound)
	})
}

func TestUserService_User(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &UserService{DB: testDB.Pool}

	t.Run("stub implementation returns nil", func(t *testing.T) {
		// This function is currently a stub that returns nil, nil
		user, err := service.User(1)
		assert.Nil(t, user)
		assert.Nil(t, err)
	})
}

func TestUserService_Users(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &UserService{DB: testDB.Pool}

	t.Run("stub implementation returns nil", func(t *testing.T) {
		// This function is currently a stub that returns nil, nil
		users, err := service.Users()
		assert.Nil(t, users)
		assert.Nil(t, err)
	})
}

func TestUserService_DeleteUser(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &UserService{DB: testDB.Pool}

	t.Run("stub implementation returns nil", func(t *testing.T) {
		// This function is currently a stub that returns nil
		err := service.DeleteUser(1)
		assert.Nil(t, err)
	})
}

func TestUserService_IntegrationWorkflow(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()

	service := &UserService{DB: testDB.Pool}

	t.Run("complete user lifecycle", func(t *testing.T) {
		defer testDB.CleanupTables(t, "users")

		// Create multiple users
		users := []*core.User{
			{
				Username: "alice",
				Password: "alicepass",
				Email:    "alice@example.com",
			},
			{
				Username: "bob",
				Password: "bobpass",
				Email:    "bob@example.com",
			},
			{
				Username: "charlie",
				Password: "charliepass",
				Email:    "charlie@example.com",
			},
		}

		for _, u := range users {
			created, err := service.CreateUser(u)
			require.NoError(t, err)
			assert.Greater(t, created.ID, 0)
		}

		// Retrieve each user by username
		alice, err := service.UserByUsername("alice")
		require.NoError(t, err)
		assert.Equal(t, "alice@example.com", alice.Email)

		bob, err := service.UserByUsername("bob")
		require.NoError(t, err)
		assert.Equal(t, "bob@example.com", bob.Email)

		charlie, err := service.UserByUsername("charlie")
		require.NoError(t, err)
		assert.Equal(t, "charlie@example.com", charlie.Email)

		// Verify all have different IDs
		assert.NotEqual(t, alice.ID, bob.ID)
		assert.NotEqual(t, bob.ID, charlie.ID)
		assert.NotEqual(t, alice.ID, charlie.ID)

		// Verify all passwords are hashed and different
		assert.NotEqual(t, alice.Password, bob.Password)
		assert.NotEqual(t, bob.Password, charlie.Password)
	})
}
