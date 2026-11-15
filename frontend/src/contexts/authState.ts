import { createContext, useContext } from 'react';
import { User } from '../types';
interface AuthState {
  user: User | null;
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthExpired: boolean;
  triggerAuthExpired: () => void;
  selectedRepoIds: string[] | null;
  setSelectedRepoIds: (ids: string[]) => void;
  loginWithToken: (token: string) => Promise<User>;
  loginWithUsername: (username: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
export const AuthContext = createContext<AuthState | undefined>(undefined);
export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth must be used within an AuthProvider');
  return state;
}
