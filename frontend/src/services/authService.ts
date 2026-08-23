import apiClient, { USE_MOCK_DATA } from './apiClient';
import { User } from '../types';
import { mockCurrentUser } from '../mock/data';

export const authService = {
  async loginWithGitHub(): Promise<{ redirectUrl: string } | null> {
    if (USE_MOCK_DATA) {
      // Simulate OAuth redirect or session resolution
      return { redirectUrl: '/dashboard' };
    }
    const response = await apiClient.get('/auth/github/url');
    return response.data;
  },

  async getCurrentUser(): Promise<User | null> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(mockCurrentUser);
    }
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  async logout(): Promise<void> {
    if (USE_MOCK_DATA) {
      return Promise.resolve();
    }
    await apiClient.post('/auth/logout');
  }
};
