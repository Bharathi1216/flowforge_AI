import apiClient, { USE_MOCK_DATA } from './apiClient';
import { KnowledgeItem } from '../types';
import { mockKnowledgeBase } from '../mock/data';

export const knowledgeService = {
  async getKnowledgeBase(repoId: string): Promise<KnowledgeItem[]> {
    if (USE_MOCK_DATA) {
      const key = repoId.toLowerCase().includes('flowforge') ? 'repo-1' : repoId;
      return Promise.resolve(mockKnowledgeBase[key] || []);
    }
    const response = await apiClient.get(`/repositories/${repoId}/knowledge`);
    return response.data;
  }
};
