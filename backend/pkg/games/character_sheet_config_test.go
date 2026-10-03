package games

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"actionphase/pkg/core"
	"actionphase/pkg/humaconfig"

	"github.com/danielgtaylor/huma/v2"
	"github.com/go-chi/chi/v5"
)

// bindThroughHuma runs a JSON body through huma's real decode-and-resolve path
// and hands back the bound body.
//
// These tests used to call render.Bind on CreateGameRequest. That pipeline is
// gone: huma owns request binding now, and it is huma's strictness -- not a
// json.RawMessage plus DisallowUnknownFields -- that keeps an unknown key from
// being silently dropped. Exercising the real path is the whole point of the
// unknown-key cases below.
func bindThroughHuma[T any](t *testing.T, method, body string) (*T, error) {
	t.Helper()

	type in struct{ Body *T }

	var bound *T
	r := chi.NewRouter()
	api := humaconfig.New(r, "test", "1.0.0")
	huma.Register(api, huma.Operation{
		OperationID: "bind",
		Method:      method,
		Path:        "/bind",
	}, func(ctx context.Context, i *in) (*struct{}, error) {
		bound = i.Body
		return &struct{}{}, nil
	})

	req := httptest.NewRequest(method, "/bind", bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code >= 400 {
		return nil, fmt.Errorf("rejected with %d: %s", rec.Code, rec.Body.String())
	}
	return bound, nil
}

func bindCreate(t *testing.T, body string) (*createGameBody, error) {
	t.Helper()
	return bindThroughHuma[createGameBody](t, http.MethodPost, body)
}

// The layout is written only through PUT /games/{id}/character-sheet. The game
// bodies used to carry it too, and a settings save that omitted it reset the
// GM's tab names. Rejecting the key (rather than ignoring it) makes a client
// still sending it fail loudly instead of believing it saved something.
func TestGameBodiesRejectCharacterSheet(t *testing.T) {
	const sheet = `"character_sheet":{"labels":{"skills":"Approaches"}}`

	if _, err := bindCreate(t, `{"title":"A Test Game","description":"A description long enough to validate.","community_id":1,`+sheet+`}`); err == nil {
		t.Error("create: expected character_sheet to be rejected")
	}
	if _, err := bindThroughHuma[updateGameBody](t, http.MethodPut, `{"title":"A Test Game","description":"A description long enough to validate.",`+sheet+`}`); err == nil {
		t.Error("update: expected character_sheet to be rejected")
	}
}

// Huma rejects unknown properties on nested objects, which is what replaced the
// json.RawMessage + DisallowUnknownFields workaround the chi version needed. If
// these fail, the strict decode has been bypassed and the stored layout can
// accumulate junk.
func TestCharacterSheetBodyRejectsUnknownKeys(t *testing.T) {
	bind := func(body string) error {
		_, err := bindThroughHuma[core.CharacterSheetConfig](t, http.MethodPut, body)
		return err
	}

	if err := bind(`{"tabs":[{"key":"t_abc123","label":"Contacts","fields":[{"key":"f_loc001","label":"Location","type":"text"}]}]}`); err != nil {
		t.Fatalf("a valid layout must bind: %v", err)
	}

	for name, body := range map[string]string{
		"top level":  `{"presets":[]}`,
		"in labels":  `{"labels":{"abilities":"Powers"}}`,
		"in a tab":   `{"tabs":[{"key":"skills","public":true}]}`,
		"in a field": `{"tabs":[{"key":"skills","fields":[{"key":"rank","label":"Rank","type":"text","required":true}]}]}`,
	} {
		t.Run(name, func(t *testing.T) {
			if err := bind(body); err == nil {
				t.Fatalf("expected %s to be rejected", body)
			}
		})
	}
}

func TestCharacterSheetResponse(t *testing.T) {
	t.Run("empty stored config omits the key entirely", func(t *testing.T) {
		// Every game predating the feature stores exactly this.
		if got := characterSheetResponse([]byte(`{}`)); got != nil {
			t.Errorf("expected nil so the key is omitted, got %+v", got)
		}
	})

	t.Run("nil stored config omits the key entirely", func(t *testing.T) {
		if got := characterSheetResponse(nil); got != nil {
			t.Errorf("expected nil, got %+v", got)
		}
	})

	t.Run("stored overrides are carried as stored", func(t *testing.T) {
		got := characterSheetResponse([]byte(`{"labels":{"skills":"Approaches"}}`))
		if got == nil || got.Labels == nil {
			t.Fatal("expected the override to be carried")
		}
		if got.Labels.Skills != "Approaches" {
			t.Errorf("skills = %q", got.Labels.Skills)
		}
		// Defaults are NOT filled in server-side — the frontend owns them, so
		// there is exactly one place that knows what a default label is.
		if got.Labels.Inventory != "" || got.Labels.Numbers != "" {
			t.Errorf("server filled in defaults it should not know: %+v", got.Labels)
		}
	})

	t.Run("a malformed stored value degrades to no config", func(t *testing.T) {
		// Server-written and validated on the way in, so this means a bug or a
		// hand-edited row. Losing a label override beats failing the whole
		// game response over one.
		if got := characterSheetResponse([]byte(`{"labels":`)); got != nil {
			t.Errorf("expected nil for malformed stored JSON, got %+v", got)
		}
	})

	t.Run("omitempty actually omits the key", func(t *testing.T) {
		encoded, err := json.Marshal(&GameResponse{ID: 1, Title: "T"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if strings.Contains(string(encoded), "character_sheet") {
			t.Errorf("expected character_sheet to be omitted, got %s", encoded)
		}
	})
}
