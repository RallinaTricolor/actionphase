# Challenge Assumptions Command

**USE THIS: When user's request seems incomplete, ambiguous, or potentially problematic**

## When to Challenge

### 🔴 ALWAYS Challenge When:
1. Task has more than 3 major components
2. Requirements conflict with existing patterns
3. Multiple valid implementation approaches exist
4. Performance implications are unclear
5. Security considerations aren't mentioned
6. Test coverage expectations aren't specified

## How to Challenge Effectively

### Template Response:
```
Before implementing, I need to clarify a few assumptions:

1. [Assumption]: I'm assuming [X]. Is this correct, or would you prefer [Y]?
2. [Trade-off]: This approach will [benefit] but may [cost]. Is that acceptable?
3. [Missing Info]: You didn't specify [Z]. Should I [option A] or [option B]?

Would you like me to:
A) Proceed with my assumptions
B) Wait for your clarification
C) Show you a proof-of-concept first
```

## Examples

### Example 1: Vague Feature Request
User: "Add a notification system"

Challenge:
```
I need to clarify the notification system requirements:

1. **Delivery method**: Real-time (WebSockets) or polling-based?
2. **Notification types**: What events trigger notifications?
3. **Persistence**: Should notifications be stored in database?
4. **UI**: Toast messages, bell icon with dropdown, or separate page?
5. **Permissions**: Can users disable certain notification types?

Shall I start with a basic in-app notification system with database storage, or would you prefer to specify the requirements first?
```

### Example 2: Performance-Impacting Change
User: "Load all user data on login"

Challenge:
```
Loading all user data on login could impact performance:

1. **Data volume**: How much data per user (approximate)?
2. **Scaling**: Expected concurrent users?
3. **Alternative**: Would lazy-loading with caching work better?

The current pattern loads data on-demand. Changing this would affect:
- Initial login time (+2-5 seconds estimated)
- Memory usage (increased by ~X MB per user)
- API load (single large request vs. multiple small ones)

Should I proceed with eager loading or would you prefer a hybrid approach?
```

### Example 3: Breaking Existing Patterns
User: "Use Redux for this new feature"

Challenge:
```
The codebase currently uses React Query for server state. Adding Redux would:

1. **Introduce** a new state management pattern
2. **Require** additional dependencies (~30KB bundle size)
3. **Create** potential state synchronization issues

Is there a specific Redux feature you need that React Query doesn't provide? Or should I implement this following the existing React Query patterns?
```

## Decision Framework

```
Is the request clear and complete?
├─ NO → Challenge assumptions
│   ├─ List what's missing
│   ├─ Provide options
│   └─ Wait for clarification
└─ YES →
    └─ Will implementation take >30 minutes?
        ├─ YES → Challenge scope
        │   ├─ Suggest phases
        │   └─ Get prioritization
        └─ NO →
            └─ Are there multiple valid approaches?
                ├─ YES → Present options
                └─ NO → Proceed with implementation
```

## What NOT to Challenge

### ✅ DON'T Challenge When:
- User has provided detailed requirements
- Task follows existing patterns exactly
- User explicitly said "use your judgment"
- It's a simple bug fix with clear solution
- User already answered similar questions

## Response if User Says "Just Do Something"

```
I'll implement a basic version with these assumptions:
- [Assumption 1]
- [Assumption 2]
- [Assumption 3]

This can be refined later. Proceeding with implementation...
[Start TodoWrite and implementation]
```

## Key Phrases to Use

- "Before I start, let me verify my understanding..."
- "I see multiple ways to implement this..."
- "This could impact [X]. Is that acceptable?"
- "The current pattern is [X]. Should I follow it or use [Y]?"
- "Would you prefer [option A] or [option B]?"
