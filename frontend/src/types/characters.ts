// Character-related types for the frontend

import type { components } from './api.gen';

/**
 * A character, as every character-shaped endpoint returns it — generated.
 *
 * Create, get, approve, reassign, rename, the game roster and both controllable
 * lists all answer with this exact shape. There is no per-endpoint variant to
 * pick between.
 *
 * It used to be a hand-written interface standing in for four different backend
 * structs, and it described a shape none of them returned:
 *
 *   - `is_active` was REQUIRED, but the controllable endpoints did not send it
 *     at all (their query pre-filters to active characters). Every
 *     `character.is_active` against that data read `undefined`.
 *   - `username` was declared everywhere but joined almost nowhere. The
 *     "Played by @…" block on CharacterPage was guarded on it and had never
 *     rendered — GET /characters/{id} did not report it until this was fixed.
 *   - `current_owner_username` / `original_owner_username` were typed
 *     `string | undefined`; the inactive list sends explicit `null`.
 *
 * Optionality here now means one of two things, and the distinction matters:
 *
 *   - WITHHELD BY ENTITLEMENT. `user_id`, `username`, `assigned_user_id` and
 *     `assigned_username` are dropped TOGETHER for a regular player in an
 *     anonymous game, and `character_type` is dropped alongside them by
 *     GET /characters/{id} for the same reason. Treat the identity fields as a
 *     unit; never infer one from another's presence.
 *   - GENUINELY ABSENT. `avatar_url` when the character has no portrait,
 *     `user_id` for an unassigned NPC.
 *
 * `status` and `is_active` are required: both columns are NOT NULL and every
 * handler sets them.
 */
export type Character = components['schemas']['CharacterResponse'];

/**
 * Per-game character sheet configuration, as sent by the backend — generated.
 *
 * Sparse: an absent `tabs` means the default layout, and an absent (or null)
 * `fields` on a built-in tab means its default fields. Read it through
 * `resolveSheetLayout`, never directly, so the defaults apply.
 */
export type CharacterSheetConfig = components['schemas']['CharacterSheetConfig'];

/** One field of a tab's entries, as stored — generated. */
export type CharacterSheetField = components['schemas']['CharacterSheetField'];

/**
 * A controllable character from the cross-game endpoint, carrying the game
 * context its sheet needs — generated.
 *
 * Surfaces with no game in scope (the global Utility Drawer) have no
 * GameContext to read role/state from, so the backend sends it per character.
 * Everything a plain Character has, plus that context.
 *
 * `game_character_sheet` is absent when the GM set no overrides, which is the
 * common case — the defaults live in the frontend, so absent means "use them",
 * never "this game has no labels".
 */
export type ControllableCharacterWithGame =
  components['schemas']['ControllableCharacterWithGameResponse'];

/**
 * One entry of the GM's inactive-character list — generated.
 *
 * The only character shape that is genuinely its own type: it adds the
 * ownership history a reassignment decision needs, and the endpoint is GM-only.
 * That makes it the WIDEST shape, not a narrowed one — it withholds nothing.
 *
 * Both owner usernames are REQUIRED but nullable, not optional: the handler
 * always emits the key, sending `null` when that account is gone.
 */
export type InactiveCharacter = components['schemas']['InactiveCharacterResponse'];

/**
 * One sheet field — generated.
 *
 * Two fields are weaker than the hand-written shape claimed, both because the
 * underlying columns are nullable:
 *
 * `is_public` is OPTIONAL (`*bool` with `omitempty`, via ptrBool). It is absent
 * for a legacy row whose column is NULL. Absent must be treated as PRIVATE --
 * every read site here already does, since `!undefined` is true, so an unknown
 * field stays hidden. Preserve that direction: this gates who may read a
 * character's private sheet fields, and defaulting it to public would leak them.
 *
 * `field_type` is REQUIRED but nullable -- a legacy NULL row reports unknown
 * rather than silently claiming to be text.
 */
export type CharacterData = components['schemas']['CharacterDataResponse'];

// Request types
//
// Generated from the OpenAPI spec (`just gen-api-types`) rather than written by
// hand, so an unknown property is a build failure instead of a 422 at runtime.

/** POST /games/{gameID}/characters */
export type CreateCharacterRequest = components['schemas']['CreateCharacterRequest'];

/** PUT /characters/{id}/data — note field_value and is_public are optional on
 *  the wire (an empty field_value clears the field). */
export type CharacterDataRequest = components['schemas']['CharacterDataRequest'];

/** PUT /characters/{id}/approve */
export type ApproveCharacterRequest = components['schemas']['ApproveCharacterRequest'];

/** PUT /characters/{id}/assign */
export type AssignNPCRequest = components['schemas']['AssignNPCRequest'];

/**
 * Generated. Per-character message counts.
 *
 * `private_messages` is optional because it is WITHHELD from callers who may
 * not see it -- this is the entitlement-within-a-shape pattern, not a value
 * that happens to be missing. Absent means "not allowed to know", not "zero".
 */
export type CharacterActivityStats = components['schemas']['CharacterStatsResponse'];

// Skills entries have no type of their own: they are generic sheet entries
// (SheetEntry in lib/sheetEntries), laid out by the tab's schema.
// normalizeEntry absorbs the `level` → `rank` rename that `skillRank` used to.
//
// CharacterAbility used to sit here too. Abilities were retired in the Phase 4
// refactor: they duplicated skills, which is strictly more featured, so every
// stat feature had to be built twice. Verified against production before
// deletion — no character held ability content. The rows remain in
// character_data and are simply never read again.

// Inventory entries are generic entries too (SheetEntry in lib/sheetEntries).
// `equipped`, `metadata` and `condition` are retired keys: old rows may carry
// them and they survive an edit, but nothing reads or writes them. `condition`
// was checked against production before the switch: no row held one.

// Numbers entries are generic entries (see SheetEntry in lib/sheetEntries):
// normalizeEntry absorbs the `type` → `name` rename and lifts the flat
// `amount`/`max`/`display` into a track value.

/** The tabs every game had before tab composition, and still has by default. */
export type BuiltInSheetTabKey = 'skills' | 'inventory' | 'numbers';

/**
 * A configurable tab with its label and fields resolved against the defaults.
 *
 * Client-side, not a wire shape: `resolveSheetLayout` builds it from the sparse
 * stored config. Defined here rather than beside that function so the type
 * layer has no dependency on the hook layer.
 */
export interface SheetTab {
  /** Stable key: the storage `module_type`. Never changes, even on rename. */
  key: string;
  label: string;
  fields: CharacterSheetField[];
  isBuiltIn: boolean;
}

/** A game's configurable tabs, in display order. Public Profile and Private Notes are never in it. */
export interface SheetLayout {
  tabs: SheetTab[];
}

// Character module types for the modular character sheet system
export interface CharacterModule {
  type: string;
  name: string;
  description: string;
  fields: CharacterModuleField[];
}

interface CharacterModuleField {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'json';
  label: string;
  placeholder?: string;
  required?: boolean;
  isPublic?: boolean;
}

/**
 * The character sheet's tabs: the two fixed text tabs, then the game's layout.
 *
 * A function rather than a constant because everything after the first two tabs
 * is per-game. `layout` comes from `useSheetLayout`, which is the only place
 * that knows the default labels and fields — do not default them here.
 *
 * Bio and Private Notes are deliberately NOT configurable: they are platform
 * concepts (a public description, private notes visible to GM and audience)
 * rather than game-system ones, so they are always present with fixed names.
 *
 * Each configurable tab's `type` is its stable key, which is also its storage
 * `module_type`. Its entries live under `storageFieldName(key)`.
 */
export function buildCharacterModules(layout: SheetLayout): CharacterModule[] {
  return [
    {
      type: 'bio',
      name: 'Public Profile',
      description: 'Public character details',
      fields: [
        {
          name: 'background',
          type: 'text',
          label: 'Character Description',
          placeholder: 'Describe your character\'s appearance, personality, background, and any publicly visible information...',
          isPublic: true
        }
      ]
    },
    {
      type: 'notes',
      name: 'Private Notes',
      description: 'Private notes only visible to you, the audience, and the GM',
      fields: [
        {
          name: 'private_notes',
          type: 'text',
          label: 'Private Notes & Secrets',
          placeholder: 'Your private character notes, secrets, motivations, and hidden information...',
          isPublic: false
        }
      ]
    },
    ...layout.tabs.map((tab): CharacterModule => ({
      type: tab.key,
      name: tab.label,
      description: `Character ${tab.label.toLowerCase()}`,
      fields: [
        {
          name: storageFieldName(tab.key),
          type: 'json',
          label: tab.label,
          // Tab access is gated at the tab level by canViewPrivate, not by
          // is_public; see CharacterSheet's saveJsonField.
          isPublic: false
        }
      ]
    })),
  ];
}

/**
 * The `field_name` a configurable tab's entries are stored under. Every tab
 * uses its own key except Inventory, which predates that rule and stores under
 * `items`. Mirrors `core.SheetStorageFieldName` on the backend.
 */
export function storageFieldName(tabKey: string): string {
  return tabKey === 'inventory' ? 'items' : tabKey;
}
