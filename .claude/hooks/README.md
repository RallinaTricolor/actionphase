# ActionPhase Claude Code Hooks

This directory contains hooks that enhance Claude Code's capabilities for the ActionPhase project.

## Installed Hooks

### 1. Skill Activation Prompt (`skill-activation-prompt`)
**Trigger:** UserPromptSubmit
**Purpose:** Auto-suggests relevant skills based on your prompts

When you type a prompt, this hook analyzes it and suggests relevant skills like:
- `backend-dev-guidelines` - For Go backend work with Chi router
- `frontend-dev-guidelines` - For React/TypeScript frontend work
- `game-phase-management` - For phase service patterns
- `character-management` - For character workflows
- `messaging-system` - For chat/messaging features
- `test-fixtures` - For E2E test data management
- `database-operations` - For migrations and sqlc queries
- `authentication` - For JWT auth patterns

The hook works from any directory within the project by automatically finding the project root.

### 2. Post Tool Use Tracker (`post-tool-use-tracker`)
**Trigger:** PostToolUse (Edit|MultiEdit|Write)
**Purpose:** Tracks file changes for context management and build command caching

When you edit files, this hook:
- Tracks which parts of the codebase were modified (frontend/backend)
- Stores appropriate build commands for later use
- Creates a cache in `.claude/tsc-cache/{session_id}/`

### 3. ActionPhase Build Check (`actionphase-build-check`)
**Trigger:** Stop
**Purpose:** Checks for compilation errors before ending the session

When a Claude Code session ends, this hook:
- **Frontend checks:**
  - Runs TypeScript compilation check (`tsc --noEmit`)
  - Runs npm build to catch any build errors
- **Backend checks:**
  - Runs Go build to catch compilation errors
  - Runs `go vet` for additional static analysis
- Only checks parts that were actually edited in the session

## Directory Structure

```
.claude/hooks/
├── README.md                           # This file
├── package.json                        # Node dependencies
├── skill-activation-prompt.sh          # Shell wrapper for skill activation
├── skill-activation-prompt.ts          # TypeScript skill activation logic
├── post-tool-use-tracker.sh           # File tracking hook (customized for ActionPhase)
├── actionphase-build-check.sh         # Build verification (Go + TypeScript)
├── tsc-check.sh                       # Original TypeScript check (not used)
└── stop-build-check-enhanced.sh       # Original build check (not used)
```

## Skills Configuration

Skills are configured in `.claude/skills/skill-rules.json` with:
- Prompt triggers (keywords and intent patterns)
- File triggers (path patterns and content patterns)
- ActionPhase-specific domains (phases, characters, messaging, etc.)

## Cache Management

The hooks create a cache directory at `.claude/tsc-cache/{session_id}/` containing:
- `edited-files.log` - Timestamped log of edited files
- `affected-repos.txt` - List of affected components (frontend/backend)
- `commands.txt` - Build commands for affected components

## Testing Hooks

To test hooks manually:

```bash
# Test skill activation
echo '{"prompt": "I need to add a new API endpoint"}' | \
  npx tsx .claude/hooks/skill-activation-prompt.ts

# Test file tracking (requires CLAUDE_PROJECT_DIR)
export CLAUDE_PROJECT_DIR=/Users/jhouser/Personal/actionphase
echo '{"tool_name": "Edit", "tool_input": {"file_path": "/path/to/file.tsx"}, "session_id": "test"}' | \
  ./.claude/hooks/post-tool-use-tracker.sh

# Test build check
echo '{"session_id": "test"}' | \
  ./.claude/hooks/actionphase-build-check.sh
```

## Troubleshooting

### Hooks not triggering
- Check that hooks are configured in `.claude/settings.local.json`
- Verify scripts have execute permissions: `chmod +x .claude/hooks/*.sh`

### Build check errors
- Frontend: Ensure you're in the project root and dependencies are installed
- Backend: Ensure Go modules are up to date (`go mod tidy`)

### Skill suggestions not appearing
- Check that `.claude/skills/skill-rules.json` exists
- Verify the skill-activation-prompt hook is properly configured

## Disabling Hooks

To temporarily disable hooks, remove or comment out the `"hooks"` section in `.claude/settings.local.json`.

To permanently remove hooks:
```bash
# Remove hooks configuration from settings
# Then delete the hooks directory
rm -rf .claude/hooks
rm -rf .claude/tsc-cache
```
