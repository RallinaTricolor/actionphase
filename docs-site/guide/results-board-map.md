# Results Board: Map

The Map lays every card out by place and time, so you can see who is where,
who meets whom, and what's still undecided. It's where you decide what
happens: each card gets an **outcome**, and each place where people meet
becomes a **scene**.

## The layout

**By location** is the main view. Each row is a location from the codex.
Each column is a **time slot**: a stretch of the phase, in order.
**Contingencies**, above the grid, holds the IF cards that haven't triggered
yet.

- A cell shows its cards: whose each one is, and its label. A card's left
  edge is coloured by its outcome, with a badge once it has one. IF and GM
  cards are marked, and ✎ means the card has a GM note.
- A cell where two or more people meet says **Busy · no scene**, until you
  make one there. Then it shows a **Scene** pill, or **Conflict** if you
  marked the scene as one. Hover the pill to see who's there and their
  stances toward each other. Click it to open the scene.
- Moot cards fold away behind "+N moot".
- **Character state over the phase**, under the grid, shows who is
  incapacitated or dead in each slot. Scenes set these; see
  [Scenes](./results-board-scenes#after-the-scene).

**By character** turns it around: a row per character, so you can follow one
person through the phase. Each cell lists their cards and scenes in that
slot. Slots where they're out of play are hatched. **Read** opens their
submission and **Stances** their stances.

**Stances** is a table of how each player sees each other one. See
[Stances](#stances).

## Locations

Each phase has its own locations: the places that matter this phase. **+
Location** in the toolbar adds one, or puts some of another phase's on this
Map. A Map with no locations yet asks for them in the same way.

- **New location** adds a place for this phase only.
- **Or use places from another phase** lists another phase's locations, all
  ticked, starting with the latest phase before this one. Untick the ones
  you don't need and add the rest. They're the same codex entries, with
  their other names and notes, now belonging to this phase as well.

A location made from a card's **Location** picker belongs to this phase too.
To have a place on every phase's Map, set it to **Every phase** in the
[codex](./results-board-codex-notes#codex).

## Time slots

A new board has four: Pre-Scenario, Slot 1, Slot 2 and Slot 3. Click a slot's
name to rename it. **+ Time slot** adds one at the end, and **+ before** on a
slot adds one before it. An empty slot can be removed.

## Moving cards

Drag a card to another cell, or open it and change its **Location** or
**Time slot**. Each move shows a message with Undo.

- By character, a card moves only along its own row.
- Only IF cards can go in Contingencies.
- Moving an IF card out of Contingencies means it **triggered** there.

**Push Mara's later cards →** in the card panel moves every one of that
character's cards after this one a slot later, for when something here
delays them. This card stays where it is.

## Outcomes and causes

Open a card to give it an outcome:

| Outcome | Meaning |
|---|---|
| **Unresolved** | Not decided yet. Every new card starts here. |
| **Happened** | It went as planned. |
| **Partly** | Some of it happened. |
| **Failed** | They tried, and it didn't work. |
| **Interrupted** | Something stopped it partway. |
| **Moot** | It no longer matters: the reason for it has gone. |

Partly, Failed, Interrupted and Moot ask **Because of…**: pick the cards or
scenes nearby that caused it. Causes show in the writing brief and as arrows
on the Map. The **Arrows** menu shows them on hover, always, or never.

An IF card still waiting in Contingencies at the end of the phase never
triggered. It counts as moot, and the brief says "Never triggered".

The card's **GM note** is private. It's for what actually happened and why,
and it shows in the writing brief.

## Resolving the phase

**Resolve ▸** walks the time slots in order. For each slot it lists:

- the busy cells, with a button to make or open each scene;
- the checks in that slot;
- IF cards waiting for people who are here at this time, with **Trigger it
  here**.

Settle everything in a slot, then go to the next. A slot with nothing left to
do gets a ✓. Each slot's header also has its own resolve button.

### Checks

**Checks**, in the toolbar, lists what needs a decision. The count beside it
is also on the Map tab.

| Check | When |
|---|---|
| **No outcome** | A placed card is still Unresolved. |
| **No scene** | Two or more people share a cell, and there's no scene there. |
| **Two places** | Someone has cards in two locations in the same slot. |
| **Out of play** | Someone incapacitated or dead still has a card, or is in a scene. |

Each check links to the card or cell. **Dismiss** one you've decided doesn't
matter; dismissed checks can be restored.

## Scenes

A busy cell offers **+ Create scene**, which makes a scene at that place and
time with everyone who has a card there. The scene opens in the
[Scenes](./results-board-scenes) tab. Scenes are only made here, where their
place and time are already known.

## GM cards

**+ GM cards…** puts the same card in one cell for each person you pick,
players or NPCs: "The night watch passes through". **+ Card** on a cell does
the same, already set to that cell. GM cards show in each person's brief like
their own plans.

## Stances

How each player sees each other one this phase: **Ally**, **Deal**,
**Neutral**, **Wary**, **Target**, or **Ally ⇢ Target** (an ally for now,
with a strike planned). Each can have a note. Set them in Read as you go, or
here.

- Click a cell of the table to set one stance.
- **Set several at once** sets many: tick who, and toward whom.
- **Planned strikes** lists everyone set as a Target.
- When someone plans to strike a person who thinks they're an ally, the table
  marks it ⚠ "They think it's an alliance".

## Clusters

On a big game, a cluster narrows the Map to one group of characters. **Edit
clusters** suggests groups that already share a cell, with **Make cluster**,
or you can build your own. Pick a cluster from the toolbar to show only its
members.

## The example

The GM renames the slots **Dusk**, **Midnight** and **Dawn**, and removes the
empty Pre-Scenario slot.

**Dusk.** The Night Market cell holds Mara's theft and Jory's guard duty, and
says **Busy · no scene**. **Resolve ▸** opens Dusk and lists the cell, along
with two waiting IF cards for people here: Mara's "If anyone follows me" and
Jory's "If anyone goes for the satchel".

The GM decides that Mara gets the crown, but Jory sees it go:

- Mara's theft: **Happened**.
- Jory's guard duty: **Failed**, because of Mara's theft.
- Jory's IF card triggers. The GM drags it to **Lantern Bridge · Midnight**,
  where the chase will end, and marks it **Happened**.
- Mara's "If anyone follows me" triggers too, in the market at Dusk:
  **Failed**, because of Jory's chase. She doesn't lose him.

**+ Create scene** on the market cell makes the first scene. The GM ticks
**Conflict**.

**Midnight.** Mara's crossing and Sable's wait are dragged from Dusk to
Midnight on Lantern Bridge. Sable's "When Mara crosses" IF card triggers
there too. Now the bridge cell holds all three of them. The stance table
shows ⚠ on Sable → Mara: she's an Ally ⇢ Target, and Mara thinks they're
friends.

The GM decides:

- Sable's shot: **Partly**, because of Jory's chase. She hits Mara, but Jory
  arrives before she can take the crown.
- Mara's crossing: **Interrupted**, because of the bridge scene.

**+ GM cards…** adds "The night watch arrives, drawn by the shouting" for all
three of them, on the bridge at Midnight. **+ Create scene** on the bridge
cell, and **Conflict** again.

**Dawn** is empty: by then, everything has happened. Checks shows nothing
left. Next: [writing the scenes](./results-board-scenes).
