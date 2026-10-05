import { FailureAnalysis, AIMessage, WorkflowRun } from '../types';
import apiClient from './apiClient';

export const aiService = {
  async analyzeFailure(runId: string, runData?: WorkflowRun, repoName?: string): Promise<FailureAnalysis | null> {
    const targetRepo = repoName || 'repository';
    try {
      const response = await apiClient.post<FailureAnalysis>(
        `/repositories/${encodeURIComponent(targetRepo)}/workflows/${encodeURIComponent(runId)}/analysis`
      );
      return response.data;
    } catch (err) {
      console.warn('Backend AI analysis endpoint unavailable, using run diagnostic info:', err);
      if (runData?.diagnosticInfo) {
        return {
          id: `diag-${runId}`,
          runId,
          title: `Diagnostic Analysis for Run #${runData.runNumber}`,
          summary: runData.diagnosticInfo.errorSnippet || `Failure in workflow ${runData.name} on branch ${runData.branch}.`,
          rootCause: runData.diagnosticInfo.rootCause || 'Workflow step failed with non-zero exit code.',
          suggestedFix: runData.diagnosticInfo.suggestedFix || 'Review step execution logs and test locally.',
          relevantDocs: [{ title: 'GitHub Actions Documentation', url: 'https://docs.github.com/en/actions' }],
          previousDiscussions: [],
        };
      }
      return null;
    }
  },

  async chatWithAssistant(repoId: string, messages: AIMessage[]): Promise<AIMessage> {
    try {
      const response = await apiClient.post<AIMessage>(
        `/repositories/${encodeURIComponent(repoId)}/ai/chat`,
        {
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
          })),
        }
      );
      return response.data;
    } catch (err) {
      console.warn('Backend AI chat request failed, falling back to local assistant:', err);
      const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || '';
      let reply = `I am your FlowForge AI assistant connected to **${repoId}**. Ask me about workflow failure diagnostics, repository architecture, or collaborators.`;
      const sources: string[] = [`Repository: ${repoId}`];

      if (lastMsg.includes('fail') || lastMsg.includes('error') || lastMsg.includes('why')) {
        reply = `To inspect failures in **${repoId}**, switch to the **Failure Analysis** tab to view step-by-step logs, or use the **Workflows** tab to trigger a rerun.`;
        sources.push('GitHub Actions Runs API');
      } else if (lastMsg.includes('who') || lastMsg.includes('team') || lastMsg.includes('contributor')) {
        reply = `Active team members and contributors for **${repoId}** are listed in the **Team** tab with recent contribution counts.`;
        sources.push('GitHub Contributors API');
      }

      return {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources,
      };
    }
  },

  async generateOnboardingGuide(repoId: string) {
    return {
      repoName: repoId,
      architectureSummary: `Active GitHub workspace for ${repoId} monitored with automated CI/CD intelligence.`,
      keyDirectories: [
        { path: '.github/workflows', purpose: 'Automated CI/CD workflows and deployment actions' },
        { path: 'src/', purpose: 'Core application source code' },
      ],
      setupSteps: [
        { step: 1, title: 'Clone Repository', command: `git clone https://github.com/${repoId}.git` },
        { step: 2, title: 'Install Dependencies', command: 'npm install' },
        { step: 3, title: 'Start Development Server', command: 'npm run dev' },
      ],
    };
  }
};
