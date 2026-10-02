import { KnowledgeItem } from '../types';
import apiClient from './apiClient';
import { workflowService } from './workflowService';

export const knowledgeService = {
  async getKnowledgeBase(repoId: string): Promise<KnowledgeItem[]> {
    try {
      const response = await apiClient.get<KnowledgeItem[]>(`/repositories/${repoId}/knowledge`);
      if (response.data && response.data.length > 0) {
        return response.data;
      }
    } catch (e) {
      console.warn('Backend knowledge endpoint unavailable, synthesizing from runs:', e);
    }

    try {
      const runs = await workflowService.getWorkflowRuns(repoId);
      const failedRuns = runs.filter((r) => r.status === 'failed' || r.diagnosticInfo);

      const items: KnowledgeItem[] = [];

      failedRuns.forEach((run, index) => {
        items.push({
          id: `kb-failure-${run.id}`,
          repoId,
          errorType: run.diagnosticInfo?.errorType || `${run.name} Step Failure`,
          occurrences: 1,
          lastResolvedAt: run.completedAt || run.timestamp || 'Recent',
          suggestedFix: run.diagnosticInfo?.suggestedFix || 'Inspect workflow step logs and ensure required repository environment secrets are configured.',
          similarRunId: run.id,
          similarRunNumber: run.runNumber,
          category: 'failure',
        });
      });

      // Add architectural docs knowledge
      items.push({
        id: `kb-docs-${repoId}-ci`,
        repoId,
        errorType: 'CI/CD Pipeline Architecture',
        occurrences: runs.length,
        lastResolvedAt: 'Current',
        suggestedFix: 'Workflow runs are executed via GitHub Actions runners defined under .github/workflows.',
        category: 'docs',
      });

      return items;
    } catch {
      return [
        {
          id: `kb-docs-${repoId}`,
          repoId,
          errorType: 'CI/CD Pipeline Architecture',
          occurrences: 1,
          lastResolvedAt: 'Current',
          suggestedFix: 'Standardize GitHub Actions workflow definitions in .github/workflows directory.',
          category: 'docs',
        },
      ];
    }
  }
};
