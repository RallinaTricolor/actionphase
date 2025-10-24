import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface UseAdminModeReturn {
  isAdmin: boolean;
  adminModeEnabled: boolean;
  toggleAdminMode: () => void;
}

interface AdminModeContextValue extends UseAdminModeReturn {}

const AdminModeContext = createContext<AdminModeContextValue | undefined>(undefined);

const ADMIN_MODE_STORAGE_KEY = 'admin_mode_enabled';

interface AdminModeProviderProps {
  children: ReactNode;
}

export function AdminModeProvider({ children }: AdminModeProviderProps) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.is_admin ?? false;

  // Initialize state from localStorage, but only if user is admin
  const [adminModeEnabled, setAdminModeEnabled] = useState<boolean>(() => {
    if (!isAdmin) return false;
    const stored = localStorage.getItem(ADMIN_MODE_STORAGE_KEY);
    return stored === 'true';
  });

  // Restore admin mode from localStorage when user becomes admin (after login)
  useEffect(() => {
    if (isAdmin) {
      const stored = localStorage.getItem(ADMIN_MODE_STORAGE_KEY);
      if (stored === 'true' && !adminModeEnabled) {
        setAdminModeEnabled(true);
        console.log('[AdminModeContext] Restored admin mode from localStorage');
      }
    }
  }, [isAdmin]);

  // Clear admin mode when user logs out or is no longer admin
  useEffect(() => {
    if (!isAdmin && adminModeEnabled) {
      setAdminModeEnabled(false);
      localStorage.removeItem(ADMIN_MODE_STORAGE_KEY);
    }
  }, [isAdmin, adminModeEnabled]);

  // Toggle admin mode and persist to localStorage
  const toggleAdminMode = useCallback(() => {
    if (!isAdmin) {
      console.warn('[AdminModeContext] Cannot toggle admin mode: user is not an admin');
      return;
    }

    setAdminModeEnabled((prev) => {
      const newValue = !prev;
      if (newValue) {
        localStorage.setItem(ADMIN_MODE_STORAGE_KEY, 'true');
      } else {
        localStorage.removeItem(ADMIN_MODE_STORAGE_KEY);
      }
      console.log('[AdminModeContext] Admin mode toggled:', newValue);
      return newValue;
    });
  }, [isAdmin]);

  return (
    <AdminModeContext.Provider value={{ isAdmin, adminModeEnabled, toggleAdminMode }}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode(): AdminModeContextValue {
  const context = useContext(AdminModeContext);
  if (!context) {
    throw new Error('useAdminMode must be used within AdminModeProvider');
  }
  return context;
}
