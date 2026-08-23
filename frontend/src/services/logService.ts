import apiClient, { USE_MOCK_DATA } from './apiClient';
import { LogLine } from '../types';
import { mockLogs } from '../mock/data';

export const logService = {
  async getWorkflowLogs(runId: string): Promise<LogLine[]> {
    if (USE_MOCK_DATA) {
      // Return log run or default info lines
      return Promise.resolve(mockLogs[runId] || [
        { lineNumber: 1, timestamp: new Date().toISOString(), type: 'info', message: 'Retrieving runner metadata...' },
        { lineNumber: 2, timestamp: new Date().toISOString(), type: 'info', message: 'Pulling dependency tree...' },
        { lineNumber: 3, timestamp: new Date().toISOString(), type: 'success', message: 'Compilation succeeded with 0 warnings.' }
      ] as LogLine[]);
    }
    const response = await apiClient.get(`/workflows/runs/${runId}/logs`);
    return response.data;
  }
};
