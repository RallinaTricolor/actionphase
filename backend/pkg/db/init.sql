-- Initialize ActionPhase database
-- This script runs when the PostgreSQL container first starts

-- The POSTGRES_DB environment variable already creates the 'actionphase' database
-- This file is here for any additional initialization if needed in the future

-- Create extension for UUID generation if needed
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Migrations will be run by the backend application on startup
