import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Terminal, MessageSquare, Users, FileText, X, FolderGit2, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { repositoryService } from '../services/repositoryService';
import { Repository } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [repos, setRepos] = useState<Repository[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      repositoryService.getRepositories().then(setRepos).catch(console.error);
    }
  }, [isOpen]);

  // Flattened search items
  const items = React.useMemo(() => {
    const results: { type: 'repo' | 'nav' | 'action'; title: string; subtitle: string; link: string }[] = [];

    // Global navigation shortcuts
    results.push({
      type: 'nav',
      title: 'Dashboard',
      subtitle: 'Go to main repositories overview',
      link: '/dashboard',
    });
    results.push({
      type: 'nav',
      title: 'Settings & Account',
      subtitle: 'Manage GitHub connection, themes, and authorized repos',
      link: '/settings',
    });

    const normalizedQuery = query.trim().toLowerCase();

    // Search repositories
    repos.forEach((repo) => {
      if (
        !normalizedQuery ||
        repo.name.toLowerCase().includes(normalizedQuery) ||
        (repo.owner && repo.owner.toLowerCase().includes(normalizedQuery)) ||
        (repo.description && repo.description.toLowerCase().includes(normalizedQuery)) ||
        (repo.language && repo.language.toLowerCase().includes(normalizedQuery))
      ) {
        results.push({
          type: 'repo',
          title: repo.name,
          subtitle: `Repository • @${repo.owner} • ${repo.language || 'Code'} • ${repo.isPrivate ? 'Private' : 'Public'}`,
          link: `/repositories/${repo.name}`,
        });
      }
    });

    return results;
  }, [query, repos]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, items.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % Math.max(1, items.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          navigate(items[selectedIndex].link);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, items, selectedIndex, navigate, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            className="relative w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] shadow-2xl z-10 overflow-hidden"
          >
            {/* Search Input Box */}
            <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
              <Search className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Type a repository name, workflow, or command..."
                className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Items List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1 scrollbar-terminal">
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No matching repositories or commands found.
                </div>
              ) : (
                items.map((item, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <div
                      key={item.link + item.title + index}
                      onClick={() => {
                        navigate(item.link);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-1.5 rounded-lg ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {item.type === 'repo' ? (
                            <FolderGit2 className="h-3.5 w-3.5" />
                          ) : (
                            <Settings className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-bold truncate block">{item.title}</span>
                          <span
                            className={`text-[10px] truncate block ${
                              isSelected ? 'text-purple-100' : 'text-slate-400'
                            }`}
                          >
                            {item.subtitle}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}
                      >
                        Jump
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>Use ↑↓ to navigate, Enter to select</span>
              <span>ESC to close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
