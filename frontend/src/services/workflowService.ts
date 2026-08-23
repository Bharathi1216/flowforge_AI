import apiClient, { USE_MOCK_DATA } from './apiClient';
import { Workflow, WorkflowRun } from '../types';
import { mockWorkflows, mockWorkflowRuns } from '../mock/data';

export const workflowService = {
  async getWorkflows(repoId: string): Promise<Workflow[]> {
    if (USE_MOCK_DATA) {
      const id = repoId.toLowerCase().includes('flowforge') ? 'repo-1' : 'repo-2';
      return Promise.resolve(mockWorkflows[id] || []);
    }
    const response = await apiClient.get(`/repositories/${repoId}/workflows`);
    return response.data;
  },

  async getWorkflowRuns(repoId: string): Promise<WorkflowRun[]> {
    if (USE_MOCK_DATA) {
      // Find the repository ID matching the name
      const key = repoId.toLowerCase().includes('flowforge') ? 'repo-1' 
                : repoId.toLowerCase().includes('educheck') ? 'repo-2'
                : repoId.toLowerCase().includes('disaster') ? 'repo-3'
                : repoId.toLowerCase().includes('german') ? 'repo-4' : repoId;
      return Promise.resolve(mockWorkflowRuns[key] || []);
    }
    const response = await apiClient.get(`/repositories/${repoId}/workflows/runs`);
    return response.data;
  },

  async getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
    if (USE_MOCK_DATA) {
      for (const key of Object.keys(mockWorkflowRuns)) {
        const run = mockWorkflowRuns[key].find(r => r.id === runId || r.runNumber.toString() === runId);
        if (run) return Promise.resolve(run);
      }
      return Promise.resolve(null);
    }
    const response = await apiClient.get(`/workflows/runs/${runId}`);
    return response.data;
  },

  async retryWorkflow(runId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      // Simulate running status change for visual cues
      for (const key of Object.keys(mockWorkflowRuns)) {
        const run = mockWorkflowRuns[key].find(r => r.id === runId);
        if (run) {
          run.status = 'running';
          run.logsAnalysed = false;
          // Set timeout to succeed
          setTimeout(() => {
            run.status = 'success';
          }, 6000);
        }
      }
      return Promise.resolve();
    }
    await apiClient.post(`/workflows/${runId}/retry`);
  }
};
