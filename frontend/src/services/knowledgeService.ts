import { KnowledgeItem } from '../types';
import apiClient from './apiClient';
export const knowledgeService = {
  async getKnowledgeBase(repoId: string): Promise<KnowledgeItem[]> {
    return (
      await apiClient.get<KnowledgeItem[]>(`/repositories/${encodeURIComponent(repoId)}/knowledge`)
    ).data;
  },
};
