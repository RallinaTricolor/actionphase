-- ============================================================================
-- Results board seed: a partly resolved board for "The Heist at Goldstone Bank"
-- ============================================================================
--
-- fixtures.seed_heist_board(game_id, phase_id) fills one action phase's
-- results board and its game's board setup (codex, names). It is a function,
-- not a fixture, so both the demo Heist (demo/11_gm_board_heist.sql) and a
-- fixed-ID E2E game can call it and get the same board. The game needs the
-- Heist's characters by name: Shade (Whisper), Rook (Hound), Vex (Leech),
-- Silk (Spider) and Inspector Dalton, with the Heist's submissions in that
-- phase (the cards quote them, so Read highlights the carded text).
--
-- The board is mid-resolution, so every step has something to show:
--   Read    three of four submissions marked done; cards from each.
--   Map     four time slots (three renamed), cards with mixed outcomes and
--           causes, a moot card, waiting and triggered IF cards, two GM
--           cards, two clusters, stances with an ambush, open checks (no
--           outcome, a busy cell with no scene) and one dismissed check.
--   Scenes  a written conflict in the vault (own version, a GM note, someone
--           elsewhere, a source card and passage, an injury) and a short
--           scene in the lobby.
--
-- Every row is written the way the board's save path writes it (version 1,
-- seq from gm_board_seq, updated_by the GM), and every doc has every field
-- the client writes (see frontend/src/lib/gmBoard/types.ts). When the board's
-- model changes, change this seed with it.
--
-- Re-runnable: it replaces whatever board and setup the phase and game had.
-- All content is hand-written for the demo; never paste player content here.
-- ============================================================================

SET client_min_messages = warning;

CREATE SCHEMA IF NOT EXISTS fixtures;

DROP FUNCTION IF EXISTS fixtures.seed_heist_board(integer, integer);

CREATE FUNCTION fixtures.seed_heist_board(p_game_id integer, p_phase_id integer)
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  gm_id integer;
  shade integer;
  rook integer;
  vex integer;
  silk integer;
  dalton integer;
  settings_json text;
  board_json text;
BEGIN
  SELECT gm_user_id INTO gm_id FROM games WHERE id = p_game_id;
  IF gm_id IS NULL THEN
    RAISE EXCEPTION 'seed_heist_board: no game %', p_game_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM game_phases WHERE id = p_phase_id AND game_id = p_game_id AND phase_type = 'action') THEN
    RAISE EXCEPTION 'seed_heist_board: phase % is not an action phase of game %', p_phase_id, p_game_id;
  END IF;

  SELECT id INTO shade FROM characters WHERE game_id = p_game_id AND name = 'Shade (Whisper)';
  SELECT id INTO rook FROM characters WHERE game_id = p_game_id AND name = 'Rook (Hound)';
  SELECT id INTO vex FROM characters WHERE game_id = p_game_id AND name = 'Vex (Leech)';
  SELECT id INTO silk FROM characters WHERE game_id = p_game_id AND name = 'Silk (Spider)';
  SELECT id INTO dalton FROM characters WHERE game_id = p_game_id AND name = 'Inspector Dalton';
  IF shade IS NULL OR rook IS NULL OR vex IS NULL OR silk IS NULL OR dalton IS NULL THEN
    RAISE EXCEPTION 'seed_heist_board: game % is missing a Heist character', p_game_id;
  END IF;

  -- ── Board setup (per game) ────────────────────────────────────────────
  settings_json := $json$[
    {"kind": "codex", "key": "cx-heist-lobby", "doc": {"type": "Location", "name": "the bank lobby", "aliases": ["lobby", "front doors"], "notes": "Marble floor, two tellers, the manager's office at the back.", "secret": false, "knownBy": [], "phases": []}},
    {"kind": "codex", "key": "cx-heist-vault", "doc": {"type": "Location", "name": "the vault", "aliases": ["vault room"], "notes": "Two locks: the outer door, then a combination lock on the inner cage.", "secret": false, "knownBy": [], "phases": [__PHASE__]}},
    {"kind": "codex", "key": "cx-heist-rooftop", "doc": {"type": "Location", "name": "the rooftop", "aliases": ["rooftop"], "notes": "Across the street from the rear entrance, with a clear line down the alley.", "secret": false, "knownBy": [], "phases": []}},
    {"kind": "codex", "key": "cx-heist-alley", "doc": {"type": "Location", "name": "the rear alley", "aliases": ["alley", "rear entrance"], "notes": "", "secret": false, "knownBy": [], "phases": []}},
    {"kind": "codex", "key": "cx-heist-ducts", "doc": {"type": "Location", "name": "the ducts", "aliases": ["ducts"], "notes": "Too narrow for anyone but Vex.", "secret": false, "knownBy": [], "phases": []}},
    {"kind": "codex", "key": "cx-heist-dalton", "doc": {"type": "NPC", "name": "Inspector Dalton", "aliases": ["Dalton"], "notes": "City Watch. Has suspected Silk since last month.", "secret": false, "knownBy": [], "phases": []}},
    {"kind": "codex", "key": "cx-heist-key", "doc": {"type": "Item", "name": "the vault key", "aliases": [], "notes": "The manager keeps it in his waistcoat.", "secret": false, "knownBy": [], "phases": []}},
    {"kind": "codex", "key": "cx-heist-debts", "doc": {"type": "Secret", "name": "the manager's debts", "aliases": ["his debts"], "notes": "The manager owes the Crows and will look the other way for a cut. Only Silk knows.", "secret": true, "knownBy": [__SILK__], "phases": []}},
    {"kind": "names", "key": "__DALTON__", "doc": {"names": ["Inspector Dalton", "Dalton"]}}
  ]$json$;

  -- ── The phase's board ─────────────────────────────────────────────────
  board_json := $json$[
    {"kind": "chunk", "key": "pre", "doc": {"name": "Pre-Scenario", "position": 1}},
    {"kind": "chunk", "key": "slot-1", "doc": {"name": "Approach", "position": 2}},
    {"kind": "chunk", "key": "slot-2", "doc": {"name": "Inside", "position": 3}},
    {"kind": "chunk", "key": "slot-3", "doc": {"name": "Getaway", "position": 4}},

    {"kind": "card", "key": "card-heist-shade-scan", "doc": {"characterId": __SHADE__, "quote": "Using my supernatural senses, I'll scan the vault room for any lingering spirits or magical wards before the team enters.", "summary": "Scans the vault for spirits and wards", "note": "", "locationId": "cx-heist-vault", "chunkId": "slot-1", "outcome": "happened", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [0], "gm": false}},
    {"kind": "card", "key": "card-heist-shade-compel", "doc": {"characterId": __SHADE__, "quote": "If I detect anything, I'll attempt to commune with or dispel it using my Compel ability.", "summary": "", "note": "The ghost is stronger than she expects.", "locationId": "cx-heist-vault", "chunkId": "slot-2", "outcome": "partial", "causedBy": ["scene-heist-vault"], "isIF": true, "cond": "I detect anything", "branchOf": null, "src": [0], "gm": false}},
    {"kind": "card", "key": "card-heist-shade-lookout", "doc": {"characterId": __SHADE__, "quote": "I'll position myself near the entrance as a lookout while maintaining focus on the ethereal plane.", "summary": "Keeps watch at the entrance", "note": "", "locationId": "cx-heist-lobby", "chunkId": "slot-2", "outcome": "moot", "causedBy": ["card-heist-shade-compel"], "isIF": false, "cond": "", "branchOf": null, "src": [1], "gm": false}},
    {"kind": "card", "key": "card-heist-shade-sounds", "doc": {"characterId": __SHADE__, "quote": "If guards approach, I'll create a minor distraction using ghost sounds.", "summary": "", "note": "", "locationId": "cx-heist-lobby", "chunkId": null, "outcome": "pending", "causedBy": [], "isIF": true, "cond": "guards approach", "branchOf": null, "src": [1], "gm": false}},

    {"kind": "card", "key": "card-heist-rook-perch", "doc": {"characterId": __ROOK__, "quote": "I'll take up a sniper position on the rooftop across from the bank's rear entrance.", "summary": "Takes the sniper's perch", "note": "", "locationId": "cx-heist-rooftop", "chunkId": "pre", "outcome": "happened", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [0], "gm": false}},
    {"kind": "card", "key": "card-heist-rook-watch", "doc": {"characterId": __ROOK__, "quote": "Using my spyglass and Sharpshooter ability, I'll keep watch on all approaches and provide cover fire if needed.", "summary": "", "note": "", "locationId": "cx-heist-rooftop", "chunkId": "slot-1", "outcome": "happened", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [0], "gm": false}},
    {"kind": "card", "key": "card-heist-rook-flash", "doc": {"characterId": __ROOK__, "quote": "I'll signal the team via our pre-arranged mirror flashes if I spot any patrols.", "summary": "Mirror flash if a patrol comes", "note": "", "locationId": "cx-heist-rooftop", "chunkId": "slot-1", "outcome": "failed", "causedBy": ["card-heist-dalton-patrol"], "isIF": true, "cond": "I spot any patrols", "branchOf": null, "src": [1], "gm": false}},
    {"kind": "card", "key": "card-heist-rook-rifle", "doc": {"characterId": __ROOK__, "quote": "My hunting rifle is loaded with tranquilizer darts as the first option, but I have live rounds ready if things go badly.", "summary": "", "note": "Does he shoot Dalton? Decide at Getaway.", "locationId": "cx-heist-rooftop", "chunkId": "slot-3", "outcome": "pending", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [1], "gm": false}},

    {"kind": "card", "key": "card-heist-vex-mix", "doc": {"characterId": __VEX__, "quote": "I'll use my alchemical knowledge to create smoke bombs and a custom acid mixture that can dissolve the vault's lock mechanism without triggering the alarm system.", "summary": "Mixes smoke bombs and lock acid", "note": "", "locationId": "cx-heist-alley", "chunkId": "pre", "outcome": "happened", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [0], "gm": false}},
    {"kind": "card", "key": "card-heist-vex-ducts", "doc": {"characterId": __VEX__, "quote": "I've studied the bank's blueprints extensively and know which ducts to avoid.", "summary": "Crawls in through the ducts", "note": "", "locationId": "cx-heist-ducts", "chunkId": "slot-1", "outcome": "happened", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [1], "gm": false}},
    {"kind": "card", "key": "card-heist-vex-locks", "doc": {"characterId": __VEX__, "quote": "Once inside, I'll handle the mechanical aspects - disabling pressure plates, bypassing the combination lock using my precision tools, and neutralizing any gas traps.", "summary": "Works the vault's locks and traps", "note": "", "locationId": "cx-heist-vault", "chunkId": "slot-2", "outcome": "interrupted", "causedBy": ["scene-heist-vault"], "isIF": false, "cond": "", "branchOf": null, "src": [1], "gm": false}},

    {"kind": "card", "key": "card-heist-silk-ashworth", "doc": {"characterId": __SILK__, "quote": "I'll walk in through the front doors as Lady Ashworth, a wealthy widow opening a deposit account, and ask to speak with the manager in person.", "summary": "Poses as Lady Ashworth to see the manager", "note": "", "locationId": "cx-heist-lobby", "chunkId": "slot-1", "outcome": "happened", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [0], "gm": false}},
    {"kind": "card", "key": "card-heist-silk-key", "doc": {"characterId": __SILK__, "quote": "While he's busy with me, I'll lift the vault key from his waistcoat.", "summary": "", "note": "", "locationId": "cx-heist-lobby", "chunkId": "slot-1", "outcome": "pending", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [0], "gm": false}},
    {"kind": "card", "key": "card-heist-silk-dalton", "doc": {"characterId": __SILK__, "quote": "If Inspector Dalton is in the lobby, I'll keep him talking about his late wife's estate until Vex gives the signal.", "summary": "", "note": "", "locationId": "cx-heist-lobby", "chunkId": "slot-1", "outcome": "happened", "causedBy": [], "isIF": true, "cond": "Inspector Dalton is in the lobby", "branchOf": null, "src": [1], "gm": false}},
    {"kind": "card", "key": "card-heist-silk-carriage", "doc": {"characterId": __SILK__, "quote": "Once the vault is open, I'll leave the way I came in and wait with the carriage in the alley.", "summary": "Waits with the carriage", "note": "", "locationId": "cx-heist-alley", "chunkId": "slot-3", "outcome": "pending", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [1], "gm": false}},

    {"kind": "card", "key": "card-heist-dalton-patrol", "doc": {"characterId": __DALTON__, "quote": "", "summary": "Dalton walks his patrol through the lobby", "note": "", "locationId": "cx-heist-lobby", "chunkId": "slot-1", "outcome": "happened", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [], "gm": true}},
    {"kind": "card", "key": "card-heist-dalton-alley", "doc": {"characterId": __DALTON__, "quote": "", "summary": "Dalton checks the alley on his way out", "note": "", "locationId": "cx-heist-alley", "chunkId": "slot-3", "outcome": "pending", "causedBy": [], "isIF": false, "cond": "", "branchOf": null, "src": [], "gm": true}},

    {"kind": "scene", "key": "scene-heist-vault", "doc": {
      "title": "The ghost in the vault", "locationId": "cx-heist-vault", "chunkId": "slot-2", "conflict": true,
      "participants": [__SHADE__, __VEX__],
      "moments": [
        {"id": "m-heist-v1", "text": "Vex pours the acid on the outer lock, and the vault door hisses open.", "readers": [__SHADE__, __VEX__], "ownText": {}, "cardId": "card-heist-vex-locks"},
        {"id": "m-heist-v2", "text": "A cold wind fills the vault. Something long dead stirs behind the deposit boxes.", "readers": [__SHADE__, __VEX__], "ownText": {"__SHADE__": "You feel it before you see it: a ghost bound to the deposit boxes, furious at the intrusion."}, "ref": {"characterId": __SHADE__, "quote": "Using my supernatural senses, I'll scan the vault room for any lingering spirits or magical wards before the team enters."}},
        {"id": "m-heist-v3", "text": "Shade tries to compel the ghost. It quiets, but not before it rattles every box on the wall.", "readers": [__SHADE__, __VEX__], "ownText": {}, "cardId": "card-heist-shade-compel"},
        {"id": "m-heist-v4", "text": "The rattling carries up to the lobby. Heads turn toward the vault stairs.", "readers": [__SHADE__, __VEX__, __SILK__], "ownText": {}},
        {"id": "m-heist-v5", "text": "The ghost is the manager's grandfather. It will remember Silk's face.", "readers": [], "ownText": {}},
        {"id": "m-heist-v6", "text": "A gas trap fires as Vex ducks behind the door. Vex breathes some of it in.", "readers": [__VEX__], "ownText": {}}
      ],
      "effects": [{"characterId": __VEX__, "state": "injured"}]
    }},
    {"kind": "scene", "key": "scene-heist-lobby", "doc": {
      "title": "", "locationId": "cx-heist-lobby", "chunkId": "slot-1", "conflict": false,
      "participants": [__SILK__, __DALTON__],
      "moments": [
        {"id": "m-heist-l1", "text": "Lady Ashworth sweeps into the lobby and asks for the manager by name.", "readers": [__SILK__], "ownText": {}, "cardId": "card-heist-silk-ashworth"},
        {"id": "m-heist-l2", "text": "Inspector Dalton tips his hat to Silk and asks after her late husband.", "readers": [__SILK__], "ownText": {}}
      ],
      "effects": []
    }},

    {"kind": "cluster", "key": "cluster-heist-inside", "doc": {"name": "Inside crew", "characterIds": [__SHADE__, __VEX__]}},
    {"kind": "cluster", "key": "cluster-heist-outside", "doc": {"name": "Outside crew", "characterIds": [__ROOK__, __SILK__]}},

    {"kind": "stance", "key": "__SHADE__|__VEX__", "doc": {"value": "ally"}},
    {"kind": "stance", "key": "__VEX__|__SHADE__", "doc": {"value": "ally"}},
    {"kind": "stance", "key": "__VEX__|__SILK__", "doc": {"value": "wary", "note": "Doesn't trust the disguise"}},
    {"kind": "stance", "key": "__ROOK__|__SILK__", "doc": {"value": "ally", "note": "Split of the take: 60/40"}},
    {"kind": "stance", "key": "__SILK__|__ROOK__", "doc": {"value": "target", "note": "Means to leave him on the roof"}},

    {"kind": "progress", "key": "__SHADE__", "doc": {"readDone": true}},
    {"kind": "progress", "key": "__ROOK__", "doc": {"readDone": true}},
    {"kind": "progress", "key": "__VEX__", "doc": {"readDone": true}},

    {"kind": "flag", "key": "pend:card-heist-dalton-alley", "doc": {}},

    {"kind": "notes", "key": "notes", "doc": {"text": "Dalton suspects Silk. Decide by Getaway whether the Watch is waiting at the carriage."}}
  ]$json$;

  -- Placeholders, longest first so __SHADE__ never eats part of another.
  settings_json := replace(replace(settings_json, '__PHASE__', p_phase_id::text), '__SILK__', silk::text);
  settings_json := replace(settings_json, '__DALTON__', dalton::text);
  board_json := replace(board_json, '__DALTON__', dalton::text);
  board_json := replace(board_json, '__SHADE__', shade::text);
  board_json := replace(board_json, '__ROOK__', rook::text);
  board_json := replace(board_json, '__VEX__', vex::text);
  board_json := replace(board_json, '__SILK__', silk::text);

  DELETE FROM gm_settings_items WHERE game_id = p_game_id;
  DELETE FROM gm_board_items WHERE phase_id = p_phase_id;

  INSERT INTO gm_settings_items (game_id, kind, item_key, doc, version, deleted, updated_by)
  SELECT p_game_id, e->>'kind', e->>'key', e->'doc', 1, false, gm_id
  FROM jsonb_array_elements(settings_json::jsonb) AS e;

  INSERT INTO gm_board_items (phase_id, kind, item_key, game_id, doc, version, deleted, updated_by)
  SELECT p_phase_id, e->>'kind', e->>'key', p_game_id, e->'doc', 1, false, gm_id
  FROM jsonb_array_elements(board_json::jsonb) AS e;
END;
$fn$;
