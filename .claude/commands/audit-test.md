# Audit Test

Pops the next file from the audit queue, applies a V&V checklist, fixes any genuine gaps, and logs the result.

## Usage

```
/audit-test
```

Run repeatedly after `/audit-test-init`. Each invocation processes exactly one file.

---

## Your job

**Step 1 — Load the queue**

Read `.claude/audit/queue.txt`. If it doesn't exist or is empty, print:

```
Queue is empty. Run /audit-test-init [frontend|backend|e2e] to start a new audit.
```

And stop.

Read `.claude/audit/meta.txt` to get the layer and total count.

Pop the FIRST line from the queue (remove it from the file). This is the file you will audit.

**Step 2 — Read the test file in full**

Read the entire test file. Do not summarize or skim. You need the full content to apply the checklist accurately.

Also read the implementation file being tested (same name, without `.test.` / `_test.go`). This gives you context for what behavior should be verified.

**Step 3 — Apply the V&V checklist**

Answer each question with Yes or No, and for each No, quote the specific test that is the weakest evidence:

**Q1 — Specific value assertions**
Does at least one test assert a specific value, not just `.toBeDefined()`, `.toBeInTheDocument()` on a heading/label, or `expect(something).toBeTruthy()`?

Acceptable: `expect(result.current.data).toEqual({ public_messages: 5 })`, `expect(screen.getByText('You are GM')).toBeInTheDocument()` (because the text is role-specific behavior, not just "something rendered")

Not acceptable: `expect(result.current).toBeDefined()`, `expect(screen.getByText('Loading')).toBeInTheDocument()`

**Q2 — Absence assertions for authorization**
If the file tests a component or hook with role-based or state-based conditional behavior: does at least one test assert that something is *absent* or *forbidden* for a role/state that should not see it?

If the file has no role/state-conditional logic, mark Q2 as N/A.

**Q3 — Post-interaction verification**
If the file tests any user interaction (click, submit, type): does at least one test verify what happens *after* the interaction — not just that a button exists?

If the file has no interactions, mark Q3 as N/A.

**Step 4 — Determine verdict**

- **PASS** — All applicable questions answered Yes
- **FIX NEEDED** — One or more No answers

For a FIX NEEDED verdict, you must quote the exact test body that is weakest (copy-paste from the file, do not paraphrase). Then explain in one sentence what assertion is missing.

**Step 5 — Fix if needed**

If the verdict is FIX NEEDED:

- Add the missing assertions directly to the existing test, or add a new focused test if the gap requires a new scenario
- Do NOT rewrite passing tests, rename things, or "clean up" surrounding code
- Run the tests to confirm they pass:
  - Frontend: `cd /Users/jhouser/Personal/actionphase/frontend && npx vitest run [file]`
  - Backend: `cd /Users/jhouser/Personal/actionphase/backend && TEST_DATABASE_URL="postgres://postgres:example@localhost:5432/actionphase_test?sslmode=disable" SKIP_DB_TESTS=false go test -p=1 ./[package]/... -v`
  - E2E: skip running (too slow); note that tests were added but not run

If tests fail after your fix, diagnose and fix before logging the result.

**Step 6 — Log the result**

Append one row to `.claude/audit/results.md`:

```markdown
| `path/to/file.test.ts` | PASS | All three checklist items satisfied |
| `path/to/other.test.ts` | FIXED | Q1: added data assertion to `useCharacterStats` |
| `path/to/another.test.ts` | SKIP | E2E spec — not running tests, assertions look correct |
```

Use a relative path from the repo root.

**Step 7 — Report remaining work**

Print:

```
Audited: src/hooks/useCharacterStats.test.ts
Verdict: FIXED — added data assertion (Q1)

N files remaining. Run /audit-test to continue.
```

If the queue is now empty:

```
Audited: src/hooks/useFoo.test.ts
Verdict: PASS

Queue complete. See .claude/audit/results.md for full results.
```

---

## Important constraints

- Never read a file and assume it has a problem without quoting the specific code that proves it
- Never claim an assertion is missing without first searching the full file for it
- Only fix what the checklist specifically identifies — do not refactor, rename, or add comments
- Each invocation processes exactly one file, then stops
