import { Collaborator } from '../types';
import apiClient from './apiClient';

export const teamService = {
  async getMembers(repoId: string): Promise<Collaborator[]> {
    const response = await apiClient.get<Collaborator[]>(`/repositories/${repoId}/collaborators`);
    return response.data;
  },

  async manageAccess(repoId: string, username: string, role: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
  }
};
