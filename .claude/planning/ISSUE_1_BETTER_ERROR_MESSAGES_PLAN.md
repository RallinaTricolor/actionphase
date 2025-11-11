# Issue #1: Better Error Messages - Implementation Plan

**Priority**: 🟢 Low Priority (UX Improvement)
**Estimated Time**: 3-4 hours
**Status**: Ready for Investigation

---

## Problem Statement

Users receive confusing error messages during registration and login:
- Password length validation not shown to user
- Raw error responses displayed throughout the app
- Users don't understand what went wrong during registration/login

Example: User enters password "test123" (7 chars) but backend requires 8+ characters. Frontend shows raw error: `{"error": "password: must be at least 8 characters"}` instead of user-friendly message.

---

## Investigation Checklist

- [ ] Review backend password validation rules (likely in `backend/pkg/auth/api.go`)
- [ ] Check all frontend auth forms (`RegisterPage.tsx`, `LoginPage.tsx`)
- [ ] Identify all places showing raw error messages
- [ ] Review error response format from backend
- [ ] Find similar error handling patterns in codebase (polls, forms, etc.)
- [ ] Document all error scenarios (password too short, username taken, invalid credentials, etc.)

---

## Proposed Solution

### Phase 1: Frontend Password Validation (Proactive)

**Goal**: Show password requirements BEFORE user submits, prevent submission of invalid passwords

**Location**: `frontend/src/pages/RegisterPage.tsx`

**Implementation**:
```typescript
// Add password requirements display
const passwordRequirements = [
  { text: 'At least 8 characters', met: password.length >= 8 },
  { text: 'Contains uppercase letter', met: /[A-Z]/.test(password) },
  { text: 'Contains lowercase letter', met: /[a-z]/.test(password) },
  { text: 'Contains number', met: /\d/.test(password) },
];

// Real-time validation feedback
<div className="mt-2 space-y-1">
  {passwordRequirements.map((req, idx) => (
    <div key={idx} className="flex items-center gap-2 text-sm">
      {req.met ? (
        <CheckCircle className="text-green-500" size={16} />
      ) : (
        <XCircle className="text-gray-400" size={16} />
      )}
      <span className={req.met ? 'text-green-600' : 'text-gray-500'}>
        {req.text}
      </span>
    </div>
  ))}
</div>
```

**Benefits**:
- Users see requirements immediately
- Prevents form submission with invalid password
- Reduces server round-trips
- Matches modern auth UX patterns

### Phase 2: Error Message Mapper (Reactive)

**Goal**: Convert backend error responses into user-friendly messages

**Location**: `frontend/src/lib/utils/errorMapper.ts` (new file)

**Implementation**:
```typescript
export function mapAuthError(error: any): string {
  const errorMessage = error?.response?.data?.error || error?.message || 'An error occurred';

  // Password validation errors
  if (errorMessage.includes('password') && errorMessage.includes('at least')) {
    return 'Password must be at least 8 characters long';
  }
  if (errorMessage.includes('password') && errorMessage.includes('uppercase')) {
    return 'Password must contain at least one uppercase letter';
  }

  // Username validation errors
  if (errorMessage.includes('username') && errorMessage.includes('taken')) {
    return 'This username is already taken. Please choose another.';
  }
  if (errorMessage.includes('username') && errorMessage.includes('invalid')) {
    return 'Username must be 3-20 characters and contain only letters, numbers, and underscores';
  }

  // Credentials errors
  if (errorMessage.includes('invalid credentials') || errorMessage.includes('unauthorized')) {
    return 'Invalid username or password. Please try again.';
  }

  // Fallback: Show raw error for debugging (log to console)
  console.error('Unmapped error:', errorMessage);
  return 'An error occurred. Please try again or contact support.';
}
```

**Usage**:
```typescript
// RegisterPage.tsx
catch (error) {
  const friendlyMessage = mapAuthError(error);
  toast.error(friendlyMessage);
}
```

**Benefits**:
- Central error handling logic
- Easy to extend with new error mappings
- Consistent UX across all forms
- Still logs raw errors for debugging

### Phase 3: Inline Validation

**Goal**: Show validation errors on specific fields (username, email, password)

**Location**: Update `Input` component or use form library (React Hook Form)

**Implementation Options**:

**Option A: Enhance existing Input component**
```typescript
// components/ui/Input.tsx
<Input
  label="Password"
  type="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  error={passwordError}  // Show error below field
  helperText="Must be at least 8 characters"
/>
```

**Option B: Use React Hook Form (recommended)**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(registerSchema),
});
```

**Benefits of React Hook Form**:
- Built-in validation
- Automatic error display
- Better performance (less re-renders)
- Industry standard pattern
- TypeScript support

---

## Implementation Checklist

### Phase 1: Frontend Password Validation
- [ ] Add password requirements display component
- [ ] Add real-time validation feedback (checkmarks/x marks)
- [ ] Disable submit button until all requirements met
- [ ] Write component tests (5 cases: each requirement + submit disabled state)

### Phase 2: Error Message Mapper
- [ ] Create `errorMapper.ts` utility
- [ ] Add mappings for all auth error scenarios
- [ ] Update RegisterPage to use mapper
- [ ] Update LoginPage to use mapper
- [ ] Write unit tests for error mapper (10+ cases)

### Phase 3: Inline Validation
- [ ] Decide: Enhance Input component OR adopt React Hook Form
- [ ] Implement validation schema (Zod)
- [ ] Add field-level error display
- [ ] Update all auth forms
- [ ] Write integration tests (form submission with errors)

---

## Test Requirements

### Component Tests (8 cases)
- [ ] Password requirements display correctly
- [ ] Requirements update as user types
- [ ] Submit disabled when password invalid
- [ ] Submit enabled when password valid
- [ ] Error mapper handles known error formats
- [ ] Error mapper provides fallback for unknown errors
- [ ] Inline validation shows correct field errors
- [ ] Form submission with invalid data shows errors

### E2E Tests (4 scenarios)
- [ ] Register with invalid password → see friendly error message
- [ ] Register with taken username → see friendly error message
- [ ] Login with invalid credentials → see friendly error message
- [ ] Register with valid data → success (no errors)

---

## Files to Modify

**Backend** (Investigation Only):
- `backend/pkg/auth/api.go` - Review password validation rules
- `backend/pkg/auth/validation.go` - Document validation logic

**Frontend**:
- `frontend/src/pages/RegisterPage.tsx` - Add password requirements display
- `frontend/src/pages/LoginPage.tsx` - Add error message mapping
- `frontend/src/lib/utils/errorMapper.ts` - NEW: Error message mapper utility
- `frontend/src/components/ui/Input.tsx` - Enhance with error prop (if not using React Hook Form)

**Tests**:
- `frontend/src/lib/utils/errorMapper.test.ts` - NEW: Unit tests
- `frontend/src/pages/RegisterPage.test.tsx` - Enhanced component tests
- `frontend/e2e/auth/registration.spec.ts` - E2E tests

---

## Success Criteria

✅ Users see password requirements before submitting
✅ Error messages are clear and actionable (no raw JSON)
✅ Validation errors appear on specific fields
✅ Submit button disabled for invalid input
✅ All existing E2E tests still pass
✅ New tests cover error scenarios

---

## Notes

- **Low Priority**: This is a UX improvement, not a critical bug
- **Quick Wins**: Phase 1 (password requirements) can be implemented in ~1 hour
- **Optional**: React Hook Form adoption would improve all forms, not just auth (consider broader impact)
- **Backward Compatible**: Error mapper provides fallback for unmapped errors
- **Future Enhancement**: Could extend to other forms (polls, profile settings, etc.)

---

## Related Issues

- Similar to Issue #3 and #6 (missing permission checks)
- Error handling pattern can be reused across app
- Consider creating `.claude/context/ERROR_HANDLING.md` for guidance
