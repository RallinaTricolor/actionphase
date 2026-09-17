import type { components } from './api.gen';

/**
 * Status of an archive export job.
 *
 * - pending: queued, not yet claimed by the worker
 * - running: being assembled
 * - complete: artifact stored and downloadable
 * - failed: assembly or upload failed; `error` explains why
 */
export type GameExportStatus = GameExport['status'];

/**
 * An archive export job as returned by the API. Generated.
 *
 * `status` carries its four-value union because the Go field is now enum-tagged
 * (pinned by the CHECK constraint on game_exports.status); it rendered as bare
 * `string` until then, so aliasing would have silently widened it.
 *
 * `expired` is reported by the API but deliberately not surfaced in the UI: an
 * expired export and a never-created one call for the same action -- generate
 * the archive -- so distinguishing them would add a label the reader cannot act
 * on. Absence of `download_url` is what drives the UI.
 *
 * `progress` is present only while running, `error` only on failure, and
 * `download_url` only when complete and the artifact still exists.
 */
export type GameExport = components['schemas']['ExportResponse'];

/** True when the job is still being worked on and should be polled. */
export function isExportInProgress(status: GameExportStatus): boolean {
  return status === 'pending' || status === 'running';
}
