Think hard about how to improve the CLAUDE.md setup at the root of this repo. The goal is to enable you to write correct code efficiently.
For each issue in the list below:
1. Evaluate how it can be resolved with better prompting
2. If it cannot be easily resolved, explain why and tell me what I can do differently to make it easier
3. Determine what should go in CLAUDE.md and what could be made into commands
4. Feel free to create a USER.md file with your own notes on what I can do to write better prompts regardless of any modifications to CLAUDE.md

- Validate that the assumptions in the file are still correct.
- Validate that the documentation that is linked is correct and helpful.
- Think about how to address some of the common failure states you run into:
    - During E2E tests, you often forget about Playwright MCP (which tends to be the best way to debug failing tests)
      - Adding on this, you like to just update the tests rather than testing the functionality to see if it is the test or the feature that is broken
    - During E2E tests, you often assume features aren't implemented yet
    - During E2E tests, you often make assumptions about the bug rather than checking the actual state of things and then making a decision
    - During E2E tests, you often assume a test timed out (because there are waits in the tests) rather than validating what failed to transition within the time limt (e.g. a form wasn't submitted and so the next step failed with a timeout waiting for something)
    - You are often given a task to implement a large number of features, and you sort them into priorities and only work on the high priority ones
    - Documentation is often added to inconsistent directories
    - Documentation is often not found or ignored
    - Your grep searches often do not find strings which *do* exist in the codebase
    - You regularly forget which directory you are in and run commands in the wrong directory
    - I do not always think of all issues: challenge my assumptions and ask questions rather than jumping to conclusions
    - Plans often do not get completed. They will be separated into phases to work through, but the phases are too big and so you either lose track of work or partially finish a phase and call it complete.
- Assess if the current setup is effective for writing code in this application and what can be improved to be more efficient
- Can we have .claude/commands for common commands with thorough prompts like E2E test creation?
