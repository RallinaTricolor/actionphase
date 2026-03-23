-- Add index to efficiently query scheduled phases that are ready to activate
CREATE INDEX IF NOT EXISTS idx_game_phases_scheduled_activation
    ON game_phases (start_time, is_active)
    WHERE is_active = false AND start_time IS NOT NULL;
