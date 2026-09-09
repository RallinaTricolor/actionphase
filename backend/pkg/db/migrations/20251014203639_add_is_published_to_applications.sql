-- +goose Up
-- Add is_published column to track if application status has been published to the applicant
ALTER TABLE game_applications
ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT FALSE;

-- Applications are only published when the GM closes recruitment
-- Until then, applicants see "pending" regardless of actual status

-- +goose Down
-- Remove is_published column
ALTER TABLE game_applications
DROP COLUMN is_published;
