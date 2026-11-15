import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AIMessage } from '../types';
import { AIAssistantContext } from './assistantState';

export const AIAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentRepoContext, setCurrentRepoContext] = useState<string | null>(null);
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Record<string, AIMessage[]>>({});
  const location = useLocation();
  const routeRepo = location.pathname.match(/^\/repositories\/([^/]+)/)?.[1];
  const selectedContext = routeRepo ? decodeURIComponent(routeRepo) : currentRepoContext;
  const updateMessages = useCallback(
    (repoId: string, update: (messages: AIMessage[]) => AIMessage[]) => {
      setConversations((current) => ({ ...current, [repoId]: update(current[repoId] || []) }));
    },
    [],
  );

  const openAssistant = useCallback((prompt?: string, repoContext?: string) => {
    setInitialPrompt(prompt || null);
    if (repoContext) setCurrentRepoContext(repoContext);
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
  }, []);

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
        conversations,
        updateMessages,
        isOpen,
        openAssistant,
        closeAssistant,
        toggleAssistant,
        currentRepoContext: selectedContext,
        initialPrompt,
        setInitialPrompt,
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
};
