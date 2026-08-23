import apiClient, { USE_MOCK_DATA } from './apiClient';
import { Release } from '../types';
import { mockReleases } from '../mock/data';

export const releaseService = {
  async getReleases(repoId: string): Promise<Release[]> {
    if (USE_MOCK_DATA) {
      const key = repoId.toLowerCase().includes('flowforge') ? 'repo-1' : repoId;
      return Promise.resolve(mockReleases[key] || []);
    }
    const response = await apiClient.get(`/repositories/${repoId}/releases`);
    return response.data;
  },

  async generateReleaseSummary(repoId: string, releaseId: string): Promise<NonNullable<Release['aiSummary']>> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return Promise.resolve({
        features: [
          'Added direct context bindings in terminal viewer logs.',
          'Created initial workspace layouts for repository details.'
        ],
        fixes: [
          'Resolved peer dependencies ERESOLVE in action scripts.',
          'Fixed dark theme switching flickering effects.'
        ],
        breaking: [
          'Downgraded React compilation target to React 18 compatible bounds.'
        ],
        changes: [
          'Updated project build path in tailwind configs.'
        ]
      });
    }
    const response = await apiClient.post(`/repositories/${repoId}/releases/${releaseId}/summary`);
    return response.data;
  }
};
