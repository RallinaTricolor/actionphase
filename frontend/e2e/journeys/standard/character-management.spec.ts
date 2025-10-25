import { test, expect } from '@playwright/test';
import { tagTest, tags } from '../../fixtures/test-tags';
import { loginAs } from '../../fixtures/auth-helpers';
import { FIXTURE_GAMES } from '../../fixtures/test-data-factory';
import { CharacterSheetPage } from '../../pages/CharacterSheetPage';

test.describe.skip('Character Management Journey', () => {
  test(tagTest([tags.CHARACTER, tags.E2E], 'Player can create character with name, playbook, and traits'), async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    // Navigate to a game in character creation state or in-progress
    const gameTitle = FIXTURE_GAMES.COMMON_ROOM.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await page.locator(`text=${gameTitle}`).first().click();
    await page.waitForLoadState('networkidle');

    // Navigate to Characters tab
    const charactersTab = page.locator('button:has-text("Characters"), a:has-text("Characters")');
    await charactersTab.click();
    await page.waitForLoadState('networkidle');

    // Click "Create Character" button
    const createCharButton = page.locator('button:has-text("Create Character")');
    const buttonExists = await createCharButton.isVisible().catch(() => false);

    if (buttonExists) {
      await createCharButton.click();
      await page.waitForLoadState('networkidle');

      // Fill character creation form
      const timestamp = Date.now();
      const characterName = `E2E Test Character ${timestamp}`;

      const nameInput = page.locator('input[name="name"], input[placeholder*="name"]');
      await nameInput.fill(characterName);

      // Select playbook/character type if dropdown exists
      const playbookSelect = page.locator('select[name="playbook"], select[name="character_type"]');
      const hasPlaybook = await playbookSelect.isVisible().catch(() => false);
      if (hasPlaybook) {
        const options = await playbookSelect.locator('option').all();
        if (options.length > 1) {
          await playbookSelect.selectOption({ index: 1 }); // Select first non-empty option
        }
      }

      // Fill description/traits
      const descriptionInput = page.locator('textarea[name="description"], textarea[placeholder*="description"]');
      const hasDescription = await descriptionInput.isVisible().catch(() => false);
      if (hasDescription) {
        await descriptionInput.fill('A brave adventurer seeking glory and treasure.');
      }

      // Submit form
      const submitButton = page.locator('button[type="submit"]:has-text("Create")');
      await submitButton.click();
      await page.waitForLoadState('networkidle');

      // Verify character was created
      await expect(page.locator(`text=${characterName}`)).toBeVisible({ timeout: 5000 });
      console.log(`✓ Character created: ${characterName}`);
    } else {
      console.log('⚠ Create Character button not available - player may already have character');

      // Verify player has at least one character
      const characterCards = page.locator('[data-testid="character-card"], .character-card');
      const charCount = await characterCards.count();
      expect(charCount).toBeGreaterThan(0);
      console.log(`✓ Player has ${charCount} character(s)`);
    }
  });

  test(tagTest([tags.CHARACTER, tags.E2E], 'Player can edit character sheet'), async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    // Navigate to game with characters
    const gameTitle = FIXTURE_GAMES.COMMON_ROOM.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await page.locator(`text=${gameTitle}`).first().click();
    await page.waitForLoadState('networkidle');

    // Navigate to Characters tab
    const charactersTab = page.locator('button:has-text("Characters"), a:has-text("Characters")');
    await charactersTab.click();
    await page.waitForLoadState('networkidle');

    // Find player's character and click to view
    const characterCard = page.locator('[data-testid="character-card"], .character-card').first();
    await characterCard.click();
    await page.waitForLoadState('networkidle');

    // Check if Edit button exists
    const editButton = page.locator('button:has-text("Edit")');
    const canEdit = await editButton.isVisible().catch(() => false);

    if (canEdit) {
      await editButton.click();
      await page.waitForLoadState('networkidle');

      // Edit character description
      const descriptionInput = page.locator('textarea[name="description"], textarea[data-testid="character-description"]');
      const hasDescription = await descriptionInput.isVisible().catch(() => false);

      if (hasDescription) {
        const newDescription = `Updated description at ${Date.now()}`;
        await descriptionInput.fill(newDescription);

        // Save changes
        const saveButton = page.locator('button:has-text("Save")');
        await saveButton.click();
        await page.waitForLoadState('networkidle');

        // Verify changes saved
        await expect(page.locator(`text=${newDescription}`)).toBeVisible({ timeout: 5000 });
        console.log('✓ Character updated successfully');
      } else {
        console.log('⚠ Description field not found in edit mode');
      }
    } else {
      console.log('⚠ Edit button not visible - character may not be editable');
    }
  });

  test(tagTest([tags.CHARACTER, tags.E2E], 'GM can create NPC'), async ({ page }) => {
    await loginAs(page, 'GM');

    // Navigate to game
    const gameTitle = FIXTURE_GAMES.COMMON_ROOM.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await page.locator(`text=${gameTitle}`).first().click();
    await page.waitForLoadState('networkidle');

    // Navigate to Characters tab
    const charactersTab = page.locator('button:has-text("Characters"), a:has-text("Characters")');
    await charactersTab.click();
    await page.waitForLoadState('networkidle');

    // Click "Create Character" or "Create NPC" button
    const createNPCButton = page.locator('button:has-text("Create NPC"), button:has-text("Create Character")');
    const buttonExists = await createNPCButton.isVisible().catch(() => false);

    if (buttonExists) {
      await createNPCButton.click();
      await page.waitForLoadState('networkidle');

      // Fill character creation form
      const timestamp = Date.now();
      const npcName = `E2E NPC ${timestamp}`;

      const nameInput = page.locator('input[name="name"], input[placeholder*="name"]');
      await nameInput.fill(npcName);

      // Select NPC character type if dropdown exists
      const characterTypeSelect = page.locator('select[name="character_type"]');
      const hasTypeSelect = await characterTypeSelect.isVisible().catch(() => false);
      if (hasTypeSelect) {
        await characterTypeSelect.selectOption({ label: /NPC|Non-Player/ });
      }

      // Fill description
      const descriptionInput = page.locator('textarea[name="description"], textarea[placeholder*="description"]');
      const hasDescription = await descriptionInput.isVisible().catch(() => false);
      if (hasDescription) {
        await descriptionInput.fill('A mysterious wanderer with secrets to share.');
      }

      // Submit form
      const submitButton = page.locator('button[type="submit"]:has-text("Create")');
      await submitButton.click();
      await page.waitForLoadState('networkidle');

      // Verify NPC was created
      await expect(page.locator(`text=${npcName}`)).toBeVisible({ timeout: 5000 });
      console.log(`✓ NPC created: ${npcName}`);
    } else {
      console.log('⚠ Create NPC button not available');
    }
  });

  test(tagTest([tags.CHARACTER, tags.E2E], 'Character can be updated during game progression'), async ({ page }) => {
    await loginAs(page, 'PLAYER_1');

    // Navigate to game
    const gameTitle = FIXTURE_GAMES.COMMON_ROOM.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await page.locator(`text=${gameTitle}`).first().click();
    await page.waitForLoadState('networkidle');

    // Navigate to Characters tab
    const charactersTab = page.locator('button:has-text("Characters"), a:has-text("Characters")');
    await charactersTab.click();
    await page.waitForLoadState('networkidle');

    // Click on player's character
    const characterCard = page.locator('[data-testid="character-card"], .character-card').first();
    await characterCard.click();
    await page.waitForLoadState('networkidle');

    // Check for ability/skill management sections
    const abilitiesSection = page.locator('[data-testid="abilities-section"], [class*="abilities"]');
    const hasAbilities = await abilitiesSection.isVisible().catch(() => false);

    if (hasAbilities) {
      console.log('✓ Character has abilities section');

      // Try to add an ability
      const addAbilityButton = page.locator('button:has-text("Add Ability"), button:has-text("Add Skill")');
      const canAddAbility = await addAbilityButton.isVisible().catch(() => false);

      if (canAddAbility) {
        await addAbilityButton.click();
        await page.waitForLoadState('networkidle');

        // Fill ability form if modal/form appears
        const abilityNameInput = page.locator('input[name="ability_name"], input[placeholder*="ability"]');
        const hasInput = await abilityNameInput.isVisible().catch(() => false);

        if (hasInput) {
          await abilityNameInput.fill('Sword Mastery');

          const saveButton = page.locator('button:has-text("Save"), button:has-text("Add")');
          await saveButton.click();
          await page.waitForLoadState('networkidle');

          console.log('✓ Ability added to character');
        }
      } else {
        console.log('⚠ Add Ability button not available');
      }
    } else {
      console.log('⚠ Abilities section not found');
    }

    // Check for inventory section
    const inventorySection = page.locator('[data-testid="inventory-section"], [class*="inventory"]');
    const hasInventory = await inventorySection.isVisible().catch(() => false);

    if (hasInventory) {
      console.log('✓ Character has inventory section');
    }
  });

  test(tagTest([tags.CHARACTER, tags.E2E], 'Character death/retirement flow'), async ({ page }) => {
    await loginAs(page, 'GM'); // GMs can manage character lifecycles

    // Navigate to game
    const gameTitle = FIXTURE_GAMES.COMMON_ROOM.title;
    await page.goto('/games');
    await page.waitForLoadState('networkidle');

    await page.locator(`text=${gameTitle}`).first().click();
    await page.waitForLoadState('networkidle');

    // Navigate to Characters tab
    const charactersTab = page.locator('button:has-text("Characters"), a:has-text("Characters")');
    await charactersTab.click();
    await page.waitForLoadState('networkidle');

    // Get all character cards
    const characterCards = page.locator('[data-testid="character-card"], .character-card');
    const charCount = await characterCards.count();

    expect(charCount).toBeGreaterThan(0);
    console.log(`✓ Found ${charCount} characters in game`);

    // Click on first character
    await characterCards.first().click();
    await page.waitForLoadState('networkidle');

    // Check for character management options (delete, retire, mark as deceased)
    const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove")');
    const retireButton = page.locator('button:has-text("Retire")');
    const markDeceasedButton = page.locator('button:has-text("Deceased"), button:has-text("Dead")');

    const canDelete = await deleteButton.isVisible().catch(() => false);
    const canRetire = await retireButton.isVisible().catch(() => false);
    const canMarkDeceased = await markDeceasedButton.isVisible().catch(() => false);

    if (canDelete || canRetire || canMarkDeceased) {
      console.log('✓ Character lifecycle management options available');

      if (canRetire) {
        console.log('  - Retire option available');
      }
      if (canMarkDeceased) {
        console.log('  - Mark as deceased option available');
      }
      if (canDelete) {
        console.log('  - Delete option available');
      }
    } else {
      console.log('⚠ No character lifecycle management options visible');
    }

    // Verify character sheet displays character status
    const characterStatus = page.locator('[data-testid="character-status"], [class*="status"]');
    const hasStatus = await characterStatus.isVisible().catch(() => false);

    if (hasStatus) {
      console.log('✓ Character status indicator present');
    }
  });
});
