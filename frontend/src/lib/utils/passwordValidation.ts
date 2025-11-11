/**
 * Password requirements for validation
 */
export interface PasswordRequirement {
  text: string;
  met: boolean;
  key: string;
}

/**
 * Validates password against requirements and returns status of each requirement
 */
export function validatePasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      key: 'length',
      text: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      key: 'uppercase',
      text: 'One uppercase letter (A-Z)',
      met: /[A-Z]/.test(password),
    },
    {
      key: 'lowercase',
      text: 'One lowercase letter (a-z)',
      met: /[a-z]/.test(password),
    },
    {
      key: 'number',
      text: 'One number (0-9)',
      met: /\d/.test(password),
    },
    {
      key: 'special',
      text: 'One special character (!@#$%^&*)',
      met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    },
  ];
}

/**
 * Checks if all password requirements are met
 */
export function isPasswordValid(password: string): boolean {
  const requirements = validatePasswordRequirements(password);
  return requirements.every(req => req.met);
}
