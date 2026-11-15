import { LogLine } from '../types';
import apiClient from './apiClient';

export const logService = {
  async getWorkflowLogs(runId: string, repoId: string): Promise<LogLine[]> {
    const response = await apiClient.get<LogLine[]>(
      `/repositories/${encodeURIComponent(repoId)}/workflows/${encodeURIComponent(runId)}/logs`,
    );
    return response.data;
  },
};
