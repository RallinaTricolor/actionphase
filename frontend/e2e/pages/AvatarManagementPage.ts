import { Page } from '@playwright/test';

/**
 * Page Object for Avatar Upload and Management
 *
 * Handles avatar upload and management workflow including:
 * - Uploading avatar files
 * - Previewing uploaded avatars
 * - Saving/canceling uploads
 * - Deleting avatars
 * - Checking permissions
 */
export class AvatarManagementPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Upload avatar file
   * @param filePath - Absolute path to image file
   */
  async uploadAvatar(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Wait for upload to complete and preview to appear
   */
  async waitForPreview() {
    await this.page.getByTestId('avatar-preview').waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Save uploaded avatar
   */
  async saveAvatar() {
    await this.page.getByRole('button', { name: 'Save' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Cancel avatar upload
   */
  async cancelUpload() {
    await this.page.getByRole('button', { name: 'Cancel' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Delete current avatar
   */
  async deleteAvatar() {
    await this.page.getByRole('button', { name: /delete.*avatar/i }).click();

    // Handle confirmation if present
    const confirmButton = this.page.getByRole('button', { name: /confirm|delete/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check if avatar preview is visible
   */
  async hasPreview(): Promise<boolean> {
    try {
      await this.page.getByTestId('avatar-preview').waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if avatar upload is allowed (permissions)
   */
  async canUploadAvatar(): Promise<boolean> {
    try {
      const fileInput = this.page.locator('input[type="file"]');
      await fileInput.waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get avatar upload error message if any
   */
  async getUploadError(): Promise<string | null> {
    try {
      const errorElement = this.page.locator('[role="alert"]').or(
        this.page.locator('[data-testid="upload-error"]')
      );

      if (await errorElement.isVisible({ timeout: 1000 })) {
        const errorText = await errorElement.textContent();
        return errorText?.trim() || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Complete avatar upload workflow (upload + save)
   * @param filePath - Absolute path to image file
   */
  async uploadAndSaveAvatar(filePath: string) {
    await this.uploadAvatar(filePath);
    await this.waitForPreview();
    await this.saveAvatar();
  }

  /**
   * Check if current avatar exists
   */
  async hasCurrentAvatar(): Promise<boolean> {
    try {
      const avatarImage = this.page.locator('[data-testid="current-avatar"]').or(
        this.page.locator('img[alt*="avatar" i]')
      );
      await avatarImage.waitFor({ state: 'visible', timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current avatar src URL
   */
  async getAvatarSrc(): Promise<string | null> {
    try {
      const avatarImage = this.page.locator('[data-testid="current-avatar"]').or(
        this.page.locator('img[alt*="avatar" i]')
      ).first();

      return await avatarImage.getAttribute('src');
    } catch {
      return null;
    }
  }
}
