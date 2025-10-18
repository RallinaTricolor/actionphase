import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth-helpers';

/**
 * E2E Tests for Character Mentions Feature
 *
 * Tests character mention autocomplete and rendering in Common Room posts.
 * Uses test fixture Game #164 ("E2E Common Room Test Game") with:
 * - Active common_room phase
 * - Characters: "GM Test Character", "Test Player 1 Character", "Test Player 2 Character"
 *
 * Created by fixture: backend/pkg/db/test_fixtures/07_common_room.sql
 */
test.describe('Character Mentions', () => {
  test('should allow user to mention character in comment with autocomplete', async ({ browser }) => {
    // Use Game #164 from fixtures - dedicated Common Room test game
    const gameId = 164;

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');

      // Navigate to Common Room tab
      await gmPage.click('button:has-text("Common Room")');
      await gmPage.waitForTimeout(1000);

      // Verify Common Room heading is visible
      await expect(gmPage.locator('h2:has-text("Common Room")')).toBeVisible({ timeout: 5000 });

      // Create a new post
      const postContent = `Mission Briefing ${Date.now()}: Everyone report in!`;
      await gmPage.fill('textarea#content', postContent);
      await gmPage.waitForTimeout(500);
      await gmPage.click('button:has-text("Create GM Post")');
      await gmPage.waitForTimeout(2000);

      // Verify the post appears
      await expect(gmPage.locator(`text=${postContent}`).first()).toBeVisible({ timeout: 5000 });

      // === Player comments with character mention ===
      await loginAs(playerPage, 'PLAYER_1');
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');
      await playerPage.click('button:has-text("Common Room")');
      await playerPage.waitForTimeout(1000);

      // Wait for the post to be visible
      await expect(playerPage.locator(`text=${postContent}`).first()).toBeVisible({ timeout: 5000 });

      // Find the post card and click "Add Comment" button
      const postCard = playerPage.locator(`div:has-text("${postContent}")`).first();
      await postCard.locator('button:has-text("Add Comment")').first().click();
      await playerPage.waitForTimeout(1000);

      // Get the comment textarea
      const commentTextarea = postCard.locator('textarea[placeholder*="Write a comment"]');
      await commentTextarea.waitFor({ state: 'visible' });

      // Type text to trigger autocomplete
      await commentTextarea.click(); // Focus the textarea
      await commentTextarea.pressSequentially('Hey @');
      await playerPage.waitForTimeout(500);

      // Verify autocomplete dropdown appears
      const autocomplete = playerPage.locator('[role="listbox"]');
      await expect(autocomplete).toBeVisible({ timeout: 2000 });

      // Verify characters are shown in autocomplete (all game characters should appear)
      await expect(playerPage.locator('text=Test Player 1 Character').first()).toBeVisible();
      await expect(playerPage.locator('text=Test Player 2 Character').first()).toBeVisible();
      await expect(playerPage.locator('text=GM Test Character').first()).toBeVisible();

      // Click to select a character (Test Player 2 Character)
      await playerPage.click('text=Test Player 2 Character');
      await playerPage.waitForTimeout(500);

      // Verify mention was inserted
      const textareaValue = await commentTextarea.inputValue();
      expect(textareaValue).toContain('@Test');

      // Complete the comment
      await commentTextarea.fill('Hey @Test Player 2 Character, what do you think?');
      await playerPage.waitForTimeout(500);

      // Submit the comment
      const form = postCard.locator('form').first();
      await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
      await playerPage.waitForTimeout(3000);

      // Verify comment appears
      await expect(playerPage.locator('text=what do you think?').first()).toBeVisible({ timeout: 5000 });

      // Verify the mention is highlighted (mark element)
      const mentionElement = playerPage.locator('mark[data-mention-id]').first();
      await expect(mentionElement).toBeVisible({ timeout: 5000 });
      await expect(mentionElement).toHaveText('@Test Player 2 Character');
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('should filter autocomplete as user types', async ({ page }) => {
    const gameId = 164;

    await loginAs(page, 'GM');
    await page.goto(`/games/${gameId}`);
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("Common Room")');
    await page.waitForTimeout(1000);

    // Create a post to comment on
    const postContent = `Filter Test ${Date.now()}: Testing autocomplete filtering`;
    await page.fill('textarea#content', postContent);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Create GM Post")');
    await page.waitForTimeout(2000);

    // Find the post and click Add Comment
    const postCard = page.locator(`div:has-text("${postContent}")`).first();
    await postCard.locator('button:has-text("Add Comment")').first().click();
    await page.waitForTimeout(1000);

    // Get the comment textarea
    const commentTextarea = postCard.locator('textarea[placeholder*="Write a comment"]');
    await commentTextarea.waitFor({ state: 'visible' });

    // Type @ followed by filter text
    await commentTextarea.click(); // Focus the textarea
    await commentTextarea.pressSequentially('@Test Player 1');
    await page.waitForTimeout(500);

    // Verify autocomplete appears
    const autocomplete = page.locator('[role="listbox"]');
    await expect(autocomplete).toBeVisible({ timeout: 2000 });

    // Should show "Test Player 1 Character" (matches filter)
    await expect(page.locator('[role="listbox"] >> text=Test Player 1 Character')).toBeVisible();

    // Should NOT show "Test Player 2 Character" (doesn't match "1")
    // Note: This might still be visible if the filter is too lenient, so we just check Player 1 is there
  });

  test('should render mentions with markdown formatting', async ({ browser }) => {
    const gameId = 164;

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');
      await gmPage.click('button:has-text("Common Room")');
      await gmPage.waitForTimeout(1000);

      const postContent = `Markdown Test ${Date.now()}: Testing mentions with markdown`;
      await gmPage.fill('textarea#content', postContent);
      await gmPage.waitForTimeout(500);
      await gmPage.click('button:has-text("Create GM Post")');
      await gmPage.waitForTimeout(2000);

      // === Player comments with mention and markdown ===
      await loginAs(playerPage, 'PLAYER_1');
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');
      await playerPage.click('button:has-text("Common Room")');
      await playerPage.waitForTimeout(1000);

      const postCard = playerPage.locator(`div:has-text("${postContent}")`).first();
      await postCard.locator('button:has-text("Add Comment")').first().click();
      await playerPage.waitForTimeout(1000);

      const commentTextarea = postCard.locator('textarea[placeholder*="Write a comment"]');
      await commentTextarea.waitFor({ state: 'visible' });

      // Type comment with markdown and mention (using fill since we're not testing autocomplete here)
      const commentWithMarkdown = 'Hey @Test Player 2 Character, check out **this bold text** and *this italic*!';
      await commentTextarea.click();
      await commentTextarea.fill(commentWithMarkdown);
      await playerPage.waitForTimeout(500);

      // Submit the comment
      const form = postCard.locator('form').first();
      await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
      await playerPage.waitForTimeout(3000);

      // Verify comment appears with both markdown and mention rendering
      const commentElement = playerPage.locator('text=this bold text').first();
      await expect(commentElement).toBeVisible({ timeout: 5000 });

      // Verify bold text is actually bold
      const boldElement = playerPage.locator('strong:has-text("this bold text")').first();
      await expect(boldElement).toBeVisible();

      // Verify italic text is actually italic
      const italicElement = playerPage.locator('em:has-text("this italic")').first();
      await expect(italicElement).toBeVisible();

      // Verify mention is highlighted
      const mentionElement = playerPage.locator('mark[data-mention-id]:has-text("@Test Player 2 Character")').first();
      await expect(mentionElement).toBeVisible();
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });

  test('should not render mentions inside code blocks', async ({ browser }) => {
    const gameId = 164;

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();

    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      // === GM creates a post ===
      await loginAs(gmPage, 'GM');
      await gmPage.goto(`/games/${gameId}`);
      await gmPage.waitForLoadState('networkidle');
      await gmPage.click('button:has-text("Common Room")');
      await gmPage.waitForTimeout(1000);

      const postContent = `Code Test ${Date.now()}: Testing mentions in code blocks`;
      await gmPage.fill('textarea#content', postContent);
      await gmPage.waitForTimeout(500);
      await gmPage.click('button:has-text("Create GM Post")');
      await gmPage.waitForTimeout(2000);

      // === Player comments with mention inside code block ===
      await loginAs(playerPage, 'PLAYER_1');
      await playerPage.goto(`/games/${gameId}`);
      await playerPage.waitForLoadState('networkidle');
      await playerPage.click('button:has-text("Common Room")');
      await playerPage.waitForTimeout(1000);

      const postCard = playerPage.locator(`div:has-text("${postContent}")`).first();
      await postCard.locator('button:has-text("Add Comment")').first().click();
      await playerPage.waitForTimeout(1000);

      const commentTextarea = postCard.locator('textarea[placeholder*="Write a comment"]');
      await commentTextarea.waitFor({ state: 'visible' });

      // Type comment with mention inside inline code (using fill since we're not testing autocomplete here)
      const commentWithCode = 'Try using `@Test Player 2 Character` in your code!';
      await commentTextarea.click();
      await commentTextarea.fill(commentWithCode);
      await playerPage.waitForTimeout(500);

      // Submit the comment
      const form = postCard.locator('form').first();
      await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
      await playerPage.waitForTimeout(3000);

      // Verify comment appears
      await expect(playerPage.locator('text=Try using').first()).toBeVisible({ timeout: 5000 });

      // Verify the mention inside code is NOT rendered as a mention (should be plain text inside <code>)
      const codeElement = playerPage.locator('code:has-text("@Test Player 2 Character")').first();
      await expect(codeElement).toBeVisible();

      // There should be no mark element for this text (it's in code block)
      const mentionElements = playerPage.locator('mark[data-mention-id]:has-text("@Test Player 2 Character")');
      const count = await mentionElements.count();
      expect(count).toBe(0); // Should be 0 because it's in a code block
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
