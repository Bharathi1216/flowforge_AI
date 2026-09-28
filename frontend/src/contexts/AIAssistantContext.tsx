import React, { createContext, useContext, useState, useEffect } from 'react';

interface AIAssistantContextType {
  isOpen: boolean;
  openAssistant: (initialPrompt?: string, repoContext?: string) => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  currentRepoContext: string | null;
  initialPrompt: string | null;
  setInitialPrompt: (prompt: string | null) => void;
}

const AIAssistantContext = createContext<AIAssistantContextType | undefined>(undefined);

export const AIAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentRepoContext, setCurrentRepoContext] = useState<string | null>('FlowForge-AI');
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  const openAssistant = (prompt?: string, repoContext?: string) => {
    if (prompt) setInitialPrompt(prompt);
    if (repoContext) setCurrentRepoContext(repoContext);
    setIsOpen(true);
  };

  const closeAssistant = () => {
    setIsOpen(false);
  };

  const toggleAssistant = () => {
    setIsOpen((prev) => !prev);
  };

  // Keyboard shortcut: Cmd+J or Ctrl+J to toggle AI Assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        toggleAssistant();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <AIAssistantContext.Provider
      value={{
        isOpen,
        openAssistant,
        closeAssistant,
        toggleAssistant,
        currentRepoContext,
        initialPrompt,
        setInitialPrompt
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
};

export const useAIAssistant = () => {
  const context = useContext(AIAssistantContext);
  if (!context) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
};
