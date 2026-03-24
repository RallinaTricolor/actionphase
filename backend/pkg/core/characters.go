package core

// CharacterActivityStats holds public and private message counts for a character.
// PrivateMessages is nil when the requester is not authorized to see it.
type CharacterActivityStats struct {
	PublicMessages  int64  `json:"public_messages"`
	PrivateMessages *int64 `json:"private_messages,omitempty"`
}
