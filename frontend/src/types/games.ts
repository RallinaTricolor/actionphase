export interface Game {
  id: number;
  title: string;
  description: string;
  gm_user_id: number;
  state: GameState;
  genre?: string;
  start_date?: string;
  end_date?: string;
  recruitment_deadline?: string;
  max_players?: number;
  is_anonymous?: boolean;
  created_at: string;
  updated_at: string;
}

export interface GameWithDetails extends Game {
  gm_username?: string;
  current_players: number;
}

export interface GameListItem extends Game {
  gm_username: string;
  current_players?: number;
}

export interface GameParticipant {
  id: number;
  game_id: number;
  user_id: number;
  username: string;
  email: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joined_at: string;
}

export type GameState =
  | 'setup'
  | 'recruitment'
  | 'character_creation'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type ParticipantRole = 'player' | 'co_gm' | 'audience';
export type ParticipantStatus = 'active' | 'inactive' | 'removed';

export interface CreateGameRequest {
  title: string;
  description: string;
  genre?: string;
  start_date?: string;
  end_date?: string;
  recruitment_deadline?: string;
  max_players?: number;
  is_anonymous?: boolean;
}

export interface UpdateGameRequest extends CreateGameRequest {
  is_public: boolean;
  is_anonymous?: boolean;
}

export interface ApplyToGameRequest {
  role: 'player' | 'audience';
  message?: string;
}

export interface GameApplication {
  id: number;
  game_id: number;
  user_id: number;
  username?: string;
  email?: string;
  role: 'player' | 'audience';
  message?: string;
  status: ApplicationStatus;
  applied_at: string;
  reviewed_at?: string;
  reviewed_by_user_id?: number;
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export interface ReviewApplicationRequest {
  action: 'approve' | 'reject';
}

export interface UpdateGameStateRequest {
  state: GameState;
}

export const GAME_STATE_LABELS: Record<GameState, string> = {
  setup: 'Setup',
  recruitment: 'Recruiting Players',
  character_creation: 'Character Creation',
  in_progress: 'In Progress',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const GAME_STATE_COLORS: Record<GameState, string> = {
  setup: 'bg-gray-100 text-gray-800',
  recruitment: 'bg-green-100 text-green-800',
  character_creation: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  paused: 'bg-orange-100 text-orange-800',
  completed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800'
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-800'
};
