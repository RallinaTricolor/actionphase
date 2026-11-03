/**
 * Which controls a result (or one part of a staged chain) gets, for every
 * editor of results: the results list and the results board use the same
 * rules, so a GM can do the same things in both.
 */

import type { ActionResult } from '@/types/phases';

type PartFields = Pick<ActionResult, 'is_published' | 'part_number' | 'part_count' | 'released_at'>;

/** Part of a chain of two or more. An unstaged result is a chain of one. */
export const isStagedPart = (r: PartFields) => r.part_count !== undefined && r.part_count > 1;

/**
 * A chain member that isn't the head. Its lifecycle belongs to the chain: it
 * is published with the head, released by the worker, and removed with Cancel
 * rather than Delete.
 */
const isFollowerPart = (r: PartFields) => isStagedPart(r) && r.part_number !== 1;

/**
 * Cancel removes an unreleased part and the parts behind it. Guarded on
 * release, not publication, matching DeleteStagedPart's SQL: a draft follower
 * is equally removable, and Cancel is the only removal control such a part
 * gets, since Delete is a chain-head action.
 */
export const canCancelPart = (r: PartFields) => isFollowerPart(r) && !r.released_at;

/**
 * The last part of its chain. An unstaged draft is a chain of one and so its
 * own tail, which is how a GM stages a result they saved earlier.
 */
export const isChainTail = (r: PartFields) => !isStagedPart(r) || r.part_number === r.part_count;

/**
 * A follow-up can be added only while the whole chain is a draft (the server
 * refuses otherwise), and only from the tail, since a new part always lands
 * at the end.
 */
export const canAppendPart = (r: PartFields) => !r.is_published && isChainTail(r);

/**
 * Publish and Delete belong to the chain, so only the head of a draft carries
 * them: Publish sends the whole chain, and Delete on part 1 deletes the chain.
 */
export const hasChainControls = (r: PartFields) => !r.is_published && !isFollowerPart(r);

/**
 * Sheet updates go on the chain tail: they apply at publish, and the reward
 * belongs to the part that earns it. One control per chain also keeps a
 * character's sheet changes on one result (each draft is a whole snapshot).
 */
export const takesSheetUpdates = (r: PartFields) => !r.is_published && isChainTail(r);

/**
 * Retiming is guarded on release, not publication: the usual reason to move a
 * timer is that the scene is live and the players need longer. The head has
 * no delay to edit.
 */
export const canEditDelay = (r: PartFields) => isStagedPart(r) && !r.released_at && r.part_number !== 1;
