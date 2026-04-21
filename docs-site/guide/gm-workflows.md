# GM Workflows

This page covers the controls available to GMs for managing the game structure, phases, and participants.

## Creating a Game

From the **Games** page, click **Create Game**. Fill in:

- **Title** — The name of your game
- **Description** — Visible to players browsing for games (supports Markdown)

After creation, your game starts in **Setup** state. You can edit the game details at any time before the game completes using **Edit Game** from the game actions menu (⋮).

## Advancing Game States

Use the game actions menu (⋮) on the game page to move through the lifecycle:

1. **Start Recruitment** — Opens the game for player applications
2. **Begin Character Creation** — Closes applications; approved players can now submit characters
3. **Start Game** — Moves to **In Progress** and enables phase creation
4. **Pause / Resume** — Temporarily suspends the game without ending it
5. **Complete Game** — Ends the game; all content is preserved read-only
6. **Cancel Game** — Cancels the game; all content is preserved read-only

See [Game States](./game-states) for the full state diagram.

## Phases

### Phase Types

- **Common Room** — Players read GM posts and comment. Polls can be run.
- **Action Phase** — Players submit private actions. The GM writes and publishes results.

### Creating a Phase

Click **New Phase** in the Phase Management panel. The form includes:

- **Phase Type** — Common Room or Action Phase (required)
- **Title** — Optional custom name (e.g., "The Council Meets")
- **Description** — Optional context shown at the top of the phase (max 500 characters, Markdown supported)
- **Auto-activate at** — Optional date/time to activate the phase automatically. Leave blank to activate manually.
- **Deadline** — Optional deadline shown as a countdown timer to all participants

New phases are created in **Draft** status.

### Activating a Phase

Click **Activate** on a draft phase to make it the current active phase. Only one phase can be active at a time.

### Editing a Phase

Click **Edit** on any phase to update its title, description, auto-activate time, or deadline.

### Setting or Changing a Deadline

Deadlines can be set when creating a phase or edited afterward using the **Edit Deadline** control on the phase card. Deadlines are informational — they do not automatically close or advance the phase when they expire.

### Deleting a Phase

A phase can be deleted only if it has no associated content (submissions, results, messages, polls, or threads). If content has been created in the phase, it cannot be deleted.

## Deleting a Game

Cancelled games can be permanently deleted from the game actions menu. This removes all game data and cannot be undone.
