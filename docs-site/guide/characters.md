# Characters

## Creating a Character

Character creation is available once the game enters the **Character Creation** state. From the game's **People** tab, click **Create Character** and fill in the character name. After submitting, your character shows as **Pending** status until the GM reviews it.

## Character Statuses

- **Pending** — Submitted, awaiting GM review
- **Approved** — Accepted and participating in the game

## The Character Sheet

Open your character sheet by clicking your character's name in the **People** tab. The sheet has four tabs:

- **Public Profile** — Character description visible to all players
- **Private Notes** — Your private notes, visible only to you, the GM, and audience members
- **Abilities & Skills** — Special powers and trained skills (GM-controlled)
- **Inventory** — Equipment, items, and currency/resources (GM-controlled)

The **Public Profile** tab is always visible to everyone. The other three tabs are only visible to the character's player, the GM, and audience members. In a completed game, all participants can view the full sheet.

### Public Profile

The **Character Description** field holds your character's public-facing information — appearance, personality, backstory, and anything else other players can know. Supports Markdown. Edit it by clicking **Edit** on the field.

### Private Notes

A single **Private Notes & Secrets** field for anything you don't want other players to see — motivations, secrets, things your character knows. Supports Markdown. Visible only to you, the GM, and audience members.

### Abilities & Skills

The **Abilities & Skills** tab has two sub-tabs:

**Abilities** — Each ability has a name, type (Learned or Innate), and description.

**Skills** — Each skill has a name, numeric level, optional category (e.g., "Combat", "Social"), and description.

### Inventory

The **Inventory** tab has two sub-tabs:

**Items** — Each item has a name, quantity, optional category, value, weight, and description.

**Currency/Resources** — Tracks named resources (e.g., "Gold", "Credits", "XP") with a current amount and optional notes. Currency is private — only the character's player, the GM, and audience members can see it.

## Avatar

Click the camera icon on the character avatar to upload a new image. Click the trash icon to remove it.

## Renaming a Character

Players can rename their own character by clicking the pencil icon next to the name. GMs can rename any character.

---

## GM: Approving Characters

Player-submitted characters appear in the **People** tab with a **Pending** label. Click a character to open it, then:

- **Publish** — Approves the character and makes it active in the game
- **Delete** — Removes the character; the player can create and submit a new one

## GM: Creating Characters

GMs can create both player characters and NPC characters from the **Create Character** button in the People tab. When creating a character as GM, you can assign it to a specific player account (for player characters) or leave it unassigned (for NPCs).

## GM: Editing Character Sheets

As GM, you can edit any character's Abilities & Skills and Inventory directly from their character sheet at any time. Players can edit their own Public Profile and Private Notes but cannot edit Abilities, Skills, Inventory, or Currency — those are GM-controlled.

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
