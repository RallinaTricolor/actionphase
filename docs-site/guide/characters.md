# Characters

## Creating a Character

Character creation is available once the game enters the **Character Creation** state. From the game's **People** tab, click **Create Character** and fill in the character name. After submitting, your character shows as **Pending** status until the GM reviews it.

## Character Statuses

- **Pending** — Submitted, awaiting GM review
- **Approved** — Accepted and participating in the game
- **Rejected** — Not accepted; you can create a new character and resubmit
- **Dead** — Character has died during the game (read-only)

## The Character Sheet

Click on your character from the People tab to open its character sheet. The sheet has four tabs:

- **Public Profile** — Character description and other public-facing information
- **Private Notes** — Your private notes, visible only to you, the GM, and audience members
- **Abilities & Skills** — Character abilities and trained skills
- **Inventory** — Equipment, items, and currency/resources

Other players can see the Public Profile tab of approved characters. The remaining tabs (Private Notes, Abilities & Skills, Inventory) are visible only to the character's owner, the GM, and audience members — not other players.

---

## GM: Approving Characters

Player-submitted characters appear in the **People** tab with a **Pending** label. Click a character to open it, then:

- **Publish** — Approves the character and makes it active
- **Reject** — Declines the character submission; the player can submit a new one

## GM: Creating Characters

GMs can create both player characters and NPC characters from the **Create Character** button in the People tab. When creating a character as GM, you can assign it to a specific player account (for player characters) or leave it unassigned (for NPCs).

## GM: Editing Character Sheets

As GM, you can edit any character's Abilities & Skills and Inventory directly from their character sheet at any time. Players can edit their own Public Profile and Private Notes but cannot directly edit their Abilities, Skills, Inventory, or Currency — those are GM-controlled.

## GM: Draft Character Updates

To prepare character sheet changes that will take effect when you publish action results:

1. When writing an action result, open the **Draft Character Updates** section.
2. Add updates specifying the module (Abilities, Skills, Inventory, Currency), field name, value, and operation (Upsert or Delete).
3. Save the drafts.

Draft updates are not visible to the player. When you publish the result, all associated drafts are applied to the character sheet automatically.

See [Action Phases](./action-phases) for the full publish flow.

## GM: Deleting Characters

GMs can delete characters from the character card. Characters that have existing messages or action submissions cannot be deleted.

## GM: Assigning NPCs

To assign an NPC to an audience member so they can control it during action phases, click **Assign NPC** on the NPC's character card and select the audience member.

## GM: Character Death

To mark a character as dead, use the **Mark as Dead** option from the character's management controls. Dead characters remain visible in the game history but cannot submit actions or receive new updates.
