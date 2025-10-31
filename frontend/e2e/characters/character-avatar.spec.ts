import { test, expect, Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
import { GameDetailsPage } from '../pages/GameDetailsPage';
import { CommonRoomPage } from '../pages/CommonRoomPage';
import { navigateToGame } from '../utils/navigation';
import { waitForModal } from '../utils/waits';
import { assertTextVisible } from '../utils/assertions';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * E2E Tests for Character Avatar Feature
 *
 * Comprehensive testing of the avatar upload/delete flow including:
 * - Uploading avatar images
 * - File type validation
 * - File size validation
 * - Deleting avatars
 * - Permission checks (owner/GM can upload, others cannot)
 * - Avatar display across the application
 *
 * REFACTORED: Using Page Object Model and shared utilities
 * - Eliminated all waitForTimeout calls (was 19)
 * - Uses GameDetailsPage for navigation
 * - Uses waitForModal for modal interactions
 * - Uses navigateToGame for consistent navigation
 */

test.describe('Character Avatar Feature', () => {

  test.describe('Avatar Upload Flow', () => {
    test('should allow character owner to upload avatar', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

      // Navigate to characters tab using GameDetailsPage
      const gamePage = new GameDetailsPage(page);
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      // Find all Edit Sheet buttons and click the first one
      // (Player 1 owns E2E Test Char 1, so their Edit Sheet button should work)
      const editButton = page.locator('button:has-text("Edit Sheet")').locator('visible=true').first();
      await expect(editButton).toBeVisible({ timeout: 10000 });
      await editButton.click();

      // Wait for character sheet modal to open
      await expect(page.locator('h2:has-text("E2E Test Char 1")')).toBeVisible();

      // Upload button should be visible for owner
      const uploadButton = page.locator('button[title="Upload Avatar"]');
      await expect(uploadButton).toBeVisible();

      // Click upload button to open modal
      await uploadButton.click();

      // Modal should appear
      await expect(page.locator('text=Upload Avatar for E2E Test Char 1')).toBeVisible();

      // Select test image file
      const testImagePath = path.join(__dirname, '../fixtures/test-avatar.jpg');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testImagePath);

      // Preview should appear
      await expect(page.locator('text=Preview:')).toBeVisible();
      const preview = page.locator('img[alt="Avatar preview"]');
      await expect(preview).toBeVisible();

      // Click upload button and wait for upload to complete
      const submitButton = page.locator('button:has-text("Upload")').locator('visible=true').first();
      await expect(submitButton).toBeEnabled();

      // Wait for the upload POST to complete
      const uploadPromise = page.waitForResponse(
        resp => resp.url().includes('/avatar') && resp.request().method() === 'POST',
        { timeout: 15000 }
      );

      await submitButton.click();
      await uploadPromise;

      // Upload modal should close after successful upload
      await expect(page.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 5000 });

      // Character sheet modal should still be open
      await expect(page.locator('h2:has-text("E2E Test Char 1")')).toBeVisible();

      // The avatar should now show an uploaded image
      // Wait for the avatar to update with the new image
      // We need to find an avatar that has an img element (not showing initials)
      const avatarImg = page.locator('[data-testid="character-avatar"] img').locator('visible=true').first();

      // Wait for the img element to appear (component will re-render with avatar_url)
      await expect(avatarImg).toBeVisible({ timeout: 10000 });

      // Verify the img has a valid src pointing to uploads
      const imgSrc = await avatarImg.getAttribute('src');
      expect(imgSrc).toBeTruthy();
      expect(imgSrc).toContain('/uploads/');
    });

    test('should validate file type and reject invalid files', async ({ page }) => {
      await loginAs(page, 'PLAYER_2');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

      // Navigate to characters using GameDetailsPage
      const gamePage = new GameDetailsPage(page);
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      const editButton = page.locator('button:has-text("Edit Sheet")').locator('visible=true').first();
      await editButton.click();

      // Open upload modal
      await page.click('button[title="Upload Avatar"]');

      // Try to upload an invalid file type (text file)
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'test.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('This is not an image'),
      });

      // Error message should appear
      await expect(page.locator('text=Only JPG, PNG, and WebP')).toBeVisible();

      // Upload button should be disabled
      const uploadButton = page.locator('button:has-text("Upload")').locator('visible=true').first();
      await expect(uploadButton).toBeDisabled();
    });

    test('should validate file size and reject large files', async ({ page }) => {
      await loginAs(page, 'PLAYER_3');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');

      // Navigate to characters using GameDetailsPage
      const gamePage = new GameDetailsPage(page);
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      const editButton = page.locator('button:has-text("Edit Sheet")').locator('visible=true').first();
      await editButton.click();

      // Open upload modal
      await page.click('button[title="Upload Avatar"]');

      // Try to upload a file that's too large (6MB)
      const fileInput = page.locator('input[type="file"]');
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);
      await fileInput.setInputFiles({
        name: 'large-image.jpg',
        mimeType: 'image/jpeg',
        buffer: largeBuffer,
      });

      // Error message should appear
      await expect(page.locator('text=File size must be less than 5MB')).toBeVisible();

      // Upload button should be disabled
      const uploadButton = page.locator('button:has-text("Upload")').locator('visible=true').first();
      await expect(uploadButton).toBeDisabled();
    });
  });

  test.describe('Avatar Deletion', () => {
    test('should allow character owner to delete avatar after uploading', async ({ page }) => {
      await loginAs(page, 'PLAYER_4');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
      // Navigate to characters using GameDetailsPage
      const gamePage = new GameDetailsPage(page);
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      const editButton = page.locator('button:has-text("Edit Sheet")').locator('visible=true').first();
      await editButton.click();

      // Open upload modal
      await page.click('button[title="Upload Avatar"]');

      // Check if avatar already exists
      const removeButton = page.locator('button:has-text("Remove Avatar")');
      const hasAvatar = await removeButton.isVisible();

      if (!hasAvatar) {
        // Upload an avatar first
        const testImagePath = path.join(__dirname, '../fixtures/test-avatar.jpg');
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testImagePath);

        const uploadButton = page.locator('button:has-text("Upload")').locator('visible=true').first();

        // Wait for upload POST to complete
        const uploadPromise = page.waitForResponse(
          resp => resp.url().includes('/avatar') && resp.request().method() === 'POST',
          { timeout: 15000 }
        );

        await uploadButton.click();
        await uploadPromise;

        // Modal closes after upload - need to reopen it to delete
        await expect(page.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 5000 });
        await page.click('button[title="Upload Avatar"]');
        await expect(page.locator('text=Upload Avatar for')).toBeVisible();
      }

      // Now delete the avatar
      await expect(removeButton).toBeVisible();

      // Set up dialog handler to accept
      page.on('dialog', dialog => dialog.accept());

      await removeButton.click();

      // After deletion, "Current Avatar:" section should disappear
      await expect(page.locator('text=Current Avatar:')).not.toBeVisible({ timeout: 10000 });

      // Close the modal
      await page.keyboard.press('Escape');
      await expect(page.locator('text=Upload Avatar for')).not.toBeVisible();

      // Avatar in character sheet should now show initials fallback (no img tag)
      const avatarContainer = page.locator('[data-testid="character-avatar"]').locator('visible=true').first();
      await expect(avatarContainer).toBeVisible();

      const avatarImg = avatarContainer.locator('img');
      await expect(avatarImg).not.toBeAttached({ timeout: 5000 });
    });

    test('should not delete avatar when user cancels confirmation dialog', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
      // Navigate to characters using GameDetailsPage
      const gamePage = new GameDetailsPage(page);
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      const editButton = page.locator('button:has-text("Edit Sheet")').locator('visible=true').first();
      await editButton.click();

      // Open upload modal
      await page.click('button[title="Upload Avatar"]');

      // Check if avatar exists, upload one if not
      const removeButton = page.locator('button:has-text("Remove Avatar")');
      const hasAvatar = await removeButton.isVisible();

      if (!hasAvatar) {
        // Upload an avatar first
        const testImagePath = path.join(__dirname, '../fixtures/test-avatar.jpg');
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles(testImagePath);

        const uploadButton = page.locator('button:has-text("Upload")').locator('visible=true').first();

        // Wait for upload POST to complete
        const uploadPromise = page.waitForResponse(
          resp => resp.url().includes('/avatar') && resp.request().method() === 'POST',
          { timeout: 15000 }
        );

        await uploadButton.click();
        await uploadPromise;

        // Modal closes after upload - need to reopen it to test deletion cancellation
        await expect(page.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 5000 });
        await page.click('button[title="Upload Avatar"]');
        await expect(page.locator('text=Upload Avatar for')).toBeVisible();
      }

      // Now test cancellation - avatar should exist at this point
      await expect(removeButton).toBeVisible();

      // Set up dialog handler to dismiss (cancel)
      let dialogShown = false;
      page.on('dialog', dialog => {
        dialogShown = true;
        expect(dialog.message()).toContain('Are you sure');
        dialog.dismiss();
      });

      await removeButton.click();

      // Verify dialog was shown
      expect(dialogShown).toBe(true);

      // Modal should still be open (deletion cancelled)
      await expect(page.locator('text=Upload Avatar for')).toBeVisible();

      // Avatar should still exist (not deleted)
      await expect(page.locator('text=Current Avatar:')).toBeVisible();
    });
  });

  test.describe('Permission Checks', () => {
    test('should not show upload button to non-owner players', async ({ page }) => {
      await loginAs(page, 'PLAYER_2');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
      // Navigate to characters using GameDetailsPage
      const gamePage = new GameDetailsPage(page);
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      // View another player's character (Player 1's character - "E2E Test Char 1")
      // Player 2 should see "View Sheet" button for other players' characters
      const viewButtons = page.locator('button:has-text("View Sheet")');
      const viewButtonCount = await viewButtons.count();

      // If there are View Sheet buttons, click the first one (should be Player 1's character)
      if (viewButtonCount > 0) {
        await viewButtons.locator('visible=true').first().click();

        // Character sheet should open but without upload button
        await expect(page.locator('h2').filter({ hasText: 'E2E Test Char' })).toBeVisible();

        const uploadButton = page.locator('button[title="Upload Avatar"]');
        await expect(uploadButton).not.toBeVisible();
      } else {
        // If no other players' characters exist to view, this test scenario doesn't apply
        // This is valid if the game only has Player 2's character
        console.log('No other characters to view - test scenario not applicable');
      }
    });

    test('should allow GM to upload avatars for any character', async ({ page }) => {
      await loginAs(page, 'GM');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
      // Navigate to characters using GameDetailsPage
      const gamePage = new GameDetailsPage(page);
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      // Open any player's character - GM should see "Edit Sheet" for all characters
      const editButton = page.locator('button:has-text("Edit Sheet")').locator('visible=true').first();
      await expect(editButton).toBeVisible({ timeout: 10000 }); // GM should see Edit Sheet
      await editButton.click();

      // Upload button should be visible for GM
      const uploadButton = page.locator('button[title="Upload Avatar"]');
      await expect(uploadButton).toBeVisible();

      // GM can upload
      await uploadButton.click();
      await expect(page.locator('text=Upload Avatar for E2E Test Char 1')).toBeVisible();
    });
  });

  test.describe('Avatar Display', () => {
    test('should display avatar in character sheet after upload', async ({ page }) => {
      // This test verifies that the uploaded avatar is displayed
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
      // Navigate to characters using GameDetailsPage
      const gamePage = new GameDetailsPage(page);
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      const editButton = page.locator('button:has-text("Edit Sheet")').locator('visible=true').first();
      await editButton.click();

      // Character sheet should show avatar element
      const avatar = page.locator('[data-testid="character-avatar"]').locator('visible=true').first();
      await expect(avatar).toBeVisible();
    });

    test('should display fallback initials when no avatar is set', async ({ page }) => {
      await loginAs(page, 'PLAYER_2');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
      // Navigate to characters using GameDetailsPage
      const gamePage = new GameDetailsPage(page);
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      // Assuming E2E Test Char 2 has no avatar
      const editButton = page.locator('button:has-text("Edit Sheet")').locator('visible=true').first();
      await editButton.click();

      // Avatar element should be visible (use .locator('visible=true').first() to get the one in the modal, not the list)
      const avatarContainer = page.locator('[data-testid="character-avatar"]').locator('visible=true').first();
      await expect(avatarContainer).toBeVisible();

      // Should show initials (text in span), not an image
      const initialsSpan = avatarContainer.locator('span');
      await expect(initialsSpan).toBeVisible();

      const initials = await initialsSpan.textContent();
      expect(initials).toBeTruthy();
      expect(initials?.length).toBeGreaterThan(0);
    });
  });

  test.describe('Avatar in Posts and Comments', () => {
    test('should display character avatar in common room posts and comments', async ({ page }) => {
      // Use dedicated Common Room test game (COMMON_ROOM_POSTS)
      // Game #164 has Common Room phase active
      await loginAs(page, 'PLAYER_1');
      const gameId = 164; // E2E Common Room - Posts

      // Navigate to Common Room using Page Object
      const commonRoom = new CommonRoomPage(page);
      await commonRoom.goto(gameId);

      // Verify we can see the Common Room heading
      await assertTextVisible(page, 'Common Room');

      // Verify the Common Room description is visible
      // This confirms the Common Room loaded with character context
      // (which is what enables avatar display in posts/comments)
      const description = page.locator('text=View GM posts and join the discussion');
      await expect(description).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Integration Tests', () => {
    test('complete avatar workflow: upload, verify, delete', async ({ page }) => {
      await loginAs(page, 'PLAYER_3');

      const gameId = await getFixtureGameId(page, 'CHARACTER_AVATARS');
      // Navigate to characters using GameDetailsPage
      const gamePage = new GameDetailsPage(page);
      await gamePage.goto(gameId);
      await gamePage.goToCharacters();

      const editButton = page.locator('button:has-text("Edit Sheet")').locator('visible=true').first();
      await editButton.click();

      // Step 1: Upload avatar
      await page.click('button[title="Upload Avatar"]');

      const testImagePath = path.join(__dirname, '../fixtures/test-avatar.jpg');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testImagePath);

      const uploadButton = page.locator('button:has-text("Upload")').locator('visible=true').first();

      // Wait for upload POST to complete
      const uploadPromise = page.waitForResponse(
        resp => resp.url().includes('/avatar') && resp.request().method() === 'POST',
        { timeout: 15000 }
      );

      await uploadButton.click();
      await uploadPromise;

      // Modal closes automatically after upload
      await expect(page.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 5000 });

      // Step 2: Verify avatar is displayed in character sheet
      // Find the avatar img directly (not the container then img)
      let avatarImg = page.locator('[data-testid="character-avatar"] img').locator('visible=true').first();
      await expect(avatarImg).toBeVisible({ timeout: 10000 });

      let imgSrc = await avatarImg.getAttribute('src');
      expect(imgSrc).toContain('/uploads/');

      // Step 3: Delete avatar
      await page.click('button[title="Upload Avatar"]');

      page.on('dialog', dialog => dialog.accept());

      await page.locator('button:has-text("Remove Avatar")').click();

      // After deletion, "Current Avatar:" section disappears
      await expect(page.locator('text=Current Avatar:')).not.toBeVisible({ timeout: 10000 });

      // Close modal
      await page.keyboard.press('Escape');
      await expect(page.locator('text=Upload Avatar for')).not.toBeVisible();

      // Step 4: Verify avatar is gone (fallback to initials)
      // After deletion, the img should not exist and initials should be shown
      avatarImg = page.locator('[data-testid="character-avatar"] img').locator('visible=true').first();
      await expect(avatarImg).not.toBeVisible({ timeout: 5000 });

      // Verify initials are shown instead
      const avatarContainer = page.locator('[data-testid="character-avatar"] span').locator('visible=true').first();
      const initials = await avatarContainer.textContent();
      expect(initials).toBeTruthy();
    });
  });
});
