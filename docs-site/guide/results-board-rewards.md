# Results Board: Rewards

The results board can hand out rewards with each action phase's results: the
lines of text at the end of a result ("Bonus objective: 1 rating") and the
changes they make to the character sheet. You describe each reward once; the
board writes the reward block and the sheet updates from the same lines, so
the two can't disagree.

Rewards are GM-only. Players see the block in their result, and their sheet
changes once the result is published.

::: tip The template is the page; each reward is a line on it
What every character gets once, like a total, their tier or a comment, goes
in the **template**. What one reward says, like what they did and what they
got, goes in **that reward's text**.

A score is the usual case. Its rewards say only "Complete" or "Partial", and
the template says
<code v-pre>**Coin:** {{value Numbers/Coin}} ({{gain Numbers/Coin}})</code>
once, for everyone.
:::

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

- **Write**: each character's **Rewards & Sheet** tab has a chip for every
  reward in the lists they don't have yet, and **+ Reward** for a one-off.
  **Rewards table** shows everyone against every reward, as checkboxes.
- **Read**: select part of a submission and choose **+ Award**. The line keeps
  the passage as the reason.

**+ Sheet change**, under Sheet changes on the same tab, is for a change that
isn't a reward: damage taken, an item used up. It changes the sheet but stays
out of the block. See [Damage alongside rewards](#damage-alongside-rewards).

## Sheet updates

The board applies each person's lines, in order, to their sheet as it is now,
and shows the sheet before and after. It saves the result as **draft sheet
updates** on one of their draft results, the same updates you can make by hand
in the results list. Publishing applies them, as it always has.

- A draft sheet update is a copy of a whole tab, so all of a character's sheet
  changes for a phase go on **one result**. With several results, pick which
  one on the Rewards & Sheet tab. On a staged result they go on the last part, and
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

These go in the block template on Game setup. Most also work in a reward's
own text: see [In a reward's text](#in-a-reward-s-text) below.

| Tag | What it shows |
|---|---|
| <code v-pre>{{lines result}}</code> | Every line in that section, one after another. Use a section key from Game setup. |
| <code v-pre>{{if bonus}}…{{end}}</code> | What's between, only when that section has lines. Also works with a text box name, or a sheet value (shown when it isn't 0). Ifs can nest. |
| <code v-pre>{{value Challenges/Rating}}</code> | A sheet value after this phase's rewards. A ref is Tab/Entry, with an optional /Field at the end. |
| <code v-pre>{{before Challenges/Rating}}</code> | The same, before this phase's rewards. |
| <code v-pre>{{gain Challenges/Rating}}</code> | How much it changed, like +2. |
| <code v-pre>{{max Challenges/Versatile}}</code> | A track's maximum, for "3/7". |
| <code v-pre>{{label Challenges/Rating}}</code> | The name for the current number, from a scale. |
| <code v-pre>{{text Comment}}</code> | A box you fill in per person on Write's Rewards & Sheet tab. |
| <code v-pre>{{changes Inventory}}</code> | Every change this phase's rewards make on that tab. |
| <code v-pre>{{name}}</code> | The character's name. |

Tab and field names are the ones on your sheet, with any capitals. In the
template, <code v-pre>{{gain}}</code> adds up everything this phase's rewards
did to that value.

### In a reward's text

A reward's own text, the text you write for it in the reward list, can
describe that one reward's change:

| Tag | What it shows |
|---|---|
| <code v-pre>{{entry}}</code> | The name of the entry it changes. |
| <code v-pre>{{before}}</code> | The value before this reward. |
| <code v-pre>{{after}}</code> | The value after this reward. |
| <code v-pre>{{gain}}</code> | How much this reward added, like +2. |

On their own they use the reward's first sheet change. A reward that changes
several things can name the one it means:
<code v-pre>{{gain Numbers/Coin}}</code>, <code v-pre>{{after Numbers/XP}}</code>.
A name the reward doesn't change shows **?**.

The text is markdown, with the usual **Preview** beside the box. Under the
box, the reward shows how it will read in the block, formatted. On Write
that's for the character you're giving it to. In the lists on Game setup it's
for a player you pick, as if they got it alone. Any tag that finds nothing is
listed there.

- "Complete: <code v-pre>{{gain Numbers/Coin}}</code> Coin", adding 2 to
  Coin, gives "Complete: +2 Coin".
- "<code v-pre>{{entry}}: {{before}} -> {{after}}</code>", setting the Skills
  entry Bane's rank to Tier 3, gives "Bane: Tier 2 -> Tier 3".

<code v-pre>{{value}}</code>, <code v-pre>{{max}}</code>,
<code v-pre>{{label}}</code> and <code v-pre>{{name}}</code> work in a
reward's text too, and mean the same as in the template: the sheet after all
of this phase's rewards. "Coin: <code v-pre>{{value Numbers/Coin}}</code>"
is the character's total, not this reward's share.

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
  with that name appears on every character's Rewards & Sheet tab.
- **A counter that pays out.** "3/3 minor objectives" is one reward with two
  sheet changes: Minor Objectives −3 and Rating +0.5.
- **Same reward, different entry.** For "Concept upgrade", leave the entry
  blank in the list (Pick per person). Each time you give it, the board opens
  the line so you can pick the entry.
- **Choose 1.** Tick **Player chooses** on the reward. Its text goes in the
  block; nothing goes on the sheet until they pick.

## Examples

Each example below is a whole setup: what goes in Game setup, what the GM
gives one character, and the block that character gets. They continue
[the example phase](./results-board#the-example-phase), *The Night Market*.
The blocks are what the board produces from that setup, word for word. They
use the sheet's standard **Numbers**, **Skills** and **Inventory** tabs; use
your own tab and entry names in yours.

### Experience with a running total

The smallest useful block: a list of what they earned, and their total.

**Game setup**

- Sections: `reward: Rewards`
- Rewards in the list, each adding to the **Numbers** entry **XP**:
  "Caught the thief: +2 XP" (+2) and "Kept the courier alive: +1 XP" (+1)

**Template**

```md
## Rewards

{{lines reward}}

**XP:** {{before Numbers/XP}} → {{value Numbers/XP}} ({{gain Numbers/XP}})
```

**Jory** had 4 XP and gets both rewards:

::: info What Jory gets
## Rewards {.ignore-header}

Caught the thief: +2 XP

Kept the courier alive: +1 XP

**XP:** 4 → 7 (+3)
:::

His sheet's XP goes from 4 to 7 when the result is published.

### Sections that only show when earned

One template for everyone. A heading with no lines under it disappears, so a
character who earned no bonus objectives never sees an empty "Bonus
objectives" heading. This one also names the total with a scale, counts minor
objectives toward a payout, and ends with a comment written per person.

**Game setup**

- Sections:
  ```
  result: Scenario result
  bonus: Bonus objectives
  minor: Minor objectives
  ```
- Scales: `Numbers/Renown: 0 Unknown, 3 Whispered, 6 Notorious, 10 Legendary`
- Rewards in the lists:
  - "Survived the Night Market: +1 Renown": Scenario result; Renown +1.
  - "Laid hands on the Ember Crown: +0.5 Renown": this phase's list, Bonus
    objectives; Renown +0.5.
  - "Went unseen until the theft" and "Kept your ambush secret until the
    last moment": Minor objectives; Minor Objectives +1.
  - "3/3 minor objectives: +0.5 Renown": Minor objectives; two sheet
    changes, Minor Objectives −3 and Renown +0.5.

**Template**

```md
## {{name}}'s rewards

{{lines result}}

{{if bonus}}### Bonus objectives

{{lines bonus}}{{end}}

{{if minor}}### Minor objectives

{{lines minor}}

{{value Numbers/Minor Objectives}}/3 toward the next Renown{{end}}

**Renown:** {{value Numbers/Renown}} ({{label Numbers/Renown}})

{{if Comment}}> {{text Comment}}{{end}}
```

**Mara** (Renown 4.5, one minor objective so far) gets the scenario result,
the bonus objective and a minor objective. The GM writes her a comment in the
**Comment** box:

::: info What Mara gets
## Mara Quill's rewards {.ignore-header}

Survived the Night Market: +1 Renown

### Bonus objectives {.ignore-header}

Laid hands on the Ember Crown: +0.5 Renown

### Minor objectives {.ignore-header}

Went unseen until the theft

2/3 toward the next Renown

**Renown:** 6 (Notorious)

> Half the market saw you do it. The other half will hear about it by morning.
:::

**Jory** (Renown 2) gets only the scenario result, and no comment. Both
headings and the comment line drop out:

::: info What Jory gets
## Jory Vance's rewards {.ignore-header}

Survived the Night Market: +1 Renown

**Renown:** 3 (Whispered)
:::

**Sable** (Renown 5, two minor objectives so far) completes a third, so the
GM also gives "3/3 minor objectives". Lines apply in order: the counter
reaches 3, then pays out and goes back to 0:

::: info What Sable gets
## Sable Ott's rewards {.ignore-header}

Survived the Night Market: +1 Renown

### Minor objectives {.ignore-header}

Kept your ambush secret until the last moment

3/3 minor objectives: +0.5 Renown

0/3 toward the next Renown

**Renown:** 6.5 (Notorious)
:::

### Loot, upgrades and a choice

Rewards that add, change and remove sheet entries, with a summary of the
inventory at the end.

**Game setup**

- Sections:
  ```
  loot: Loot
  upgrade: Upgrades
  choice: Choices
  ```
- Rewards in the lists:
  - "Captain Hale's thanks: a watch commendation": Loot; a new
    **Inventory** entry, Watch commendation, quantity 1.
  - "Magister Vell pays your fee: 150 gold": Loot; Inventory **Gold** +150.
  - "Your lantern was smashed on the bridge": Loot; remove the Inventory
    entry **Lantern**.
  - "Skill upgrade", with the text <code v-pre>{{entry}}: {{before}} -> {{after}}</code>:
    Upgrades; set a **Skills** entry's **Rank**, with the entry left blank
    (Pick per person). Giving it to Jory, the GM picks Swordplay and sets
    the rank to Adept.
  - "Choose 1: a favour from Captain Hale, a place in Magister Vell's
    household guard, or Sable's crossbow.": Choices; **Player chooses**
    ticked.

**Template**

```md
## Rewards

{{lines loot}}

{{if upgrade}}### Upgrades

{{lines upgrade}}{{end}}

{{if choice}}### Your choice

{{lines choice}}{{end}}

**Inventory changes:**

{{changes Inventory}}
```

**Jory** has 20 Gold, a Lantern, and Swordplay at Novice:

::: info What Jory gets
## Rewards {.ignore-header}

Captain Hale's thanks: a watch commendation

Magister Vell pays your fee: 150 gold

Your lantern was smashed on the bridge

### Upgrades {.ignore-header}

Swordplay: Novice -> Adept

### Your choice {.ignore-header}

Choose 1: a favour from Captain Hale, a place in Magister Vell's household guard, or Sable's crossbow.

**Inventory changes:**

Gold: 20 → 170

**Watch commendation** (new)

~~Lantern~~
:::

The choice changes nothing on the sheet. Once Jory picks, update the sheet
yourself.

### Damage alongside rewards

Not every sheet change is a reward. A **sheet change** (Write's
**+ Sheet change**, or a line with **In the reward block** unticked) updates
the sheet but stays out of the block: it never appears as a line, in
<code v-pre>{{changes}}</code> or in <code v-pre>{{gain}}</code>. Tags that
show the sheet as it is, like <code v-pre>{{value}}</code> and
<code v-pre>{{max}}</code>, still count it, so a total in the block is never
wrong.

**Game setup**

- Sections: `reward: Rewards`

**Template**

```md
## Rewards

{{lines reward}}

**XP:** {{value Numbers/XP}} ({{gain Numbers/XP}} this phase)

**Health:** {{value Numbers/Health}}/{{max Numbers/Health}}
```

**Mara** (4 XP, Health 10/10) gets "Lifted the Ember Crown: +2 XP", and the
GM adds a sheet change of Health −3 for Sable's crossbow bolt:

::: info What Mara gets
## Rewards {.ignore-header}

Lifted the Ember Crown: +2 XP

**XP:** 6 (+2 this phase)

**Health:** 7/10
:::
