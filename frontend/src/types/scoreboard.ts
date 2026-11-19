/**
 * Scoreboard wire types. All generated.
 *
 * Two different shapes share the name "column". `ScoreboardColumn` is the GM's
 * stored setup (where a value comes from, how it reads). `ScoreboardResultColumn`
 * is what a viewer gets back: a heading and a display, with the source left out.
 */

import type { components } from './api.gen';

/** The board as this viewer may see it. Rows are already filtered and sorted. */
export type Scoreboard = components['schemas']['ScoreboardResult'];
type ScoreboardResultColumn =components['schemas']['ScoreboardResultColumn'];
export type ScoreboardRow = components['schemas']['ScoreboardRow'];
export type ScoreboardCell = components['schemas']['ScoreboardCell'];
export type ScoreboardSortDescription = components['schemas']['ScoreboardSortDescription'];

/** The GM's setup. Sparse: an absent key means its default. */
export type ScoreboardConfig = components['schemas']['ScoreboardConfig'];
export type ScoreboardColumn = components['schemas']['ScoreboardColumn'];
export type ScoreboardBand = components['schemas']['ScoreboardBand'];
export type ScoreboardSort = components['schemas']['ScoreboardSort'];

export type ScoreboardVisibility = NonNullable<ScoreboardConfig['visibility']>;
export type ScoreboardDisplay = ScoreboardResultColumn['display'];
export type ScoreboardBandBasis = NonNullable<ScoreboardColumn['band_basis']>;

/** Entry names in use on each tab that can feed a column, for the editor's picker. */
export type ScoreboardEntryNames = components['schemas']['EntryNamesResponse'];
