/**
 * Dashboard Types
 *
 * Type definitions for the user dashboard data aggregation feature.
 */

import type { components } from './api.gen';

/**
 * Generated. A game card on the dashboard.
 *
 * Six fields were declared `| null` and are in fact OMITTED: every one is an
 * `omitempty` pointer on the Go side, so a nil value drops the key rather than
 * marshalling null. All read sites already truthy-guard, so narrowing changes
 * nothing except the type telling the truth.
 *
 * `deadline_status` keeps its union because the Go field is now enum-tagged --
 * it generated as bare `string` until then, so aliasing would have silently
 * widened it.
 */
export type DashboardGameCard = components['schemas']['DashboardGameCard'];

/** Generated. A recent-message preview. `message_type` is pinned by the
 *  message_type Postgres ENUM. */
export type DashboardMessage = components['schemas']['DashboardMessage'];

/** Generated. An upcoming phase or arbitrary deadline. */
export type DashboardDeadline = components['schemas']['DashboardDeadline'];

/**
 * Generated. The whole dashboard payload.
 *
 * Its six arrays needed a backend `nullable:"false"` first: groupGamesByRole
 * make()s all four of its returns, with a comment saying so, and the two
 * transform helpers do the same. Without the tags every `.map()` on the
 * dashboard would have needed a dead `?? []`.
 */
export type DashboardData = components['schemas']['DashboardData'];
