package db

import (
	"context"
	"testing"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
)

func TestCharacterService_CreateCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "games", "sessions", "users")

	// Setup test fixtures
	fixtures := testDB.SetupFixtures(t)
	characterService := &CharacterService{DB: testDB.Pool}

	testCases := []struct {
		name        string
		request     CreateCharacterRequest
		expectError bool
		reason      string
	}{
		{
			name: "valid player character creation",
			request: CreateCharacterRequest{
				GameID:        fixtures.TestGame.ID,
				UserID:        core.Int32Ptr(int32(fixtures.TestUser.ID)),
				Name:          "Aragorn",
				CharacterType: "player_character",
			},
			expectError: false,
		},
		{
			name: "valid GM NPC creation",
			request: CreateCharacterRequest{
				GameID:        fixtures.TestGame.ID,
				UserID:        nil, // GM-controlled NPC
				Name:          "Gandalf",
				CharacterType: "npc_gm",
			},
			expectError: false,
		},
		{
			name: "valid audience NPC creation",
			request: CreateCharacterRequest{
				GameID:        fixtures.TestGame.ID,
				UserID:        nil,
				Name:          "Boromir",
				CharacterType: "npc_audience",
			},
			expectError: false,
		},
		{
			name: "invalid character type",
			request: CreateCharacterRequest{
				GameID:        fixtures.TestGame.ID,
				UserID:        core.Int32Ptr(int32(fixtures.TestUser.ID)),
				Name:          "Invalid Character",
				CharacterType: "invalid_type",
			},
			expectError: true,
			reason:      "should reject invalid character type",
		},
		{
			name: "player character without user ID",
			request: CreateCharacterRequest{
				GameID:        fixtures.TestGame.ID,
				UserID:        nil,
				Name:          "Orphan Character",
				CharacterType: "player_character",
			},
			expectError: true,
			reason:      "player character requires user ID",
		},
		{
			name: "nonexistent game",
			request: CreateCharacterRequest{
				GameID:        99999,
				UserID:        core.Int32Ptr(int32(fixtures.TestUser.ID)),
				Name:          "Lost Character",
				CharacterType: "player_character",
			},
			expectError: true,
			reason:      "should reject nonexistent game",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			character, err := characterService.CreateCharacter(context.Background(), tc.request)

			if tc.expectError {
				core.AssertError(t, err, tc.reason)
			} else {
				core.AssertNoError(t, err, "Failed to create character")
				core.AssertEqual(t, tc.request.Name, character.Name, "Character name mismatch")
				core.AssertEqual(t, tc.request.CharacterType, character.CharacterType, "Character type mismatch")
				core.AssertEqual(t, "pending", character.Status, "Character should start with pending status")

				if tc.request.UserID != nil {
					core.AssertEqual(t, true, character.UserID.Valid, "Character should have user ID")
					core.AssertEqual(t, *tc.request.UserID, character.UserID.Int32, "User ID mismatch")
				} else {
					core.AssertEqual(t, false, character.UserID.Valid, "Character should not have user ID")
				}
			}
		})
	}
}

func TestCharacterService_GetCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "games", "sessions", "users")

	// Setup test fixtures
	fixtures := testDB.SetupFixtures(t)
	characterService := &CharacterService{DB: testDB.Pool}

	// Create test character
	character, err := characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		UserID:        core.Int32Ptr(int32(fixtures.TestUser.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Failed to create test character")

	testCases := []struct {
		name        string
		characterID int32
		expectError bool
		reason      string
	}{
		{
			name:        "valid character retrieval",
			characterID: character.ID,
			expectError: false,
		},
		{
			name:        "nonexistent character",
			characterID: 99999,
			expectError: true,
			reason:      "should fail for nonexistent character",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			retrieved, err := characterService.GetCharacter(context.Background(), tc.characterID)

			if tc.expectError {
				core.AssertError(t, err, tc.reason)
			} else {
				core.AssertNoError(t, err, "Failed to get character")
				core.AssertEqual(t, character.ID, retrieved.ID, "Character ID mismatch")
				core.AssertEqual(t, character.Name, retrieved.Name, "Character name mismatch")
			}
		})
	}
}

func TestCharacterService_GetCharactersByGame(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "games", "sessions", "users")

	// Setup test fixtures
	fixtures := testDB.SetupFixtures(t)
	characterService := &CharacterService{DB: testDB.Pool}

	// Create test characters
	_, err := characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		UserID:        core.Int32Ptr(int32(fixtures.TestUser.ID)),
		Name:          "Player Character 1",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Failed to create player character")

	_, err = characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		UserID:        nil,
		Name:          "GM NPC 1",
		CharacterType: "npc_gm",
	})
	core.AssertNoError(t, err, "Failed to create GM NPC")

	// Test retrieval
	characters, err := characterService.GetCharactersByGame(context.Background(), fixtures.TestGame.ID)
	core.AssertNoError(t, err, "Failed to get characters by game")

	// Should have 2 characters
	core.AssertEqual(t, 2, len(characters), "Expected 2 characters")

	// Test empty game
	emptyGame := testDB.CreateTestGame(t, int32(fixtures.TestUser.ID), "Empty Game")
	emptyCharacters, err := characterService.GetCharactersByGame(context.Background(), emptyGame.ID)
	core.AssertNoError(t, err, "Failed to get characters for empty game")
	core.AssertEqual(t, 0, len(emptyCharacters), "Expected 0 characters for empty game")
}

func TestCharacterService_ApproveRejectCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "games", "sessions", "users")

	// Setup test fixtures
	fixtures := testDB.SetupFixtures(t)
	characterService := &CharacterService{DB: testDB.Pool}

	// Create test character
	character, err := characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		UserID:        core.Int32Ptr(int32(fixtures.TestUser.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Failed to create test character")

	// Test approval
	t.Run("approve character", func(t *testing.T) {
		approved, err := characterService.ApproveCharacter(context.Background(), character.ID)
		core.AssertNoError(t, err, "Failed to approve character")
		core.AssertEqual(t, "approved", approved.Status, "Character should be approved")
	})

	// Create another character for rejection test
	character2, err := characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		UserID:        core.Int32Ptr(int32(fixtures.TestUser.ID)),
		Name:          "Test Character 2",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Failed to create second test character")

	// Test rejection
	t.Run("reject character", func(t *testing.T) {
		rejected, err := characterService.RejectCharacter(context.Background(), character2.ID)
		core.AssertNoError(t, err, "Failed to reject character")
		core.AssertEqual(t, "rejected", rejected.Status, "Character should be rejected")
	})

	// Test approval of nonexistent character
	t.Run("approve nonexistent character", func(t *testing.T) {
		_, err := characterService.ApproveCharacter(context.Background(), 99999)
		core.AssertError(t, err, "Should fail for nonexistent character")
	})
}

func TestCharacterService_AssignNPCToUser(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "games", "sessions", "users")

	// Setup test fixtures
	fixtures := testDB.SetupFixtures(t)
	characterService := &CharacterService{DB: testDB.Pool}

	// Create additional user for assignment
	assignedUser := testDB.CreateTestUser(t, "assigneduser", "assigned@example.com")

	// Create NPC character
	npcCharacter, err := characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		UserID:        nil,
		Name:          "Test NPC",
		CharacterType: "npc_gm",
	})
	core.AssertNoError(t, err, "Failed to create NPC character")

	testCases := []struct {
		name             string
		characterID      int32
		assignedUserID   int32
		assignedByUserID int32
		expectError      bool
		reason           string
	}{
		{
			name:             "valid NPC assignment",
			characterID:      npcCharacter.ID,
			assignedUserID:   int32(assignedUser.ID),
			assignedByUserID: int32(fixtures.TestUser.ID),
			expectError:      false,
		},
		{
			name:             "assign nonexistent NPC",
			characterID:      99999,
			assignedUserID:   int32(assignedUser.ID),
			assignedByUserID: int32(fixtures.TestUser.ID),
			expectError:      true,
			reason:           "should fail for nonexistent character",
		},
		{
			name:             "assign to nonexistent user",
			characterID:      npcCharacter.ID,
			assignedUserID:   99999,
			assignedByUserID: int32(fixtures.TestUser.ID),
			expectError:      true,
			reason:           "should fail for nonexistent user",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := characterService.AssignNPCToUser(context.Background(), tc.characterID, tc.assignedUserID, tc.assignedByUserID)

			if tc.expectError {
				core.AssertError(t, err, tc.reason)
			} else {
				core.AssertNoError(t, err, "Failed to assign NPC to user")
			}
		})
	}

	// Test assigning player character (should fail)
	t.Run("assign player character", func(t *testing.T) {
		playerCharacter, err := characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
			GameID:        fixtures.TestGame.ID,
			UserID:        core.Int32Ptr(int32(fixtures.TestUser.ID)),
			Name:          "Player Character",
			CharacterType: "player_character",
		})
		core.AssertNoError(t, err, "Failed to create player character")

		err = characterService.AssignNPCToUser(context.Background(), playerCharacter.ID, int32(assignedUser.ID), int32(fixtures.TestUser.ID))
		core.AssertError(t, err, "Should not be able to assign player character")
	})
}

func TestCharacterService_CharacterData(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "games", "sessions", "users")

	// Setup test fixtures
	fixtures := testDB.SetupFixtures(t)
	characterService := &CharacterService{DB: testDB.Pool}

	// Create test character
	character, err := characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		UserID:        core.Int32Ptr(int32(fixtures.TestUser.ID)),
		Name:          "Test Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Failed to create test character")

	// Test setting character data
	t.Run("set character data", func(t *testing.T) {
		err := characterService.SetCharacterData(context.Background(), CharacterDataRequest{
			CharacterID: character.ID,
			ModuleType:  "bio",
			FieldName:   "background",
			FieldValue:  "A brave warrior from the north",
			FieldType:   "text",
			IsPublic:    true,
		})
		core.AssertNoError(t, err, "Failed to set character data")

		// Set private data
		err = characterService.SetCharacterData(context.Background(), CharacterDataRequest{
			CharacterID: character.ID,
			ModuleType:  "notes",
			FieldName:   "private_notes",
			FieldValue:  "Secret weakness: afraid of spiders",
			FieldType:   "text",
			IsPublic:    false,
		})
		core.AssertNoError(t, err, "Failed to set private character data")
	})

	// Test getting all character data
	t.Run("get all character data", func(t *testing.T) {
		data, err := characterService.GetCharacterData(context.Background(), character.ID)
		core.AssertNoError(t, err, "Failed to get character data")
		core.AssertEqual(t, 2, len(data), "Expected 2 data entries")
	})

	// Test getting public character data only
	t.Run("get public character data", func(t *testing.T) {
		data, err := characterService.GetPublicCharacterData(context.Background(), character.ID)
		core.AssertNoError(t, err, "Failed to get public character data")
		core.AssertEqual(t, 1, len(data), "Expected 1 public data entry")
		core.AssertEqual(t, true, data[0].IsPublic.Bool, "Data should be public")
	})

	// Test getting character data by module
	t.Run("get character data by module", func(t *testing.T) {
		data, err := characterService.GetCharacterDataByModule(context.Background(), character.ID, "bio")
		core.AssertNoError(t, err, "Failed to get character data by module")
		core.AssertEqual(t, 1, len(data), "Expected 1 bio data entry")
		core.AssertEqual(t, "bio", data[0].ModuleType, "Module type mismatch")
	})

	// Test updating existing character data (upsert behavior)
	t.Run("update character data", func(t *testing.T) {
		err := characterService.SetCharacterData(context.Background(), CharacterDataRequest{
			CharacterID: character.ID,
			ModuleType:  "bio",
			FieldName:   "background",
			FieldValue:  "An experienced warrior from the far north",
			FieldType:   "text",
			IsPublic:    true,
		})
		core.AssertNoError(t, err, "Failed to update character data")

		// Verify the data was updated
		data, err := characterService.GetCharacterData(context.Background(), character.ID)
		core.AssertNoError(t, err, "Failed to get updated character data")

		var backgroundEntry *models.CharacterDatum
		for _, entry := range data {
			if entry.ModuleType == "bio" && entry.FieldName == "background" {
				backgroundEntry = &entry
				break
			}
		}

		if backgroundEntry == nil {
			t.Fatal("Background entry not found")
		}

		core.AssertEqual(t, "An experienced warrior from the far north", backgroundEntry.FieldValue.String, "Data should be updated")
	})
}

func TestCharacterService_CanUserEditCharacter(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer testDB.CleanupTables(t, "character_data", "npc_assignments", "characters", "games", "sessions", "users")

	// Setup test fixtures
	fixtures := testDB.SetupFixtures(t)
	characterService := &CharacterService{DB: testDB.Pool}

	// Create additional users
	player := testDB.CreateTestUser(t, "player", "player@example.com")
	otherPlayer := testDB.CreateTestUser(t, "otherplayer", "other@example.com")

	// Create player character owned by 'player'
	playerCharacter, err := characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		UserID:        core.Int32Ptr(int32(player.ID)),
		Name:          "Player Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Failed to create player character")

	// Create NPC and assign to otherPlayer
	npcCharacter, err := characterService.CreateCharacter(context.Background(), CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		UserID:        nil,
		Name:          "Assigned NPC",
		CharacterType: "npc_audience",
	})
	core.AssertNoError(t, err, "Failed to create NPC character")

	err = characterService.AssignNPCToUser(context.Background(), npcCharacter.ID, int32(otherPlayer.ID), int32(fixtures.TestUser.ID))
	core.AssertNoError(t, err, "Failed to assign NPC")

	testCases := []struct {
		name        string
		characterID int32
		userID      int32
		canEdit     bool
		reason      string
	}{
		{
			name:        "character owner can edit",
			characterID: playerCharacter.ID,
			userID:      int32(player.ID),
			canEdit:     true,
			reason:      "character owner should be able to edit",
		},
		{
			name:        "GM can edit any character",
			characterID: playerCharacter.ID,
			userID:      int32(fixtures.TestUser.ID), // GM
			canEdit:     true,
			reason:      "GM should be able to edit any character",
		},
		{
			name:        "assigned user can edit NPC",
			characterID: npcCharacter.ID,
			userID:      int32(otherPlayer.ID),
			canEdit:     true,
			reason:      "assigned user should be able to edit NPC",
		},
		{
			name:        "other users cannot edit",
			characterID: playerCharacter.ID,
			userID:      int32(otherPlayer.ID),
			canEdit:     false,
			reason:      "other users should not be able to edit",
		},
		{
			name:        "unassigned user cannot edit NPC",
			characterID: npcCharacter.ID,
			userID:      int32(player.ID),
			canEdit:     false,
			reason:      "unassigned user should not be able to edit NPC",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			canEdit, err := characterService.CanUserEditCharacter(context.Background(), tc.characterID, tc.userID)
			core.AssertNoError(t, err, "Failed to check edit permission")
			core.AssertEqual(t, tc.canEdit, canEdit, tc.reason)
		})
	}

	// Test nonexistent character
	t.Run("nonexistent character", func(t *testing.T) {
		_, err := characterService.CanUserEditCharacter(context.Background(), 99999, int32(player.ID))
		core.AssertError(t, err, "Should fail for nonexistent character")
	})
}
