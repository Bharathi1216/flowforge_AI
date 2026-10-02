import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { repositoryService } from '../services/repositoryService';
import { SessionExpiredModal } from '../components/SessionExpiredModal';

interface AuthContextType {
  user: User | null;
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthExpired: boolean;
  triggerAuthExpired: () => void;
  selectedRepoNames: string[];
  loginWithToken: (token: string) => Promise<User>;
  loginWithUsername: (username: string) => Promise<User>;
  logout: () => Promise<void>;
  setSelectedRepoNames: (repos: string[]) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthExpired, setIsAuthExpired] = useState(false);
  const [selectedRepoNames, setSelectedRepoNamesState] = useState<string[]>([]);

  useEffect(() => {
    const handleExpiredEvent = () => {
      setIsAuthExpired(true);
      setUser(null);
    };

    window.addEventListener('flowforge:auth-expired', handleExpiredEvent);
    return () => {
      window.removeEventListener('flowforge:auth-expired', handleExpiredEvent);
    };
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        setToken(null);
        setUsername(currentUser?.username || null);
      } catch (e: any) {
        const detail = e?.response?.data?.detail;
        if (typeof detail === 'string' && detail.toLowerCase().includes('expired')) {
          setIsAuthExpired(true);
        }
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const loginWithToken = async (newToken: string): Promise<User> => {
    void newToken;
    window.location.href = `${import.meta.env.VITE_API_URL || '/api'}/auth/github/login`;
    throw new Error('Redirecting to GitHub');
  };

  const loginWithUsername = async (newUsername: string): Promise<User> => {
    void newUsername;
    window.location.href = `${import.meta.env.VITE_API_URL || '/api'}/auth/github/login`;
    throw new Error('Redirecting to GitHub');
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      repositoryService.clearCache();
      setUser(null);
      setToken(null);
      setUsername(null);
      setIsAuthExpired(false);
      setSelectedRepoNamesState([]);
    }
  };

  const setSelectedRepoNames = useCallback((repos: string[]) => {
    setSelectedRepoNamesState(repos);
  }, []);

  const refreshUser = async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
    setUsername(currentUser?.username || null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        username,
        isAuthenticated: !!user && !isAuthExpired,
        isLoading,
        isAuthExpired,
        triggerAuthExpired: () => {
          setIsAuthExpired(true);
          setUser(null);
        },
        selectedRepoNames,
        loginWithToken,
        loginWithUsername,
        logout,
        setSelectedRepoNames,
        refreshUser,
      }}
    >
      {children}
      <SessionExpiredModal isOpen={isAuthExpired} />
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
