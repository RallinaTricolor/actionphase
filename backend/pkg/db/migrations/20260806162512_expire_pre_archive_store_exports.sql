-- +goose Up
-- Archives moved from the shared storage backend (uploads tree / S3 bucket) to
-- a private local ArchiveStore rooted at STORAGE_ARCHIVE_PATH.
--
-- Rows written before that change point at files the new download handler
-- cannot open, so a download would 409 with "no longer available" even though
-- the row claims to be complete. Clear those paths so the rows read as expired:
-- the UI then offers "Prepare download", which regenerates in seconds.
--
-- Identified by storage_path rather than by date: the path shape is what
-- actually determines whether the artifact is reachable.
UPDATE game_exports
SET storage_path = NULL
WHERE storage_path IS NOT NULL
  AND status = 'complete';

-- The orphaned files themselves are left in place. They are no longer
-- referenced by any row, so the retention sweep will never see them; removing
-- them is a one-off operational cleanup, not a schema concern.

-- +goose Down
-- Irreversible by design: the up migration discards storage paths whose files
-- are unreachable under the current storage layout, and the original values
-- cannot be reconstructed from the remaining columns.
--
-- Nothing to undo. Affected rows read as expired and regenerate on request,
-- which is the same state a normal retention sweep would leave them in.
SELECT 1;
