package games

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRolledEntry(t *testing.T) {
	t.Run("adds a fresh id and keeps every value's exact JSON", func(t *testing.T) {
		out, err := rolledEntry(`{"id":"authored","name":"Rope","quantity":1e2,"tags":["a"]}`)
		require.NoError(t, err)

		var entry map[string]json.RawMessage
		require.NoError(t, json.Unmarshal([]byte(out), &entry))
		assert.NotEqual(t, `"authored"`, string(entry["id"]))
		assert.Len(t, string(entry["id"]), 38, "a quoted UUID")
		assert.Equal(t, "1e2", string(entry["quantity"]))
		assert.Equal(t, `["a"]`, string(entry["tags"]))
	})

	t.Run("each call gets its own id", func(t *testing.T) {
		a, err := rolledEntry(`{"name":"Rope"}`)
		require.NoError(t, err)
		b, err := rolledEntry(`{"name":"Rope"}`)
		require.NoError(t, err)
		assert.NotEqual(t, a, b)
	})

	for _, data := range []string{`"a string"`, `[{"name":"Rope"}]`, `null`, `3`, `not json`} {
		t.Run("refuses "+data, func(t *testing.T) {
			_, err := rolledEntry(data)
			assert.Error(t, err)
		})
	}
}
