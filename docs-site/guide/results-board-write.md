# Results Board: Write

Write is where each player's result gets written, checked and published. It
shows one character at a time: on one side, a **brief** of everything that
happened to them; on the other, their result.

The toolbar lists everyone who can receive a result: every approved player
character, whether they submitted or not. NPCs don't receive results, so
they aren't listed. Under each name is where they stand (not started, draft,
ready or published) and how many of their moments the result covers, like
"draft · 3/5". A red badge counts possible leaks. **Publish all** is at the
end of the toolbar.

## The brief

**Mara's phase, in order** starts with how many of her moments are covered,
her stances toward the others (and theirs toward her, marked GM only), and
how she ends the phase: Active, Incapacitated or Dead. Then it walks
through the phase one time slot at a time:

- **Their cards**, with outcomes and your GM notes. Open **Their words** for
  the submission's text.
- **Their scenes**: each moment as this character reads it, own versions
  included, with **Copy** and **Insert**.
- **What changed for them:** "Becomes Incapacitated", and when it ends.
- **Contingencies, never triggered**: IF cards that never happened.
- **Full submission**, at the end, folded away.

Dashed rows are things this character mustn't learn: moments in their scenes
that they don't read, and your GM notes. They're shown so you know what to
leave out.

### Covered moments

Each moment the character reads has a tick box. It ticks itself when the
moment's text appears in any of their results, and **Insert** ticks it too.
You can also tick or untick it yourself; your choice always wins. Moments
nobody has covered show in the checks before publishing.

## Results

The **Result** tab holds this character's results for the phase. It's the
same set the Actions tab shows, so a draft started there carries on here,
and the other way round.

- Start typing and the first result is made for you. If the character
  submitted, it's linked to their submission. Drafts save as you type.
- **Insert** in the brief puts a moment's text at your cursor.
- **+ Part** adds another part, revealed on a timer after the one before it:
  5, 15 or 30 minutes. A result can have up to 10 parts. The first is
  revealed when you publish, and each timer starts when the part before it is
  revealed.
- **+ Another result** starts a second, separate result.
- **Publish** sends one result (all its parts). **Delete** removes a draft.
- A published part that hasn't been revealed yet can have its timer changed,
  or be cancelled with **Cancel part** (which takes the later parts with it).
- Published results show when they were sent, and published parts can't be
  edited.

### Make "you"

**Make "you"** turns the character's names into "you" in the text you've
selected, or the whole draft when nothing is selected. It works like
[Reads as](./results-board-scenes#reads-as): the verb straight after the
name is fixed, "Mara's" becomes "your", and he and she are marked to check.
Own versions stay as written. Turn it off for the whole game in
[Game setup](./results-board-setup#writing-results).

## Checks before publishing

The **Checks** tab lists what to look at before this result goes out:

- **Possible leak:** the result mentions something this character shouldn't
  know. That might be a [secret](./results-board-setup#codex) they aren't
  allowed to know, a moment they don't read, someone else's own version, or
  an item on another character's sheet that isn't on theirs.
- **Out of play** and **Two places**, from the Map's checks, for this
  character.
- **Not covered:** moments this character reads that no result mentions yet.
- **Rewards:** the reward block is missing from the result or out of date,
  there's no draft to carry the rewards, or a sheet change can't apply. See
  [Rewards](./results-board-rewards#the-block-in-the-result).

When there's nothing to say, it reads "No leaks, every moment covered,
nothing out of place."

## Rewards and sheet changes

The **Rewards & Sheet** tab gives rewards and makes sheet changes for this
character, and shows the sheet before and after. See
[Rewards](./results-board-rewards).

## Ready and publishing

**Ready → next** marks this character ready and opens the next one who
isn't. **Reopen** undoes it. When everyone is ready, the board says so.

Being ready doesn't publish anything: publish each result with **Publish**,
or everyone's at once with **Publish all**. Both ask you to confirm, and say
how many sheet updates will apply. They use the same publishing as the
Actions tab, and sheet updates apply as they always do.

## The example

**Mara.** The brief shows her Dusk at the Night Market: her theft
(Happened), her "If anyone follows me" (Failed, because of Jory's chase), and
the market scene in her words. At Midnight: her crossing (Interrupted) and
the bridge scene. The first moment of the bridge scene is
dashed: Sable waiting under the arch is something Mara mustn't learn.

The GM writes her result, inserting moments from both scenes and joining
them into prose. Writing about the crown, the GM adds "It's lighter than it
should be." and then, without thinking, "A fake?" The Checks tab shows:

> **Possible leak** "fake": a secret (Forged crown) Mara isn't on the list
> to know

The GM cuts "A fake?" and leaves the hint about the weight. The check clears.
Every moment is ticked. On **Rewards & Sheet**, **+ Sheet change** takes 3
Health for the crossbow bolt. **Ready → next**.

**Jory.** Jory knows about the forgery, so the same word in his result
raises nothing. The GM gives him "Caught the thief" from the reward list,
puts the reward block in his result, and marks him ready.

**Sable.** Her result ends with the watch dragging her off the bridge. The
GM adds **+ Part**, revealed 15 minutes later: she wakes up in a cell under
the watch house. **Ready → next**, and the board says everyone is ready.

The GM presses **Publish all**. Each player gets their own result, telling
only what they saw. Mara's sheet loses 3 Health, Jory's gets his reward, and
15 minutes later Sable finds out where she is.
