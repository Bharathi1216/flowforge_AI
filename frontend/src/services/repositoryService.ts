import apiClient, { USE_MOCK_DATA } from './apiClient';
import { Repository } from '../types';
import { mockRepositories } from '../mock/data';

export const repositoryService = {
  async getRepositories(): Promise<Repository[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(mockRepositories);
    }
    const response = await apiClient.get('/repositories');
    return response.data;
  },

  async getRepository(repoId: string): Promise<Repository | null> {
    if (USE_MOCK_DATA) {
      const repo = mockRepositories.find(r => r.id === repoId || r.name.toLowerCase() === repoId.toLowerCase());
      return Promise.resolve(repo || null);
    }
    const response = await apiClient.get(`/repositories/${repoId}`);
    return response.data;
  },

  async regenerateRepositorySummary(repoId: string): Promise<string> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 1500)); // simulate AI generation time
      return Promise.resolve(
        `FlowForge AI generated description: ${repoId} is a workspace focused on solving key build dependencies, orchestrating test-coverage monitoring, and providing RAG context pipelines for code failures.`
      );
    }
    const response = await apiClient.post(`/repositories/${repoId}/regenerate-summary`);
    return response.data.summary;
  }
};
