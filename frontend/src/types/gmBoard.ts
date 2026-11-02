/**
 * GM results board wire types.
 *
 * The board stores its working state one item per row: a card, a scene, a
 * stance, and so on. Each item's `doc` is client-owned JSON (its shape is in
 * `lib/gmBoard/types.ts`), so the wire types type it as `unknown`.
 */

import type { components } from './api.gen';

/**
 * One stored item. `version` is what the next change sends as
 * `base_version`; `seq` orders changes for polling. A tombstone
 * (`deleted: true`) has no `doc`. An item that doesn't exist at all is
 * reported (in a conflict) as a tombstone at version 0 with no `updated_at`.
 */
export type GmItem = components['schemas']['GmItemResponse'];

/** A full load (live items) or a poll (`since`, tombstones included). */
export type GmItems = components['schemas']['GmItemsResponse'];

/** A game's board settings, plus whether the boards are shared. */
export type GmSettings = components['schemas']['GmSettingsResponse'];

/** A saved batch, as written. */
export type GmItemsWritten = components['schemas']['GmItemsWrittenResponse'];

/**
 * The 409 body of a save. `conflicts` holds the server's copy of each item
 * the batch named at a stale version; it is absent when the 409 means the
 * game is archived. Either way nothing in the batch was written.
 */
export type GmBoardConflict = components['schemas']['GmBoardConflictResponse'];

export type BoardItemChange = components['schemas']['BoardItemChange'];
export type SettingsItemChange = components['schemas']['SettingsItemChange'];
export type BoardItemKind = BoardItemChange['kind'];

export type GmSharing = components['schemas']['SharingResponse'];
