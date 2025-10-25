import { Page, Locator } from '@playwright/test';

/**
 * Page Object for Game Posts/Timeline interactions
 *
 * Handles viewing, creating, and commenting on game posts
 */
export class PostPage {
  readonly page: Page;

  // Locators
  readonly postCard: Locator;
  readonly showCommentsButton: Locator;
  readonly addCommentButton: Locator;
  readonly commentEditorTextarea: Locator;
  readonly submitCommentButton: Locator;
  readonly cancelCommentButton: Locator;
  readonly commentsList: Locator;

  constructor(page: Page) {
    this.page = page;

    // Define locators
    this.postCard = page.locator('[data-testid="post-card"]');
    this.showCommentsButton = page.locator('button:has-text("Comments")');
    this.addCommentButton = page.locator('button:has-text("Add Comment")');
    this.commentEditorTextarea = page.locator('textarea[placeholder*="comment"]');
    this.submitCommentButton = page.locator('button[type="submit"]:has-text("Comment")');
    this.cancelCommentButton = page.locator('button:has-text("Cancel")');
    this.commentsList = page.locator('[data-testid="post-card"]').locator('.space-y-3');
  }

  /**
   * Navigate to a game's timeline (posts are shown on game details page)
   */
  async goto(gameId: number) {
    await this.page.goto(`/games/${gameId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for posts to load
   */
  async waitForPostsToLoad(): Promise<void> {
    await this.postCard.first().waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Get all visible posts
   */
  async getPosts(): Promise<string[]> {
    await this.waitForPostsToLoad();
    const posts = await this.postCard.all();
    return Promise.all(posts.map(p => p.textContent())).then(texts =>
      texts.filter((t): t is string => t !== null)
    );
  }

  /**
   * Get post count
   */
  async getPostCount(): Promise<number> {
    await this.waitForPostsToLoad();
    return await this.postCard.count();
  }

  /**
   * Show comments on the first post
   */
  async showComments(postIndex: number = 0): Promise<void> {
    const post = this.postCard.nth(postIndex);
    const commentsButton = post.locator('button:has-text("Comments")');

    // Check if comments are already shown
    const buttonText = await commentsButton.textContent();
    if (buttonText?.includes('Hide')) {
      // Comments already shown
      return;
    }

    await commentsButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Hide comments on a post
   */
  async hideComments(postIndex: number = 0): Promise<void> {
    const post = this.postCard.nth(postIndex);
    const commentsButton = post.locator('button:has-text("Hide Comments")');
    await commentsButton.click();
  }

  /**
   * Click "Add Comment" button on a post
   */
  async startCommenting(postIndex: number = 0): Promise<void> {
    const post = this.postCard.nth(postIndex);
    await this.showComments(postIndex); // Ensure comments section is visible

    const addButton = post.locator('button:has-text("Add Comment")');
    await addButton.click();
    await this.commentEditorTextarea.waitFor({ state: 'visible', timeout: 3000 });
  }

  /**
   * Create a comment on a post
   */
  async createComment(postIndex: number, content: string, characterName?: string): Promise<void> {
    await this.startCommenting(postIndex);

    // Select character if multiple characters available
    if (characterName) {
      const characterSelect = this.page.locator('select').first();
      const isVisible = await characterSelect.isVisible().catch(() => false);
      if (isVisible) {
        await characterSelect.selectOption({ label: `Reply as ${characterName}` });
      }
    }

    await this.commentEditorTextarea.fill(content);
    await this.submitCommentButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Cancel commenting
   */
  async cancelComment(): Promise<void> {
    await this.cancelCommentButton.click();
  }

  /**
   * Get comments for a post
   */
  async getComments(postIndex: number = 0): Promise<string[]> {
    await this.showComments(postIndex);
    const post = this.postCard.nth(postIndex);
    const comments = post.locator('.space-y-3 > div');

    const count = await comments.count();
    if (count === 0) {
      return [];
    }

    const commentTexts = await comments.allTextContents();
    return commentTexts.filter((t): t is string => t !== null && t.trim() !== '');
  }

  /**
   * Get comment count for a post
   */
  async getCommentCount(postIndex: number = 0): Promise<number> {
    const post = this.postCard.nth(postIndex);
    const commentsButton = post.locator('button:has-text("Comments")');
    const buttonText = await commentsButton.textContent();

    // Extract number from "Show Comments (5)" or "Hide Comments (5)"
    const match = buttonText?.match(/\((\d+)\)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Check if post has unread comments badge
   */
  async hasUnreadComments(postIndex: number = 0): Promise<boolean> {
    const post = this.postCard.nth(postIndex);
    const unreadBadge = post.locator('span:has-text("new")');
    return await unreadBadge.isVisible().catch(() => false);
  }

  /**
   * Get character name who posted
   */
  async getPostAuthorCharacter(postIndex: number = 0): Promise<string> {
    const post = this.postCard.nth(postIndex);
    const authorName = post.locator('h3.font-bold').first();
    return await authorName.textContent() || '';
  }

  /**
   * Get username of post author
   */
  async getPostAuthorUsername(postIndex: number = 0): Promise<string> {
    const post = this.postCard.nth(postIndex);
    const username = post.locator('text=/Posted by @[\\w]+/');
    const text = await username.textContent();
    return text?.replace('Posted by @', '').split(' ')[0] || '';
  }

  /**
   * Check if current user is the post author
   */
  async isCurrentUserAuthor(postIndex: number = 0): Promise<boolean> {
    const post = this.postCard.nth(postIndex);
    const youBadge = post.locator('span:has-text("You")');
    return await youBadge.isVisible().catch(() => false);
  }
}
