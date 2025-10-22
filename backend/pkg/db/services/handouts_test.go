package db

import (
	"context"
	"testing"

	"actionphase/pkg/core"
)

// =============================================================================
// HANDOUT CRUD TESTS
// =============================================================================

func TestHandoutService_CreateHandout(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	testCases := []struct {
		name        string
		gameID      int32
		title       string
		content     string
		status      string
		userID      int32
		expectError bool
	}{
		{
			name:        "create draft handout",
			gameID:      game.ID,
			title:       "Game Rules",
			content:     "# Basic Rules\n\nThis is markdown content.",
			status:      "draft",
			userID:      gm.ID,
			expectError: false,
		},
		{
			name:        "create published handout",
			gameID:      game.ID,
			title:       "World Lore",
			content:     "# The Kingdom\n\nAncient history...",
			status:      "published",
			userID:      gm.ID,
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			handout, err := handoutService.CreateHandout(
				context.Background(),
				tc.gameID,
				tc.title,
				tc.content,
				tc.status,
				tc.userID,
			)

			if tc.expectError {
				core.AssertError(t, err, "Expected error for invalid handout creation")
				return
			}

			core.AssertNoError(t, err, "Failed to create handout")
			// Nil check removed - subsequent assertions will fail if nil
			core.AssertEqual(t, tc.title, handout.Title, "Title mismatch")
			core.AssertEqual(t, tc.content, handout.Content, "Content mismatch")
			core.AssertEqual(t, tc.status, handout.Status, "Status mismatch")
			core.AssertEqual(t, tc.gameID, handout.GameID, "Game ID mismatch")
		})
	}
}

func TestHandoutService_GetHandout(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	player := suite.Factory().NewUser().WithUsername("testplayer").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	// Create a draft handout
	draftHandout, err := handoutService.CreateHandout(
		context.Background(),
		game.ID,
		"Draft Document",
		"Secret GM notes",
		"draft",
		gm.ID,
	)
	core.AssertNoError(t, err, "Failed to create draft handout")

	// Create a published handout
	publishedHandout, err := handoutService.CreateHandout(
		context.Background(),
		game.ID,
		"Published Document",
		"Public lore",
		"published",
		gm.ID,
	)
	core.AssertNoError(t, err, "Failed to create published handout")

	testCases := []struct {
		name        string
		handoutID   int32
		userID      int32
		expectError bool
	}{
		{
			name:        "GM can view draft handout",
			handoutID:   draftHandout.ID,
			userID:      gm.ID,
			expectError: false,
		},
		{
			name:        "GM can view published handout",
			handoutID:   publishedHandout.ID,
			userID:      gm.ID,
			expectError: false,
		},
		{
			name:        "player can view published handout",
			handoutID:   publishedHandout.ID,
			userID:      player.ID,
			expectError: false,
		},
		{
			name:        "player cannot view draft handout",
			handoutID:   draftHandout.ID,
			userID:      player.ID,
			expectError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			handout, err := handoutService.GetHandout(
				context.Background(),
				tc.handoutID,
				tc.userID,
			)

			if tc.expectError {
				core.AssertError(t, err, "Expected error for unauthorized access")
				return
			}

			core.AssertNoError(t, err, "Failed to get handout")
			// Nil check removed - subsequent assertions will fail if nil
			core.AssertEqual(t, tc.handoutID, handout.ID, "Handout ID mismatch")
		})
	}
}

func TestHandoutService_ListHandouts(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	player := suite.Factory().NewUser().WithUsername("testplayer").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	// Create 2 draft and 2 published handouts
	_, err := handoutService.CreateHandout(context.Background(), game.ID, "Draft 1", "Content 1", "draft", gm.ID)
	core.AssertNoError(t, err, "Failed to create draft handout 1")

	_, err = handoutService.CreateHandout(context.Background(), game.ID, "Draft 2", "Content 2", "draft", gm.ID)
	core.AssertNoError(t, err, "Failed to create draft handout 2")

	_, err = handoutService.CreateHandout(context.Background(), game.ID, "Published 1", "Content 3", "published", gm.ID)
	core.AssertNoError(t, err, "Failed to create published handout 1")

	_, err = handoutService.CreateHandout(context.Background(), game.ID, "Published 2", "Content 4", "published", gm.ID)
	core.AssertNoError(t, err, "Failed to create published handout 2")

	testCases := []struct {
		name          string
		userID        int32
		isGM          bool
		expectedCount int
	}{
		{
			name:          "GM sees all handouts",
			userID:        gm.ID,
			isGM:          true,
			expectedCount: 4,
		},
		{
			name:          "player sees only published handouts",
			userID:        player.ID,
			isGM:          false,
			expectedCount: 2,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			handouts, err := handoutService.ListHandouts(
				context.Background(),
				game.ID,
				tc.userID,
				tc.isGM,
			)

			core.AssertNoError(t, err, "Failed to list handouts")
			core.AssertEqual(t, tc.expectedCount, len(handouts), "Handout count mismatch")
		})
	}
}

func TestHandoutService_UpdateHandout(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	// Create a handout
	handout, err := handoutService.CreateHandout(
		context.Background(),
		game.ID,
		"Original Title",
		"Original Content",
		"draft",
		gm.ID,
	)
	core.AssertNoError(t, err, "Failed to create handout")

	// Update the handout
	updated, err := handoutService.UpdateHandout(
		context.Background(),
		handout.ID,
		"Updated Title",
		"Updated Content",
		"published",
		gm.ID,
	)

	core.AssertNoError(t, err, "Failed to update handout")
	// Nil check removed - subsequent assertions will fail if nil
	core.AssertEqual(t, "Updated Title", updated.Title, "Title not updated")
	core.AssertEqual(t, "Updated Content", updated.Content, "Content not updated")
	core.AssertEqual(t, "published", updated.Status, "Status not updated")
}

func TestHandoutService_DeleteHandout(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	// Create a handout
	handout, err := handoutService.CreateHandout(
		context.Background(),
		game.ID,
		"To Be Deleted",
		"This will be deleted",
		"draft",
		gm.ID,
	)
	core.AssertNoError(t, err, "Failed to create handout")

	// Delete the handout
	err = handoutService.DeleteHandout(context.Background(), handout.ID, gm.ID)
	core.AssertNoError(t, err, "Failed to delete handout")

	// Verify handout is deleted
	_, err = handoutService.GetHandout(context.Background(), handout.ID, gm.ID)
	core.AssertError(t, err, "Should not be able to get deleted handout")
}

func TestHandoutService_PublishHandout(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	// Create a draft handout
	handout, err := handoutService.CreateHandout(
		context.Background(),
		game.ID,
		"Draft Document",
		"To be published",
		"draft",
		gm.ID,
	)
	core.AssertNoError(t, err, "Failed to create draft handout")
	core.AssertEqual(t, "draft", handout.Status, "Initial status should be draft")

	// Publish the handout
	published, err := handoutService.PublishHandout(context.Background(), handout.ID, gm.ID)
	core.AssertNoError(t, err, "Failed to publish handout")
	core.AssertEqual(t, "published", published.Status, "Status should be published")
}

func TestHandoutService_UnpublishHandout(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	// Create a published handout
	handout, err := handoutService.CreateHandout(
		context.Background(),
		game.ID,
		"Published Document",
		"To be unpublished",
		"published",
		gm.ID,
	)
	core.AssertNoError(t, err, "Failed to create published handout")
	core.AssertEqual(t, "published", handout.Status, "Initial status should be published")

	// Unpublish the handout
	unpublished, err := handoutService.UnpublishHandout(context.Background(), handout.ID, gm.ID)
	core.AssertNoError(t, err, "Failed to unpublish handout")
	core.AssertEqual(t, "draft", unpublished.Status, "Status should be draft")
}

// =============================================================================
// HANDOUT COMMENT TESTS
// =============================================================================

func TestHandoutService_CreateHandoutComment(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handout_comments", "handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	// Create a handout
	handout, err := handoutService.CreateHandout(
		context.Background(),
		game.ID,
		"Document",
		"Content",
		"published",
		gm.ID,
	)
	core.AssertNoError(t, err, "Failed to create handout")

	testCases := []struct {
		name        string
		handoutID   int32
		userID      int32
		parentID    *int32
		content     string
		expectError bool
		description string
	}{
		{
			name:        "create top-level comment",
			handoutID:   handout.ID,
			userID:      gm.ID,
			parentID:    nil,
			content:     "This is a top-level comment",
			expectError: false,
			description: "Should create a top-level comment",
		},
	}

	var topLevelComment *core.HandoutComment

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			comment, err := handoutService.CreateHandoutComment(
				context.Background(),
				tc.handoutID,
				tc.userID,
				tc.parentID,
				tc.content,
			)

			if tc.expectError {
				core.AssertError(t, err, "Expected error for invalid comment creation")
				return
			}

			core.AssertNoError(t, err, "Failed to create comment")
			// Nil check removed - subsequent assertions will fail if nil
			core.AssertEqual(t, tc.content, comment.Content, "Content mismatch")
			core.AssertEqual(t, tc.handoutID, comment.HandoutID, "Handout ID mismatch")

			if tc.parentID == nil {
				topLevelComment = comment
			}
		})
	}

	// Test threaded reply
	if topLevelComment != nil {
		t.Run("create threaded reply", func(t *testing.T) {
			reply, err := handoutService.CreateHandoutComment(
				context.Background(),
				handout.ID,
				gm.ID,
				&topLevelComment.ID,
				"This is a reply",
			)

			core.AssertNoError(t, err, "Failed to create reply")
			// Nil check removed - subsequent assertions will fail if nil
			// Nil check removed - subsequent assertions will fail if nil
			core.AssertEqual(t, topLevelComment.ID, *reply.ParentCommentID, "Parent ID mismatch")
		})
	}
}

func TestHandoutService_ListHandoutComments(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handout_comments", "handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	// Create a handout
	handout, err := handoutService.CreateHandout(
		context.Background(),
		game.ID,
		"Document",
		"Content",
		"published",
		gm.ID,
	)
	core.AssertNoError(t, err, "Failed to create handout")

	// Create 3 comments
	_, err = handoutService.CreateHandoutComment(context.Background(), handout.ID, gm.ID, nil, "Comment 1")
	core.AssertNoError(t, err, "Failed to create comment 1")

	_, err = handoutService.CreateHandoutComment(context.Background(), handout.ID, gm.ID, nil, "Comment 2")
	core.AssertNoError(t, err, "Failed to create comment 2")

	_, err = handoutService.CreateHandoutComment(context.Background(), handout.ID, gm.ID, nil, "Comment 3")
	core.AssertNoError(t, err, "Failed to create comment 3")

	// List comments
	comments, err := handoutService.ListHandoutComments(context.Background(), handout.ID)
	core.AssertNoError(t, err, "Failed to list comments")
	core.AssertEqual(t, 3, len(comments), "Should have 3 comments")
}

func TestHandoutService_UpdateHandoutComment(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handout_comments", "handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	// Create a handout
	handout, err := handoutService.CreateHandout(
		context.Background(),
		game.ID,
		"Document",
		"Content",
		"published",
		gm.ID,
	)
	core.AssertNoError(t, err, "Failed to create handout")

	// Create a comment
	comment, err := handoutService.CreateHandoutComment(
		context.Background(),
		handout.ID,
		gm.ID,
		nil,
		"Original comment",
	)
	core.AssertNoError(t, err, "Failed to create comment")
	core.AssertEqual(t, int32(0), comment.EditCount, "Initial edit count should be 0")

	// Update the comment
	updated, err := handoutService.UpdateHandoutComment(
		context.Background(),
		comment.ID,
		gm.ID,
		"Updated comment",
	)

	core.AssertNoError(t, err, "Failed to update comment")
	core.AssertEqual(t, "Updated comment", updated.Content, "Content not updated")
	core.AssertEqual(t, int32(1), updated.EditCount, "Edit count should be 1")
	// Nil check removed - subsequent assertions will fail if nil
}

func TestHandoutService_DeleteHandoutComment(t *testing.T) {
	suite := NewTestSuite(t).
		WithTables("handout_comments", "handouts", "games", "users").
		Setup()
	defer suite.Cleanup()

	// Create test data
	gm := suite.Factory().NewUser().WithUsername("testgm").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	handoutService := suite.HandoutService()

	// Create a handout
	handout, err := handoutService.CreateHandout(
		context.Background(),
		game.ID,
		"Document",
		"Content",
		"published",
		gm.ID,
	)
	core.AssertNoError(t, err, "Failed to create handout")

	// Create a comment
	comment, err := handoutService.CreateHandoutComment(
		context.Background(),
		handout.ID,
		gm.ID,
		nil,
		"To be deleted",
	)
	core.AssertNoError(t, err, "Failed to create comment")

	// Delete the comment
	err = handoutService.DeleteHandoutComment(context.Background(), comment.ID, gm.ID, true)
	core.AssertNoError(t, err, "Failed to delete comment")

	// Verify comment is excluded from list (soft deleted)
	comments, err := handoutService.ListHandoutComments(context.Background(), handout.ID)
	core.AssertNoError(t, err, "Failed to list comments")
	core.AssertEqual(t, 0, len(comments), "Deleted comment should not appear in list")
}
