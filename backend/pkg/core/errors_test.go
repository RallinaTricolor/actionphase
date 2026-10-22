package core

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestUserMessage(t *testing.T) {
	sentinel := errors.New("invalid staged result chain")

	t.Run("drops the sentinel and capitalizes the reason", func(t *testing.T) {
		err := fmt.Errorf("%w: part 2: delay must be between 1 and 1440 minutes", sentinel)
		assert.Equal(t, "Part 2: delay must be between 1 and 1440 minutes", UserMessage(err, sentinel))
	})

	t.Run("keeps an error that does not carry the sentinel", func(t *testing.T) {
		assert.Equal(t, "Something else", UserMessage(errors.New("something else"), sentinel))
	})
}

// Regression: registration showed go-playground's own text, "Key:
// 'User.Password' Error:Field validation for 'Password' failed on the 'min'
// tag".
func TestUserValidate_Sentences(t *testing.T) {
	err := (&User{Username: "", Email: "nope", Password: "short"}).Validate()

	assert.EqualError(t, err,
		"Username is required. Email must be a valid email address. Password must be at least 8 characters")
}
