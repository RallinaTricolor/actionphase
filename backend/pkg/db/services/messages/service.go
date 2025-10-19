package messages

import (
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Compile-time verification that MessageService implements MessageServiceInterface
// TODO: Uncomment after all methods are migrated
// var _ core.MessageServiceInterface = (*MessageService)(nil)

// MessageService handles message and comment operations for the Common Room and private messaging.
// All messages must be sent as characters and are associated with a game.
type MessageService struct {
	DB *pgxpool.Pool
}

// Helper function to convert *int32 to pgtype.Int4
func int32ToPgInt4(val *int32) pgtype.Int4 {
	if val == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: *val, Valid: true}
}

// Helper function to convert int32 to pgtype.Int4
func int32ValueToPgInt4(val int32) pgtype.Int4 {
	return pgtype.Int4{Int32: val, Valid: true}
}
