# Results Board Rewards

The results board can hand out rewards with each action phase's results: the
lines of text at the end of a result ("Bonus objective: 1 rating") and the
changes they make to the character sheet. You describe each reward once; the
board writes the reward block and the sheet updates from the same lines, so
the two can't disagree.

Rewards are GM-only. Players see the block in their result, and their sheet
changes once the result is published.

## The pieces

- **Reward lists.** Rewards you define once and give to many people. The
  **every phase** list holds rewards that repeat (scenario results, minor
  objectives). Each action phase also has **its own list** for that phase's
  bonus objectives. Edit both on **Game setup**, under Reward lists. You can
  fill in a phase's list before the phase starts, and move a reward between
  the lists.
- **Reward lines.** What one character got this phase. Giving a reward from a
  list copies it onto them, so you can change one person's copy without
  touching anyone else's. If you change the list's version later, their copy
  says **Differs from the list**, with **Use the list's version** and **Keep
  mine**.
- **Sections.** Every line belongs to a section (Scenario result, Bonus
  objectives…). The template decides where each section appears.
- **The template.** Your layout for the reward block, one per game, written in
  markdown. Plain text stays as you write it; tags in <code v-pre>{{ }}</code>
  fill in per person.
- **Sheet changes.** A reward can add to a number or track, set a field, add
  an entry or remove one, on any tab of your game's character sheet.
- **Scales.** Names for number ranges, like "5.5 and up is Glowing".

## Giving rewards

All from the results board:

- **Write**: each character's **Rewards** panel has a chip for every reward in
  the lists they don't have yet, and **+ Line** for a one-off. **Rewards
  table** shows everyone against every reward, as checkboxes.
- **Read**: select part of a submission and choose **+ Award**. The line keeps
  the passage as the reason.
- **Scenes**: **+ Sheet update** makes a line for someone in the scene, tied to
  it.

## Sheet updates

The board applies each person's lines, in order, to their sheet as it is now,
and shows the sheet before and after. It saves the result as **draft sheet
updates** on one of their draft results, the same updates you can make by hand
in the results list. Publishing applies them, as it always has.

- A draft sheet update is a copy of a whole tab, so all of a character's sheet
  changes for a phase go on **one result**. With several results, pick which
  one in the Rewards panel. On a staged result they go on the last part, and
  apply when that part is revealed.
- If a character already has sheet updates you made by hand in the results
  list, the board asks before replacing them.
- A reward marked **Player chooses** ("Choose 1") puts its text in the block
  and nothing on the sheet. Update their sheet yourself once they've picked.
- Once the result that carries the rewards is published, they're locked.

## The block in the result

**Put block in result** writes the block at the end of the result that
carries the rewards. Press it again after a change and it replaces the copy it
put there last time. **Checks before publishing** says when the block is
missing from the result or out of date. **Copy block** copies it instead.

## Tags

| Tag | What it shows |
|---|---|
| <code v-pre>{{lines result}}</code> | Every line in that section, one after another. Use a section key from Game setup. |
| <code v-pre>{{if bonus}}…{{end}}</code> | What's between, only when that section has lines. Also works with a text box name, or a sheet value (shown when it isn't 0). Ifs can nest. |
| <code v-pre>{{value Challenges/Rating}}</code> | A sheet value after this phase's rewards. A ref is Tab/Entry, with an optional /Field at the end. |
| <code v-pre>{{before Challenges/Rating}}</code> | The same, before this phase's rewards. |
| <code v-pre>{{gain Challenges/Rating}}</code> | How much it changed, like +2. |
| <code v-pre>{{max Challenges/Versatile}}</code> | A track's maximum, for "3/7". |
| <code v-pre>{{label Challenges/Rating}}</code> | The name for the current number, from a scale. |
| <code v-pre>{{text Comment}}</code> | A box you fill in per person in Write's Rewards panel. |
| <code v-pre>{{changes Inventory}}</code> | Every change this phase's rewards make on that tab. |
| <code v-pre>{{name}}</code> | The character's name. |

Tab and field names are the ones on your sheet, with any capitals. Inside a
reward's own text, <code v-pre>{{entry}}</code>, <code v-pre>{{before}}</code>
and <code v-pre>{{after}}</code> fill in from its first sheet change:
<code v-pre>{{entry}} {{before}} -> {{after}}</code> gives "Bane Tier 2 -> Tier 3".

A **?** in the block means a tag couldn't find what it names. The preview on
Game setup lists every problem as you type (an `if` with no `end`, a misspelled
section with "did you mean"), and so do the checks before publishing.

## Recipes

- **A total with a tier name.** Put
  <code v-pre>**Total:** {{value Challenges/Rating}} ({{label Challenges/Rating}})</code>
  in the template and add the scale `Challenges/Rating: 0 Flickering, 5.5 Glowing`.
- **Hide a heading nobody earned.** Wrap it:
  <code v-pre>{{if bonus}}## Bonus{{lines bonus}}{{end}}</code>.
- **Hide a line for people without the entry.**
  <code v-pre>{{if Numbers/Coin}}Coin: {{value Numbers/Coin}}{{end}}</code>
  shows nothing for a character with no Coin.
- **A comment per person.** Add <code v-pre>{{text Comment}}</code>. A box
  with that name appears in every character's Rewards panel.
- **A counter that pays out.** "3/3 minor objectives" is one reward with two
  sheet changes: Minor Objectives −3 and Rating +0.5.
- **Same reward, different entry.** For "Concept upgrade", leave the entry
  blank in the list (Pick per person). Each time you give it, the board opens
  the line so you can pick the entry.
- **Choose 1.** Tick **Player chooses** on the reward. Its text goes in the
  block; nothing goes on the sheet until they pick.
