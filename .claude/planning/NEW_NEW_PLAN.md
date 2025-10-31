- New comment highlighting E2E test? Haven't checked it in a while (found the issue here)
- Recruitment applications should be publicly viewable
- Text length limits, multiple action submissions?
- Admin mode E2E tests
- Edit / delete private messages?
- Regression tests for deep links


However, the skill system likely needs the route-tester skill rules updated to include patterns like
"test.*delete.*message" or "test.*API.*endpoint". This is a skill configuration issue to address later. curl, test API endpoint

⏺ Bash(curl -s -H "Authorization: Bearer $(cat /tmp/player1-token.txt)"
"http://localhost:3000/api/v1/games/9999/conversations/9999/messages" | jq '.messages')
⎿  Error: jq: parse error: Invalid literal at line 1, column 6
