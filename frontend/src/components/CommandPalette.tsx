import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Terminal, MessageSquare, Users, FileText, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { mockRepositories, mockWorkflowRuns, mockDiscussions, mockCollaborators } from '../mock/data';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Flattened search items
  const items = React.useMemo(() => {
    if (!query) return [];

    const normalizedQuery = query.toLowerCase();
    const results: { type: 'repo' | 'workflow' | 'discussion' | 'team' | 'docs'; title: string; subtitle: string; link: string }[] = [];

    // Search repositories
    mockRepositories.forEach(repo => {
      if (repo.name.toLowerCase().includes(normalizedQuery) || repo.description.toLowerCase().includes(normalizedQuery)) {
        results.push({
          type: 'repo',
          title: repo.name,
          subtitle: `Repository • ${repo.language} • ${repo.isPrivate ? 'Private' : 'Public'}`,
          link: `/repositories/${repo.name}`
        });
      }
    });

    // Search workflows/failures
    Object.keys(mockWorkflowRuns).forEach(repoId => {
      mockWorkflowRuns[repoId].forEach(run => {
        if (
          run.name.toLowerCase().includes(normalizedQuery) ||
          run.commitMessage.toLowerCase().includes(normalizedQuery) ||
          run.failureSummary?.toLowerCase().includes(normalizedQuery)
        ) {
          results.push({
            type: 'workflow',
            title: `Run #${run.runNumber} - ${run.name}`,
            subtitle: `Workflow run • ${run.status.toUpperCase()} on branch ${run.branch} • ${run.commitMessage}`,
            link: `/repositories/${repoId}/workflows/${run.id}`
          });
        }
      });
    });

    // Search discussions
    Object.keys(mockDiscussions).forEach(repoId => {
      mockDiscussions[repoId].forEach(disc => {
        if (disc.title.toLowerCase().includes(normalizedQuery)) {
          results.push({
            type: 'discussion',
            title: disc.title,
            subtitle: `Discussion • Status: ${disc.status} • Created by ${disc.author.name}`,
            link: `/repositories/${repoId}/discussions`
          });
        }
      });
    });

    // Search team members
    Object.keys(mockCollaborators).forEach(repoId => {
      mockCollaborators[repoId].forEach(member => {
        if (member.name.toLowerCase().includes(normalizedQuery) || member.username.toLowerCase().includes(normalizedQuery)) {
          results.push({
            type: 'team',
            title: member.name,
            subtitle: `@${member.username} • Collaborator role: ${member.role}`,
            link: `/repositories/${repoId}/team`
          });
        }
      });
    });

    return results.slice(0, 10); // cap results
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        navigate(items[selectedIndex].link);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'repo':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'workflow':
        return <Terminal className="w-4 h-4 text-rose-500" />;
      case 'discussion':
        return <MessageSquare className="w-4 h-4 text-violet-500" />;
      case 'team':
        return <Users className="w-4 h-4 text-emerald-500" />;
      default:
        return <Search className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
          />

          {/* Search container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
              <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search repositories, workflows, logs, team discussions..."
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                className="ml-3 flex-1 bg-transparent text-[15px] outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
              />
              <button
                onClick={onClose}
                className="rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-500 dark:text-slate-500 dark:hover:text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[350px] overflow-y-auto p-2 scrollbar-terminal">
              {!query ? (
                <div className="p-4 text-center text-sm text-slate-400 dark:text-slate-500">
                  Type to search FlowForge workspaces...
                  <div className="mt-2 flex justify-center gap-2 text-xs">
                    <kbd className="rounded border border-slate-200 px-1.5 py-0.5 dark:border-slate-800">↑↓</kbd> to navigate
                    <kbd className="rounded border border-slate-200 px-1.5 py-0.5 dark:border-slate-800">enter</kbd> to select
                    <kbd className="rounded border border-slate-200 px-1.5 py-0.5 dark:border-slate-800">esc</kbd> to exit
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No results found matching "{query}"
                </div>
              ) : (
                <div className="space-y-0.5">
                  <div className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">
                    Search Results ({items.length})
                  </div>
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        navigate(item.link);
                        onClose();
                      }}
                      className={`flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                        idx === selectedIndex
                          ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-hover'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="mt-0.5 rounded p-1 bg-slate-100 dark:bg-slate-800">
                        {getIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.title}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{item.subtitle}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
