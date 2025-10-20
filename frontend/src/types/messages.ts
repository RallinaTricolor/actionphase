// Message/Post types for Common Room

export interface Message {
  id: number;
  game_id: number;
  phase_id?: number;
  author_id: number;
  character_id: number;
  content: string;
  message_type: 'post' | 'comment' | 'private_message';
  parent_id?: number;
  thread_depth: number;
  author_username: string;
  character_name: string;
  character_avatar_url?: string | null;
  comment_count?: number;
  reply_count?: number;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  mentioned_character_ids?: number[];
}

export interface CreatePostRequest {
  phase_id?: number;
  character_id: number;
  content: string;
}

export interface CreateCommentRequest {
  phase_id?: number;
  character_id: number;
  content: string;
}

export interface GetPostsParams {
  phase_id?: number;
  limit?: number;
  offset?: number;
}

// Read tracking types
export interface ReadMarker {
  id: number;
  user_id: number;
  game_id: number;
  post_id: number;
  last_read_comment_id?: number | null;
  last_read_at: string;
  created_at: string;
  updated_at: string;
}

export interface PostUnreadInfo {
  post_id: number;
  post_created_at: string;
  total_comments: number;
  latest_comment_at?: string | null;
}

export interface MarkPostReadRequest {
  last_read_comment_id?: number | null;
}

// Unread comment IDs for posts (new since last visit)
export interface PostUnreadComments {
  post_id: number;
  unread_comment_ids: number[];
}
