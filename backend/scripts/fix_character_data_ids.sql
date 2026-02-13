-- Script to find and identify corrupted character data (missing ID fields)
-- This detects data corruption caused by draft merge bugs
-- DO NOT run this automatically - it's for diagnostic purposes only

-- Find ALL corrupted character data across ALL module types
-- Items missing ID field in currency, items, abilities, or skills
SELECT
  cd.character_id,
  c.name AS character_name,
  cd.module_type || '.' || cd.field_name AS data_type,
  jsonb_array_length(cd.field_value::jsonb) AS item_count,
  cd.field_value
FROM character_data cd
JOIN characters c ON c.id = cd.character_id
WHERE
  cd.field_type = 'json'
  AND cd.field_value != 'null'
  AND cd.field_value::jsonb <> '[]'::jsonb  -- Not empty array
  AND (
    -- Check for arrays with objects that don't have id field
    cd.field_value::jsonb @> '[{}]'::jsonb  -- Has at least one object
    AND NOT (
      -- Check if ALL objects have id field
      (
        SELECT bool_and(obj ? 'id')
        FROM jsonb_array_elements(cd.field_value::jsonb) AS obj
      )
    )
  )
ORDER BY cd.character_id, cd.module_type, cd.field_name;

-- Count of corrupted entries by module type
SELECT
  cd.module_type || '.' || cd.field_name AS data_type,
  COUNT(*) AS corrupted_characters,
  SUM(jsonb_array_length(cd.field_value::jsonb)) AS total_corrupted_items
FROM character_data cd
WHERE
  cd.field_type = 'json'
  AND cd.field_value != 'null'
  AND cd.field_value::jsonb <> '[]'::jsonb
  AND (
    cd.field_value::jsonb @> '[{}]'::jsonb
    AND NOT (
      SELECT bool_and(obj ? 'id')
      FROM jsonb_array_elements(cd.field_value::jsonb) AS obj
    )
  )
GROUP BY cd.module_type, cd.field_name
ORDER BY cd.module_type, cd.field_name;

-- MANUAL FIX INSTRUCTIONS:
-- 1. Identify affected characters from the query above
-- 2. For each affected character, the frontend will automatically generate IDs on next load
-- 3. OR: Use backend code to regenerate IDs and update character_data table
-- 4. Verify fix by running the first query again (should return 0 rows)

-- Example manual fix for a specific character (replace character_id and adjust as needed):
-- UPDATE character_data
-- SET field_value = (
--   SELECT jsonb_agg(
--     item || jsonb_build_object('id', gen_random_uuid()::text)
--   )
--   FROM jsonb_array_elements(field_value::jsonb) AS item
-- )
-- WHERE character_id = 'YOUR_CHARACTER_ID'
--   AND module_type = 'currency'
--   AND field_name = 'currency';
