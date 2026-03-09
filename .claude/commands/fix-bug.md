# Bug/UI Fix Session

You are working on the ActionPhase platform, a turn-based gaming web application. Before starting any work, read `.claude/context/ARCHITECTURE.md` and `.claude/context/TESTING.md`.

## The Fix

**Issue description**: `[PASTE RAW FEEDBACK HERE]`

**Source**: `[player feedback / GM observation / internal note]`

**Affected area**: `[frontend / backend / both — if known]`

---

## Before You Write Any Code

1. **Understand the problem first.** Read the relevant source files. If the issue description is ambiguous or could mean multiple things, **ask clarifying questions before proceeding.** Do not assume.

2. **Reproduce the problem.** Identify exactly what code is responsible for the incorrect behavior. Cite specific files and line numbers.

3. **Scope the fix.** State what you plan to change and why. Do not refactor unrelated code. Do not add features beyond the fix.

---

## Test-Driven Fix Process

**Follow this order strictly:**

1. Write a test that **fails** because of the bug (proves the bug exists)
2. Fix the bug
3. Verify the test now **passes**
4. Run the full test suite to confirm no regressions

**Test quality rules:**
- Tests must assert real behavior, not just that code runs without crashing
- Do not write tests that trivially pass regardless of the fix
- For frontend fixes: test what the user sees and can interact with, not implementation internals
- For backend fixes: test the actual business logic or data returned, not that a function was called

**Test placement:**
- Backend: co-locate `_test.go` with the file being fixed
- Frontend: co-locate `.test.tsx` / `.test.ts` with the component or hook

---

## Constraints

- **Do not commit.** The user handles all git operations.
- **Do not over-engineer.** Fix the specific problem. If you see adjacent issues, note them but don't fix them unless asked.
- **Do not add features.** A bug fix is not an opportunity to refactor or improve surrounding code.
- **Use the UI component library** (`@/components/ui`) for any frontend changes — no hardcoded Tailwind colors.

---

## Output Format

After completing the fix:

1. **Summary**: What the bug was and what caused it
2. **Fix**: What you changed and why
3. **Test**: What the regression test covers
4. **Anything noteworthy**: Edge cases discovered, related issues spotted (but not fixed), questions that came up
