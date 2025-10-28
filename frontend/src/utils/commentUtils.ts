import type { Message } from '../types/messages';

/**
 * Gets the root post ID for a message
 * - For posts (thread_depth === 0), returns the message ID itself
 * - For direct comments (thread_depth === 1), returns the parent_id
 * - For nested comments (thread_depth > 1), returns the parent_id as a best effort
 *   (Note: This may not be accurate for deeply nested comments without traversing the chain)
 */
export function getRootPostId(message: Message): number {
  if (message.message_type === 'post' || message.thread_depth === 0) {
    // This IS the post
    return message.id;
  }

  if (message.parent_id) {
    if (message.thread_depth === 1) {
      // Direct comment on post - parent_id IS the post
      return message.parent_id;
    }

    // For nested comments (thread_depth > 1), we return parent_id as best effort
    // This may not be the root post, but it's better than using comment.id
    // TODO: Consider adding root_post_id to backend Message type for accuracy
    return message.parent_id;
  }

  // Fallback: return the message ID (shouldn't happen for valid comments)
  console.warn(`Unable to determine root post ID for message ${message.id}, using message ID as fallback`);
  return message.id;
}
