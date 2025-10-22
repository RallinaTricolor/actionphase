- ✅ Modals need a better UI (black background is not doing it) - COMPLETED: Added backdrop blur, upgraded to surface-raised, enhanced shadows and borders
- ⏸️ Character avatars need to be displayed - NEEDS BACKEND WORK: Requires API changes to include avatar URLs in conversation lists, message responses, etc.
  - In private messages (both in the normal view and audience mode)
  - On the new comments page (smaller for the parent comment)
  - On the people page next to the character name
  - They should generally be more prominent
- ✅ We should add the user's username in the top left, have "Settings" and "Admin" as hover dropdown navigation - COMPLETED: Added user dropdown menu with username display, Settings and Admin links in hover dropdown
- ✅ We need to support the back button working more reliably, right now it's hard to go "back" when you're in a sub tab / tab of a game - COMPLETED: Changed useGameTabs hook to use `replace: false` instead of `replace: true` when updating URL parameters, so each tab change creates a new browser history entry enabling back button navigation between tabs
- ✅ Creating a game needs to support the new fields that Editing does (anonymous and auto-accept audience applications) - COMPLETED: Extracted shared GameFormFields component, added is_anonymous field to CreateGameForm, refactored EditGameModal to use Modal component
- ✅ Add a search bar for games in addition to the filters - COMPLETED: Added search field to GameListingFilters type, updated useGameListing hook with setSearch method and URL sync, added debounced search input to GamesPage. Fixed backend to actually process search parameter (added to core.GameListingFilters, SQL query with ILIKE on title/description, API handler parsing, and service layer implementation)
- ✅ For common room posts, we can remove the "GM Post: " prefix and display the character name under the post title - COMPLETED: Removed "GM Post" heading and megaphone icon, made character name the prominent h3 heading with metadata (author, timestamp) displayed smaller below it
- ✅ The GM is not having any characters detected - COMPLETED: Standardized character types to use just 'npc' across backend and frontend. Updated backend SQL queries (GetUserControllableCharacters, GetNPCsByGame, ListAudienceNPCs) to use 'npc' instead of 'npc_gm'/'npc_audience', regenerated sqlc code. Updated frontend types (characters.ts), CreateCharacterModal, CharactersList component, and test files to use simplified 'npc' type. Existing migration (20251022161106_consolidate_npc_types.up.sql) already consolidates DB data. Both backend and frontend compile successfully.
- ✅ Character sheet needs some love (very basic and small right now) - COMPLETED: Enhanced character sheet with improved visual hierarchy and spacing including: larger header with prominent name/badges, better tab styling with hover states, max-width content area, larger bio/notes fields (200px textarea, better typography), enhanced card components (AbilityCard, SkillCard, ItemCard) with hover effects, better spacing (p-5 instead of p-4), improved badge sizing, enhanced description displays with relaxed line-height, and ItemCard stats with icons and border separator
- ✅ The inventory/ability management modals are still pure black (and have no X button) - COMPLETED: Refactored AddItemModal, AddAbilityModal, AddSkillModal, and AddCurrencyModal to use shared Modal component

Plans for later:
- Archive mode
  - After game is complete, all users should have audience level access
  - Game is in read only mode for all functionality
