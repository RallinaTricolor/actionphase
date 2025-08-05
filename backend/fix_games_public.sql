-- Update all games to be public since we removed the public/private concept
UPDATE games SET is_public = true WHERE is_public = false;
