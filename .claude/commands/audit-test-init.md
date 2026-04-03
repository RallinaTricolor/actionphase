# Audit Test Init

Discovers all test files for the given layer and writes a queue file so `/audit-test` can process them one at a time.

## Usage

```
/audit-test-init frontend
/audit-test-init backend
/audit-test-init e2e
```

The argument is required. Any other value should print usage and stop.

---

## Your job

**Step 1 — Parse the argument**

The user's message will contain one of: `frontend`, `backend`, `e2e`. Extract it. If missing or unrecognized, print:

```
Usage: /audit-test-init [frontend|backend|e2e]
```

And stop.

**Step 2 — Discover test files**

Use Glob to find test files for the selected layer:

- `frontend` → `/Users/jhouser/Personal/actionphase/frontend/src/**/*.test.{ts,tsx}`
- `backend` → `/Users/jhouser/Personal/actionphase/backend/**/*_test.go` (exclude `vendor/`)
- `e2e` → `/Users/jhouser/Personal/actionphase/frontend/e2e/**/*.spec.ts`

Sort the results alphabetically.

**Step 3 — Check for an existing queue**

Check if `.claude/audit/queue.txt` exists. If it does, read it and tell the user:

```
A queue already exists with N files remaining (layer: [layer]).
Overwrite it? If yes, re-run with the same command. If no, just run /audit-test to continue.
```

Then STOP — do not overwrite without confirmation. If the user explicitly said to overwrite (e.g. ran the command a second time after seeing this warning), proceed.

Actually: always overwrite on the first run. The warning above is unnecessary complexity — just write the queue and report what you did.

**Step 4 — Write the queue files**

Create `.claude/audit/` if it doesn't exist.

Write `.claude/audit/queue.txt` — one absolute file path per line, alphabetically sorted.

Write `.claude/audit/meta.txt` — two lines:
```
layer: frontend
total: 42
```

If `.claude/audit/results.md` does not exist, create it with this header:
```markdown
# Test Audit Results

| File | Result | Notes |
|------|--------|-------|
```

If it already exists, leave it alone (results accumulate across sessions).

**Step 5 — Report**

Print:

```
Audit queue initialized.
  Layer:  frontend
  Files:  42
  Queue:  .claude/audit/queue.txt
  Results will be appended to: .claude/audit/results.md

Run /audit-test to begin.
```
