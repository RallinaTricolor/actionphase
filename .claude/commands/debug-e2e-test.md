# E2E Test Debugging Command

**MANDATORY PROTOCOL - Follow EXACTLY in this order:**

## Phase 1: Understand the Failure (DO NOT SKIP)
1. Read the FULL error message, including:
   - The specific assertion that failed
   - The timeout duration
   - The locator or element being waited for
2. Note the test file and line number
3. Check if there are screenshots attached

## Phase 2: Use Playwright MCP (ALWAYS DO THIS FIRST)
**⚠️ CRITICAL: Always use Playwright MCP before modifying any test code!**

1. Navigate to the failing test's URL using `mcp__playwright__browser_navigate`
2. Login as the test user (check test code for which user)
3. Manually reproduce the test steps using Playwright MCP
4. Use `mcp__playwright__browser_snapshot` to see the actual page state
5. Use `mcp__playwright__browser_console_messages` to check for JavaScript errors
6. Verify that the feature actually works before assuming test is wrong

## Phase 3: Common Failure Analysis
Check for these issues IN ORDER:
1. **Form not submitted**: Check if a form submission failed silently
2. **Element not visible**: Use snapshot to see if element exists but is hidden
3. **Wrong selector**: Verify the selector matches what's actually on the page
4. **Race condition**: Check if adding a waitForLoadState helps
5. **Feature not implemented**: Only conclude this AFTER manual verification

## Phase 4: Fix Decision Tree
```
Did Playwright MCP show the feature works manually?
├─ YES → Fix the test (timing, selectors, or expectations)
└─ NO →
    └─ Is there a JavaScript error?
        ├─ YES → Fix the application code
        └─ NO →
            └─ Is the element present but hidden?
                ├─ YES → Fix visibility issue or test expectations
                └─ NO → Feature may not be implemented
```

## Example Usage:
```
Error: Timeout waiting for element with text "Submit"
1. Use Playwright MCP to navigate to page
2. Check browser_snapshot - is Submit button there?
3. If yes but test fails - likely timing issue
4. If no - check if form renders correctly
```

## DO NOT:
- ❌ Immediately increase timeouts without investigation
- ❌ Change test expectations without verifying current behavior
- ❌ Assume feature isn't implemented without manual check
- ❌ Skip Playwright MCP debugging phase
