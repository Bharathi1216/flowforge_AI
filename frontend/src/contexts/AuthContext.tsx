import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SessionExpiredModal } from '../components/SessionExpiredModal';
import { resetRequestScope } from '../services/apiClient';
import { authService } from '../services/authService';
import { readSelection, saveSelection } from '../services/preferences';
import { repositoryService } from '../services/repositoryService';
import { User } from '../types';
import { AuthContext } from './authState';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthExpired, setIsAuthExpired] = useState(false);
  const [selection, setSelection] = useState<{ userId: string; ids: string[] } | null>(null);
  const epoch = useRef(0);
  const clearSession = useCallback((expired = false) => {
    epoch.current += 1;
    resetRequestScope();
    repositoryService.clearCache();
    setUser(null);
    setSelection(null);
    setIsAuthExpired(expired);
  }, []);
  useEffect(() => {
    const expired = () => clearSession(true);
    window.addEventListener('flowforge:auth-expired', expired);
    return () => window.removeEventListener('flowforge:auth-expired', expired);
  }, [clearSession]);
  useEffect(() => {
    let active = true;
    const generation = epoch.current;
    authService
      .getCurrentUser()
      .then((current) => {
        if (!active || generation !== epoch.current) return;
        repositoryService.setAccount(current?.id || null);
        setUser(current);
      })
      .catch(() => {
        if (active && generation === epoch.current) setUser(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const logout = useCallback(async () => {
    clearSession();
    await authService.logout();
  }, [clearSession]);
  const setSelectedRepoIds = useCallback(
    (ids: string[]) => {
      if (!user) return;
      saveSelection(user.id, ids);
      setSelection({ userId: user.id, ids });
    },
    [user],
  );
  const refreshUser = useCallback(async () => {
    const generation = epoch.current;
    const current = await authService.getCurrentUser();
    if (generation !== epoch.current) return;
    if (current?.id !== user?.id) {
      epoch.current += 1;
      resetRequestScope();
      repositoryService.clearCache();
    }
    repositoryService.setAccount(current?.id || null);
    setUser(current);
  }, [user?.id]);
  const redirectLogin = async (_value: string): Promise<User> => {
    window.location.assign(`${import.meta.env.VITE_API_URL || '/api'}/auth/github/login`);
    throw new Error('Redirecting to GitHub');
  };
  const selectedRepoIds = user
    ? selection?.userId === user.id
      ? selection.ids
      : readSelection(user.id)
    : null;
  return (
    <AuthContext.Provider
      value={{
        user,
        token: null,
        username: user?.username || null,
        isAuthenticated: !!user && !isAuthExpired,
        isLoading,
        isAuthExpired,
        triggerAuthExpired: () => clearSession(true),
        selectedRepoIds,
        setSelectedRepoIds,
        loginWithToken: redirectLogin,
        loginWithUsername: redirectLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
      <SessionExpiredModal isOpen={isAuthExpired} />
    </AuthContext.Provider>
  );
};
