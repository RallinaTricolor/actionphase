# Planning Directory

This directory contains persistent planning documents that survive across AI sessions.

## Current Planning Documents

- **[MVP_STATUS.md](MVP_STATUS.md)** - Current MVP implementation status, completed features, recent work, and post-MVP roadmap (living document)
- **[MVP_DEVELOPMENT_PLAN.md](MVP_DEVELOPMENT_PLAN.md)** - Original phase-by-phase development roadmap (historical reference)

## Purpose

The planning directory serves as a workspace for:
- **Multi-session implementation plans** - Track complex features across multiple coding sessions
- **Feature roadmaps** - Document planned features and their dependencies
- **Task lists** - Maintain TODO lists for ongoing work
- **Design explorations** - Keep notes on architectural decisions and alternatives considered
- **Session continuity** - Provide context for picking up where previous sessions left off

## When to Use

Create planning documents when:
- Working on features that span multiple sessions
- Implementing complex features with multiple phases
- Exploring architectural decisions that need documentation
- Tracking progress on large refactors or migrations
- Planning test coverage improvements

## File Organization

Suggested naming conventions:
- `FEATURE_<name>.md` - Feature implementation plans
- `REFACTOR_<name>.md` - Refactoring plans and progress
- `TESTING_<area>.md` - Test coverage improvement plans
- `EXPLORATION_<topic>.md` - Architectural exploration notes
- `TODO_<category>.md` - Categorized task lists

## Example Structure

```markdown
# Feature: User Notifications

## Status: In Progress (2/4 phases complete)

## Overview
Brief description of the feature and its goals.

## Phases
- [x] Phase 1: Database schema and migrations
- [x] Phase 2: Backend API endpoints
- [ ] Phase 3: Frontend UI components
- [ ] Phase 4: WebSocket real-time updates

## Current Session Goals
What to accomplish in the current session.

## Next Steps
What comes after current session.

## Decisions Made
Key decisions and their rationale.

## Open Questions
Items that need resolution.
```

## Maintenance

- Update plans at the end of each session
- Archive completed plans to `planning/archive/` (create as needed)
- Reference related docs in `/docs/` and `.claude/context/`
- Keep plans concise and actionable
