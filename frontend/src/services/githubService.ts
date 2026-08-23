import apiClient, { USE_MOCK_DATA } from './apiClient';
import { mockGithubRepositories } from '../mock/data';

export interface GithubRepo {
  name: string;
  owner: string;
  isPrivate: boolean;
  description: string;
  language: string;
  added: boolean;
}

export const githubService = {
  async getGithubRepositories(): Promise<GithubRepo[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(mockGithubRepositories);
    }
    const response = await apiClient.get('/github/repositories');
    return response.data;
  },

  async connectGithubAccount(): Promise<void> {
    if (USE_MOCK_DATA) {
      return Promise.resolve();
    }
    await apiClient.post('/github/connect');
  },

  async disconnectGithubAccount(): Promise<void> {
    if (USE_MOCK_DATA) {
      return Promise.resolve();
    }
    await apiClient.post('/github/disconnect');
  },

  async addRepositoryAccess(owner: string, name: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const repo = mockGithubRepositories.find(r => r.owner === owner && r.name === name);
      if (repo) {
        repo.added = true;
      }
      return Promise.resolve();
    }
    await apiClient.post(`/github/repositories/add`, { owner, name });
  }
};
