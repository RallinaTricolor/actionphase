export interface User {
  id: number;
  username: string;
  email: string;
  email_verified?: boolean;
  password?: string;
  bio?: string | null;
  avatar_url?: string | null;
  is_admin?: boolean;
  is_banned?: boolean;
  pending_approval?: boolean;
  createdAt?: string;
}

import type { components } from './api.gen';

/**
 * NOT generated, deliberately. LoginBody types both `username` and `password`
 * as optional, because the route accepts either a username or an email. That is
 * honest about the wire format but useless as a client contract: a payload with
 * no password would type-check. The hand-written type stays narrower.
 */
export interface LoginRequest {
  username: string;
  password: string;
  fingerprint?: string;
}

/**
 * POST /auth/register — generated from the OpenAPI spec (`just gen-api-types`),
 * so an unknown property is a build failure rather than a 422 at runtime.
 */
export type RegisterRequest = components['schemas']['RegisterBody'];

export interface AuthResponse {
  user?: User;
  Token: string; // Backend uses capital T
  token?: string; // Keep lowercase for backward compatibility
}

/** POST /auth/change-password — generated, as above. */
export type ChangePasswordRequest = components['schemas']['ChangePasswordRequest'];

export interface ChangePasswordResponse {
  message: string;
}

interface Session {
  id: number;
  created_at: string;
  expires: string;
  is_current: boolean;
}

export interface SessionsListResponse {
  sessions: Session[];
}
