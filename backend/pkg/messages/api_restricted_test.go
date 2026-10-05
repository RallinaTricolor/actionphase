package messages

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"actionphase/pkg/core"
	models "actionphase/pkg/db/models"
	db "actionphase/pkg/db/services"
)

// apiClient sends JSON requests through a test router as one user.
type apiClient struct {
	t      *testing.T
	router *chi.Mux
	token  string
}

func (c apiClient) do(method, path string, body any) *httptest.ResponseRecorder {
	c.t.Helper()
	var reader *bytes.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		require.NoError(c.t, err)
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	rec := httptest.NewRecorder()
	c.router.ServeHTTP(rec, req)
	return rec
}

// restrictedAPIScenario is the handler-level cast: a GM, a co-GM, players A
// and B, an audience member, a logged-in non-participant, and the GM of a
// different game. The restricted post is created through the API, restricted
// to A, with a comment by A under it.
type restrictedAPIScenario struct {
	testDB    *core.TestDatabase
	router    *chi.Mux
	game      *models.Game
	otherGame *models.Game // run by otherGM
	base      string       // /api/v1/games/{id}

	gm, coGM, playerA, playerB, audience, outsider, otherGM apiClient
	aID, bID, coGMID, outsiderID                            int32

	gmChar, aChar, bChar *models.Character

	publicPost, restrictedPost int32
	publicComment, aComment    int32
}

func newRestrictedAPIScenario(t *testing.T, prefix string) *restrictedAPIScenario {
	t.Helper()
	t.Setenv("REQUIRE_EMAIL_VERIFICATION", "false")

	testDB := core.NewTestDatabase(t)
	t.Cleanup(testDB.Close)
	app := core.NewTestApp(testDB.Pool)
	ctx := context.Background()

	s := &restrictedAPIScenario{testDB: testDB, router: setupMessageAPITestRouter(app, testDB)}

	client := func(name string) (apiClient, *core.User) {
		u := testDB.CreateTestUser(t, prefix+"_"+name, prefix+"_"+name+"@example.com")
		token, err := core.CreateTestJWTTokenForUser(app, u)
		require.NoError(t, err)
		return apiClient{t: t, router: s.router, token: token}, u
	}
	var gm, coGM, a, b, audience, outsider, otherGM *core.User
	s.gm, gm = client("gm")
	s.coGM, coGM = client("cogm")
	s.playerA, a = client("a")
	s.playerB, b = client("b")
	s.audience, audience = client("audience")
	s.outsider, outsider = client("outsider")
	s.otherGM, otherGM = client("othergm")
	s.aID, s.bID, s.coGMID, s.outsiderID = int32(a.ID), int32(b.ID), int32(coGM.ID), int32(outsider.ID)

	s.game = testDB.CreateTestGameWithState(t, int32(gm.ID), prefix+" game", core.GameStateInProgress)
	s.base = "/api/v1/games/" + strconv.Itoa(int(s.game.ID))
	testDB.AddTestGameParticipant(t, s.game.ID, int32(coGM.ID), "co_gm")
	testDB.AddTestGameParticipant(t, s.game.ID, int32(a.ID), "player")
	testDB.AddTestGameParticipant(t, s.game.ID, int32(b.ID), "player")
	testDB.AddTestGameParticipant(t, s.game.ID, int32(audience.ID), "audience")
	s.otherGame = testDB.CreateTestGameWithState(t, int32(otherGM.ID), prefix+" other game", core.GameStateInProgress)

	characters := &db.CharacterService{DB: testDB.Pool, Logger: app.ObsLogger}
	character := func(owner *core.User, name string) *models.Character {
		ownerID := int32(owner.ID)
		c, err := characters.CreateCharacter(ctx, db.CreateCharacterRequest{
			GameID: s.game.ID, UserID: &ownerID, Name: prefix + " " + name, CharacterType: "player_character",
		})
		require.NoError(t, err)
		return c
	}
	s.gmChar, s.aChar, s.bChar = character(gm, "Narrator"), character(a, "Alice"), character(b, "Bob")

	s.publicPost = s.mustCreate(t, s.gm, "/posts", map[string]any{"character_id": s.gmChar.ID, "content": "public"})
	s.restrictedPost = s.mustCreate(t, s.gm, "/posts", map[string]any{
		"character_id": s.gmChar.ID, "content": "secret", "restricted_to_user_ids": []int32{s.aID},
	})
	s.publicComment = s.mustCreate(t, s.playerB, fmt.Sprintf("/posts/%d/comments", s.publicPost), map[string]any{
		"character_id": s.bChar.ID, "content": "hello",
	})
	s.aComment = s.mustCreate(t, s.playerA, fmt.Sprintf("/posts/%d/comments", s.restrictedPost), map[string]any{
		"character_id": s.aChar.ID, "content": "psst",
	})
	return s
}

func (s *restrictedAPIScenario) mustCreate(t *testing.T, as apiClient, path string, body any) int32 {
	t.Helper()
	rec := as.do(http.MethodPost, s.base+path, body)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	var resp MessageResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
	return resp.ID
}

// listPosts returns the caller's Common Room list as raw JSON objects, so a
// test can tell an absent key from a null or empty one.
func (s *restrictedAPIScenario) listPosts(t *testing.T, as apiClient) map[int32]map[string]json.RawMessage {
	t.Helper()
	rec := as.do(http.MethodGet, s.base+"/posts", nil)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	var rows []map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &rows))
	byID := make(map[int32]map[string]json.RawMessage, len(rows))
	for _, row := range rows {
		var id int32
		require.NoError(t, json.Unmarshal(row["id"], &id))
		byID[id] = row
	}
	return byID
}

func TestRestrictedPostsAPI_Create(t *testing.T) {
	s := newRestrictedAPIScenario(t, "rapi_create")

	t.Run("the response carries the flag and, for the GM, the list", func(t *testing.T) {
		rec := s.gm.do(http.MethodGet, fmt.Sprintf("%s/messages/%d", s.base, s.restrictedPost), nil)
		require.Equal(t, http.StatusOK, rec.Code)
		var resp MessageResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
		assert.True(t, resp.IsRestricted)
		require.NotNil(t, resp.ViewerUserIDs)
		assert.Equal(t, []int32{s.aID}, *resp.ViewerUserIDs)
	})

	bad := map[string]any{
		"an empty list":     []int32{},
		"a co-GM":           []int32{s.coGMID},
		"a non-participant": []int32{s.aID, s.outsiderID},
		"duplicates":        []int32{s.aID, s.aID},
	}
	for name, ids := range bad {
		t.Run("rejects "+name+" with 422", func(t *testing.T) {
			rec := s.gm.do(http.MethodPost, s.base+"/posts", map[string]any{
				"character_id": s.gmChar.ID, "content": "nope", "restricted_to_user_ids": ids,
			})
			assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
		})
	}

	t.Run("null means public", func(t *testing.T) {
		rec := s.gm.do(http.MethodPost, s.base+"/posts", map[string]any{
			"character_id": s.gmChar.ID, "content": "open", "restricted_to_user_ids": nil,
		})
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		var resp MessageResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
		assert.False(t, resp.IsRestricted)
	})
}

func TestRestrictedPostsAPI_List(t *testing.T) {
	s := newRestrictedAPIScenario(t, "rapi_list")

	for name, c := range map[string]struct {
		as          apiClient
		sees        bool
		seesViewers bool
	}{
		"gm":              {s.gm, true, true},
		"co-gm":           {s.coGM, true, true},
		"audience":        {s.audience, true, true},
		"listed player":   {s.playerA, true, false},
		"unlisted player": {s.playerB, false, false},
		"non-participant": {s.outsider, false, false},
	} {
		t.Run(name, func(t *testing.T) {
			posts := s.listPosts(t, c.as)
			require.Contains(t, posts, s.publicPost)
			assert.JSONEq(t, "false", string(posts[s.publicPost]["is_restricted"]))

			row, found := posts[s.restrictedPost]
			require.Equal(t, c.sees, found)
			if found {
				assert.JSONEq(t, "true", string(row["is_restricted"]))
			}

			_, hasViewers := posts[s.publicPost]["viewer_user_ids"]
			assert.Equal(t, c.seesViewers, hasViewers, "viewer_user_ids presence on the public post")
			if c.seesViewers {
				assert.JSONEq(t, "[]", string(posts[s.publicPost]["viewer_user_ids"]))
				assert.JSONEq(t, fmt.Sprintf("[%d]", s.aID), string(row["viewer_user_ids"]))
			}
		})
	}
}

// TestRestrictedPostsAPI_Gates runs every single-message endpoint as the
// unlisted player and the non-participant. Each must answer exactly as it
// does for a message that doesn't exist.
func TestRestrictedPostsAPI_Gates(t *testing.T) {
	s := newRestrictedAPIScenario(t, "rapi_gates")
	const missing = 999999

	type call struct {
		method string
		path   string
		body   any
	}
	// gated builds each call for a hidden ID and for a missing one.
	gated := map[string]func(post, comment int32) call{
		"listPostComments": func(p, _ int32) call { return call{http.MethodGet, fmt.Sprintf("/posts/%d/comments", p), nil} },
		"listPostCommentsWithThreads": func(p, _ int32) call {
			return call{http.MethodGet, fmt.Sprintf("/posts/%d/comments-with-threads", p), nil}
		},
		"getMessage (post)":    func(p, _ int32) call { return call{http.MethodGet, fmt.Sprintf("/messages/%d", p), nil} },
		"getMessage (comment)": func(_, c int32) call { return call{http.MethodGet, fmt.Sprintf("/messages/%d", c), nil} },
		"getMessageThreadContext": func(_, c int32) call {
			return call{http.MethodGet, fmt.Sprintf("/messages/%d/thread-context", c), nil}
		},
		"createComment on the post": func(p, _ int32) call {
			return call{http.MethodPost, fmt.Sprintf("/posts/%d/comments", p), map[string]any{"character_id": s.bChar.ID, "content": "hi"}}
		},
		"createComment on a comment": func(_, c int32) call {
			return call{http.MethodPost, fmt.Sprintf("/posts/%d/comments", c), map[string]any{"character_id": s.bChar.ID, "content": "hi"}}
		},
		// A visible post ID paired with a hidden comment ID.
		"updateComment": func(_, c int32) call {
			return call{http.MethodPatch, fmt.Sprintf("/posts/%d/comments/%d", s.publicPost, c), map[string]any{"content": "edit"}}
		},
		"deleteComment": func(_, c int32) call {
			return call{http.MethodDelete, fmt.Sprintf("/posts/%d/comments/%d", s.publicPost, c), nil}
		},
		"markPostRead": func(p, _ int32) call { return call{http.MethodPost, fmt.Sprintf("/posts/%d/mark-read", p), nil} },
		"toggleCommentRead (hidden comment)": func(_, c int32) call {
			return call{http.MethodPost, fmt.Sprintf("/posts/%d/comments/%d/toggle-read", s.publicPost, c), map[string]any{"read": true}}
		},
		"toggleCommentRead (hidden post)": func(p, _ int32) call {
			return call{http.MethodPost, fmt.Sprintf("/posts/%d/comments/%d/toggle-read", p, s.publicComment), map[string]any{"read": true}}
		},
		"updatePost": func(p, _ int32) call {
			return call{http.MethodPatch, fmt.Sprintf("/posts/%d", p), map[string]any{"content": "edit"}}
		},
	}

	for name, build := range gated {
		hidden, absent := build(s.restrictedPost, s.aComment), build(missing, missing)
		for who, as := range map[string]apiClient{"unlisted player": s.playerB, "non-participant": s.outsider} {
			t.Run(name+" as "+who, func(t *testing.T) {
				recHidden := as.do(hidden.method, s.base+hidden.path, hidden.body)
				recAbsent := as.do(absent.method, s.base+absent.path, absent.body)
				assert.Equal(t, http.StatusNotFound, recHidden.Code, recHidden.Body.String())
				assert.Equal(t, recAbsent.Code, recHidden.Code, "hidden must answer like missing")
				assert.JSONEq(t, recAbsent.Body.String(), recHidden.Body.String(), "hidden must answer like missing")
			})
		}
	}

	t.Run("setCommentFavorite answers a hidden comment like a missing one", func(t *testing.T) {
		recHidden := s.playerB.do(http.MethodPut, fmt.Sprintf("/api/v1/comments/%d/favorite", s.aComment), map[string]any{"favorite": true})
		recAbsent := s.playerB.do(http.MethodPut, fmt.Sprintf("/api/v1/comments/%d/favorite", missing), map[string]any{"favorite": true})
		assert.Equal(t, http.StatusUnprocessableEntity, recHidden.Code, recHidden.Body.String())
		assert.Equal(t, recAbsent.Code, recHidden.Code)
		assert.JSONEq(t, recAbsent.Body.String(), recHidden.Body.String())
	})

	t.Run("the listed player gets through every read gate", func(t *testing.T) {
		for _, path := range []string{
			fmt.Sprintf("/posts/%d/comments", s.restrictedPost),
			fmt.Sprintf("/posts/%d/comments-with-threads", s.restrictedPost),
			fmt.Sprintf("/messages/%d", s.restrictedPost),
			fmt.Sprintf("/messages/%d", s.aComment),
			fmt.Sprintf("/messages/%d/thread-context", s.aComment),
		} {
			rec := s.playerA.do(http.MethodGet, s.base+path, nil)
			assert.Equal(t, http.StatusOK, rec.Code, path)
		}
		rec := s.playerA.do(http.MethodPut, fmt.Sprintf("/api/v1/comments/%d/favorite", s.aComment), map[string]any{"favorite": true})
		assert.Equal(t, http.StatusNoContent, rec.Code, rec.Body.String())
	})

	t.Run("viewer_user_ids is absent for the listed player", func(t *testing.T) {
		rec := s.playerA.do(http.MethodGet, fmt.Sprintf("%s/messages/%d", s.base, s.restrictedPost), nil)
		require.Equal(t, http.StatusOK, rec.Code)
		var raw map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &raw))
		assert.NotContains(t, raw, "viewer_user_ids")
		assert.JSONEq(t, "true", string(raw["is_restricted"]))
	})

	t.Run("a GM of another game can't borrow their GM flag", func(t *testing.T) {
		otherBase := "/api/v1/games/" + strconv.Itoa(int(s.otherGame.ID))
		for _, path := range []string{
			fmt.Sprintf("/messages/%d", s.restrictedPost),
			fmt.Sprintf("/messages/%d/thread-context", s.aComment),
		} {
			rec := s.otherGM.do(http.MethodGet, otherBase+path, nil)
			assert.Equal(t, http.StatusNotFound, rec.Code, path)
		}
	})
}

func TestRestrictedPostsAPI_MarkPostRead(t *testing.T) {
	s := newRestrictedAPIScenario(t, "rapi_markread")

	t.Run("a comment from another thread is rejected", func(t *testing.T) {
		rec := s.playerA.do(http.MethodPost, fmt.Sprintf("%s/posts/%d/mark-read", s.base, s.restrictedPost),
			map[string]any{"last_read_comment_id": s.publicComment})
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
	})

	t.Run("a hidden comment answers like a missing one", func(t *testing.T) {
		recHidden := s.playerB.do(http.MethodPost, fmt.Sprintf("%s/posts/%d/mark-read", s.base, s.publicPost),
			map[string]any{"last_read_comment_id": s.aComment})
		recAbsent := s.playerB.do(http.MethodPost, fmt.Sprintf("%s/posts/%d/mark-read", s.base, s.publicPost),
			map[string]any{"last_read_comment_id": 999999})
		assert.Equal(t, http.StatusUnprocessableEntity, recHidden.Code)
		assert.JSONEq(t, recAbsent.Body.String(), recHidden.Body.String())
	})

	t.Run("a comment in the thread is accepted", func(t *testing.T) {
		rec := s.playerA.do(http.MethodPost, fmt.Sprintf("%s/posts/%d/mark-read", s.base, s.restrictedPost),
			map[string]any{"last_read_comment_id": s.aComment})
		assert.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	})
}

func TestRestrictedPostsAPI_SetPostViewers(t *testing.T) {
	s := newRestrictedAPIScenario(t, "rapi_setviewers")
	path := fmt.Sprintf("%s/posts/%d/viewers", s.base, s.restrictedPost)
	canSee := func(as apiClient) bool {
		rec := as.do(http.MethodGet, fmt.Sprintf("%s/messages/%d", s.base, s.aComment), nil)
		return rec.Code == http.StatusOK
	}

	t.Run("players get 403, whether or not the post exists", func(t *testing.T) {
		for _, as := range []apiClient{s.playerA, s.playerB} {
			rec := as.do(http.MethodPut, path, map[string]any{"restricted": false})
			assert.Equal(t, http.StatusForbidden, rec.Code)
			rec = as.do(http.MethodPut, s.base+"/posts/999999/viewers", map[string]any{"restricted": false})
			assert.Equal(t, http.StatusForbidden, rec.Code)
		}
		assert.True(t, canSee(s.playerA))
		assert.False(t, canSee(s.playerB))
	})

	for name, body := range map[string]map[string]any{
		"restricted with no players": {"restricted": true, "user_ids": []int32{}},
		"restricted, list omitted":   {"restricted": true},
		"public with a list":         {"restricted": false, "user_ids": []int32{s.aID}},
		"a non-participant":          {"restricted": true, "user_ids": []int32{s.outsiderID}},
		"a co-GM":                    {"restricted": true, "user_ids": []int32{s.coGMID}},
	} {
		t.Run("422 for "+name, func(t *testing.T) {
			rec := s.gm.do(http.MethodPut, path, body)
			assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
		})
	}

	t.Run("404 for a comment, a missing post, or a post in another game", func(t *testing.T) {
		for _, p := range []string{
			fmt.Sprintf("%s/posts/%d/viewers", s.base, s.aComment),
			s.base + "/posts/999999/viewers",
		} {
			rec := s.gm.do(http.MethodPut, p, map[string]any{"restricted": false})
			assert.Equal(t, http.StatusNotFound, rec.Code, p)
		}
		// otherGM passes the role check for their own game, not this post's.
		other := fmt.Sprintf("/api/v1/games/%d/posts/%d/viewers", s.otherGame.ID, s.restrictedPost)
		rec := s.otherGM.do(http.MethodPut, other, map[string]any{"restricted": false})
		assert.Equal(t, http.StatusNotFound, rec.Code)
		assert.True(t, canSee(s.playerA), "nothing changed")
	})

	t.Run("the GM moves access from A to B", func(t *testing.T) {
		rec := s.gm.do(http.MethodPut, path, map[string]any{"restricted": true, "user_ids": []int32{s.bID}})
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var resp MessageResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
		assert.True(t, resp.IsRestricted)
		require.NotNil(t, resp.ViewerUserIDs)
		assert.Equal(t, []int32{s.bID}, *resp.ViewerUserIDs)

		assert.False(t, canSee(s.playerA))
		assert.True(t, canSee(s.playerB))
	})

	t.Run("a co-GM makes it public", func(t *testing.T) {
		rec := s.coGM.do(http.MethodPut, path, map[string]any{"restricted": false})
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		var resp MessageResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
		assert.False(t, resp.IsRestricted)
		require.NotNil(t, resp.ViewerUserIDs)
		assert.Empty(t, *resp.ViewerUserIDs)

		assert.True(t, canSee(s.playerA))
		assert.True(t, canSee(s.outsider))
	})
}

func TestRestrictedPostsAPI_PublicArchive(t *testing.T) {
	s := newRestrictedAPIScenario(t, "rapi_archive")

	for _, state := range []string{core.GameStateEpilogue, core.GameStateCompleted} {
		t.Run(state+" shows the thread to everyone", func(t *testing.T) {
			s.testDB.SetGameStateDirectly(t, s.game.ID, state)
			for _, as := range []apiClient{s.playerB, s.outsider} {
				assert.Contains(t, s.listPosts(t, as), s.restrictedPost)
				rec := as.do(http.MethodGet, fmt.Sprintf("%s/messages/%d/thread-context", s.base, s.aComment), nil)
				assert.Equal(t, http.StatusOK, rec.Code)
			}
		})
	}

	t.Run("cancelled does not", func(t *testing.T) {
		s.testDB.SetGameStateDirectly(t, s.game.ID, core.GameStateCancelled)
		assert.NotContains(t, s.listPosts(t, s.playerB), s.restrictedPost)
		rec := s.playerB.do(http.MethodGet, fmt.Sprintf("%s/messages/%d", s.base, s.aComment), nil)
		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}

func TestRestrictedPostsAPI_DraftPost(t *testing.T) {
	s := newRestrictedAPIScenario(t, "rapi_draft")
	app := core.NewTestApp(s.testDB.Pool)
	router := setupDraftPostRouter(app, s.testDB)
	gm := apiClient{t: t, router: router, token: s.gm.token}
	phase := s.testDB.CreateTestPhase(t, s.game.ID, "common_room", "pending")
	path := fmt.Sprintf("/api/v1/phases/%d/draft-post", phase.ID)

	t.Run("a bad list is 422 and writes no draft", func(t *testing.T) {
		rec := gm.do(http.MethodPost, path, map[string]any{
			"character_id": s.gmChar.ID, "content": "x", "restricted_to_user_ids": []int32{s.outsiderID},
		})
		assert.Equal(t, http.StatusUnprocessableEntity, rec.Code, rec.Body.String())
		rec = gm.do(http.MethodGet, path, nil)
		assert.JSONEq(t, "null", rec.Body.String())
	})

	t.Run("a restricted draft reports its list to the GM", func(t *testing.T) {
		rec := gm.do(http.MethodPost, path, map[string]any{
			"character_id": s.gmChar.ID, "content": "scene", "restricted_to_user_ids": []int32{s.aID},
		})
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		var resp MessageResponse
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &resp))
		assert.True(t, resp.IsDraft)
		assert.True(t, resp.IsRestricted)
		require.NotNil(t, resp.ViewerUserIDs)
		assert.Equal(t, []int32{s.aID}, *resp.ViewerUserIDs)

		// Drafts are GM-only on the deep-link endpoints too, even for the
		// listed player.
		rec = s.playerA.do(http.MethodGet, fmt.Sprintf("%s/messages/%d", s.base, resp.ID), nil)
		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}
