Below is a list of issues that need to be addressed in the E2E test suite. For each item in this list:
1. Assess the problem statement, looking at the test code and the functional pieces the code touches
2. Don't make assumptions about implemented features, verify them
3. Use Playwright MCP to test behavior as needed
4. Ask questions if anything is unclear
5. Fix the test if the problem is clear
6. If anything involves creating a new feature, write a plan for it first
7. Update this document as you go so it can be used as the source of truth for progress

- General
  - Better selectors? Dedicated data-test-id attributes?
  - Evaluate POM usage everywhere. What tests need POMs or new methods for POMs? Lots of direct interaction we can avoid
- character-approval-workflow.spec.ts
  - Should these games have fixtures instead of creating bespoke games each time?
  - Is there duplication in these tests? We create a pending character multiple times
  - "rejected character can be edited and resubmitted"
    - Doesn't actualy test resubmission, just editing
- character-avatar.spec.ts
  - "should not delete avatar when user cancels confirmation dialog"
    - Has an if statement that might skip most of the functionality of the test
- character-sheet-management.spec.ts
  - Need a test to validate that a player cannot edit abilities, skills, inventory, or currency
  - Need a test to validate that a GM can edit abilities, skills, inventory, and currency
- action-results-flow.spec.ts
  - "player can see character mentions in results"
    - Not useful currently, the @ mention isn't a link and the test doesn't validate that
    - Make the @ mention a link and add a test to validate that (use the same component as we use in common room messages, and if there isn't a component for it, create one--there are plans to expand this feature)
- action-submission-flow.spec.ts
  - Missing a test for GM sending results to players (this probably needs to be in action-submission-flow.spec.ts)
    - GM needs to be able to edit draft results (in addition to sending another result), which is not currently possible and should be implemented + tested
  - "Player can submit a new action for active action phase"
    - Should be renamed to "PLayer can edit a draft action for active action phase"
    - Need another test that actually does what this one says--create a new action submission from scratch
- character-creation-flow.spec.ts
  - Needs a new fixture to avoid having to create a new game every time
- complete-phase-lifecycle.spec.ts
  - "GM can create and activate action phase from common room"
    - The last part of the test isn't useful--the selector for activating the action phase might return true even if it wasn't activated
  - Should this test be using POMs like "phase-management.spec.ts"
- handouts-flow.spec.ts
  - Just do an audit of this whole file to see about reducing duplicate work from creating a bunch of handouts
  - There should be a test to confirm that players cannot see "draft" handouts
  - "handout supports character mentions"
    - Much like the action results test, this isn't useful currently and should have the same solution as that test
- phase-management.spec.ts
  - How much of this overlaps with complete-phase-lifecycle.spec.ts?
  - Some of these tests are better than the ones in complete-phase-lifecycle.spec.ts (validate actual functionality instead of having poor selectors)
- game-application-workflow.spec.ts
  - "GM can approve application and player becomes participant"
    - The logic in this flow is wrong. The GM approving an application doesn't remove a player's ability to apply because applications aren't published until the game state transitions
  - Need a test to validate that a player can withdraw from a game they have applied to
- gm-ends-game.spec.ts
  - Duplicated tests from game-lifecycle.spec.ts
- gm-manages-applications.spec.ts
  - Duplicated tests from game-application-workflow.spec.ts
- concurrent-edits-spec.ts
  - "should handle GM editing game settings while player views game"
    - Has an escape clause that potentially prevents the test from actually testing things
  - Some weird tests in this file... how much value do they add? At least one duplicated test
- character-mentions.spec.ts
  - Hardcoded Game ID--should use a selector based on the fixture
  - "should filter autocomplete as user types"
    - Does this test filtering *out* characters? Current test just looks like it makes sure that the one searched for appears, not that the others are gone
- common-room.spec.ts
  - Hardcoded Game ID--should use a selector based on the fixture
  - Missing a lot of testing functionality:
    - Players replying to each other
    - Threaded comments rendering correctly if multiple users reply to the same message
    - "Continue this thread" link for deeply nested comments (is this covered elsewhere?)
- private-messages-flow.spec.ts
  - Good test, but doesn't check GM ability to send private messages (especially since they will have multiple NPCs to send as)
  - Also doesn't check that Audience members with assigned NPCs can send private messages
- notification-flow.spec.ts
  - Hardcoded Game ID--should use a selector based on the fixture
  - Lots of post creation, can we use a better fixture for this that doesn't require GM interaction?
  - Need notification tests for GM and Audience members with multiple characters being notified when *any* of their characters:
    - Receives a private message
    - Has a comment reply
    - Has a character @ mention
-
