import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, ShieldCheck, Check, Plus, FolderGit2, RefreshCw } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { repositoryService } from '../services/repositoryService';
import { Repository } from '../types';
import { useToast } from '../contexts/ToastContext';

interface AddRepositoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedRepoNames: string[];
  onSavePermissions: (enabledNames: string[]) => void;
}

export const AddRepositoryModal: React.FC<AddRepositoryModalProps> = ({
  isOpen,
  onClose,
  connectedRepoNames,
  onSavePermissions,
}) => {
  const { success } = useToast();
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [allRepos, setAllRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedRepos([...connectedRepoNames]);
      loadRepos();
    }
  }, [isOpen, connectedRepoNames]);

  const loadRepos = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const repos = await repositoryService.getRepositories();
      setAllRepos(repos);
    } catch (e) {
      console.error(e);
      setLoadError('GitHub authorization has expired. Sign out and sign in with GitHub again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRepo = (name: string) => {
    setSelectedRepos((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name]
    );
  };

  const handleSave = () => {
    onSavePermissions(selectedRepos);
    success(`Updated repository permissions (${selectedRepos.length} authorized)`);
    onClose();
  };

  const filteredRepos = allRepos.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-6 shadow-2xl backdrop-blur-xl z-10 space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-purple-600 p-2 text-white shadow-md">
                  <GithubIcon className="h-5 w-5 fill-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                    Manage Repository Access
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Select which GitHub repositories FlowForge AI monitors.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Note required by spec */}
            <div className="flex items-start gap-2.5 rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 text-xs text-purple-700 dark:text-purple-300">
              <ShieldCheck className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
              <span className="leading-relaxed">
                <i>FlowForge AI only accesses repositories authorized by you.</i>
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-purple-500" />
              <input
                type="text"
                placeholder="Search your GitHub repositories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 py-2.5 pl-10 pr-4 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
              />
            </div>

            {/* Repositories Checklist */}
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-terminal">
              {loading ? (
                <div className="py-8 flex items-center justify-center">
                  <RefreshCw className="h-6 w-6 text-purple-600 animate-spin" />
                </div>
              ) : loadError ? (
                <div className="py-8 text-center text-xs text-rose-500 dark:text-rose-400">
                  {loadError}
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No repositories found.
                </div>
              ) : (
                filteredRepos.map((repo) => {
                  const isSelected = selectedRepos.includes(repo.name);
                  return (
                    <div
                      key={repo.name}
                      onClick={() => toggleRepo(repo.name)}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/10 text-slate-900 dark:text-white shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{repo.name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                              {repo.isPrivate ? 'Private' : 'Public'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{repo.description}</p>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 shrink-0 ml-2">
                        {repo.language}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                <b className="text-slate-900 dark:text-white">{selectedRepos.length}</b> repositories selected
              </span>
              <div className="flex gap-2.5">
                <button
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-700 shadow-md transition-all"
                >
                  Save Access
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
