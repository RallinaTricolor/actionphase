-- +goose Up
ALTER TABLE games
  ADD COLUMN common_room_open_day   SMALLINT,
  ADD COLUMN common_room_open_time  TIME,
  ADD COLUMN common_room_close_day  SMALLINT,
  ADD COLUMN common_room_close_time TIME,
  ADD COLUMN schedule_timezone      VARCHAR(64);

-- +goose Down
ALTER TABLE games
  DROP COLUMN common_room_open_day,
  DROP COLUMN common_room_open_time,
  DROP COLUMN common_room_close_day,
  DROP COLUMN common_room_close_time,
  DROP COLUMN schedule_timezone;
