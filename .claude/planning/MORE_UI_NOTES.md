Below is a list of UI bugs, missing functionality, or incorrect UX that I've noticed in the app.
For each item in this list:
0. Each item on this list is categorized as UI, BUG, or FEATURE informing you of what kind of work it is.
1. Check if it's still an issue (some of them may have already been resolved by our E2E work)
2. Determine a solution, asking questions if anything is unclear or you need more information
3. For large features, create a plan for it in the .claude/planning folder
4. For bug fixes, use test-driven development methodologies and create unit/integration/E2E tests to prevent regressions. Determine the type of test as appropriate (unit, integration, E2E)
5. Verify functionality with Playwright MCP as needed
6. Update this document as you go so it can be used as the source of truth for progress

- Unauthenticated User
  - Landing Page
    - UI: Landing page is rough. No games listed (unclear if that's intentional)
    - UI: Text on the "Sign up or Login" button is invisible against the button color
- Authenticated User, Not in a Game
  - UI: Default after registration is "recruiting games" instead of a dashboard
  - FEATURE: Dashboard should exist, but largely be empty for consistent UX
  - UI: Default tab for an "in_progress" game is "people" but it should be "common room" if available
  - BUG: The "New Comments" sub-tab returns a 403 (it should not)
  - UI: The "Apply to Join" dialogue allows you to join as a player or the audience, but there's a "Join as Audience" button right next to it
  - UI: On the "Participants" tab, "GameParticipants" is one word and it lists "Audiences" (instead of Audience Members) as a category which is incorrect
  - BUG: Joining a game that is in the recruiting state as audience results in the game showing up on your dashboard with you having applied, rather than joined as an audience member
- Game Master
  - UI: New Common Room post submission form should be minimized by default when there are already posts in the commmon room
  - BUG: Attempting to create a character of type "Player" results in a 403. GMs should be allowed to create player characters and have an autocomplete on that form to assign them to a player
  - FEATURE: There is no way to delete characters currently
  - FEATURE: Rejecting a character is permanent, there should be a way to approve a character that has been rejected (and vice versa)
  - BUG: Rejected characters should not show up in the messages tab as an option to send messages to
  - UI: Handout creation could use a preview window for markdown
  - BUG: GM can create posts in the History view of a common room phase
  - FEATURE: Cancelling a game needs a confirmation modal
  - FEATURE: GMs should be able to edit results before publishing them. Currently there is no way to view or edit pending results.
  - FEATURE: Is the npc_assignments table vs. user_id on a character worth it to maintain as a split? Could we just make a character_assignments table and use that to avoid having to check all of this extra logic?
- Players
  - UI: Description of Phases isn't visible anywhere
  - UI: Default tab for an "in_progress" game is "people" but it should be "common room" or "actions"
  - BUG: History tab common rooms can have replies made to them if the phase is still active
  - BUG: Leaving a game should relinquish control of character
  - UI: "Leave Game" button should be less prominent -- people tab
  - FEATURE: Action Result flow is a little off now. If the GM starts a new common room immediately after publishing results, the only place to see your results is in the history tab
  - BUG: Players are able to edit their abilities, skills, items, and currency--this is GM only functionality.
- General
  - BUG: "Player replied to your comment" should be a hard link to the comment in question, currently just the common room
  - BUG: As all roles, the deep discussion thread on Shadows Over Innsmouth has one reply that just says "Loading replies..." instead of the full comment chain
  - FEATURE: The "New Comments" sub-tab could use a refresh button to fetch new data without a full page reload
  - FEATURE: @ mentions of characters appear to be links but don't do anything. We could add a little hover modal with their name, player, and avatar
    - Make sure existing E2E tests reflect this change
  - UI: Character sheets do not need both a "Public Profile" and "Physical Appearance". Just the "Public Profile" is sufficient
  - UI: Ditto with "Private Notes" and "Secrets" -- these feel like they should just be one field
  - UI: On the character sheet, Abilities, Skills, Items, and Currency all have rounded bottom borders which is incorrect
  - UI: Adding currency on character sheets is somewhat annoying, typing a number doesn't get rid of the default "0" so you have to select all text with a mouse and then type
  - UI: If there is an unread message badge on a private message in the sidebar, the start of the text moves out of the box
  - UI: Deleting a comment has a standard browser alert() instead of a modal.
  - FEATURE: Players, Audience Members, and Game Masters should be able to delete private messages as well as conversations. There's not a lot of screen real estate here so the UI will need to be slick.
  - FEATURE: We need pagination for the /games endpoint, it currently loads all games
