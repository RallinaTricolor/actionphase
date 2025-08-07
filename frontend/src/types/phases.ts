export interface GamePhase {
  id: number;
  game_id: number;
  phase_type: 'common_room' | 'action' | 'results';
  phase_number: number;
  start_time: string;
  end_time?: string;
  deadline?: string;
  is_active: boolean;
  created_at: string;

  // Calculated fields from API
  time_remaining?: number; // seconds until deadline
  is_expired?: boolean;
}

export interface CreatePhaseRequest {
  phase_type: 'common_room' | 'action' | 'results';
  start_time?: string;
  end_time?: string;
  deadline?: string;
}

export interface UpdateDeadlineRequest {
  deadline: string;
}

export interface ActionSubmission {
  id: number;
  game_id: number;
  user_id: number;
  phase_id: number;
  character_id?: number;
  content: string;
  submitted_at: string;
  updated_at: string;
}

export interface ActionSubmissionRequest {
  character_id?: number;
  content: string;
}

export interface ActionWithDetails extends ActionSubmission {
  username?: string;
  character_name?: string;
  phase_type?: string;
  phase_number?: number;
}

export interface ActionResult {
  id: number;
  game_id: number;
  user_id: number;
  phase_id: number;
  gm_user_id: number;
  content: string;
  sent_at: string;
  phase_type?: string;
  phase_number?: number;
  gm_username?: string;
}

// Phase display helpers
export const PHASE_TYPE_LABELS: Record<GamePhase['phase_type'], string> = {
  common_room: 'Common Room',
  action: 'Action Phase',
  results: 'Results'
};

export const PHASE_TYPE_DESCRIPTIONS: Record<GamePhase['phase_type'], string> = {
  common_room: 'Open discussion and roleplay between characters',
  action: 'Submit private actions to the GM',
  results: 'GM publishes results and consequences'
};

export const PHASE_TYPE_COLORS: Record<GamePhase['phase_type'], string> = {
  common_room: 'bg-green-100 text-green-800 border-green-200',
  action: 'bg-blue-100 text-blue-800 border-blue-200',
  results: 'bg-purple-100 text-purple-800 border-purple-200'
};
