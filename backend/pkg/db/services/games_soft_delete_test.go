package db

import (
	"context"
	"testing"
	"time"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestSoftDeletedGameHiddenFromCrossGameQueries covers the queries that list
// across games, which GetGame's filter cannot protect: each must drop a
// soft-deleted game while still returning an identical live one.
//
// Two games are built the same way -- a player, a character, a deadline, an
// application, a notification and a scheduled phase in each -- and one is
// deleted, so every assertion is "kept is there, deleted is not".
func TestSoftDeletedGameHiddenFromCrossGameQueries(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	app := core.NewTestApp(testDB.Pool)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "notifications", "game_applications", "game_deadlines",
		"characters", "game_phases", "game_participants", "games", "sessions", "users")

	ctx := context.Background()
	q := models.New(testDB.Pool)
	gameService := &GameService{DB: testDB.Pool, Logger: app.ObsLogger}

	gm := testDB.CreateTestUser(t, "sd_gm", "sd_gm@example.com")
	player := testDB.CreateTestUser(t, "sd_player", "sd_player@example.com")
	applicant := testDB.CreateTestUser(t, "sd_applicant", "sd_applicant@example.com")

	buildGame := func(title string) int32 {
		game := testDB.CreateTestGameWithState(t, int32(gm.ID), title, "in_progress")
		testDB.AddTestGameParticipant(t, game.ID, int32(player.ID), "player")

		_, err := q.CreateCharacter(ctx, models.CreateCharacterParams{
			GameID: game.ID, UserID: pgtype.Int4{Int32: int32(player.ID), Valid: true},
			Name: title + " Hero", CharacterType: "player_character", Status: "approved",
		})
		require.NoError(t, err)

		_, err = q.CreateDeadline(ctx, models.CreateDeadlineParams{
			GameID: game.ID, Title: title + " deadline", CreatedByUserID: int32(gm.ID),
			Deadline: pgtype.Timestamptz{Time: time.Now().Add(48 * time.Hour), Valid: true},
		})
		require.NoError(t, err)

		_, err = q.CreateGameApplication(ctx, models.CreateGameApplicationParams{
			GameID: game.ID, UserID: int32(applicant.ID), Role: "player",
		})
		require.NoError(t, err)

		_, err = q.CreateNotification(ctx, models.CreateNotificationParams{
			UserID: int32(player.ID), GameID: pgtype.Int4{Int32: game.ID, Valid: true},
			Type: "game_state_changed", Title: title + " notification",
		})
		require.NoError(t, err)

		// A phase the scheduler should auto-activate: inactive, start time passed.
		phase := testDB.CreateTestPhase(t, game.ID, "common_room", title+" phase")
		_, err = testDB.Pool.Exec(ctx,
			`UPDATE game_phases SET is_active = false, start_time = NOW() - INTERVAL '1 hour', end_time = NULL WHERE id = $1`,
			phase.ID)
		require.NoError(t, err)

		return game.ID
	}

	keptID := buildGame("Kept")
	deletedID := buildGame("Deleted")

	// A notification with no game must never be caught by the game filter.
	_, err := q.CreateNotification(ctx, models.CreateNotificationParams{
		UserID: int32(player.ID), Type: "game_state_changed", Title: "Gameless notification",
	})
	require.NoError(t, err)

	publicBefore, err := q.CountPublicGames(ctx)
	require.NoError(t, err)

	require.NoError(t, gameService.DeleteGame(ctx, deletedID, int32(gm.ID), false))

	// ids collects game ids from any row slice, so each check reads the same.
	assertKeptOnly := func(t *testing.T, ids []int32) {
		t.Helper()
		assert.Contains(t, ids, keptID, "live game should be listed")
		assert.NotContains(t, ids, deletedID, "soft-deleted game should not be listed")
	}

	t.Run("games list and counts", func(t *testing.T) {
		rows, err := q.GetFilteredGames(ctx, models.GetFilteredGamesParams{Column5: "created", Column7: 100})
		require.NoError(t, err)
		var ids []int32
		for _, r := range rows {
			ids = append(ids, r.ID)
		}
		assertKeptOnly(t, ids)

		count, err := q.CountFilteredGames(ctx, models.CountFilteredGamesParams{})
		require.NoError(t, err)
		assert.Equal(t, int64(len(rows)), count, "count must agree with the page")

		publicAfter, err := q.CountPublicGames(ctx)
		require.NoError(t, err)
		assert.Equal(t, publicBefore-1, publicAfter)
	})

	t.Run("user profile games", func(t *testing.T) {
		rows, err := q.GetUserGames(ctx, models.GetUserGamesParams{UserID: int32(player.ID), Limit: 100})
		require.NoError(t, err)
		var ids []int32
		for _, r := range rows {
			ids = append(ids, r.GameID)
		}
		assertKeptOnly(t, ids)

		count, err := q.CountUserProfileGames(ctx, int32(player.ID))
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)
	})

	t.Run("dashboard games and count", func(t *testing.T) {
		rows, err := q.GetUserDashboardGames(ctx, int32(player.ID))
		require.NoError(t, err)
		var ids []int32
		for _, r := range rows {
			ids = append(ids, r.ID)
		}
		assertKeptOnly(t, ids)

		count, err := q.CountUserGames(ctx, int32(player.ID))
		require.NoError(t, err)
		assert.Equal(t, int64(1), count)
	})

	t.Run("games by user and by GM", func(t *testing.T) {
		byUser, err := q.GetGamesByUser(ctx, int32(player.ID))
		require.NoError(t, err)
		var ids []int32
		for _, r := range byUser {
			ids = append(ids, r.ID)
		}
		assertKeptOnly(t, ids)

		byGM, err := q.GetGamesByGM(ctx, int32(gm.ID))
		require.NoError(t, err)
		ids = nil
		for _, r := range byGM {
			ids = append(ids, r.ID)
		}
		assertKeptOnly(t, ids)
	})

	t.Run("characters, deadlines and applications across games", func(t *testing.T) {
		chars, err := q.GetCharactersByUser(ctx, pgtype.Int4{Int32: int32(player.ID), Valid: true})
		require.NoError(t, err)
		var ids []int32
		for _, r := range chars {
			ids = append(ids, r.GameID)
		}
		assertKeptOnly(t, ids)

		deadlines, err := q.GetUpcomingDeadlinesForUser(ctx, models.GetUpcomingDeadlinesForUserParams{UserID: int32(player.ID), Limit: 100})
		require.NoError(t, err)
		ids = nil
		for _, r := range deadlines {
			ids = append(ids, r.GameID)
		}
		assertKeptOnly(t, ids)

		apps, err := q.GetUserGameApplications(ctx, int32(applicant.ID))
		require.NoError(t, err)
		ids = nil
		for _, r := range apps {
			ids = append(ids, r.GameID)
		}
		assertKeptOnly(t, ids)
	})

	// Hidden rather than left to 404, and the badge must agree with the list.
	t.Run("notifications and unread counts", func(t *testing.T) {
		all, err := q.GetUserNotifications(ctx, models.GetUserNotificationsParams{UserID: int32(player.ID), Limit: 100})
		require.NoError(t, err)
		var ids []int32
		gameless := 0
		for _, r := range all {
			if r.GameID.Valid {
				ids = append(ids, r.GameID.Int32)
			} else {
				gameless++
			}
		}
		assertKeptOnly(t, ids)
		assert.Equal(t, 1, gameless, "a notification with no game must still be listed")

		unread, err := q.GetUnreadNotifications(ctx, int32(player.ID))
		require.NoError(t, err)
		assert.Len(t, unread, 2, "kept-game and gameless notifications only")

		count, err := q.GetUnreadNotificationCount(ctx, int32(player.ID))
		require.NoError(t, err)
		assert.Equal(t, int64(len(unread)), count, "badge must match the list")

		dashCount, err := q.GetDashboardUnreadCount(ctx, int32(player.ID))
		require.NoError(t, err)
		assert.Equal(t, int64(len(unread)), dashCount)

		byType, err := q.GetUserUnreadNotificationsByType(ctx, int32(player.ID))
		require.NoError(t, err)
		var total int64
		for _, r := range byType {
			total += r.Count
		}
		assert.Equal(t, int64(len(unread)), total)
	})

	t.Run("scheduler does not activate a deleted game's phases", func(t *testing.T) {
		phases, err := q.GetScheduledPhasesToActivate(ctx)
		require.NoError(t, err)
		var ids []int32
		for _, p := range phases {
			ids = append(ids, p.GameID)
		}
		assertKeptOnly(t, ids)
	})
}
