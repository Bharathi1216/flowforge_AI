import React, { lazy, Suspense, useState } from 'react';
import { CommandPalette } from '../components/CommandPalette';
import { TopNav } from '../components/TopNav';
import { useAIAssistant } from '../contexts/assistantState';
const AIAssistantDrawer = lazy(() =>
  import('../components/AIAssistantDrawer').then((module) => ({
    default: module.AIAssistantDrawer,
  })),
);

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { isOpen: assistantOpen } = useAIAssistant();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  React.useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#080B12] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* TopNav Header bar */}
      <TopNav onOpenSearch={() => setIsCommandPaletteOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>

      {/* Global Command Palette search overlay (âŒ˜K / Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Slide-over FlowForge AI Assistant Drawer (Triggered by repository header button or âŒ˜J) */}
      {assistantOpen && (
        <Suspense fallback={null}>
          <AIAssistantDrawer />
        </Suspense>
      )}
    </div>
  );
};
