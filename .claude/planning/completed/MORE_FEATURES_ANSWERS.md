1. GM Player Management (Add/Remove Players)
    - When a GM removes a player from the game, their character should be kept and marked inactive. Allow the GM to assign that character to themself or an audience member
    - GMs can add players with pending applications, this bypasses the application process
    - There should not be restrictions on removing players--this is intended as a drastic option in case of emergency
    - Removed players cannot view the game unless granted audience access like anyone else
2. Audience Participation
    - Application Process: Audience members should choose to Apply to join as an audience member rather than a player when hitting the Apply button. Once a game is finished with recruitment, users can *only* apply to join as Audience members
    - Audience members might potentially control more than one character at a time. The most we have ever had in a game was 1 user controlling 13 NPCs...
    - Audience members do not ever submit actions. Their NPCs do not ever submit actions
    - The Private Messages view which allows access to all private messages should be a separate tab which is read only
      - In this tab, no actions can be taken on private messages
    - Audience members can reply to private messages in the normal private messages UI if they have a character they are in control of. They should be able to create conversations, as well
    - Character Control: GMs can post on behalf of audience NPCs even when the audience member is active
      - This is in case the audience member needs to step away for a few hours or is unavailable before a deadline
      - The UI for GMs posting as characters will likely need improvememts: imagine a case where the GM is controlling 6 NPCs and there are 20 audience NPCs...
    - Auto-accept setting: This option is per game
3. New Comments View
    - Rendering strategy: just show the immediate parent comment. Both the comment and its parent should have deep links to the common room thread
    - Sorting: comments should be sorted by date, newest first
    - Scrap the "Mark all as read" feature for now
    - Scope:
      - For now, it should show the most recent 10 comments with the option to infinite scroll
      - Align with the unread_comment_ids feature to show NEW badges
4. Admin View
    - Admin Toggle
      - Globally across all games when enabled
      - There should be a visual indication that Admin Mode is enabled
    - Permissions: my goal here is that an admin can't change the content of what someone said, but they can remove if it was offensive or against rules
    - Viewing as GM/Audience
      - Admins should have the same UI as GMs
      - For now, don't need additional actions available
    - Dedicated is_admin flag on the user table. I will make myself an admin via the database to start and then I should be able to add additional admins as needed
5. GM Handouts
    - Purely one-way communication, players may not reply to these messages. The reply feature is purely for the GM being able to organize information in a series of comments rather than one big wall of text
    - Applicants should be able to see them if they are published, as they will contain relevant information for the game
    - For now, the sort order should be newest first
    - Draft handouts should be invisible to players entirely
    - No version history needed, but notifying players is a good idea as is showing a last updated timestamp
6. Comment Editing/Deletion
   - Players can edit/delete their own comments
   - GMs can delete any comment in their game, but not edit
   - Admins can delete any comment, but not edit
   - Comment authors can always edit
   - Edit history is unnecessary, but showing that it was edited (and with a timestamp) is required
   - Deleted comments should be soft deleted and show a "[deleted]" placeholder text to preserve thread structure
   - No notifications necessary
   - New mentions should trigger new notifications. Old mentions can keep the notifications--no need to delete them if a mention was removed
General Questions:
   - There shouldn't be much of a dependency order, but with these answers hopefully you can figure that out
   - For performance, we should definitely be aware of that for All Private Messages. Infinite scrolling is a good idea (load the 10 most recent conversations, then allow scrolling), as is a filter method ("only load conversations with X character in it")
