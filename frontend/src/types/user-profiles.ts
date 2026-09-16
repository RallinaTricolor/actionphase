/**
 * User Profile Types
 *
 * These types match the backend API response structure for user profiles,
 * game history, and profile updates.
 */

import type { components } from './api.gen';

/**
 * User profile information. Generated.
 */
export type UserProfile = components['schemas']['UserProfile'];

/**
 * Game in user's game history. Generated.
 *
 * `state` carries the GameState enum rather than a bare string, and
 * `characters` is non-nullable -- an anonymous game yields an empty array, not
 * null.
 */
export type UserGame = components['schemas']['UserGame'];

/**
 * Pagination metadata for user game history. Generated.
 */
export type UserGameHistoryMetadata = components['schemas']['UserGameHistoryMetadata'];

/**
 * Complete user profile response from API. Generated.
 */
export type UserProfileResponse = components['schemas']['UserProfileResponse'];

/**
 * PATCH /users/me/profile — generated from the OpenAPI spec
 * (`just gen-api-types`), so an unknown property is a build failure rather than
 * a 422 at runtime. The schema is named UpdateProfileBody after the Go struct.
 */
export type UpdateUserProfileRequest = components['schemas']['UpdateProfileBody'];

/**
 * Response from avatar upload. Generated.
 */
export type UploadAvatarResponse = components['schemas']['UploadAvatarResponse'];
