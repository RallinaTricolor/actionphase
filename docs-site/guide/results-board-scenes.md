# Results Board: Scenes

A scene is where people meet: a place, a time slot, who's there, and what
happens. You write what happens once, as **moments**, and tick who reads each
one. The board then gives each reader their own copy, in their own words, to
use in their result.

Scenes are made on the [Map](./results-board-map#scenes), from a cell where
two or more people meet. The Scenes tab shows one scene at a time.

## The scene's header

- **The scene picker** lists every scene by time slot, with **← Previous**
  and **Next →** to go through them in order.
- **The title** is optional. Without one, a scene is named after its cast.
- **Location** and **Time slot** can be changed here.
- **Conflict** marks a fight or a clash. The Map shows it as a Conflict pill.
- **Done** marks a scene you've finished writing; **Reopen** undoes it. The
  Scenes tab counts them: "1/2 done".
- **Delete scene**, with Undo. Cards that gave it as a cause lose that cause.

**Here** is the cast. **+ someone** adds a player or NPC, and ✕ removes one.

### After the scene

Some scenes take someone out of the phase. **+ State** says who ends up
**Incapacitated** or **Dead**, either **until the end of the phase** or
**back by** a later slot. **Active** brings someone back from an earlier
scene's state.

Incapacitated and dead are out of play. From the next slot on, the
Map hatches their row and its checks flag any card or scene they're still in.
The slot of the scene itself isn't flagged: it holds the fight that took them
out.

## Moments

A moment is one thing that happens. Write it with names, as the GM would
tell it: "Sable fires. The bolt tears through Mara's cloak."

Above each moment are its **readers**: everyone in the scene who gets a
result. Tick the ones who see or hear it.

- A new moment starts with everyone ticked.
- **Untick everyone** and the moment is a private GM note, for you alone.
- **+ someone elsewhere** adds a reader from outside the scene: someone who
  overhears it, or sees it from a distance.
- **✎** beside a reader gives that person **their own version**: what it's
  like to be the one who's hit, or a version that leaves out what they
  couldn't see. Their own version is used exactly as you write it.

People in the same room don't need separate scenes. Keep one scene, and
untick whoever doesn't notice a moment.

Moments move up and down, and delete with Undo. **+ moment** between two
moments inserts one there. **Ctrl+Enter** adds a moment below the one you're
in.

## Reads as

**Reads as** shows the whole scene as one reader gets it: only the moments
they read, with their own versions, in second person. Pick whose copy to
show. **Show what Mara misses** adds the moments she doesn't read, greyed
out. GM notes never show here.

With **Moments read as "you"** on in [Game setup](./results-board-setup#writing-results),
each reader's names turn into "you":

- "Mara reaches…" becomes "You reach…": the verb right after the name is
  fixed to match.
- "Mara's" becomes "your".
- He, she, his and her are marked for you to check. The board doesn't change
  them, since it can't tell whose they are.

Each change is highlighted, so you can see what moved. The board only fixes
the verb straight after the name. "Mara slips between the stalls and lifts
the crown" becomes "You slip between the stalls and lifts the crown", so
either rewrite the sentence or give that reader their own version.

**Side by side** shows every reader at once: a column per person and a row
per moment. A coloured edge marks an own version. Click a cell to edit that
moment.

## The side pane

Beside the moments, **Reference** has what you need while writing:

- **Plans:** each person's cards in this scene, with their outcomes, which
  you can change here. **→ Moment** starts a moment with the plan shown
  above it. A waiting IF card offers **Triggers here**. "Also at the Night
  Market at this time" lists others with cards in the same cell, with a
  button to add them.
- **Submission:** the cast's submissions. Select a passage for **→ Moment**.
- **Sheet:** a cast member's character sheet. **Insert** puts an item's name
  in bold at your cursor.
- **Codex:** the codex, with **Insert**.

## The example

### Dusk, the Night Market

Cast: Mara and Jory. Conflict.

1. "Mara slips between the stalls, and the crown leaves the courier's
   satchel in Mara's hand." Readers: Mara.
2. "Jory sees the satchel flap open and draws his blade." Readers: Jory and
   Mara. The GM gives Jory his own version: "The satchel flap is open. Your
   blade is in your hand before you've thought about it."
3. "A shout goes up from the market: “Thief!”" Readers: Mara, Jory, and
   Sable through **+ someone elsewhere**: she hears it on her way to the
   bridge, and knows Mara is coming.
4. A GM note, with nobody ticked: "Hale's watch hears it too. They'll reach
   the bridge at Midnight."

Mara's copy, in **Reads as**:

> 1. You slip between the stalls, and the crown leaves the courier's satchel
>    in your hand.
> 2. Jory sees the satchel flap open and draws his blade.
> 3. A shout goes up from the market: “Thief!”

### Midnight, Lantern Bridge

Cast: Mara, Jory and Sable. Conflict.

1. "Sable waits under the arch with a loaded crossbow." Readers: Sable.
2. "Mara reaches the middle of Lantern Bridge, and Sable steps out of the
   shadows under the arch." Readers: Mara and Sable.
3. "Sable fires. The bolt tears through Mara's cloak and into her
   shoulder." Readers: Mara and Sable.
4. "Jory arrives at a run. The crossbow goes spinning out of Sable's hands."
   Readers: everyone.
5. "Sable is dragged off the bridge by the watch. Mara has the crown, and
   Jory has Mara." Readers: everyone.

Moment 3 in Mara's copy reads "Sable fires. The bolt tears through your
cloak and into her shoulder", with "her" marked to check. Being shot feels
different from the inside, so the GM gives Mara her own version instead:
"Something punches into your shoulder, and you're on the stones before you
hear the crossbow."

The same moments, as each of them reads them:

| | Mara | Sable | Jory |
|---|---|---|---|
| 1 | | You wait under the arch with a loaded crossbow. | |
| 2 | You reach the middle of Lantern Bridge, and Sable steps out of the shadows under the arch. | Mara reaches the middle of Lantern Bridge, and you step out of the shadows under the arch. | |
| 3 | *(her own version)* Something punches into your shoulder, and you're on the stones before you hear the crossbow. | You fire. The bolt tears through Mara's cloak and into her shoulder. | |
| 4 | Jory arrives at a run. The crossbow goes spinning out of Sable's hands. | Jory arrives at a run. The crossbow goes spinning out of your hands. | You arrive at a run. The crossbow goes spinning out of Sable's hands. |
| 5 | Sable is dragged off the bridge by the watch. You have the crown, and Jory has you. | You are dragged off the bridge by the watch. Mara has the crown, and Jory has Mara. | Sable is dragged off the bridge by the watch. Mara has the crown, and you have Mara. |

**After the scene:** Sable is **Incapacitated** until the end of the phase:
the watch has her. The bolt in Mara's shoulder is for her result, and for a
sheet change in [Write](./results-board-write#rewards-and-sheet-changes):
Health −3.

Both scenes are marked **Done**. Next: [writing the results](./results-board-write).
