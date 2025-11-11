package db

import (
	"actionphase/pkg/core"
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPollService_CreatePollWithOptions(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test game with GM and user
	gm := suite.Factory().NewUser().WithUsername("poll_test_gm").WithEmail("poll_gm@test.com").Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	user := suite.Factory().NewUser().Create()

	testCases := []struct {
		name        string
		request     core.CreatePollRequest
		expectError bool
		errorMsg    string
	}{
		{
			name: "create poll with player voting",
			request: core.CreatePollRequest{
				GameID:              game.ID,
				CreatedByUserID:     user.ID,
				Question:            "What should we do next?",
				Description:         stringPtr("Choose the best option"),
				Deadline:            time.Now().Add(24 * time.Hour),
				VoteAsType:          "player",
				ShowIndividualVotes: true,
				AllowOtherOption:    true,
				Options: []core.PollOptionInput{
					{Text: "Option A", DisplayOrder: 1},
					{Text: "Option B", DisplayOrder: 2},
					{Text: "Option C", DisplayOrder: 3},
				},
			},
			expectError: false,
		},
		{
			name: "create poll with character voting",
			request: core.CreatePollRequest{
				GameID:              game.ID,
				CreatedByUserID:     user.ID,
				Question:            "Who should lead the mission?",
				Deadline:            time.Now().Add(48 * time.Hour),
				VoteAsType:          "character",
				ShowIndividualVotes: false,
				AllowOtherOption:    false,
				Options: []core.PollOptionInput{
					{Text: "Character 1", DisplayOrder: 1},
					{Text: "Character 2", DisplayOrder: 2},
				},
			},
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			pollWithOptions, err := pollService.CreatePollWithOptions(ctx, tc.request)

			if tc.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.errorMsg)
			} else {
				require.NoError(t, err)
				require.NotNil(t, pollWithOptions)

				// Verify poll fields
				assert.Equal(t, tc.request.GameID, pollWithOptions.Poll.GameID)
				assert.Equal(t, tc.request.CreatedByUserID, pollWithOptions.Poll.CreatedByUserID)
				assert.Equal(t, tc.request.Question, pollWithOptions.Poll.Question)
				assert.Equal(t, tc.request.VoteAsType, pollWithOptions.Poll.VoteAsType)
				assert.Equal(t, tc.request.ShowIndividualVotes, pollWithOptions.Poll.ShowIndividualVotes.Bool)
				assert.Equal(t, tc.request.AllowOtherOption, pollWithOptions.Poll.AllowOtherOption.Bool)

				// Verify options created
				assert.Len(t, pollWithOptions.Options, len(tc.request.Options))
				for i, option := range pollWithOptions.Options {
					assert.Equal(t, tc.request.Options[i].Text, option.OptionText)
					assert.Equal(t, tc.request.Options[i].DisplayOrder, option.DisplayOrder)
					assert.Equal(t, pollWithOptions.Poll.ID, option.PollID)
				}
			}
		})
	}
}

func TestPollService_GetPoll(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test poll
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	user := suite.Factory().NewUser().Create()

	request := core.CreatePollRequest{
		GameID:          game.ID,
		CreatedByUserID: user.ID,
		Question:        "Test poll?",
		Deadline:        time.Now().Add(24 * time.Hour),
		VoteAsType:      "player",
		Options: []core.PollOptionInput{
			{Text: "Yes", DisplayOrder: 1},
			{Text: "No", DisplayOrder: 2},
		},
	}

	created, err := pollService.CreatePollWithOptions(ctx, request)
	require.NoError(t, err)

	testCases := []struct {
		name        string
		pollID      int32
		expectError bool
		errorMsg    string
	}{
		{
			name:        "get existing poll",
			pollID:      created.Poll.ID,
			expectError: false,
		},
		{
			name:        "get non-existent poll",
			pollID:      99999,
			expectError: true,
			errorMsg:    "poll not found",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			poll, err := pollService.GetPoll(ctx, tc.pollID)

			if tc.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.errorMsg)
			} else {
				require.NoError(t, err)
				require.NotNil(t, poll)
				assert.Equal(t, tc.pollID, poll.ID)
				assert.Equal(t, request.Question, poll.Question)
			}
		})
	}
}

func TestPollService_GetPollWithOptions(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test poll with options
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	user := suite.Factory().NewUser().Create()

	request := core.CreatePollRequest{
		GameID:          game.ID,
		CreatedByUserID: user.ID,
		Question:        "Multiple choice question?",
		Deadline:        time.Now().Add(24 * time.Hour),
		VoteAsType:      "player",
		Options: []core.PollOptionInput{
			{Text: "Option 1", DisplayOrder: 1},
			{Text: "Option 2", DisplayOrder: 2},
			{Text: "Option 3", DisplayOrder: 3},
		},
	}

	created, err := pollService.CreatePollWithOptions(ctx, request)
	require.NoError(t, err)

	// Test getting poll with options
	pollWithOptions, err := pollService.GetPollWithOptions(ctx, created.Poll.ID)
	require.NoError(t, err)
	require.NotNil(t, pollWithOptions)

	assert.Equal(t, created.Poll.ID, pollWithOptions.Poll.ID)
	assert.Len(t, pollWithOptions.Options, 3)

	// Verify options are in correct order
	for i, option := range pollWithOptions.Options {
		assert.Equal(t, request.Options[i].Text, option.OptionText)
		assert.Equal(t, int32(i+1), option.DisplayOrder)
	}
}

func TestPollService_ListPollsByGame(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	user := suite.Factory().NewUser().Create()

	// Create active poll
	activePoll := core.CreatePollRequest{
		GameID:          game.ID,
		CreatedByUserID: user.ID,
		Question:        "Active poll?",
		Deadline:        time.Now().Add(24 * time.Hour),
		VoteAsType:      "player",
		Options: []core.PollOptionInput{
			{Text: "Yes", DisplayOrder: 1},
		},
	}
	_, err := pollService.CreatePollWithOptions(ctx, activePoll)
	require.NoError(t, err)

	// Create expired poll
	expiredPoll := core.CreatePollRequest{
		GameID:          game.ID,
		CreatedByUserID: user.ID,
		Question:        "Expired poll?",
		Deadline:        time.Now().Add(-24 * time.Hour),
		VoteAsType:      "player",
		Options: []core.PollOptionInput{
			{Text: "Yes", DisplayOrder: 1},
		},
	}
	_, err = pollService.CreatePollWithOptions(ctx, expiredPoll)
	require.NoError(t, err)

	testCases := []struct {
		name           string
		includeExpired bool
		expectedCount  int
	}{
		{
			name:           "list active polls only",
			includeExpired: false,
			expectedCount:  1,
		},
		{
			name:           "list all polls including expired",
			includeExpired: true,
			expectedCount:  2,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			polls, err := pollService.ListPollsByGame(ctx, game.ID, tc.includeExpired)
			require.NoError(t, err)
			assert.Len(t, polls, tc.expectedCount)
		})
	}
}

func TestPollService_SubmitVote(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test poll
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	user := suite.Factory().NewUser().Create()

	pollReq := core.CreatePollRequest{
		GameID:           game.ID,
		CreatedByUserID:  user.ID,
		Question:         "Vote for option?",
		Deadline:         time.Now().Add(24 * time.Hour),
		VoteAsType:       "player",
		AllowOtherOption: true,
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	}

	pollWithOptions, err := pollService.CreatePollWithOptions(ctx, pollReq)
	require.NoError(t, err)

	testCases := []struct {
		name        string
		request     core.SubmitVoteRequest
		expectError bool
	}{
		{
			name: "vote for option",
			request: core.SubmitVoteRequest{
				PollID:           pollWithOptions.Poll.ID,
				UserID:           user.ID,
				SelectedOptionID: &pollWithOptions.Options[0].ID,
			},
			expectError: false,
		},
		{
			name: "vote with other response",
			request: core.SubmitVoteRequest{
				PollID:        pollWithOptions.Poll.ID,
				UserID:        user.ID,
				OtherResponse: stringPtr("My custom answer"),
			},
			expectError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			vote, err := pollService.SubmitVote(ctx, tc.request)

			if tc.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.NotNil(t, vote)
				assert.Equal(t, tc.request.PollID, vote.PollID)
				assert.Equal(t, tc.request.UserID, vote.UserID)

				if tc.request.SelectedOptionID != nil {
					assert.True(t, vote.SelectedOptionID.Valid)
					assert.Equal(t, *tc.request.SelectedOptionID, vote.SelectedOptionID.Int32)
				}

				if tc.request.OtherResponse != nil {
					assert.True(t, vote.OtherResponse.Valid)
					assert.Equal(t, *tc.request.OtherResponse, vote.OtherResponse.String)
				}
			}
		})
	}
}

func TestPollService_SubmitVote_UpdateExisting(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test poll
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	user := suite.Factory().NewUser().Create()

	pollReq := core.CreatePollRequest{
		GameID:          game.ID,
		CreatedByUserID: user.ID,
		Question:        "Change your vote?",
		Deadline:        time.Now().Add(24 * time.Hour),
		VoteAsType:      "player",
		Options: []core.PollOptionInput{
			{Text: "Option A", DisplayOrder: 1},
			{Text: "Option B", DisplayOrder: 2},
		},
	}

	pollWithOptions, err := pollService.CreatePollWithOptions(ctx, pollReq)
	require.NoError(t, err)

	// Submit initial vote
	initialVote := core.SubmitVoteRequest{
		PollID:           pollWithOptions.Poll.ID,
		UserID:           user.ID,
		SelectedOptionID: &pollWithOptions.Options[0].ID,
	}
	vote1, err := pollService.SubmitVote(ctx, initialVote)
	require.NoError(t, err)

	// Update vote to different option
	updatedVote := core.SubmitVoteRequest{
		PollID:           pollWithOptions.Poll.ID,
		UserID:           user.ID,
		SelectedOptionID: &pollWithOptions.Options[1].ID,
	}
	vote2, err := pollService.SubmitVote(ctx, updatedVote)
	require.NoError(t, err)

	// Verify it's the same vote ID (updated, not created)
	assert.Equal(t, vote1.ID, vote2.ID)
	assert.Equal(t, pollWithOptions.Options[1].ID, vote2.SelectedOptionID.Int32)
}

func TestPollService_GetVote(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test poll and vote
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	user := suite.Factory().NewUser().Create()

	pollReq := core.CreatePollRequest{
		GameID:          game.ID,
		CreatedByUserID: user.ID,
		Question:        "Test?",
		Deadline:        time.Now().Add(24 * time.Hour),
		VoteAsType:      "player",
		Options: []core.PollOptionInput{
			{Text: "Yes", DisplayOrder: 1},
		},
	}

	pollWithOptions, err := pollService.CreatePollWithOptions(ctx, pollReq)
	require.NoError(t, err)

	voteReq := core.SubmitVoteRequest{
		PollID:           pollWithOptions.Poll.ID,
		UserID:           user.ID,
		SelectedOptionID: &pollWithOptions.Options[0].ID,
	}
	submittedVote, err := pollService.SubmitVote(ctx, voteReq)
	require.NoError(t, err)

	// Get the vote
	retrievedVote, err := pollService.GetVote(ctx, pollWithOptions.Poll.ID, user.ID, nil)
	require.NoError(t, err)
	require.NotNil(t, retrievedVote)
	assert.Equal(t, submittedVote.ID, retrievedVote.ID)

	// Get non-existent vote
	otherUser := suite.Factory().NewUser().Create()
	noVote, err := pollService.GetVote(ctx, pollWithOptions.Poll.ID, otherUser.ID, nil)
	require.NoError(t, err)
	assert.Nil(t, noVote)
}

func TestPollService_GetPollResults(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test poll
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	gmUser := suite.Factory().NewUser().Create()

	pollReq := core.CreatePollRequest{
		GameID:              game.ID,
		CreatedByUserID:     gmUser.ID,
		Question:            "What's your favorite?",
		Deadline:            time.Now().Add(24 * time.Hour),
		VoteAsType:          "player",
		ShowIndividualVotes: true,
		AllowOtherOption:    true,
		Options: []core.PollOptionInput{
			{Text: "Red", DisplayOrder: 1},
			{Text: "Blue", DisplayOrder: 2},
			{Text: "Green", DisplayOrder: 3},
		},
	}

	pollWithOptions, err := pollService.CreatePollWithOptions(ctx, pollReq)
	require.NoError(t, err)

	// Create voters and submit votes
	user1 := suite.Factory().NewUser().Create()
	user2 := suite.Factory().NewUser().Create()
	user3 := suite.Factory().NewUser().Create()

	// User 1 votes for Red
	_, err = pollService.SubmitVote(ctx, core.SubmitVoteRequest{
		PollID:           pollWithOptions.Poll.ID,
		UserID:           user1.ID,
		SelectedOptionID: &pollWithOptions.Options[0].ID,
	})
	require.NoError(t, err)

	// User 2 votes for Blue
	_, err = pollService.SubmitVote(ctx, core.SubmitVoteRequest{
		PollID:           pollWithOptions.Poll.ID,
		UserID:           user2.ID,
		SelectedOptionID: &pollWithOptions.Options[1].ID,
	})
	require.NoError(t, err)

	// User 3 submits "other" response
	_, err = pollService.SubmitVote(ctx, core.SubmitVoteRequest{
		PollID:        pollWithOptions.Poll.ID,
		UserID:        user3.ID,
		OtherResponse: stringPtr("Yellow"),
	})
	require.NoError(t, err)

	// Get poll results
	results, err := pollService.GetPollResults(ctx, pollWithOptions.Poll.ID, false)
	require.NoError(t, err)
	require.NotNil(t, results)

	// Verify results
	assert.Equal(t, int32(3), results.TotalVotes)
	assert.Len(t, results.OptionResults, 3)

	// Check vote counts
	assert.Equal(t, int32(1), results.OptionResults[0].VoteCount) // Red
	assert.Equal(t, int32(1), results.OptionResults[1].VoteCount) // Blue
	assert.Equal(t, int32(0), results.OptionResults[2].VoteCount) // Green

	// Check individual voters (because show_individual_votes is true)
	assert.Len(t, results.OptionResults[0].Voters, 1)
	assert.Equal(t, user1.ID, results.OptionResults[0].Voters[0].UserID)

	// Check "other" responses
	assert.Len(t, results.OtherResponses, 1)
	assert.Equal(t, "Yellow", results.OtherResponses[0].OtherText)
	assert.Equal(t, user3.Username, results.OtherResponses[0].Username)
}

func TestPollService_UpdatePoll(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test poll
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	user := suite.Factory().NewUser().Create()

	originalDeadline := time.Now().Add(24 * time.Hour)
	pollReq := core.CreatePollRequest{
		GameID:              game.ID,
		CreatedByUserID:     user.ID,
		Question:            "Original question?",
		Deadline:            originalDeadline,
		VoteAsType:          "player",
		ShowIndividualVotes: false,
		AllowOtherOption:    false,
		Options: []core.PollOptionInput{
			{Text: "Yes", DisplayOrder: 1},
		},
	}

	pollWithOptions, err := pollService.CreatePollWithOptions(ctx, pollReq)
	require.NoError(t, err)

	// Update poll
	newDeadline := time.Now().Add(48 * time.Hour)
	updateReq := core.UpdatePollRequest{
		Question:            "Updated question?",
		Description:         stringPtr("New description"),
		Deadline:            newDeadline,
		ShowIndividualVotes: true,
		AllowOtherOption:    true,
	}

	updated, err := pollService.UpdatePoll(ctx, pollWithOptions.Poll.ID, updateReq)
	require.NoError(t, err)
	require.NotNil(t, updated)

	assert.Equal(t, updateReq.Question, updated.Question)
	assert.True(t, updated.Description.Valid)
	assert.Equal(t, *updateReq.Description, updated.Description.String)
	assert.True(t, updated.ShowIndividualVotes.Bool)
	assert.True(t, updated.AllowOtherOption.Bool)
}

func TestPollService_DeletePoll(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test poll
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	user := suite.Factory().NewUser().Create()

	pollReq := core.CreatePollRequest{
		GameID:          game.ID,
		CreatedByUserID: user.ID,
		Question:        "To be deleted?",
		Deadline:        time.Now().Add(24 * time.Hour),
		VoteAsType:      "player",
		Options: []core.PollOptionInput{
			{Text: "Yes", DisplayOrder: 1},
		},
	}

	pollWithOptions, err := pollService.CreatePollWithOptions(ctx, pollReq)
	require.NoError(t, err)

	// Delete poll (soft delete)
	err = pollService.DeletePoll(ctx, pollWithOptions.Poll.ID)
	require.NoError(t, err)

	// Verify poll is marked as deleted (GetPoll should not find it)
	_, err = pollService.GetPoll(ctx, pollWithOptions.Poll.ID)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "poll not found")

	// Try to delete non-existent poll
	err = pollService.DeletePoll(ctx, 99999)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "poll not found")
}

func TestPollService_HasUserVoted(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test poll
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	user := suite.Factory().NewUser().Create()

	pollReq := core.CreatePollRequest{
		GameID:          game.ID,
		CreatedByUserID: user.ID,
		Question:        "Have you voted?",
		Deadline:        time.Now().Add(24 * time.Hour),
		VoteAsType:      "player",
		Options: []core.PollOptionInput{
			{Text: "Yes", DisplayOrder: 1},
		},
	}

	pollWithOptions, err := pollService.CreatePollWithOptions(ctx, pollReq)
	require.NoError(t, err)

	voter := suite.Factory().NewUser().Create()

	// Check before voting
	hasVoted, err := pollService.HasUserVoted(ctx, pollWithOptions.Poll.ID, voter.ID, nil)
	require.NoError(t, err)
	assert.False(t, hasVoted)

	// Submit vote
	_, err = pollService.SubmitVote(ctx, core.SubmitVoteRequest{
		PollID:           pollWithOptions.Poll.ID,
		UserID:           voter.ID,
		SelectedOptionID: &pollWithOptions.Options[0].ID,
	})
	require.NoError(t, err)

	// Check after voting
	hasVoted, err = pollService.HasUserVoted(ctx, pollWithOptions.Poll.ID, voter.ID, nil)
	require.NoError(t, err)
	assert.True(t, hasVoted)
}

func TestPollService_GetVotedCharacterIDs(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").WithCleanup("characters").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test data
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	player := suite.Factory().NewUser().Create()

	// Create a character-level poll
	pollReq := core.CreatePollRequest{
		GameID:          game.ID,
		CreatedByUserID: gm.ID,
		Question:        "Which direction should we go?",
		Deadline:        time.Now().Add(24 * time.Hour),
		VoteAsType:      "character",
		Options: []core.PollOptionInput{
			{Text: "North", DisplayOrder: 1},
			{Text: "South", DisplayOrder: 2},
			{Text: "East", DisplayOrder: 3},
		},
	}

	pollWithOptions, err := pollService.CreatePollWithOptions(ctx, pollReq)
	require.NoError(t, err)

	// Create characters for the player
	char1 := suite.Factory().NewCharacter().InGame(game).OwnedBy(player).WithName("Character 1").Create()
	char2 := suite.Factory().NewCharacter().InGame(game).OwnedBy(player).WithName("Character 2").Create()
	char3 := suite.Factory().NewCharacter().InGame(game).OwnedBy(player).WithName("Character 3").Create()

	testCases := []struct {
		name            string
		setupVotes      func()
		expectedCharIDs []int32
	}{
		{
			name:            "no votes yet",
			setupVotes:      func() {},
			expectedCharIDs: []int32{},
		},
		{
			name: "voted with one character",
			setupVotes: func() {
				_, err := pollService.SubmitVote(ctx, core.SubmitVoteRequest{
					PollID:           pollWithOptions.Poll.ID,
					UserID:           player.ID,
					CharacterID:      &char1.ID,
					SelectedOptionID: &pollWithOptions.Options[0].ID,
				})
				require.NoError(t, err)
			},
			expectedCharIDs: []int32{char1.ID},
		},
		{
			name: "voted with two characters",
			setupVotes: func() {
				// First vote already exists from previous test case
				_, err := pollService.SubmitVote(ctx, core.SubmitVoteRequest{
					PollID:           pollWithOptions.Poll.ID,
					UserID:           player.ID,
					CharacterID:      &char2.ID,
					SelectedOptionID: &pollWithOptions.Options[1].ID,
				})
				require.NoError(t, err)
			},
			expectedCharIDs: []int32{char1.ID, char2.ID},
		},
		{
			name: "voted with all three characters",
			setupVotes: func() {
				// Previous two votes exist
				_, err := pollService.SubmitVote(ctx, core.SubmitVoteRequest{
					PollID:           pollWithOptions.Poll.ID,
					UserID:           player.ID,
					CharacterID:      &char3.ID,
					SelectedOptionID: &pollWithOptions.Options[2].ID,
				})
				require.NoError(t, err)
			},
			expectedCharIDs: []int32{char1.ID, char2.ID, char3.ID},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tc.setupVotes()

			characterIDs, err := pollService.GetVotedCharacterIDs(ctx, pollWithOptions.Poll.ID, player.ID)
			require.NoError(t, err)
			require.NotNil(t, characterIDs)

			assert.Equal(t, len(tc.expectedCharIDs), len(characterIDs), "Expected %d character IDs, got %d", len(tc.expectedCharIDs), len(characterIDs))

			// Check that all expected character IDs are present
			for _, expectedID := range tc.expectedCharIDs {
				assert.Contains(t, characterIDs, expectedID, "Expected character ID %d to be in voted characters", expectedID)
			}
		})
	}
}

func TestPollService_GetVotedCharacterIDs_DifferentUser(t *testing.T) {
	suite := NewTestSuite(t).WithCleanup("polls").WithCleanup("characters").Setup()
	defer suite.Cleanup()

	pollService := suite.PollService()
	ctx := context.Background()

	// Create test data
	gm := suite.Factory().NewUser().Create()
	game := suite.Factory().NewGame().WithGM(gm.ID).Create()
	player1 := suite.Factory().NewUser().Create()
	player2 := suite.Factory().NewUser().Create()

	// Create character-level poll
	pollReq := core.CreatePollRequest{
		GameID:          game.ID,
		CreatedByUserID: gm.ID,
		Question:        "Test poll?",
		Deadline:        time.Now().Add(24 * time.Hour),
		VoteAsType:      "character",
		Options: []core.PollOptionInput{
			{Text: "Option 1", DisplayOrder: 1},
		},
	}

	pollWithOptions, err := pollService.CreatePollWithOptions(ctx, pollReq)
	require.NoError(t, err)

	// Create characters for both players
	char1 := suite.Factory().NewCharacter().InGame(game).OwnedBy(player1).WithName("Character 1").Create()
	_ = suite.Factory().NewCharacter().InGame(game).OwnedBy(player2).WithName("Character 2").Create() // char2 not used

	// Player 1 votes with their character
	_, err = pollService.SubmitVote(ctx, core.SubmitVoteRequest{
		PollID:           pollWithOptions.Poll.ID,
		UserID:           player1.ID,
		CharacterID:      &char1.ID,
		SelectedOptionID: &pollWithOptions.Options[0].ID,
	})
	require.NoError(t, err)

	// Get voted character IDs for player 1
	player1CharIDs, err := pollService.GetVotedCharacterIDs(ctx, pollWithOptions.Poll.ID, player1.ID)
	require.NoError(t, err)
	assert.Len(t, player1CharIDs, 1)
	assert.Contains(t, player1CharIDs, char1.ID)

	// Get voted character IDs for player 2 (should be empty)
	player2CharIDs, err := pollService.GetVotedCharacterIDs(ctx, pollWithOptions.Poll.ID, player2.ID)
	require.NoError(t, err)
	assert.Empty(t, player2CharIDs, "Player 2 should have no voted characters")
}
