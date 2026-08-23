import React, { useState } from 'react';
import { Sidebar } from '../components/Sidebar';
import { CommandPalette } from '../components/CommandPalette';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Sidebar Navigation */}
      <Sidebar onOpenCommandPalette={() => setIsCommandPaletteOpen(true)} />

      {/* Main Content Pane */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>

      {/* Global Command Palette search overlay */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};
