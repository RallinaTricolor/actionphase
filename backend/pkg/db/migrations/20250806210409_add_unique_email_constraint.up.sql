ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
CREATE INDEX users_email_index ON users (email);
