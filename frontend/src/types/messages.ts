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
