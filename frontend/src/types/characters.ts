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

/** Per-game character sheet configuration, as sent by the backend — generated. */
export type CharacterSheetConfig = components['schemas']['CharacterSheetConfig'];

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

export interface CharacterActivityStats {
  public_messages: number;
  private_messages?: number;
}

// Individual skill item structure for JSON fields.
//
// CharacterAbility used to sit here. Abilities were retired in the Phase 4
// refactor: they duplicated skills, which is strictly more featured (level,
// category, markdown description), so every stat feature had to be built twice.
// Verified against production before deletion — no character held ability
// content. The rows remain in character_data and are simply never read again.
export interface CharacterSkill {
  id: string;
  name: string;
  /**
   * Free text, e.g. "Expert" or "5".
   *
   * Replaces the old `level?: number | string`. The union was a fiction: the
   * editor stringified on every save, so a numeric level round-tripped into a
   * string the moment anyone touched it, and nothing in the app ever did
   * arithmetic on it. Free text is what the field already was in practice.
   *
   * Read old rows through `skillRank()` rather than this field directly —
   * `level` is still on disk and is NOT migrated.
   */
  rank?: string;
  /**
   * @deprecated Legacy key, read-only. Present on rows written before the
   * rank rename; never written again. Use `skillRank()` instead of reading it.
   */
  level?: number | string;
  description?: string;
  category?: string; // e.g., "Combat", "Social", "Academic"
}

/**
 * Resolves a skill's rank across both storage shapes.
 *
 * There is deliberately no migration for the `level` → `rank` rename: this key
 * lives inside a JSON blob, so a read-side fallback covers every old row,
 * archived payload, and rolled-back deploy at no coordination cost, where a
 * migration would need all three to line up. Old numeric values stringify here
 * rather than on write, so a row is only rewritten when a human edits it.
 *
 * Returns undefined when neither key is set, so callers can keep using the
 * `{rank && ...}` pattern to hide the field entirely.
 */
export function skillRank(skill: Pick<CharacterSkill, 'rank' | 'level'>): string | undefined {
  if (skill.rank !== undefined && skill.rank !== '') return skill.rank;
  if (skill.level === undefined || skill.level === '') return undefined;
  return String(skill.level);
}

// Individual inventory item structures for JSON fields
// `equipped` and `metadata` used to sit here and were dropped in the Phase 5
// field pass. `equipped` rendered a badge but nothing could ever set it true —
// AddItemModal hardcoded false and no edit path touched it — so the badge was
// unreachable. `metadata` had no reader anywhere. Both keys are still tolerated
// on read (old rows carry `equipped`); they are simply never written again.
export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  category?: string; // e.g., "Weapon", "Armor", "Consumable", "Tool"
  condition?: string; // e.g., "Excellent", "Good", "Damaged"
  /**
   * Unused by any game today, kept deliberately: both feed the optional
   * weight/value summary in ItemsManager, which stays hidden until a game sets
   * them. Available as defaults rather than dead weight.
   */
  value?: number;
  weight?: number;
}

/**
 * One entry on the Numbers tab: a named quantity, optionally bounded.
 *
 * Renamed from `CurrencyEntry` in the Phase 5 field pass, along with the tab
 * itself. The tab holds arbitrary numeric tracks — stress, XP, clocks, heat —
 * and "currency" described only the narrowest case.
 */
export interface NumberEntry {
  id: string;
  /**
   * The entry's label, e.g. "Gold", "Stress", "XP".
   *
   * Was `type`, which read like a discriminant. Old rows still use that key —
   * read through `numberEntryName()`, never this field directly. As with the
   * skills rename there is deliberately no migration: the key lives inside a
   * JSON blob, so a read-side fallback covers every old row, archived payload,
   * and rolled-back deploy at no coordination cost.
   */
  name?: string;
  /**
   * @deprecated Legacy key, read-only. Use `numberEntryName()`.
   */
  type?: string;
  amount: number;
  /**
   * Upper bound, which turns a bare count into a track: "Stress 4/9".
   *
   * Absent means an unbounded quantity (money, XP), which is why this is
   * optional rather than defaulted — there is no sensible maximum for a purse.
   */
  max?: number;
  /**
   * How the entry renders. Only meaningful with `max` set; a bare quantity has
   * nothing to draw a bar or boxes against, so it always renders as a number.
   * Absent means 'number'.
   */
  display?: NumberEntryDisplay;
  description?: string;
}

export type NumberEntryDisplay = 'number' | 'track' | 'boxes';

/**
 * Resolves an entry's label across both storage shapes.
 *
 * Returns '' rather than undefined when neither key is set: the name is
 * required by the form, so an entry without one is corrupt data rather than a
 * meaningful absence, and callers render it as an empty heading rather than
 * branching.
 */
export function numberEntryName(entry: Pick<NumberEntry, 'name' | 'type'>): string {
  return entry.name || entry.type || '';
}

/**
 * Whether an entry should render as a bounded track rather than a bare number.
 *
 * `max` is what makes a track possible, so `display` alone is not enough — a
 * 'boxes' entry with no maximum has no box count to draw. Guards against a
 * non-positive max for the same reason: zero boxes is not a track.
 */
export function isBoundedTrack(entry: NumberEntry): boolean {
  // Requires an explicit track display rather than merely excluding 'number':
  // absent means 'number' (see the field's doc), and the write path stores
  // exactly that — NumberForm persists undefined for the Number option instead
  // of the literal, so `display !== 'number'` admitted every saved Number entry
  // that had a maximum and drew it as a bar.
  return (
    entry.max !== undefined &&
    entry.max > 0 &&
    (entry.display === 'track' || entry.display === 'boxes')
  );
}

/**
 * Resolved labels for the three renameable character sheet tabs.
 *
 * Defined here rather than beside the hook that produces it so the type layer
 * has no dependency on the hook layer; `useSheetLabels` imports this.
 */
export type SheetLabels = Record<'skills' | 'inventory' | 'numbers', string>;

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
 * The character sheet's tabs, with the game's labels applied.
 *
 * A function rather than a constant because two of the five tabs are
 * GM-renameable, so the list is a function of the game. `labels` comes from
 * `useSheetLabels`, which is the only place that knows the default names —
 * do not default them here.
 *
 * Bio and Private Notes are deliberately NOT renameable: they are platform
 * concepts (a public description, private notes visible to GM and audience)
 * rather than game-system ones, so their names stay fixed.
 *
 * Per the refactor's invariant each renameable tab's `type` equals its storage
 * `module_type`, its field name, and its own default label. That is what keeps
 * this a straight substitution with no mapping table.
 */
export function buildCharacterModules(labels: SheetLabels): CharacterModule[] {
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
    {
      type: 'skills',
      name: labels.skills,
      description: `Character ${labels.skills.toLowerCase()}`,
      fields: [
        {
          name: 'skills',
          type: 'json',
          label: labels.skills,
          placeholder: `Manage your character ${labels.skills.toLowerCase()}...`,
          isPublic: true
        }
      ]
    },
    {
      type: 'inventory',
      name: labels.inventory,
      description: 'Character possessions and equipment',
      fields: [
        {
          name: 'items',
          type: 'json',
          label: 'Items',
          placeholder: 'Manage your character items...',
          isPublic: true
        }
      ]
    },
    {
      type: 'numbers',
      name: labels.numbers,
      description: 'Character resources and numeric tracks',
      fields: [
        {
          // Storage key, not a label: renamed from `currency` in the Phase 4
          // migration because this tab now holds arbitrary numeric tracks
          // (stress, XP, clocks), not money. Unlike a label, an identifier
          // cannot be overridden per game, so it had to stop saying "currency".
          name: 'numbers',
          type: 'json',
          label: labels.numbers,
          placeholder: `Track your character's ${labels.numbers.toLowerCase()}...`,
          isPublic: false
        }
      ]
    }
  ];
}
