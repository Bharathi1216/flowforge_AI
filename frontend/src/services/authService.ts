import { User } from '../types';
import apiClient from './apiClient';

export const authService = {
  async loginWithGitHub(): Promise<{ redirectUrl: string } | null> {
    return { redirectUrl: `${import.meta.env.VITE_API_URL || '/api'}/auth/github/login` };
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await apiClient.get<User>('/auth/me');
      return response.data;
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  }
};
