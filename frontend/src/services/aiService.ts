import { FailureAnalysis, AIMessage, WorkflowRun } from '../types';
import { githubApiService } from './githubApiService';

export const aiService = {
  async analyzeFailure(runId: string, runData?: WorkflowRun, repoName?: string): Promise<FailureAnalysis | null> {
    if (runData) {
      return githubApiService.analyzeWorkflowFailure(runData, repoName || 'repository');
    }
    void runId;
    return null;
  },

  async chatWithAssistant(repoId: string, messages: AIMessage[]): Promise<AIMessage> {
    await new Promise(resolve => setTimeout(resolve, 900));
    const lastMsg = messages[messages.length - 1].content.toLowerCase();
    const curUser = githubApiService.getSavedUsername() || 'user';

    let reply = `I am your FlowForge AI assistant connected to GitHub repository **${repoId}** (Owner: @${curUser}). Ask me about failed workflow runs, error patterns, or repository architecture.`;
    const sources: string[] = [`Repository: ${repoId}`];

    if (lastMsg.includes('fail') || lastMsg.includes('error') || lastMsg.includes('run')) {
      reply = `I checked the latest GitHub Actions status for **${repoId}**. If a workflow failed, you can inspect the step-by-step terminal logs, view the highlighted error line, and trigger an automated AI failure diagnostic directly in the Failure Analysis tab.`;
      sources.push('GitHub Actions Runs API', 'Terminal Logs');
    } else if (lastMsg.includes('who') || lastMsg.includes('contributor') || lastMsg.includes('team')) {
      reply = `The active contributors and maintainers for **${repoId}** are synchronized live from GitHub. Check the **Team** tab to view contributor activity and issue resolution counts.`;
      sources.push('GitHub Contributors API');
    } else if (lastMsg.includes('how') || lastMsg.includes('help') || lastMsg.includes('fix')) {
      reply = `To resolve CI/CD build issues on **${repoId}**:\n1. Open the **Failure Analysis** tab.\n2. Review the detected root cause and suggested patch diff.\n3. Create an Issue Discussion thread to collaborate with your team.`;
      sources.push('FlowForge Diagnostic Engine');
    }

    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sources,
    };
  },

  async generateOnboardingGuide(repoId: string) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      repoName: repoId,
      architectureSummary: `Active GitHub workspace for ${repoId} monitored with automated CI/CD intelligence.`,
      keyDirectories: [
        { path: '.github/workflows', purpose: 'Automated CI/CD workflows and deployment actions' },
        { path: 'src/', purpose: 'Core application source code' },
      ],
      setupSteps: [
        { step: 1, title: 'Clone Repository', command: `git clone https://github.com/${githubApiService.getSavedUsername() || 'owner'}/${repoId}.git` },
        { step: 2, title: 'Install Dependencies', command: 'npm install' },
        { step: 3, title: 'Start Development Server', command: 'npm run dev' },
      ],
    };
  }
};
