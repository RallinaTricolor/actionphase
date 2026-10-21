package humaconfig

import (
	"context"
	"net/http"
	"testing"

	"actionphase/pkg/observability"

	"github.com/danielgtaylor/huma/v2"
)

// stubContext is the minimum huma.Context needed to reach the request context.
//
// huma.Context is a wide interface, but the hook under test only ever calls
// Context() on it. Embedding the interface anonymously is not possible -- the
// embedded field would be named Context and collide with the method of the same
// name -- so the interface is embedded through an intermediate alias whose name
// differs, leaving the remaining methods promoted (and nil, which is safe
// precisely because nothing calls them).
type humaCtx = huma.Context

type stubContext struct {
	humaCtx
	requestCtx context.Context
}

func (s stubContext) Context() context.Context { return s.requestCtx }

// TestInstallProblemErrorFormat_StampsCorrelationID covers the support path: an
// error body alone must be enough to find the request in the logs.
func TestInstallProblemErrorFormat_StampsCorrelationID(t *testing.T) {
	original := huma.NewErrorWithContext
	t.Cleanup(func() { huma.NewErrorWithContext = original })
	InstallProblemErrorFormat()

	ctx := observability.WithCorrelationID(context.Background(), "corr-xyz789")
	err := huma.NewErrorWithContext(stubContext{requestCtx: ctx}, http.StatusForbidden, "nope")

	model, ok := err.(*huma.ErrorModel)
	if !ok {
		t.Fatalf("Expected *huma.ErrorModel, got %T", err)
	}
	if model.Instance != "urn:actionphase:correlation:corr-xyz789" {
		t.Errorf("Unexpected instance: %q", model.Instance)
	}
	// Huma's own RFC 7807 fields must survive untouched.
	if model.Title != "Forbidden" {
		t.Errorf("Unexpected title: %q", model.Title)
	}
	if model.Status != http.StatusForbidden {
		t.Errorf("Unexpected status: %d", model.Status)
	}
	if model.Detail != "nope" {
		t.Errorf("Unexpected detail: %q", model.Detail)
	}
}

// TestInstallProblemErrorFormat_NoCorrelationID guards against emitting a bare
// "urn:actionphase:correlation:" prefix with no ID behind it.
func TestInstallProblemErrorFormat_NoCorrelationID(t *testing.T) {
	original := huma.NewErrorWithContext
	t.Cleanup(func() { huma.NewErrorWithContext = original })
	InstallProblemErrorFormat()

	err := huma.NewErrorWithContext(stubContext{requestCtx: context.Background()}, http.StatusNotFound, "missing")

	model, ok := err.(*huma.ErrorModel)
	if !ok {
		t.Fatalf("Expected *huma.ErrorModel, got %T", err)
	}
	if model.Instance != "" {
		t.Errorf("Expected empty instance, got %q", model.Instance)
	}
}

// TestInstallProblemErrorFormat_ValidationDetails verifies field-level failures
// still reach the client as the RFC 7807 errors[] array. This is the payoff the
// old flattened "error" string could not express.
func TestInstallProblemErrorFormat_ValidationDetails(t *testing.T) {
	original := huma.NewErrorWithContext
	t.Cleanup(func() { huma.NewErrorWithContext = original })
	InstallProblemErrorFormat()

	detail := &huma.ErrorDetail{Message: "expected string", Location: "body.name", Value: 5}
	err := huma.NewErrorWithContext(stubContext{requestCtx: context.Background()},
		http.StatusUnprocessableEntity, "validation failed", detail)

	model, ok := err.(*huma.ErrorModel)
	if !ok {
		t.Fatalf("Expected *huma.ErrorModel, got %T", err)
	}
	if len(model.Errors) != 1 {
		t.Fatalf("Expected 1 error detail, got %d", len(model.Errors))
	}
	// The message is humanized; the location a client maps to a field is not.
	if model.Errors[0].Message != "Name must be text" || model.Errors[0].Location != "body.name" {
		t.Errorf("Unexpected detail: %+v", model.Errors[0])
	}
}

// TestInstallProblemErrorFormat_HumanizesDetail is the production bug: a GM
// whose description was too short saw only "validation failed". The generic
// detail must be replaced by what was actually wrong, since detail is what the
// frontend displays.
func TestInstallProblemErrorFormat_HumanizesDetail(t *testing.T) {
	original := huma.NewErrorWithContext
	t.Cleanup(func() { huma.NewErrorWithContext = original })
	InstallProblemErrorFormat()

	err := huma.NewErrorWithContext(stubContext{requestCtx: context.Background()},
		http.StatusUnprocessableEntity, "validation failed",
		&huma.ErrorDetail{Message: "expected length >= 10", Location: "body.description", Value: "short"},
		&huma.ErrorDetail{Message: "expected required property title to be present", Location: "body"},
	)

	model := err.(*huma.ErrorModel)
	want := "Description must be at least 10 characters. Title is required"
	if model.Detail != want {
		t.Errorf("Detail = %q, want %q", model.Detail, want)
	}
	// The JSON name leaves the message, so it must survive in the location.
	if got := model.Errors[1].Location; got != "body.title" {
		t.Errorf("missing-property location = %q, want body.title", got)
	}
}

// TestInstallProblemErrorFormat_OneSentencePerField: a missing title fails
// both the schema and the Resolve hook's blank check. The summary should name
// the problem once.
func TestInstallProblemErrorFormat_OneSentencePerField(t *testing.T) {
	original := huma.NewErrorWithContext
	t.Cleanup(func() { huma.NewErrorWithContext = original })
	InstallProblemErrorFormat()

	err := huma.NewErrorWithContext(stubContext{requestCtx: context.Background()},
		http.StatusUnprocessableEntity, "validation failed",
		&huma.ErrorDetail{Message: "expected required property title to be present", Location: "body"},
		&huma.ErrorDetail{Message: "title must not be blank", Location: "body.title"},
	)

	model := err.(*huma.ErrorModel)
	if model.Detail != "Title is required" {
		t.Errorf("Detail = %q, want %q", model.Detail, "Title is required")
	}
	if len(model.Errors) != 2 {
		t.Errorf("errors[] should keep both details, got %d", len(model.Errors))
	}
}

// TestInstallProblemErrorFormat_KeepsChosenDetail: only huma's generic detail
// is replaced. A handler that wrote its own keeps it.
func TestInstallProblemErrorFormat_KeepsChosenDetail(t *testing.T) {
	original := huma.NewErrorWithContext
	t.Cleanup(func() { huma.NewErrorWithContext = original })
	InstallProblemErrorFormat()

	err := huma.NewErrorWithContext(stubContext{requestCtx: context.Background()},
		http.StatusBadRequest, "That phase has already ended",
		&huma.ErrorDetail{Message: "expected length >= 3", Location: "body.title"})

	if got := err.(*huma.ErrorModel).Detail; got != "That phase has already ended" {
		t.Errorf("Detail = %q, want the handler's own", got)
	}
}

func TestHumanizeMessage(t *testing.T) {
	tests := []struct {
		location, message, want string
	}{
		{"body.description", "expected length >= 10", "Description must be at least 10 characters"},
		{"body.title", "expected length >= 1", "Title is required"},
		{"body.reason", "expected length <= 100", "Reason must be at most 100 characters"},
		{"body", "expected required property title to be present", "Title is required"},
		{"body", "expected required property character_id to be present", "Character is required"},
		{"body.community_id", "expected number >= 1", "Community is required"},
		{"body.common_room_open_day", "expected number <= 6", "Common room open day must be at most 6"},
		{"body.max_players", "expected number >= 0", "Max players must be at least 0"},
		{"query.page", "expected number > 0", "Page must be greater than 0"},
		{"body.role", `expected value to be one of "player, audience"`, "Role must be one of: player, audience"},
		{"body.options", "expected array length >= 2", "Options must have at least 2 items"},
		{"body.options", "expected array length <= 1", "Options must have at most 1 item"},
		{"body.email", "expected string to be RFC 5322 email: mail: missing @", "Email must be a valid email address"},
		{"body.deadline", "expected string to be RFC 3339 date-time", "Deadline must be a valid date and time"},
		{"body.website", "expected string to be RFC 3986 uri: parse error", "Website must be a valid URL"},
		{"body.slug", "expected string to match pattern ^[a-z]+$", "Slug is not in a valid format"},
		{"body.slug", "expected string to be lowercase letters", "Slug must be lowercase letters"},
		{"body.options[2].text", "expected length >= 1", "Text is required"},
		{"path.gameID", "expected integer", "Game must be a whole number"},
		{"body.character_sheet", "unexpected property", "Character sheet is not a recognised field"},
		// Hand-written Resolve messages keep their wording, with the raw field
		// name swapped for its label.
		{"body.title", "title must not be blank", "Title must not be blank"},
		{"body.common_room_open_time", "common_room_open_time must not be blank", "Common room open time must not be blank"},
		{"body", "schedule fields must be all set or all empty", "Schedule fields must be all set or all empty"},
		{"body.question", "deadline must be in the future", "Deadline must be in the future"},
	}
	for _, tt := range tests {
		t.Run(tt.location+"/"+tt.message, func(t *testing.T) {
			if got := humanizeMessage(tt.location, tt.message); got != tt.want {
				t.Errorf("humanizeMessage(%q, %q) = %q, want %q", tt.location, tt.message, got, tt.want)
			}
		})
	}
}

func TestCorrelationInstance(t *testing.T) {
	if got := CorrelationInstance(""); got != "" {
		t.Errorf("Expected empty string for empty ID, got %q", got)
	}
	if got := CorrelationInstance("abc"); got != "urn:actionphase:correlation:abc" {
		t.Errorf("Unexpected URI: %q", got)
	}
}
