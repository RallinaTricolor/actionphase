# ADR-009: Character Sheet Tabs as Generic Entries with GM-Defined Schemas

## Status
Accepted (2026-09-30)

## Context

Until September 2026 every character sheet had the same five tabs: Public
Profile (`bio`), Private Notes (`notes`), then Skills, Inventory and Numbers. A
GM could rename the last three through `games.character_sheet.labels`, and
nothing else. Each of those three tabs had its own entry shape, TypeScript
interface and set of Manager/Card/Form/AddModal components, and the draft
modal, mentions, loot tables and exports all branched on which tab they were
handling.

GMs needed more than that. In the most recent game at the time, the GM put each
item's custom attributes (Type, Category, Tier) into a markdown table inside
its Description, because that was the only way to show labelled fields. The
requests were of two kinds:

- Change the fields on a built-in tab: add Durability to Inventory, drop Value
  and Weight.
- Add a tab of their own, such as Contacts with Relationship, Location and
  Trust.

Four constraints shaped the design:

1. Public Profile and Private Notes can't be removed or changed.
2. A game with no configuration keeps the tabs, fields and data it already had.
   Visuals need to be close to before, not pixel-identical.
3. Existing data can't be lost or migrated in bulk. `character_data` already
   stored each tab as one opaque JSON array per `(character_id, module_type,
   field_name)`, and `games.character_sheet` was a strict JSONB column built to
   grow into this.
4. GMs need a UI for it, not a JSON field.

Looking at the three tab kinds showed they were barely different. The cards
had the same shape (name, edit/remove, description, then a rank line, badges or
a track), and none had a tab-specific control. The only tab-specific behaviour
was the Numbers track display, Inventory's weight/value totals (unused, and
dropped), and loot tables writing into Inventory.

## Decision

### 1. Every configurable tab is a list of entries; there are no tab kinds

Each entry has a fixed `id` and a required `name`: the name is the card heading
and the mention key. Every other attribute is a **field**, defined by the tab's
schema. A field is one of six types: `text`, `number`, `markdown`, `select`,
`checkbox` or `track`. All fields are optional.

Skills, Inventory and Numbers are three **default schemas**, not three
component sets. One renderer (`EntryManager` → `EntryCard`/`EntryForm`, driven
by `components/characters/sheet-items/fieldTypes.tsx`) lays out every tab by
field type, so the draft modal, mentions and exports never branch on tab
identity.

### 2. The layout is stored sparse, and the backend knows only tab keys

```jsonc
// games.character_sheet
{
  "tabs": [                       // absent = the default layout
    { "key": "skills", "label": "Talents" },          // no fields = default schema
    { "key": "t_8fjw2c", "label": "Contacts",
      "fields": [{ "key": "f_a81x0p", "label": "Relationship",
                   "type": "select", "options": ["Ally", "Rival"] }] }
  ]
}
```

- No `tabs` means the default layout. A built-in tab without `label` or
  `fields` uses its defaults. A tab whose fields a GM has edited stores its full
  field list, since an ordered list can't be a sparse diff.
- The default labels and schemas live in the frontend, in
  `DEFAULT_SHEET_LAYOUT` (`frontend/src/hooks/useSheetLayout.ts`). The backend
  knows the default tab *keys* (`core.DefaultSheetTabKeys`), which it needs for
  write permissions. It also has a copy of the three default *labels*
  (`core.SheetTabLabel`), used only in text the server writes itself: game-log
  messages and archive exports.
- The server checks the structure: parsing rejects unknown keys, and
  `core.ValidateCharacterSheetConfig` rejects `bio`/`notes` as tabs, bad key
  shapes, reserved field keys, and layouts over the limits (8 tabs, 12 fields
  per tab).
- The layout is written only through `PUT /games/{id}/character-sheet`, from a
  dedicated GM editor. Game create and update don't carry it, so saving game
  settings can never reset it.

### 3. Keys never change, entries stay flat, and legacy shapes are read, not migrated

- Custom tab keys are `t_` plus 6 `[a-z0-9]`, and new field keys are `f_` plus
  6, both generated client-side. Built-in fields keep their original JSON keys
  (`rank`, `quantity`, `amount`), so existing data matches the default schemas
  with no migration. A label can be renamed; a key and a field's type can't
  change.
- An entry is a flat object with field values keyed by field key:
  `{ "id", "name", "quantity": 1, "f_k2m9qa": 7 }`.
- Each tab is one `character_data` row at `(tab key, storageFieldName(tab
  key))`. Inventory is the one historic exception (`inventory/items`); every
  other tab stores under its own key.
- `normalizeEntry` (`frontend/src/lib/sheetEntries.ts`) converts the older
  entry shapes when reading: a skill's `level` becomes `rank`, a number's
  `type` becomes `name`, and a flat `amount`/`max`/`display` becomes a track.
  Writes always use the new shape and rewrite only the edited entry, so a row
  converts only when someone edits it.

### 4. Removing a tab or field hides its data; it never deletes it

Removing a tab or field only edits the layout. The values stay in the stored
entries, hidden from view. Restoring a built-in tab or default field shows them
again, because the key is the same. Edits merge onto the stored entry, so keys
the current schema doesn't know about survive a save. Archive exports still
include data from removed tabs.

### 5. Entry contents are opaque to the server; write access is set by the layout

The server doesn't check entry values against the schema; the form does. What
the server does enforce is **who may write which pair**, through
`core.ClassifySheetWrite`:

- Any user who can edit the character may write `bio/background` and
  `notes/private_notes`.
- Only the GM or a co-GM may write a tab in the game's current layout.
- Any other pair is a 422, for everyone.

Before this change, a player could write any `(module_type, field_name)` pair on
their own character except the three stat pairs. The allowlist (Phase 0 of the
work) closed that gap before custom tabs could widen it. Draft updates on
action results go through the same check, and the `check_module_type`
constraint on `action_result_character_updates` allows `t_` keys.

### 6. Each loot table rolls into one tab, and that link is protected

`game_loot_tables.target_tab` (default `inventory`, which is where every
existing table already rolled) names the tab a table rolls into.

- The target must be a tab in the game's layout (422 otherwise). It can change
  only while the table is empty (409 otherwise), because its contents were
  written against the old tab's schema.
- `PUT /character-sheet` refuses a layout that removes a tab any loot table
  targets (422, naming the tables). The editor disables Remove on such a tab.
- A roll writes into the target tab and gives each rolled entry a fresh `id`.

## Alternatives Considered

### Tab kinds: typed components per kind, with GM-configurable extras (rejected)
Keep Skills/Inventory/Numbers as distinct kinds and let a GM add fields to them,
or add a tab of an existing kind. This keeps today's components but doesn't
handle Contacts, which isn't any existing kind, and it keeps every consumer
(draft modal, mentions, loot, exports) switching on kind. The kinds had no
tab-specific behaviour worth keeping, so they added cost and no capability.

### Normalise entries into their own table, or one row per field (rejected)
This would let the server query and validate individual values. But it needs a
data migration for every existing sheet, breaks the one-row-per-tab write path
that action-result drafts and loot rolls rely on, and gains nothing the app
uses: sheets are always read whole. ADR-002 already records `character_data`
as the place for flexible per-character content.

### Validate entry values against the schema on the server (rejected for v1)
The trust model is the same as before: only a GM or co-GM writes these tabs, and
the form validates. Server-side validation would mean mirroring the schema rules
and the legacy shapes in Go, for writes the GM already controls. The cost shows
up in loot tables, whose contents are written verbatim: CSV import has to coerce
values by field type on the client (`lib/lootTableCsv.ts`).

### Purge data when a tab or field is removed (rejected)
Removing things mid-game is easy to regret, and a purge makes it permanent.
Hidden data costs almost nothing to store.

### Keep loot tables hard-wired to Inventory (rejected)
About a day cheaper, and restoring Inventory would reconnect them, since the key
is stable. But the GM would get no warning before a removal cut tables off, and
rolling into any other tab, such as a random skill or contact, would stay
impossible.

### A per-tab "loot enabled" flag (rejected)
A second setting to keep in sync with the table's target, adding nothing: the
target already is the link.

### Default labels and schemas in the backend as well (rejected)
Every default would then live in two places that must match. The backend needs
only the keys to decide write access, and labels only for its own text.

## Consequences

**Positive**
- A GM can reshape a built-in tab or add their own tabs without code changes,
  and the markdown-table workaround is no longer needed.
- Games with no configuration look and behave as before. No data migration
  shipped, and removal can't lose data.
- The three per-tab component sets (about 2.9k lines plus 5.5k lines of tests)
  became one renderer.
- Every tab can be mentioned (`[[Name|kind:id]]`), not only Skills and
  Inventory, and exports use the GM's tab labels.
- Players can no longer write arbitrary sheet pairs.

**Negative**
- `normalizeEntry` has to keep the legacy shapes forever, because rows convert
  only when edited. Its tests pin each case.
- A few facts live in both frontend and backend and must agree, each with a
  comment at both ends:
  - the default tab keys and labels: `DEFAULT_SHEET_LAYOUT` and
    `core.DefaultSheetTabKeys`/`SheetTabLabel`;
  - `storageFieldName` and `core.SheetStorageFieldName`;
  - the mention pattern: `SHEET_REF_PATTERN` in `MarkdownPreview.tsx` and
    `sheetRefPattern` in `exports/markdown.go`.
- The server can't enforce field types, so a malformed value from a buggy client
  gets stored and only the frontend notices. Accepted, since only a GM or co-GM
  can write these tabs.
- Once a tab is removed, its data can't be written until the tab comes back.
  This is intended, but it means a draft staged before the removal still
  publishes into a hidden tab.
- If a GM and co-GM edit the layout at the same time, the last save wins, as
  with other game settings.

## Related

- `.claude/context/ARCHITECTURE.md` — "Character Sheet Storage", the current
  summary of the rules above
- `backend/pkg/core/character_sheet_config.go` — config types, validation,
  `ClassifySheetWrite`, `SheetTabLabel`
- `frontend/src/hooks/useSheetLayout.ts` — `DEFAULT_SHEET_LAYOUT` and the
  layout resolver
- `frontend/src/components/characters/sheet-items/` — the generic renderer
- `frontend/src/components/characters/sheet-editor/` — the GM editor
- `backend/pkg/db/migrations/20260818195302_add_game_character_sheet_config.sql`,
  `20260928201349_allow_custom_sheet_tabs_in_drafts.sql`,
  `20260930173458_add_loot_table_target_tab.sql`
- ADR-002 (Database Design Approach) — the hybrid relational/document storage
  this builds on
