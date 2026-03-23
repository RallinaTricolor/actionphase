-- Add activated_at to track when a phase was manually or automatically activated.
-- Used by the scheduler to detect whether a human manually activated a phase
-- after a scheduled phase's start_time, preventing silent scheduler overrides.
ALTER TABLE game_phases ADD COLUMN activated_at TIMESTAMP WITH TIME ZONE;
