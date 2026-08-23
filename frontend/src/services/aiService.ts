import apiClient, { USE_MOCK_DATA } from './apiClient';
import { FailureAnalysis, AIMessage } from '../types';
import { mockFailureAnalysis, mockOnboardingGuide } from '../mock/data';

export const aiService = {
  async analyzeFailure(runId: string): Promise<FailureAnalysis | null> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return Promise.resolve(mockFailureAnalysis[runId] || null);
    }
    const response = await apiClient.post(`/workflows/${runId}/analyze`);
    return response.data;
  },

  async chatWithAssistant(repoId: string, messages: AIMessage[]): Promise<AIMessage> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const userMessage = messages[messages.length - 1].content.toLowerCase();
      
      let reply = "I am scanning your codebase. How can I help you analyze failures today?";
      let sources: string[] = ['README.md'];

      if (userMessage.includes('fail') || userMessage.includes('latest workflow')) {
        reply = "Looking at the latest build failure for **FlowForge-AI** (Run #184), the error was a peer dependency tree mismatch (`ERESOLVE`). React 19 is conflicting with React Router Dom v6, which requires React 18.";
        sources = ['Workflow Run #184', 'package.json', 'Discussion #1'];
      } else if (userMessage.includes('happen before') || userMessage.includes('error occurred before')) {
        reply = "Yes, similar package peer lock errors occurred in the **German-Bharatham** repository during commit #eeddcc. Sarah Connor fixed it by adding the `--legacy-peer-deps` flag to the CI build script.";
        sources = ['Workflow Run #54', 'Knowledge Base Item #2', 'Discussion #3'];
      } else if (userMessage.includes('who fixed')) {
        reply = "Sarah Connor resolved a similar dependency conflict 3 days ago. You can view her solution in Discussion #3, which involved locking build libraries to React 18 compatibility ranges.";
        sources = ['Collaborators list', 'Discussion #3', 'Release v1.2.0'];
      } else if (userMessage.includes('structure') || userMessage.includes('folders')) {
        reply = "This repository uses a structured monorepo layout:\n- `frontend/`: The Vite-React application UI.\n- `backend/`: FastAPI controller services.\n- `ai-service/`: Holds Gemini model definitions and ChromaDB RAG script indexing.";
        sources = ['README.md', 'docker-compose.yml'];
      }

      return {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources
      };
    }
    
    const response = await apiClient.post(`/repositories/${repoId}/assistant`, { messages });
    return response.data;
  },

  async generateOnboardingGuide(repoId: string): Promise<typeof mockOnboardingGuide> {
    if (USE_MOCK_DATA) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return Promise.resolve(mockOnboardingGuide);
    }
    const response = await apiClient.post(`/repositories/${repoId}/onboarding`);
    return response.data;
  }
};
