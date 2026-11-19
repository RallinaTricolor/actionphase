package core

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestTextColors pins the exact set of colour names the renderer knows. It must
// stay equal to TEXT_COLORS in
// frontend/src/components/common/markdown/textColors.ts — the two lists cannot
// be compared automatically because neither test container mounts the other's
// tree, so this literal is the checkpoint. If they drift, the server disagrees
// with the app: archives leave a colour the app renders wrapped in
// [color:...] markup, or strip one the app showed literally, and the
// scoreboard's label limit counts a tag the app shows as text, or the reverse.
func TestTextColors(t *testing.T) {
	want := []string{
		"blue", "brown", "gold", "gray", "green", "olive", "orange", "pink",
		"purple", "red", "silver", "teal",
	}

	got := make([]string, 0, len(textColors))
	for color := range textColors {
		got = append(got, color)
	}
	sort.Strings(got)

	assert.Equal(t, want, got)
}
