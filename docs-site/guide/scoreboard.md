# Scoreboard

The **Scoreboard** tab ranks the player characters by values from their
character sheets, such as a Score or HP entry on the Numbers tab. It always shows
the sheets as they are now; there is no history.

Only approved player characters who are still in the game appear. NPCs and
characters waiting for approval never do.

## Turning it on

The GM turns the board on with **Enable Scoreboard** on the **Rules** tab of
**Edit Game** (or when creating the game). This adds a **Scoreboard** tab. Turning
it off removes the tab for everyone and keeps your setup, so turning it back on
brings the board back as it was.

A new board starts visible to the GM and audience only, so players see nothing
until you choose otherwise.

## Setting up the board

Open the **Scoreboard** tab and click **Set up columns** (or **Edit scoreboard**
once it has some). Nothing changes for anyone until you click **Save changes**.

**Who can see the board**

- **GM and audience only** — players have no Scoreboard tab
- **Everyone** — anyone logged in can see it, as with the Common Room. Columns you
  hide stay hidden from players

### Columns

Under **Add a column**, pick a **Sheet tab** and an **Entry**, then click **Add
column**. Any tab with a number or track field can be used. The Entry list offers
the names your characters already use, and you can type one that nobody has yet.
If a tab has more than one number field, choose the **Field** too.

A column reads each character's entry **with that name**, ignoring capitals. A
character with no entry of that name shows a dash. If one player names their
entry "Scores" instead of "Score", they get a dash, so keep names consistent.

For each column you can set:

- **Heading** — the column title. Defaults to the entry name
- **Cells show**
  - **Value** — the number, e.g. `7`
  - **Value of max** — for tracks, e.g. `7 / 12`
  - **Ranges** — a label in place of the number (below)
- **Hide from players** — the GM and audience still see the column, and it can
  still decide the order

Use the arrows to reorder columns, and **Change source** to point a column at
another entry.

### Ranges

Ranges show a label in place of a number, so players learn roughly how a
character is doing without the exact value. For example, for HP:

| Range | Label |
|---|---|
| 10 ≤ HP | Healthy |
| 5 < HP < 10 | Bloodied |
| 0 < HP ≤ 5 | Critical |
| (no match) | Down |

- Ranges are checked from the top, and the first match wins. The editor warns
  when two ranges overlap, or when some values match none.
- Labels can use bold, italic and colours, as in posts: `**Bloodied**` or
  `[color:red]Bloodied[/color]`. A label is limited to 24 characters, but the
  formatting doesn't count.
- **Label when no range matches** fills any gap. Without one, those cells are
  blank. The board never falls back to showing the number.
- For a track, **Ranges measure** can be **Percent of maximum**, so "below 50%"
  works when characters have different maximums.
- **Test a value** shows which label a number would get, formatted as players
  will see it.

Players see only the label. You and the audience see the label with the number,
e.g. `Bloodied (6)`.

### Order

Choose what the board is sorted by under **Sort by**, and optionally a second
key under **Then by** to break ties. Anything still tied is ordered by name.
Characters with no value come last.

You can sort by a hidden column. Players then see the order with **Ranked by
the GM** in place of what it's sorted by, and never the values behind it. Rows
are numbered 1, 2, 3… by position, and tied characters get different numbers, so
the numbering doesn't reveal a tie in a hidden score.

Sorting by a column shown as ranges still sorts by the number, so players can
work out who is ahead within a range. To show only the range, sort by something
else.

### Showing players only the top

**Players see only the top** cuts the board players see to its first rows, for
example the top 3, to put a target on the leaders without showing where everyone
else stands. Leave it blank to show every character.

- Players and anyone else logged in see only those rows, under **Showing the top
  3**. The rows below the cut never reach their browser.
- A player whose character is below the cut doesn't see it on the board.
- The cut is exactly that many rows. If the last place is tied, the tie is
  broken by name like any other, so nothing tells players there was a tie.
- "Top" means the board's order. A board sorted by name shows the first names
  alphabetically, and the editor says so.
- You and the audience always see every character, and so does everyone once the
  game reaches its epilogue.

### Preview as player

**Preview as player** shows the board exactly as players would get it from your
unsaved setup. Use it to check a hidden column or ranges before saving.

## When the sheet changes

The board updates when a sheet changes, for example when you publish results
with sheet updates. Someone who already has the board open sees the new values
after reloading the page.

If you remove a sheet tab or field that a column reads, the column goes blank and
the board warns you. Fix the column's source or remove it before you can save
other scoreboard changes.

## After the game

Once a game reaches its **Epilogue** or is **Completed**, everyone can see the
whole board, hidden columns included, even if it was set to GM and audience only.
You can still change the setup during the epilogue, but not after the game is
completed. A board that was never turned on stays off.
