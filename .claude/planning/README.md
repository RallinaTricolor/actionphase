# Planning Directory

This directory contains persistent planning documents that survive across AI sessions.

## Current Planning Documents

- **[MVP_STATUS.md](completed/MVP_STATUS.md)** - Current MVP implementation status, completed features, recent work, and post-MVP roadmap (living document)
- **[MVP_DEVELOPMENT_PLAN.md](completed/MVP_DEVELOPMENT_PLAN.md)** - Original phase-by-phase development roadmap (historical reference)
- **[FEATURE_PLAN_TEMPLATE.md](FEATURE_PLAN_TEMPLATE.md)** - Comprehensive template for planning new features (use as base for new plans)
- **[USING_FEATURE_TEMPLATE.md](USING_FEATURE_TEMPLATE.md)** - Detailed guide on how to effectively use the feature planning template

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

**Active Plans** (in this directory):
- `FEATURE_<name>.md` - Feature implementation plans (in progress)
- `REFACTOR_<name>.md` - Refactoring plans and progress
- `TESTING_<area>.md` - Test coverage improvement plans
- `EXPLORATION_<topic>.md` - Architectural exploration notes
- `TODO_<category>.md` - Categorized task lists

**Completed Plans** (`planning/completed/`):
- Move plans here when feature/task is complete
- Preserves historical context for future reference
- E2E_TESTING_PLAN.md - Original E2E testing implementation plan
- AI_E2E_TESTING_STRATEGY.md - Comprehensive E2E testing strategy for AI development

## Using the Feature Plan Template

**When starting a new feature:**

1. Copy `FEATURE_PLAN_TEMPLATE.md` to a new file: `FEATURE_[name].md`
2. Fill in all sections systematically from top to bottom
3. Delete sections that aren't relevant (e.g., if no database changes, remove schema section)
4. Work through implementation phases in order
5. Update session log after each coding session
6. Move to `planning/completed/` when complete

**Template Benefits:**
- ✅ Ensures all architectural aspects considered (database, API, frontend, tests)
- ✅ Defines success criteria before coding
- ✅ Documents business rules and edge cases
- ✅ Includes comprehensive test planning
- ✅ Provides rollback strategy
- ✅ Maintains session continuity across AI sessions

**Example**: See `FEATURE_PLAN_TEMPLATE.md` for complete structure

## Maintenance

- Update plans at the end of each session
- Move completed plans to `planning/completed/` to keep this directory clean
- Reference related docs in `/docs/` and `.claude/context/`
- Keep plans concise and actionable
- Document learnings in `.claude/reference/` (e.g., E2E_TESTING_LEARNINGS_CODIFIED.md)
