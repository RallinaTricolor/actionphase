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
 * POST /auth/login — generated.
 *
 * `password` is required. `username` and `email` are each optional because
 * there are two fields for one value: the route takes an identifier in either,
 * preferring `email`, and treats a `username` containing "@" as an email. The
 * server rejects a request with neither -- a rule JSON Schema cannot express
 * per-field, and the one part of this contract types do not carry.
 *
 * The hand-written predecessor declared `username: string` and omitted `email`
 * entirely, so the email login path the backend supports was unreachable from
 * typed client code.
 */
export type LoginRequest = components['schemas']['LoginBody'];

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
