import { apiClient } from '../lib/api';
import type { Message } from '../types/messages';

/**
 * Fetch a comment with its parent chain context (up to N levels)
 * Walks up the parent chain by fetching each parent message
 * Returns messages in parent-to-child order (oldest → target)
 */
export async function fetchCommentWithParents(
  gameId: number,
  commentId: number,
  maxDepth: number = 3
): Promise<{ messages: Message[]; hasFullThread: boolean }> {
  const messages: Message[] = [];
  let currentId: number | undefined = commentId;
  let depth = 0;

  // Fetch the target comment and walk up the parent chain
  while (currentId && depth <= maxDepth) {
    try {
      const response = await apiClient.messages.getMessage(gameId, currentId);
      const message = response.data;

      // Prepend to array to maintain parent-to-child order
      messages.unshift(message);

      // Move to parent
      currentId = message.parent_id;
      depth++;
    } catch (error) {
      console.error(`Failed to fetch message ${currentId}:`, error);
      break;
    }
  }

  // hasFullThread = true if we reached a post (no parent) or hit max depth without finding root
  const hasFullThread = messages.length > 0 && !messages[0].parent_id;

  return { messages, hasFullThread };
}
