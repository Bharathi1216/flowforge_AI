import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  const [selectedRepoNames, setSelectedRepoNamesState] = useState<string[]>([]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        setToken(null);
        setUsername(currentUser?.username || null);
      } catch (e) {
        console.error('Error initializing AuthProvider:', e);
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
      setUser(null);
      setToken(null);
      setUsername(null);
      setSelectedRepoNamesState([]);
    }
  };

  const setSelectedRepoNames = (repos: string[]) => {
    setSelectedRepoNamesState(repos);
  };

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
        isAuthenticated: !!user,
        isLoading,
        selectedRepoNames,
        loginWithToken,
        loginWithUsername,
        logout,
        setSelectedRepoNames,
        refreshUser,
      }}
    >
      {children}
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
