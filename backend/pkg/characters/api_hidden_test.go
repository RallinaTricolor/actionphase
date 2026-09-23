package characters

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"actionphase/pkg/core"
	db "actionphase/pkg/db/services"
)

// Hidden NPCs: an NPC the GM has concealed from regular players.
//
// The rule being enforced is narrow and easy to over-apply, so these tests are
// written in pairs: for every "a player cannot see it" assertion there is a
// matching "the GM still can" assertion. Hiding is meant to remove DISCOVERY
// (roster, profile, mentions, starting a conversation) while leaving content
// the NPC has authored fully visible. A change that concealed the NPC from
// everyone, or that filtered its posts, would satisfy half of these and fail
// the other half.

// hiddenNPCFixture is the cast every test here needs: a GM, a regular player,
// an audience member, and one hidden NPC.
type hiddenNPCFixture struct {
	fixtures      *core.TestFixtures
	playerUser    *core.User
	audienceUser  *core.User
	hiddenNPC     int32
	visibleNPC    int32
	gmToken       string
	playerToken   string
	audienceToken string
}

func setupHiddenNPCFixture(t *testing.T, app *core.App, testDB *core.TestDatabase) *hiddenNPCFixture {
	t.Helper()
	ctx := context.Background()

	fixtures := testDB.SetupFixtures(t)
	gameService := &db.GameService{DB: testDB.Pool, Logger: app.ObsLogger}
	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}

	playerUser := testDB.CreateTestUser(t, "hidden_player", "hidden_player@example.com")
	audienceUser := testDB.CreateTestUser(t, "hidden_audience", "hidden_audience@example.com")

	_, err := gameService.AddGameParticipant(ctx, fixtures.TestGame.ID, int32(playerUser.ID), "player")
	core.AssertNoError(t, err, "Adding player to game should succeed")
	_, err = gameService.AddGameParticipant(ctx, fixtures.TestGame.ID, int32(audienceUser.ID), "audience")
	core.AssertNoError(t, err, "Adding audience member to game should succeed")

	// Both NPCs are APPROVED. Characters are created 'pending', and the roster
	// already hides other players' unapproved characters -- so a pending NPC
	// would be absent from a player's roster for a reason that has nothing to
	// do with hiding, and these tests would pass without the feature existing.
	hidden, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		Name:          "Masked Informant",
		CharacterType: "npc",
	})
	core.AssertNoError(t, err, "Creating hidden NPC should succeed")
	_, err = characterService.ApproveCharacter(ctx, hidden.ID)
	core.AssertNoError(t, err, "Approving hidden NPC should succeed")
	_, err = characterService.SetCharacterHidden(ctx, hidden.ID, true)
	core.AssertNoError(t, err, "Hiding NPC should succeed")

	// A second, visible NPC proves the gates are scoped to hidden-ness rather
	// than suppressing NPCs generally.
	visible, err := characterService.CreateCharacter(ctx, db.CreateCharacterRequest{
		GameID:        fixtures.TestGame.ID,
		Name:          "Town Crier",
		CharacterType: "npc",
	})
	core.AssertNoError(t, err, "Creating visible NPC should succeed")
	_, err = characterService.ApproveCharacter(ctx, visible.ID)
	core.AssertNoError(t, err, "Approving visible NPC should succeed")

	gmToken, err := createTestAuthToken(app, fixtures.TestUser)
	core.AssertNoError(t, err, "GM token creation should succeed")
	playerToken, err := createTestAuthToken(app, playerUser)
	core.AssertNoError(t, err, "Player token creation should succeed")
	audienceToken, err := createTestAuthToken(app, audienceUser)
	core.AssertNoError(t, err, "Audience token creation should succeed")

	return &hiddenNPCFixture{
		fixtures:      fixtures,
		playerUser:    playerUser,
		audienceUser:  audienceUser,
		hiddenNPC:     hidden.ID,
		visibleNPC:    visible.ID,
		gmToken:       gmToken,
		playerToken:   playerToken,
		audienceToken: audienceToken,
	}
}

func hiddenTestCleanup(t *testing.T, testDB *core.TestDatabase) {
	testDB.CleanupTables(t, "character_data", "npc_assignments", "characters",
		"game_participants", "games", "communities", "sessions", "users")
}

func doGet(t *testing.T, router http.Handler, path, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("GET", path, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// TestHiddenNPC_RosterOmitsForPlayersOnly is the core discovery gate: the NPC is
// absent from a regular player's roster and present for everyone privileged.
func TestHiddenNPC_RosterOmitsForPlayersOnly(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer hiddenTestCleanup(t, testDB)

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterTestRouter(app, testDB)
	f := setupHiddenNPCFixture(t, app, testDB)

	rosterPath := "/api/v1/games/" + strconv.Itoa(int(f.fixtures.TestGame.ID)) + "/characters"

	cases := []struct {
		name       string
		token      string
		wantHidden bool
	}{
		{name: "gm sees the hidden NPC", token: f.gmToken, wantHidden: true},
		{name: "audience sees the hidden NPC", token: f.audienceToken, wantHidden: true},
		{name: "player does not see the hidden NPC", token: f.playerToken, wantHidden: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := doGet(t, router, rosterPath, tc.token)
			core.AssertEqual(t, http.StatusOK, w.Code, "Roster should be readable")

			var roster []*CharacterResponse
			core.AssertNoError(t, json.Unmarshal(w.Body.Bytes(), &roster), "Roster should decode")

			var sawHidden, sawVisible bool
			for _, c := range roster {
				if c.ID == f.hiddenNPC {
					sawHidden = true
					if c.IsHidden == nil {
						t.Error("is_hidden should be reported on a row the caller can see")
					} else if !*c.IsHidden {
						t.Error("is_hidden should be true for the hidden NPC")
					}
				}
				if c.ID == f.visibleNPC {
					sawVisible = true
					// Reported to every role, including a plain player: hiding
					// conceals WHICH characters are hidden, not that hiding
					// exists. Any row in this list already passed the gate.
					if c.IsHidden == nil {
						t.Error("is_hidden should be reported on a visible NPC for every role")
					} else if *c.IsHidden {
						t.Error("is_hidden should be false for the unhidden NPC")
					}
				}
			}

			core.AssertEqual(t, tc.wantHidden, sawHidden, "Hidden NPC presence in roster")
			// The unhidden NPC is visible to everyone in every case; without
			// this the gate could be suppressing all NPCs and still pass.
			core.AssertEqual(t, true, sawVisible, "The visible NPC must be listed for every role")
		})
	}
}

// TestHiddenNPC_FieldReportedOnVisibleRows fixes the reporting rule at "if you
// can see the row, you get the flag".
//
// An earlier cut withheld is_hidden from plain players entirely, on the theory
// that a false on their own character would disclose the hiding MECHANIC. That
// was over-tight: the mechanic is documented. What hiding conceals is WHICH
// characters are hidden, and a row the caller can already see reveals nothing
// further by carrying its flag.
func TestHiddenNPC_FieldReportedOnVisibleRows(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer hiddenTestCleanup(t, testDB)

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterTestRouter(app, testDB)
	f := setupHiddenNPCFixture(t, app, testDB)

	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	ownChar, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        f.fixtures.TestGame.ID,
		UserID:        core.Int32Ptr(int32(f.playerUser.ID)),
		Name:          "Own Character",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Creating the player's character should succeed")
	_, err = characterService.ApproveCharacter(context.Background(), ownChar.ID)
	core.AssertNoError(t, err, "Approving the player's character should succeed")

	t.Run("roster reports the field on the player's own character", func(t *testing.T) {
		w := doGet(t, router,
			"/api/v1/games/"+strconv.Itoa(int(f.fixtures.TestGame.ID))+"/characters", f.playerToken)
		core.AssertEqual(t, http.StatusOK, w.Code, "Roster should be readable")

		// Decoded as raw maps: the typed struct cannot distinguish an absent
		// key from a false value, which is exactly what is under test.
		var roster []map[string]any
		core.AssertNoError(t, json.Unmarshal(w.Body.Bytes(), &roster), "Roster should decode")

		var checked bool
		for _, c := range roster {
			if int32(c["id"].(float64)) != ownChar.ID {
				continue
			}
			checked = true
			value, present := c["is_hidden"]
			if !present {
				t.Error("is_hidden should be present on a row the player can see")
			} else if value != false {
				t.Errorf("the player's own character should report is_hidden false, got %v", value)
			}
		}
		core.AssertEqual(t, true, checked, "The player's own character should be in their roster")
	})

	t.Run("profile reports the field on the player's own character", func(t *testing.T) {
		w := doGet(t, router, "/api/v1/characters/"+strconv.Itoa(int(ownChar.ID)), f.playerToken)
		core.AssertEqual(t, http.StatusOK, w.Code, "The player should read their own character")

		var body map[string]any
		core.AssertNoError(t, json.Unmarshal(w.Body.Bytes(), &body), "Body should decode")
		value, present := body["is_hidden"]
		if !present {
			t.Error("is_hidden should be present on the player's own character profile")
		} else if value != false {
			t.Errorf("expected is_hidden false, got %v", value)
		}
	})

	t.Run("the hidden NPC is still omitted from that same roster", func(t *testing.T) {
		// The reporting change must not have loosened the VISIBILITY gate --
		// these are separate decisions, and this is the one that matters.
		w := doGet(t, router,
			"/api/v1/games/"+strconv.Itoa(int(f.fixtures.TestGame.ID))+"/characters", f.playerToken)

		var roster []*CharacterResponse
		core.AssertNoError(t, json.Unmarshal(w.Body.Bytes(), &roster), "Roster should decode")

		for _, c := range roster {
			if c.ID == f.hiddenNPC {
				t.Error("The hidden NPC must still be absent from a player's roster")
			}
		}
	})
}

// TestHiddenNPC_ProfileIsNotFoundForPlayer asserts the status specifically: a
// 403 would confirm the character exists, which is the disclosure hiding is
// meant to prevent.
func TestHiddenNPC_ProfileIsNotFoundForPlayer(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer hiddenTestCleanup(t, testDB)

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterTestRouter(app, testDB)
	f := setupHiddenNPCFixture(t, app, testDB)

	hiddenPath := "/api/v1/characters/" + strconv.Itoa(int(f.hiddenNPC))

	t.Run("player gets 404, not 403", func(t *testing.T) {
		w := doGet(t, router, hiddenPath, f.playerToken)
		core.AssertEqual(t, http.StatusNotFound, w.Code,
			"A hidden NPC must be reported as not found; 403 would confirm it exists")
	})

	t.Run("gm gets the profile", func(t *testing.T) {
		w := doGet(t, router, hiddenPath, f.gmToken)
		core.AssertEqual(t, http.StatusOK, w.Code, "GM should read the hidden NPC's profile")
	})

	t.Run("audience gets the profile", func(t *testing.T) {
		w := doGet(t, router, hiddenPath, f.audienceToken)
		core.AssertEqual(t, http.StatusOK, w.Code, "Audience should read the hidden NPC's profile")
	})

	t.Run("player can still read a visible NPC", func(t *testing.T) {
		w := doGet(t, router, "/api/v1/characters/"+strconv.Itoa(int(f.visibleNPC)), f.playerToken)
		core.AssertEqual(t, http.StatusOK, w.Code,
			"The gate must be scoped to hidden NPCs, not NPCs generally")
	})
}

// TestHiddenNPC_SiblingEndpointsAreNotFound covers the endpoints that hang off
// the same character ID as the profile.
//
// These are a regression test for a real leak: the profile endpoint was gated
// while its siblings were not, so a player who guessed the ID still received
// the hidden character's sheet data and message counts. The stats leak was
// visible in the UI ("Messages: 1 public"), and the private count leaked too
// whenever one existed. Gating the record alone is NOT enough -- anything keyed
// by character ID has to answer 404 as well.
func TestHiddenNPC_SiblingEndpointsAreNotFound(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer hiddenTestCleanup(t, testDB)

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterTestRouter(app, testDB)
	f := setupHiddenNPCFixture(t, app, testDB)

	hidden := strconv.Itoa(int(f.hiddenNPC))
	visible := strconv.Itoa(int(f.visibleNPC))

	for _, sibling := range []struct {
		name string
		path string
	}{
		{"stats", "/stats"},
		{"sheet data", "/data"},
	} {
		t.Run(sibling.name+": player gets 404", func(t *testing.T) {
			w := doGet(t, router, "/api/v1/characters/"+hidden+sibling.path, f.playerToken)
			core.AssertEqual(t, http.StatusNotFound, w.Code,
				"A hidden NPC's "+sibling.name+" must be reported as not found")
		})

		t.Run(sibling.name+": gm still gets it", func(t *testing.T) {
			w := doGet(t, router, "/api/v1/characters/"+hidden+sibling.path, f.gmToken)
			core.AssertEqual(t, http.StatusOK, w.Code,
				"GM should read the hidden NPC's "+sibling.name)
		})

		t.Run(sibling.name+": audience still gets it", func(t *testing.T) {
			w := doGet(t, router, "/api/v1/characters/"+hidden+sibling.path, f.audienceToken)
			core.AssertEqual(t, http.StatusOK, w.Code,
				"Audience should read the hidden NPC's "+sibling.name)
		})

		t.Run(sibling.name+": visible NPC is unaffected", func(t *testing.T) {
			w := doGet(t, router, "/api/v1/characters/"+visible+sibling.path, f.playerToken)
			core.AssertEqual(t, http.StatusOK, w.Code,
				"The gate must be scoped to hidden NPCs, not NPCs generally")
		})
	}
}

// TestHiddenNPC_BatchEndpointsOmitKey covers the two map-shaped responses. A
// present key with zeroed contents still discloses the character ID, so the
// assertion is on key ABSENCE rather than on the values.
func TestHiddenNPC_BatchEndpointsOmitKey(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer hiddenTestCleanup(t, testDB)

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterTestRouter(app, testDB)
	f := setupHiddenNPCFixture(t, app, testDB)

	base := "/api/v1/games/" + strconv.Itoa(int(f.fixtures.TestGame.ID))
	hiddenKey := strconv.Itoa(int(f.hiddenNPC))
	visibleKey := strconv.Itoa(int(f.visibleNPC))

	for _, path := range []string{base + "/characters/stats", base + "/characters/data"} {
		t.Run(path+" omits the key for a player", func(t *testing.T) {
			w := doGet(t, router, path, f.playerToken)
			core.AssertEqual(t, http.StatusOK, w.Code, "Batch endpoint should be readable")

			var body map[string]json.RawMessage
			core.AssertNoError(t, json.Unmarshal(w.Body.Bytes(), &body), "Body should decode")

			if _, present := body[hiddenKey]; present {
				t.Error("The hidden NPC's key must be absent entirely: the key itself is the disclosure")
			}
			if _, present := body[visibleKey]; !present {
				t.Error("The visible NPC's key should still be present")
			}
		})

		t.Run(path+" includes the key for the GM", func(t *testing.T) {
			w := doGet(t, router, path, f.gmToken)
			core.AssertEqual(t, http.StatusOK, w.Code, "Batch endpoint should be readable")

			var body map[string]json.RawMessage
			core.AssertNoError(t, json.Unmarshal(w.Body.Bytes(), &body), "Body should decode")

			if _, present := body[hiddenKey]; !present {
				t.Error("The GM must still receive the hidden NPC's entry")
			}
		})
	}
}

// TestHiddenNPC_PublicArchiveRevealsToEveryone: hiding is a play-time
// protection, lifted once the game becomes a public archive -- the same way
// anonymous usernames and poll vote attribution are disclosed at completion.
func TestHiddenNPC_PublicArchiveRevealsToEveryone(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer hiddenTestCleanup(t, testDB)

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterTestRouter(app, testDB)
	f := setupHiddenNPCFixture(t, app, testDB)

	rosterPath := "/api/v1/games/" + strconv.Itoa(int(f.fixtures.TestGame.ID)) + "/characters"

	// Baseline: concealed while the game is running.
	w := doGet(t, router, rosterPath, f.playerToken)
	var before []*CharacterResponse
	core.AssertNoError(t, json.Unmarshal(w.Body.Bytes(), &before), "Roster should decode")
	for _, c := range before {
		if c.ID == f.hiddenNPC {
			t.Fatal("Precondition failed: hidden NPC should not be listed while the game runs")
		}
	}

	_, err := testDB.Pool.Exec(context.Background(),
		"UPDATE games SET state = 'completed' WHERE id = $1", f.fixtures.TestGame.ID)
	core.AssertNoError(t, err, "Completing the game should succeed")

	w = doGet(t, router, rosterPath, f.playerToken)
	core.AssertEqual(t, http.StatusOK, w.Code, "Completed game roster should be readable")

	var after []*CharacterResponse
	core.AssertNoError(t, json.Unmarshal(w.Body.Bytes(), &after), "Roster should decode")

	var found bool
	for _, c := range after {
		if c.ID == f.hiddenNPC {
			found = true
		}
	}
	if !found {
		t.Error("A completed game is a public archive; its hidden NPCs should be disclosed")
	}
}

// TestHiddenNPC_SetHiddenEndpoint covers authorization and the NPC-only rule on
// the write path.
func TestHiddenNPC_SetHiddenEndpoint(t *testing.T) {
	testDB := core.NewTestDatabase(t)
	defer testDB.Close()
	defer hiddenTestCleanup(t, testDB)

	app := core.NewTestApp(testDB.Pool)
	router := setupCharacterTestRouter(app, testDB)
	f := setupHiddenNPCFixture(t, app, testDB)

	characterService := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	playerCharacter, err := characterService.CreateCharacter(context.Background(), db.CreateCharacterRequest{
		GameID:        f.fixtures.TestGame.ID,
		UserID:        core.Int32Ptr(int32(f.playerUser.ID)),
		Name:          "Player Hero",
		CharacterType: "player_character",
	})
	core.AssertNoError(t, err, "Creating player character should succeed")

	put := func(t *testing.T, characterID int32, hidden bool, token string) *httptest.ResponseRecorder {
		t.Helper()
		payload, _ := json.Marshal(SetCharacterHiddenRequest{IsHidden: hidden})
		req := httptest.NewRequest("PUT",
			"/api/v1/characters/"+strconv.Itoa(int(characterID))+"/hidden", bytes.NewBuffer(payload))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+token)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		return w
	}

	t.Run("gm reveals the hidden NPC", func(t *testing.T) {
		w := put(t, f.hiddenNPC, false, f.gmToken)
		core.AssertEqual(t, http.StatusOK, w.Code, "GM should be able to reveal an NPC")

		var resp CharacterResponse
		core.AssertNoError(t, json.Unmarshal(w.Body.Bytes(), &resp), "Response should decode")
		if resp.IsHidden == nil || *resp.IsHidden {
			t.Error("Response should report the NPC as no longer hidden")
		}

		// Persisted, not just echoed.
		reread, err := characterService.GetCharacter(context.Background(), f.hiddenNPC)
		core.AssertNoError(t, err, "Re-reading the NPC should succeed")
		core.AssertEqual(t, false, reread.IsHidden, "Reveal should be persisted")
	})

	t.Run("gm hides it again", func(t *testing.T) {
		w := put(t, f.hiddenNPC, true, f.gmToken)
		core.AssertEqual(t, http.StatusOK, w.Code, "GM should be able to hide an NPC")

		reread, err := characterService.GetCharacter(context.Background(), f.hiddenNPC)
		core.AssertNoError(t, err, "Re-reading the NPC should succeed")
		core.AssertEqual(t, true, reread.IsHidden, "Hide should be persisted")
	})

	t.Run("player cannot hide an NPC", func(t *testing.T) {
		w := put(t, f.visibleNPC, true, f.playerToken)
		core.AssertEqual(t, http.StatusForbidden, w.Code, "Only the GM may hide or reveal")
	})

	t.Run("audience cannot hide an NPC", func(t *testing.T) {
		w := put(t, f.visibleNPC, true, f.audienceToken)
		core.AssertEqual(t, http.StatusForbidden, w.Code,
			"Seeing hidden NPCs does not confer the right to hide them")
	})

	t.Run("player characters cannot be hidden", func(t *testing.T) {
		w := put(t, playerCharacter.ID, true, f.gmToken)
		core.AssertEqual(t, http.StatusBadRequest, w.Code, "Only NPCs can be hidden")
	})
}
