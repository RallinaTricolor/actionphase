Below is a list of UI bugs, missing functionality, or incorrect UX that I've noticed in the app.
For each item in this list:
1. Check if it's still an issue (some of them may have already been resolved by our E2E work)
2. Determine a solution, asking questions if anything is unclear or you need more information
3. For large features, create a plan for it in the .claude/planning folder
4. For bug fixes, create unit/integration/E2E tests to prevent regressions. Determine the type of test as appropriate (unit, integration, E2E)
5. Verify functionality with Playwright MCP as needed
6. Update this document as you go so it can be used as the source of truth for progress

- Unauthenticated User
  - Landing Page
    - Landing page is rough. No games listed (unclear if that's intentional)
    - Text on the "Sign up or Login" button is invisible against the button color
- Authenticated User, Not in a Game
  - Default after registration is "recruiting games" instead of a dashboard
  - Dashboard should exist, but largely be empty for consistent UX
  - Default tab for an "in_progress" game is "people" but it should be "common room" if available
  - The "New Comments" sub-tab returns a 403 (it should not)
  - Clicking on a game requires you to hit back twice to get back to the game list (once to clear the ?tab parameter and once to actually go back)
  - The "Apply to Join" dialogue allows you to join as a player or the audience, but there's a "Join as Audience" button right next to it
  - On the "Participants" tab, "GameParticipants" is one word and it lists "Audiences" as a category which is incorrect
  - Joining a game that is in the recruiting state as audience results in the game showing up on your dashboard with you having applied, rather than joined as an audience member
- Game Master
  - New Common Room post submission form should be minimized by default when there are already posts in the commmon room
  - Attempting to create a character of type "Player" results in a 403. GMs should be allowed to create player characters and have an autocomplete on that form to assign them to a player
  - There is no way to delete characters currently
  - Rejecting a character is permanent, there should be a way to approve a character that has been rejected (and vice versa)
  - Rejected characters should not show up in the messages tab as an option to send messages to
  - Handout creation could use a preview window for markdown
  - GM can create posts in the History view of a common room phase
  - Cancelling a game needs a confirmation modal
- Players
  - Description of Phases isn't visible anywhere
  - Default tab for an "in_progress" game is "people" but it should be "common room" or "actions"
  - History tab common rooms can have replies made to them if the phase is still active
  - Leaving a game should relinquish control of character
  - "Leave Game" button should be less prominent -- people tab
  - Action Result flow is a little off now. If the GM starts a new common room immediately after publishing results, the only place to see your results is in the history tab
- General
  - "Player replied to your comment" should be a hard link to the comment in question, currently just the common room
  - As all roles, the deep discussion thread on Shadows Over Innsmouth has one reply that just says "Loading replies..." instead of the full comment chain
  - The "New Comments" sub-tab could use a refresh button to fetch new data without a full page reload
  - @ mentions of characters appear to be links but don't do anything. We could add a little hover modal with their name, player, and avatar
  - Character sheets do not need both a "Public Profile" and "Physical Appearance". Just the "Public Profile" is sufficient
  - Ditto with "Private Notes" and "Secrets" -- these feel like they should just be one field
  - On the character sheet, Abilities, Skills, Items, and Currency all have rounded bottom borders which is incorrect
  - Adding currency on character sheets is somewhat annoying, typing a number doesn't get rid of the default "0" so you have to select all text with a mouse and then type
  - History tab is still useless for Action Phases. We should either remove them or link to the actions tab / audience tab depending on role
  - If there is an unread message badge on a private message in the sidebar, the start of the text moves out of the box
  - Deleting a comment has a standard browser alert() instead of a modal.
