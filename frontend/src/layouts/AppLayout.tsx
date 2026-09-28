import React, { useState } from 'react';
import { TopNav } from '../components/TopNav';
import { CommandPalette } from '../components/CommandPalette';
import { AIAssistantDrawer } from '../components/AIAssistantDrawer';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080B12] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* TopNav Header bar */}
      <TopNav onOpenSearch={() => setIsCommandPaletteOpen(true)} />

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
        {children}
      </main>

      {/* Global Command Palette search overlay (⌘K / Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />

      {/* Slide-over FlowForge AI Assistant Drawer (Triggered by repository header button or ⌘J) */}
      <AIAssistantDrawer />
    </div>
  );
};


