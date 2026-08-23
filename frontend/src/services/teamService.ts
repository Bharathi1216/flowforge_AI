import apiClient, { USE_MOCK_DATA } from './apiClient';
import { Collaborator } from '../types';
import { mockCollaborators } from '../mock/data';

export const teamService = {
  async getMembers(repoId: string): Promise<Collaborator[]> {
    if (USE_MOCK_DATA) {
      const key = repoId.toLowerCase().includes('flowforge') ? 'repo-1' 
                : repoId.toLowerCase().includes('educheck') ? 'repo-2'
                : repoId.toLowerCase().includes('disaster') ? 'repo-3'
                : repoId.toLowerCase().includes('german') ? 'repo-4' : repoId;
      return Promise.resolve(mockCollaborators[key] || []);
    }
    const response = await apiClient.get(`/repositories/${repoId}/team`);
    return response.data;
  },

  async manageAccess(repoId: string, username: string, role: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const key = repoId.toLowerCase().includes('flowforge') ? 'repo-1' 
                : repoId.toLowerCase().includes('educheck') ? 'repo-2'
                : repoId.toLowerCase().includes('disaster') ? 'repo-3'
                : repoId.toLowerCase().includes('german') ? 'repo-4' : repoId;
      const list = mockCollaborators[key] || [];
      const member = list.find(m => m.username === username);
      if (member) {
        member.role = role as any;
      }
      return Promise.resolve();
    }
    await apiClient.post(`/repositories/${repoId}/team/access`, { username, role });
  }
};
