import { BaseApiClient } from './client';
import type {
  UserProfileResponse,
  UpdateUserProfileRequest,
  UploadAvatarResponse,
} from '../../types/user-profiles';

/**
 * User Profiles API client
 * Handles user profile viewing, editing, and avatar management
 */
export class UsersApi extends BaseApiClient {
  /**
   * Get a user's profile by username with optional pagination
   * @param username - The username to fetch
   * @param page - Page number (1-indexed, default: 1)
   * @param pageSize - Items per page (default: 12)
   * @returns User profile with paginated game history and metadata
   */
  async getUserProfile(username: string, page: number = 1, pageSize: number = 12) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());

    return this.client.get<UserProfileResponse>(
      `/api/v1/users/username/${username}/profile?${params.toString()}`
    );
  }

  /**
   * Update the authenticated user's profile
   * @param data - Profile fields to update (display_name, bio)
   * @returns Updated user profile
   */
  async updateUserProfile(data: UpdateUserProfileRequest) {
    return this.client.patch<UserProfileResponse>('/api/v1/users/me/profile', data);
  }

  /**
   * Upload an avatar for the authenticated user
   * @param file - Image file (JPEG, PNG, or WebP, max 5MB)
   * @returns Avatar URL
   */
  async uploadUserAvatar(file: File) {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.client.post<UploadAvatarResponse>('/api/v1/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Delete the authenticated user's avatar
   */
  async deleteUserAvatar() {
    return this.client.delete<{ message: string }>('/api/v1/users/me/avatar');
  }
}
