-- Create table for draft character updates tied to action results
CREATE TABLE action_result_character_updates (
    id SERIAL PRIMARY KEY,
    action_result_id INTEGER NOT NULL,
    character_id INTEGER NOT NULL,
    module_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT,
    field_type VARCHAR(20) NOT NULL DEFAULT 'text',
    operation VARCHAR(20) NOT NULL DEFAULT 'upsert',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Foreign key constraints with CASCADE delete
    CONSTRAINT fk_action_result_character_updates_result
        FOREIGN KEY (action_result_id)
        REFERENCES action_results(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_action_result_character_updates_character
        FOREIGN KEY (character_id)
        REFERENCES characters(id)
        ON DELETE CASCADE,

    -- Check constraints for valid enum values
    CONSTRAINT check_module_type
        CHECK (module_type IN ('abilities', 'skills', 'inventory', 'currency')),

    CONSTRAINT check_field_type
        CHECK (field_type IN ('text', 'number', 'boolean', 'json')),

    CONSTRAINT check_operation
        CHECK (operation IN ('upsert', 'delete'))
);

-- Index for fast lookup of drafts by action result
CREATE INDEX idx_action_result_character_updates_result_id
    ON action_result_character_updates(action_result_id);

-- Index for fast lookup of drafts by character (for conflict detection)
CREATE INDEX idx_action_result_character_updates_character_id
    ON action_result_character_updates(character_id);

-- Unique constraint: one draft per field per result (enables upsert behavior)
CREATE UNIQUE INDEX idx_action_result_character_updates_unique_field
    ON action_result_character_updates(action_result_id, character_id, module_type, field_name);

-- Comment explaining the table's purpose
COMMENT ON TABLE action_result_character_updates IS
    'Draft character sheet updates tied to unpublished action results. Drafts are copied to character_data when the result publishes, then deleted.';
