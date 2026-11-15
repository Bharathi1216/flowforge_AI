import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Check, MessageSquare, Pin, Send, Sparkles, Terminal } from 'lucide-react';
import React, { useState } from 'react';
import { useAIAssistant } from '../contexts/assistantState';
import { useAuth } from '../contexts/authState';
import { useToast } from '../contexts/toastState';
import { aiService } from '../services/aiService';
import { Comment, Discussion } from '../types';
import { AIExplanationCard } from './AIExplanationCard';

interface ThreadViewProps {
  repoId: string;
  discussions: Discussion[];
  selectedDiscussion: Discussion | null;
  comments: Comment[];
  onSelectDiscussion: (disc: Discussion) => void;
  onAddComment: (discId: string, text: string) => Promise<void>;
  onResolveDiscussion?: (discId: string, status: 'resolved' | 'open') => Promise<void>;
}

export const ThreadView: React.FC<ThreadViewProps> = ({
  repoId,
  discussions,
  selectedDiscussion,
  comments,
  onSelectDiscussion,
  onAddComment,
  onResolveDiscussion,
}) => {
  const { success, error: showError } = useToast();
  const { openAssistant } = useAIAssistant();
  const [replyText, setReplyText] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);
  const [posting, setPosting] = useState(false);
  const { user } = useAuth();
  const diagnosis = useQuery({
    queryKey: ['saved-analysis', user?.id, repoId, selectedDiscussion?.runId],
    queryFn: () => aiService.getSavedAnalysis(selectedDiscussion!.runId!, repoId),
    enabled: !!selectedDiscussion?.runId,
  });

  const handleToggleResolve = async () => {
    if (!selectedDiscussion || !onResolveDiscussion) return;
    setIsResolving(true);
    try {
      const nextStatus = selectedDiscussion.status === 'resolved' ? 'open' : 'resolved';
      await onResolveDiscussion(selectedDiscussion.id, nextStatus);
      success(
        nextStatus === 'resolved'
          ? 'Discussion thread resolved on GitHub.'
          : 'Discussion thread reopened on GitHub.',
        nextStatus === 'resolved' ? 'Thread Resolved' : 'Thread Reopened',
      );
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
      showError(typeof detail === 'string' ? detail : 'Could not update thread status.', 'Error');
    } finally {
      setIsResolving(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedDiscussion || posting) return;
    setPosting(true);
    const userText = replyText;
    try {
      await onAddComment(selectedDiscussion.id, userText);
      setReplyText('');
      success('Message sent to the GitHub thread.', 'Reply Posted');
    } catch (error) {
      const detail = axios.isAxiosError(error) ? error.response?.data?.detail : null;
      showError(
        typeof detail === 'string' ? detail : 'Could not post this reply.',
        'Reply not posted',
      );
    } finally {
      setPosting(false);
    }
  };

  const suggestedFixCode = diagnosis.data?.suggestedFix || '';

  const handleCopyFix = () => {
    navigator.clipboard.writeText(suggestedFixCode);
    setCopiedFix(true);
    success('Suggested command copied to clipboard!');
    setTimeout(() => setCopiedFix(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
      {/* Left Column: Discussion Threads List */}
      <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-4 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Discussion Threads
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-mono font-bold">
                  {discussions.length}
                </span>
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Team failure discussions & solutions
              </p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1 scrollbar-terminal">
            {discussions.map((disc, idx) => {
              const isSelected = selectedDiscussion?.id === disc.id;
              const isLatest = idx === 0;
              return (
                <div
                  key={disc.id}
                  onClick={() => {
                    onSelectDiscussion(disc);
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/20 text-slate-900 dark:text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isLatest && (
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                      )}
                      <h4
                        className={`text-xs font-bold truncate ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-slate-800 dark:text-slate-200'}`}
                      >
                        {disc.title}
                      </h4>
                    </div>
                    {disc.isPinned && <Pin className="h-3 w-3 text-purple-500 shrink-0 mt-0.5" />}
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 font-mono">
                    {disc.content}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800 font-mono">
                    <div className="flex items-center gap-1.5">
                      <img
                        src={disc.author.avatarUrl}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover ring-1 ring-slate-300 dark:ring-slate-700"
                      />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        @{disc.author.username}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                      <MessageSquare className="h-3 w-3" />
                      {disc.commentsCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Thread View */}
      <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121D] p-5 shadow-sm flex flex-col justify-between space-y-4">
        {selectedDiscussion ? (
          /* Active Thread View */
          <div className="flex flex-col h-full justify-between space-y-4">
            <div className="max-h-[380px] overflow-y-auto space-y-4 pr-1 scrollbar-terminal">
              {/* Thread Header Info */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedDiscussion.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <img
                      src={selectedDiscussion.author.avatarUrl}
                      alt=""
                      className="h-4 w-4 rounded-full object-cover ring-1 ring-purple-500/30"
                    />
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">
                      @{selectedDiscussion.author.username}
                    </span>
                    <span>•</span>
                    <span>{selectedDiscussion.timestamp || 'Today'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-bold ${
                      selectedDiscussion.status === 'resolved'
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {selectedDiscussion.status === 'resolved' ? 'Resolved' : 'Open'}
                  </span>
                  {onResolveDiscussion && (
                    <button
                      type="button"
                      disabled={isResolving}
                      onClick={handleToggleResolve}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                        selectedDiscussion.status === 'resolved'
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      <Check className="h-3 w-3" />
                      <span>{selectedDiscussion.status === 'resolved' ? 'Reopen' : 'Resolve'}</span>
                    </button>
                  )}
                  <button
                    onClick={() =>
                      openAssistant(
                        `Analyze thread failure: ${selectedDiscussion.title}\n\n${selectedDiscussion.content}`,
                        repoId,
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-[11px] font-bold transition-all"
                  >
                    <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                    <span>Ask AI</span>
                  </button>
                </div>
              </div>

              {/* 1. Captured GitHub Actions Failure Log Box */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200 overflow-hidden shadow-inner">
                <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-b border-slate-800 text-[10px] font-bold font-mono">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Terminal className="h-3.5 w-3.5 text-purple-400" />
                    <span>Pushed GitHub Actions Failure Log</span>
                  </span>
                  <span className="text-rose-400">Exit Code 1</span>
                </div>
                <pre className="font-mono text-xs text-rose-300 p-3.5 whitespace-pre-wrap max-h-28 overflow-y-auto scrollbar-terminal leading-relaxed select-text">
                  {selectedDiscussion.content}
                </pre>
              </div>

              {diagnosis.isError && (
                <p role="alert" className="text-xs text-amber-600">
                  Saved diagnostics could not be loaded.
                </p>
              )}
              {diagnosis.data ? (
                <>
                  <AIExplanationCard
                    summary={diagnosis.data.summary}
                    rootCause={diagnosis.data.rootCause}
                    repoId={repoId}
                  />
                  {suggestedFixCode && (
                    <div className="rounded-xl border border-purple-200 dark:border-purple-800 p-4 space-y-2">
                      <button onClick={handleCopyFix} className="text-xs font-bold text-purple-600">
                        {copiedFix ? 'Copied' : 'Copy saved fix'}
                      </button>
                      <pre className="whitespace-pre-wrap text-xs">{suggestedFixCode}</pre>
                    </div>
                  )}
                  {diagnosis.data.similarPreviousRunId && (
                    <p className="text-xs text-slate-500">
                      Historical reference: run #{diagnosis.data.similarPreviousRunNumber} (
                      {diagnosis.data.similarMatchPercent}% similarity).
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  No saved diagnosis is linked to this discussion. Analyze its workflow run to add
                  diagnostics.
                </p>
              )}
            </div>

            {/* Teammates Chat Stream */}
            <div className="flex-1 max-h-[220px] overflow-y-auto space-y-2.5 pr-1 scrollbar-terminal py-1 border-t border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono pt-1 pb-1">
                Developer Collaboration Stream
              </div>

              {comments.map((comment) => {
                const isCurrentUser = comment.author.username === user?.username;
                const isAI =
                  comment.author.username === 'flowforge-ai' || comment.content.includes('🤖');
                return (
                  <div
                    key={comment.id}
                    className={`flex items-start gap-2.5 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <img
                      src={comment.author.avatarUrl}
                      alt={comment.author.name}
                      className="h-6 w-6 rounded-full object-cover shrink-0 mt-1 ring-1 ring-slate-300 dark:ring-slate-700"
                    />
                    <div
                      className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                        isCurrentUser
                          ? 'bg-purple-600 text-white shadow-sm'
                          : isAI
                            ? 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 text-slate-800 dark:text-slate-200'
                            : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] opacity-85 mb-1 font-mono">
                        <span className="font-bold">{comment.author.name}</span>
                        <span>{comment.timestamp || 'Date unavailable'}</span>
                      </div>
                      <div className="whitespace-pre-wrap font-sans">{comment.content}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Developer Query / Chat Input Bar */}
            <form
              onSubmit={handleSendReply}
              className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800"
            >
              <input
                type="text"
                placeholder="Ask AI for a patch, discuss with team, or type a question..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 py-2.5 px-4 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-700 transition-all shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-8">
            <MessageSquare className="h-8 w-8 text-slate-400 mb-2" />
            <span className="text-xs">
              Select a thread on the left to inspect logs, AI diagnosis, and reply
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
