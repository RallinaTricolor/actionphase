package core

import "errors"

// ErrNotImplemented is returned by mock methods that have not been implemented
var ErrNotImplemented = errors.New("not implemented")
