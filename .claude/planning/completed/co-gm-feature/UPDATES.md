# Co-GM Feature Plan - Updates

**Last Updated: 2025-10-31**

## Changes Made Based on User Feedback

### 1. Removed Phase 5 (Primary GM Leave Warning) ✅

**Reason**: GMs cannot currently leave games. The `PeopleView.tsx` code shows:
```typescript
const canLeaveGame = !isGM && isCurrentUser && onLeaveGame && ...
```

The `!isGM` check prevents GMs from seeing the "Leave Game" button.

**Impact**:
- Removed entire Phase 5 from implementation plan
- Removed Phase 5 tasks from checklist
- Removed GM leave scenarios from risk assessment
- Simplified permission model (no orphaned game state)
- Reduced implementation time by ~1 day

### 2. Added NPC Control to Co-GM Permissions ✅

**Reason**: Co-GM should be able to control GM NPCs just like the primary GM.

**Updated Permission Model**:
```
Primary GM (gm_user_id):
├── Can edit game settings ❌ Co-GM cannot
├── Can promote/demote co-GM ❌ Co-GM cannot
├── Can manage phases ✅ Co-GM can
├── Can view all actions ✅ Co-GM can
├── Can remove participants ✅ Co-GM can
├── Can create GM NPCs ✅ Co-GM can
├── Can control GM NPCs ✅ Co-GM can
└── Can approve/reject characters ✅ Co-GM can

Co-GM (participant with role='co_gm'):
├── CANNOT edit game settings
├── CANNOT promote anyone to co-GM
├── CAN manage phases
├── CAN view all actions
├── CAN remove participants (except primary GM)
├── CAN create GM NPCs
├── CAN control GM NPCs
└── CAN approve/reject characters
```

**Implementation Impact**:
- Need to ensure NPC creation UI checks `isGM || isCoGM`
- Need to ensure NPC control permissions check `isGM || isCoGM`
- Add NPC permission tests to Phase 7

### 3. Updated User Requirements

**Old**:
- ✅ Promotion UI: Context menu
- ✅ Visibility: Game header
- ✅ GM Succession: Game becomes orphaned ❌ REMOVED
- ✅ Demotion: Yes, at any time

**New**:
- ✅ Promotion UI: Context menu on participant cards
- ✅ Visibility: Listed in game header alongside primary GM
- ✅ Demotion: Primary GM can demote at any time
- ✅ NPC Control: Co-GM can create and control GM NPCs

## Revised Implementation Phases

### Phase Count: 6 (was 7)
1. Backend API Endpoints
2. Frontend API Client & Hooks
3. Context Menu UI Component
4. Co-GM Display in Game Header
5. ~~Primary GM Leave Warning~~ **REMOVED**
6. Permission Guard Audit (now includes NPC permissions)
7. Comprehensive Testing (now includes NPC control tests)

### Revised Timeline

**Conservative Estimate**:
- Phase 1: 2-3 days
- Phase 2: 0.5 day
- Phase 3: 2-3 days
- Phase 4: 0.5-1 day
- ~~Phase 5: 0.5-1 day~~ **REMOVED**
- Phase 6: 1-2 days (now includes NPC audit)
- Phase 7: 2-3 days (now includes NPC tests)
- **Total: 8.5-13.5 days** (was 9-14 days)

**Aggressive Estimate**:
- Phase 1: 1 day
- Phase 2: 0.5 day
- Phase 3: 1.5 days
- Phase 4: 0.5 day
- ~~Phase 5: 0.5 day~~ **REMOVED**
- Phase 6: 1 day
- Phase 7: 1.5 days
- **Total: 6 days** (was 6.5 days)

## Additional Tasks Added

### Phase 6: Permission Guard Audit

**New NPC-Related Tasks**:
- [ ] Audit NPC creation endpoints - ensure `isGM || isCoGM` check
- [ ] Audit NPC control/editing endpoints - ensure `isGM || isCoGM` check
- [ ] Test co-GM can create GM NPCs
- [ ] Test co-GM can edit GM NPCs
- [ ] Test co-GM can delete GM NPCs

### Phase 7: Testing

**New NPC Test Cases**:
- [ ] Backend: Co-GM can create GM NPC
- [ ] Backend: Co-GM can edit GM NPC
- [ ] Frontend: NPC creation UI visible to co-GM
- [ ] Frontend: NPC control UI functional for co-GM
- [ ] E2E: Co-GM creates and controls GM NPC

## Files That May Need Updates

Based on NPC permissions addition, these files may need review:

**Backend**:
- `backend/pkg/characters/api.go` - Character/NPC creation endpoints
- Any handlers for NPC management

**Frontend**:
- Components that show "Create NPC" button
- Components that control NPCs
- Any UI that checks `isGM` and should check `isGM || isCoGM`

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| Phases | 7 | 6 |
| Timeline (Conservative) | 9-14 days | 8.5-13.5 days |
| Timeline (Aggressive) | 6.5 days | 6 days |
| Permission Scope | Phases + Actions | Phases + Actions + NPCs |
| GM Leave Handling | Warning modal | N/A (GMs can't leave) |
| Risk Level | Medium | Low-Medium |

## Next Steps

1. ✅ User feedback incorporated
2. Review NPC-related endpoints to identify permission checks needed
3. Proceed with Phase 1 implementation
4. Ensure all NPC permissions are tested in Phase 7

---

**Status**: ✅ Plan updated and ready for implementation
**Changes Approved By**: User
**Last Review**: 2025-10-31
