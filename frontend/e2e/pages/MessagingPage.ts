import { Page, Locator, expect } from '@playwright/test';
import { navigateToGameAndTab } from '../utils/navigation';
import { waitForVisible } from '../utils/waits';
import { assertTextVisible } from '../utils/assertions';

/**
 * Page Object Model for Private Messaging
 *
 * Encapsulates all private messaging interactions including:
 * - Creating conversations
 * - Sending messages
 * - Managing participants
 * - Conversation navigation
 */
export class MessagingPage {
  constructor(private page: Page) {}

  /**
   * Navigate to the Messages tab for a specific game
   */
  async goto(gameId: number) {
    await navigateToGameAndTab(this.page, gameId, 'Messages');
  }

  /**
   * Get the Messages heading
   */
  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Messages' });
  }

  /**
   * Get the New Conversation button
   */
  get newConversationButton(): Locator {
    return this.page.getByRole('button', { name: 'New Conversation' }).or(
      this.page.locator('button[title="New Conversation"]')
    );
  }

  /**
   * Get the conversation title input
   */
  get conversationTitleInput(): Locator {
    return this.page.getByPlaceholder(/Planning the heist/i).or(
      this.page.getByRole('textbox', { name: /title/i })
    );
  }

  /**
   * Get the message textarea
   */
  get messageTextarea(): Locator {
    return this.page.getByPlaceholder(/Type your message/i);
  }

  /**
   * Get the Send button
   */
  get sendButton(): Locator {
    return this.page.getByRole('button', { name: 'Send' });
  }

  /**
   * Get the Create Conversation button
   */
  get createConversationButton(): Locator {
    return this.page.getByRole('button', { name: 'Create Conversation' });
  }

  /**
   * Open the new conversation form
   */
  async openNewConversationForm() {
    await this.newConversationButton.click();
    await waitForVisible(this.conversationTitleInput);
  }

  /**
   * Select a character as participant
   * @param characterName - Character name to select
   */
  async selectParticipant(characterName: string) {
    const label = this.page.getByLabel(characterName, { exact: false });
    await label.click();
  }

  /**
   * Create a new conversation
   * @param title - Conversation title
   * @param participants - Array of character names to include
   */
  async createConversation(title: string, participants: string[]) {
    await this.openNewConversationForm();

    // Fill in title
    await this.conversationTitleInput.fill(title);

    // Select participants
    for (const participant of participants) {
      await this.selectParticipant(participant);
    }

    // Submit form
    await this.createConversationButton.click();
    await this.page.waitForLoadState('networkidle');

    // Verify conversation was created
    await assertTextVisible(this.page, title);
  }

  /**
   * Send a message in the current conversation
   * @param message - Message text
   */
  async sendMessage(message: string) {
    await this.messageTextarea.fill(message);
    await this.sendButton.click();
    await this.page.waitForLoadState('networkidle');

    // Verify message appears
    await assertTextVisible(this.page, message);
  }

  /**
   * Open a conversation by title
   * @param conversationTitle - Title of the conversation to open
   */
  async openConversation(conversationTitle: string) {
    const conversation = this.page.getByText(conversationTitle).first();
    await conversation.click();
    await this.page.waitForLoadState('networkidle');

    // Wait for conversation to load (give UI time to render)
    await this.page.waitForTimeout(1000);
  }

  /**
   * Verify a conversation exists in the list
   * @param conversationTitle - Title to verify
   */
  async verifyConversationExists(conversationTitle: string) {
    await assertTextVisible(this.page, conversationTitle);
  }

  /**
   * Verify a conversation does NOT exist in the list
   * @param conversationTitle - Title to verify is not visible
   */
  async verifyConversationNotVisible(conversationTitle: string) {
    const conversation = this.page.getByText(conversationTitle);
    await expect(conversation).not.toBeVisible();
  }

  /**
   * Verify a message exists in the conversation thread
   * @param messageContent - Message content to verify
   */
  async verifyMessageExists(messageContent: string) {
    const message = this.page.getByText(messageContent).last();
    await expect(message).toBeVisible({ timeout: 5000 });
  }

  /**
   * Verify a message does NOT exist
   * @param messageContent - Message content to verify is not visible
   */
  async verifyMessageNotVisible(messageContent: string) {
    const message = this.page.getByText(messageContent);
    await expect(message).not.toBeVisible();
  }

  /**
   * Navigate to Messages tab using button/tab click
   */
  async navigateToMessages() {
    const messagesTab = this.page.getByRole('tab', { name: 'Messages' }).or(
      this.page.getByRole('button', { name: 'Messages' })
    );
    await messagesTab.click();
    await this.page.waitForLoadState('networkidle');
  }
}
