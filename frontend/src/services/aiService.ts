import axios from 'axios';
import { AIMessage, FailureAnalysis, WorkflowRun } from '../types';
import apiClient from './apiClient';

export const aiService = {
  async getSavedAnalysis(runId: string, repoId: string): Promise<FailureAnalysis | null> {
    try {
      return (
        await apiClient.get<FailureAnalysis>(
          `/repositories/${encodeURIComponent(repoId)}/workflows/${encodeURIComponent(runId)}/analysis`,
        )
      ).data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  },
  async analyzeFailure(
    runId: string,
    _runData: WorkflowRun | undefined,
    repoId: string,
  ): Promise<FailureAnalysis> {
    return (
      await apiClient.post<FailureAnalysis>(
        `/repositories/${encodeURIComponent(repoId)}/workflows/${encodeURIComponent(runId)}/analysis`,
      )
    ).data;
  },
  async reanalyzeFailure(runId: string, repoId: string): Promise<FailureAnalysis> {
    return (
      await apiClient.post<FailureAnalysis>(
        `/repositories/${encodeURIComponent(repoId)}/workflows/${encodeURIComponent(runId)}/analysis`,
        null,
        { params: { reanalyze: true } },
      )
    ).data;
  },
  async chatWithAssistant(repoId: string, messages: AIMessage[]): Promise<AIMessage> {
    return (
      await apiClient.post<AIMessage>(`/repositories/${encodeURIComponent(repoId)}/ai/chat`, {
        messages: messages.slice(-50),
      })
    ).data;
  },
  async generateOnboardingGuide(_repoId: string): Promise<never> {
    throw new Error('Repository onboarding guides are not available yet.');
  },
};
