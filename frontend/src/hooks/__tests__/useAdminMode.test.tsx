import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminMode } from '../useAdminMode';
import * as AuthContext from '../../contexts/AuthContext';
import type { User } from '../../types/auth';
import { AdminModeProvider } from '../../contexts/AdminModeContext';
import { ReactNode } from 'react';

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('useAdminMode', () => {
  const ADMIN_MODE_STORAGE_KEY = 'admin_mode_enabled';

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up localStorage after each test
    localStorage.clear();
  });

  const mockAdminUser: User = {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    is_admin: true,
  };

  const mockRegularUser: User = {
    id: 2,
    username: 'user',
    email: 'user@example.com',
    is_admin: false,
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AdminModeProvider>{children}</AdminModeProvider>
  );

  describe('for non-admin users', () => {
    it('returns isAdmin false and adminModeEnabled false', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockRegularUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.adminModeEnabled).toBe(false);
    });

    it('cannot toggle admin mode', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockRegularUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      act(() => {
        result.current.toggleAdminMode();
      });

      expect(result.current.adminModeEnabled).toBe(false);
      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBeNull();
      // Hook no longer logs to console - functionality is the same
    });

    it('ignores localStorage value if user is not admin', () => {
      localStorage.setItem(ADMIN_MODE_STORAGE_KEY, 'true');

      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockRegularUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.adminModeEnabled).toBe(false);
    });
  });

  describe('for admin users', () => {
    it('returns isAdmin true and adminModeEnabled false by default', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockAdminUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.adminModeEnabled).toBe(false);
    });

    it('can toggle admin mode on', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockAdminUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      expect(result.current.adminModeEnabled).toBe(false);

      act(() => {
        result.current.toggleAdminMode();
      });

      expect(result.current.adminModeEnabled).toBe(true);
      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBe('true');
      // Hook no longer logs to console - functionality is the same
    });

    it('can toggle admin mode off', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockAdminUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      // Toggle on first
      act(() => {
        result.current.toggleAdminMode();
      });

      expect(result.current.adminModeEnabled).toBe(true);
      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBe('true');

      // Toggle off
      act(() => {
        result.current.toggleAdminMode();
      });

      expect(result.current.adminModeEnabled).toBe(false);
      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBeNull();
      // Hook no longer logs to console - functionality is the same
    });

    it('loads admin mode state from localStorage on mount', () => {
      localStorage.setItem(ADMIN_MODE_STORAGE_KEY, 'true');

      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockAdminUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.adminModeEnabled).toBe(true);
    });
  });

  describe('localStorage persistence', () => {
    it('persists admin mode enabled state to localStorage', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockAdminUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBeNull();

      act(() => {
        result.current.toggleAdminMode();
      });

      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBe('true');
    });

    it('removes from localStorage when toggling off', () => {
      localStorage.setItem(ADMIN_MODE_STORAGE_KEY, 'true');

      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockAdminUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      expect(result.current.adminModeEnabled).toBe(true);

      act(() => {
        result.current.toggleAdminMode();
      });

      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBeNull();
    });
  });

  describe('logout/admin revoke behavior', () => {
    it('clears admin mode when user is no longer admin', () => {
      const { result, rerender } = renderHook(() => useAdminMode(), {
        wrapper,
      });

      // Start as admin with admin mode enabled
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockAdminUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      rerender();

      act(() => {
        result.current.toggleAdminMode();
      });

      expect(result.current.adminModeEnabled).toBe(true);
      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBe('true');

      // User loses admin status
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: { ...mockAdminUser, is_admin: false },
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      rerender();

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.adminModeEnabled).toBe(false);
      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBeNull();
    });

    it('clears admin mode when user logs out (currentUser becomes null)', () => {
      const { result, rerender } = renderHook(() => useAdminMode(), { wrapper });

      // Start as admin with admin mode enabled
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: mockAdminUser,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      rerender();

      act(() => {
        result.current.toggleAdminMode();
      });

      expect(result.current.adminModeEnabled).toBe(true);
      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBe('true');

      // User logs out
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      rerender();

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.adminModeEnabled).toBe(false);
      expect(localStorage.getItem(ADMIN_MODE_STORAGE_KEY)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles null currentUser', () => {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.adminModeEnabled).toBe(false);
    });

    it('handles user without is_admin field', () => {
      const userWithoutAdminField: User = {
        id: 3,
        username: 'olduser',
        email: 'old@example.com',
        // is_admin is undefined
      };

      vi.mocked(AuthContext.useAuth).mockReturnValue({
        currentUser: userWithoutAdminField,
        isAuthenticated: true,
        isLoading: false,
        isCheckingAuth: false,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        error: null,
      });

      const { result } = renderHook(() => useAdminMode(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
      expect(result.current.adminModeEnabled).toBe(false);
    });
  });
});
