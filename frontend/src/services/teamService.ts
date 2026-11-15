import { Collaborator } from '../types';
import apiClient from './apiClient';

export const teamService = {
  async getMembers(repoId: string): Promise<Collaborator[]> {
    const response = await apiClient.get<Collaborator[]>(
      `/repositories/${encodeURIComponent(repoId)}/collaborators`,
    );
    return response.data;
  },

  async manageAccess(_repoId: string, _username: string, _role: string): Promise<void> {
    throw new Error('Manage repository collaborators directly on GitHub.');
  },
};
