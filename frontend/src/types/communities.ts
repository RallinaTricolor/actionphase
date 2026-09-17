/**
 * Community types.
 *
 * Communities are tenant-like groupings that own games, a moderator roster, a
 * banlist, and their own documentation. Membership is deliberately OPEN --
 * there is no roster or allowlist; the banlist is the whole access-control
 * mechanism.
 */

import type { components } from './api.gen';

/**
 * Generated. A community as any read endpoint returns it.
 *
 * `your_role` and `is_banned` describe the REQUESTING USER, not the community:
 * both are recomputed per request, which is why they ride on the response
 * rather than a cached login payload. They were declared optional here "so
 * fixtures and older cached payloads still typecheck" -- the server always
 * sends them, so that optionality only ever hid inaccurate fixtures.
 *
 * Gate moderation UI on `your_role`, never on `owner_user_id`: that comparison
 * misses moderators entirely, and misses a site admin with admin mode on.
 *
 * `is_banned` means CURRENTLY banned -- an expired ban leaves its row behind
 * deliberately, so never infer a ban from a row's presence. Use it to filter
 * the game-creation picker, not the browse listing: a ban blocks joining, not
 * looking, and the check on game creation is the real enforcement.
 *
 * `banner_url` is read-only here; banners are uploaded objects written through
 * a dedicated upload/delete endpoint. `slug` is immutable after creation.
 */
export type Community = components['schemas']['Community'];

/**
 * A user's standing within one community.
 *
 * Owner and moderator are two tiers, not one ranked enum: moderators may do
 * everything an owner can EXCEPT manage the moderator roster.
 */
// The module-private CommunityRole that used to sit here typed Community's
// your_role field by hand. That type is generated now and carries the union
// itself (from an enum tag on the Go field), leaving this with no consumers.
// Recover it as Community['your_role'] if one is ever needed.

export type CommunityModerator = components['schemas']['CommunityModerator'];

/** Admin-only: creating a community and assigning its owner. */
/**
 * POST /admin/communities — generated from the OpenAPI spec
 * (`just gen-api-types`), so an unknown property is a build failure rather than
 * a 422 at runtime.
 */
export type CreateCommunityRequest = components['schemas']['CreateCommunityInputBody'];

/**
 * Partial update. An omitted field is left unchanged.
 * `slug` is absent on purpose -- it is immutable after creation.
 */
/** PATCH /admin/communities/{id} — the site-admin edit. Generated, as above. */
export type UpdateCommunityRequest = components['schemas']['UpdateCommunityInputBody'];

/**
 * Moderator-level profile edit: name and description only.
 *
 * Deliberately NOT `Pick<UpdateCommunityRequest, ...>`. The server rejects
 * unknown properties on this route with a 400, so owner_user_id and is_active
 * must be unreachable here rather than merely discouraged -- reassigning
 * ownership and deactivating a community stay site-admin acts.
 *
 * `description: ''` CLEARS the blurb; omitting the key leaves it unchanged.
 */
export type UpdateCommunityProfileRequest = components['schemas']['UpdateCommunityProfileInputBody'];


/** Owner-only: granting a user moderation powers.
 *  POST /communities/{slug}/moderators. Generated, as above. */
export type AddModeratorRequest = components['schemas']['AddModeratorInputBody'];

/**
 * One user's exclusion from one community's games.
 *
 * Bans are NOT retroactive: a ban blocks a user from entering new games, but
 * never ejects them from games already in progress. Removing an existing
 * participant stays the GM's decision.
 */
/**
 * Generated.
 *
 * `expires_at` absent means PERMANENT. An expired ban is NOT deleted -- it stays
 * on the list so a moderator can see it lapsed rather than watching it vanish,
 * so never infer "banned" from a row's presence. Render from `is_active`, which
 * the server computes from the clock at read time.
 *
 * `username` is OPTIONAL, which the hand-written type got wrong by requiring it.
 * Two endpoints answer with this shape and only one fills it in: the banlist
 * joins the users table, while POST .../bans returns the bare INSERT row via
 * banFromDB, whose doc comment says "Callers needing the username re-list."
 * Pinned by TestCommunityBanUsernameIsOptional.
 */
export type CommunityBan = components['schemas']['CommunityBan'];

/**
 * One entry in a community's append-only ban audit log.
 *
 * Separate from the banlist because lifting a ban DELETES its row: for an
 * unbanned user this log is the only surviving record the ban ever existed.
 * `reason` and `expires_at` are SNAPSHOTS as they stood at event time, not
 * live references to a row that may be gone.
 */
export type CommunityBanEvent = components['schemas']['CommunityBanEvent'];

/**
 * What happened in a ban audit entry.
 *
 * 'modified' is a re-ban of an already-banned user -- an edited reason or
 * extended expiry. Distinguished from 'banned' so the log reads as a history of
 * decisions rather than implying the user was unbanned and re-banned between.
 */
export type BanEventAction = CommunityBanEvent['action'];

/**
 * Ban a user, or edit an existing ban in place.
 *
 * Re-banning an already-banned user is not an error: it updates the reason and
 * expiry while preserving the original `banned_at`.
 *
 * Omit `expires_at` for a PERMANENT ban -- the common case. It must be in the
 * future; the server rejects a past expiry rather than writing a ban that is
 * inert on arrival.
 */
/** POST /communities/{slug}/bans — named CreateBanInputBody after the Go
 *  struct. Generated, as above. */
export type CreateCommunityBanRequest = components['schemas']['CreateBanInputBody'];

/**
 * One of a community's rules or reference pages.
 *
 * Addressed by ID, not a slug: a document's title is edited as its rules
 * evolve, and a slug frozen at creation would strand a renamed document at its
 * old URL. See the plan's §3.5 for the full reasoning.
 */
// No community_name / community_slug. The per-game list used to carry them so
// the Info tab could label its section, back when GET /games/{id}/details did
// not join communities. It does now, so identity comes from the GAME -- which
// it must, since the section has to name a community that has published no
// documents at all.
export type CommunityDocument = components['schemas']['CommunityDocument'];

// A document's status ('draft' | 'published') is no longer named here: it comes
// off CommunityDocument['status'], which the spec now enumerates. The rule it
// encodes is unchanged -- a draft is moderator-only, and the server answers 404
// rather than 403 for everyone else, so an outsider cannot enumerate
// unpublished work by walking ids.

/**
 * Create a document. Omit `status` for a draft, which is the default -- a
 * half-written page should bind nobody until its author says otherwise.
 */
/** POST /communities/{slug}/documents. Generated, as above. */
export type CreateCommunityDocumentRequest = components['schemas']['CreateDocumentInputBody'];

/**
 * Partial update; an omitted field is left unchanged.
 *
 * Publishing and unpublishing both go through here rather than dedicated
 * endpoints, since status sits on the same form as the body.
 *
 * Unlike a community description, `content` is NOT tri-state: the column is NOT
 * NULL, so an empty string is a blank page rather than a clear.
 */
export type UpdateCommunityDocumentRequest = components['schemas']['UpdateDocumentInputBody'];

/**
 * A game state a webhook can announce.
 *
 * DERIVED from core.ValidWebhookEvents in Go, through the OpenAPI spec. `setup`
 * is absent because that slice excludes it: a game in setup is not yet public,
 * and announcing it would leak an unlisted game into a Discord channel before
 * its GM has shown it to anyone. That exclusion is now enforced by the type,
 * not by a comment asking the next person to preserve it.
 *
 * NonNullable + [number] because the schema types `events` as an optional,
 * nullable array; this names the element type of what it holds.
 */
export type WebhookEvent = NonNullable<
  components['schemas']['CreateWebhookInputBody']['events']
>[number];

/** Every notifiable event, in lifecycle order, for rendering the picker. */
export const WEBHOOK_EVENTS: readonly WebhookEvent[] = [
  'recruitment',
  'character_creation',
  'in_progress',
  'paused',
  'epilogue',
  'completed',
  'cancelled',
] as const;

/** Human labels for the event checkboxes. */
export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  recruitment: 'Recruiting players',
  character_creation: 'Character creation',
  in_progress: 'Game started',
  paused: 'Paused',
  epilogue: 'Epilogue',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/**
 * A community's Discord webhook.
 *
 * 🔴 `url` is ALWAYS MASKED (`https://discord.com/api/webhooks/123/••••ab12`).
 * The real URL is a credential — anyone holding it can post to the channel — and
 * the server never returns it on any endpoint. Never display this as though it
 * were re-usable, and never send it back as the `url` of an update: doing so
 * would overwrite the stored credential with bullet characters.
 *
 * The three `last_*` fields are the entire observability story, since there is
 * no delivery history table. All three absent means "never used yet", a distinct
 * UI state from a failure; `last_success_at` survives a later failure on purpose,
 * because "worked at 09:00, broken since 14:00" is the diagnosis a moderator
 * needs.
 *
 * Generated. `events` needed a backend `nullable:"false"` first: its converter
 * opens with `if values == nil { return nil }`, but the column is
 * `TEXT[] NOT NULL DEFAULT '{}'` and pgx scans an empty array to a non-nil
 * slice, so that branch is unreachable here and `hook.events.length` is correct
 * to read unguarded.
 */
export type CommunityWebhook = components['schemas']['CommunityWebhook'];

/**
 * Register a webhook. `is_enabled` omitted means enabled.
 *
 * Generated. `url` is the REAL Discord webhook URL -- this is the only
 * direction it travels in cleartext. `events` carries the enum, so `setup`
 * cannot be sent.
 */
export type CreateCommunityWebhookRequest = components['schemas']['CreateWebhookInputBody'];

/**
 * Partial update; an omitted field is unchanged. Generated.
 *
 * 🔴 OMIT `url` unless the moderator typed a new one. Omitting it keeps the
 * stored credential, which is what lets this form save a label or event change
 * without ever holding the secret. Sending the masked URL back would destroy it.
 */
export type UpdateCommunityWebhookRequest = components['schemas']['UpdateWebhookInputBody'];

/** Result of the synchronous "send a test message" button. Generated. */
export type WebhookTestResult = components['schemas']['WebhookTestOutputBody'];
