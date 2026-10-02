import { Release, User } from '../types';
import { workflowService } from './workflowService';

export const releaseService = {
  async getReleases(repoId: string): Promise<Release[]> {
    try {
      const runs = await workflowService.getWorkflowRuns(repoId);
      const successfulRuns = runs.filter((r) => r.status === 'success');

      if (successfulRuns.length === 0) {
        return [];
      }

      return successfulRuns.slice(0, 5).map((run, index) => {
        const versionNumber = `v1.${successfulRuns.length - index}.0`;
        const author: User = run.triggeredBy || {
          id: '1',
          username: 'author',
          name: 'Author',
          avatarUrl: '',
          email: '',
          githubUrl: '',
        };

        return {
          id: `rel-${run.id}`,
          repoId,
          version: versionNumber,
          name: `${run.name} Build #${run.runNumber}`,
          tagName: versionNumber,
          publishedAt: run.completedAt || run.timestamp || new Date().toISOString(),
          prCount: 1,
          commitCount: run.runNumber,
          author,
          aiSummary: {
            features: [`Automated CI build #${run.runNumber} on branch ${run.branch}`],
            fixes: [run.commitMessage || 'Pipeline execution completed successfully'],
            breaking: [],
            changes: [`Commit SHA: ${run.commitSha || 'HEAD'}`],
          },
        };
      });
    } catch {
      return [];
    }
  },

  async generateChangelog(repoId: string, fromTag: string, toTag: string) {
    return {
      features: [`Automated CI/CD tracking for ${repoId} (${fromTag} → ${toTag})`],
      fixes: ['Pipeline execution & error tracking updates'],
      breaking: [],
      changes: ['Live repository commit & workflow status synchronization'],
    };
  }
};

