DROP INDEX IF EXISTS users_email_index;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
