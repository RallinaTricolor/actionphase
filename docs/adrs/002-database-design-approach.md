# ADR-002: Database Design Approach

## Status
Accepted

## Context
ActionPhase requires a database design that can handle:
- Complex game state with nested data structures
- Character sheets with variable schemas depending on game system
- Phase-based gameplay with temporal data
- User management and session tracking
- Performance for concurrent users
- Flexibility for future game system additions

The decision needed to balance between structured relational data and flexible document storage.

## Decision
We adopted a **Hybrid Relational-Document approach** using PostgreSQL with strategic JSONB usage:

**Core Entities**: Traditional relational tables
- Users, Games, Characters, Phases, Applications - structured as normalized tables
- Foreign key relationships for data integrity
- Proper indexing for query performance

**Flexible Data**: JSONB columns for variable schema data
- Character data sheets in `character_data` JSONB column
- Game-specific configuration in `game_config` JSONB column
- Action submissions in `action_data` JSONB column
- Notification preferences in `preferences` JSONB column

**Schema Management**: golang-migrate for version control
- All schema changes tracked in migration files
- Up/down migrations for rollback capability
- Environment-specific migration control

## Alternatives Considered

### 1. Pure Relational Approach
**Approach**: Traditional normalized relational schema with separate tables for all entities.

**Pros**:
- Strong consistency and ACID compliance
- Excellent query performance for structured data
- Clear data relationships and constraints
- Familiar to most developers

**Cons**:
- Inflexible for variable character sheet schemas
- Complex joins for game-specific data
- Difficult to add new game systems without schema changes
- Over-normalization leading to query complexity

### 2. Pure Document Approach (MongoDB)
**Approach**: Store all game data as nested JSON documents.

**Pros**:
- Maximum flexibility for game data structures
- Easy to add new game systems
- Natural fit for nested character data
- No impedance mismatch with JSON APIs

**Cons**:
- Limited transaction support across documents
- Eventual consistency issues
- Less mature query capabilities
- Difficult to maintain referential integrity

### 3. EAV (Entity-Attribute-Value) Pattern
**Approach**: Generic key-value storage for flexible attributes.

**Pros**:
- Flexible schema evolution
- Supports arbitrary attributes
- Relational database benefits

**Cons**:
- Poor query performance
- Complex queries for simple operations
- Loss of type safety
- Difficult to maintain and understand

## Consequences

### Positive Consequences

**Data Integrity**:
- Strong ACID guarantees for critical game state
- Foreign key constraints prevent orphaned records
- Transaction support for multi-table operations

**Performance**:
- Optimized queries for structured data access patterns
- JSONB indexing for efficient document queries
- Connection pooling for concurrent access

**Flexibility**:
- JSONB allows arbitrary character sheet schemas
- Easy addition of new game systems without migrations
- Support for complex nested data structures

**Developer Experience**:
- sqlc generates type-safe Go code for structured queries
- Familiar SQL for complex relational queries
- JSON handling for document-style operations

### Negative Consequences

**Complexity**:
- Developers need to understand both relational and document patterns
- Query complexity varies between structured and document data
- Mixed paradigms can be confusing for new team members

**Schema Evolution**:
- JSONB schema changes require application-level validation
- No automatic migration for document structure changes
- Potential for inconsistent document schemas over time

**Query Limitations**:
- Complex JSONB queries can be less readable than SQL
- Limited aggregation capabilities for nested document data
- Indexing strategy becomes more complex

### Migration Strategy

**Existing Data**:
- No breaking changes to current schema
- Additive JSONB columns to existing tables
- Gradual migration of flexible data to JSONB

**Future Considerations**:
- Document schema versioning strategy needed
- JSONB query performance monitoring
- Potential extraction of frequently-queried JSONB fields to columns

## Implementation Details

### Core Tables Structure
```sql
-- Users: Traditional relational
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games: Mixed structured and flexible
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    gm_user_id INTEGER REFERENCES users(id),
    state VARCHAR(20) NOT NULL DEFAULT 'setup',
    game_config JSONB DEFAULT '{}',  -- Game system rules, settings
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Characters: Structured metadata, flexible data
CREATE TABLE characters (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    character_data JSONB NOT NULL DEFAULT '{}',  -- Character sheet data
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### JSONB Usage Patterns
```sql
-- Character sheet queries
SELECT character_data->>'class' as character_class,
       character_data->'stats'->>'strength' as strength
FROM characters
WHERE game_id = $1;

-- Game configuration queries
SELECT game_config->'rules'->'dice_system' as dice_system
FROM games
WHERE id = $1;

-- Index creation for JSONB fields
CREATE INDEX idx_character_data_class ON characters
USING gin ((character_data->>'class'));

CREATE INDEX idx_game_config_system ON games
USING gin ((game_config->>'system'));
```

### Data Validation Strategy
- **Application Layer**: Validate JSONB structure before database insert
- **JSON Schema**: Define schemas for common JSONB document types
- **Database Constraints**: Use CHECK constraints for critical JSONB fields
- **Migration Scripts**: Transform JSONB data when document schemas evolve

## References
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [JSONB Indexing Strategies](https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING)
- [golang-migrate Documentation](https://github.com/golang-migrate/migrate)
- [sqlc JSONB Support](https://docs.sqlc.dev/en/latest/howto/query-json.html)
