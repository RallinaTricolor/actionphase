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

/**
 * POST /auth/login — generated. A bare token, nothing else.
 *
 * This and RegisterResponse replace one hand-written `AuthResponse` that typed
 * both endpoints, and described neither. Login has never returned anything but
 * `Token`, so the type's `user?: User` was unreachable on this route.
 */
export type LoginResponse = components['schemas']['TokenOnlyBody'];

/**
 * POST /auth/register, 201 — generated. The created user, flat, plus a token.
 *
 * Not nested under a `user` key: the endpoint returns the user object itself
 * with `Token` alongside its columns. The old `AuthResponse.user?: User` implied
 * a wrapper the server has never sent, and nothing read it.
 *
 * `token` (lowercase) is gone too. It was carried "for backward compatibility"
 * and read as `data.Token || data.token`, but no auth endpoint has ever sent
 * that spelling — the only lowercase `token` fields belong to password-reset
 * and email-verification payloads on other routes. The fallback never fired.
 */
export type RegisterCreatedResponse = components['schemas']['AuthUser'];

/**
 * What `POST /auth/register` may answer with, discriminated by HTTP status.
 *
 * The 202 arm is the pending-approval notice, sent instead of the user when the
 * instance requires admin approval of new accounts. It is shaped like an error
 * (`{status, error}`) despite nothing having failed, because the chi handler
 * rendered core.ErrResponse on this path; preserved as-is, since it is the wire
 * format.
 *
 * The two shapes share no fields, so callers MUST discriminate before reading
 * the body — which is what RegisterForm already does via the HTTP status. The
 * union makes that check load bearing instead of incidental: reading `.Token`
 * off it is now a compile error until the 202 case is excluded.
 */
export type RegisterResponse =
  | RegisterCreatedResponse
  | components['schemas']['PendingApprovalBody'];

/**
 * Narrows a register body to the 201 shape.
 *
 * The HTTP status is the real discriminator, but it lives on the axios response
 * rather than in the body, so TypeScript cannot use it to narrow `data`. This
 * checks the body itself: `Token` exists only on the created-user shape, and
 * the 202 notice carries neither it nor any other field in common.
 */
export function isRegisterCreated(
  body: RegisterResponse
): body is RegisterCreatedResponse {
  return 'Token' in body;
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
