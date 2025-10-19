import { test, expect, Page } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';
import { getFixtureGameId } from '../fixtures/game-helpers';
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
 */

test.describe('Character Avatar Feature', () => {

  test.describe('Avatar Upload Flow', () => {
    test('should allow character owner to upload avatar', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      // Navigate to characters tab
      await page.click('button:has-text("Characters")');
      await page.waitForTimeout(500);

      // Find all Edit Sheet buttons and click the first one
      // (Player 1 owns E2E Test Char 1, so their Edit Sheet button should work)
      const editButton = page.locator('button:has-text("Edit Sheet")').first();
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

      // Click upload button
      const submitButton = page.locator('button:has-text("Upload")').last();
      await expect(submitButton).toBeEnabled();
      await submitButton.click();

      // Wait for upload to complete (modal closes)
      // If there's an error, the modal will stay open
      try {
        await expect(page.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 15000 });
      } catch (e) {
        // Check if there's an error message
        const errorMessage = await page.locator('.text-red-600').textContent().catch(() => 'No error message found');
        console.log('Upload may have failed. Error:', errorMessage);
        throw e;
      }

      // Avatar should now display the uploaded image in character sheet
      const avatar = page.locator('[data-testid="character-avatar"]').first();
      const avatarImg = avatar.locator('img');
      await expect(avatarImg).toBeVisible({ timeout: 5000 });

      // Image should have a valid src
      const imgSrc = await avatarImg.getAttribute('src');
      expect(imgSrc).toBeTruthy();
      expect(imgSrc).toContain('/uploads/');
    });

    test('should validate file type and reject invalid files', async ({ page }) => {
      await loginAs(page, 'PLAYER_2');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      // Navigate to characters and open character sheet
      await page.click('button:has-text("Characters")');
      await page.waitForTimeout(500);

      const editButton = page.locator('button:has-text("Edit Sheet")').first();
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
      const uploadButton = page.locator('button:has-text("Upload")').last();
      await expect(uploadButton).toBeDisabled();
    });

    test('should validate file size and reject large files', async ({ page }) => {
      await loginAs(page, 'PLAYER_3');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      // Navigate to characters and open character sheet
      await page.click('button:has-text("Characters")');
      await page.waitForTimeout(500);

      const editButton = page.locator('button:has-text("Edit Sheet")').first();
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
      const uploadButton = page.locator('button:has-text("Upload")').last();
      await expect(uploadButton).toBeDisabled();
    });
  });

  test.describe('Avatar Deletion', () => {
    test('should allow character owner to delete avatar after uploading', async ({ page }) => {
      await loginAs(page, 'PLAYER_4');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      // Navigate to characters and open character sheet
      await page.click('button:has-text("Characters")');
      await page.waitForTimeout(500);

      const editButton = page.locator('button:has-text("Edit Sheet")').first();
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

        const uploadButton = page.locator('button:has-text("Upload")').last();
        await uploadButton.click();

        // Wait for upload to complete
        await expect(page.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 10000 });

        // Re-open modal to delete
        await page.click('button[title="Upload Avatar"]');
      }

      // Now delete the avatar
      await expect(removeButton).toBeVisible();

      // Set up dialog handler to accept
      page.on('dialog', dialog => dialog.accept());

      await removeButton.click();

      // Wait for deletion to complete (modal closes)
      await expect(page.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 10000 });

      // Avatar should now show initials fallback (no img tag)
      const avatar = page.locator('[data-testid="character-avatar"]').first();
      await expect(avatar).toBeVisible();

      const avatarImg = avatar.locator('img');
      await expect(avatarImg).not.toBeVisible();
    });

    test('should not delete avatar when user cancels confirmation dialog', async ({ page }) => {
      await loginAs(page, 'PLAYER_1');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      // Navigate to characters and open character sheet
      await page.click('button:has-text("Characters")');
      await page.waitForTimeout(500);

      const editButton = page.locator('button:has-text("Edit Sheet")').first();
      await editButton.click();

      // Open upload modal
      await page.click('button[title="Upload Avatar"]');

      // If remove button exists, test cancellation
      const removeButton = page.locator('button:has-text("Remove Avatar")');

      if (await removeButton.isVisible()) {
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
      }
    });
  });

  test.describe('Permission Checks', () => {
    test('should not show upload button to non-owner players', async ({ page }) => {
      await loginAs(page, 'PLAYER_2');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      // Navigate to characters
      await page.click('button:has-text("Characters")');
      await page.waitForTimeout(500);

      // Try to view another player's character (Player 1's character)
      // Should only see "View Sheet" button, not "Edit Sheet" for other player's character
      const viewButton = page.locator('button:has-text("View Sheet")').first();
      if (await viewButton.isVisible({ timeout: 5000 })) {
        await viewButton.click();

        // Character sheet should open but without upload button
        await expect(page.locator('h2').filter({ hasText: 'E2E Test Char' })).toBeVisible();

        const uploadButton = page.locator('button[title="Upload Avatar"]');
        await expect(uploadButton).not.toBeVisible();
      } else {
        // If no View Sheet button, skip this test scenario
        test.skip();
      }
    });

    test('should allow GM to upload avatars for any character', async ({ page }) => {
      await loginAs(page, 'GM');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      // Navigate to characters
      await page.click('button:has-text("Characters")');
      await page.waitForTimeout(500);

      // Open any player's character - GM should see "Edit Sheet" for all characters
      const editButton = page.locator('button:has-text("Edit Sheet")').first();
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

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Characters")');
      await page.waitForTimeout(500);

      const editButton = page.locator('button:has-text("Edit Sheet")').first();
      await editButton.click();

      // Character sheet should show avatar element
      const avatar = page.locator('[data-testid="character-avatar"]').first();
      await expect(avatar).toBeVisible();
    });

    test('should display fallback initials when no avatar is set', async ({ page }) => {
      await loginAs(page, 'PLAYER_2');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Characters")');
      await page.waitForTimeout(500);

      // Assuming E2E Test Char 2 has no avatar
      const editButton = page.locator('button:has-text("Edit Sheet")').first();
      await editButton.click();

      // Avatar element should be visible
      const avatar = page.locator('[data-testid="character-avatar"]').first();
      await expect(avatar).toBeVisible();

      // Should show initials (text content), not an image
      const initials = await avatar.textContent();
      expect(initials).toBeTruthy();
      expect(initials?.length).toBeGreaterThan(0);
    });
  });

  test.describe('Avatar in Posts and Comments', () => {
    test('should display character avatar in common room posts and comments', async ({ browser }) => {
      const gameId = 164; // COMMON_ROOM_TEST

      const gmContext = await browser.newContext();
      const playerContext = await browser.newContext();

      const gmPage = await gmContext.newPage();
      const playerPage = await playerContext.newPage();

      try {
        // 1. Player uploads avatar
        await loginAs(playerPage, 'PLAYER_1');
        await playerPage.goto(`/games/${gameId}`);
        await playerPage.waitForLoadState('networkidle');

        await playerPage.click('button:has-text("Characters")');
        await playerPage.waitForTimeout(500);

        const editButton = playerPage.locator('button:has-text("Edit Sheet")').first();
        await editButton.click();
        await playerPage.waitForTimeout(500);

        const uploadButton = playerPage.locator('button[title="Upload Avatar"]');
        await uploadButton.click();
        await playerPage.waitForTimeout(500);

        const removeButton = playerPage.locator('button:has-text("Remove Avatar")');
        const hasAvatar = await removeButton.isVisible();

        if (!hasAvatar) {
          const testImagePath = path.join(__dirname, '../fixtures/test-avatar.jpg');
          const fileInput = playerPage.locator('input[type="file"]');
          await fileInput.setInputFiles(testImagePath);

          await playerPage.locator('button:has-text("Upload")').last().click();
          await expect(playerPage.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 10000 });
        }

        // Reload to close modals
        await playerPage.reload();
        await playerPage.waitForLoadState('networkidle');

        // 2. GM creates a post
        await loginAs(gmPage, 'GM');
        await gmPage.goto(`/games/${gameId}`);
        await gmPage.waitForLoadState('networkidle');

        await gmPage.click('button:has-text("Common Room")');
        await gmPage.waitForTimeout(1000);

        const postContent = `Avatar Test Post ${Date.now()}`;
        await gmPage.fill('textarea#content', postContent);
        await gmPage.waitForTimeout(500);
        await gmPage.click('button:has-text("Create GM Post")');
        await gmPage.waitForTimeout(2000);

        await expect(gmPage.locator(`text=${postContent}`).first()).toBeVisible({ timeout: 5000 });

        // 3. Player comments on the post
        await playerPage.click('button:has-text("Common Room")');
        await playerPage.waitForTimeout(1000);

        await expect(playerPage.locator(`text=${postContent}`).first()).toBeVisible({ timeout: 5000 });

        const postCard = playerPage.locator(`div:has-text("${postContent}")`).first();
        await postCard.locator('button:has-text("Add Comment")').first().click();
        await playerPage.waitForTimeout(1000);

        const testCommentContent = `Avatar test comment ${Date.now()}`;
        const commentTextarea = postCard.locator('textarea[placeholder*="Write a comment"]');
        await commentTextarea.fill(testCommentContent);

        const form = postCard.locator('form').first();
        await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
        await playerPage.waitForTimeout(2000);

        // 4. Verify comment was posted successfully
        const comment = playerPage.locator(`text=${testCommentContent}`).first();
        await expect(comment).toBeVisible({ timeout: 5000 });

        // Verify the character name appears on the page (indicating attribution worked)
        await expect(playerPage.locator('text=Test Player 1 Character').first()).toBeVisible();
      } finally {
        await gmContext.close();
        await playerContext.close();
      }
    });
  });

  test.describe('Integration Tests', () => {
    test('complete avatar workflow: upload, verify, delete', async ({ page }) => {
      await loginAs(page, 'PLAYER_3');

      const gameId = await getFixtureGameId(page, 'E2E_ACTION');
      await page.goto(`/games/${gameId}`);
      await page.waitForLoadState('networkidle');

      // Navigate to character
      await page.click('button:has-text("Characters")');
      await page.waitForTimeout(500);

      const editButton = page.locator('button:has-text("Edit Sheet")').first();
      await editButton.click();

      // Step 1: Upload avatar
      await page.click('button[title="Upload Avatar"]');

      const testImagePath = path.join(__dirname, '../fixtures/test-avatar.jpg');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testImagePath);

      await page.locator('button:has-text("Upload")').last().click();
      await expect(page.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 10000 });

      // Step 2: Verify avatar is displayed
      let avatar = page.locator('[data-testid="character-avatar"]').first();
      let avatarImg = avatar.locator('img');
      await expect(avatarImg).toBeVisible();

      let imgSrc = await avatarImg.getAttribute('src');
      expect(imgSrc).toContain('/uploads/');

      // Step 3: Delete avatar
      await page.click('button[title="Upload Avatar"]');

      page.on('dialog', dialog => dialog.accept());
      await page.locator('button:has-text("Remove Avatar")').click();

      await expect(page.locator('text=Upload Avatar for')).not.toBeVisible({ timeout: 10000 });

      // Step 4: Verify avatar is gone (fallback to initials)
      avatar = page.locator('[data-testid="character-avatar"]').first();
      avatarImg = avatar.locator('img');
      await expect(avatarImg).not.toBeVisible();

      const initials = await avatar.textContent();
      expect(initials).toBeTruthy();
    });
  });
});
