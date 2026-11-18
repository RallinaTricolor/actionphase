package gmboard

import (
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"actionphase/pkg/core"
)

// The kind enum is a struct tag, so it can't reference the core lists. This
// keeps the two in step.
func TestKindEnumsMatchCore(t *testing.T) {
	enumOf := func(v any) []string {
		f, _ := reflect.TypeOf(v).FieldByName("Kind")
		return strings.Split(f.Tag.Get("enum"), ",")
	}
	assert.Equal(t, core.GmBoardItemKinds, enumOf(BoardItemChange{}))
	assert.Equal(t, core.GmSettingsItemKinds, enumOf(SettingsItemChange{}))
}
