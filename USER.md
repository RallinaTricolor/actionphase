# USER.md - Guide for Writing Effective Prompts to Claude

## 🎯 Key Principles for Effective Prompts

### 1. Be Explicit About Debugging
Instead of: "The test is failing"
Write: "The test is failing with error X. Use Playwright MCP to debug by navigating to the page and manually testing the flow"

### 2. Set Clear Boundaries
Instead of: "Implement these 10 features"
Write: "Implement these 3 features first: [A, B, C]. We'll do the others later"

### 3. Specify Expected Behavior
Instead of: "Fix the comment system"
Write: "Fix the comment system - nested replies should load when the page loads, not require clicking"

### 4. Include Success Criteria
Instead of: "Make the tests pass"
Write: "Make the tests pass AND verify the feature works manually using Playwright MCP"

## 🚀 Prompt Templates

### For Bug Fixes:
```
BUG: [Description]
EXPECTED: [What should happen]
ACTUAL: [What happens now]
REPRO STEPS:
1. [Step 1]
2. [Step 2]

Use Playwright MCP to verify the issue before making code changes.
```

### For E2E Test Failures:
```
E2E test [test name] is failing.
Error: [paste error]
Screenshot: [attach if available]

Debug using Playwright MCP first - do NOT modify test until you verify whether the feature works manually.
```

### For Feature Implementation:
```
Implement [feature name]
Requirements:
- [Requirement 1]
- [Requirement 2]

Start with backend, then frontend, then E2E test.
Use TodoWrite to track sub-tasks.
Maximum 3 features at once.
```

## ⚠️ Anti-Patterns to Avoid

### ❌ DON'T: Vague Instructions
- "Fix the issues"
- "Make it better"
- "Debug this"

### ❌ DON'T: Assume Claude Remembers Context
- "Continue with the next feature" (specify which)
- "Fix the other bug too" (describe it)

### ❌ DON'T: Skip Verification Steps
- "Just update the test to match"
- "Increase the timeout"
- "Skip the failing test"

## ✅ DO: Provide Complete Context

### Include:
1. Current working directory expectation
2. Which user to test as
3. Expected vs actual behavior
4. Any recent changes that might be related

### Example of a Good Prompt:
```
Working in /frontend directory.
The nested comment replies aren't loading for Player 2 after page refresh.

Test: e2e/messaging/common-room.spec.ts:133
Error: Timeout waiting for nested reply text

Please:
1. Use Playwright MCP to manually test as Player 2
2. Check if the API returns the nested replies
3. Debug why they don't display
4. Fix the root cause (not just the test)
```

## 🎪 When to Challenge Assumptions

Ask me to clarify when:
- The task has more than 3 major parts
- The expected behavior isn't clear
- There are multiple valid approaches
- You need to make architectural decisions
- The error might have multiple causes

## 📝 Documentation Expectations

When I ask for documentation:
- Put user guides in `/docs/guides/`
- Put API docs in `/docs/api/`
- Put architecture decisions in `/docs/adrs/`
- Update `.claude/context/` files when patterns change
- Update CLAUDE.md for new development patterns

## 🔍 Search and Navigation

When searching fails:
- Try different search terms
- Use glob patterns for file searches
- Check if you're in the right directory
- Use Bash `pwd` to verify location
- Try case-insensitive search with grep -i

## 💡 Pro Tips

1. **For Complex Tasks**: Ask me to break it down first
2. **For Ambiguous Requirements**: Show me 2-3 approaches and ask which I prefer
3. **For E2E Tests**: Always use Playwright MCP first
4. **For Performance Issues**: Profile before optimizing
5. **For Refactoring**: Show me the plan before executing

## 🆘 When You're Stuck

If you're stuck, tell me:
1. What you've tried
2. What the blockers are
3. What additional information would help
4. Whether you need me to manually test something

Don't spin wheels - ask for clarification!
