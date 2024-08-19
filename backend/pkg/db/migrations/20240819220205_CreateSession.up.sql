CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  expires TIMESTAMP NOT NULL,
  user_id INTEGER NOT NULL,
  data TEXT
);

ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id);
