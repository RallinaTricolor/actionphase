import type { components } from './api.gen';

/**
 * Generated from the OpenAPI spec (`just gen-api-types`).
 *
 * context_type/context_id are the CONTAINER (marking read clears every sibling
 * sharing the context); related_type/related_id are the item itself, for the
 * preview. The distinction is load-bearing and easy to invert -- see the schema
 * docs on NotificationResponse.
 */
export type Notification = components['schemas']['NotificationResponse'];

export interface NotificationListResponse {
  data: Notification[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export type UnreadCountResponse = components['schemas']['UnreadCountResponse'];

export type MarkAllReadResponse = components['schemas']['MarkAllReadResponse'];

export interface GetNotificationsParams {
  limit?: number;
  offset?: number;
  unread?: boolean;
}
