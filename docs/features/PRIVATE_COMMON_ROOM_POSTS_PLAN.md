# Private Common Room Posts — Implementation Plan

_As of 2026-09-24_

## The feature in one paragraph

A GM can mark a Common Room post as **restricted** and pick which players may see it. Everyone else sees nothing: not the post, not its comments, not its reactions, and not the fact that it exists. The allowlist lives on the top-level post and is inherited by every comment in that thread, however deep.

The permission check itself is easy. The hard part is that several pages list comments **without going through the post first**: the New Comments feed, character profile pages, favorites, the dashboard, notifications and deep links. Each of those must drop comments whose thread root is a post the viewer can't see.

### Product questions to settle before coding

Agree these with the GM (or with the maintainer) first. Each changes the schema or the queries.

1. **Allowlist players or characters?** store **users** (players). A player can own several characters, but visibility is about who reads the page, and a user is the reader. The GM picker can still show character names next to each player.
2. **Who always sees everything?** the GM, co-GMs, the audience, and admins in admin mode. 
3. **What happens when the game becomes a public archive?** `core.IsPublicArchive` makes completed and epilogue games readable by everyone. restrictions lift in the archive, the same way hidden NPCs are revealed there. The game export should then include everything too.
4. **Can the allowlist change after posting?**  es, the GM can add or remove players. Removing someone hides the thread from them again, including comments they wrote.
5. **Where do a removed player's own comments go?** With the rule above, they vanish from that player's character profile for other non-allowlisted viewers too. That's the correct behavior, but it will surprise people, so maybe call it out in the UI.
6. **Is an empty allowlist allowed?** no. "Restricted with nobody on the list" means GM-only, which is what draft posts are for.

## How Common Room posts and comments work today

Posts and comments are rows in a single `messages` table, linked only by `parent_id`. No column records which top-level post a comment belongs to, so every query that needs it walks up the tree with a recursive CTE.

### The `messages` table

Defined in `backend/pkg/db/migrations/20251015165715_add_messages_and_comments_system.sql`, with later columns added by other migrations.

| Column | What it means |
| --- | --- |
| `message_type` | `post` (top level, `parent_id` is NULL) or `comment` (always has a `parent_id`). A CHECK constraint enforces this. |
| `parent_id` | The post **or comment** this row replies to. A reply to a reply points at the reply, not the post. |
| `thread_depth` | 0 for posts, parent + 1 for comments. Set by the `set_message_thread_depth` BEFORE INSERT trigger, which reads the parent row. |
| `visibility` | `game` for Common Room, `private` for DMs. Not useful here: it's per row and is all-or-nothing. |
| `is_draft` | GM draft posts that auto-publish when a phase activates. Every post listing already filters `is_draft = false`, which is the pattern you'll copy. |
| `phase_id` | Comments inherit it from their parent in `CreateComment` (`backend/pkg/db/services/messages/comments.go`). |

### How the root post is found today

There are at least five copies of the "walk up to the post" CTE:

- `ListRecentCommentsWithParents` and `ListRecentUnreadCommentsWithParents` in `backend/pkg/db/queries/communications.sql` (the New Comments page)
- `GetMessageWithParentContext` in `backend/pkg/db/queries/messages.sql` (deep links)
- `GetUnreadCommentIDsForPosts` and `MarkAllCommentsReadForPhase` in `messages.sql` (these walk **down** from posts instead)

The New Comments CTE is the one that bites. It selects the page of comments first (`LIMIT $2 OFFSET $3`), then resolves each comment's root post. You can't filter by root after that, or a page of 20 comes back with 13 and the pagination total is wrong.

`user_comment_reads` already stores a denormalised `post_id` next to each `comment_id`. That's a precedent for storing the root instead of computing it.

### Who can post and read

- Posts are created in `MessageService.CreatePost` (`backend/pkg/db/services/messages/posts.go`). It notifies every active participant through `NotificationService.NotifyCommonRoomPost`.
- HTTP handlers live in `backend/pkg/messages/huma_api.go`. Read endpoints mostly check the game and whether usernames should show (`showUsernames`). Some, like `listRecentComments`, work **without** a logged-in user so public archives can be read.
- Roles come from `game_participants.role` (`player`, `co_gm`, `audience`) plus `games.gm_user_id`. Helpers are in `backend/pkg/core/permissions.go` (`IsUserCoGM`, `IsUserAudience`, `IsPublicArchive`).

### Study this first: hidden NPCs

Commit `bc49a0b5` ("Add ability for GM to have hidden NPCs") is the closest precedent. It adds a GM-only visibility flag, a role-based rule in `core/permissions.go` with unit tests, filtering in several read paths, and a dedicated test file per surface (`api_hidden_test.go`, `mentions_hidden_test.go`). Read its diff before starting; this feature has the same shape.

## Every place that must respect the allowlist

There are about a dozen surfaces, not two. The New Comments page and character profiles are the hardest, but favorites, the dashboard, unread tracking and notifications leak just as much if missed. Treat this table as your checklist. Endpoint names are the huma `OperationID`s in `backend/pkg/messages/huma_api.go`.

### Reads that list content

| Surface | Endpoint → query | Change needed |
| --- | --- | --- |
| Common Room post list | `listGamePosts` → `GetGamePosts`, `GetPhasePosts`, `GetGamePostCount` (`messages.sql`) | Add a viewer filter to the `WHERE` clause and the count. |
| Comments on one post | `listPostComments`, `listPostCommentsWithThreads` → `GetPostComments`, `GetPostCommentsWithThreads` (raw SQL in `services/messages/comments.go`) | Gate once in the handler: if the viewer can't see `postId`, return 404. No query change. |
| Deep links | `getMessage`, `getMessageThreadContext` → `GetMessage`, `GetMessageWithParentContext` | Resolve the root post, then gate. `GetMessageWithParentContext` already returns `root_post_id`. |
| **New Comments page** | `listRecentComments` → `ListRecentCommentsWithParents`, `ListRecentUnreadCommentsWithParents`, `GetTotalCommentCount`, `GetTotalUnreadCommentCount` (`communications.sql`) | Filter **inside** the `recent_comments` CTE, before `LIMIT`/`OFFSET`. Both count queries need the same filter or pagination breaks. |
| **Character profile** | `listCharacterComments` → `ListCharacterPostsAndComments`, `CountCharacterPostsAndComments` (`communications.sql`) | Same as above. These queries don't take a viewer today, so the handler must start passing the caller's user ID. |
| Favorites page | `listFavoriteComments` → `ListFavoriteCommentsWithParents` (`messages.sql`) | Filter per row. This list spans games, so check each row's game. It matters when a player is removed from an allowlist after favoriting. |
| Dashboard | `GetUserRecentMessages` (`dashboard.sql`) and `getUnreadCommentCountsForDashboard` (raw SQL in `services/dashboard.go`) | The first shows message snippets; the second counts unread comments per game. Both need the filter. |
| Unread badges | `getPostsUnreadInfo`, `getUnreadCommentIDs`, `markAllCommentsRead` → `GetPostsWithUnreadCount`, `GetUnreadCommentIDsForPosts`, `MarkAllCommentsReadForPhase` | They return post IDs and comment counts. An extra post ID in the response tells a player a hidden post exists. |

### Writes that must be rejected

Each of these takes a post or comment ID from the client. Check the viewer can see its root post first and return 404 if not, so the response doesn't confirm the post exists.

- `createComment`, `updateComment`, `deleteComment`
- Reactions (`AddReaction` and `RemoveReaction` in `services/messages/reactions.go`)
- `toggleCommentRead`, `setCommentFavorite`, `markPostRead`

### Side effects: notifications

Discord DMs are driven by the in-app notifications, so fixing notifications fixes Discord too.

- **New post.** `NotificationService.NotifyCommonRoomPost` notifies every active participant. For a restricted post it must notify only the allowlist plus GMs.
- **Mentions.** `notifyCharacterMentions` (`services/messages/validation.go`) must skip characters whose owner can't see the thread. Otherwise a mention notification delivers the content to someone who can't see it.
- **Replies.** `notifyCommentReply` notifies the parent comment's author. That only leaks if the author was removed from the allowlist after commenting, but check it anyway.
- **Existing notifications.** Notifications already sent stay in the inbox when someone is removed from the list. Decide whether to delete them (`DeleteNotification` exists) or accept the leak.

### Probably unaffected

The game export (`backend/pkg/exports/`) and the stats tab (`game_stats.sql`) only run on completed games. If restrictions lift in the public archive (question 3 above), leave them alone. If they don't, both need the filter, and the stats page's "longest comment" deep link needs particular care.

## Data model

Make three schema changes in one migration. Storing each comment's root post is what makes this feature tractable. With it, every read path in the table above becomes one join and one `WHERE` clause, and you don't touch any recursive CTE.

### 1. Store the root post on every message: `messages.root_post_id`

Add a nullable `root_post_id INTEGER REFERENCES messages(id) ON DELETE CASCADE`, plus an index on it.

- For a **post**, `root_post_id = id`, pointing at itself. That lets every query filter on `root_post_id` without special-casing posts.
- For a **comment**, `root_post_id` is the parent's `root_post_id`.
- For **private messages**, leave it NULL.

Set it in the database, not in Go. The existing `update_message_thread_depth()` trigger function already reads the parent row on every insert to compute `thread_depth`. Replace the function (`CREATE OR REPLACE FUNCTION`) so it also copies the parent's `root_post_id`. In a BEFORE INSERT trigger, `NEW.id` is already filled in from the sequence, so posts can set `NEW.root_post_id := NEW.id`.

Backfill existing rows in the same migration. First set posts to themselves (`UPDATE messages SET root_post_id = id WHERE message_type = 'post'`). Then fill comments with one recursive CTE, walking down from the posts, the same shape as `GetUnreadCommentIDsForPosts`. After backfilling, check that no `comment` row still has a NULL `root_post_id`.

Once this column exists, the old CTEs can be simplified too. That's optional, and better done in a separate follow-up.

### 2. Mark the post as restricted: `messages.is_restricted`

Add `is_restricted BOOLEAN NOT NULL DEFAULT false`. It's only meaningful on posts. Use an explicit flag rather than "has allowlist rows" so that an empty list can never quietly make a post public.

### 3. The allowlist table

```sql
CREATE TABLE common_room_post_viewers (
    post_id    INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_common_room_post_viewers_user ON common_room_post_viewers(user_id);
```

This stores users, following the recommendation in product question 1. If you choose characters instead, key it on `character_id` and join through `characters.user_id` wherever you check it.

### The one filter you'll reuse everywhere

Every listing query gains the same join and predicate:

```sql
JOIN messages root ON root.id = m.root_post_id
...
AND (
    sqlc.arg(viewer_sees_all)::bool
    OR root.is_restricted = false
    OR EXISTS (
        SELECT 1 FROM common_room_post_viewers v
        WHERE v.post_id = m.root_post_id
          AND v.user_id = sqlc.arg(viewer_user_id)
    )
)
```

`viewer_sees_all` is computed in Go, which keeps the role rules in one place (see the backend section). This works for the single-game queries. The two queries that span games, favorites and the dashboard, can't take one boolean, so they need the role check written in SQL against `games.gm_user_id` and `game_participants.role`.

### Mechanics

1. `just migration create add_common_room_post_allowlist`. One file holds both `-- +goose Up` and `-- +goose Down`. Delete the stub guard it generates.
2. The Down section drops the table and both columns and restores the original trigger function body.
3. Update queries in `backend/pkg/db/queries/`, then `just sqlgen`. Queries using `SELECT m.*` pick up the new columns automatically.
4. `just migrate`, then `just test`.

Read `.claude/context/CODE_GENERATION.md` first. Never hand-edit a `.gen.` file.

## Backend plan

Build one permission rule, one "can this user see this message" check, and one SQL filter, then apply them surface by surface. Before starting, read `.claude/context/ARCHITECTURE.md` and the `backend-dev-guidelines` skill. Handlers are huma operations (`func(ctx, *Input) (*Output, error)`), never `func(w, r)`.

### Step 1: the permission rule

In `backend/pkg/core/permissions.go`, add a pure function next to `CanSeeHiddenCharacter`. It decides who bypasses the allowlist:

```go
// CanSeeAllRestrictedPosts reports whether a viewer bypasses Common Room
// post allowlists entirely.
func CanSeeAllRestrictedPosts(role string, isGM, isAdminMode bool, gameState string) bool
```

It returns true for the GM, co-GMs, admins in admin mode and public archive states, plus audience if you decide that. Unit-test it with a table-driven test in `permissions_test.go`. Add a thin wrapper that looks up the game and the participant row, the way `authorCanSeeHiddenCharacters` does in `services/messages/validation.go`. A lookup failure must return **false**: a failed check must never grant access.

### Step 2: a single-message check

Add `CanUserViewMessage(ctx, messageID, userID int32) (bool, error)` to `MessageService`. Declare it in `backend/pkg/core/interfaces.go` first, as the repo requires. It reads the message's `root_post_id`, then applies Step 1 and the allowlist.

In `backend/pkg/messages/`, add a handler helper that calls it and returns **404**, not 403, when the answer is no. A 403 would confirm the post exists. Call this helper at the top of every endpoint under "Comments on one post", "Deep links" and "Writes that must be rejected" in the table above.

### Step 3: filter the listing queries

Add `viewer_user_id` and `viewer_sees_all` parameters to each listing query in the table and apply the filter from the data model section.

- **New Comments.** Put the filter inside the `recent_comments` CTE, next to `m.message_type = 'comment'`, so `LIMIT`/`OFFSET` counts only visible comments. Apply the same filter to `GetTotalCommentCount` and `GetTotalUnreadCommentCount`.
- **Character profile.** Same filter in the `character_messages` CTE and in `CountCharacterPostsAndComments`. The handler already loads the character, so you have the `game_id`.
- **Anonymous callers.** `listRecentComments` works without a login. `core.GetUserIDFromJWT` fails for them, so pass user ID 0. No allowlist contains user 0, so they see only unrestricted posts.
- **Every query change needs a test** showing the hidden rows are gone **and** the count matches.

### Step 4: creating and editing restricted posts

- Add an optional `restrictedToUserIds` field to the create-post request in `backend/pkg/messages/requests.go`. Validate its shape in `Bind` via `core.ValidateStruct`; a `validate` tag on its own enforces nothing. In the service, check every ID is an active `player` in this game, and return a validation error otherwise.
- In `MessageService.CreatePost`, insert the post and its allowlist rows in **one transaction**. A crash between the two must not leave a restricted post with an empty list.
- Add a GM-only endpoint to replace a post's allowlist, for example `PUT /posts/{postId}/viewers`, which takes the full list. Guard it with the existing `requireGMOrCoGM` in `backend/pkg/messages/authz.go`.
- Decide whether draft posts (`draft_posts.go`) can be restricted in v1. GMs write drafts ahead of time, so they will expect it. If supported, the allowlist must carry through `PublishDraftPostsForPhase`.

### Step 5: notifications

- Give `NotifyCommonRoomPost` a variant that takes the allowlist and notifies only those users, the GM and co-GMs.
- In `notifyCharacterMentions` and `notifyCommentReply`, drop any recipient who fails `CanUserViewMessage` for the new message.

### Step 6: the response shape

- Add `isRestricted` to the post response in `backend/pkg/messages/responses.go`.
- Return `allowedViewerIds` only to viewers who pass Step 1. Use a pointer with `omitempty` so the key is absent, not `null`, for everyone else. Whether allowlisted players may see who else is on the list is a small product question to settle too.
- Run `just gen-openapi` and commit the updated `backend/pkg/docs/openapi.gen.yaml`.

## Frontend plan

The frontend work is small. Filtering happens on the server, so the New Comments page, character profile and favorites need no changes. They just receive fewer rows. What's new is the GM's picker, a restricted badge and an allowlist editor. Read `.claude/context/STATE_MANAGEMENT.md` and the `frontend-dev-guidelines` skill first.

1. **Regenerate types.** Run `just gen-api-types` and commit `frontend/src/types/api.gen.ts`. Never edit it by hand.
2. **API client.** Pass the new `restrictedToUserIds` field through `createPost` in `frontend/src/lib/api/messages.ts`. Add a method for the allowlist-editing endpoint.
3. **Picker in `CreatePostForm`.** `components/messages/CreatePostForm.tsx` is only shown to GMs. Add a "Restrict who can see this post" `<Toggle>`. When it's on, show a `<Checkbox>` per player. `components/conversations/NewConversationModal.tsx` already renders a checkbox list of characters; copy that pattern. `useGamePermissions` already fetches the game's participants. Label each player with their character names, since that's how GMs think about them. Block submit if the toggle is on and nothing is ticked.
4. **Badge on `PostCard`.** Show a `<Badge>` (for example "Restricted") on restricted posts so allowlisted players know the thread is private. GMs should also see who's on the list, and an "Edit viewers" action that opens a `<Modal>` with the same checkbox list.
5. **Cache invalidation.** After the allowlist changes, invalidate the React Query keys for posts, recent comments and unread info for that game. Otherwise a removed player keeps seeing cached content until refresh.
6. **UI library only.** Use `@/components/ui` components and `surface-*` / `text-content-*` / `border-theme-*` tokens, never raw Tailwind colours. Check the new UI in light and dark mode.

One thing to verify manually. `CommonRoom.tsx` and `ThreadViewModal.tsx` handle deep links to a comment. Once the backend returns 404 for hidden messages, make sure a stale link shows a clean "not found" state rather than an error screen or an endless spinner.

## Testing plan

This is a permissions feature, so most of the value is in backend tests proving that hidden rows are absent. Showing that visible rows are present isn't enough. Read `.claude/context/TESTING.md` and the `testing-patterns` skill before writing any tests. The repo works bottom-up: unit tests, then API checks with curl, then component tests, and E2E last.

### One shared scenario

Build one scenario and reuse it across tests: a game with a GM, a co-GM, three players (A, B, C) and an audience member. It has one public post and one restricted post visible only to A. Under the restricted post, put a comment by A and a reply to that comment, so the thread is at least three levels deep. A bug that only resolves direct children will then show up.

### Backend (most of the effort)

- **Migration.** A test that inserts post → comment → reply → reply and asserts every row's `root_post_id` equals the post's ID. This proves the trigger works.
- **Permission rule.** A table-driven test of `CanSeeAllRestrictedPosts` covering every role × every game state.
- **Each listing query.** For each row of the "Reads that list content" table, assert that player B gets neither the restricted post nor its comments. Also assert that player A and the GM do get them, and that the count/total **matches** the rows returned. For New Comments, include a pagination test: put more hidden comments than one page holds between visible ones, and check page 2 isn't short.
- **Each gated endpoint.** Player B gets 404 for the restricted post's comments, deep links, reply, react, favorite and mark-read.
- **Notifications.** Creating a restricted post notifies A, the GM and co-GM, and never B or C. A comment in the thread that @mentions B's character doesn't notify B.
- **Allowlist edits.** Removing A hides the thread from A. Only the GM or co-GM can edit the list. IDs of non-players are rejected with a validation error, not a 500.

Follow the file layout from the hidden-NPC commit: a dedicated `*_restricted_test.go` beside each touched file. Existing neighbours to extend are `services/messages/recent_comments_test.go`, `character_messages_test.go` and `favorites_test.go`. Run with `just test`. Avoid `just ci-test` locally.

### Fixtures

Because the trigger fills `root_post_id`, existing fixtures in `backend/pkg/db/test_fixtures/` need no change. If you add a restricted post to the shared fixtures, insert it with the same columns `CreatePost` writes, and document it in `.claude/context/TEST_DATA.md`.

### API check

With the stack up (`just up`), `./backend/scripts/api-test.sh` has `login-gm` and `login-player` (TestPlayer1). For a player who isn't on the list, log in as another test user from `.claude/context/TEST_DATA.md`. Curl `/api/v1/games/{id}/comments/recent` and `/api/v1/characters/{id}/comments` as each user, and diff the results.

### Frontend

- `CreatePostForm.test.tsx`: the toggle reveals the picker, submit is blocked when the list is empty, and the payload carries the chosen IDs.
- `PostCard.test.tsx`: the badge renders for restricted posts, and the viewer list shows only for GMs.
- Run with `just test-fe run` (in the container, not on the host).

### E2E (last, optional)

One Playwright test: the GM creates a restricted post, player A sees it and player B doesn't, including on New Comments. Only write it after everything above passes.

## Suggested order of work

Ship this as five small PRs, not one large one. Keep the GM-facing picker for the **last** PR. Until the picker exists, nobody can create a restricted post, so a half-finished filter can't leak anything.

| PR | Scope | Done when |
| --- | --- | --- |
| 1 | `root_post_id` column, trigger change and backfill. No behaviour change. | The trigger test passes and `just test` is green. |
| 2 | `is_restricted`, the allowlist table, `CanSeeAllRestrictedPosts`, `CanUserViewMessage`, create-post and edit-allowlist endpoints, 404 gating on single-post and write endpoints, post list filter. | A restricted post made through the API is invisible to player B in the Common Room. |
| 3 | New Comments and character profile queries, with their counts. | The pagination and count tests pass. |
| 4 | Favorites, dashboard, unread tracking, notifications. | Every row of the checklist table has a test. |
| 5 | Frontend: picker, badge, allowlist editor, regenerated types. Update `.claude/context/ARCHITECTURE.md` and the `game-domain` skill, as the hidden-NPC commit did. | Checked by hand in light and dark mode. |

### Gotchas

- **Filter before `LIMIT`.** Filtering after pagination returns short pages and wrong totals.
- **Gate on the message's own root, not the URL.** Endpoints like `updateComment` take both `postId` and `commentId` in the path. Check the **comment's** `root_post_id`, or a client can pair a visible post ID with a hidden comment ID.
- **404, not 403,** for anything hidden.
- **Counts leak too.** An unread badge of 3 when only 1 comment is visible tells a player something exists.
- **Fail closed.** Any error in a permission lookup means "can't see".
- **This checklist may be incomplete.** When you think you're done, run `grep -rn "FROM messages" backend/pkg` and make sure every hit is filtered or clearly irrelevant, such as private messages or completed-game stats.
- **Performance.** The extra `EXISTS` is a primary-key lookup and the root join is indexed, so expect no measurable cost. If a query plan says otherwise, check the new `root_post_id` index is being used.
