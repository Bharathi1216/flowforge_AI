import { Workflow, WorkflowRun } from '../types';
import apiClient from './apiClient';

export const workflowService = {
  async getWorkflows(repoId: string): Promise<Workflow[]> {
    const response = await apiClient.get<Workflow[]>(`/repositories/${repoId}/workflows/definitions`);
    return response.data;
  },

  async getWorkflowRuns(repoId: string, refresh = false): Promise<WorkflowRun[]> {
    const response = await apiClient.get<WorkflowRun[]>(`/repositories/${encodeURIComponent(repoId)}/workflows`, {
      params: refresh ? { refresh: true } : undefined,
    });
    return response.data;
  },

  async getWorkflowRun(runId: string): Promise<WorkflowRun | null> {
    void runId;
    return null;
  },

  async retryWorkflow(repoId: string, runId: string): Promise<void> {
    await apiClient.post(`/repositories/${repoId}/workflows/${runId}/retry`);
  }
};
