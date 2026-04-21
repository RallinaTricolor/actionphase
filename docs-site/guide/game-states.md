# Game States

Every game moves through a series of states that determine what players and GMs can do. The current state is shown on the game's main page.

## States

### Setup

The game has been created but is not yet visible to other players. Only the GM can see it. The GM configures the game (title, description, settings) before moving it forward.

> [!NOTE] GM Only
> Move the game from Setup to Recruitment when you're ready to accept applications.

### Recruitment

The game is open for applications. Players can apply and the GM reviews applications and invites participants. Characters cannot be created yet.

### Character Creation

Approved players can now create and submit their characters for GM review. The GM advances the game to In Progress when ready.

### In Progress

The game is active. Phases can be created and run. Which tabs are visible depends on the current phase type:

- During a **Common Room phase**: the Common Room tab appears (posts, polls, discussion)
- During an **Action phase**: the Actions tab appears (submit and view your action)

Messages, Handouts, People, History, and the Audience tab (for GM and audience members) are available throughout.

### Paused

The GM has temporarily paused the game. During this state the game page shows only the Handouts and Game Info tabs — the full tab set is not available. No new phases can be started and action submissions are not accepted.

> [!NOTE] GM Only
> Resume the game from the game management controls to return to **In Progress**.

### Completed

The game has ended. All content is preserved as a public archive — anyone can browse a completed game's history. Anonymous mode is automatically disabled when a game completes, so character ownership becomes visible. No new content can be created.

### Cancelled

The game was cancelled before or during play. Content is preserved but is not public — only participants and audience members retain access. No new content can be created.

## State Transitions

```
Setup → Recruitment → Character Creation → In Progress ⇄ Paused
                                                ↓
                                           Completed
```

Cancellation is available from any non-terminal state (Setup, Recruitment, Character Creation, In Progress, Paused). Completion is only available from **In Progress**. Completed and Cancelled are terminal — no further transitions are possible.

> [!NOTE] GM Only
> All state transitions are initiated by the GM from the game management controls.
