import { createContext, useContext } from 'react';
import { AIMessage } from '../types';
interface AIAssistantContextType {
  conversations: Record<string, AIMessage[]>;
  updateMessages: (repoId: string, update: (messages: AIMessage[]) => AIMessage[]) => void;
  isOpen: boolean;
  openAssistant: (initialPrompt?: string, repoContext?: string) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  currentRepoContext: string | null;
  initialPrompt: string | null;
  setInitialPrompt: (prompt: string | null) => void;
}

export const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

export const useAIAssistant = () => {
  const context = useContext(AIAssistantContext);
  if (!context) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
};
